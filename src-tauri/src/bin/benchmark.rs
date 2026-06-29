use klineforge_lib::{
    benchmark::{
        parse_archive_target_arg, parse_chart_dataset_output_arg, parse_db_path_arg,
        parse_output_arg, run_archive_benchmark, run_archive_chart_dataset_export,
        run_benchmark_with_fallback, write_summary,
    },
    binance::BinanceClient,
    db::Database,
    domain::{KlineRequest, Market},
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().with_env_filter("info").init();

    let args: Vec<String> = std::env::args().collect();
    let output = parse_output_arg(&args);
    let chart_dataset_output = parse_chart_dataset_output_arg(&args);
    let include_indicators = args.iter().any(|arg| arg == "--with-indicators");
    let db = Database::connect(parse_db_path_arg(&args)).await?;
    let client = BinanceClient::new();
    let request = KlineRequest {
        market: Market::UsdM,
        symbol: "BTCUSDT".to_string(),
        interval: "1m".to_string(),
        limit: Some(1_500),
        start_time: None,
        end_time: None,
    };
    let summary = if let Some(target_rows) = parse_archive_target_arg(&args) {
        if let Some(chart_dataset_output) = chart_dataset_output {
            run_archive_chart_dataset_export(
                &db,
                request,
                target_rows,
                &chart_dataset_output,
                include_indicators || target_rows <= 100_000,
            )
            .await?
        } else {
            run_archive_benchmark(&db, request, target_rows).await?
        }
    } else {
        run_benchmark_with_fallback(&db, &client, request).await?
    };

    write_summary(&output, &summary)?;
    println!("{}", serde_json::to_string_pretty(&summary)?);
    Ok(())
}
