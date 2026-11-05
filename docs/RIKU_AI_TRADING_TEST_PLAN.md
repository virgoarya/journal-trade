# AI Trading Exploratory Test Plan & Feature Verification Matrix

**Author:** RIKU (Application Quality Control & Product Tester)  
**Project:** Hunter Trades Journal (`D:/Journal Trade`)  
**Target Route:** `/ai-trading`  
**Date:** 2026-10-28  
**Status:** DRAFT / PENDING EXECUTION (Awaiting Fase 1 MT5 MCP & Staging Build)  
**Reference:** SOP Tim (§4, §14, §18, §20) · ADR-0001 · ADR-0002  

---

## 1. Pendahuluan & Sasaran Uji

Dokumen ini merupakan panduan dan matriks checklist pengujian exploratory fungsional untuk halaman **AI Trading** (`frontend/src/app/(dashboard)/ai-trading`). Pengujian ini dirancang untuk memastikan integrasi end-to-end antara UI Desktop/Web, Backend API (`server/src/routes/ai-trading.routes.ts`), Pipeline Service (`trading-pipeline.service.ts`), dan MT5 MCP Bridge (Native HTTP Port 22346 / Python bridge) berjalan stabil, aman, dan tanpa data desinkronisasi.

### Sasaran Kualitas (QC Target)
- Zero false-positive koneksi MT5: UI status harus akurat merefleksikan state socket aktual.
- Zero silent failure eksekusi order: Semua order rejection harus menghasilkan feedback visual eksplisit.
- Idempotency & safety: Tidak ada double-execution pada tick spike atau retry loop.
- Non-blocking UI: Gagal koneksi broker atau status payment gate tidak boleh mengunci fitur offline (preview, backtest, dan review riwayat).

---

## 2. Matriks Skenario Pengujian

### Skenario 1: Transisi State Koneksi MT5

Memverifikasi siklus hidup koneksi antara Client -> Backend -> MT5 MCP Server (Port 22346) -> Terminal MT5.

- **1.1 State: Connected (Normal Operation)**
  - Kondisi Awal: `terminal64.exe` aktif, MCP server listen di `127.0.0.1:22346`, Algo Trading aktif.
  - Langkah Uji:
    1. Klik tombol "Connect MT5" atau biarkan auto-connect membaca env.
    2. Pantau respons `POST /api/v1/ai-trading/connect` dan handshake probe.
  - Ekspektasi:
    - Status badge berubah menjadi `Connected` (hijau).
    - Data akun (Balance, Equity, Margin, Free Margin, Leverage) termuat via `GET /api/v1/ai-trading/account`.
    - Daftar simbol (`GET /symbols`) dan market rates terisi tanpa error.

- **1.2 State: Disconnected / Connection Refused**
  - Kondisi Awal: Terminal MT5 dimatikan atau port 22346 tidak aktif.
  - Langkah Uji:
    1. Kirim request koneksi atau buka halaman `/ai-trading`.
  - Ekspektasi:
    - Status badge menampilkan `Disconnected` (merah/abu-abu).
    - Polling rates berhenti secara elegan tanpa spam error di console log.
    - Tombol aksi trading (Open, Close All, Start Pipeline) ter-disable atau menampilkan warning preventif.

- **1.3 State: Reconnecting & Exponential Backoff**
  - Kondisi Awal: Koneksi drop tiba-tiba saat runtime (simulasi kill port / disconnect socket).
  - Langkah Uji:
    1. Matikan service MCP saat tab `/ai-trading` aktif.
    2. Amati siklus retry backend dan UI banner.
  - Ekspektasi:
    - Status menampilkan `Reconnecting...` dengan indikator loading non-blocking.
    - UI tidak memunculkan modal kaku fullscreen yang mengunci navigasi ke tab lain.
    - Tersedia tombol "Batal Reconnect" atau "Lanjut Mode Offline / Preview".

- **1.4 State: Circuit Breaker Open & Auto-Reset**
  - Kondisi Awal: Request gagal beruntun (> threshold fail count).
  - Langkah Uji:
    1. Cek state circuit breaker di backend `mt5McpService.circuitBreakerState`.
    2. Coba trigger order atau polling saat state `OPEN`.
    3. Nyalakan kembali MT5 dan service MCP port 22346.
  - Ekspektasi:
    - Saat `OPEN`: Request order langsung fast-fail dengan pesan jelas (503 Service Unavailable / Circuit Open), menghindari socket hang.
    - Saat service pulih: Health check mendeteksi socket hidup -> circuit breaker auto-reset ke `CLOSED` -> koneksi kembali normal tanpa restart server.

---

### Skenario 2: Eksekusi Order (Manual vs AI Automated Execution)

