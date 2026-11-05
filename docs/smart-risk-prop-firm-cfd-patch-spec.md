# Smart Risk Prop-Firm CFD — Patch Spec & Adversarial Test Plan

Status: **FASE A PATCHED & VERIFIED (2026-10-23)** · Fase B–E belum dimulai
Date: 2026-10-23 · Author: KIRA · Baseline commit: `7470d58`
Verdict: `SMART_RISK_PROP_FIRM_CFD: BLOCKED` · `RELEASE: HOLD` · `REBUILD: HOLD`

### Status implementasi (terverifikasi KIRA, bukan laporan agen)

| Item | Status | Bukti |
|---|---|---|
| 0 · `server.py` emit tick value | ✅ | `py_compile` exit 0; `:510-511`, `:534-535`, `:971-972` |
| 1 · `MT5Symbol` + tick fields | ✅ | `mt5-mcp.service.ts` |
| 2 · `mt5-streamer` map field | ✅ | `mt5-streamer.ts` |
| 3 · sizing tick-economics | ✅ | `ai-trading-engine.service.ts:355` + reject `:363-366` |
| 4a · **guard pre-trade** `checkTradeAllowed` | ✅ | `100000` hilang (grep exit 1); fail-closed `:67-84` |
| 4b · monitoring `calculateRiskMetrics` | ✅ | throw saat tick spec hilang |
| caller live + backtest | ✅ | `trading-pipeline.service.ts`, `backtest.service.ts` |
| typecheck / diff --check | ✅ | `tsc --noEmit` exit 0 · `git diff --check` exit 0 |
| test targeted 4 simbol | ❌ belum | Volco: belum dibuat |
| runtime `tradeTickValue` aktual | ❌ belum | butuh MT5 aktif |

**Sisa `100000` setelah Fase A (terverifikasi KIRA):**

| Lokasi | Status | Catatan |
|---|---|---|
| `ai-trading-engine.service.ts` | ✅ bersih | tidak ada `100000` |
| `risk-manager.service.ts` | ✅ bersih | guard + monitoring pakai tick |
| `trade.service.ts:76` | ⚠️ wajar | helper lot-unit (standard lot = 100.000 unit) — bukan bug |
| `mt5-streamer.ts:372,398` | ⚠️ fallback | `trade_contract_size ?? contract_size ?? 100000` — wajar untuk forex, salah untuk simbol custom |
| `backtest.service.ts:405,411` | ⚠️ error path | default `tickSize: 0, tickValue: 0` saat fetch gagal — konsisten dengan fail-closed |
| `backtest.service.ts:1253,1794` | ❌ **belum** | **kalkulasi PnL masih `contractSize ?? 100000`** — salah untuk XAUUSD/BTCUSD, backtest CFD akan overstate PnL |

Yang terakhir (PnL backtest) **tidak memblokir** verifikasi Fase A (Vera menguji sizing + guard),
tapi harus ditutup sebelum fitur dipakai untuk evaluasi strategi CFD.

**Keputusan (default KIRA, menunggu konfirmasi Bang Vir):** PnL backtest dicatat
sebagai **item Fase F** — terpisah dari Fase A, dikerjakan setelah gate ini lulus.
Alasan: Fase A berisi jalur risiko yang memblokir order live; PnL backtest adalah
akurasi evaluasi, tapi tidak memblokir order. Mencampurnya akan membesar scope tanpa
manfaat keamanan, dan menunda verifikasi Vera yang sudah jalan.

**Yang belum bisa diverifikasi KIRA:** nilai `tradeTickValue` aktual dari broker
(butuh MT5 terkoneksi; `MetaTrader5` tidak terpasang di environment ini).

---

## 0. Koreksi Audit — false negative yang harus dibetulkan

Tim (Axis/Vera/Volco/Riku) menyimpulkan *"Smart Risk hanya memengaruhi
konfigurasi/backtest, belum menjadi execution guard MT5."* **Ini salah.**

Guard risiko **sudah terpasang di jalur live**, fail-closed, dan berhenti
sebelum order dikirim:

```
server/src/services/trading-pipeline.service.ts:1407-1428
```

```
1407  const riskCheck = await riskManagerService.checkTradeAllowed(
1408    userId, signal,
1410    { maxOpenPositions, maxDailyRisk, maxRiskPerTrade, smartRisk }
1416  );
1418  if (!riskCheck.allowed) { ...log... continue; }
1423  if (riskCheck.circuitBreaker) { await this.stopPipeline(...); }
```

Posisinya **benar** (sebelum sizing di `:1464`, sebelum `openOrder()` di
`:1571`), dan semantiknya **fail-closed**. Jadi klaim "bukan guard" adalah
false negative — dan itu berbahaya karena bisa memicu pembangunan ulang guard
yang sebenarnya sudah ada.

