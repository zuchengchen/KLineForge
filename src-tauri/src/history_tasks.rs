use std::{
    collections::{HashSet, VecDeque},
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
};

use chrono::{Datelike, TimeZone, Utc};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

use crate::{
    db::{Database, KlineGap, cache_task_id, now_ms},
    domain::{CacheTask, CacheTaskPayload, KlineRequest, Market, interval_ms},
    error::{AppError, AppResult},
    state::AppState,
};

const BINANCE_KLINE_PAGE_LIMIT: u32 = 1_500;
const MAX_CONCURRENT_FULL_HISTORY_TASKS: usize = 2;
const MAX_EMPTY_ARCHIVE_MONTHS_AFTER_FIRST_HIT: usize = 12;
const MAX_EMPTY_ARCHIVE_MONTHS_BEFORE_FIRST_HIT: usize = 3;
const MAX_INTEGRITY_GAPS_PER_PASS: usize = 64;
const MAX_INTEGRITY_REPAIR_PASSES: usize = 8;
const MAX_REST_PAGES_PER_GAP: usize = 20_000;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FullHistoryEnqueueRequest {
    pub market: Market,
    pub symbol: String,
    pub intervals: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FullHistoryValidation {
    pub task: CacheTask,
    pub row_count: i64,
    pub first_open_time: i64,
    pub last_open_time: i64,
}

#[derive(Clone)]
pub struct HistoryTaskManager {
    inner: Arc<HistoryTaskManagerInner>,
}

struct HistoryTaskManagerInner {
    queue: Mutex<VecDeque<KlineRequest>>,
    queued_or_running: Mutex<HashSet<String>>,
    running: Mutex<HashSet<String>>,
    cancellations: Mutex<std::collections::HashMap<String, Arc<AtomicBool>>>,
    active_workers: Mutex<usize>,
}

impl HistoryTaskManager {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(HistoryTaskManagerInner {
                queue: Mutex::new(VecDeque::new()),
                queued_or_running: Mutex::new(HashSet::new()),
                running: Mutex::new(HashSet::new()),
                cancellations: Mutex::new(std::collections::HashMap::new()),
                active_workers: Mutex::new(0),
            }),
        }
    }

    pub async fn enqueue(&self, state: &AppState, request: KlineRequest) -> AppResult<CacheTask> {
        let request = normalize_history_request(request)?;
        let id = cache_task_id(request.market, &request.symbol, &request.interval);
        let task = state
            .db
            .enqueue_cache_task(
                &request,
                CacheTaskPayload {
                    phase: "queued".to_string(),
                    message: Some("Waiting for full-history download worker".to_string()),
                    ..CacheTaskPayload::default()
                },
            )
            .await?;
        let mut tracked = self.inner.queued_or_running.lock().await;

        if !tracked.contains(&id) {
            tracked.insert(id);
            self.inner.queue.lock().await.push_back(request);
            drop(tracked);
            self.spawn_drain_workers(state.clone()).await;
        }

        Ok(task)
    }

    pub async fn retry(&self, state: &AppState, id: &str) -> AppResult<CacheTask> {
        let task = state
            .db
            .cache_task(id)
            .await?
            .ok_or_else(|| AppError::Message(format!("cache task not found: {id}")))?;

        self.enqueue(
            state,
            KlineRequest {
                market: task.market,
                symbol: task.symbol,
                interval: task.interval,
                limit: None,
                start_time: None,
                end_time: None,
            },
        )
        .await
    }

    pub async fn cancel(&self, state: &AppState, id: &str) -> AppResult<Option<CacheTask>> {
        if let Some(flag) = self.inner.cancellations.lock().await.get(id) {
            flag.store(true, Ordering::SeqCst);
        }

        {
            let mut queue = self.inner.queue.lock().await;
            queue.retain(|request| {
                cache_task_id(request.market, &request.symbol, &request.interval) != id
            });
        }
        self.inner.queued_or_running.lock().await.remove(id);

        if let Some(mut task) = state.db.cache_task(id).await? {
            if matches!(task.status.as_str(), "queued" | "running") {
                let payload = CacheTaskPayload {
                    phase: "cancelled".to_string(),
                    message: Some("Cancelled by user".to_string()),
                    rows_written: task.rows_written,
                    source: task.source.clone(),
                    first_open_time: task.first_open_time,
                    last_open_time: task.last_open_time,
                    archive_months: task.archive_months,
                    rest_pages: task.rest_pages,
                    finished_at: Some(now_ms()),
                    ..CacheTaskPayload::default()
                };
                state
                    .db
                    .update_cache_task(id, "cancelled", task.progress, &payload)
                    .await?;
                task = state.db.cache_task(id).await?.unwrap_or(task);
            }

            Ok(Some(task))
        } else {
            Ok(None)
        }
    }

    async fn next_task(&self) -> Option<(KlineRequest, String, Arc<AtomicBool>)> {
        let mut queue = self.inner.queue.lock().await;
        let request = queue.pop_front()?;
        drop(queue);

        let id = cache_task_id(request.market, &request.symbol, &request.interval);
        let cancellation = Arc::new(AtomicBool::new(false));
        self.inner.running.lock().await.insert(id.clone());
        self.inner
            .cancellations
            .lock()
            .await
            .insert(id.clone(), cancellation.clone());

        Some((request, id, cancellation))
    }

    async fn spawn_drain_workers(&self, state: AppState) {
        let queue_len = self.inner.queue.lock().await.len();
        let mut active_workers = self.inner.active_workers.lock().await;
        let available = MAX_CONCURRENT_FULL_HISTORY_TASKS.saturating_sub(*active_workers);
        let workers_to_spawn = available.min(queue_len);

        for _ in 0..workers_to_spawn {
            *active_workers += 1;
            let manager = self.clone();
            let state = state.clone();
            tauri::async_runtime::spawn(async move {
                while let Some((request, id, cancellation)) = manager.next_task().await {
                    manager
                        .run_task(state.clone(), request, &id, cancellation)
                        .await;
                }

                let mut active_workers = manager.inner.active_workers.lock().await;
                *active_workers = active_workers.saturating_sub(1);
            });
        }
    }

    async fn run_task(
        &self,
        state: AppState,
        request: KlineRequest,
        id: &str,
        cancellation: Arc<AtomicBool>,
    ) {
        let result = run_full_history_download(&state, &request, id, &cancellation).await;

        if let Err(error) = result {
            let status = if cancellation.load(Ordering::SeqCst) {
                "cancelled"
            } else {
                "failed"
            };
            let phase = status.to_string();
            let existing = state.db.cache_task(id).await.ok().flatten();
            let payload = CacheTaskPayload {
                phase,
                message: Some(error.to_string()),
                rows_written: existing
                    .as_ref()
                    .map(|task| task.rows_written)
                    .unwrap_or_default(),
                source: existing.as_ref().and_then(|task| task.source.clone()),
                first_open_time: existing.as_ref().and_then(|task| task.first_open_time),
                last_open_time: existing.as_ref().and_then(|task| task.last_open_time),
                archive_months: existing
                    .as_ref()
                    .map(|task| task.archive_months)
                    .unwrap_or_default(),
                rest_pages: existing
                    .as_ref()
                    .map(|task| task.rest_pages)
                    .unwrap_or_default(),
                finished_at: Some(now_ms()),
                ..CacheTaskPayload::default()
            };

            if let Err(update_error) = state
                .db
                .update_cache_task(
                    id,
                    status,
                    existing
                        .as_ref()
                        .map(|task| task.progress)
                        .unwrap_or_default(),
                    &payload,
                )
                .await
            {
                tracing::warn!("failed to persist full-history task error: {update_error}");
            }
        }

        self.inner.running.lock().await.remove(id);
        self.inner.cancellations.lock().await.remove(id);
        self.inner.queued_or_running.lock().await.remove(id);
    }
}

