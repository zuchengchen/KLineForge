use std::{
    fs,
    io::{Cursor, Read},
    path::{Path, PathBuf},
    time::Instant,
};

use crate::{
    binance::BinanceClient,
    db::{Database, now_ms},
    domain::{BenchmarkSummary, ChartPoint, IndicatorValue, Kline, KlineRequest, Market},
    error::{AppError, AppResult},
    indicators::calculate_default_indicators,
};

const ARCHIVE_MONTHS: &[(i32, u32)] = &[
    (2026, 5),
    (2026, 4),
    (2026, 3),
    (2026, 2),
    (2026, 1),
    (2025, 12),
    (2025, 11),
    (2025, 10),
    (2025, 9),
    (2025, 8),
    (2025, 7),
    (2025, 6),
    (2025, 5),
    (2025, 4),
    (2025, 3),
    (2025, 2),
    (2025, 1),
    (2024, 12),
    (2024, 11),
    (2024, 10),
    (2024, 9),
    (2024, 8),
    (2024, 7),
    (2024, 6),
];

pub async fn run_benchmark(
    db: &Database,
    client: &BinanceClient,
    request: KlineRequest,
) -> AppResult<BenchmarkSummary> {
    let requested_rows = request.limit.unwrap_or(1_500) as usize;
    let fetch_start = Instant::now();
    let rows = client.get_klines(&request).await?;
    let fetch_ms = fetch_start.elapsed().as_millis();

    let write_start = Instant::now();
    db.write_klines(&rows).await?;
    let sqlite_write_ms = write_start.elapsed().as_millis();

    let read_start = Instant::now();
    let cached_rows = db.read_klines(&request).await?;
    let sqlite_read_ms = read_start.elapsed().as_millis();

    let points: Vec<ChartPoint> = cached_rows.iter().map(ChartPoint::from).collect();
    let indicator_start = Instant::now();
    let _indicators = calculate_default_indicators(&points);
    let indicator_ms = indicator_start.elapsed().as_millis();

    Ok(BenchmarkSummary {
        market: request.market,
        symbol: request.symbol.to_uppercase(),
        interval: request.interval,
        requested_rows,
        fetched_rows: cached_rows.len(),
        fetch_ms,
        sqlite_write_ms,
        sqlite_read_ms,
        indicator_ms,
        source: "binance-rest".to_string(),
    })
}

pub async fn run_benchmark_with_fallback(
    db: &Database,
    client: &BinanceClient,
    request: KlineRequest,
) -> AppResult<BenchmarkSummary> {
    match run_benchmark(db, client, request.clone()).await {
        Ok(summary) => Ok(summary),
        Err(error) => {
            let requested_rows = request.limit.unwrap_or(1_500) as usize;
            let rows = generate_fallback_klines(&request, requested_rows);

            let write_start = Instant::now();
            db.write_klines(&rows).await?;
            let sqlite_write_ms = write_start.elapsed().as_millis();

            let read_start = Instant::now();
            let cached_rows = db.read_klines(&request).await?;
            let sqlite_read_ms = read_start.elapsed().as_millis();

            let points: Vec<ChartPoint> = cached_rows.iter().map(ChartPoint::from).collect();
            let indicator_start = Instant::now();
            let _indicators = calculate_default_indicators(&points);
            let indicator_ms = indicator_start.elapsed().as_millis();

            Ok(BenchmarkSummary {
                market: request.market,
                symbol: request.symbol.to_uppercase(),
                interval: request.interval,
                requested_rows,
                fetched_rows: cached_rows.len(),
                fetch_ms: 0,
                sqlite_write_ms,
                sqlite_read_ms,
                indicator_ms,
                source: format!("generated-fallback: {error}"),
            })
        }
    }
}

pub async fn run_archive_benchmark(
    db: &Database,
    request: KlineRequest,
    target_rows: usize,
) -> AppResult<BenchmarkSummary> {
    let fetch_start = Instant::now();
    let rows = fetch_archive_klines(&request, target_rows).await?;
    let fetch_ms = fetch_start.elapsed().as_millis();
    let mut read_request = request.clone();
    read_request.limit = Some(target_rows as u32);

    let write_start = Instant::now();
    db.write_klines(&rows).await?;
    let sqlite_write_ms = write_start.elapsed().as_millis();

    let read_start = Instant::now();
    let cached_rows = db.read_klines(&read_request).await?;
    let sqlite_read_ms = read_start.elapsed().as_millis();

    let points: Vec<ChartPoint> = cached_rows.iter().map(ChartPoint::from).collect();
    let indicator_start = Instant::now();
    let _indicators = calculate_default_indicators(&points);
    let indicator_ms = indicator_start.elapsed().as_millis();

    Ok(BenchmarkSummary {
        market: request.market,
        symbol: request.symbol.to_uppercase(),
        interval: request.interval,
        requested_rows: target_rows,
        fetched_rows: cached_rows.len(),
        fetch_ms,
        sqlite_write_ms,
        sqlite_read_ms,
        indicator_ms,
        source: "binance-public-data-monthly-archive".to_string(),
    })
}

