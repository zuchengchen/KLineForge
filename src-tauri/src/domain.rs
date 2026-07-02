use std::collections::{BTreeMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

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

#[derive(Debug, Clone, Copy, Default, Deserialize, Serialize, sqlx::Type, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
#[sqlx(type_name = "TEXT")]
pub enum ChartId {
    #[default]
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
    #[serde(default = "default_chart_limit")]
    pub chart_limit: u32,
    #[serde(default)]
    pub indicator_config_chart: ChartId,
    #[serde(default = "default_drawing_type")]
    pub drawing_type: String,
}

fn default_chart_limit() -> u32 {
    1_000
}

fn default_drawing_type() -> String {
    "horizontal-line".to_string()
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
            chart_limit: default_chart_limit(),
            indicator_config_chart: ChartId::Left,
            drawing_type: default_drawing_type(),
        }
    }
}

impl AppSettings {
    pub fn validated(mut self) -> AppResult<Self> {
        if self.symbol.trim().is_empty() {
            return Err(AppError::Message("symbol setting is required".to_string()));
        }

        validate_supported_interval(&self.left_interval, "leftInterval")?;
        validate_supported_interval(&self.right_interval, "rightInterval")?;

        if !matches!(self.theme.as_str(), "dark" | "light") {
            return Err(AppError::Message(format!(
                "unsupported theme setting: {}",
                self.theme
            )));
        }

        if !matches!(self.language.as_str(), "zh" | "en") {
            return Err(AppError::Message(format!(
                "unsupported language setting: {}",
                self.language
            )));
        }

        if !matches!(self.chart_limit, 1_000 | 100_000 | 1_000_000) {
            return Err(AppError::Message(format!(
                "unsupported chartLimit setting: {}",
                self.chart_limit
            )));
        }

        if !supported_drawing_type(&self.drawing_type) {
            return Err(AppError::Message(format!(
                "unsupported drawingType setting: {}",
                self.drawing_type
            )));
        }

        self.symbol = self.symbol.to_uppercase();

        Ok(self)
    }
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

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum IndicatorKind {
    Volume,
    Ma,
    Ema,
    Boll,
    Macd,
    Rsi,
    Atr,
    Kdj,
    Supertrend,
}

impl IndicatorKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Volume => "volume",
            Self::Ma => "ma",
            Self::Ema => "ema",
            Self::Boll => "boll",
            Self::Macd => "macd",
            Self::Rsi => "rsi",
            Self::Atr => "atr",
            Self::Kdj => "kdj",
            Self::Supertrend => "supertrend",
        }
    }

    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "volume" => Some(Self::Volume),
            "ma" => Some(Self::Ma),
            "ema" => Some(Self::Ema),
            "boll" => Some(Self::Boll),
            "macd" => Some(Self::Macd),
            "rsi" => Some(Self::Rsi),
            "atr" => Some(Self::Atr),
            "kdj" => Some(Self::Kdj),
            "supertrend" => Some(Self::Supertrend),
            _ => None,
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Volume => "Volume",
            Self::Ma => "MA",
            Self::Ema => "EMA",
            Self::Boll => "BOLL",
            Self::Macd => "MACD",
            Self::Rsi => "RSI",
            Self::Atr => "ATR",
            Self::Kdj => "KDJ",
            Self::Supertrend => "Supertrend",
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum IndicatorParams {
    Volume,
    Ma {
        periods: Vec<u16>,
    },
    Ema {
        periods: Vec<u16>,
    },
    Boll {
        period: u16,
        multiplier: f64,
    },
    Macd {
        short_period: u16,
        long_period: u16,
        signal_period: u16,
    },
    Rsi {
        period: u16,
    },
    Atr {
        period: u16,
    },
    Kdj {
        period: u16,
        k_smoothing: u16,
        d_smoothing: u16,
    },
    Supertrend {
        period: u16,
        multiplier: f64,
    },
}

impl IndicatorParams {
    pub fn kind(&self) -> IndicatorKind {
        match self {
            Self::Volume => IndicatorKind::Volume,
            Self::Ma { .. } => IndicatorKind::Ma,
            Self::Ema { .. } => IndicatorKind::Ema,
            Self::Boll { .. } => IndicatorKind::Boll,
            Self::Macd { .. } => IndicatorKind::Macd,
            Self::Rsi { .. } => IndicatorKind::Rsi,
            Self::Atr { .. } => IndicatorKind::Atr,
            Self::Kdj { .. } => IndicatorKind::Kdj,
            Self::Supertrend { .. } => IndicatorKind::Supertrend,
        }
    }