impl Default for HistoryTaskManager {
    fn default() -> Self {
        Self::new()
    }
}

pub async fn enqueue_full_history_tasks(
    state: &AppState,
    request: FullHistoryEnqueueRequest,
) -> AppResult<Vec<CacheTask>> {
    let mut tasks = Vec::new();
    let mut seen = HashSet::new();

    for interval in request.intervals {
        if !seen.insert(interval.clone()) {
            continue;
        }

        tasks.push(
            state
                .history_tasks
                .enqueue(
                    state,
                    KlineRequest {
                        market: request.market,
                        symbol: request.symbol.clone(),
                        interval,
                        limit: None,
                        start_time: None,
                        end_time: None,
                    },
                )
                .await?,
        );
    }

    Ok(tasks)
}

pub async fn repair_cached_history_integrity(state: &AppState) -> AppResult<Vec<CacheTask>> {
    let scopes = state.db.cached_kline_scopes().await?;
    let mut tasks = Vec::with_capacity(scopes.len());

    for request in scopes {
        tasks.push(state.history_tasks.enqueue(state, request).await?);
    }

    Ok(tasks)
}

pub async fn run_full_history_validation(
    state: &AppState,
    request: KlineRequest,
) -> AppResult<FullHistoryValidation> {
    let request = normalize_history_request(request)?;
    let id = cache_task_id(request.market, &request.symbol, &request.interval);
    let cancellation = Arc::new(AtomicBool::new(false));

    state
        .db
        .enqueue_cache_task(
            &request,
            CacheTaskPayload {
                phase: "validation".to_string(),
                message: Some("Running required full-history validation".to_string()),
                ..CacheTaskPayload::default()
            },
        )
        .await?;
    run_full_history_download(state, &request, &id, &cancellation).await?;
    let task =
        state.db.cache_task(&id).await?.ok_or_else(|| {
            AppError::Message("validation task missing after completion".to_string())
        })?;
    let (row_count, first_open_time, last_open_time) = state
        .db
        .kline_bounds(request.market, &request.symbol, &request.interval)
        .await?
        .ok_or_else(|| AppError::Message("validation wrote no rows".to_string()))?;

    Ok(FullHistoryValidation {
        task,
        row_count,
        first_open_time,
        last_open_time,
    })
}