pub async fn run_archive_chart_dataset_export(
    db: &Database,
    request: KlineRequest,
    target_rows: usize,
    output_path: &Path,
    include_indicators: bool,
) -> AppResult<BenchmarkSummary> {
    let fetch_start = Instant::now();
    let rows = fetch_archive_klines(&request, target_rows).await?;
    let fetch_ms = fetch_start.elapsed().as_millis();
    let mut read_request = request.clone();
    read_request.limit = Some(target_rows as u32);

    let write_start = Instant::now();
    db.write_klines(&rows).await?;
    let sqlite_write_ms = write_start.elapsed().as_millis();

    let read_start = Instant::now();
    let cached_rows = db.read_klines(&read_request).await?;
    let sqlite_read_ms = read_start.elapsed().as_millis();

    let points: Vec<ChartPoint> = cached_rows.iter().map(ChartPoint::from).collect();
    let indicator_start = Instant::now();
    let indicators = if include_indicators {
        calculate_default_indicators(&points)
    } else {
        Vec::new()
    };
    let indicator_ms = indicator_start.elapsed().as_millis();

    let summary = BenchmarkSummary {
        market: request.market,
        symbol: request.symbol.to_uppercase(),
        interval: request.interval.clone(),
        requested_rows: target_rows,
        fetched_rows: cached_rows.len(),
        fetch_ms,
        sqlite_write_ms,
        sqlite_read_ms,
        indicator_ms,
        source: "binance-public-data-monthly-archive".to_string(),
    };

    write_chart_dataset(
        output_path,
        &request,
        &points,
        include_indicators.then_some(indicators.as_slice()),
        &summary,
    )?;

    Ok(summary)
}

pub fn write_summary(path: &Path, summary: &BenchmarkSummary) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    fs::write(path, serde_json::to_string_pretty(summary)?)?;
    Ok(())
}

pub fn parse_output_arg(args: &[String]) -> PathBuf {
    args.windows(2)
        .find_map(|window| (window[0] == "--output").then(|| PathBuf::from(&window[1])))
        .unwrap_or_else(|| PathBuf::from("artifacts/performance/latest-benchmark.json"))
}

pub fn parse_chart_dataset_output_arg(args: &[String]) -> Option<PathBuf> {
    args.windows(2).find_map(|window| {
        (window[0] == "--chart-dataset-output").then(|| PathBuf::from(&window[1]))
    })
}

pub fn parse_archive_target_arg(args: &[String]) -> Option<usize> {
    args.windows(2)
        .find_map(|window| {
            (window[0] == "--archive-target").then(|| window[1].parse::<usize>().ok())
        })
        .flatten()
}

pub fn parse_db_path_arg(args: &[String]) -> PathBuf {
    args.windows(2)
        .find_map(|window| (window[0] == "--db-path").then(|| PathBuf::from(&window[1])))
        .unwrap_or_else(|| std::env::temp_dir().join("klineforge-benchmark.sqlite3"))
}

fn write_chart_dataset(
    path: &Path,
    request: &KlineRequest,
    points: &[ChartPoint],
    indicators: Option<&[IndicatorValue]>,
    benchmark: &BenchmarkSummary,
) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let first_open_time = points.first().map(|point| point.time * 1_000);
    let last_open_time = points.last().map(|point| point.time * 1_000);
    let export = ChartDatasetExport {
        schema_version: 1,
        generated_at: now_ms(),
        source: "binance-public-data-monthly-archive",
        market: request.market,
        symbol: request.symbol.to_uppercase(),
        interval: request.interval.as_str(),
        requested_rows: benchmark.requested_rows,
        row_count: points.len(),
        first_open_time,
        last_open_time,
        points,
        indicators,
        benchmark,
    };
    let file = fs::File::create(path)?;

    serde_json::to_writer(file, &export)?;
    Ok(())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ChartDatasetExport<'a> {
    schema_version: u16,
    generated_at: i64,
    source: &'a str,
    market: Market,
    symbol: String,
    interval: &'a str,
    requested_rows: usize,
    row_count: usize,
    first_open_time: Option<i64>,
    last_open_time: Option<i64>,
    points: &'a [ChartPoint],
    #[serde(skip_serializing_if = "Option::is_none")]
    indicators: Option<&'a [IndicatorValue]>,
    benchmark: &'a BenchmarkSummary,
}

