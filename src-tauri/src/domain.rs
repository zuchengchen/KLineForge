use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Deserialize, Serialize, sqlx::Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[sqlx(type_name = "TEXT")]
pub enum Market {
    #[serde(rename = "spot")]
    Spot,
    #[serde(rename = "usdM")]
    UsdM,
}

impl Market {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Spot => "spot",
            Self::UsdM => "usdM",
        }
    }

    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "spot" => Some(Self::Spot),
            "usdM" => Some(Self::UsdM),
            _ => None,
        }
    }

    pub fn rest_base_url(self) -> &'static str {
        match self {
            Self::Spot => "https://api.binance.com",
            Self::UsdM => "https://fapi.binance.com",
        }
    }

    pub fn ws_base_url(self) -> &'static str {
        match self {
            Self::Spot => "wss://stream.binance.com:9443/ws",
            Self::UsdM => "wss://fstream.binance.com/market/ws",
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, sqlx::Type, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
#[sqlx(type_name = "TEXT")]
pub enum ChartId {
    Left,
    Right,
}

impl ChartId {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Left => "left",
            Self::Right => "right",
        }
    }

    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "left" => Some(Self::Left),
            "right" => Some(Self::Right),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Kline {
    pub market: String,
    pub symbol: String,
    pub interval: String,
    pub open_time: i64,
    pub close_time: i64,
    pub open: String,
    pub high: String,
    pub low: String,
    pub close: String,
    pub volume: String,
    pub quote_volume: String,
    pub trade_count: i64,
    pub taker_buy_base_volume: String,
    pub taker_buy_quote_volume: String,
    pub is_closed: bool,
    pub source: String,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChartPoint {
    pub time: i64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

impl From<&Kline> for ChartPoint {
    fn from(kline: &Kline) -> Self {
        Self {
            time: kline.open_time / 1_000,
            open: kline.open.parse().unwrap_or_default(),
            high: kline.high.parse().unwrap_or_default(),
            low: kline.low.parse().unwrap_or_default(),
            close: kline.close.parse().unwrap_or_default(),
            volume: kline.volume.parse().unwrap_or_default(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KlineRequest {
    pub market: Market,
    pub symbol: String,
    pub interval: String,
    pub limit: Option<u32>,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveStreamRequest {
    pub chart_id: ChartId,
    pub market: Market,
    pub symbol: String,
    pub interval: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveKlineEvent {
    pub chart_id: ChartId,
    pub point: ChartPoint,
    pub source: String,
    pub is_closed: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChartDataResponse {
    pub points: Vec<ChartPoint>,
    pub source: String,
    pub cached: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolSummary {
    pub market: Market,
    pub symbol: String,
    pub base_asset: String,
    pub quote_asset: String,
    pub status: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Ticker24h {
    pub market: Market,
    pub symbol: String,
    pub last_price: String,
    pub price_change: String,
    pub price_change_percent: String,
    pub high_price: String,
    pub low_price: String,
    pub volume: String,
    pub quote_volume: String,
    pub trade_count: Option<i64>,
    pub open_time: i64,
    pub close_time: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FuturesMarketInfo {
    pub symbol: String,
    pub mark_price: String,
    pub index_price: String,
    pub funding_rate: String,
    pub next_funding_time: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketInfoSnapshot {
    pub ticker: Ticker24h,
    pub futures: Option<FuturesMarketInfo>,
    pub source: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardEntry {
    pub symbol: String,
    pub last_price: String,
    pub price_change_percent: String,
    pub quote_volume: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Leaderboards {
    pub gainers: Vec<LeaderboardEntry>,
    pub losers: Vec<LeaderboardEntry>,
    pub volume: Vec<LeaderboardEntry>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchlistMutation {
    pub market: Market,
    pub symbol: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchlistReorderRequest {
    pub market: Market,
    pub symbols: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub market: Market,
    pub symbol: String,
    pub left_interval: String,
    pub right_interval: String,
    pub theme: String,
    pub language: String,
    pub indicators: IndicatorSettings,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            market: Market::UsdM,
            symbol: "BTCUSDT".to_string(),
            left_interval: "5m".to_string(),
            right_interval: "1h".to_string(),
            theme: "dark".to_string(),
            language: "zh".to_string(),
            indicators: IndicatorSettings::default(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndicatorSettings {
    #[serde(default = "default_true")]
    pub volume: bool,
    #[serde(default = "default_true")]
    pub ma: bool,
    #[serde(default = "default_true")]
    pub ema: bool,
    #[serde(default = "default_true")]
    pub boll: bool,
    #[serde(default = "default_true")]
    pub macd: bool,
    #[serde(default = "default_true")]
    pub rsi: bool,
    #[serde(default = "default_true")]
    pub atr: bool,
    #[serde(default = "default_true")]
    pub kdj: bool,
    #[serde(default = "default_true")]
    pub supertrend: bool,
}

impl Default for IndicatorSettings {
    fn default() -> Self {
        Self {
            volume: true,
            ma: true,
            ema: true,
            boll: true,
            macd: true,
            rsi: true,
            atr: true,
            kdj: true,
            supertrend: true,
        }
    }
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndicatorValue {
    pub time: i64,
    pub ma5: Option<f64>,
    pub ma10: Option<f64>,
    pub ma30: Option<f64>,
    pub boll_mid: Option<f64>,
    pub boll_up: Option<f64>,
    pub boll_down: Option<f64>,
    pub ema12: Option<f64>,
    pub ema26: Option<f64>,
    pub macd_dif: Option<f64>,
    pub macd_dea: Option<f64>,
    pub macd: Option<f64>,
    pub rsi14: Option<f64>,
    pub atr14: Option<f64>,
    pub supertrend: Option<f64>,
    pub supertrend_direction: Option<i8>,
    pub kdj_k: Option<f64>,
    pub kdj_d: Option<f64>,
    pub kdj_j: Option<f64>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheSummary {
    pub market: Market,
    pub symbol: String,
    pub interval: String,
    pub row_count: i64,
    pub first_open_time: Option<i64>,
    pub last_open_time: Option<i64>,
    pub updated_at: Option<i64>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheClearRequest {
    pub market: Option<Market>,
    pub symbol: Option<String>,
    pub interval: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheClearResult {
    pub deleted_rows: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvExport {
    pub file_name: String,
    pub content: String,
    pub row_count: usize,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DrawingObject {
    pub id: String,
    pub market: Market,
    pub symbol: String,
    pub interval: String,
    pub chart_id: ChartId,
    pub drawing_type: String,
    pub payload: serde_json::Value,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DrawingQuery {
    pub market: Market,
    pub symbol: String,
    pub interval: String,
    pub chart_id: ChartId,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfigExport {
    pub schema_version: u16,
    pub exported_at: i64,
    pub settings: AppSettings,
    pub watchlist: Vec<String>,
    pub drawings: Vec<DrawingObject>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigImportResult {
    pub settings_imported: bool,
    pub watchlist_count: usize,
    pub drawing_count: usize,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthStatus {
    pub app_version: String,
    pub database_ready: bool,
    pub backend: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BenchmarkSummary {
    pub market: Market,
    pub symbol: String,
    pub interval: String,
    pub requested_rows: usize,
    pub fetched_rows: usize,
    pub fetch_ms: u128,
    pub sqlite_write_ms: u128,
    pub sqlite_read_ms: u128,
    pub indicator_ms: u128,
    pub source: String,
}

pub fn interval_ms(interval: &str) -> Option<i64> {
    let unit = interval.chars().last()?;
    let value = interval[..interval.len().saturating_sub(1)]
        .parse::<i64>()
        .ok()?;

    match unit {
        'm' => Some(value * 60_000),
        'h' => Some(value * 60 * 60_000),
        'd' => Some(value * 24 * 60 * 60_000),
        'w' | 'W' => Some(value * 7 * 24 * 60 * 60_000),
        'M' => Some(value * 30 * 24 * 60 * 60_000),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{Market, interval_ms};

    #[test]
    fn uses_current_binance_websocket_routes() {
        assert_eq!(
            Market::Spot.ws_base_url(),
            "wss://stream.binance.com:9443/ws"
        );
        assert_eq!(
            Market::UsdM.ws_base_url(),
            "wss://fstream.binance.com/market/ws"
        );
    }

    #[test]
    fn accepts_supported_chart_intervals() {
        assert_eq!(interval_ms("3m"), Some(3 * 60_000));
        assert_eq!(interval_ms("2h"), Some(2 * 60 * 60_000));
        assert_eq!(interval_ms("1W"), Some(7 * 24 * 60 * 60_000));
        assert_eq!(interval_ms("1M"), Some(30 * 24 * 60 * 60_000));
    }
}
