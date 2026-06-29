CREATE TABLE IF NOT EXISTS indicator_instances (
  id TEXT PRIMARY KEY NOT NULL,
  chart_id TEXT NOT NULL,
  interval TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  position INTEGER NOT NULL,
  params_json TEXT NOT NULL,
  styles_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_indicator_instances_scope
ON indicator_instances (chart_id, interval, position, updated_at);
