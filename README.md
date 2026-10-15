# Hunter Trades Journal

> Trading journal + AI trading engine dengan integrasi **MetaTrader 5**.
> Dijalankan sebagai aplikasi desktop Windows: user install sekali, klik icon, semua service jalan.

Repositori: `journal-trade` · Versi saat ini: **1.2.0** · Nama aplikasi: **Hunter Trades**

---

## 👋 Untuk User

> **Apa ini?** Hunter Trades Journal adalah aplikasi desktop Windows yang membantu Anda mencatat
> trade, menganalisis performa, dan menjalankan strategi trading otomatis berbasis AI — semua
> dalam satu aplikasi. Anda cukup install sekali, lalu semua komponen berjalan otomatis.

### Yang Anda Butuhkan

Sebelum install, pastikan komputer Anda memenuhi syarat berikut:

| Kebutuhan | Keterangan |
|---|---|
| **Windows** | Windows 10 atau 11 (64-bit). |
| **RAM** | Minimal 8 GB (16 GB disarankan agar AI dan database berjalan lancar). |
| **MongoDB** | Anda butuh akun database gratis — bisa [MongoDB Atlas](https://www.mongodb.com/atlas) (cloud) atau install MongoDB Community Server secara lokal. Aplikasi akan meminta *connection string* saat setup pertama kali. |
| **Akun Discord** | Diperlukan untuk login ke aplikasi. Pastikan Anda sudah bergabung dengan server Discord Hunter Trades. |
| **MetaTrader 5 (MT5)** | Wajib jika Anda ingin fitur eksekusi trade otomatis. Download dari [MetaTrader 5](https://www.metatrader5.com/). Tanpa MT5, aplikasi tetap bisa dipakai untuk jurnal dan analisis. |

> **Belum punya MongoDB atau MT5?** Anda tetap bisa install dan mencatat trade. Aplikasi akan
> memberitahu fitur mana yang nonaktif sampai kredensial diisi.

---

### Install Aplikasi (Produksi)

Langkah-langkah ini untuk **pengguna biasa** yang ingin memakai aplikasi — bukan untuk developer.

1. **Unduh installer**
   Buka halaman [GitHub Releases](https://github.com/virgoarya/journal-trade/releases) dan unduh
   file bernama **`Hunter Trades Setup 1.2.0.exe`**.

2. **Jalankan installer**
   - Klik dua kali file `.exe` yang sudah diunduh.
   - Jika Windows menampilkan peringatan "Windows protected your PC", klik **More info**
     lalu **Run anyway** (ini normal karena aplikasi tidak ditandatangani dengan sertifikat komersial).
   - Pilih folder instalasi (default: `C:\Users\<NamaAnda>\AppData\Local\Hunter Trades`) lalu klik **Install**.
   - Tunggu sampai proses selesai (biasanya 1–2 menit), lalu klik **Finish**.

3. **Jalankan aplikasi**
   - Klik icon **Hunter Trades** di Desktop atau Start Menu.
   - Saat pertama kali dijalankan, aplikasi akan membuka jendela **Setup Configuration** —
     lihat bagian [Setelah Install](#setelah-install) untuk detailnya.

> **Butuh bantuan lebih lanjut?** Lihat panduan lengkap di
> [`docs/USER_GUIDE_MT5.md`](docs/USER_GUIDE_MT5.md) yang mencakup screenshot langkah demi
> langkah, cara menghubungkan MT5, dan troubleshooting.

---

### Setelah Install

Saat pertama kali menjalankan aplikasi, ini yang akan terjadi:

#### 1. Jendela Setup Configuration

Karena konfigurasi belum ada, aplikasi akan menampilkan jendela **Setup Configuration**.
Isi field-field berikut:

| Field | Contoh | Keterangan |
|---|---|---|
| **Database URL** | `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net` | Connection string MongoDB dari Atlas atau lokal. |
| **Discord Client ID** | `1234567890123456789` | Dari [Discord Developer Portal](https://discord.com/developers/applications). |
| **Discord Client Secret** | `abcdefghijklmnopqrstuvwxyz` | Dari Discord Developer Portal. |
| **Discord Guild ID** | `9876543210987654321` | ID server Discord Hunter Trades. |
| **Encryption Key** | `kata-sandi-acak-min-32-karakter` | Minimal 32 karakter. Ini kunci untuk mengenkripsi kredensial MT5 Anda. |

Setelah mengisi semua field, klik **Simpan**. Konfigurasi akan disimpan di folder
`%APPDATA%\hunter-trades-desktop\` dan dipakai otomatis setiap kali aplikasi dijalankan.

#### 2. Splash Screen

Setelah konfigurasi tersimpan, Anda akan melihat **splash screen** (layar loading).
Selama fase ini, aplikasi menjalankan:

- **Backend server** — mengelola data dan API
- **Frontend** — antarmuka aplikasi
- **9Router** — gateway untuk model AI (Claude, Gemini, dll.)

Proses ini memakan waktu **10–60 detik** tergantung kecepatan komputer Anda. Anda akan melihat
indikator progres.

#### 3. Jendela Utama

Setelah splash selesai, jendela utama akan terbuka dan Anda dapat mulai menggunakan aplikasi:

- **Dashboard** — ringkasan performa trading Anda
- **Log Trade** — catat trade baru
- **Analytics** — analisis mendalam (win rate, profit factor, R-multiple)
- **AI Trading** — jalankan pipeline analisis AI
- **Macro Terminal** — monitoring indikator makro ekonomi

#### 4. System Tray

Aplikasi berjalan di **system tray** (area di dekat jam di taskbar Windows). Ikon Hunter Trades
akan tetap ada di sana. Klik kanan ikon tray untuk:

- **Buka** — tampilkan jendela utama
- **Keluar** — tutup aplikasi sepenuhnya

> **Tips:** Jika aplikasi tidak sengaja tertutup, jendela utama bisa dibuka kembali lewat ikon tray.

---

## 🚀 Quick Start

### Untuk user (install aplikasi production)

1. Unduh **`Hunter Trades Setup 1.2.0.exe`** dari halaman GitHub Releases.
2. Jalankan installer, pilih folder instalasi, selesaikan wizard.
3. Klik icon **Hunter Trades** di Desktop atau Start Menu.
4. **Hanya saat pertama kali:** jendela *Setup Configuration* muncul (karena
   `server.env` belum ada). Isi kredensial yang diminta, lalu simpan. Konfigurasi ditulis ke
   `%APPDATA%\hunter-trades-desktop\server.env` dan dipakai backend pada setiap start
   berikutnya.
5. Splash screen muncul — backend, frontend, dan 9Router start otomatis (10–60 detik).
6. Aplikasi terbuka. Verifikasi cepat di terminal:

```bash
curl http://localhost:5000/health   # -> {"status":"OK","timestamp":"..."}
curl http://localhost:3000          # -> halaman Hunter Trades
```

Panduan lengkap (install EXE + koneksi MT5 + troubleshooting) ada di
[`docs/USER_GUIDE_MT5.md`](docs/USER_GUIDE_MT5.md).

### Untuk developer

```bash
git clone https://github.com/virgoarya/journal-trade.git
cd journal-trade

cp server/.env.example server/.env    # isi kredensial — lihat Prerequisites
npm --prefix server install
npm --prefix frontend install
npm --prefix desktop install

# Terminal 1 — backend
npm --prefix server run dev           # http://localhost:5000

# Terminal 2 — frontend
npm --prefix frontend run dev         # http://localhost:3000
```

---

## 📋 Deskripsi Project

**Hunter Trades Journal** adalah platform trading untuk trader profesional yang menggabungkan
tiga hal dalam satu aplikasi desktop:

1. **Trading journal** — pencatatan trade, analitik performa (win rate, profit factor, R-multiple,
   expectancy), review pasca-trade berbasis AI, dan playbook strategi.
2. **AI trading engine** — pipeline otomatis *Signal → Analysis → Review → Execute* di atas
   metodologi SMC / ICT / MSNR, dengan **LLM Consensus Voting** multi-model (threshold 70%)
   sebagai gerbang sebelum order dikirim ke broker.
3. **Macro terminal** — monitoring rezim makro: yield curve, liquidity flow (ON RRP via FRED),
   PMI, COT, geo-risk, dan Quant Lab.

Semua berjalan lokal. Data pasar diambil dari terminal MT5 user sendiri melalui
**Native MCP Server** bawaan MetaTrader 5 (port `22346`) — password broker tidak pernah
dikirim ke server mana pun.

### Prinsip desain yang mengikat

- **Satu sumber kebenaran per state.** Jangan simpan state koneksi di dua tempat tanpa sumber
  otoritatif — ini akar masalah MT5 auto-resume yang macet.
- **Fail loud, bukan degrade diam-diam.** Env var yang kosong harus gagal jelas — bukan memakai
  nilai produksi sebagai fallback.
- **Installer tidak pernah membawa secret.** Bundle hanya berisi `.env.example`; gate preflight
  menolak build yang membocorkan kredensial.

---

## 🛠️ Tech Stack

| Lapisan | Teknologi |
|---|---|
| **Desktop shell** | Electron `35.7.5` + `electron-builder 26` + `electron-updater 6.8.9` (orchestrator proses, system tray, splash, OTA patch) |
| **Frontend** | Next.js `16.2.1` (App Router, output `standalone`, build `--webpack`), React `19.2.4`, Tailwind CSS v4, Recharts, Framer Motion, Three.js |
| **Backend** | Node.js + Express `5.2.1`, TypeScript, WebSocket (`ws`), Mongoose `9.3.3` / MongoDB `7.1.1`, Better Auth `1.5.6` (Discord OAuth), Zod `4.3.6`, Pino, node-cron |
| **AI / LLM** | 9Router gateway (`http://127.0.0.1:20128/v1`) + Vercel AI SDK — Claude, Gemini, Groq, DeepSeek, Mistral, Nemotron |
| **Integrasi MT5** | Native MetaTrader 5 MCP Server (`http://127.0.0.1:22346/mcp`) via `@modelcontextprotocol/sdk` + `SSEClientTransport`; fallback eksekusi order via Python `server/trade_api.py` |
| **Pembayaran** | Midtrans Snap (`midtrans-client`) |
| **Testing** | Vitest `4.1.9` — server memakai `--pool=forks --max-workers=1` karena native binding MT5 |
| **CI** | GitHub Actions — `.github/workflows/node-ci.yml` |

**Design system:** *Terminal Noir* — background gelap (`#121212`, `#1E1E1E`) dengan aksen gold
(`#D4AF37`), micro-animation pada hover.

---

## 📦 Prerequisites

### Untuk development

| Kebutuhan | Versi | Catatan |
|---|---|---|
| **Node.js** | `>= 20` (ditegakkan di `engines`) | Wajib. |
| **npm** | bundled dengan Node | Lockfile `package-lock.json` dipakai agar build reproducible. |
| **MongoDB** | 7.x | Lokal (`mongodb://localhost:27017`) atau MongoDB Atlas. |
| **Python** | 3.10+ | Hanya untuk `server/fetch_rates.py` & `server/trade_api.py` (fallback eksekusi order). Bridge Python legacy sudah dihapus. |
| **MetaTrader 5** | build terbaru dengan tab **MCP** di Options | Diperlukan untuk fitur trading. Tanpa MT5, UI tetap jalan dengan status "MT5 not connected". |

### Khusus build installer Windows

- **Windows** — `desktop/buildHooks/buildApp.js` memakai `robocopy` dan `taskkill` (Windows-only).
- **`.npmrc`** di `server/` — agar `npm ci` menghormati `allowScripts` (postinstall 9Router).

> **Catatan:** `Dockerfile` di root hanya membangun **backend server**. Tidak ada
> `docker-compose.yml` — runtime desktop berjalan native di Windows, bukan di container.

---

## ⚙️ Installation & Setup

### 1. Konfigurasi environment

Backend membaca `.env` dari beberapa kandidat path (lihat `server/src/config/env.ts`), jadi
letakkan di `server/.env` untuk development:

```bash
cp server/.env.example server/.env
```

> **Di aplikasi production**, konfigurasi tidak diambil dari `server/.env` — installer sengaja
> tidak membawanya. Sebagai gantinya, **first-run setup wizard** menulis
> `%APPDATA%\hunter-trades-desktop\server.env`, dan `desktop/main.js` memuat file itu lebih
> dulu sebelum fallback ke `server/.env` (berguna saat menjalankan `npm --prefix desktop start`
> di mode dev). Lihat [`docs/USER_GUIDE_MT5.md`](docs/USER_GUIDE_MT5.md) untuk daftar field wizard.

Variabel **wajib** — backend gagal start (validasi Zod) kalau kosong:

| Variabel | Keterangan |
|---|---|
| `DATABASE_URL` | Connection string MongoDB. |
| `BETTER_AUTH_SECRET` | Secret Better Auth. Generate: `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | `http://localhost:5000` untuk instalasi lokal. |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Dari [Discord Developer Portal](https://discord.com/developers/applications). |
| `DISCORD_GUILD_ID` | ID server Discord Hunter Trades — dipakai verifikasi keanggotaan. |
| `FRONTEND_URL` | `http://localhost:3000`. |
| `ENCRYPTION_KEY` | **Wajib di production**, minimal 32 karakter. Enkripsi kredensial MT5 at-rest. |

Variabel **opsional** (fitur terkait nonaktif tanpa ini): `GEMINI_API_KEY`, `GROQ_API_KEY`,
`FRED_API_KEY`, `TE_API_KEY`, `ALPHA_VANTAGE_API_KEY`, `TWELVE_DATA_API_KEY`, `FINNHUB_API_KEY`,
`NINE_ROUTER_URL`, `NINE_ROUTER_API_KEY`, `MT5_MCP_URL`, `MT5_MCP_API_KEY`.

> ⚠️ **Jangan pernah commit `.env`.** Semua varian `.env` sudah masuk `.gitignore`, dan
> `scripts/preflight-release.mjs` memblokir release yang membawa kredensial.

### 2. Install dependencies

```bash
npm --prefix server install
npm --prefix frontend install
npm --prefix desktop install
```

### 3. Jalankan

**Mode development (dua terminal):**

```bash
npm --prefix server run dev      # tsx watch src/index.ts  -> :5000
npm --prefix frontend run dev    # next dev                -> :3000
```

**Mode desktop (Electron sebagai orchestrator):**

```bash
npm --prefix desktop start       # Electron spawn 9Router + backend + frontend sendiri
```

---

## 🚀 Development Workflow

### Perintah tingkat root (monorepo)

Root `package.json` hanya delegator tipis — tidak ada aplikasi di root.

| Perintah | Fungsi |
|---|---|
| `npm run build` | Build server + frontend |
| `npm run build:server` | `tsc` di `server/` → `server/dist` |
| `npm run build:frontend` | `next build` → `frontend/.next/standalone` |
| `npm run build:desktop` | Rakit bundle desktop (`desktop/dist-app/win-unpacked`) |
| `npm run build:all` | Build ketiganya |
| `npm test` | Test server + frontend |
| `npm run test:server` | Vitest server (`--pool=forks --max-workers=1`) |
| `npm run test:frontend` | Vitest frontend |
| `npm run lint` | ESLint frontend |
| `npm run typecheck` | TypeScript check kedua workspace |
| `npm run preflight` | Gate release: artefak build, staleness, kebocoran secret, pin dependency |
| `npm run preflight:bundle` | Sama, plus verifikasi bundle hasil packing |
| `npm run check:pins` | Pastikan dependency desktop dipin eksak |
| `npm run build:patch` | Buat OTA patch (`update/patch.zip` + `update/version.json`) |
| `npm run release` | Build lengkap → preflight bundle → OTA patch |

### Siklus kerja harian

1. **Baca konteks project lebih dulu** — `AGENTS.md`, `.kilo/MEMORY.md` (arsitektur & tech stack),
   `.kilo/LESSONS.md` (jangan ulangi bug lama), `.kilo/RULES.md` (standar kode & workflow).
2. Buat branch fitur dari `main`: `git checkout -b feat/nama-fitur`.
3. Kerjakan perubahan, lalu jalankan gate lokal:
   ```bash
   npm run typecheck
   npm test
   npm run lint
   ```
4. Commit dengan pesan deskriptif, push, buka Pull Request.
5. Untuk perubahan besar (arsitektur, schema, endpoint baru, > 3 file): **buat plan dan minta
   persetujuan lebih dulu** — jangan langsung tulis kode.
6. Setelah fix bug atau menemukan insight penting: **catat lesson baru** di `.kilo/LESSONS.md`.
   Kalau ada perubahan arsitektur signifikan: update `.kilo/MEMORY.md`.

### Build EXE production (Windows)

```bash
npm run build:server                 # 1. TypeScript -> server/dist
npm run build:frontend               # 2. Next.js -> .next/standalone
npm --prefix desktop run build:win   # 3. Rakit dist-app/win-unpacked
npm run preflight:bundle             # 4. Gate: pastikan tidak ada secret & artefak lengkap
npm run build:patch                  # 5. OTA patch -> update/patch.zip + version.json
```

Hasil: `desktop/dist-app/win-unpacked/Hunter Trades.exe` beserta `resources/{app,server,frontend}`.
Installer NSIS dibuat oleh `electron-builder` ke `desktop/dist-build/`.

**Yang diverifikasi otomatis oleh `buildApp.js`:**

- `Hunter Trades.exe` ada
- `resources/app/main.js` (entry Electron)
- `resources/server/dist/index.js` + `node_modules/express` + `.bin/9router.cmd`
- `resources/frontend/server.js` + `node_modules/next` + `.next/static/css`
- `resources/server/.env.example` ada — **dan tidak ada `.env` asli** di bundle
  (build langsung gagal kalau ada)

### Version bump & release

Versi harus konsisten di **empat** `package.json` (root, `server/`, `frontend/`, `desktop/`).
`desktop/package.json` adalah sumber versi yang dibaca `buildPatch.js` dan dibandingkan
`electron-updater` saat runtime.

```bash
npm run check:pins               # dependency desktop harus versi eksak (bukan ^ atau ~)
npm run preflight:bundle
npm run build:patch
git add update/ && git commit -m "release: v1.1.1" && git push
```

`update/version.json` + `update/patch.zip` di branch `main` adalah sumber OTA:
`https://raw.githubusercontent.com/virgoarya/journal-trade/main/update/version.json`

---

## 🤝 Contributing Guidelines

### Sebelum mulai

1. Baca `AGENTS.md` dan tiga file di `.kilo/` (MEMORY, LESSONS, RULES).
2. Cek apakah fungsi/komponen serupa sudah ada — jangan duplikasi.
3. Untuk perubahan kompleks, ajukan plan dan tunggu persetujuan.

### Standar kode

- **TypeScript strict.** Type eksplisit; hindari `any` kecuali benar-benar tidak ada pilihan.
- **Error handling wajib.** Setiap fungsi async harus punya `try/catch` atau propagasi error jelas.
- **Pertahankan komentar yang ada** — jangan hapus docstring yang tidak berkaitan dengan perubahan.
- **Jangan tinggalkan debug log.** Tidak ada `console.log` / `print` sisa debugging.
- **Jangan simpan credential sebagai fallback default.** Env var kosong harus fail loud.
- **Jangan commit file debug sekali pakai** ke root repo — taruh di `scripts/` atau hapus setelah selesai.
- **UI mengikuti Terminal Noir.** Dark background + gold accent; font Google Fonts (Inter/Roboto/Outfit);
  micro-animation pada hover.

### Gate sebelum PR

```bash
npm run typecheck && npm test && npm run lint
npm run preflight          # wajib untuk perubahan yang menyentuh build/release
```

### Checklist PR

- [ ] `npx tsc --noEmit` bersih di server dan frontend
- [ ] Unit test lulus (Vitest, kedua workspace)
- [ ] ESLint tanpa error
- [ ] Tidak ada hardcoded secret
- [ ] Tidak ada `console.log` debug
- [ ] Dokumentasi diperbarui kalau ada perubahan API / arsitektur / alur user
- [ ] Entri `CHANGELOG.md` ditambahkan untuk perubahan yang terlihat user
- [ ] `.kilo/LESSONS.md` diperbarui kalau PR ini memperbaiki bug

### Gaya dokumentasi

Dokumentasi ditulis dari sudut pandang **orang yang baru pertama kali melihat project ini**:
letakkan Quick Start di atas, detail teknis di bawah. Setiap contoh kode harus bisa
di-copy-paste dan langsung jalan. Selalu jelaskan **"kenapa"**, bukan hanya **"bagaimana"**.
Seluruh komunikasi dengan user memakai **Bahasa Indonesia**.

---

## 🏗️ Architecture Overview

### Struktur repositori

```
D:\Journal Trade\
├── server/            Backend Express 5 + TypeScript (port 5000)
│   ├── src/
│   │   ├── index.ts           Entry: Express + WebSocket + health check
│   │   ├── config/env.ts      Validasi env (Zod) — sumber schema konfigurasi
│   │   ├── models/            25 model Mongoose
│   │   ├── routes/            25 file route (prefix /api/v1/)
│   │   ├── services/          51+ service (pipeline, risk, LLM consensus, MT5, macro)
│   │   ├── strategies/        Modul strategi: SMC, ICT, MSNR, ATR, SMT, IPDA
│   │   ├── cron/              Job terjadwal (auto-backtest)
│   │   └── agents/            System monitor agent
│   ├── dist/                  Output build (yang ikut ke bundle)
│   ├── .env.example           Template konfigurasi yang dikirim ke user
│   ├── fetch_rates.py         Helper Python (data rates)
│   └── trade_api.py           Fallback eksekusi order via MetaTrader5 Python API
│
├── frontend/          Next.js 16 App Router (port 3000, output standalone)
│   └── src/
│       ├── app/(dashboard)/   dashboard · ai-trading · ai-review · macro-terminal ·
│       │                      playbook · analytics · log-trade · settings · onboarding
│       ├── components/        macro-terminal · trade · playbook · ai-review ·
│       │                      analytics · dashboard · layout · root
│       └── services/          13 service client (ai-trading, journal, mt5, backtest, …)
│
├── desktop/           Electron orchestrator
│   ├── main.js                Spawn 9Router + backend + frontend, window, tray, OTA updater,
│   │                          first-run setup wizard (menulis server.env ke userData)
│   ├── setup.html             Jendela Setup Configuration (first run)
│   ├── preload.js             Bridge IPC aman (contextIsolation aktif)
│   ├── preload-setup.js       Bridge IPC khusus wizard setup
│   ├── buildHooks/
│   │   ├── buildApp.js        Rakit dist-app/win-unpacked + verifikasi integritas
│   │   ├── buildPatch.js      Buat OTA patch.zip + version.json + checksum SHA-256
│   │   └── *.js               afterPack · copyResources · cleanProcesses
│   ├── assets/                icon.ico · icon.png · splash.html
│   └── electron-builder.yml   Konfigurasi NSIS installer
│
├── docs/              Dokumentasi
│   ├── USER_GUIDE_MT5.md      Panduan user: install EXE + koneksi MT5
│   ├── API_REFERENCE.md       Referensi endpoint /api/v1/
│   ├── infrastructure.md      Arsitektur infrastruktur & deployment
│   ├── workflow.md            Spesifikasi multi-agent pipeline (Signal→Trade)
│   ├── AI_PROVIDER_STRATEGY.md
│   ├── payment-token-system-design.md
│   ├── test-plan.md · test-plan-swing-atr-filter.md
│   ├── post-mortem-2026-10-05-mt5-9router.md
│   └── DAILY_BRIEFING_PROTOCOL.md
│
├── scripts/           Tooling release: preflight-release.mjs · check-desktop-pins.mjs ·
│                      bump-version.js · check-version.js · scan-*.js
├── update/            Distribusi OTA: patch.zip + version.json (dibaca dari GitHub raw)
├── web/               PoC halaman login standalone (Terminal Noir, tanpa build step)
├── mobile/            PoC klien Flutter (login page, auth masih mock)
├── .kilo/             Konteks agent: MEMORY.md · LESSONS.md · RULES.md · skills/ · plans/
├── .github/workflows/ CI: typecheck + build + test (MongoDB & Redis service container)
└── .env.example       Template environment lengkap
```

### Topologi runtime

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Hunter Trades.exe  (Electron 35)                  │
│                                                                      │
│  ┌────────────────┐   ┌──────────────────┐   ┌───────────────────┐   │
│  │ Splash + Tray  │   │  BrowserWindow   │   │   OTA Updater     │   │
│  │ single-instance│   │  -> :3000        │   │  GitHub raw +     │   │
│  │ restart guard  │   │  contextIsolated │   │  auto-rollback    │   │
│  └────────────────┘   └──────────────────┘   └───────────────────┘   │
│                                                                      │
│  Orchestrator spawn 3 child process — idempotent (skip kalau port    │
│  sudah merespons) dan kill leftover process sebelum start:           │
│                                                                      │
│   ┌──────────────┐   ┌───────────────┐   ┌────────────────────────┐  │
│   │ 9Router      │   │ Backend       │   │ Frontend               │  │
│   │ :20128       │   │ :5000         │   │ :3000                  │  │
│   │ LLM gateway  │   │ Express + WS  │   │ Next.js standalone     │  │
│   └──────┬───────┘   └───────┬───────┘   └────────────────────────┘  │
└──────────┼───────────────────┼───────────────────────────────────────┘
           │                   │
           │ LLM consensus     │ MCP over HTTP (SSE)
           │ (Claude, Gemini,  │
           │  Groq, DeepSeek,  │
           │  Mistral,         ▼
           │  Nemotron)   ┌─────────────────────────────┐
           │              │ MetaTrader 5 Terminal       │
           │              │ Native MCP :22346           │
           │              │ (akun & data milik user)    │
           │              └─────────────────────────────┘
           │                   │
           │                   │ Mongoose
           │                   ▼
           │              ┌─────────────┐
           └─────────────►│  MongoDB    │
                          │  (lokal /   │
                          │   Atlas)    │
                          └─────────────┘
```

### Port yang dipakai

| Port | Service | Catatan |
|---|---|---|
| `3000` | Frontend Next.js | Bisa diakses dari browser desktop & mobile di jaringan yang sama. |
| `5000` | Backend Express + WebSocket | `GET /health` untuk health check. |
| `20128` | 9Router LLM gateway | Dijalankan `--tray --skip-update`; auto-free-model. |
| `22346` | MT5 Native MCP | Milik terminal MetaTrader 5, bukan aplikasi kita. |

Electron menjalankan `killProcessOnPort()` untuk 5000 dan 3000 sebelum start, jadi leftover
process dari sesi sebelumnya tidak menyebabkan port collision.

### Alur pipeline AI trading

Spesifikasi lengkap: [`docs/workflow.md`](docs/workflow.md).

```
STAGE 1  SIGNAL GENERATION      @analyst-trading
         Scan multi-timeframe (M1→D1) → SMC (OB, liquidity sweep),
         ICT (FVG, OTE), MSNR (RBS/SBR/QML) → kandidat TradingSignal
                    │
                    ▼
STAGE 2  MULTI-METHODOLOGY      @analyst-trading
         ConfluenceEngine → bobot per metodologi → Confluence Score
         + validasi spread & RRR minimal 1:1.5
                    │
                    ▼
STAGE 3  RISK & CONSENSUS       @qa-trading / @volco
         margin level ≥ 150% · max open positions · 1 posisi per simbol ·
         daily loss breaker · korelasi mata uang ·
         LLM Consensus Voting ≥ 70% (multi-provider paralel + fallback)
                    │
                    ▼
STAGE 4  EXECUTION              @ceo-trading / @axis
         Position sizing (risk % × balance ÷ SL distance) →
         market vs pending order → MT5 MCP (fallback: trade_api.py) →
         log ke AITradeLog → trailing stop & break-even monitor
```

**Resiliensi:** fallback model per LLM provider, fallback eksekusi ke Python API,
circuit breaker daily loss, dan lock per-user & per-symbol untuk mencegah eksekusi ganda.

### Lapisan data & keamanan

- **MongoDB (Mongoose):** user, trade logs, sesi AI, playbook, snapshot makro, memory agent, billing.
- **Enkripsi kredensial:** AES-256-CBC untuk kredensial MT5 at-rest, key dari `ENCRYPTION_KEY`.
- **Auth:** Better Auth + Discord OAuth, dengan verifikasi keanggotaan guild (`DISCORD_GUILD_ID`).
- **Rate limiting:** `express-rate-limit` pada endpoint API dan auth.
- **Isolasi secret:** installer hanya membawa `.env.example`. Gate `preflight-release.mjs`
  memindai seluruh output build terhadap nilai kredensial dari `.env` dev dan **menggagalkan
  build** kalau ada yang bocor.
- **OTA patch:** checksum SHA-256 diverifikasi sebelum ekstraksi, versi lokal yang lebih baru
  tidak akan di-downgrade, hanya URL `https://` yang diterima, dan ada rollback otomatis ke
  `resources_backup` kalau health check pasca-update gagal.

---

## 🩺 Troubleshooting

| Gejala | Kemungkinan penyebab | Tindakan |
|---|---|---|
| Splash screen tidak hilang / "Failed to start servers" | Port 3000 atau 5000 dipakai proses lain | Tutup proses tersebut. Electron sudah mencoba kill leftover process, tapi proses non-Node bisa lolos. |
| Backend crash saat start | Env wajib kosong (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `DISCORD_*`, `FRONTEND_URL`) | Cek `%APPDATA%\hunter-trades-desktop\logs\backend.log` — Zod menyebut nama variabel yang hilang. Kalau `server.env` belum ada atau tidak lengkap, hapus file itu dan jalankan ulang aplikasi untuk memunculkan wizard setup. |
| "MT5 not connected" | Terminal MT5 belum dibuka, atau *Enable internal server* belum dicentang | Ikuti [`docs/USER_GUIDE_MT5.md`](docs/USER_GUIDE_MT5.md). UI tetap bisa dipakai tanpa MT5. |
| AI tidak merespons | 9Router tidak jalan atau provider rate-limited | Cek `logs/9router.log`; model dengan fallback akan retry otomatis. |
| Frontend blank page | `resources/frontend/.next/static` tidak ikut ter-copy | Rakit ulang: `npm run build:frontend && npm --prefix desktop run build:win`. |
| OTA update gagal | Checksum mismatch atau health check pasca-update gagal | Aplikasi rollback otomatis ke versi sebelumnya; cek `logs/main.log`. |

**Lokasi log:** `%APPDATA%\hunter-trades-desktop\logs\`
(`main.log`, `backend.log`, `frontend.log`, `9router.log`)

---

## 📚 Dokumentasi Terkait

| Dokumen | Isi |
|---|---|
| [`docs/USER_GUIDE_MT5.md`](docs/USER_GUIDE_MT5.md) | Install EXE production + koneksi MetaTrader 5 (untuk user) |
| [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) | Referensi endpoint `/api/v1/` |
| [`docs/infrastructure.md`](docs/infrastructure.md) | Arsitektur infrastruktur & deployment |
| [`docs/workflow.md`](docs/workflow.md) | Spesifikasi multi-agent pipeline Signal → Trade |
| [`docs/AI_PROVIDER_STRATEGY.md`](docs/AI_PROVIDER_STRATEGY.md) | Strategi pemilihan & fallback LLM provider |
| [`docs/post-mortem-2026-10-05-mt5-9router.md`](docs/post-mortem-2026-10-05-mt5-9router.md) | Post-mortem insiden MT5 auto-resume & kebocoran key |
| [`CHANGELOG.md`](CHANGELOG.md) | Riwayat rilis |
| `AGENTS.md`, `.kilo/` | Konteks & aturan untuk AI coding agent |

---

## 📄 Lisensi

UNLICENSED — proprietary. Seluruh hak cipta milik Hunter Trades.

---

*Hunter Trades Journal · Terminal Noir · v1.2.0*
