# Post-Mortem — MT5 Auto-Resume Macet & 9Router Key Leak

**Tanggal**: 2026-10-05
**Severity**: P1 (trading pipeline tidak bisa resume) + **Blocker** (secret in git history)
**Status**: Code fixed & verified · **1 action item terbuka (rotasi key)**
**Sifat**: Blameless — fokus pada sistem, bukan orang.

---

## Ringkasan

Dua insiden terpisah yang ditemukan dalam satu sesi investigasi:

1. **MT5 "connection lost" yang tidak pernah hilang.** Monitoring agent menulis CRITICAL `MT5 connection lost` secara terus-menerus dan pipeline auto-paused, padahal transport MT5 sendiri sudah pulih. Auto-resume tidak pernah jalan.
2. **Kredensial 9Router live ter-commit di source code** dan sudah masuk git history.

---

## Insiden 1 — MT5 Auto-Resume Macet

### Gejala
- `server/monitoring-reports/latest.md` → `[mt5] MT5 connection lost` (critical) berulang tiap jam.
- Pipeline `waitingReconnect = true` permanen; log auto-resume tidak pernah muncul.
- Frontend tetap menampilkan status connected (ditangani terpisah oleh @riku di sisi client).

### Akar Masalah
`MT5MCPService.connected` **hanya** di-set oleh pemanggilan eksplisit `connectToMT5()`. Sejak `initMt5NativeMcp()` mengambil alih transport, auto-reconnect nyata dijalankan oleh `server/src/mt5-streamer.ts` (`scheduleReconnect` → `connectToNativeMcp`) yang men-set `isConnected` lokalnya sendiri **tanpa pernah memberi tahu service**. Setelah MT5 pulih otomatis, `mt5McpService.isConnected` tetap `false`.

Efek berantai:
- `pipelineLoop` menahan `waitingReconnect` selamanya → auto-resume tidak jalan.
- `GET /api/ai-trading/status` melaporkan `connected: false`.
- `checkMT5Health` menulis CRITICAL walau transport sehat.
- `callWithCircuit` melempar `"MT5 not connected"` untuk semua tool.

Bug sekunder yang ditemukan saat memperbaiki:
- `isReconnectingStatus` membaca flag yang hanya di-set jalur legacy → `reconnecting` **selalu false**.
- Blok disconnect pipeline memanggil `addLog` tanpa guard transisi → log ERROR + broadcast WS tiap tick per symbol selama MT5 down.
- `pipeline.mt5CircuitOpen = true` dipaksa dari layer atas → desync breaker sampai 30s setelah pulih.
- `getPipelineStatus` cabang disconnect mengembalikan `mt5CircuitState: "CONNECTED"` hardcoded dan tidak mengembalikan `smartRisk`.

### Timeline
| Waktu | Kejadian |
|---|---|
| — | MT5 drop; streamer auto-reconnect pulih sendiri |
| — | Service flag tetap `false` → pipeline freeze, monitoring CRITICAL berulang |
| Sesi ini | Investigasi: `grep` menunjukkan streamer tidak pernah menyentuh `mt5McpService` |
| Sesi ini | Fix + verifikasi (`tsc` 0 error, backend 81/81, frontend 42/42) |

**TTD**: tidak terukur (bertahap, bukan outage tunggal) · **TTR**: 1 sesi kerja.

### Perbaikan
| # | Perubahan | File |
|---|---|---|
| 1 | `isConnected` → `this.connected \|\| mt5StreamCache.isConnected()` (streamer = sumber kebenaran) | `mt5-mcp.service.ts` |
| 2 | State `isReconnecting` di streamer + ekspos via `mt5StreamCache`; `isReconnectingStatus` membacanya | `mt5-streamer.ts`, `mt5-mcp.service.ts` |
| 3 | `forceDisconnect()` ikut menjatuhkan transport via `forceReconnect()` | `mt5-mcp.service.ts` |
| 4 | Guard transisi pada log auto-pause (sekali per transisi, bukan per tick) | `trading-pipeline.service.ts` |
| 5 | Buang paksaan `mt5CircuitOpen`; breaker milik layer transport | `trading-pipeline.service.ts` |
| 6 | Cabang disconnect `getPipelineStatus`: breaker asli + `smartRisk` + tidak di-cache | `trading-pipeline.service.ts` |
| 7 | Snapshot `mt5_status` otoritatif dikirim saat WS connect | `index.ts` |

