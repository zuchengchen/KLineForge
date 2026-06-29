use std::sync::Arc;

use tauri::async_runtime::JoinHandle;
use tokio::sync::Mutex;

use crate::{binance::BinanceClient, db::Database};

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub binance: BinanceClient,
    pub benchmark_lock: Arc<Mutex<()>>,
    pub live_streams: Arc<Mutex<std::collections::HashMap<String, JoinHandle<()>>>>,
}

impl AppState {
    pub fn new(db: Database) -> Self {
        Self {
            db,
            binance: BinanceClient::new(),
            benchmark_lock: Arc::new(Mutex::new(())),
            live_streams: Arc::new(Mutex::new(std::collections::HashMap::new())),
        }
    }
}
