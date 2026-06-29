use std::path::PathBuf;

use sqlx::{SqlitePool, sqlite::SqliteConnectOptions};

use crate::{
    domain::{
        CacheClearRequest, CacheClearResult, CacheSummary, ChartId, IndicatorInstance,
        IndicatorKind, IndicatorParams, Kline, KlineRequest, MAX_INDICATOR_INSTANCES_PER_SCOPE,
        Market,
    },
    error::{AppError, AppResult},
};

#[derive(Clone)]
pub struct Database {
    pool: SqlitePool,
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
        Ok(())
    }

    pub async fn read_klines(&self, request: &KlineRequest) -> AppResult<Vec<Kline>> {
        let limit = i64::from(request.limit.unwrap_or(1_500));
        let start_time = request.start_time.unwrap_or(0);
        let end_time = request.end_time.unwrap_or(i64::MAX);

        sqlx::query_as::<_, Kline>(
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
            "#,
        )
        .bind(request.market.as_str())
        .bind(request.symbol.to_uppercase())
        .bind(&request.interval)
        .bind(start_time)
        .bind(end_time)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map(|mut rows| {
            rows.reverse();
            rows
        })
        .map_err(AppError::from)
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
        let result = sqlx::query("DELETE FROM indicator_instances WHERE id = ?1")
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }
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
struct CacheSummaryRow {
    market: String,
    symbol: String,
    interval: String,
    row_count: i64,
    first_open_time: Option<i64>,
    last_open_time: Option<i64>,
    updated_at: Option<i64>,
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{
        ChartId, IndicatorParams, IndicatorSettings, MAX_INDICATOR_INSTANCES_PER_SCOPE, Market,
        default_indicator_instances,
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
    async fn saves_and_reads_indicator_instances_by_chart_interval() {
        let db = Database::memory().await.expect("memory db");
        let mut instances = default_indicator_instances(
            ChartId::Left,
            "1h",
            &IndicatorSettings {
                volume: false,
                ma: true,
                ema: false,
                boll: false,
                macd: false,
                rsi: false,
                atr: false,
                kdj: false,
                supertrend: false,
            },
        );
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
            let mut instance = default_indicator_instances(
                ChartId::Left,
                "1h",
                &IndicatorSettings {
                    volume: false,
                    ma: true,
                    ema: false,
                    boll: false,
                    macd: false,
                    rsi: false,
                    atr: false,
                    kdj: false,
                    supertrend: false,
                },
            )
            .remove(0);
            instance.id = format!("ma-{index}");
            instance.position = index as i64;
            instance.params = IndicatorParams::Ma {
                periods: vec![(index + 1) as u16],
            };

            db.upsert_indicator_instance(instance)
                .await
                .expect("save within limit");
        }

        let mut overflow = default_indicator_instances(
            ChartId::Left,
            "1h",
            &IndicatorSettings {
                volume: false,
                ma: true,
                ema: false,
                boll: false,
                macd: false,
                rsi: false,
                atr: false,
                kdj: false,
                supertrend: false,
            },
        )
        .remove(0);
        overflow.id = "overflow".to_string();

        assert!(db.upsert_indicator_instance(overflow).await.is_err());
    }
}