Yang **tidak** benar adalah kelengkapan guard itu. Tiga koreksi lain:

| Klaim tim | Kenyataan | Evidence |
|---|---|---|
| `globalDrawdownLimit` belum ada | Sudah dipakai sebagai pre-trade guard | `risk-manager.service.ts:137-146` (circuitBreaker) |
| HWM belum dipersist | HWM **sudah** dipersist di DB | `trade.service.ts:224-227`, `models/TradingAccount.ts:49` |
| Biaya eksekusi belum masuk sizing | Spread + slippage **sudah** masuk | `trading-pipeline.service.ts:1556-1567` |

Yang benar dari audit: guard-nya **salah urutan dan salah basis**, bukan tidak ada.

---

## 1. Arsitektur Guard Saat Ini (terverifikasi)

```
trading-pipeline.service.ts
  :876-882   daily state reset (currentDayStr — locale host)
  :883-889   peakEquity — IN-MEMORY ONLY
  :896-911   smartRisk.dailyLimits → dailyTradingBlocked
  :918       if (dailyTradingBlocked) return;      ← gate harian (tick only)
  :1407      checkTradeAllowed()                  ← PRE-TRADE GUARD (fail-closed)
  :1444-1460 drawdownRecovery / capitalPreservation → riskMultiplier (MODIFIER)
  :1464-1478 sizing (calculatePositionSize)
  :1511-1523 tick failure → fallback Market Order
  :1544-1547 validateOrderParams
  :1556-1567 signal.entry & signal.sl DIMUTASI (spread + slippage)
  :1571-1583 openOrder()  ← TANPA re-check setelahnya
```

`risk-manager.service.ts` (checkTradeAllowed):
```
:52-53   getAccountInfo + getPositions
:56-62   margin level < 150% → reject
:64-76   open risk capacity — contract size HARDCODED 100000
:97-103  duplicate symbol → reject
:105-129 daily PnL ≤ -cap → reject + circuitBreaker
:131-146 globalDrawdownLimit → reject + circuitBreaker
```

---

## 2. Defect Terverifikasi (path:line)

### P0 — wajib sebelum live prop-firm

**P0-1 · Sizing bukan tick-value based**
`ai-trading-engine.service.ts:339-382`
Input hanya `contractSize, volumeMin/Max/Step`. Rumus
`riskAmount / (slDistance * effectiveContractSize)` + konversi mata uang
hardcoded (JPY/CAD/GBP/EUR/AUD) tidak valid untuk CFD.
`tickValue` / `tickSize` **tidak ada di codebase** (grep 0 hits), dan
`MT5Symbol` (`mt5-mcp.service.ts`) tidak punya field itu — hanya
`tradeContractSize, point, spread, volumeMin/Max/Step`.

**Akar masalah:** server MCP (`server/mcp-mt5-server/server.py`) tidak pernah
mengirim `trade_tick_value` / `trade_tick_size` ke TypeScript. Karena itu
tim lama mengaproksimasi dengan `tradeContractSize` (100000) — inilah sumber
bug P0-3. Field tersedia di sisi Python, hanya tidak diekspos.

**P0-2 · Sizing terjadi SEBELUM penyesuaian harga eksekusi**
`trading-pipeline.service.ts:1464-1478` menghitung volume dari `signal.entry`.
Baru di `:1558-1561` `signal.entry` dimutasi (spread + slippage), dan `:1564-1567`
`signal.sl` di-offset spread. Akibatnya risk budget dihitung dari harga
**pra-biaya**, lalu dieksekusi pada harga **pasca-biaya**.

**P0-3 · Contract size hardcoded `100000`**
`risk-manager.service.ts:70` — `slPriceDiff * pos.volume * 100000`.
Untuk XAUUSD (100) selisih 1000x; BTCUSD (1) selisih 100000x.

**P0-4 · Baseline harian memakai timezone host**
`risk-manager.service.ts:299` — `new Date()` host-local (WIB, UTC+7) vs
`d.time` MT5 (UTC). Prop firm menghitung daily loss dari timezone broker.

**P0-5 · Guard tidak punya HWM; HWM DB tidak terpakai**
- `peakEquity` in-memory (`trading-pipeline.service.ts:138, 313, 883-889`) →
  restart = baseline hilang.
- `TradingAccount.highWaterMark` **ada dan dipersist** (`trade.service.ts:224-227`)
  tapi **tidak dipakai** guard. Guard memakai `(balance-equity)/balance`
  (`risk-manager.service.ts:132-134`) — floating-only, bukan trailing HWM.
- `risk.service.ts:18` memakai `initialBalance` sebagai baseline harian
  (komentar: *"simplified stub"*).

