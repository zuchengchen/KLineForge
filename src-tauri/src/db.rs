use std::path::PathBuf;

use sqlx::{SqlitePool, sqlite::SqliteConnectOptions};

use crate::{
    domain::{
        CacheClearRequest, CacheClearResult, CacheSummary, CacheTask, CacheTaskPayload, ChartId,
        IndicatorInstance, IndicatorKind, IndicatorParams, IndicatorSeries, Kline, KlineRequest,
        MAX_INDICATOR_INSTANCES_PER_SCOPE, Market, interval_ms,
    },
    error::{AppError, AppResult},
};

#[derive(Clone)]
pub struct Database {
    pool: SqlitePool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KlineDataVersion {
    pub row_count: i64,
    pub first_open_time: Option<i64>,
    pub last_open_time: Option<i64>,
    pub updated_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, sqlx::FromRow)]
pub struct KlineGap {
    pub start_time: i64,
    pub end_time: i64,
    pub previous_open_time: i64,
    pub next_open_time: i64,
}

#[derive(Debug, Clone)]
pub struct IndicatorSeriesCacheEntry {
    pub cache_key: String,
    pub market: Market,
    pub symbol: String,
    pub interval: String,
    pub chart_id: ChartId,
    pub request_start_time: i64,
    pub request_end_time: i64,
    pub request_limit: Option<u32>,
    pub kline_version: KlineDataVersion,
    pub instances_hash: String,
    pub series: Vec<IndicatorSeries>,
}

impl Database {
    pub async fn connect(path: PathBuf) -> AppResult<Self> {
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        let options = SqliteConnectOptions::new()
            .filename(path)
            .create_if_missing(true)
            .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
            .synchronous(sqlx::sqlite::SqliteSynchronous::Normal);
        let pool = SqlitePool::connect_with(options).await?;

        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .map_err(|error| {
                AppError::Message(format!("failed to run SQLite migrations: {error}"))
            })?;

        Ok(Self { pool })
    }

