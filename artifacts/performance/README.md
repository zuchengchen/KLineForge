# Performance Artifacts

This directory stores benchmark manifests, checksums, JSON results, Markdown reports and manual interaction notes for the Tauri/Rust rewrite.

Large raw benchmark datasets are intentionally not committed to Git. Use CI cache or release artifacts for fixed real-data datasets.

Current large-chart scripts generate ignored JSON/PNG/CSV artifacts in this directory:

- `chart-dataset-100k.json` and `chart-dataset-1m.json` are real Binance Public Data chart datasets.
- `large-chart-*-interaction.json` records scripted load, pan/zoom/crosshair and workflow timings.
- `large-chart-*.png` and `large-chart-100k.csv` are reproducible visual/export evidence.
