use std::{path::PathBuf, time::Instant};

use futures_util::StreamExt;
use klineforge_lib::{
    binance::{BinanceClient, parse_ws_kline},
    domain::{ChartId, KlineRequest, LiveStreamRequest, Market},
};
use serde::Serialize;
use tokio::time::{Duration, timeout};
use tokio_tungstenite::tungstenite::Message;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().with_env_filter("info").init();

    let args: Vec<String> = std::env::args().collect();
    let output = parse_output_arg(&args);
    let client = BinanceClient::new();
    let mut checks = Vec::new();

    for market in [Market::Spot, Market::UsdM] {
        let request = KlineRequest {
            market,
            symbol: "BTCUSDT".to_string(),
            interval: "1m".to_string(),
            limit: Some(10),
            start_time: None,
            end_time: None,
        };

        let history_start = Instant::now();
        let history = client.get_klines(&request).await?;
        checks.push(MarketSmokeCheck {
            market,
            capability: "history",
            ok: !history.is_empty(),
            rows: Some(history.len()),
            elapsed_ms: history_start.elapsed().as_millis(),
            source: history.first().map(|row| row.source.clone()),
            note: None,
        });

        let info_start = Instant::now();
        let info = client.get_market_info(market, "BTCUSDT").await?;
        checks.push(MarketSmokeCheck {
            market,
            capability: "market-info",
            ok: !info.ticker.last_price.is_empty(),
            rows: None,
            elapsed_ms: info_start.elapsed().as_millis(),
            source: Some(info.source),
            note: info.futures.as_ref().map(|futures| {
                format!(
                    "mark={} funding={}",
                    futures.mark_price, futures.funding_rate
                )
            }),
        });

        let symbols_start = Instant::now();
        let symbols = client.get_symbols(market).await?;
        checks.push(MarketSmokeCheck {
            market,
            capability: "symbols",
            ok: symbols.iter().any(|symbol| symbol.symbol == "BTCUSDT"),
            rows: Some(symbols.len()),
            elapsed_ms: symbols_start.elapsed().as_millis(),
            source: Some("binance-rest".to_string()),
            note: None,
        });

        let live_start = Instant::now();
        let live = receive_live_kline(&client, market).await?;
        checks.push(MarketSmokeCheck {
            market,
            capability: "live-kline",
            ok: true,
            rows: Some(1),
            elapsed_ms: live_start.elapsed().as_millis(),
            source: Some(live.source),
            note: Some(format!("time={} close={}", live.open_time, live.close)),
        });
    }

    let report = MarketSmokeReport {
        generated_at: chrono::Utc::now().timestamp_millis(),
        symbol: "BTCUSDT",
        interval: "1m",
        checks,
    };

    write_report(&output, &report)?;
    println!("{}", serde_json::to_string_pretty(&report)?);
    Ok(())
}

async fn receive_live_kline(
    client: &BinanceClient,
    market: Market,
) -> anyhow::Result<LiveKlineProbe> {
    let request = LiveStreamRequest {
        chart_id: ChartId::Left,
        market,
        symbol: "BTCUSDT".to_string(),
        interval: "1m".to_string(),
    };
    let mut stream = client.connect_kline_stream(&request).await?;
    let message = timeout(Duration::from_secs(30), async {
        while let Some(message) = stream.next().await {
            let message = message?;

            if let Message::Text(_) = &message
                && let Some(kline) = parse_ws_kline(market, "BTCUSDT", "1m", message)?
            {
                return anyhow::Ok(LiveKlineProbe {
                    source: kline.source,
                    open_time: kline.open_time,
                    close: kline.close,
                });
            }
        }

        anyhow::bail!("stream closed before a kline message arrived")
    })
    .await??;

    Ok(message)
}

fn parse_output_arg(args: &[String]) -> PathBuf {
    args.windows(2)
        .find_map(|window| (window[0] == "--output").then(|| PathBuf::from(&window[1])))
        .unwrap_or_else(|| PathBuf::from("artifacts/performance/market-data-smoke.json"))
}

fn write_report(path: &PathBuf, report: &MarketSmokeReport) -> anyhow::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    std::fs::write(path, serde_json::to_string_pretty(report)?)?;
    Ok(())
}

struct LiveKlineProbe {
    source: String,
    open_time: i64,
    close: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MarketSmokeReport {
    generated_at: i64,
    symbol: &'static str,
    interval: &'static str,
    checks: Vec<MarketSmokeCheck>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MarketSmokeCheck {
    market: Market,
    capability: &'static str,
    ok: bool,
    rows: Option<usize>,
    elapsed_ms: u128,
    source: Option<String>,
    note: Option<String>,
}
