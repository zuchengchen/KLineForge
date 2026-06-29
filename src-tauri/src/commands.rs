use tauri::{Emitter, State};

use futures_util::StreamExt;

use crate::{
    benchmark::run_benchmark,
    binance::parse_ws_kline,
    db::now_ms,
    domain::{
        AppConfigExport, AppSettings, BenchmarkSummary, CacheClearRequest, CacheClearResult,
        CacheSummary, ChartDataResponse, ChartId, ChartPoint, ConfigImportResult, CsvExport,
        DrawingObject, DrawingQuery, HealthStatus, IndicatorCalculationRequest, IndicatorInstance,
        IndicatorResponse, IndicatorScope, KlineRequest, Leaderboards, LiveKlineEvent,
        LiveStreamRequest, MAX_INDICATOR_CALCULATION_ROWS, Market, MarketInfoSnapshot,
        SymbolSummary, WatchlistMutation, WatchlistReorderRequest, default_indicator_instances,
        interval_ms,
    },
    error::{AppError, AppResult},
    indicators::calculate_indicator_series,
    state::AppState,
};

const BINANCE_KLINE_PAGE_LIMIT: u32 = 1_500;
const MAX_INTERACTIVE_REST_BACKFILL_ROWS: u32 = 100_000;

#[tauri::command]
pub async fn health(state: State<'_, AppState>) -> AppResult<HealthStatus> {
    let database_ready = sqlx::query("SELECT 1")
        .execute(state.db.pool())
        .await
        .is_ok();

    Ok(HealthStatus {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        database_ready,
        backend: "tauri-rust-sqlite".to_string(),
    })
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> AppResult<AppSettings> {
    let settings = state
        .db
        .setting_json("app-settings")
        .await?
        .and_then(|value| serde_json::from_value(value).ok())
        .unwrap_or_default();

    Ok(settings)
}

#[tauri::command]
pub async fn save_settings(
    state: State<'_, AppState>,
    settings: AppSettings,
) -> AppResult<AppSettings> {
    state
        .db
        .upsert_setting_json("app-settings", &serde_json::to_value(&settings)?)
        .await?;

    Ok(settings)
}

#[tauri::command]
pub async fn get_symbols(
    state: State<'_, AppState>,
    market: Market,
) -> AppResult<Vec<SymbolSummary>> {
    state.binance.get_symbols(market).await
}

#[tauri::command]
pub async fn get_market_info(
    state: State<'_, AppState>,
    market: Market,
    symbol: String,
) -> AppResult<MarketInfoSnapshot> {
    state.binance.get_market_info(market, &symbol).await
}

#[tauri::command]
pub async fn get_leaderboards(
    state: State<'_, AppState>,
    market: Market,
) -> AppResult<Leaderboards> {
    state.binance.get_leaderboards(market).await
}

#[tauri::command]
pub async fn get_chart_data(
    state: State<'_, AppState>,
    request: KlineRequest,
) -> AppResult<ChartDataResponse> {
    let read_request = chart_cache_read_request(&request);
    let cached = state.db.read_klines(&read_request).await?;

    if cache_satisfies_request(&cached, &read_request) {
        return Ok(ChartDataResponse {
            points: cached.iter().map(ChartPoint::from).collect(),
            source: "sqlite-cache".to_string(),
            cached: true,
        });
    }

    backfill_chart_klines(state.inner(), &request).await?;
    let rows = state.db.read_klines(&read_request).await?;

    Ok(ChartDataResponse {
        points: rows.iter().map(ChartPoint::from).collect(),
        source: "sqlite-cache+binance-rest".to_string(),
        cached: false,
    })
}

#[tauri::command]
pub async fn get_indicators(
    state: State<'_, AppState>,
    calculation: IndicatorCalculationRequest,
) -> AppResult<IndicatorResponse> {
    let request = calculation.request;
    let instances =
        ensure_indicator_scope_initialized(state.inner(), calculation.chart_id, &request.interval)
            .await?;
    let max_rows = calculation
        .max_rows
        .unwrap_or(MAX_INDICATOR_CALCULATION_ROWS);

    if request.limit == Some(0) || request.limit.is_some_and(|limit| limit > max_rows) {
        return Ok(IndicatorResponse {
            instances,
            series: Vec::new(),
            skipped_reason: Some(format!(
                "Indicator calculation skipped above {} rows",
                max_rows
            )),
        });
    }

    let rows = state.db.read_klines(&request).await?;
    let points: Vec<ChartPoint> = rows.iter().map(ChartPoint::from).collect();

    Ok(IndicatorResponse {
        series: calculate_indicator_series(&points, &instances),
        instances,
        skipped_reason: None,
    })
}

#[tauri::command]
pub async fn list_indicator_instances(
    state: State<'_, AppState>,
    scope: IndicatorScope,
) -> AppResult<Vec<IndicatorInstance>> {
    ensure_indicator_scope_initialized(state.inner(), scope.chart_id, &scope.interval).await
}

#[tauri::command]
pub async fn save_indicator_instance(
    state: State<'_, AppState>,
    instance: IndicatorInstance,
) -> AppResult<IndicatorInstance> {
    state.db.upsert_indicator_instance(instance).await
}

#[tauri::command]
pub async fn delete_indicator_instance(state: State<'_, AppState>, id: String) -> AppResult<bool> {
    state.db.delete_indicator_instance(&id).await
}

#[tauri::command]
pub async fn run_performance_benchmark(
    state: State<'_, AppState>,
    mut request: KlineRequest,
) -> AppResult<BenchmarkSummary> {
    let _guard = state.benchmark_lock.lock().await;

    request.limit = Some(request.limit.unwrap_or(1_500).min(1_500));
    run_benchmark(&state.db, &state.binance, request).await
}

#[tauri::command]
pub async fn seed_default_watchlist(
    state: State<'_, AppState>,
    market: Market,
) -> AppResult<Vec<String>> {
    let symbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"];

    for (position, symbol) in symbols.iter().enumerate() {
        sqlx::query(
            r#"
            INSERT INTO watchlists (market, symbol, position, updated_at)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(market, symbol) DO UPDATE SET position = excluded.position, updated_at = excluded.updated_at
            "#,
        )
        .bind(market.as_str())
        .bind(symbol)
        .bind(position as i64)
        .bind(now_ms())
        .execute(state.db.pool())
        .await?;
    }

    Ok(symbols.iter().map(|symbol| symbol.to_string()).collect())
}

#[tauri::command]
pub async fn get_watchlist(state: State<'_, AppState>, market: Market) -> AppResult<Vec<String>> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT symbol FROM watchlists WHERE market = ?1 ORDER BY position ASC, symbol ASC",
    )
    .bind(market.as_str())
    .fetch_all(state.db.pool())
    .await?;

    if rows.is_empty() {
        seed_default_watchlist(state, market).await
    } else {
        Ok(rows.into_iter().map(|(symbol,)| symbol).collect())
    }
}