async fn fetch_archive_klines(request: &KlineRequest, target_rows: usize) -> AppResult<Vec<Kline>> {
    if request.symbol.to_uppercase() != "BTCUSDT" || request.interval != "1m" {
        return Err(AppError::Message(
            "archive benchmark currently supports BTCUSDT 1m only".to_string(),
        ));
    }

    let client = reqwest::Client::builder()
        .user_agent("KLineForge/0.1.0-tauri archive-benchmark")
        .build()?;
    let mut rows = Vec::with_capacity(target_rows);

    for (year, month) in ARCHIVE_MONTHS {
        let url = archive_url(
            request.market,
            &request.symbol,
            &request.interval,
            *year,
            *month,
        );
        let bytes = client
            .get(url)
            .send()
            .await?
            .error_for_status()?
            .bytes()
            .await?;
        let mut parsed = parse_archive_zip(request, &bytes)?;
        rows.append(&mut parsed);

        if rows.len() >= target_rows {
            break;
        }
    }

    rows.sort_by_key(|row| row.open_time);
    rows.dedup_by_key(|row| row.open_time);
    rows.truncate(target_rows);

    if rows.len() < target_rows {
        return Err(AppError::Message(format!(
            "archive benchmark fetched {} rows, below requested {target_rows}",
            rows.len()
        )));
    }

    Ok(rows)
}

fn archive_url(market: Market, symbol: &str, interval: &str, year: i32, month: u32) -> String {
    let symbol = symbol.to_uppercase();
    let scope = match market {
        Market::Spot => "spot",
        Market::UsdM => "futures/um",
    };

    format!(
        "https://data.binance.vision/data/{scope}/monthly/klines/{symbol}/{interval}/{symbol}-{interval}-{year}-{month:02}.zip"
    )
}

fn parse_archive_zip(request: &KlineRequest, bytes: &[u8]) -> AppResult<Vec<Kline>> {
    let reader = Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(reader)
        .map_err(|error| AppError::Message(format!("failed to read archive zip: {error}")))?;
    let mut rows = Vec::new();

    for index in 0..archive.len() {
        let mut file = archive
            .by_index(index)
            .map_err(|error| AppError::Message(format!("failed to read archive file: {error}")))?;

        if !file.name().ends_with(".csv") {
            continue;
        }

        let mut content = String::new();
        file.read_to_string(&mut content)?;
        rows.extend(parse_archive_csv(request, &content));
    }

    Ok(rows)
}

fn parse_archive_csv(request: &KlineRequest, content: &str) -> Vec<Kline> {
    content
        .lines()
        .filter_map(|line| {
            let columns: Vec<&str> = line.split(',').collect();

            if columns.len() < 11 || columns[0] == "open_time" {
                return None;
            }

            Some(Kline {
                market: request.market.as_str().to_string(),
                symbol: request.symbol.to_uppercase(),
                interval: request.interval.clone(),
                open_time: columns[0].parse().ok()?,
                open: columns[1].to_string(),
                high: columns[2].to_string(),
                low: columns[3].to_string(),
                close: columns[4].to_string(),
                volume: columns[5].to_string(),
                close_time: columns[6].parse().ok()?,
                quote_volume: columns[7].to_string(),
                trade_count: columns[8].parse().unwrap_or_default(),
                taker_buy_base_volume: columns[9].to_string(),
                taker_buy_quote_volume: columns[10].to_string(),
                is_closed: true,
                source: "binance-public-data".to_string(),
                updated_at: now_ms(),
            })
        })
        .collect()
}

fn generate_fallback_klines(request: &KlineRequest, count: usize) -> Vec<Kline> {
    let interval_ms = crate::domain::interval_ms(&request.interval).unwrap_or(60_000);
    let end = now_ms() / interval_ms * interval_ms;
    let start = end - interval_ms * count as i64;
    let base = if request.symbol.to_uppercase().starts_with("BTC") {
        60_000.0
    } else {
        2_500.0
    };

    (0..count)
        .map(|index| {
            let open_time = start + interval_ms * index as i64;
            let drift = (index as f64 / 17.0).sin() * base * 0.012;
            let open = base + drift;
            let close = open + (index as f64 / 11.0).cos() * base * 0.003;
            let high = open.max(close) + base * 0.002;
            let low = open.min(close) - base * 0.002;
            let volume = 100.0 + index as f64;

            Kline {
                market: request.market.as_str().to_string(),
                symbol: request.symbol.to_uppercase(),
                interval: request.interval.clone(),
                open_time,
                close_time: open_time + interval_ms - 1,
                open: format!("{open:.8}"),
                high: format!("{high:.8}"),
                low: format!("{low:.8}"),
                close: format!("{close:.8}"),
                volume: format!("{volume:.8}"),
                quote_volume: format!("{:.8}", volume * close),
                trade_count: 100 + index as i64,
                taker_buy_base_volume: format!("{:.8}", volume * 0.48),
                taker_buy_quote_volume: format!("{:.8}", volume * close * 0.48),
                is_closed: true,
                source: "generated-fallback".to_string(),
                updated_at: now_ms(),
            }
        })
        .collect()
}
