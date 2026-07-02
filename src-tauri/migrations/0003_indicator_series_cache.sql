CREATE TABLE IF NOT EXISTS indicator_series_cache (
  cache_key TEXT PRIMARY KEY NOT NULL,
  market TEXT NOT NULL,
  symbol TEXT NOT NULL,
  interval TEXT NOT NULL,
  chart_id TEXT NOT NULL,
  request_start_time INTEGER NOT NULL,
  request_end_time INTEGER NOT NULL,
  request_limit INTEGER,
  kline_row_count INTEGER NOT NULL,
  kline_first_open_time INTEGER,
  kline_last_open_time INTEGER,
  kline_updated_at INTEGER NOT NULL,
  instances_hash TEXT NOT NULL,
  series_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_indicator_series_cache_scope
ON indicator_series_cache (market, symbol, interval, chart_id, updated_at);