#[tauri::command]
pub async fn add_watchlist_symbol(
    state: State<'_, AppState>,
    request: WatchlistMutation,
) -> AppResult<Vec<String>> {
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM watchlists WHERE market = ?1")
        .bind(request.market.as_str())
        .fetch_one(state.db.pool())
        .await?;

    sqlx::query(
        r#"
        INSERT INTO watchlists (market, symbol, position, updated_at)
        VALUES (?1, ?2, ?3, ?4)
        ON CONFLICT(market, symbol) DO UPDATE SET updated_at = excluded.updated_at
        "#,
    )
    .bind(request.market.as_str())
    .bind(request.symbol.to_uppercase())
    .bind(count.0)
    .bind(now_ms())
    .execute(state.db.pool())
    .await?;

    get_watchlist(state, request.market).await
}

#[tauri::command]
pub async fn remove_watchlist_symbol(
    state: State<'_, AppState>,
    request: WatchlistMutation,
) -> AppResult<Vec<String>> {
    sqlx::query("DELETE FROM watchlists WHERE market = ?1 AND symbol = ?2")
        .bind(request.market.as_str())
        .bind(request.symbol.to_uppercase())
        .execute(state.db.pool())
        .await?;

    let remaining = get_watchlist(state.clone(), request.market).await?;
    reorder_watchlist(
        state,
        WatchlistReorderRequest {
            market: request.market,
            symbols: remaining,
        },
    )
    .await
}