async fn run_full_history_download(
    state: &AppState,
    request: &KlineRequest,
    id: &str,
    cancellation: &AtomicBool,
) -> AppResult<()> {
    let interval = interval_ms(&request.interval).ok_or_else(|| {
        AppError::Message(format!("unsupported K-line interval: {}", request.interval))
    })?;
    let mut tracker = TaskProgressTracker::new(state.db.clone(), id.to_string(), request.clone());

    tracker
        .update(
            "running",
            0.02,
            "starting",
            Some("Discovering latest K-line".to_string()),
        )
        .await?;
    check_cancelled(cancellation)?;

    let latest = fetch_latest_kline(state, request).await?;
    tracker.latest_open_time = Some(latest);
    tracker
        .update(
            "running",
            0.05,
            "archive",
            Some("Downloading monthly archives".to_string()),
        )
        .await?;

    let earliest_archive = ingest_archives(state, request, &mut tracker, cancellation).await?;
    tracker
        .update(
            "running",
            0.82,
            "rest",
            Some("Filling REST ranges".to_string()),
        )
        .await?;
    check_cancelled(cancellation)?;

    let bounds = state
        .db
        .kline_bounds(request.market, &request.symbol, &request.interval)
        .await?;
    let earliest = if let Some((_, first, _)) = bounds {
        Some(first)
    } else {
        earliest_archive
    };

    if let Some(earliest) = earliest {
        if earliest > 0 {
            fetch_rest_range(
                state,
                request,
                0,
                earliest.saturating_sub(1),
                &mut tracker,
                cancellation,
                true,
            )
            .await?;
        }
    } else {
        fetch_rest_range(
            state,
            request,
            0,
            latest + interval,
            &mut tracker,
            cancellation,
            true,
        )
        .await?;
    }

    let bounds = state
        .db
        .kline_bounds(request.market, &request.symbol, &request.interval)
        .await?;
    if let Some((_, _, last)) = bounds
        && last.saturating_add(interval) <= latest
    {
        fetch_rest_range(
            state,
            request,
            last.saturating_add(interval),
            latest + interval,
            &mut tracker,
            cancellation,
            true,
        )
        .await?;
    }

    let repaired_gaps =
        repair_integrity_gaps(state, request, interval, &mut tracker, cancellation).await?;

    let bounds = state
        .db
        .kline_bounds(request.market, &request.symbol, &request.interval)
        .await?
        .ok_or_else(|| AppError::Message("full-history task completed without rows".to_string()))?;
    tracker.row_count = bounds.0;
    tracker.first_open_time = Some(bounds.1);
    tracker.last_open_time = Some(bounds.2);
    tracker
        .update(
            "complete",
            1.0,
            "complete",
            Some(if repaired_gaps > 0 {
                format!("Full history cached; repaired {repaired_gaps} integrity gaps")
            } else {
                "Full history cached and integrity checked".to_string()
            }),
        )
        .await?;

    Ok(())
}