    pub fn validate(&self) -> AppResult<()> {
        match self {
            Self::Volume => Ok(()),
            Self::Ma { periods } | Self::Ema { periods } => validate_period_list(periods),
            Self::Boll { period, multiplier } => {
                validate_period(*period, "period")?;
                validate_multiplier(*multiplier, "multiplier")
            }
            Self::Macd {
                short_period,
                long_period,
                signal_period,
            } => {
                validate_period(*short_period, "shortPeriod")?;
                validate_period(*long_period, "longPeriod")?;
                validate_period(*signal_period, "signalPeriod")?;
                if short_period >= long_period {
                    return Err(AppError::Message(
                        "MACD shortPeriod must be lower than longPeriod".to_string(),
                    ));
                }
                Ok(())
            }
            Self::Rsi { period } | Self::Atr { period } => validate_period(*period, "period"),
            Self::Kdj {
                period,
                k_smoothing,
                d_smoothing,
            } => {
                validate_period(*period, "period")?;
                validate_period(*k_smoothing, "kSmoothing")?;
                validate_period(*d_smoothing, "dSmoothing")
            }
            Self::Supertrend { period, multiplier } => {
                validate_period(*period, "period")?;
                validate_multiplier(*multiplier, "multiplier")
            }
        }
    }

    pub fn generated_name(&self) -> String {
        match self {
            Self::Volume => "Volume".to_string(),
            Self::Ma { periods } => format!("MA({})", join_periods(periods)),
            Self::Ema { periods } => format!("EMA({})", join_periods(periods)),
            Self::Boll { period, multiplier } => {
                format!("BOLL({},{})", period, format_decimal(*multiplier))
            }
            Self::Macd {
                short_period,
                long_period,
                signal_period,
            } => format!("MACD({short_period},{long_period},{signal_period})"),
            Self::Rsi { period } => format!("RSI({period})"),
            Self::Atr { period } => format!("ATR({period})"),
            Self::Kdj {
                period,
                k_smoothing,
                d_smoothing,
            } => format!("KDJ({period},{k_smoothing},{d_smoothing})"),
            Self::Supertrend { period, multiplier } => {
                format!("Supertrend({},{})", period, format_decimal(*multiplier))
            }
        }
    }