#[tauri::command]
pub async fn reorder_watchlist(
    state: State<'_, AppState>,
    request: WatchlistReorderRequest,
) -> AppResult<Vec<String>> {
    let mut tx = state.db.pool().begin().await?;

    for (position, symbol) in request.symbols.iter().enumerate() {
        sqlx::query(
            r#"
            UPDATE watchlists
            SET position = ?1, updated_at = ?2
            WHERE market = ?3 AND symbol = ?4
            "#,
        )
        .bind(position as i64)
        .bind(now_ms())
        .bind(request.market.as_str())
        .bind(symbol.to_uppercase())
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    get_watchlist(state, request.market).await
}

#[tauri::command]
pub async fn get_cache_summary(state: State<'_, AppState>) -> AppResult<Vec<CacheSummary>> {
    state.db.cache_summary().await
}

#[tauri::command]
pub async fn clear_cache(
    state: State<'_, AppState>,
    request: CacheClearRequest,
) -> AppResult<CacheClearResult> {
    state.db.clear_cache(&request).await
}

#[tauri::command]
pub async fn export_klines_csv(
    state: State<'_, AppState>,
    mut request: KlineRequest,
) -> AppResult<CsvExport> {
    request.limit = Some(request.limit.unwrap_or(10_000));
    let mut rows = state.db.read_klines(&request).await?;

    if rows.is_empty() {
        let fetch_request = KlineRequest {
            limit: Some(request.limit.unwrap_or(1_500).min(1_500)),
            ..request.clone()
        };
        rows = state.binance.get_klines(&fetch_request).await?;
        state.db.write_klines(&rows).await?;
    }

    let mut content = String::from(
        "market,symbol,interval,open_time,close_time,open,high,low,close,volume,quote_volume,trade_count,taker_buy_base_volume,taker_buy_quote_volume,is_closed,source,updated_at\n",
    );

    for row in &rows {
        push_csv_row(
            &mut content,
            &[
                &row.market,
                &row.symbol,
                &row.interval,
                &row.open_time.to_string(),
                &row.close_time.to_string(),
                &row.open,
                &row.high,
                &row.low,
                &row.close,
                &row.volume,
                &row.quote_volume,
                &row.trade_count.to_string(),
                &row.taker_buy_base_volume,
                &row.taker_buy_quote_volume,
                &(row.is_closed as i32).to_string(),
                &row.source,
                &row.updated_at.to_string(),
            ],
        );
    }

    Ok(CsvExport {
        file_name: format!(
            "{}-{}-{}-klines.csv",
            request.market.as_str(),
            request.symbol.to_uppercase(),
            request.interval
        ),
        row_count: rows.len(),
        content,
    })
}

#[tauri::command]
pub async fn export_config(state: State<'_, AppState>) -> AppResult<String> {
    let settings = get_settings(state.clone()).await?;
    let watchlist = get_watchlist(state.clone(), settings.market).await?;
    let drawings = read_drawings_for_symbol(
        state.db.pool(),
        settings.market,
        &settings.symbol,
        &settings.left_interval,
    )
    .await?;

    serde_json::to_string_pretty(&AppConfigExport {
        schema_version: 2,
        exported_at: now_ms(),
        settings,
        watchlist,
        drawings,
        indicators: state.db.all_indicator_instances().await?,
    })
    .map_err(AppError::from)
}

#[tauri::command]
pub async fn import_config(
    state: State<'_, AppState>,
    content: String,
) -> AppResult<ConfigImportResult> {
    let config: AppConfigExport = serde_json::from_str(&content)?;
    let settings_value = serde_json::to_value(&config.settings)?;

    state
        .db
        .upsert_setting_json("app-settings", &settings_value)
        .await?;

    for (position, symbol) in config.watchlist.iter().enumerate() {
        sqlx::query(
            r#"
            INSERT INTO watchlists (market, symbol, position, updated_at)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(market, symbol) DO UPDATE SET position = excluded.position, updated_at = excluded.updated_at
            "#,
        )
        .bind(config.settings.market.as_str())
        .bind(symbol.to_uppercase())
        .bind(position as i64)
        .bind(now_ms())
        .execute(state.db.pool())
        .await?;
    }

    for drawing in &config.drawings {
        write_drawing(state.db.pool(), drawing).await?;
    }

    let saved_indicators = state
        .db
        .save_indicator_instances(&config.indicators)
        .await?
        .len();

    Ok(ConfigImportResult {
        settings_imported: true,
        watchlist_count: config.watchlist.len(),
        drawing_count: config.drawings.len(),
        indicator_count: saved_indicators,
    })
}

#[tauri::command]
pub async fn get_drawings(
    state: State<'_, AppState>,
    query: DrawingQuery,
) -> AppResult<Vec<DrawingObject>> {
    read_drawings_for_chart(state.db.pool(), &query).await
}

#[tauri::command]
pub async fn save_drawing(
    state: State<'_, AppState>,
    mut drawing: DrawingObject,
) -> AppResult<DrawingObject> {
    drawing.symbol = drawing.symbol.to_uppercase();
    drawing.updated_at = now_ms();
    write_drawing(state.db.pool(), &drawing).await?;

    Ok(drawing)
}

#[tauri::command]
pub async fn delete_drawing(state: State<'_, AppState>, id: String) -> AppResult<bool> {
    let result = sqlx::query("DELETE FROM drawings WHERE id = ?1")
        .bind(id)
        .execute(state.db.pool())
        .await?;

    Ok(result.rows_affected() > 0)
}

#[tauri::command]
pub async fn start_live_stream(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    request: LiveStreamRequest,
) -> AppResult<()> {
    if let Some(handle) = state
        .live_streams
        .lock()
        .await
        .remove(request.chart_id.as_str())
    {
        handle.abort();
    }

    let chart_key = request.chart_id.as_str().to_string();
    let db = state.db.clone();
    let binance = state.binance.clone();
    let event_request = request.clone();
    let handle = tauri::async_runtime::spawn(async move {
        match binance.connect_kline_stream(&request).await {
            Ok(mut stream) => {
                while let Some(message) = stream.next().await {
                    match message {
                        Ok(message) => match parse_ws_kline(
                            request.market,
                            &request.symbol,
                            &request.interval,
                            message,
                        ) {
                            Ok(Some(kline)) => {
                                let point = ChartPoint::from(&kline);
                                let event = LiveKlineEvent {
                                    chart_id: request.chart_id,
                                    point,
                                    source: kline.source.clone(),
                                    is_closed: kline.is_closed,
                                };

                                if let Err(error) =
                                    db.write_klines(std::slice::from_ref(&kline)).await
                                {
                                    tracing::warn!("live kline cache write failed: {error}");
                                }

                                if let Err(error) = app.emit("kline://update", event) {
                                    tracing::warn!("live kline event emit failed: {error}");
                                }
                            }
                            Ok(None) => {}
                            Err(error) => {
                                tracing::warn!("live kline parse failed: {error}");
                            }
                        },
                        Err(error) => {
                            tracing::warn!("live stream read failed: {error}");
                            break;
                        }
                    }
                }
            }
            Err(error) => {
                let _ = app.emit(
                    "kline://error",
                    serde_json::json!({
                        "chartId": event_request.chart_id,
                        "message": error.to_string(),
                    }),
                );
            }
        }
    });

    state.live_streams.lock().await.insert(chart_key, handle);
    Ok(())
}

#[tauri::command]
pub async fn stop_live_stream(state: State<'_, AppState>, chart_id: String) -> AppResult<()> {
    if let Some(handle) = state.live_streams.lock().await.remove(&chart_id) {
        handle.abort();
    }

    Ok(())
}

async fn read_drawings_for_symbol(
    pool: &sqlx::SqlitePool,
    market: Market,
    symbol: &str,
    interval: &str,
) -> AppResult<Vec<DrawingObject>> {
    let rows = sqlx::query_as::<_, DrawingRow>(
        r#"
        SELECT id, market, symbol, interval, chart_id, drawing_type, payload_json, updated_at
        FROM drawings
        WHERE market = ?1 AND symbol = ?2 AND interval = ?3
        ORDER BY updated_at DESC
        "#,
    )
    .bind(market.as_str())
    .bind(symbol.to_uppercase())
    .bind(interval)
    .fetch_all(pool)
    .await?;

    rows.into_iter().map(DrawingObject::try_from).collect()
}

async fn read_drawings_for_chart(
    pool: &sqlx::SqlitePool,
    query: &DrawingQuery,
) -> AppResult<Vec<DrawingObject>> {
    let rows = sqlx::query_as::<_, DrawingRow>(
        r#"
        SELECT id, market, symbol, interval, chart_id, drawing_type, payload_json, updated_at
        FROM drawings
        WHERE market = ?1 AND symbol = ?2 AND interval = ?3 AND chart_id = ?4
        ORDER BY updated_at DESC
        "#,
    )
    .bind(query.market.as_str())
    .bind(query.symbol.to_uppercase())
    .bind(&query.interval)
    .bind(query.chart_id.as_str())
    .fetch_all(pool)
    .await?;

    rows.into_iter().map(DrawingObject::try_from).collect()
}

async fn write_drawing(pool: &sqlx::SqlitePool, drawing: &DrawingObject) -> AppResult<()> {
    sqlx::query(
        r#"
        INSERT INTO drawings (id, market, symbol, interval, chart_id, drawing_type, payload_json, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        ON CONFLICT(id) DO UPDATE SET
            market = excluded.market,
            symbol = excluded.symbol,
            interval = excluded.interval,
            chart_id = excluded.chart_id,
            drawing_type = excluded.drawing_type,
            payload_json = excluded.payload_json,
            updated_at = excluded.updated_at
        "#,
    )
    .bind(&drawing.id)
    .bind(drawing.market.as_str())
    .bind(drawing.symbol.to_uppercase())
    .bind(&drawing.interval)
    .bind(drawing.chart_id.as_str())
    .bind(&drawing.drawing_type)
    .bind(drawing.payload.to_string())
    .bind(drawing.updated_at)
    .execute(pool)
    .await?;

    Ok(())
}

async fn ensure_indicator_scope_initialized(
    state: &AppState,
    chart_id: ChartId,
    interval: &str,
) -> AppResult<Vec<IndicatorInstance>> {
    let marker_key = indicator_scope_marker_key(chart_id, interval);
    let existing = state
        .db
        .list_indicator_instances(chart_id, interval)
        .await?;
    let marker = state.db.setting_json(&marker_key).await?;

    if !existing.is_empty() {
        if marker.is_none() {
            state
                .db
                .upsert_setting_json(&marker_key, &serde_json::json!({ "initialized": true }))
                .await?;
        }
        return Ok(existing);
    }

    if marker.is_some() {
        return Ok(existing);
    }

    let settings = state
        .db
        .setting_json("app-settings")
        .await?
        .and_then(|value| serde_json::from_value::<AppSettings>(value).ok())
        .unwrap_or_default();
    let defaults = default_indicator_instances(chart_id, interval, &settings.indicators);
    let saved = state.db.save_indicator_instances(&defaults).await?;
    state
        .db
        .upsert_setting_json(&marker_key, &serde_json::json!({ "initialized": true }))
        .await?;

    Ok(saved)
}

fn indicator_scope_marker_key(chart_id: ChartId, interval: &str) -> String {
    format!(
        "indicator-scope-initialized:{}:{interval}",
        chart_id.as_str()
    )
}

#[derive(Debug, sqlx::FromRow)]
struct DrawingRow {
    id: String,
    market: String,
    symbol: String,
    interval: String,
    chart_id: String,
    drawing_type: String,
    payload_json: String,
    updated_at: i64,
}

impl TryFrom<DrawingRow> for DrawingObject {
    type Error = AppError;

    fn try_from(row: DrawingRow) -> Result<Self, Self::Error> {
        let market = Market::from_storage(&row.market)
            .ok_or_else(|| AppError::Message(format!("unknown drawing market: {}", row.market)))?;
        let chart_id = ChartId::from_storage(&row.chart_id).ok_or_else(|| {
            AppError::Message(format!("unknown drawing chart id: {}", row.chart_id))
        })?;

        Ok(Self {
            id: row.id,
            market,
            symbol: row.symbol,
            interval: row.interval,
            chart_id,
            drawing_type: row.drawing_type,
            payload: serde_json::from_str(&row.payload_json)?,
            updated_at: row.updated_at,
        })
    }
}

fn push_csv_row(content: &mut String, fields: &[&str]) {
    for (index, field) in fields.iter().enumerate() {
        if index > 0 {
            content.push(',');
        }

        push_csv_field(content, field);
    }

    content.push('\n');
}

fn push_csv_field(content: &mut String, field: &str) {
    if field.contains([',', '"', '\n', '\r']) {
        content.push('"');
        content.push_str(&field.replace('"', "\"\""));
        content.push('"');
    } else {
        content.push_str(field);
    }
}

fn cache_satisfies_request(rows: &[crate::domain::Kline], request: &KlineRequest) -> bool {
    if rows.is_empty() {
        return false;
    }

    let Some(limit) = request.limit else {
        return true;
    };

    rows.len() >= limit as usize
}

fn chart_cache_read_request(request: &KlineRequest) -> KlineRequest {
    KlineRequest {
        limit: request
            .limit
            .map(|limit| limit.min(MAX_INTERACTIVE_REST_BACKFILL_ROWS)),
        ..request.clone()
    }
}

async fn backfill_chart_klines(state: &AppState, request: &KlineRequest) -> AppResult<()> {
    ensure_supported_interval(request)?;

    if request.start_time.is_none() && request.end_time.is_none() {
        return backfill_recent_chart_klines(state, request).await;
    }

    let pages = build_backfill_pages(request)?;
    let mut fetched_rows = 0usize;

    for page in pages {
        let rows = state.binance.get_klines(&page).await?;

        if rows.is_empty() {
            break;
        }

        let row_count = rows.len();
        state.db.write_klines(&rows).await?;
        fetched_rows += row_count;

        if row_count < page.limit.unwrap_or(BINANCE_KLINE_PAGE_LIMIT) as usize {
            break;
        }
    }

    tracing::info!(
        market = request.market.as_str(),
        symbol = request.symbol.to_uppercase(),
        interval = request.interval,
        fetched_rows,
        "chart kline backfill completed"
    );

    Ok(())
}

async fn backfill_recent_chart_klines(state: &AppState, request: &KlineRequest) -> AppResult<()> {
    let mut remaining = requested_backfill_limit(request);
    let mut fetched_rows = 0usize;
    let mut end_time = None;

    while remaining > 0 {
        let page_limit = remaining.min(BINANCE_KLINE_PAGE_LIMIT);
        let page = recent_backfill_page(request, page_limit, end_time);
        let rows = state.binance.get_klines(&page).await?;

        if rows.is_empty() {
            break;
        }

        let row_count = rows.len();
        let first_open_time = rows.first().map(|row| row.open_time).unwrap_or_default();
        state.db.write_klines(&rows).await?;
        fetched_rows += row_count;

        if row_count < page_limit as usize {
            break;
        }

        remaining = remaining.saturating_sub(row_count as u32);

        if remaining == 0 || first_open_time <= 0 {
            break;
        }

        let next_end_time = Some(first_open_time.saturating_sub(1));

        if next_end_time == end_time {
            break;
        }

        end_time = next_end_time;
    }

    tracing::info!(
        market = request.market.as_str(),
        symbol = request.symbol.to_uppercase(),
        interval = request.interval,
        fetched_rows,
        "chart recent kline backfill completed"
    );

    Ok(())
}

fn build_backfill_pages(request: &KlineRequest) -> AppResult<Vec<KlineRequest>> {
    let interval = ensure_supported_interval(request)?;
    let requested_limit = requested_backfill_limit(request);
    let mut remaining = requested_limit;
    let mut end_time = request
        .end_time
        .unwrap_or_else(|| align_to_current_interval_close(interval));
    let mut pages = Vec::new();

    while remaining > 0 {
        let page_limit = remaining.min(BINANCE_KLINE_PAGE_LIMIT);
        let page_span = interval.saturating_mul(i64::from(page_limit));
        let mut start_time = end_time.saturating_sub(page_span).saturating_add(1);

        if let Some(request_start_time) = request.start_time {
            start_time = start_time.max(request_start_time);

            if start_time > end_time {
                break;
            }
        }

        pages.push(KlineRequest {
            limit: Some(page_limit),
            start_time: Some(start_time),
            end_time: Some(end_time),
            ..request.clone()
        });

        if let Some(request_start_time) = request.start_time
            && start_time <= request_start_time
        {
            break;
        }

        remaining -= page_limit;

        if end_time <= interval {
            break;
        }

        end_time = start_time.saturating_sub(1);
    }

    Ok(pages)
}

fn ensure_supported_interval(request: &KlineRequest) -> AppResult<i64> {
    interval_ms(&request.interval).ok_or_else(|| {
        AppError::Message(format!("unsupported K-line interval: {}", request.interval))
    })
}

fn requested_backfill_limit(request: &KlineRequest) -> u32 {
    request
        .limit
        .unwrap_or(BINANCE_KLINE_PAGE_LIMIT)
        .min(MAX_INTERACTIVE_REST_BACKFILL_ROWS)
}

fn recent_backfill_page(
    request: &KlineRequest,
    page_limit: u32,
    end_time: Option<i64>,
) -> KlineRequest {
    KlineRequest {
        limit: Some(page_limit),
        start_time: None,
        end_time,
        ..request.clone()
    }
}

fn align_to_current_interval_close(interval: i64) -> i64 {
    let open_time = now_ms() / interval * interval;

    open_time.saturating_sub(1)
}

#[cfg(test)]
mod chart_backfill_tests {
    use super::*;
    use crate::domain::Kline;

    fn request(interval: &str, limit: u32) -> KlineRequest {
        KlineRequest {
            market: Market::UsdM,
            symbol: "BTCUSDT".to_string(),
            interval: interval.to_string(),
            limit: Some(limit),
            start_time: None,
            end_time: Some(1_700_000_000_000),
        }
    }

    fn recent_request(interval: &str, limit: u32) -> KlineRequest {
        KlineRequest {
            end_time: None,
            ..request(interval, limit)
        }
    }

    #[test]
    fn creates_pages_for_large_interval_requests() {
        let pages = build_backfill_pages(&request("1h", 4_000)).expect("pages");

        assert_eq!(pages.len(), 3);
        assert_eq!(pages[0].limit, Some(1_500));
        assert_eq!(pages[1].limit, Some(1_500));
        assert_eq!(pages[2].limit, Some(1_000));
        assert_eq!(pages[0].interval, "1h");
        assert!(pages[0].start_time.unwrap() < pages[0].end_time.unwrap());
        assert!(pages[1].end_time.unwrap() < pages[0].start_time.unwrap());
    }

    #[test]
    fn recent_backfill_first_page_uses_limit_only() {
        let request = recent_request("1M", 1_000);
        let first_page = recent_backfill_page(&request, 1_000, None);
        let second_page = recent_backfill_page(&request, 500, Some(1_699_999_999_999));

        assert_eq!(first_page.limit, Some(1_000));
        assert_eq!(first_page.start_time, None);
        assert_eq!(first_page.end_time, None);
        assert_eq!(second_page.limit, Some(500));
        assert_eq!(second_page.start_time, None);
        assert_eq!(second_page.end_time, Some(1_699_999_999_999));
    }

    #[test]
    fn caps_interactive_backfill_requests() {
        let pages = build_backfill_pages(&request("4h", 500_000)).expect("pages");
        let total_limit: u32 = pages.iter().map(|page| page.limit.unwrap_or(0)).sum();

        assert_eq!(total_limit, MAX_INTERACTIVE_REST_BACKFILL_ROWS);
    }

    #[test]
    fn rejects_unknown_intervals() {
        let error = build_backfill_pages(&request("bad", 100)).expect_err("unsupported interval");

        assert!(error.to_string().contains("unsupported K-line interval"));
    }

    #[test]
    fn keeps_cache_hit_rules_limit_aware() {
        let rows = vec![Kline {
            market: "usdM".to_string(),
            symbol: "BTCUSDT".to_string(),
            interval: "1h".to_string(),
            open_time: 0,
            close_time: 3_599_999,
            open: "1".to_string(),
            high: "1".to_string(),
            low: "1".to_string(),
            close: "1".to_string(),
            volume: "1".to_string(),
            quote_volume: "1".to_string(),
            trade_count: 1,
            taker_buy_base_volume: "0".to_string(),
            taker_buy_quote_volume: "0".to_string(),
            is_closed: true,
            source: "test".to_string(),
            updated_at: 1,
        }];

        assert!(!cache_satisfies_request(&rows, &request("1h", 2)));
        assert!(cache_satisfies_request(&rows, &request("1h", 1)));
    }
}