async fn fetch_latest_kline(state: &AppState, request: &KlineRequest) -> AppResult<i64> {
    let mut latest_request = request.clone();
    latest_request.limit = Some(1);
    latest_request.start_time = None;
    latest_request.end_time = None;
    let rows = state.binance.get_klines(&latest_request).await?;

    rows.last()
        .map(|row| row.open_time)
        .ok_or_else(|| AppError::Message("Binance returned no latest K-line".to_string()))
}

async fn ingest_archives(
    state: &AppState,
    request: &KlineRequest,
    tracker: &mut TaskProgressTracker,
    cancellation: &AtomicBool,
) -> AppResult<Option<i64>> {
    let months = completed_archive_months();
    let total_months = months.len().max(1);
    let mut earliest = None;
    let mut seen_archive = false;
    let mut empty_streak = 0usize;

    for (index, (year, month)) in months.into_iter().enumerate() {
        check_cancelled(cancellation)?;
        let month_start = month_start_ms(year, month)?;
        let month_end = month_end_ms(year, month)?;

        if state
            .db
            .kline_range_completed(request, month_start, month_end)
            .await?
        {
            if let Some((_, first, _)) = state
                .db
                .kline_bounds(request.market, &request.symbol, &request.interval)
                .await?
            {
                earliest = Some(earliest.map_or(first, |current: i64| current.min(first)));
            }
            continue;
        }

        match state
            .binance
            .get_monthly_archive_klines(request, year, month)
            .await?
        {
            Some(rows) if rows.is_empty() => {
                empty_streak += 1;
            }
            Some(rows) => {
                empty_streak = 0;
                seen_archive = true;
                let first = rows.first().map(|row| row.open_time);
                state.db.write_klines(&rows).await?;
                state
                    .db
                    .upsert_kline_range(
                        request,
                        month_start,
                        month_end,
                        "binance-public-data",
                        "complete",
                    )
                    .await?;
                tracker.archive_months += 1;
                tracker.source = Some("binance-public-data+binance-rest".to_string());
                tracker.refresh_bounds().await?;
                if let Some(first) = first {
                    earliest = Some(earliest.map_or(first, |current| current.min(first)));
                }
            }
            None => {
                if seen_archive {
                    empty_streak += 1;
                } else if index >= MAX_EMPTY_ARCHIVE_MONTHS_BEFORE_FIRST_HIT {
                    break;
                } else {
                    empty_streak += 1;
                }
            }
        }

        let progress = 0.05 + ((index + 1) as f64 / total_months as f64) * 0.72;
        tracker
            .update(
                "running",
                progress,
                "archive",
                Some(format!("Checked archive {year}-{month:02}")),
            )
            .await?;

        if seen_archive && empty_streak >= MAX_EMPTY_ARCHIVE_MONTHS_AFTER_FIRST_HIT {
            break;
        }
    }

    Ok(earliest)
}