**P0-6 · `volumeMin` dapat melampaui risk budget**
`ai-trading-engine.service.ts:375-377` — `if (finalLot < volumeMin) finalLot = volumeMin`.
Tidak ada reject saat `riskAtVolumeMin > riskBudget`.

### P1

- **P1-1** Correlation fail-open — `risk-manager.service.ts:192` (`catch → allowed: true`). Keputusan desain, bukan bug.
- **P1-2** `riskReductionMultiplier` tanpa validasi `0 < x <= 1` — `trading-pipeline.service.ts:1448-1460`.
- **P1-3** Tick gagal → fallback Market Order — `trading-pipeline.service.ts:1521-1523`.
- **P1-4** Tidak ada re-check setelah `openOrder()` — `:1571-1583`.
- **P1-5** Leverage fallback `500` — `BacktestForm.tsx:277`.
- **P1-6** UI tidak menjelaskan timezone, drawdown mode, biaya — `BacktestForm.tsx:281-302`.

---

## 3. Scope Patch (minimal, urut)

### Fase A — Core risk math (backend)

> **Revisi 2026-10-23 (KIRA):** item 0 ditambahkan setelah verifikasi
> `server/mcp-mt5-server/server.py`. MCP **tidak** mengembalikan tick value sama
> sekali — jadi item 1–2 tidak bisa dijalankan tanpa item 0.

**0. `server/mcp-mt5-server/server.py` — emit tick value (BARU, prasyarat)**
Tiga payload symbol (`mt5_marketwatch_symbols` :500-517, `mt5_symbol_info`
:523-536, `symbolInfo` di `mt5_order_validate` :962-971) hanya memuat
`point, digits, tradeContractSize, volumeMin/Max/Step, spread, visible`.
Tambahkan ke ketiganya:
```python
"tradeTickValue": info.trade_tick_value,
"tradeTickSize":  info.trade_tick_size,
```
Nama atribut Python yang benar adalah **`trade_tick_value` / `trade_tick_size`**
(bukan `tick_value` / `tick_size`) — terverifikasi dari dokumentasi resmi
MT5 `symbol_info`. Nilai contoh EURJPY: `trade_tick_value=0.8977…`,
`trade_tick_size=0.001`, `trade_contract_size=100000.0`.

1. `mt5-mcp.service.ts` — tambah `tradeTickValue`, `tradeTickSize` ke `MT5Symbol`.
2. `mt5-streamer.ts:364-376` — map `trade_tick_value`, `trade_tick_size` dari MCP.
3. `ai-trading-engine.service.ts:339-382` — sizing berbasis tick value:
   ```
   riskPerLot  = (slDistance / tradeTickSize) * tradeTickValue   ← jumlah tick × nilai per tick
   rawLot      = riskAmount / riskPerLot
   finalLot    = floor(rawLot / volumeStep) * volumeStep
   ```
   **Koreksi rumus (Volco, 2026-10-23):** `slDistance` dalam satuan **harga**,
   bukan tick — jadi harus dibagi `tradeTickSize` dulu. Rumus `slDistance * tradeTickValue`
   salah (off by `1/tickSize`). Rumus di atas sudah terverifikasi di kode
   (`ai-trading-engine.service.ts:355`).
   **hapus** konversi mata uang hardcoded (JPY/CAD/GBP/EUR/AUD);
   **hapus** `MAX_LOT_CAP = 1.0` (bertentangan dengan risk-based sizing);
   reject (return `0`) bila `riskAtVolumeMin > riskBudget` — jangan paksa naik ke `volumeMin`;
   reject bila `tradeTickValue`/`tradeTickSize` ≤ 0 atau tidak finite.
4. `risk-manager.service.ts` — **dua jalur** harus pakai basis tick, bukan `100000`:

   **4a. `checkTradeAllowed` (± baris 70) — INI YANG PENTING.**
   Ini guard pre-trade yang sebenarnya. Masih ada:
   ```ts
   const posRiskUsd = slPriceDiff * pos.volume * 100000;   // ← belum diperbaiki
   ```
   Ganti dengan basis tick. Butuh `getSymbolInfo(pos.symbol)` per posisi
   (pola sama seperti `symbolCache` di `calculateRiskMetrics`). Missing tick
   spec → `allowed: false` (fail-closed), jangan fallback `100000`.

   **4b. `calculateRiskMetrics` (± baris 214-237) — sudah diperbaiki Volco.**
   Sekarang melempar error saat tick spec hilang. ✅

   **Status per 2026-10-23:** 4b ✅ · **4a ❌ belum** — `checkTradeAllowed:70`
   masih `100000`. Ini gap yang harus ditutup sebelum Vera menguji P0-4.

