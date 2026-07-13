# Rencana Perbaikan AI Trading - Hunter Trades Journal

## Executive Summary
Perbaikan sistem AI Trading dilakukan secara bertahap dalam 4 fase: Robustness & Error Handling, Performance Optimization, LLM Consensus/Filter, dan Configuration & State Management.

---

## Fase 1: Robustness & Error Handling
**Tujuan:** Menjamin stabilitas sistem saat menghadapi gangguan koneksi MT5 atau kegagalan API eksternal.

- **Tasks:**
  - Standardisasi *error reporting* di `mt5McpService.ts` dan `TradingPipelineService.ts`.
  - Implementasi *retry mechanism* yang seragam (dengan *exponential backoff*) untuk semua panggilan ke MT5 MCP.
  - Peningkatan *auto-recovery* pada `TradingPipelineService` jika koneksi MT5 terputus di tengah jalan.
  - Implementasi *circuit breaker* untuk mencegah *looping* yang tidak perlu saat layanan eksternal (LLM/MT5) down.

---

## Fase 2: Performance Optimization
**Tujuan:** Mengurangi *overhead* sistem dan latensi pengambilan data.

- **Tasks:**
  - Optimasi polling data: Mengurangi frekuensi *request* yang berlebih pada API `/rates` dan `/positions`.
  - *Caching* hasil analisis pasar (market regime, fundamental research) agar tidak dihitung ulang setiap tick di `pipelineLoop`.
  - Optimalisasi `ConfluenceEngine` untuk menggunakan *memoization* pada metodologi yang sudah dihitung.
  - Batching *API calls* pada frontend untuk mengurangi *request* individual ke backend.

---

## Fase 3: LLM Consensus & Filter Improvements
**Tujuan:** Meningkatkan kualitas validasi sinyal oleh LLM dan *backtest skill*.

- **Tasks:**
  - *Fine-tuning prompt* untuk analisis teknikal agar lebih presisi sesuai dengan 7 metodologi yang digunakan.
  - Implementasi *dynamic health check* yang lebih ketat: mendeteksi provider yang tidak konsisten secara real-time.
  - Penambahan filter sinyal berbasis performa historis (metodologi/simbol) yang lebih dinamis di `ai-backtest-skill.service.ts`.
  - Peningkatan *parsing logic* untuk respon LLM agar lebih tahan terhadap variasi format output.

---

## Fase 4: Configuration & State Management
**Tujuan:** Sinkronisasi konfigurasi antara frontend dan backend serta persistensi state.

- **Tasks:**
  - Sinkronisasi *methodology weights* dan *active methodologies* secara real-time melalui WebSocket/API.
  - Migrasi *local state* (seperti `activeMethodologies`, `llmConsensusConfig`) di frontend agar tersimpan di backend (DB) dan di-*load* saat user login.
  - Pembersihan kode *legacy* dan *boilerplate* yang tidak perlu untuk menyederhanakan *config flow*.
  - UI Dashboard yang lebih responsif terhadap perubahan konfigurasi pipeline.

---

## Validation Plan
1. **Fase 1:** Uji simulasi koneksi MT5 terputus dan verifikasi log error.
2. **Fase 2:** Pantau log server dan browser console untuk konsumsi API/latensi.
3. **Fase 3:** Bandingkan verdict LLM sebelum dan sesudah perubahan *prompt*.
4. **Fase 4:** Verifikasi persistensi konfigurasi setelah refresh halaman/re-login.