async fn repair_integrity_gaps(
    state: &AppState,
    request: &KlineRequest,
    interval: i64,
    tracker: &mut TaskProgressTracker,
    cancellation: &AtomicBool,
) -> AppResult<usize> {
    let mut repaired_gaps = 0usize;

    for pass in 0..MAX_INTEGRITY_REPAIR_PASSES {
        check_cancelled(cancellation)?;
        let gaps = integrity_gaps(state, request, interval).await?;

        if gaps.is_empty() {
            tracker
                .update(
                    "running",
                    0.98,
                    "integrity",
                    Some("History integrity check passed".to_string()),
                )
                .await?;
            return Ok(repaired_gaps);
        }

        tracker
            .update(
                "running",
                0.96,
                "integrity",
                Some(format!(
                    "Repairing {} history gaps (pass {})",
                    gaps.len(),
                    pass + 1
                )),
            )
            .await?;

        let mut repaired_this_pass = 0usize;
        for gap in gaps {
            repaired_this_pass +=
                repair_integrity_gap(state, request, &gap, tracker, cancellation).await?;
        }

        if repaired_this_pass == 0 {
            let remaining = integrity_gaps(state, request, interval).await?;
            return Err(AppError::Message(format!(
                "history integrity check found {} gaps that REST could not repair for {} {} {}",
                remaining.len(),
                request.market.as_str(),
                request.symbol.to_uppercase(),
                request.interval
            )));
        }

        repaired_gaps += repaired_this_pass;
    }

    Err(AppError::Message(format!(
        "history integrity repair exceeded {MAX_INTEGRITY_REPAIR_PASSES} passes for {} {} {}",
        request.market.as_str(),
        request.symbol.to_uppercase(),
        request.interval
    )))
}

async fn integrity_gaps(
    state: &AppState,
    request: &KlineRequest,
    interval: i64,
) -> AppResult<Vec<KlineGap>> {
    if request.interval == "1M" {
        monthly_integrity_gaps(state, request, MAX_INTEGRITY_GAPS_PER_PASS).await
    } else {
        state
            .db
            .kline_gaps(request, interval, MAX_INTEGRITY_GAPS_PER_PASS)
            .await
    }
}

async fn monthly_integrity_gaps(
    state: &AppState,
    request: &KlineRequest,
    limit: usize,
) -> AppResult<Vec<KlineGap>> {
    if limit == 0 {
        return Ok(Vec::new());
    }

    let rows = state
        .db
        .read_klines(&KlineRequest {
            limit: None,
            start_time: None,
            end_time: None,
            ..request.clone()
        })
        .await?;
    let mut gaps = Vec::new();

    for pair in rows.windows(2) {
        let previous = pair[0].open_time;
        let next = pair[1].open_time;
        let expected = next_month_start_ms(previous)?;

        if expected < next {
            gaps.push(KlineGap {
                start_time: expected,
                end_time: next.saturating_sub(1),
                previous_open_time: previous,
                next_open_time: next,
            });
        }

        if gaps.len() >= limit {
            break;
        }
    }

    Ok(gaps)
}

async fn repair_integrity_gap(
    state: &AppState,
    request: &KlineRequest,
    gap: &KlineGap,
    tracker: &mut TaskProgressTracker,
    cancellation: &AtomicBool,
) -> AppResult<usize> {
    let fetched_rows = fetch_rest_range(
        state,
        request,
        gap.start_time,
        gap.end_time,
        tracker,
        cancellation,
        true,
    )
    .await?;

    if fetched_rows > 0 { Ok(1) } else { Ok(0) }
}

async fn fetch_rest_range(
    state: &AppState,
    request: &KlineRequest,
    start_time: i64,
    end_time: i64,
    tracker: &mut TaskProgressTracker,
    cancellation: &AtomicBool,
    force: bool,
) -> AppResult<usize> {
    if start_time > end_time {
        return Ok(0);
    }

    if !force
        && state
            .db
            .kline_range_completed(request, start_time, end_time)
            .await?
    {
        return Ok(0);
    }

    let mut next_start = start_time.max(0);
    let mut pages = 0usize;
    let mut fetched_rows = 0usize;
    let interval = interval_ms(&request.interval).unwrap_or(60_000);

    while next_start <= end_time {
        check_cancelled(cancellation)?;

        if pages >= MAX_REST_PAGES_PER_GAP {
            return Err(AppError::Message(format!(
                "REST gap fill exceeded {MAX_REST_PAGES_PER_GAP} pages for {} {} {}",
                request.market.as_str(),
                request.symbol.to_uppercase(),
                request.interval
            )));
        }

        let page = KlineRequest {
            limit: Some(BINANCE_KLINE_PAGE_LIMIT),
            start_time: Some(next_start),
            end_time: Some(end_time),
            ..request.clone()
        };
        let rows = state.binance.get_klines(&page).await?;

        if rows.is_empty() {
            break;
        }

        let first = rows.first().map(|row| row.open_time).unwrap_or(next_start);
        let last = rows.last().map(|row| row.open_time).unwrap_or(first);
        let row_count = rows.len();
        state.db.write_klines(&rows).await?;
        state
            .db
            .upsert_kline_range(request, first, last, "binance-rest", "complete")
            .await?;
        fetched_rows += row_count;
        tracker.rest_pages += 1;
        tracker.source = Some("binance-public-data+binance-rest".to_string());
        tracker.refresh_bounds().await?;
        tracker
            .update(
                "running",
                0.84 + ((tracker.rest_pages as f64).min(100.0) / 100.0) * 0.12,
                "rest",
                Some(format!("REST filled through open time {last}")),
            )
            .await?;

        pages += 1;

        if row_count < BINANCE_KLINE_PAGE_LIMIT as usize || last <= next_start {
            break;
        }

        next_start = last.saturating_add(interval);
    }

    Ok(fetched_rows)
}