---

## Insiden 2 — 9Router API Key Leak (BLOCKER)

### Temuan
Kredensial 9Router yang tampak live di-hardcode di **tiga** lokasi:

| Lokasi | Bentuk |
|---|---|
| `server/src/config/monitor.ts` | fallback literal pada `nineRouterApiKey` |
| `frontend/.../ConnectionPanel.tsx` | dipakai sebagai `placeholder` input API key |
| `server/scripts/quick-test-backtest.ts` | dipakai sebagai `apiKey` koneksi MT5 |

Nilai yang sama sudah masuk **git history** (dikonfirmasi via `git log -S`, muncul di commit `b74effe` dan sebelumnya).

### Akar Masalah
Pola "credential fallback" — nilai produksi ditulis sebagai default ketika env var kosong. Karena tidak ada yang gagal saat env var tidak ada, key tersebut ikut ter-commit tanpa terdeteksi. Catatan: scan gitleaks di CI (`.github/workflows/node-ci.yml`) **tidak menangkapnya** — kemungkinan karena entropi/prefix key ini tidak cocok dengan rule default maupun rule `generic-api-key` di `.gitleaks.toml`.

### Perbaikan (kode — sudah selesai)
- `monitor.ts` → `process.env.NINE_ROUTER_API_KEY || ""` (tanpa fallback).
- `ConnectionPanel.tsx` → placeholder generik.
- `quick-test-backtest.ts` → `process.env.MT5_MCP_API_KEY || ""`.

⚠️ **Nilai di git history tidak bisa dihapus dengan menghapus file.** Rotasi wajib.

---

## Action Items

| # | Action | Owner | Status |
|---|---|---|---|
| 1 | **Rotasi 9Router API key** dan set hanya via env var | @user | 🔴 **OPEN — release gate** |
| 2 | Hapus literal dari history (BFG/filter-repo) **setelah** rotasi | @forge | ⬜ Blocked by #1 |
| 3 | Perkuat rule gitleaks agar key 40-char tanpa prefix ikut tertangkap | @forge | ⬜ |
| 4 | Audit pola credential-fallback di seluruh config agent | @kira | ⬜ |
| 5 | Verifikasi cleanup di test cycle berikutnya | @vera | ⬜ |
| 6 | Device test: assert `reconnecting:true` selama jendela putus | @vera | ⬜ |
| 7 | Pisahkan `ws_status` (transport browser↔backend) dari `mt5_status` (sesi MT5) di client | @riku | ⬜ |
| 8 | Hapus `server/src/mt5-streamer.ts.bak` dari git tracking (masuk `tsconfig.include`) | @forge | ⬜ |

---

## Lesson

Sudah tercatat di `.kilo/LESSONS.md`:

1. Jangan menyimpan state koneksi di dua tempat tanpa satu sumber kebenaran eksplisit.
2. Jangan `addLog`/broadcast di blok yang dieksekusi tiap tick tanpa guard transisi.
3. Jangan men-set state breaker milik layer lain dari layer atas.
4. Jangan mengembalikan nilai "sehat" hardcoded di cabang error.
5. Jangan cache respons yang menggambarkan kondisi sementara.
6. **Jangan pernah menaruh credential sebagai fallback default** — env var kosong harus fail loud atau degrade, bukan diam-diam pakai key produksi.

---

*Post-mortem ini blameless. Angka TTD/TTR diisi berdasarkan bukti yang tersedia; yang tidak terukur ditandai eksplisit.*