    pub async fn memory() -> AppResult<Self> {
        let pool = SqlitePool::connect("sqlite::memory:").await?;

        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .map_err(|error| {
                AppError::Message(format!(
                    "failed to run in-memory SQLite migrations: {error}"
                ))
            })?;

        Ok(Self { pool })
    }

    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    pub async fn write_klines(&self, rows: &[Kline]) -> AppResult<()> {
        if rows.is_empty() {
            return Ok(());
        }

        let mut tx = self.pool.begin().await?;

        for row in rows {
            sqlx::query(
                r#"
                INSERT INTO klines (
                    market, symbol, interval, open_time, close_time, open, high, low, close,
                    volume, quote_volume, trade_count, taker_buy_base_volume,
                    taker_buy_quote_volume, is_closed, source, updated_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
                ON CONFLICT(market, symbol, interval, open_time) DO UPDATE SET
                    close_time = excluded.close_time,
                    open = excluded.open,
                    high = excluded.high,
                    low = excluded.low,
                    close = excluded.close,
                    volume = excluded.volume,
                    quote_volume = excluded.quote_volume,
                    trade_count = excluded.trade_count,
                    taker_buy_base_volume = excluded.taker_buy_base_volume,
                    taker_buy_quote_volume = excluded.taker_buy_quote_volume,
                    is_closed = excluded.is_closed,
                    source = excluded.source,
                    updated_at = excluded.updated_at
                "#,
            )
            .bind(&row.market)
            .bind(&row.symbol)
            .bind(&row.interval)
            .bind(row.open_time)
            .bind(row.close_time)
            .bind(&row.open)
            .bind(&row.high)
            .bind(&row.low)
            .bind(&row.close)
            .bind(&row.volume)
            .bind(&row.quote_volume)
            .bind(row.trade_count)
            .bind(&row.taker_buy_base_volume)
            .bind(&row.taker_buy_quote_volume)
            .bind(row.is_closed)
            .bind(&row.source)
            .bind(row.updated_at)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;

        for (market, symbol, interval) in touched_kline_scopes(rows) {
            self.clear_indicator_series_cache_for_scope(market, &symbol, &interval)
                .await?;
        }

        Ok(())
    }

    pub async fn read_klines(&self, request: &KlineRequest) -> AppResult<Vec<Kline>> {
        let start_time = request.start_time.unwrap_or(0);
        let end_time = request.end_time.unwrap_or(i64::MAX);

        let query = base_kline_select_query(request.limit.is_some());
        let mut rows_query = sqlx::query_as::<_, Kline>(query)
            .bind(request.market.as_str())
            .bind(request.symbol.to_uppercase())
            .bind(&request.interval)
            .bind(start_time)
            .bind(end_time);

        if let Some(limit) = request.limit {
            rows_query = rows_query.bind(i64::from(limit));
        }

        rows_query
            .fetch_all(&self.pool)
            .await
            .map(|mut rows| {
                rows.reverse();
                rows
            })
            .map_err(AppError::from)
    }

    pub async fn count_klines(&self, request: &KlineRequest) -> AppResult<i64> {
        let start_time = request.start_time.unwrap_or(0);
        let end_time = request.end_time.unwrap_or(i64::MAX);

        sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COUNT(*)
            FROM klines
            WHERE market = ?1 AND symbol = ?2 AND interval = ?3 AND open_time BETWEEN ?4 AND ?5
            "#,
        )
        .bind(request.market.as_str())
        .bind(request.symbol.to_uppercase())
        .bind(&request.interval)
        .bind(start_time)
        .bind(end_time)
        .fetch_one(&self.pool)
        .await
        .map_err(AppError::from)
    }

    pub async fn kline_data_version(&self, request: &KlineRequest) -> AppResult<KlineDataVersion> {
        let start_time = request.start_time.unwrap_or(0);
        let end_time = request.end_time.unwrap_or(i64::MAX);

        if let Some(limit) = request.limit {
            return sqlx::query_as::<_, KlineDataVersionRow>(
                r#"
                SELECT
                    COUNT(*) AS row_count,
                    MIN(open_time) AS first_open_time,
                    MAX(open_time) AS last_open_time,
                    COALESCE(MAX(updated_at), 0) AS updated_at
                FROM (
                    SELECT open_time, updated_at
                    FROM klines
                    WHERE market = ?1 AND symbol = ?2 AND interval = ?3 AND open_time BETWEEN ?4 AND ?5
                    ORDER BY open_time DESC
                    LIMIT ?6
                )
                "#,
            )
            .bind(request.market.as_str())
            .bind(request.symbol.to_uppercase())
            .bind(&request.interval)
            .bind(start_time)
            .bind(end_time)
            .bind(i64::from(limit))
            .fetch_one(&self.pool)
            .await
            .map(KlineDataVersion::from)
            .map_err(AppError::from);
        }

        sqlx::query_as::<_, KlineDataVersionRow>(
            r#"
            SELECT
                COUNT(*) AS row_count,
                MIN(open_time) AS first_open_time,
                MAX(open_time) AS last_open_time,
                COALESCE(MAX(updated_at), 0) AS updated_at
            FROM klines
            WHERE market = ?1 AND symbol = ?2 AND interval = ?3 AND open_time BETWEEN ?4 AND ?5
            "#,
        )
        .bind(request.market.as_str())
        .bind(request.symbol.to_uppercase())
        .bind(&request.interval)
        .bind(start_time)
        .bind(end_time)
        .fetch_one(&self.pool)
        .await
        .map(KlineDataVersion::from)
        .map_err(AppError::from)
    }

    pub async fn indicator_series_cache(
        &self,
        cache_key: &str,
    ) -> AppResult<Option<IndicatorSeriesCacheEntry>> {
        let row = sqlx::query_as::<_, IndicatorSeriesCacheRow>(
            r#"
            SELECT
                cache_key,
                market,
                symbol,
                interval,
                chart_id,
                request_start_time,
                request_end_time,
                request_limit,
                kline_row_count,
                kline_first_open_time,
                kline_last_open_time,
                kline_updated_at,
                instances_hash,
                series_json
            FROM indicator_series_cache
            WHERE cache_key = ?1
            "#,
        )
        .bind(cache_key)
        .fetch_optional(&self.pool)
        .await?;

        row.map(IndicatorSeriesCacheEntry::try_from).transpose()
    }

    pub async fn upsert_indicator_series_cache(
        &self,
        entry: &IndicatorSeriesCacheEntry,
    ) -> AppResult<()> {
        sqlx::query(
            r#"
            INSERT INTO indicator_series_cache (
                cache_key,
                market,
                symbol,
                interval,
                chart_id,
                request_start_time,
                request_end_time,
                request_limit,
                kline_row_count,
                kline_first_open_time,
                kline_last_open_time,
                kline_updated_at,
                instances_hash,
                series_json,
                created_at,
                updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?15)
            ON CONFLICT(cache_key) DO UPDATE SET
                market = excluded.market,
                symbol = excluded.symbol,
                interval = excluded.interval,
                chart_id = excluded.chart_id,
                request_start_time = excluded.request_start_time,
                request_end_time = excluded.request_end_time,
                request_limit = excluded.request_limit,
                kline_row_count = excluded.kline_row_count,
                kline_first_open_time = excluded.kline_first_open_time,
                kline_last_open_time = excluded.kline_last_open_time,
                kline_updated_at = excluded.kline_updated_at,
                instances_hash = excluded.instances_hash,
                series_json = excluded.series_json,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(&entry.cache_key)
        .bind(entry.market.as_str())
        .bind(entry.symbol.to_uppercase())
        .bind(&entry.interval)
        .bind(entry.chart_id.as_str())
        .bind(entry.request_start_time)
        .bind(entry.request_end_time)
        .bind(entry.request_limit.map(i64::from))
        .bind(entry.kline_version.row_count)
        .bind(entry.kline_version.first_open_time)
        .bind(entry.kline_version.last_open_time)
        .bind(entry.kline_version.updated_at)
        .bind(&entry.instances_hash)
        .bind(serde_json::to_string(&entry.series)?)
        .bind(now_ms())
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn clear_indicator_series_cache_for_scope(
        &self,
        market: Market,
        symbol: &str,
        interval: &str,
    ) -> AppResult<()> {
        sqlx::query(
            r#"
            DELETE FROM indicator_series_cache
            WHERE market = ?1 AND symbol = ?2 AND interval = ?3
            "#,
        )
        .bind(market.as_str())
        .bind(symbol.to_uppercase())
        .bind(interval)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn clear_indicator_series_cache_for_indicator_scope(
        &self,
        chart_id: ChartId,
        interval: &str,
    ) -> AppResult<()> {
        sqlx::query(
            r#"
            DELETE FROM indicator_series_cache
            WHERE chart_id = ?1 AND interval = ?2
            "#,
        )
        .bind(chart_id.as_str())
        .bind(interval)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn clear_indicator_series_cache(&self, request: &CacheClearRequest) -> AppResult<()> {
        match (&request.market, &request.symbol, &request.interval) {
            (Some(market), Some(symbol), Some(interval)) => {
                sqlx::query(
                    "DELETE FROM indicator_series_cache WHERE market = ?1 AND symbol = ?2 AND interval = ?3",
                )
                .bind(market.as_str())
                .bind(symbol.to_uppercase())
                .bind(interval)
                .execute(&self.pool)
                .await?;
            }
            (Some(market), Some(symbol), None) => {
                sqlx::query("DELETE FROM indicator_series_cache WHERE market = ?1 AND symbol = ?2")
                    .bind(market.as_str())
                    .bind(symbol.to_uppercase())
                    .execute(&self.pool)
                    .await?;
            }
            (Some(market), None, Some(interval)) => {
                sqlx::query(
                    "DELETE FROM indicator_series_cache WHERE market = ?1 AND interval = ?2",
                )
                .bind(market.as_str())
                .bind(interval)
                .execute(&self.pool)
                .await?;
            }
            (Some(market), None, None) => {
                sqlx::query("DELETE FROM indicator_series_cache WHERE market = ?1")
                    .bind(market.as_str())
                    .execute(&self.pool)
                    .await?;
            }
            (None, Some(symbol), Some(interval)) => {
                sqlx::query(
                    "DELETE FROM indicator_series_cache WHERE symbol = ?1 AND interval = ?2",
                )
                .bind(symbol.to_uppercase())
                .bind(interval)
                .execute(&self.pool)
                .await?;
            }
            (None, Some(symbol), None) => {
                sqlx::query("DELETE FROM indicator_series_cache WHERE symbol = ?1")
                    .bind(symbol.to_uppercase())
                    .execute(&self.pool)
                    .await?;
            }
            (None, None, Some(interval)) => {
                sqlx::query("DELETE FROM indicator_series_cache WHERE interval = ?1")
                    .bind(interval)
                    .execute(&self.pool)
                    .await?;
            }
            (None, None, None) => {
                sqlx::query("DELETE FROM indicator_series_cache")
                    .execute(&self.pool)
                    .await?;
            }
        }

        Ok(())
    }

    pub async fn cache_summary(&self) -> AppResult<Vec<CacheSummary>> {
        sqlx::query_as::<_, CacheSummaryRow>(
            r#"
            SELECT
                market,
                symbol,
                interval,
                COUNT(*) AS row_count,
                MIN(open_time) AS first_open_time,
                MAX(open_time) AS last_open_time,
                MAX(updated_at) AS updated_at
            FROM klines
            GROUP BY market, symbol, interval
            ORDER BY updated_at DESC, market ASC, symbol ASC, interval ASC
            "#,
        )
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(CacheSummary::try_from)
        .collect()
    }

    pub async fn cached_kline_scopes(&self) -> AppResult<Vec<KlineRequest>> {
        let rows = sqlx::query_as::<_, CachedKlineScopeRow>(
            r#"
            SELECT market, symbol, interval
            FROM klines
            GROUP BY market, symbol, interval
            ORDER BY MAX(updated_at) DESC, market ASC, symbol ASC, interval ASC
            "#,
        )
        .fetch_all(&self.pool)
        .await?;
        let mut scopes = Vec::with_capacity(rows.len());

        for row in rows {
            let Some(market) = Market::from_storage(&row.market) else {
                tracing::warn!(
                    "skipping cached history scope with unknown market: {}",
                    row.market
                );
                continue;
            };

            if interval_ms(&row.interval).is_none() {
                tracing::warn!(
                    "skipping cached history scope with unsupported interval: {} {} {}",
                    row.market,
                    row.symbol,
                    row.interval
                );
                continue;
            }

            scopes.push(KlineRequest {
                market,
                symbol: row.symbol.to_uppercase(),
                interval: row.interval,
                limit: None,
                start_time: None,
                end_time: None,
            });
        }

        Ok(scopes)
    }

    pub async fn kline_bounds(
        &self,
        market: Market,
        symbol: &str,
        interval: &str,
    ) -> AppResult<Option<(i64, i64, i64)>> {
        sqlx::query_as(
            r#"
            SELECT COUNT(*) AS row_count, MIN(open_time) AS first_open_time, MAX(open_time) AS last_open_time
            FROM klines
            WHERE market = ?1 AND symbol = ?2 AND interval = ?3
            "#,
        )
        .bind(market.as_str())
        .bind(symbol.to_uppercase())
        .bind(interval)
        .fetch_one(&self.pool)
        .await
        .map(|(row_count, first_open_time, last_open_time): (i64, Option<i64>, Option<i64>)| {
            match (first_open_time, last_open_time) {
                (Some(first), Some(last)) => Some((row_count, first, last)),
                _ => None,
            }
        })
        .map_err(AppError::from)
    }

    pub async fn kline_gaps(
        &self,
        request: &KlineRequest,
        interval: i64,
        limit: usize,
    ) -> AppResult<Vec<KlineGap>> {
        if interval <= 0 || limit == 0 {
            return Ok(Vec::new());
        }

        sqlx::query_as::<_, KlineGap>(
            r#"
            SELECT
                previous_open_time + ?4 AS start_time,
                open_time - ?4 AS end_time,
                previous_open_time,
                open_time AS next_open_time
            FROM (
                SELECT
                    open_time,
                    LAG(open_time) OVER (ORDER BY open_time ASC) AS previous_open_time
                FROM klines
                WHERE market = ?1 AND symbol = ?2 AND interval = ?3
            )
            WHERE previous_open_time IS NOT NULL
                AND open_time - previous_open_time > ?4
            ORDER BY previous_open_time ASC
            LIMIT ?5
            "#,
        )
        .bind(request.market.as_str())
        .bind(request.symbol.to_uppercase())
        .bind(&request.interval)
        .bind(interval)
        .bind(limit as i64)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::from)
    }

    pub async fn upsert_kline_range(
        &self,
        request: &KlineRequest,
        start_time: i64,
        end_time: i64,
        source: &str,
        status: &str,
    ) -> AppResult<()> {
        sqlx::query(
            r#"
            INSERT INTO kline_ranges (market, symbol, interval, start_time, end_time, source, status, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(market, symbol, interval, start_time, end_time) DO UPDATE SET
                source = excluded.source,
                status = excluded.status,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(request.market.as_str())
        .bind(request.symbol.to_uppercase())
        .bind(&request.interval)
        .bind(start_time)
        .bind(end_time)
        .bind(source)
        .bind(status)
        .bind(now_ms())
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn kline_range_completed(
        &self,
        request: &KlineRequest,
        start_time: i64,
        end_time: i64,
    ) -> AppResult<bool> {
        let row: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*)
            FROM kline_ranges
            WHERE market = ?1
                AND symbol = ?2
                AND interval = ?3
                AND start_time <= ?4
                AND end_time >= ?5
                AND status = 'complete'
            "#,
        )
        .bind(request.market.as_str())
        .bind(request.symbol.to_uppercase())
        .bind(&request.interval)
        .bind(start_time)
        .bind(end_time)
        .fetch_one(&self.pool)
        .await?;

        Ok(row.0 > 0)
    }

    pub async fn enqueue_cache_task(
        &self,
        request: &KlineRequest,
        payload: CacheTaskPayload,
    ) -> AppResult<CacheTask> {
        let id = cache_task_id(request.market, &request.symbol, &request.interval);
        let now = now_ms();

        sqlx::query(
            r#"
            INSERT INTO cache_tasks (id, market, symbol, interval, status, progress, payload_json, updated_at)
            VALUES (?1, ?2, ?3, ?4, 'queued', 0.0, ?5, ?6)
            ON CONFLICT(id) DO UPDATE SET
                market = excluded.market,
                symbol = excluded.symbol,
                interval = excluded.interval,
                status = CASE
                    WHEN cache_tasks.status = 'running' THEN cache_tasks.status
                    ELSE 'queued'
                END,
                progress = CASE
                    WHEN cache_tasks.status = 'running' THEN cache_tasks.progress
                    ELSE 0.0
                END,
                payload_json = CASE
                    WHEN cache_tasks.status = 'running' THEN cache_tasks.payload_json
                    ELSE excluded.payload_json
                END,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(&id)
        .bind(request.market.as_str())
        .bind(request.symbol.to_uppercase())
        .bind(&request.interval)
        .bind(serde_json::to_string(&payload)?)
        .bind(now)
        .execute(&self.pool)
        .await?;

        self.cache_task(&id)
            .await?
            .ok_or_else(|| AppError::Message(format!("cache task was not saved: {id}")))
    }

    pub async fn update_cache_task(
        &self,
        id: &str,
        status: &str,
        progress: f64,
        payload: &CacheTaskPayload,
    ) -> AppResult<()> {
        sqlx::query(
            r#"
            UPDATE cache_tasks
            SET status = ?1, progress = ?2, payload_json = ?3, updated_at = ?4
            WHERE id = ?5
            "#,
        )
        .bind(status)
        .bind(progress.clamp(0.0, 1.0))
        .bind(serde_json::to_string(payload)?)
        .bind(now_ms())
        .bind(id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn cache_task(&self, id: &str) -> AppResult<Option<CacheTask>> {
        sqlx::query_as::<_, CacheTaskRow>(
            r#"
            SELECT id, market, symbol, interval, status, progress, payload_json, updated_at
            FROM cache_tasks
            WHERE id = ?1
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .map(CacheTask::try_from)
        .transpose()
    }

    pub async fn cache_task_for_scope(
        &self,
        market: Market,
        symbol: &str,
        interval: &str,
    ) -> AppResult<Option<CacheTask>> {
        self.cache_task(&cache_task_id(market, symbol, interval))
            .await
    }

    pub async fn cache_tasks(&self) -> AppResult<Vec<CacheTask>> {
        let rows = sqlx::query_as::<_, CacheTaskRow>(
            r#"
            SELECT id, market, symbol, interval, status, progress, payload_json, updated_at
            FROM cache_tasks
            ORDER BY
                CASE status
                    WHEN 'running' THEN 0
                    WHEN 'queued' THEN 1
                    WHEN 'failed' THEN 2
                    WHEN 'cancelled' THEN 3
                    ELSE 4
                END,
                updated_at DESC
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        rows.into_iter().map(CacheTask::try_from).collect()
    }

    pub async fn mark_running_cache_tasks_cancelled(&self) -> AppResult<()> {
        let mut payloads = sqlx::query_as::<_, CacheTaskRow>(
            r#"
            SELECT id, market, symbol, interval, status, progress, payload_json, updated_at
            FROM cache_tasks
            WHERE status = 'running'
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        for row in payloads.drain(..) {
            let mut payload: CacheTaskPayload =
                serde_json::from_str(&row.payload_json).unwrap_or_default();
            payload.phase = "cancelled".to_string();
            payload.message = Some("Task was interrupted before the app restarted".to_string());
            payload.finished_at = Some(now_ms());
            self.update_cache_task(&row.id, "cancelled", row.progress, &payload)
                .await?;
        }

        Ok(())
    }

    pub async fn clear_cache(&self, request: &CacheClearRequest) -> AppResult<CacheClearResult> {
        let result = match (&request.market, &request.symbol, &request.interval) {
            (Some(market), Some(symbol), Some(interval)) => {
                sqlx::query(
                    "DELETE FROM klines WHERE market = ?1 AND symbol = ?2 AND interval = ?3",
                )
                .bind(market.as_str())
                .bind(symbol.to_uppercase())
                .bind(interval)
                .execute(&self.pool)
                .await?
            }
            (Some(market), Some(symbol), None) => {
                sqlx::query("DELETE FROM klines WHERE market = ?1 AND symbol = ?2")
                    .bind(market.as_str())
                    .bind(symbol.to_uppercase())
                    .execute(&self.pool)
                    .await?
            }
            (Some(market), None, Some(interval)) => {
                sqlx::query("DELETE FROM klines WHERE market = ?1 AND interval = ?2")
                    .bind(market.as_str())
                    .bind(interval)
                    .execute(&self.pool)
                    .await?
            }
            (Some(market), None, None) => {
                sqlx::query("DELETE FROM klines WHERE market = ?1")
                    .bind(market.as_str())
                    .execute(&self.pool)
                    .await?
            }
            (None, Some(symbol), Some(interval)) => {
                sqlx::query("DELETE FROM klines WHERE symbol = ?1 AND interval = ?2")
                    .bind(symbol.to_uppercase())
                    .bind(interval)
                    .execute(&self.pool)
                    .await?
            }
            (None, Some(symbol), None) => {
                sqlx::query("DELETE FROM klines WHERE symbol = ?1")
                    .bind(symbol.to_uppercase())
                    .execute(&self.pool)
                    .await?
            }
            (None, None, Some(interval)) => {
                sqlx::query("DELETE FROM klines WHERE interval = ?1")
                    .bind(interval)
                    .execute(&self.pool)
                    .await?
            }
            (None, None, None) => {
                sqlx::query("DELETE FROM klines")
                    .execute(&self.pool)
                    .await?
            }
        };

        self.clear_indicator_series_cache(request).await?;

        Ok(CacheClearResult {
            deleted_rows: result.rows_affected(),
        })
    }

    pub async fn upsert_setting_json(&self, key: &str, value: &serde_json::Value) -> AppResult<()> {
        sqlx::query(
            r#"
            INSERT INTO settings (key, payload_json, updated_at)
            VALUES (?1, ?2, ?3)
            ON CONFLICT(key) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at
            "#,
        )
        .bind(key)
        .bind(value.to_string())
        .bind(now_ms())
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn setting_json(&self, key: &str) -> AppResult<Option<serde_json::Value>> {
        let row: Option<(String,)> =
            sqlx::query_as("SELECT payload_json FROM settings WHERE key = ?1")
                .bind(key)
                .fetch_optional(&self.pool)
                .await?;

        row.map(|(payload,)| serde_json::from_str(&payload))
            .transpose()
            .map_err(AppError::from)
    }

    pub async fn list_indicator_instances(
        &self,
        chart_id: ChartId,
        interval: &str,
    ) -> AppResult<Vec<IndicatorInstance>> {
        let rows = sqlx::query_as::<_, IndicatorInstanceRow>(
            r#"
            SELECT id, chart_id, interval, kind, name, enabled, position, params_json, styles_json, updated_at
            FROM indicator_instances
            WHERE chart_id = ?1 AND interval = ?2
            ORDER BY position ASC, updated_at ASC, id ASC
            "#,
        )
        .bind(chart_id.as_str())
        .bind(interval)
        .fetch_all(&self.pool)
        .await?;

        rows.into_iter().map(IndicatorInstance::try_from).collect()
    }

    pub async fn all_indicator_instances(&self) -> AppResult<Vec<IndicatorInstance>> {
        let rows = sqlx::query_as::<_, IndicatorInstanceRow>(
            r#"
            SELECT id, chart_id, interval, kind, name, enabled, position, params_json, styles_json, updated_at
            FROM indicator_instances
            ORDER BY chart_id ASC, interval ASC, position ASC, updated_at ASC, id ASC
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        rows.into_iter().map(IndicatorInstance::try_from).collect()
    }

    pub async fn upsert_indicator_instance(
        &self,
        instance: IndicatorInstance,
    ) -> AppResult<IndicatorInstance> {
        let mut instance = instance.normalized()?;
        let scope_count: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*)
            FROM indicator_instances
            WHERE chart_id = ?1 AND interval = ?2 AND id <> ?3
            "#,
        )
        .bind(instance.chart_id.as_str())
        .bind(&instance.interval)
        .bind(&instance.id)
        .fetch_one(&self.pool)
        .await?;

        if scope_count.0 as usize >= MAX_INDICATOR_INSTANCES_PER_SCOPE {
            return Err(AppError::Message(format!(
                "at most {MAX_INDICATOR_INSTANCES_PER_SCOPE} indicator instances are allowed per chart and interval"
            )));
        }

        instance.updated_at = now_ms();

        sqlx::query(
            r#"
            INSERT INTO indicator_instances (
                id, chart_id, interval, kind, name, enabled, position, params_json, styles_json, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            ON CONFLICT(id) DO UPDATE SET
                chart_id = excluded.chart_id,
                interval = excluded.interval,
                kind = excluded.kind,
                name = excluded.name,
                enabled = excluded.enabled,
                position = excluded.position,
                params_json = excluded.params_json,
                styles_json = excluded.styles_json,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(&instance.id)
        .bind(instance.chart_id.as_str())
        .bind(&instance.interval)
        .bind(instance.kind.as_str())
        .bind(&instance.name)
        .bind(instance.enabled)
        .bind(instance.position)
        .bind(serde_json::to_string(&instance.params)?)
        .bind(serde_json::to_string(&instance.styles)?)
        .bind(instance.updated_at)
        .execute(&self.pool)
        .await?;

        self.clear_indicator_series_cache_for_indicator_scope(
            instance.chart_id,
            &instance.interval,
        )
        .await?;

        Ok(instance)
    }

    pub async fn save_indicator_instances(
        &self,
        instances: &[IndicatorInstance],
    ) -> AppResult<Vec<IndicatorInstance>> {
        let mut saved = Vec::with_capacity(instances.len());

        for instance in instances {
            saved.push(self.upsert_indicator_instance(instance.clone()).await?);
        }

        Ok(saved)
    }

    pub async fn delete_indicator_instance(&self, id: &str) -> AppResult<bool> {
        let scope: Option<(String, String)> =
            sqlx::query_as("SELECT chart_id, interval FROM indicator_instances WHERE id = ?1")
                .bind(id)
                .fetch_optional(&self.pool)
                .await?;
        let result = sqlx::query("DELETE FROM indicator_instances WHERE id = ?1")
            .bind(id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() > 0
            && let Some((chart_id, interval)) = scope
            && let Some(chart_id) = ChartId::from_storage(&chart_id)
        {
            self.clear_indicator_series_cache_for_indicator_scope(chart_id, &interval)
                .await?;
        }

        Ok(result.rows_affected() > 0)
    }
}

pub fn cache_task_id(market: Market, symbol: &str, interval: &str) -> String {
    format!(
        "full-history:{}:{}:{interval}",
        market.as_str(),
        symbol.to_uppercase()
    )
}

#[derive(Debug, sqlx::FromRow)]
struct IndicatorInstanceRow {
    id: String,
    chart_id: String,
    interval: String,
    kind: String,
    name: String,
    enabled: bool,
    position: i64,
    params_json: String,
    styles_json: String,
    updated_at: i64,
}

impl TryFrom<IndicatorInstanceRow> for IndicatorInstance {
    type Error = AppError;

    fn try_from(row: IndicatorInstanceRow) -> Result<Self, Self::Error> {
        let chart_id = ChartId::from_storage(&row.chart_id).ok_or_else(|| {
            AppError::Message(format!("unknown indicator chart id: {}", row.chart_id))
        })?;
        let kind = IndicatorKind::from_storage(&row.kind)
            .ok_or_else(|| AppError::Message(format!("unknown indicator kind: {}", row.kind)))?;
        let params: IndicatorParams = serde_json::from_str(&row.params_json)?;
        let styles = serde_json::from_str(&row.styles_json)?;

        IndicatorInstance {
            id: row.id,
            chart_id,
            interval: row.interval,
            kind,
            name: row.name,
            enabled: row.enabled,
            position: row.position,
            params,
            styles,
            updated_at: row.updated_at,
        }
        .normalized()
    }
}

#[derive(Debug, sqlx::FromRow)]
struct KlineDataVersionRow {
    row_count: i64,
    first_open_time: Option<i64>,
    last_open_time: Option<i64>,
    updated_at: i64,
}

impl From<KlineDataVersionRow> for KlineDataVersion {
    fn from(row: KlineDataVersionRow) -> Self {
        Self {
            row_count: row.row_count,
            first_open_time: row.first_open_time,
            last_open_time: row.last_open_time,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, sqlx::FromRow)]
struct IndicatorSeriesCacheRow {
    cache_key: String,
    market: String,
    symbol: String,
    interval: String,
    chart_id: String,
    request_start_time: i64,
    request_end_time: i64,
    request_limit: Option<i64>,
    kline_row_count: i64,
    kline_first_open_time: Option<i64>,
    kline_last_open_time: Option<i64>,
    kline_updated_at: i64,
    instances_hash: String,
    series_json: String,
}

impl TryFrom<IndicatorSeriesCacheRow> for IndicatorSeriesCacheEntry {
    type Error = AppError;

    fn try_from(row: IndicatorSeriesCacheRow) -> Result<Self, Self::Error> {
        let market = Market::from_storage(&row.market)
            .ok_or_else(|| AppError::Message(format!("unknown cached market: {}", row.market)))?;
        let chart_id = ChartId::from_storage(&row.chart_id).ok_or_else(|| {
            AppError::Message(format!(
                "unknown cached indicator chart id: {}",
                row.chart_id
            ))
        })?;
        let request_limit = row
            .request_limit
            .map(u32::try_from)
            .transpose()
            .map_err(|error| AppError::Message(format!("invalid cached request limit: {error}")))?;

        Ok(Self {
            cache_key: row.cache_key,
            market,
            symbol: row.symbol,
            interval: row.interval,
            chart_id,
            request_start_time: row.request_start_time,
            request_end_time: row.request_end_time,
            request_limit,
            kline_version: KlineDataVersion {
                row_count: row.kline_row_count,
                first_open_time: row.kline_first_open_time,
                last_open_time: row.kline_last_open_time,
                updated_at: row.kline_updated_at,
            },
            instances_hash: row.instances_hash,
            series: serde_json::from_str(&row.series_json)?,
        })
    }
}

#[derive(Debug, sqlx::FromRow)]
struct CacheSummaryRow {
    market: String,
    symbol: String,
    interval: String,
    row_count: i64,
    first_open_time: Option<i64>,
    last_open_time: Option<i64>,
    updated_at: Option<i64>,
}

#[derive(Debug, sqlx::FromRow)]
struct CachedKlineScopeRow {
    market: String,
    symbol: String,
    interval: String,
}

#[derive(Debug, sqlx::FromRow)]
struct CacheTaskRow {
    id: String,
    market: String,
    symbol: String,
    interval: String,
    status: String,
    progress: f64,
    payload_json: String,
    updated_at: i64,
}

impl TryFrom<CacheTaskRow> for CacheTask {
    type Error = AppError;

    fn try_from(row: CacheTaskRow) -> Result<Self, Self::Error> {
        let market = Market::from_storage(&row.market).ok_or_else(|| {
            AppError::Message(format!("unknown market in cache task: {}", row.market))
        })?;
        let payload: CacheTaskPayload = serde_json::from_str(&row.payload_json)?;

        Ok(Self {
            id: row.id,
            market,
            symbol: row.symbol,
            interval: row.interval,
            status: row.status,
            progress: row.progress,
            phase: payload.phase,
            message: payload.message,
            rows_written: payload.rows_written,
            source: payload.source,
            first_open_time: payload.first_open_time,
            last_open_time: payload.last_open_time,
            archive_months: payload.archive_months,
            rest_pages: payload.rest_pages,
            updated_at: row.updated_at,
        })
    }
}

impl TryFrom<CacheSummaryRow> for CacheSummary {
    type Error = AppError;

    fn try_from(row: CacheSummaryRow) -> Result<Self, Self::Error> {
        let market = Market::from_storage(&row.market).ok_or_else(|| {
            AppError::Message(format!("unknown market in cache summary: {}", row.market))
        })?;

        Ok(Self {
            market,
            symbol: row.symbol,
            interval: row.interval,
            row_count: row.row_count,
            first_open_time: row.first_open_time,
            last_open_time: row.last_open_time,
            updated_at: row.updated_at,
        })
    }
}

pub fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

pub fn default_database_path(app_handle: &tauri::AppHandle) -> AppResult<PathBuf> {
    use tauri::Manager;

    let dir = app_handle.path().app_data_dir().map_err(|error| {
        AppError::Message(format!("failed to resolve app data directory: {error}"))
    })?;

    Ok(dir.join("klineforge.sqlite3"))
}

pub fn normalize_market(market: Market) -> &'static str {
    market.as_str()
}

fn touched_kline_scopes(rows: &[Kline]) -> Vec<(Market, String, String)> {
    let mut scopes = Vec::new();

    for row in rows {
        let Some(market) = Market::from_storage(&row.market) else {
            continue;
        };
        let scope = (market, row.symbol.to_uppercase(), row.interval.clone());

        if !scopes.contains(&scope) {
            scopes.push(scope);
        }
    }

    scopes
}

fn base_kline_select_query(with_limit: bool) -> &'static str {
    if with_limit {
        r#"
        SELECT
            market,
            symbol,
            interval,
            open_time,
            close_time,
            open,
            high,
            low,
            close,
            volume,
            quote_volume,
            trade_count,
            taker_buy_base_volume,
            taker_buy_quote_volume,
            is_closed,
            source,
            updated_at
        FROM klines
        WHERE market = ?1 AND symbol = ?2 AND interval = ?3 AND open_time BETWEEN ?4 AND ?5
        ORDER BY open_time DESC
        LIMIT ?6
        "#
    } else {
        r#"
        SELECT
            market,
            symbol,
            interval,
            open_time,
            close_time,
            open,
            high,
            low,
            close,
            volume,
            quote_volume,
            trade_count,
            taker_buy_base_volume,
            taker_buy_quote_volume,
            is_closed,
            source,
            updated_at
        FROM klines
        WHERE market = ?1 AND symbol = ?2 AND interval = ?3 AND open_time BETWEEN ?4 AND ?5
        ORDER BY open_time DESC
        "#
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{
        ChartId, IndicatorLineStyle, IndicatorParams, IndicatorSeries, IndicatorSeriesPoint,
        IndicatorSeriesType, IndicatorStyle, MAX_INDICATOR_INSTANCES_PER_SCOPE, Market,
        default_styles_for_params,
    };

    #[tokio::test]
    async fn writes_and_reads_klines() {
        let db = Database::memory().await.expect("memory db");
        let row = Kline {
            market: "usdM".to_string(),
            symbol: "BTCUSDT".to_string(),
            interval: "1m".to_string(),
            open_time: 1,
            close_time: 60_000,
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
            updated_at: 2,
        };

        db.write_klines(std::slice::from_ref(&row))
            .await
            .expect("write");
        let rows = db
            .read_klines(&KlineRequest {
                market: Market::UsdM,
                symbol: "btcusdt".to_string(),
                interval: "1m".to_string(),
                limit: Some(10),
                start_time: None,
                end_time: None,
            })
            .await
            .expect("read");

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].symbol, "BTCUSDT");
    }

    #[tokio::test]
    async fn read_klines_reports_partial_cache_by_requested_limit() {
        let db = Database::memory().await.expect("memory db");
        let rows: Vec<Kline> = (0..2)
            .map(|index| Kline {
                market: "usdM".to_string(),
                symbol: "BTCUSDT".to_string(),
                interval: "1m".to_string(),
                open_time: index * 60_000,
                close_time: index * 60_000 + 59_999,
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
                updated_at: 2,
            })
            .collect();

        db.write_klines(&rows).await.expect("write");
        let cached = db
            .read_klines(&KlineRequest {
                market: Market::UsdM,
                symbol: "BTCUSDT".to_string(),
                interval: "1m".to_string(),
                limit: Some(100_000),
                start_time: None,
                end_time: None,
            })
            .await
            .expect("read");

        assert_eq!(cached.len(), 2);
        assert!(cached.len() < 100_000);
    }

    #[tokio::test]
    async fn read_klines_without_limit_returns_all_cached_rows() {
        let db = Database::memory().await.expect("memory db");
        let rows: Vec<Kline> = (0..2_000)
            .map(|index| Kline {
                market: "usdM".to_string(),
                symbol: "BTCUSDT".to_string(),
                interval: "1h".to_string(),
                open_time: index * 3_600_000,
                close_time: index * 3_600_000 + 3_599_999,
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
                updated_at: 2,
            })
            .collect();

        db.write_klines(&rows).await.expect("write");
        let cached = db
            .read_klines(&KlineRequest {
                market: Market::UsdM,
                symbol: "BTCUSDT".to_string(),
                interval: "1h".to_string(),
                limit: None,
                start_time: None,
                end_time: None,
            })
            .await
            .expect("read all");

        assert_eq!(cached.len(), rows.len());
        assert_eq!(cached.first().map(|row| row.open_time), Some(0));
        assert_eq!(
            cached.last().map(|row| row.open_time),
            Some(1_999 * 3_600_000)
        );
    }

    #[tokio::test]
    async fn finds_missing_kline_intervals() {
        let db = Database::memory().await.expect("memory db");
        let request = KlineRequest {
            market: Market::UsdM,
            symbol: "BTCUSDT".to_string(),
            interval: "1h".to_string(),
            limit: None,
            start_time: None,
            end_time: None,
        };
        let rows = vec![
            test_kline("1h", 0),
            test_kline("1h", 3_600_000),
            test_kline("1h", 10_800_000),
            test_kline("1h", 14_400_000),
        ];

        db.write_klines(&rows).await.expect("write");
        let gaps = db.kline_gaps(&request, 3_600_000, 10).await.expect("gaps");

        assert_eq!(gaps.len(), 1);
        assert_eq!(gaps[0].start_time, 7_200_000);
        assert_eq!(gaps[0].end_time, 7_200_000);
        assert_eq!(gaps[0].previous_open_time, 3_600_000);
        assert_eq!(gaps[0].next_open_time, 10_800_000);
    }

    #[tokio::test]
    async fn lists_cached_kline_scopes() {
        let db = Database::memory().await.expect("memory db");
        db.write_klines(&[
            test_kline("1h", 0),
            Kline {
                symbol: "ETHUSDT".to_string(),
                interval: "5m".to_string(),
                close_time: 299_999,
                ..test_kline("5m", 0)
            },
        ])
        .await
        .expect("write");

        let scopes = db.cached_kline_scopes().await.expect("scopes");
        let scope_keys: Vec<_> = scopes
            .iter()
            .map(|scope| {
                format!(
                    "{}:{}:{}",
                    scope.market.as_str(),
                    scope.symbol,
                    scope.interval
                )
            })
            .collect();

        assert!(scope_keys.contains(&"usdM:BTCUSDT:1h".to_string()));
        assert!(scope_keys.contains(&"usdM:ETHUSDT:5m".to_string()));
    }

    #[tokio::test]
    async fn saves_and_reads_indicator_instances_by_chart_interval() {
        let db = Database::memory().await.expect("memory db");
        let mut instances = vec![indicator_instance(
            "ma",
            0,
            IndicatorParams::Ma {
                periods: vec![5, 10, 30],
            },
        )];
        instances[0].name = "ignored".to_string();

        let saved = db
            .save_indicator_instances(&instances)
            .await
            .expect("save indicators");
        let read = db
            .list_indicator_instances(ChartId::Left, "1h")
            .await
            .expect("read indicators");
        let other_scope = db
            .list_indicator_instances(ChartId::Right, "1h")
            .await
            .expect("read other scope");

        assert_eq!(saved[0].name, "MA(5,10,30)");
        assert_eq!(read.len(), 1);
        assert_eq!(read[0].name, "MA(5,10,30)");
        assert!(other_scope.is_empty());
    }

    #[tokio::test]
    async fn rejects_more_than_twenty_indicator_instances_per_scope() {
        let db = Database::memory().await.expect("memory db");

        for index in 0..MAX_INDICATOR_INSTANCES_PER_SCOPE {
            let mut instance = indicator_instance(
                &format!("ma-{index}"),
                index as i64,
                IndicatorParams::Ma {
                    periods: vec![(index + 1) as u16],
                },
            );
            instance.id = format!("ma-{index}");
            instance.position = index as i64;

            db.upsert_indicator_instance(instance)
                .await
                .expect("save within limit");
        }

        let overflow = indicator_instance(
            "overflow",
            MAX_INDICATOR_INSTANCES_PER_SCOPE as i64,
            IndicatorParams::Ma { periods: vec![99] },
        );

        assert!(db.upsert_indicator_instance(overflow).await.is_err());
    }

    #[tokio::test]
    async fn indicator_series_cache_is_reused_and_invalidated_by_kline_writes() {
        let db = Database::memory().await.expect("memory db");
        let request = KlineRequest {
            market: Market::UsdM,
            symbol: "BTCUSDT".to_string(),
            interval: "1h".to_string(),
            limit: Some(1000),
            start_time: None,
            end_time: None,
        };
        let row = Kline {
            market: "usdM".to_string(),
            symbol: "BTCUSDT".to_string(),
            interval: "1h".to_string(),
            open_time: 1,
            close_time: 3_600_000,
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
            updated_at: 2,
        };

        db.write_klines(std::slice::from_ref(&row))
            .await
            .expect("write");
        let entry = IndicatorSeriesCacheEntry {
            cache_key: "cache-key".to_string(),
            market: Market::UsdM,
            symbol: "BTCUSDT".to_string(),
            interval: "1h".to_string(),
            chart_id: ChartId::Left,
            request_start_time: 0,
            request_end_time: i64::MAX,
            request_limit: request.limit,
            kline_version: db.kline_data_version(&request).await.expect("version"),
            instances_hash: "instances".to_string(),
            series: vec![IndicatorSeries {
                id: "ma:5".to_string(),
                instance_id: "ma".to_string(),
                key: "5".to_string(),
                label: "MA5".to_string(),
                series_type: IndicatorSeriesType::Line,
                pane: 0,
                price_scale_id: None,
                style: IndicatorStyle {
                    color: "#ffffff".to_string(),
                    line_width: 1,
                    line_style: IndicatorLineStyle::Solid,
                },
                data: vec![IndicatorSeriesPoint {
                    time: 1,
                    value: 1.5,
                    color: None,
                }],
            }],
        };

        db.upsert_indicator_series_cache(&entry)
            .await
            .expect("cache write");
        let cached = db
            .indicator_series_cache("cache-key")
            .await
            .expect("cache read")
            .expect("cache hit");
        assert_eq!(cached.series.len(), 1);
        assert_eq!(cached.kline_version, entry.kline_version);

        let mut updated = row.clone();
        updated.updated_at = 3;
        db.write_klines(&[updated]).await.expect("rewrite kline");

        assert!(
            db.indicator_series_cache("cache-key")
                .await
                .expect("cache read")
                .is_none()
        );
    }

    #[tokio::test]
    async fn persists_full_history_cache_tasks() {
        let db = Database::memory().await.expect("memory db");
        let request = KlineRequest {
            market: Market::UsdM,
            symbol: "btcusdt".to_string(),
            interval: "1h".to_string(),
            limit: None,
            start_time: None,
            end_time: None,
        };
        let task = db
            .enqueue_cache_task(
                &request,
                CacheTaskPayload {
                    phase: "queued".to_string(),
                    message: Some("queued".to_string()),
                    ..CacheTaskPayload::default()
                },
            )
            .await
            .expect("enqueue");

        assert_eq!(task.id, "full-history:usdM:BTCUSDT:1h");
        assert_eq!(task.symbol, "BTCUSDT");
        assert_eq!(task.status, "queued");

        db.update_cache_task(
            &task.id,
            "running",
            0.5,
            &CacheTaskPayload {
                phase: "rest".to_string(),
                rows_written: 42,
                rest_pages: 2,
                ..CacheTaskPayload::default()
            },
        )
        .await
        .expect("update");

        let updated = db.cache_task(&task.id).await.expect("read").expect("task");
        assert_eq!(updated.progress, 0.5);
        assert_eq!(updated.phase, "rest");
        assert_eq!(updated.rows_written, 42);
        assert_eq!(updated.rest_pages, 2);
    }

    fn indicator_instance(id: &str, position: i64, params: IndicatorParams) -> IndicatorInstance {
        IndicatorInstance {
            id: id.to_string(),
            chart_id: ChartId::Left,
            interval: "1h".to_string(),
            kind: params.kind(),
            name: params.generated_name(),
            enabled: true,
            position,
            styles: default_styles_for_params(&params),
            params,
            updated_at: 0,
        }
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
