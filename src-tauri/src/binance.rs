use reqwest::Client;
use serde::Deserialize;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use url::Url;

use crate::{
    db::now_ms,
    domain::{
        FuturesMarketInfo, Kline, KlineRequest, LeaderboardEntry, Leaderboards, LiveStreamRequest,
        Market, MarketInfoSnapshot, SymbolSummary, Ticker24h, interval_ms,
    },
    error::AppResult,
};

#[derive(Clone)]
pub struct BinanceClient {
    http: Client,
}

impl BinanceClient {
    pub fn new() -> Self {
        Self {
            http: Client::builder()
                .user_agent("KLineForge/0.1.0-tauri")
                .build()
                .expect("reqwest client"),
        }
    }

    pub async fn get_klines(&self, request: &KlineRequest) -> AppResult<Vec<Kline>> {
        let path = match request.market {
            Market::Spot => "/api/v3/klines",
            Market::UsdM => "/fapi/v1/klines",
        };
        let binance_interval = binance_interval(&request.interval);
        let mut query: Vec<(&str, String)> = vec![
            ("symbol", request.symbol.to_uppercase()),
            ("interval", binance_interval.to_string()),
            (
                "limit",
                request.limit.unwrap_or(1_500).min(1_500).to_string(),
            ),
        ];

        if let Some(start_time) = request.start_time {
            query.push(("startTime", start_time.to_string()));
        }

        if let Some(end_time) = request.end_time {
            query.push(("endTime", end_time.to_string()));
        }

        let rows = self
            .get_json_with_fallback::<Vec<Vec<serde_json::Value>>>(request.market, path, &query)
            .await?;

        Ok(rows
            .into_iter()
            .filter_map(|row| {
                normalize_kline(request.market, &request.symbol, &request.interval, row).ok()
            })
            .collect())
    }

    pub async fn get_symbols(&self, market: Market) -> AppResult<Vec<SymbolSummary>> {
        match market {
            Market::Spot => self.get_spot_symbols().await,
            Market::UsdM => self.get_usdm_symbols().await,
        }
    }

    pub async fn get_market_info(
        &self,
        market: Market,
        symbol: &str,
    ) -> AppResult<MarketInfoSnapshot> {
        let ticker = self.get_ticker_24h(market, Some(symbol)).await?.remove(0);
        let futures = if market == Market::UsdM {
            Some(self.get_futures_market_info(symbol).await?)
        } else {
            None
        };

        Ok(MarketInfoSnapshot {
            ticker,
            futures,
            source: "binance-rest".to_string(),
        })
    }

    pub async fn get_leaderboards(&self, market: Market) -> AppResult<Leaderboards> {
        let mut tickers = self.get_ticker_24h(market, None).await?;
        tickers.retain(|ticker| ticker.symbol.ends_with("USDT"));

        let mut gainers = tickers.clone();
        gainers.sort_by(|left, right| {
            parse_f64(&right.price_change_percent).total_cmp(&parse_f64(&left.price_change_percent))
        });

        let mut losers = tickers.clone();
        losers.sort_by(|left, right| {
            parse_f64(&left.price_change_percent).total_cmp(&parse_f64(&right.price_change_percent))
        });

        let mut volume = tickers;
        volume.sort_by(|left, right| {
            parse_f64(&right.quote_volume).total_cmp(&parse_f64(&left.quote_volume))
        });

        Ok(Leaderboards {
            gainers: gainers
                .into_iter()
                .take(8)
                .map(LeaderboardEntry::from)
                .collect(),
            losers: losers
                .into_iter()
                .take(8)
                .map(LeaderboardEntry::from)
                .collect(),
            volume: volume
                .into_iter()
                .take(8)
                .map(LeaderboardEntry::from)
                .collect(),
        })
    }

    async fn get_ticker_24h(
        &self,
        market: Market,
        symbol: Option<&str>,
    ) -> AppResult<Vec<Ticker24h>> {
        let path = match market {
            Market::Spot => "/api/v3/ticker/24hr",
            Market::UsdM => "/fapi/v1/ticker/24hr",
        };
        let query = symbol.map(|symbol| vec![("symbol", symbol.to_uppercase())]);

        let value = self
            .get_json_with_fallback::<serde_json::Value>(
                market,
                path,
                query.as_deref().unwrap_or(&[]),
            )
            .await?;
        let payloads = match value {
            serde_json::Value::Array(rows) => rows
                .into_iter()
                .map(serde_json::from_value::<BinanceTicker24h>)
                .collect::<Result<Vec<_>, _>>()?,
            value => vec![serde_json::from_value::<BinanceTicker24h>(value)?],
        };

        Ok(payloads
            .into_iter()
            .map(|payload| normalize_ticker(market, payload))
            .collect())
    }

