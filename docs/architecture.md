# Architecture

This document points to the active architecture for the current desktop branch.

Use [KLineForge Tauri/Rust Architecture](./tauri-rust-architecture.md) as the source of truth for module ownership, command surface, data model, security boundaries and current implementation status.

The short version:

1. Rust owns Binance public market access, SQLite persistence, cache reads/writes, indicator calculation, benchmark preparation and structured backend errors.
2. Solid owns layout, controls, language/theme state and chart presentation.
3. The frontend talks to Rust through Tauri commands and receives live candle updates through Tauri events.
4. Lightweight Charts owns high-volume chart rendering.
5. SQLite is the durable local store for K-lines, settings, watchlists, drawings, indicator instances and cache metadata.
