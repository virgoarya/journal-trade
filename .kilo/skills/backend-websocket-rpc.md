# Skill: Backend WebSocket RPC

> Panduan menjaga struktur koneksi WebSocket RPC antara Python client (MT5) dan Next.js server.
> WAJIB dibaca sebelum menyentuh `mt5-streamer.ts`, `server.py`, atau endpoint `/ws/mt5-stream`.

---

## ⚠️ Arsitektur yang BENAR (Jangan Diubah Tanpa Alasan Kuat)

```
[MetaTrader 5 Platform]
         │
         │ (Python API)
         ▼
[Python Client: Hunter Trades AI Trading.exe]
  - CustomTkinter GUI (thread utama)
  - asyncio loop (background thread)
  - websockets.connect() → push data setiap 1 detik
         │
         │ WebSocket (wss://)
         │ NO NGROK, NO SSE, NO FASTAPI
         ▼
[Railway Server: Next.js]
  - /api/ws/route.ts  → WebSocket handler
  - mt5-streamer.ts   → menyimpan koneksi aktif, execute RPC
  - mt5-mcp.service.ts → wrapper public untuk dipanggil service lain
```

---

## Format Pesan WebSocket

### Dari Python → Node.js (Push otomatis setiap 1 detik)
```json
{
  "type": "mt5_tick",
  "data": {
    "positions": [...],
    "accountInfo": { "balance": 10000, "equity": 9850, ... }
  }
}
```

### Dari Node.js → Python (RPC Request)
```json
{
  "type": "rpc_request",
  "id": "uuid-v4",
  "action": "get_positions",
  "payload": {}
}
```

### Dari Python → Node.js (RPC Response)
```json
{
  "type": "rpc_response",
  "id": "uuid-v4",
  "result": { ... }
}
```

---

## Rules Penting

1. **JANGAN gunakan Ngrok, SSE, atau `@modelcontextprotocol/sdk`** — Semua sudah dihapus karena menyebabkan TLS error di Railway.
2. **JANGAN gunakan `undici`** — Tidak kompatibel dengan Node.js di environment Railway.
3. **Koneksi harus auto-reconnect** — Python client menggunakan `while True` loop untuk reconnect setelah disconnect dengan delay 3 detik.
4. **RPC harus ada timeout** — Setiap RPC request di Node.js harus memiliki timeout (default 10 detik) agar tidak hang jika Python client tidak merespons.
5. **Status koneksi harus terpantau** — `mt5-streamer.ts` harus selalu menyimpan referensi ke koneksi WebSocket yang aktif, dan menghapusnya saat disconnect.

---

## Cara Menambah Tool/Command Baru

1. Tambahkan handler baru di `sync_call_tool()` dalam `server.py` di Python.
2. Tambahkan method baru di `MT5MCPService` dalam `mt5-mcp.service.ts` yang memanggil `executeMt5Command()`.
3. Jaga signature method agar sesuai dengan yang sudah dipakai oleh `trading-pipeline` dan route handler lain.

---

## Cara Build EXE

```bat
cd server\mcp-mt5-server
.\build.bat
```

File output: `dist\Hunter Trades AI Trading.exe`

> ⚠️ Flag `-y` HARUS ada di perintah PyInstaller (sudah dikonfigurasi di build.bat). Jangan dihapus.