    async fn get_futures_market_info(&self, symbol: &str) -> AppResult<FuturesMarketInfo> {
        let response = self
            .http
            .get(format!(
                "{}/fapi/v1/premiumIndex",
                Market::UsdM.rest_base_url()
            ))
            .query(&[("symbol", symbol.to_uppercase())])
            .send()
            .await?
            .error_for_status()?
            .json::<BinancePremiumIndex>()
            .await?;

        Ok(FuturesMarketInfo {
            symbol: response.symbol,
            mark_price: response.mark_price,
            index_price: response.index_price,
            funding_rate: response.last_funding_rate,
            next_funding_time: response.next_funding_time,
            updated_at: response.time.unwrap_or_else(now_ms),
        })
    }

    async fn get_spot_symbols(&self) -> AppResult<Vec<SymbolSummary>> {
        let response = self
            .get_json_with_fallback::<SpotExchangeInfo>(Market::Spot, "/api/v3/exchangeInfo", &[])
            .await?;

        Ok(response
            .symbols
            .into_iter()
            .filter(|symbol| symbol.quote_asset == "USDT")
            .map(|symbol| SymbolSummary {
                market: Market::Spot,
                symbol: symbol.symbol,
                base_asset: symbol.base_asset,
                quote_asset: symbol.quote_asset,
                status: symbol.status,
            })
            .collect())
    }

    async fn get_usdm_symbols(&self) -> AppResult<Vec<SymbolSummary>> {
        let response = self
            .http
            .get(format!(
                "{}/fapi/v1/exchangeInfo",
                Market::UsdM.rest_base_url()
            ))
            .send()
            .await?
            .error_for_status()?
            .json::<SpotExchangeInfo>()
            .await?;

        Ok(response
            .symbols
            .into_iter()
            .filter(|symbol| symbol.quote_asset == "USDT")
            .map(|symbol| SymbolSummary {
                market: Market::UsdM,
                symbol: symbol.symbol,
                base_asset: symbol.base_asset,
                quote_asset: symbol.quote_asset,
                status: symbol.status,
            })
            .collect())
    }

    pub async fn connect_kline_stream(
        &self,
        request: &LiveStreamRequest,
    ) -> AppResult<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
    > {
        let stream_name = format!(
            "{}@kline_{}",
            request.symbol.to_lowercase(),
            binance_interval(&request.interval)
        );
        let url = Url::parse(&format!("{}/{}", request.market.ws_base_url(), stream_name))?;
        let (stream, _) = connect_async(url.as_str()).await?;

        Ok(stream)
    }

    async fn get_json_with_fallback<T>(
        &self,
        market: Market,
        path: &str,
        query: &[(&str, String)],
    ) -> AppResult<T>
    where
        T: serde::de::DeserializeOwned,
    {
        let primary = format!("{}{}", market.rest_base_url(), path);
        let response = self.http.get(&primary).query(query).send().await;

        match response {
            Ok(response) => Ok(response.error_for_status()?.json::<T>().await?),
            Err(primary_error) if market == Market::Spot => {
                tracing::warn!(
                    "spot primary REST failed, trying data-api fallback: {primary_error}"
                );
                let fallback = format!("https://data-api.binance.vision{path}");
                Ok(self
                    .http
                    .get(fallback)
                    .query(query)
                    .send()
                    .await?
                    .error_for_status()?
                    .json::<T>()
                    .await?)
            }
            Err(error) => Err(error.into()),
        }
    }
}

