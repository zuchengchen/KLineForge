CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS symbols (
  market TEXT NOT NULL,
  symbol TEXT NOT NULL,
  base_asset TEXT NOT NULL,
  quote_asset TEXT NOT NULL,
  status TEXT NOT NULL,
  price_precision INTEGER NOT NULL DEFAULT 4,
  volume_precision INTEGER NOT NULL DEFAULT 2,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (market, symbol)
);

CREATE TABLE IF NOT EXISTS klines (
  market TEXT NOT NULL,
  symbol TEXT NOT NULL,
  interval TEXT NOT NULL,
  open_time INTEGER NOT NULL,
  close_time INTEGER NOT NULL,
  open TEXT NOT NULL,
  high TEXT NOT NULL,
  low TEXT NOT NULL,
  close TEXT NOT NULL,
  volume TEXT NOT NULL,
  quote_volume TEXT NOT NULL,
  trade_count INTEGER NOT NULL,
  taker_buy_base_volume TEXT NOT NULL,
  taker_buy_quote_volume TEXT NOT NULL,
  is_closed INTEGER NOT NULL,
  source TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (market, symbol, interval, open_time)
);

CREATE INDEX IF NOT EXISTS idx_klines_range
ON klines (market, symbol, interval, open_time, close_time);

CREATE TABLE IF NOT EXISTS kline_ranges (
  market TEXT NOT NULL,
  symbol TEXT NOT NULL,
  interval TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (market, symbol, interval, start_time, end_time)
);

CREATE TABLE IF NOT EXISTS watchlists (
  market TEXT NOT NULL,
  symbol TEXT NOT NULL,
  position INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (market, symbol)
);

CREATE TABLE IF NOT EXISTS drawings (
  id TEXT PRIMARY KEY NOT NULL,
  market TEXT NOT NULL,
  symbol TEXT NOT NULL,
  interval TEXT NOT NULL,
  chart_id TEXT NOT NULL,
  drawing_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS indicator_configs (
  id TEXT PRIMARY KEY NOT NULL,
  market TEXT NOT NULL,
  symbol TEXT NOT NULL,
  interval TEXT NOT NULL,
  chart_id TEXT NOT NULL,
  name TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cache_tasks (
  id TEXT PRIMARY KEY NOT NULL,
  market TEXT NOT NULL,
  symbol TEXT NOT NULL,
  interval TEXT NOT NULL,
  status TEXT NOT NULL,
  progress REAL NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