    pub fn series_keys(&self) -> Vec<String> {
        match self {
            Self::Volume => vec!["volume".to_string()],
            Self::Ma { periods } | Self::Ema { periods } => {
                periods.iter().map(|period| period.to_string()).collect()
            }
            Self::Boll { .. } => ["up", "mid", "down"]
                .into_iter()
                .map(str::to_string)
                .collect(),
            Self::Macd { .. } => ["dif", "dea", "histogram"]
                .into_iter()
                .map(str::to_string)
                .collect(),
            Self::Rsi { .. } => vec!["rsi".to_string()],
            Self::Atr { .. } => vec!["atr".to_string()],
            Self::Kdj { .. } => ["k", "d", "j"].into_iter().map(str::to_string).collect(),
            Self::Supertrend { .. } => vec!["supertrend".to_string()],
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum IndicatorSeriesType {
    Line,
    Histogram,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum IndicatorLineStyle {
    Solid,
    Dotted,
    Dashed,
    LargeDashed,
    SparseDotted,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct IndicatorStyle {
    pub color: String,
    pub line_width: u8,
    pub line_style: IndicatorLineStyle,
}

impl IndicatorStyle {
    pub fn validate(&self, key: &str) -> AppResult<()> {
        if !is_hex_color(&self.color) {
            return Err(AppError::Message(format!(
                "{key} color must be a #RRGGBB or #RRGGBBAA hex value"
            )));
        }

        if !(1..=5).contains(&self.line_width) {
            return Err(AppError::Message(format!(
                "{key} lineWidth must be between 1 and 5"
            )));
        }

        Ok(())
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct IndicatorInstance {
    pub id: String,
    pub chart_id: ChartId,
    pub interval: String,
    pub kind: IndicatorKind,
    pub name: String,
    pub enabled: bool,
    pub position: i64,
    pub params: IndicatorParams,
    pub styles: BTreeMap<String, IndicatorStyle>,
    pub updated_at: i64,
}

impl IndicatorInstance {
    pub fn normalized(mut self) -> AppResult<Self> {
        if self.id.trim().is_empty() {
            return Err(AppError::Message("indicator id is required".to_string()));
        }

        if self.interval.trim().is_empty() {
            return Err(AppError::Message(
                "indicator interval is required".to_string(),
            ));
        }

        self.params.validate()?;
        self.kind = self.params.kind();
        self.name = self.params.generated_name();
        self.styles = normalize_styles(&self.params, &self.styles)?;
        Ok(self)
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndicatorScope {
    pub chart_id: ChartId,
    pub interval: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndicatorCalculationRequest {
    pub chart_id: ChartId,
    pub request: KlineRequest,
    #[serde(default)]
    pub max_rows: Option<u32>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndicatorSeriesPoint {
    pub time: i64,
    pub value: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndicatorSeries {
    pub id: String,
    pub instance_id: String,
    pub key: String,
    pub label: String,
    pub series_type: IndicatorSeriesType,
    pub pane: u8,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price_scale_id: Option<String>,
    pub style: IndicatorStyle,
    pub data: Vec<IndicatorSeriesPoint>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndicatorResponse {
    pub instances: Vec<IndicatorInstance>,
    pub series: Vec<IndicatorSeries>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skipped_reason: Option<String>,
}

pub const MAX_INDICATOR_INSTANCES_PER_SCOPE: usize = 20;
pub const MAX_INDICATOR_CALCULATION_ROWS: u32 = 200_000;

pub fn default_indicator_instances(chart_id: ChartId, interval: &str) -> Vec<IndicatorInstance> {
    let defaults = [
        IndicatorParams::Volume,
        IndicatorParams::Ma {
            periods: vec![5, 10, 30],
        },
        IndicatorParams::Ema {
            periods: vec![12, 26],
        },
        IndicatorParams::Boll {
            period: 20,
            multiplier: 2.0,
        },
        IndicatorParams::Macd {
            short_period: 12,
            long_period: 26,
            signal_period: 9,
        },
        IndicatorParams::Rsi { period: 14 },
        IndicatorParams::Atr { period: 14 },
        IndicatorParams::Kdj {
            period: 9,
            k_smoothing: 3,
            d_smoothing: 3,
        },
        IndicatorParams::Supertrend {
            period: 10,
            multiplier: 3.0,
        },
    ];

    defaults
        .into_iter()
        .enumerate()
        .map(|(position, params)| {
            let styles = default_styles_for_params(&params);
            IndicatorInstance {
                id: format!(
                    "{}-{}-{}",
                    chart_id.as_str(),
                    interval,
                    params.kind().as_str()
                ),
                chart_id,
                interval: interval.to_string(),
                kind: params.kind(),
                name: params.generated_name(),
                enabled: true,
                position: position as i64,
                params,
                styles,
                updated_at: 0,
            }
        })
        .collect()
}

pub fn default_styles_for_params(params: &IndicatorParams) -> BTreeMap<String, IndicatorStyle> {
    let keys = params.series_keys();
    let palette = default_palette(params.kind());

    keys.into_iter()
        .enumerate()
        .map(|(index, key)| {
            let color = palette[index % palette.len()].to_string();
            let style = IndicatorStyle {
                color,
                line_width: if params.kind() == IndicatorKind::Supertrend {
                    2
                } else {
                    1
                },
                line_style: IndicatorLineStyle::Solid,
            };

            (key, style)
        })
        .collect()
}

pub fn normalize_styles(
    params: &IndicatorParams,
    styles: &BTreeMap<String, IndicatorStyle>,
) -> AppResult<BTreeMap<String, IndicatorStyle>> {
    let defaults = default_styles_for_params(params);
    let mut normalized = BTreeMap::new();

    for key in params.series_keys() {
        let style = styles
            .get(&key)
            .cloned()
            .or_else(|| defaults.get(&key).cloned())
            .ok_or_else(|| AppError::Message(format!("missing style for {key}")))?;
        style.validate(&key)?;
        normalized.insert(key, style);
    }

    Ok(normalized)
}

fn validate_period_list(periods: &[u16]) -> AppResult<()> {
    if periods.is_empty() {
        return Err(AppError::Message(
            "periods must contain at least one value".to_string(),
        ));
    }

    if periods.len() > 8 {
        return Err(AppError::Message(
            "periods may contain at most 8 values".to_string(),
        ));
    }

    let mut seen = HashSet::new();
    for period in periods {
        validate_period(*period, "period")?;
        if !seen.insert(*period) {
            return Err(AppError::Message(
                "periods must not contain duplicates".to_string(),
            ));
        }
    }

    Ok(())
}

fn validate_period(period: u16, name: &str) -> AppResult<()> {
    if (1..=500).contains(&period) {
        Ok(())
    } else {
        Err(AppError::Message(format!(
            "{name} must be between 1 and 500"
        )))
    }
}

fn validate_multiplier(multiplier: f64, name: &str) -> AppResult<()> {
    if multiplier.is_finite() && (0.1..=20.0).contains(&multiplier) {
        Ok(())
    } else {
        Err(AppError::Message(format!(
            "{name} must be between 0.1 and 20"
        )))
    }
}

fn join_periods(periods: &[u16]) -> String {
    periods
        .iter()
        .map(u16::to_string)
        .collect::<Vec<_>>()
        .join(",")
}

fn format_decimal(value: f64) -> String {
    let rounded = (value * 100.0).round() / 100.0;
    let mut text = format!("{rounded:.2}");

    while text.contains('.') && text.ends_with('0') {
        text.pop();
    }
    if text.ends_with('.') {
        text.pop();
    }

    text
}

fn is_hex_color(value: &str) -> bool {
    let Some(hex) = value.strip_prefix('#') else {
        return false;
    };

    (hex.len() == 6 || hex.len() == 8) && hex.chars().all(|character| character.is_ascii_hexdigit())
}

fn validate_supported_interval(interval: &str, name: &str) -> AppResult<()> {
    if interval_ms(interval).is_some() {
        Ok(())
    } else {
        Err(AppError::Message(format!(
            "unsupported {name} setting: {interval}"
        )))
    }
}

fn supported_drawing_type(value: &str) -> bool {
    matches!(
        value,
        "horizontal-line" | "trend-line" | "vertical-line" | "rectangle" | "text" | "measurement"
    )
}

fn default_palette(kind: IndicatorKind) -> &'static [&'static str] {
    match kind {
        IndicatorKind::Volume => &["#4b78ff66"],
        IndicatorKind::Ma => &["#f6c343", "#38bdf8", "#fb7185", "#a3e635"],
        IndicatorKind::Ema => &["#8b5cf6", "#14b8a6", "#f97316", "#60a5fa"],
        IndicatorKind::Boll => &["#94a3b8", "#64748b", "#94a3b8"],
        IndicatorKind::Macd => &["#f6c343", "#38bdf8", "#22ab9466"],
        IndicatorKind::Rsi => &["#fb7185"],
        IndicatorKind::Atr => &["#14b8a6"],
        IndicatorKind::Kdj => &["#f6c343", "#38bdf8", "#fb7185"],
        IndicatorKind::Supertrend => &["#22ab94"],
    }
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
pub struct CacheTask {
    pub id: String,
    pub market: Market,
    pub symbol: String,
    pub interval: String,
    pub status: String,
    pub progress: f64,
    pub phase: String,
    pub message: Option<String>,
    pub rows_written: i64,
    pub source: Option<String>,
    pub first_open_time: Option<i64>,
    pub last_open_time: Option<i64>,
    pub archive_months: i64,
    pub rest_pages: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheTaskPayload {
    #[serde(default = "default_cache_task_kind")]
    pub kind: String,
    #[serde(default = "default_cache_task_phase")]
    pub phase: String,
    pub message: Option<String>,
    #[serde(default)]
    pub rows_written: i64,
    pub source: Option<String>,
    pub first_open_time: Option<i64>,
    pub last_open_time: Option<i64>,
    #[serde(default)]
    pub archive_months: i64,
    #[serde(default)]
    pub rest_pages: i64,
    pub started_at: Option<i64>,
    pub finished_at: Option<i64>,
}

impl Default for CacheTaskPayload {
    fn default() -> Self {
        Self {
            kind: default_cache_task_kind(),
            phase: default_cache_task_phase(),
            message: None,
            rows_written: 0,
            source: None,
            first_open_time: None,
            last_open_time: None,
            archive_months: 0,
            rest_pages: 0,
            started_at: None,
            finished_at: None,
        }
    }
}

fn default_cache_task_kind() -> String {
    "full-history".to_string()
}

fn default_cache_task_phase() -> String {
    "queued".to_string()
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
    #[serde(default)]
    pub indicators: Vec<IndicatorInstance>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigImportResult {
    pub settings_imported: bool,
    pub watchlist_count: usize,
    pub drawing_count: usize,
    pub indicator_count: usize,
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
    use super::{
        AppSettings, ChartId, IndicatorKind, IndicatorLineStyle, IndicatorParams, IndicatorStyle,
        Market, default_indicator_instances, interval_ms,
    };
    use std::collections::BTreeMap;

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

    #[test]
    fn app_settings_validate_required_ui_preferences() {
        let settings = AppSettings {
            chart_limit: 100_000,
            indicator_config_chart: ChartId::Right,
            drawing_type: "measurement".to_string(),
            ..AppSettings::default()
        }
        .validated()
        .expect("settings");

        assert_eq!(settings.symbol, "BTCUSDT");
        assert_eq!(settings.chart_limit, 100_000);
        assert_eq!(settings.indicator_config_chart, ChartId::Right);
        assert_eq!(settings.drawing_type, "measurement");
    }

    #[test]
    fn app_settings_reject_invalid_ui_preferences() {
        assert!(
            AppSettings {
                chart_limit: 42,
                ..AppSettings::default()
            }
            .validated()
            .is_err()
        );
        assert!(
            AppSettings {
                drawing_type: "freehand".to_string(),
                ..AppSettings::default()
            }
            .validated()
            .is_err()
        );
    }

    #[test]
    fn app_settings_fills_ui_preference_defaults_from_stored_json() {
        let stored_json = serde_json::json!({
            "market": "usdM",
            "symbol": "btcusdt",
            "leftInterval": "5m",
            "rightInterval": "1h",
            "theme": "dark",
            "language": "zh"
        });

        let settings = serde_json::from_value::<AppSettings>(stored_json)
            .expect("settings decode")
            .validated()
            .expect("settings validate");

        assert_eq!(settings.symbol, "BTCUSDT");
        assert_eq!(settings.chart_limit, 1_000);
        assert_eq!(settings.indicator_config_chart, ChartId::Left);
        assert_eq!(settings.drawing_type, "horizontal-line");
    }

    #[test]
    fn indicator_params_generate_tradingview_style_names() {
        assert_eq!(
            IndicatorParams::Ma {
                periods: vec![5, 10, 30]
            }
            .generated_name(),
            "MA(5,10,30)"
        );
        assert_eq!(
            IndicatorParams::Macd {
                short_period: 12,
                long_period: 26,
                signal_period: 9
            }
            .generated_name(),
            "MACD(12,26,9)"
        );
    }

    #[test]
    fn indicator_validation_rejects_invalid_params() {
        assert!(
            IndicatorParams::Ma {
                periods: vec![5, 5]
            }
            .validate()
            .is_err()
        );
        assert!(
            IndicatorParams::Macd {
                short_period: 26,
                long_period: 12,
                signal_period: 9
            }
            .validate()
            .is_err()
        );
        assert!(
            IndicatorParams::Boll {
                period: 20,
                multiplier: 0.0
            }
            .validate()
            .is_err()
        );
    }

    #[test]
    fn indicator_instance_normalization_refreshes_name_kind_and_styles() {
        let instance = super::IndicatorInstance {
            id: "custom".to_string(),
            chart_id: ChartId::Left,
            interval: "1h".to_string(),
            kind: IndicatorKind::Rsi,
            name: "old".to_string(),
            enabled: true,
            position: 0,
            params: IndicatorParams::Ma {
                periods: vec![7, 21],
            },
            styles: BTreeMap::from([(
                "7".to_string(),
                IndicatorStyle {
                    color: "#ffffff".to_string(),
                    line_width: 2,
                    line_style: IndicatorLineStyle::Dashed,
                },
            )]),
            updated_at: 0,
        }
        .normalized()
        .expect("normalized");

        assert_eq!(instance.kind, IndicatorKind::Ma);
        assert_eq!(instance.name, "MA(7,21)");
        assert!(instance.styles.contains_key("7"));
        assert!(instance.styles.contains_key("21"));
    }

    #[test]
    fn default_instances_include_the_current_indicator_set() {
        let defaults = default_indicator_instances(ChartId::Left, "1h");

        assert_eq!(
            defaults
                .iter()
                .map(|instance| instance.kind)
                .collect::<Vec<_>>(),
            vec![
                IndicatorKind::Volume,
                IndicatorKind::Ma,
                IndicatorKind::Ema,
                IndicatorKind::Boll,
                IndicatorKind::Macd,
                IndicatorKind::Rsi,
                IndicatorKind::Atr,
                IndicatorKind::Kdj,
                IndicatorKind::Supertrend
            ]
        );
    }
}