fn normalize_history_request(mut request: KlineRequest) -> AppResult<KlineRequest> {
    if request.symbol.trim().is_empty() {
        return Err(AppError::Message("symbol is required".to_string()));
    }

    if interval_ms(&request.interval).is_none() {
        return Err(AppError::Message(format!(
            "unsupported K-line interval: {}",
            request.interval
        )));
    }

    request.symbol = request.symbol.to_uppercase();
    request.limit = None;
    request.start_time = None;
    request.end_time = None;

    Ok(request)
}

fn completed_archive_months() -> Vec<(i32, u32)> {
    let now = Utc::now();
    let mut year = now.year();
    let mut month = now.month() as i32 - 1;

    if month == 0 {
        year -= 1;
        month = 12;
    }

    let mut months = Vec::new();

    while year >= 2017 {
        months.push((year, month as u32));

        month -= 1;
        if month == 0 {
            year -= 1;
            month = 12;
        }
    }

    months
}

fn month_start_ms(year: i32, month: u32) -> AppResult<i64> {
    Utc.with_ymd_and_hms(year, month, 1, 0, 0, 0)
        .single()
        .map(|value| value.timestamp_millis())
        .ok_or_else(|| AppError::Message(format!("invalid archive month: {year}-{month:02}")))
}

fn month_end_ms(year: i32, month: u32) -> AppResult<i64> {
    let (next_year, next_month) = if month == 12 {
        (year + 1, 1)
    } else {
        (year, month + 1)
    };

    Ok(month_start_ms(next_year, next_month)?.saturating_sub(1))
}

fn next_month_start_ms(open_time: i64) -> AppResult<i64> {
    let current = Utc
        .timestamp_millis_opt(open_time)
        .single()
        .ok_or_else(|| {
            AppError::Message(format!("invalid monthly K-line open time: {open_time}"))
        })?;
    let (next_year, next_month) = if current.month() == 12 {
        (current.year() + 1, 1)
    } else {
        (current.year(), current.month() + 1)
    };

    month_start_ms(next_year, next_month)
}

fn check_cancelled(cancellation: &AtomicBool) -> AppResult<()> {
    if cancellation.load(Ordering::SeqCst) {
        Err(AppError::Message("Cancelled by user".to_string()))
    } else {
        Ok(())
    }
}

struct TaskProgressTracker {
    db: Database,
    id: String,
    request: KlineRequest,
    row_count: i64,
    source: Option<String>,
    first_open_time: Option<i64>,
    last_open_time: Option<i64>,
    latest_open_time: Option<i64>,
    archive_months: i64,
    rest_pages: i64,
    started_at: i64,
}

impl TaskProgressTracker {
    fn new(db: Database, id: String, request: KlineRequest) -> Self {
        Self {
            db,
            id,
            request,
            row_count: 0,
            source: None,
            first_open_time: None,
            last_open_time: None,
            latest_open_time: None,
            archive_months: 0,
            rest_pages: 0,
            started_at: now_ms(),
        }
    }

