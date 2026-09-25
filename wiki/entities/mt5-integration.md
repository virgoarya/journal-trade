---
title: MT5 Integration
created: 2026-09-21
updated: 2026-09-21
type: entity
tags: [integration, mt5, pipeline, python, module]
sources: [raw/articles/project-overview.md]
confidence: high
---

# MT5 Integration

Integrasi MetaTrader 5 ke dalam [[hunter-trades-journal]] melalui Model Context Protocol (MCP) dan Python MetaTrader5 library.

## Arsitektur Bridge

    Backend (Express) → MT5 MCP Server (Python) → MetaTrader 5 Terminal

## MCP Tools

    mt5_connect         Inisialisasi koneksi MT5
    mt5_disconnect      Tutup koneksi MT5
    mt5_account_info    Info akun (balance, equity, margin, margin level, PnL)
    mt5_positions_get   Posisi terbuka + pending orders (include_orders: true)
    mt5_symbols_get     Daftar simbol tradeable
    mt5_order_send      Kirim order trading
    mt5_position_close  Tutup posisi
    mt5_position_modify Modifikasi TP/SL
    mt5_history_get     Histori trade

## Fallback: trade_api.py

Untuk operasi trading (send, close, modify, cancel) yang ditolak MCP ("not permitted"), backend fallback ke Python MetaTrader5 API langsung via trade_api.py. Termasuk retry logic dan pemilihan filling mode per simbol.

## Streaming

- mt5-streamer.ts: WebSocket singleton untuk data real-time (1 koneksi aktif)
- Tick data: real-time tanpa delay
- Candle cache: 1 detik, Symbol cache: 5 detik, Status cache: 10 detik

## Python Path

    C:\Python314\python.exe (bukan venv Hermes)

## Lihat Juga

- [[hunter-trades-journal]] — Aplikasi induk
- [[market-structure-concepts]] — Konsep yang digunakan untuk analisis data MT5