Memverifikasi integritas payload, risk gate, dan feedback eksekusi order.

- **2.1 Manual Order: Open Position**
  - Titik Masuk: Form `TradingPanel.tsx` -> `POST /api/v1/ai-trading/open`.
  - Langkah Uji:
    1. Masukkan simbol (misal `XAUUSD`), order type (`BUY`/`SELL`), volume (lot), SL, dan TP.
    2. Klik "Execute Order".
  - Ekspektasi:
    - Validasi Zod schema berjalan pada volume minimum/step lot broker.
    - Backend meneruskan ke MT5 MCP tool (`trade_send_market_order` / `mt5_order_send`).
    - Feedback toast success muncul berisi Ticket ID.
    - Posisi baru langsung ter-render di `PositionsTable.tsx`.

- **2.2 Manual Order: Modify SL/TP & Partial/Full Close**
  - Titik Masuk: `PositionsTable.tsx` aksi "Modify" dan "Close".
  - Langkah Uji:
    1. Ubah nilai SL/TP pada tiket aktif -> amati perubahan di MT5.
    2. Klik tombol "Close" per tiket -> request `POST /api/v1/ai-trading/close`.
    3. Klik "Emergency Close All" saat ada 2+ tiket terbuka.
  - Ekspektasi:
    - Tiket tertutup di MT5 dalam <1 detik.
    - Tiket terhapus dari tabel open positions tanpa meninggalkan ghost row.

- **2.3 AI Automated Execution: Pipeline Start, Consensus & Auto-Order**
  - Titik Masuk: Toggle AI Trading Pipeline -> `POST /api/v1/ai-trading/pipeline/start`.
  - Langkah Uji:
    1. Set parameter strategi (SMC / ICT / MSNR confluence) dan aktifkan Agent Consensus.
    2. Amati streaming logs di `PipelineLogs.tsx` dan breakdown agent di `AgentBreakdown.tsx`.
    3. Simulasikan sinyal `GOOD` (konfluens tinggi + voting agen lolos).
  - Ekspektasi:
    - Risk Gate menghitung ukuran posisi (position sizing) sesuai batas risiko akun (% risk atau fixed drawdown).
    - Pipeline memicu order otomatis via adapter MCP.
    - Jika sinyal `SKIP` atau `BAD`, order ditolak dan log mencatat alasan penolakan secara transparan.

- **2.4 Safety Guard: Dry-Run Mode & Disconnect Protection**
  - Langkah Uji:
    1. Jalankan pipeline dalam mode dry-run (`/debug-order`).
    2. Simulasikan MT5 putus di tengah proses analisa AI.
  - Ekspektasi:
    - Dry-run hanya menghitung parameter tanpa mengirim order riil ke broker.
    - Jika MT5 putus, pipeline otomatis pause/abort dan tidak melakukan antrean order gelap (*blind queuing*).

---

### Skenario 3: Validasi Sinkronisasi Data (Positions & History Deals)

Memverifikasi keakuratan penyajian data transaksi dan pemulihan desinkronisasi.

- **3.1 Realtime Ticks & Open Positions Sync**
  - Komponen: `PositionsTable.tsx`, `usePositions.ts`, `useMT5Stream.ts`.
  - Verifikasi:
    - Floating PnL ter-update seiring pergerakan bid/ask tick.
    - Re-render komponen tidak membebani CPU (debounce/throttling aktif pada update tick berkecepatan tinggi).
    - Data di UI identik dengan data pada terminal MT5 (ticket, volume, open price, current price, swap, profit).

- **3.2 Closed Deals & Trade History Sync**
  - Komponen: `TradeHistoryDashboard.tsx`, `AITradeHistories.tsx`.
  - Verifikasi:
    - Posisi yang ditutup segera berpindah ke tabel riwayat transaksi (History Deals).
    - Realized PnL, commission, dan execution time tercatat akurat.
    - Sinkronisasi dengan database persistence (MongoDB) tersimpan permanen.

- **3.3 State Recovery Pasca Page Reload / Crash**
  - Langkah Uji:
    1. Buka posisi aktif di MT5.
    2. Lakukan hard reload browser / restart Electron app.
    3. Buka kembali halaman `/ai-trading`.
  - Ekspektasi:
    - Posisi aktif langsung termuat ulang dari server/cache MT5.
    - State pipeline (Running/Stopped/Paused) konsisten dengan backend runtime.

---

### Skenario 4: Behavior UI & Payment Gate

Memverifikasi fungsionalitas pembatasan akses paket dan kebersihan UX.

