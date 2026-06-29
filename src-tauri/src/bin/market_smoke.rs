use std::{path::PathBuf, time::Instant};

use anyhow::Context;
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
    let allow_live_rest_fallback = env_flag("KLINEFORGE_MARKET_SMOKE_ALLOW_LIVE_REST_FALLBACK");
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
        let live = match receive_live_kline(&client, market).await {
            Ok(live) => LiveKlineCheck {
                ok: true,
                probe: live,
                note_prefix: None,
            },
            Err(error) if allow_live_rest_fallback => {
                let fallback = receive_latest_rest_kline(&client, market)
                    .await
                    .with_context(|| {
                        format!(
                            "live WebSocket probe failed and REST fallback also failed: {error}"
                        )
                    })?;

                LiveKlineCheck {
                    ok: true,
                    probe: fallback,
                    note_prefix: Some(format!(
                        "CI REST fallback after WebSocket probe failure: {}",
                        truncate_note(&error.to_string())
                    )),
                }
            }
            Err(error) => return Err(error.context("live WebSocket kline probe failed")),
        };
        checks.push(MarketSmokeCheck {
            market,
            capability: "live-kline",
            ok: live.ok,
            rows: Some(1),
            elapsed_ms: live_start.elapsed().as_millis(),
            source: Some(live.probe.source),
            note: Some(format_live_note(
                live.note_prefix.as_deref(),
                live.probe.open_time,
                &live.probe.close,
            )),
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

    if let Some(failed) = report.checks.iter().find(|check| !check.ok) {
        anyhow::bail!(
            "market smoke failed for {} {}",
            failed.market.as_str(),
            failed.capability
        );
    }

    Ok(())
}

async fn receive_live_kline(
    client: &BinanceClient,
    market: Market,
) -> anyhow::Result<LiveKlineProbe> {
    let attempts = env_usize("KLINEFORGE_MARKET_SMOKE_LIVE_ATTEMPTS", 2).max(1);
    let timeout_secs = env_u64("KLINEFORGE_MARKET_SMOKE_LIVE_TIMEOUT_SECS", 20).max(1);
    let mut errors = Vec::new();

    for attempt in 1..=attempts {
        match receive_live_kline_once(client, market, timeout_secs).await {
            Ok(probe) => return Ok(probe),
            Err(error) => errors.push(format!("attempt {attempt}/{attempts}: {error}")),
        }

        if attempt < attempts {
            tokio::time::sleep(Duration::from_secs(2)).await;
        }
    }

    anyhow::bail!("{}", errors.join("; "))
}

async fn receive_live_kline_once(
    client: &BinanceClient,
    market: Market,
    timeout_secs: u64,
) -> anyhow::Result<LiveKlineProbe> {
    let request = LiveStreamRequest {
        chart_id: ChartId::Left,
        market,
        symbol: "BTCUSDT".to_string(),
        interval: "1m".to_string(),
    };
    let mut stream = client.connect_kline_stream(&request).await?;
    let message = timeout(Duration::from_secs(timeout_secs), async {
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

async fn receive_latest_rest_kline(
    client: &BinanceClient,
    market: Market,
) -> anyhow::Result<LiveKlineProbe> {
    let request = KlineRequest {
        market,
        symbol: "BTCUSDT".to_string(),
        interval: "1m".to_string(),
        limit: Some(1),
        start_time: None,
        end_time: None,
    };
    let kline = client
        .get_klines(&request)
        .await?
        .into_iter()
        .next()
        .context("REST fallback returned no kline rows")?;

    Ok(LiveKlineProbe {
        source: "binance-rest-ci-live-fallback".to_string(),
        open_time: kline.open_time,
        close: kline.close,
    })
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

struct LiveKlineCheck {
    ok: bool,
    probe: LiveKlineProbe,
    note_prefix: Option<String>,
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

fn env_flag(name: &str) -> bool {
    std::env::var(name)
        .map(|value| matches!(value.as_str(), "1" | "true" | "TRUE" | "yes" | "YES"))
        .unwrap_or(false)
}

fn env_usize(name: &str, default: usize) -> usize {
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(default)
}

fn env_u64(name: &str, default: u64) -> u64 {
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(default)
}

fn format_live_note(prefix: Option<&str>, open_time: i64, close: &str) -> String {
    match prefix {
        Some(prefix) => format!("{prefix}; time={open_time} close={close}"),
        None => format!("time={open_time} close={close}"),
    }
}

fn truncate_note(value: &str) -> String {
    const MAX_NOTE_LEN: usize = 220;

    if value.len() <= MAX_NOTE_LEN {
        return value.to_string();
    }

    format!("{}...", &value[..MAX_NOTE_LEN])
}