impl Default for BinanceClient {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SpotExchangeInfo {
    symbols: Vec<ExchangeSymbol>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExchangeSymbol {
    symbol: String,
    status: String,
    base_asset: String,
    quote_asset: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BinanceTicker24h {
    symbol: String,
    price_change: String,
    price_change_percent: String,
    last_price: String,
    high_price: String,
    low_price: String,
    volume: String,
    quote_volume: String,
    open_time: i64,
    close_time: i64,
    count: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BinancePremiumIndex {
    symbol: String,
    mark_price: String,
    index_price: String,
    last_funding_rate: String,
    next_funding_time: i64,
    time: Option<i64>,
}

impl From<Ticker24h> for LeaderboardEntry {
    fn from(ticker: Ticker24h) -> Self {
        Self {
            symbol: ticker.symbol,
            last_price: ticker.last_price,
            price_change_percent: ticker.price_change_percent,
            quote_volume: ticker.quote_volume,
        }
    }
}

fn normalize_ticker(market: Market, payload: BinanceTicker24h) -> Ticker24h {
    Ticker24h {
        market,
        symbol: payload.symbol,
        last_price: payload.last_price,
        price_change: payload.price_change,
        price_change_percent: payload.price_change_percent,
        high_price: payload.high_price,
        low_price: payload.low_price,
        volume: payload.volume,
        quote_volume: payload.quote_volume,
        trade_count: payload.count,
        open_time: payload.open_time,
        close_time: payload.close_time,
        updated_at: now_ms(),
    }
}

fn normalize_kline(
    market: Market,
    symbol: &str,
    interval: &str,
    row: Vec<serde_json::Value>,
) -> AppResult<Kline> {
    let open_time = row
        .first()
        .and_then(serde_json::Value::as_i64)
        .unwrap_or_default();
    let close_time = row
        .get(6)
        .and_then(serde_json::Value::as_i64)
        .or_else(|| interval_ms(interval).map(|ms| open_time + ms - 1))
        .unwrap_or(open_time);

    Ok(Kline {
        market: market.as_str().to_string(),
        symbol: symbol.to_uppercase(),
        interval: interval.to_string(),
        open_time,
        open: value_as_string(&row, 1),
        high: value_as_string(&row, 2),
        low: value_as_string(&row, 3),
        close: value_as_string(&row, 4),
        volume: value_as_string(&row, 5),
        close_time,
        quote_volume: value_as_string(&row, 7),
        trade_count: row
            .get(8)
            .and_then(serde_json::Value::as_i64)
            .unwrap_or_default(),
        taker_buy_base_volume: value_as_string(&row, 9),
        taker_buy_quote_volume: value_as_string(&row, 10),
        is_closed: close_time <= now_ms(),
        source: "binance-rest".to_string(),
        updated_at: now_ms(),
    })
}

pub fn parse_ws_kline(
    market: Market,
    symbol: &str,
    interval: &str,
    message: Message,
) -> AppResult<Option<Kline>> {
    let Message::Text(text) = message else {
        return Ok(None);
    };
    let event = serde_json::from_str::<WsKlineEvent>(&text)?;
    let kline = event.k;

    Ok(Some(Kline {
        market: market.as_str().to_string(),
        symbol: symbol.to_uppercase(),
        interval: interval.to_string(),
        open_time: kline.open_time,
        close_time: kline.close_time,
        open: kline.open,
        high: kline.high,
        low: kline.low,
        close: kline.close,
        volume: kline.volume,
        quote_volume: kline.quote_volume,
        trade_count: kline.trade_count,
        taker_buy_base_volume: kline.taker_buy_base_volume,
        taker_buy_quote_volume: kline.taker_buy_quote_volume,
        is_closed: kline.is_closed,
        source: "binance-websocket".to_string(),
        updated_at: now_ms(),
    }))
}

#[derive(Debug, Deserialize)]
struct WsKlineEvent {
    k: WsKline,
}

#[derive(Debug, Deserialize)]
struct WsKline {
    #[serde(rename = "t")]
    open_time: i64,
    #[serde(rename = "T")]
    close_time: i64,
    #[serde(rename = "o")]
    open: String,
    #[serde(rename = "h")]
    high: String,
    #[serde(rename = "l")]
    low: String,
    #[serde(rename = "c")]
    close: String,
    #[serde(rename = "v")]
    volume: String,
    #[serde(rename = "q")]
    quote_volume: String,
    #[serde(rename = "n")]
    trade_count: i64,
    #[serde(rename = "V")]
    taker_buy_base_volume: String,
    #[serde(rename = "Q")]
    taker_buy_quote_volume: String,
    #[serde(rename = "x")]
    is_closed: bool,
}

fn value_as_string(row: &[serde_json::Value], index: usize) -> String {
    row.get(index)
        .and_then(|value| match value {
            serde_json::Value::String(text) => Some(text.clone()),
            serde_json::Value::Number(number) => Some(number.to_string()),
            _ => None,
        })
        .unwrap_or_else(|| "0".to_string())
}

fn parse_f64(value: &str) -> f64 {
    value.parse::<f64>().unwrap_or_default()
}

fn binance_interval(interval: &str) -> String {
    let Some(unit) = interval.chars().last() else {
        return interval.to_string();
    };
    let value = &interval[..interval.len().saturating_sub(unit.len_utf8())];

    match unit {
        'W' => format!("{value}w"),
        'M' => format!("{value}M"),
        _ => interval.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn normalizes_binance_kline_row() {
        let row = vec![
            json!(1),
            json!("10"),
            json!("12"),
            json!("9"),
            json!("11"),
            json!("100"),
            json!(60_000),
            json!("1100"),
            json!(3),
            json!("50"),
            json!("550"),
            json!("0"),
        ];

        let kline = normalize_kline(Market::UsdM, "btcusdt", "1m", row).expect("kline");

        assert_eq!(kline.symbol, "BTCUSDT");
        assert_eq!(kline.close, "11");
        assert_eq!(kline.trade_count, 3);
    }

    #[test]
    fn normalizes_binance_interval_without_breaking_months() {
        assert_eq!(binance_interval("1W"), "1w");
        assert_eq!(binance_interval("1M"), "1M");
        assert_eq!(binance_interval("3m"), "3m");
        assert_eq!(binance_interval("2h"), "2h");
    }

    #[test]
    fn parses_ws_kline_event() {
        let message = Message::Text(
            serde_json::json!({
                "k": {
                    "t": 1,
                    "T": 60_000,
                    "o": "10",
                    "h": "12",
                    "l": "9",
                    "c": "11",
                    "v": "100",
                    "q": "1100",
                    "n": 3,
                    "V": "50",
                    "Q": "550",
                    "x": false
                }
            })
            .to_string()
            .into(),
        );

        let kline = parse_ws_kline(Market::UsdM, "btcusdt", "1m", message)
            .expect("parse")
            .expect("kline");

        assert_eq!(kline.source, "binance-websocket");
        assert!(!kline.is_closed);
        assert_eq!(kline.close, "11");
    }
}