    async fn refresh_bounds(&mut self) -> AppResult<()> {
        if let Some((row_count, first, last)) = self
            .db
            .kline_bounds(
                self.request.market,
                &self.request.symbol,
                &self.request.interval,
            )
            .await?
        {
            self.row_count = row_count;
            self.first_open_time = Some(first);
            self.last_open_time = Some(last);
        }

        Ok(())
    }

    async fn update(
        &mut self,
        status: &str,
        progress: f64,
        phase: &str,
        message: Option<String>,
    ) -> AppResult<()> {
        self.refresh_bounds().await?;
        let payload = CacheTaskPayload {
            phase: phase.to_string(),
            message,
            rows_written: self.row_count,
            source: self.source.clone(),
            first_open_time: self.first_open_time,
            last_open_time: self.last_open_time,
            archive_months: self.archive_months,
            rest_pages: self.rest_pages,
            started_at: Some(self.started_at),
            finished_at: (status == "complete").then_some(now_ms()),
            ..CacheTaskPayload::default()
        };

        self.db
            .update_cache_task(&self.id, status, progress, &payload)
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::Kline;

    #[test]
    fn archive_month_iteration_starts_before_current_month() {
        let months = completed_archive_months();
        let now = Utc::now();
        let first = months.first().expect("month");

        assert!(
            first.0 < now.year() || first.1 < now.month(),
            "first archive month should be completed before the current month"
        );
    }

    #[test]
    fn month_bounds_are_contiguous() {
        let start = month_start_ms(2026, 5).expect("start");
        let end = month_end_ms(2026, 5).expect("end");
        let next = month_start_ms(2026, 6).expect("next");

        assert_eq!(end + 1, next);
        assert!(start < end);
    }

    #[test]
    fn next_month_start_uses_calendar_months() {
        let january = month_start_ms(2026, 1).expect("january");
        let february = month_start_ms(2026, 2).expect("february");
        let march = month_start_ms(2026, 3).expect("march");

        assert_eq!(next_month_start_ms(january).expect("next"), february);
        assert_eq!(next_month_start_ms(february).expect("next"), march);
    }

    #[tokio::test]
    async fn monthly_integrity_gaps_use_calendar_months() {
        let db = Database::memory().await.expect("memory db");
        let state = AppState::new(db.clone());
        let request = KlineRequest {
            market: Market::UsdM,
            symbol: "BTCUSDT".to_string(),
            interval: "1M".to_string(),
            limit: None,
            start_time: None,
            end_time: None,
        };
        let january = month_start_ms(2026, 1).expect("january");
        let march = month_start_ms(2026, 3).expect("march");

        db.write_klines(&[test_kline("1M", january), test_kline("1M", march)])
            .await
            .expect("write");
        let gaps = monthly_integrity_gaps(&state, &request, 10)
            .await
            .expect("gaps");

        assert_eq!(gaps.len(), 1);
        assert_eq!(
            gaps[0].start_time,
            month_start_ms(2026, 2).expect("february")
        );
        assert_eq!(gaps[0].end_time, march - 1);
    }

    #[test]
    fn normalizes_history_request() {
        let request = normalize_history_request(KlineRequest {
            market: Market::UsdM,
            symbol: "btcusdt".to_string(),
            interval: "1h".to_string(),
            limit: Some(1_000),
            start_time: Some(1),
            end_time: Some(2),
        })
        .expect("request");

        assert_eq!(request.symbol, "BTCUSDT");
        assert_eq!(request.limit, None);
        assert_eq!(request.start_time, None);
        assert_eq!(request.end_time, None);
    }

    fn test_kline(interval: &str, open_time: i64) -> Kline {
        Kline {
            market: "usdM".to_string(),
            symbol: "BTCUSDT".to_string(),
            interval: interval.to_string(),
            open_time,
            close_time: open_time + interval_ms(interval).unwrap_or(60_000) - 1,
            open: "1".to_string(),
            high: "2".to_string(),
            low: "0.5".to_string(),
            close: "1.5".to_string(),
            volume: "42".to_string(),
            quote_volume: "84".to_string(),
            trade_count: 7,
            taker_buy_base_volume: "20".to_string(),
            taker_buy_quote_volume: "40".to_string(),
            is_closed: true,
            source: "test".to_string(),
            updated_at: open_time,
        }
    }
}
