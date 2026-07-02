use std::{fs, path::PathBuf};

use klineforge_lib::{
    db::Database,
    domain::{KlineRequest, Market},
    history_tasks::run_full_history_validation,
    state::AppState,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().with_env_filter("info").init();

    let args: Vec<String> = std::env::args().collect();
    let output = parse_output_arg(&args);
    let db_path = parse_db_path_arg(&args);
    let request = KlineRequest {
        market: parse_market_arg(&args),
        symbol: parse_arg(&args, "--symbol").unwrap_or_else(|| "BTCUSDT".to_string()),
        interval: parse_arg(&args, "--interval").unwrap_or_else(|| "1h".to_string()),
        limit: None,
        start_time: None,
        end_time: None,
    };
    let db = Database::connect(db_path).await?;
    let state = AppState::new(db);
    let validation = run_full_history_validation(&state, request).await?;

    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&output, serde_json::to_string_pretty(&validation)?)?;
    println!("{}", serde_json::to_string_pretty(&validation)?);

    Ok(())
}

fn parse_output_arg(args: &[String]) -> PathBuf {
    parse_arg(args, "--output")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("artifacts/performance/full-history-usdm-btcusdt-1h.json"))
}

fn parse_db_path_arg(args: &[String]) -> PathBuf {
    parse_arg(args, "--db-path")
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::temp_dir().join("klineforge-full-history.sqlite3"))
}

fn parse_market_arg(args: &[String]) -> Market {
    match parse_arg(args, "--market").as_deref() {
        Some("spot") => Market::Spot,
        _ => Market::UsdM,
    }
}

fn parse_arg(args: &[String], name: &str) -> Option<String> {
    args.windows(2)
        .find_map(|window| (window[0] == name).then(|| window[1].clone()))
}