### Fase B — Ordering & persistence
5. `trading-pipeline.service.ts` — **pindahkan sizing SETELAH** mutasi harga (`:1556-1567`), lalu **re-check risk** tepat sebelum `openOrder()`.
6. `risk-manager.service.ts:289-326` — baseline UTC (prop-firm tz eksplisit), bukan host-local.
7. `risk-manager.service.ts:131-146` — drawdown berbasis `TradingAccount.highWaterMark` (sudah dipersist), bukan `peakEquity` in-memory.

### Fase C — Fail-closed
8. `trading-pipeline.service.ts:1511-1523` — tick gagal → **reject**, bukan fallback.
9. `trading-pipeline.service.ts:1448-1460` — validasi `0 < riskReductionMultiplier <= 1`; invalid → reject pipeline.
10. `risk-manager.service.ts:192` — **fail-closed untuk path CFD/prop firm** (keputusan Bang Vir, 2026-10-23): `getPositions()` gagal → `allowed: false` + `circuitBreaker`. Tetap **advisory** untuk spot forex. Implementasi: flag `propFirmMode` di pipeline config memilih cabang; cabang advisory hanya boleh dipakai saat `propFirmMode === false` dan harus log warning eksplisit.

### Fase D — Prop-firm rule layer + UI
11. Blok aturan prop firm baru di `risk-manager.service.ts`: challenge phase, daily loss limit, max DD, consistency rule.
12. Zod schema (`backtest.validator.ts:31-41`) — tambah `propFirmMode` + field prop firm + batas validasi (`NaN`, negatif, multiplier >1, DD >100%). `propFirmMode` wajib explisit — default `false`, dan saat `false` semua aturan prop firm tidak boleh menghentikan order.
13. `BacktestForm.tsx` — ekspos timezone, drawdown mode (static/trailing), biaya; **hapus label** "Prop-Firm Safe" sampai gate lulus.

### Fase E — Bukti
14. Re-check setelah `openOrder()` pada volume/price aktual (`trading-pipeline.service.ts:1571-1583`).

---

## 4. Matriks Adversarial Test (untuk VERA)

Format wajib: `CASE / INPUT / EXPECTED / ACTUAL / TEST / EXIT CODE`

**P0 matrix**
```
XAUUSD            contract 100   → risk = slDist*100*vol
US30 / NAS100     contract 10
BTCUSD            contract 1
USDJPY            quote conversion + tickValue
volumeMin > budget      → allowed:false (bukan naik ke volumeMin)
tickValue missing/0     → allowed:false
tickSize missing/0      → allowed:false
SL missing/invalid      → allowed:false
entry ≤ 0               → allowed:false
spread spike            → worst-case loss tetap ≤ budget
adverse slippage        → worst-case loss tetap ≤ budget
commission + swap       → worst-case loss tetap ≤ budget
floating loss at limit  → circuitBreaker + stopPipeline
timezone reset          → baseline ikut tz prop firm, bukan host
restart recovery         → HWM & baseline tidak reset
trailing DD after profit→ HWM naik, DD dihitung dari HWM baru
MT5 disconnect (pre)    → reject, bukan fallback
getPositions fail       → allowed:false (bukan fail-open)
low margin (<150%)      → reject
leverage missing        → reject (bukan fallback 500)
multiplier > 1          → reject config
DD > 100% / NaN / neg  → reject config
```

**Boundary wajib** — tepat di limit, satu tick melewati limit.

**Non-regression**
```
existing vitest suite: server/package.json:12 → vitest run --pool=forks --max-workers=1
agent-consensus-routing-e2e.test.ts (mock checkTradeAllowed) — jangan sampai rusak
```

---

## 5. Keputusan (dicatat)

### Correlation fail-open — `risk-manager.service.ts:192`

**Keputusan Bang Vir (2026-10-23):** hard block untuk path CFD/prop firm,
advisory untuk spot forex.

Alasan: fail-open di jalur yang mengirim order nyata berarti kegagalan data
= eksposur tak terukur. Untuk akun prop firm, eksposur tak terukur langsung
melanggar aturan challenge. Untuk spot forex tanpa aturan challenge, advisory
masih dapat diterima.

Implementasi: flag `propFirmMode` di pipeline config. Cabang advisory hanya
aktif saat `propFirmMode === false`, dan tetap menulis warning eksplisit ke
log — sehingga jejak audit tidak hilang.

---

## 6. Gate

```
patch hard guard → adversarial tests → lint/typecheck/regression
  → Vera approval → Riku QC → rebuild
```

Sampai gate lulus, fitur hanya boleh diposisikan sebagai
**Advisory / Simulated Risk Overlay** — bukan prop-firm compliance guard.

---

*Dokumen ini spec, bukan patch. Tidak ada file source yang diubah.*