- **4.1 Payment Status: Active / Subscribed**
  - Kondisi: User memiliki hak akses paket AI Trading aktif.
  - Ekspektasi:
    - Banner peringatan pembayaran (`PaymentStatusBanner.tsx`) tersembunyi.
    - Seluruh tombol kontrol pipeline, form trading manual, dan setting konfigurasi dapat dioperasikan secara penuh.

- **4.2 Payment Status: Inactive / Expired / Unpaid**
  - Kondisi: User belum berlangganan atau masa aktif habis.
  - Ekspektasi:
    - `PaymentStatusBanner.tsx` tampil dengan hierarki visual yang jelas dan tombol aksi menuju portal pembayaran/upgrade.
    - Tombol eksekusi order riil dan start AI pipeline dalam keadaan disabled (read-only mode).
    - Fitur edukatif, preview layout, dan backtest histori tetap dapat dilihat (*non-blocking*).
    - Tidak ada popup spam atau loop reload yang mematikan navigasi aplikasi.

---

## 3. Checklist Eksekusi Pengujian (Feature Matrix)

Item checklist yang akan diverifikasi oleh Riku saat runtime & staging build tersedia:

- [ ] **M1. MT5 Socket Handshake** — Port 22346 terdeteksi listening dan probe 200 OK.
- [ ] **M2. MT5 Account Info Load** — Balance, equity, dan leverage tampil presisi di `AccountOverview.tsx`.
- [ ] **M3. Symbol & Rates Fetch** — Simbol aktif termuat di `SymbolSelector.tsx` dengan spread valid.
- [ ] **M4. Circuit Breaker Behavior** — Transisi status CLOSED -> OPEN -> CLOSED tervalidasi.
- [ ] **M5. Manual Order Open** — Eksekusi Buy/Sell via `TradingPanel.tsx` menghasilkan tiket resmi.
- [ ] **M6. Manual Order Close** — Penutupan tiket per item dan Emergency Close All tuntas <1s.
- [ ] **M7. AI Consensus Visualization** — Voting agen (Hawk, Dove, Contrarian) ter-render di `AgentBreakdown.tsx`.
- [ ] **M8. Risk Engine Guard** — Lot size calculation mencegah over-leveraging sesuai config.
- [ ] **M9. Realtime PnL Update** — Floating profit sinkron dengan tick pergerakan harga.
- [ ] **M10. History Reconciliation** — Deals tertutup tercatat di `TradeHistoryDashboard.tsx` dan MongoDB.
- [ ] **M11. Payment Gate Non-Blocking** — Banner informatif dan mencegah auto-trading tanpa mengunci navigasi.
- [ ] **M12. Offline Mode Escape** — UI tetap interaktif saat broker terputus.

### 3.1 Matriks Verifikasi Desain & UX (Rekomendasi Lyra `docs/design/ai-trading-ux-audit.md`)
- [ ] **UX-01 [P0 Critical]** — Hapus fullscreen blocking modal di `page.tsx` saat `positions.length > 0`.
- [ ] **UX-02 [P0 Critical]** — Mount `TradingDisabledBanner.tsx` di `page.tsx` untuk error Algo Trading MT5.
- [ ] **UX-03 [P1 High]** — Hapus `return null;` pada zero-state di `PositionsTable.tsx`, ganti dengan empty state card.
- [ ] **UX-04 [P1 High]** — Auto-reset timeout 4 detik pada tombol konfirmasi `Close All` di `PositionsTable.tsx`.
- [ ] **UX-05 [P1 High]** — Sticky column untuk kolom `Symbol` dan `Actions/Profit` pada `PositionsTable.tsx`.
- [ ] **UX-06 [P2 Medium]** — Sticky layout sidebar `TradingPanel.tsx` (`xl:sticky xl:top-4`).
- [ ] **UX-07 [P2 Medium]** — Format ringkas non-invasif pada `PaymentStatusBanner.tsx`.
- [ ] **UX-08 [P3 Polish]** — Pengelompokan analitik sekunder di bawah `AgentBreakdown` ke sub-tab modular.

---

## 4. Prosedur Pengambilan Bukti (Evidence Collection)

Setiap pengujian exploratory harus disertai bukti teknis konkrit:
1. **Exit Code & Command Log:** Menggunakan `curl`, `netstat`, atau skrip probe probe-native-mcp.
2. **Snapshot Window / Screenshot:** Disimpan di direktori screenshot bukti jika ditemukan visual bug atau modal trap.
3. **Log Runtime:** Menyertakan potongan log backend dari `server/dist` atau console error saat terjadi anomali.
4. **Laporan Format SOP:** Mengirim ringkasan ke KIRA dengan template `<@1560158842002612274> **KIRA — RIKU — [STATUS]**`.
