pub mod benchmark;
pub mod binance;
pub mod commands;
pub mod db;
pub mod domain;
pub mod error;
pub mod history_tasks;
pub mod indicators;
pub mod state;

use commands::{
    add_watchlist_symbol, cancel_cache_task, clear_cache, delete_drawing,
    delete_indicator_instance, enqueue_full_history_tasks, export_config, export_klines_csv,
    get_cache_summary, get_cache_tasks, get_chart_data, get_drawings, get_indicators,
    get_leaderboards, get_market_info, get_settings, get_symbols, get_watchlist, health,
    import_config, list_indicator_instances, remove_watchlist_symbol, reorder_watchlist,
    retry_cache_task, run_performance_benchmark, save_drawing, save_indicator_instance,
    save_settings, seed_default_watchlist, start_live_stream, stop_live_stream,
};
use db::{Database, default_database_path};
use history_tasks::repair_cached_history_integrity;
use state::AppState;
use tauri::Manager;

pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "klineforge=info,tauri=info".into()),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let db_path = default_database_path(&handle)?;
            let runtime = tauri::async_runtime::handle();
            let db = runtime.block_on(Database::connect(db_path))?;
            runtime.block_on(db.mark_running_cache_tasks_cancelled())?;

            let state = AppState::new(db);
            let integrity_state = state.clone();
            app.manage(state);
            tauri::async_runtime::spawn(async move {
                match repair_cached_history_integrity(&integrity_state).await {
                    Ok(tasks) if !tasks.is_empty() => {
                        tracing::info!(
                            task_count = tasks.len(),
                            "queued cached history integrity repair tasks"
                        );
                    }
                    Ok(_) => {
                        tracing::info!("no cached history scopes found for integrity repair");
                    }
                    Err(error) => {
                        tracing::warn!("cached history integrity repair failed to start: {error}");
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            health,
            get_settings,
            save_settings,
            get_symbols,
            get_market_info,
            get_leaderboards,
            get_chart_data,
            get_indicators,
            list_indicator_instances,
            save_indicator_instance,
            delete_indicator_instance,
            get_cache_summary,
            get_cache_tasks,
            enqueue_full_history_tasks,
            cancel_cache_task,
            retry_cache_task,
            clear_cache,
            export_klines_csv,
            export_config,
            import_config,
            get_drawings,
            save_drawing,
            delete_drawing,
            get_watchlist,
            seed_default_watchlist,
            add_watchlist_symbol,
            remove_watchlist_symbol,
            reorder_watchlist,
            start_live_stream,
            stop_live_stream,
            run_performance_benchmark
        ])
        .run(tauri::generate_context!())
        .expect("error while running KLineForge");
}
