# 📋 Daily Briefing Protocol — Tim Dev 2 → Production EXE

> **Dibuat:** 2026-10-06
> **Owner:** KIRA (Orchestrator, Tim Dev 2)
> **Rutin:** Setiap hari **09:00 WIB**
> **Goal:** Hunter Trades Journal jadi aplikasi desktop production — user install EXE, klik icon, semua jalan.

---

## 🎯 Goal Utama

Menghasilkan **installer EXE production-ready** yang menjalankan:
- Backend Express (port 5000)
- Frontend Next.js standalone (port 3000)
- 9Router proxy (port 20128)
- Electron window + system tray
- MT5 Native MCP terhubung

**Definisi "production":** user awam install sekali → klik icon → aplikasi jalan tanpa setup manual, tanpa error, auto-update jalan.

---

## 👥 Tim & Tanggung Jawab

| Agent | Role | Deliverable harian |
|-------|------|--------------------|
| **KIRA** | Orchestrator | Plan, koordinasi, quality gate, laporan progress |
| **AXIS** | Backend | API, services, database — fix bug backend |
| **NOVA** | Frontend | UI/UX, komponen, halaman — fix bug frontend |
| **RIKU** | Mobile/Responsive | Web UI di mobile & tablet |
| **FORGE** | DevOps/Build | Build pipeline, CI, installer, OTA patch |
| **VERA** | QA | Test suite, edge case, verifikasi fix |
| **SAGE** | Docs | Dokumentasi, wiki, user guide |
| **LYRA** | Design | Visual, Terminal Noir consistency |

---

## 🔄 Struktur Briefing Harian (09:00 WIB)

Setiap briefing WAJIB berisi 5 blok ini:

### 1. STATUS SNAPSHOT
- Branch aktif + commit terakhir
- TypeScript check (server & frontend) — error count
- Test suite — pass/fail count
- Git dirty files
- Blocker yang masih terbuka

### 2. PROGRESS PER TASK
Tabel: Task | Owner | Status | % | Blocker
- Ambil dari pekerjaan yang sudah didelegasikan kemarin
- Tandai task yang **stuck > 2 hari**

### 3. TASK HARI INI (perbaikan & modifikasi sebelum build)
Daftar task konkret, masing-masing:
- Deskripsi singkat
- Owner (agent)
- Acceptance criteria (terukur)
- Estimasi waktu

**Aturan:** task harus berorientasi **kesiapan build desktop** — bug fix, blocker, integrasi, bukan fitur baru.

### 4. REKOMENDASI TERBAIK
Minimal 3 rekomendasi actionable, masing-masing dengan alasan teknis + dampak ke kesiapan EXE.
Format: **Rekomendasi** → **Alasan** → **Dampak**.

### 5. RISK & DECISION NEEDED
- Risiko yang bisa menggagalkan build
- Keputusan yang butuh @user (Bang Vir)

---

## ✅ Pre-Build Checklist (Gate sebelum build EXE)

### Code Quality
- [ ] `npx tsc --noEmit` bersih (server + frontend)
- [ ] ESLint tanpa error
- [ ] Unit test pass (Vitest)
- [ ] Tidak ada `console.log` debug
- [ ] Tidak ada hardcoded secret

### Build Pipeline
- [ ] CI `.github/workflows` hijau (atau dihapus kalau tidak relevan)
- [ ] Frontend build → `.next/standalone`
- [ ] Server build → `dist/`
- [ ] Desktop build → `dist-app/win-unpacked/Hunter Trades.exe`
- [ ] Installer NSIS → `dist/Hunter Trades Setup <ver>.exe`
- [ ] OTA patch → `update/patch.zip` + `update/version.json`

### Runtime Verification
- [ ] `curl http://localhost:5000/health` → OK
- [ ] `curl http://localhost:3000` → OK
- [ ] MT5 MCP terhubung (port 22346)
- [ ] 9Router jalan (port 20128)
- [ ] AI pipeline bisa generate signal
- [ ] Discord OAuth flow jalan

### Release
- [ ] Version bump konsisten di 5 file (root/server/frontend/desktop/update)
- [ ] CHANGELOG.md diperbarui
- [ ] Installer diuji di Windows bersih
- [ ] Upload ke GitHub Releases

---

## 🚫 Aturan Delegasi

1. **Satu task = satu owner.** Jangan ada task tanpa pemilik.
2. **Task harus punya acceptance criteria terukur** — bukan "perbaiki UI" tapi "fix X di file Y, verifikasi Z".
3. **Blocker harus dieskalasi dalam 24 jam** — jangan diam.
4. **Backend `server/` sudah lengkap** — JANGAN buat folder `backend/` baru.
5. **Selalu cek `.kilo/LESSONS.md`** sebelum mengerjakan area yang pernah bermasalah.
6. **Bahasa komunikasi: Bahasa Indonesia.** Panggil user "Bang Vir".

---

## 📁 Referensi Wajib

| File | Isi |
|------|-----|
| `.kilo/MEMORY.md` | Arsitektur & tech stack |
| `.kilo/LESSONS.md` | Pelajaran dari bug sebelumnya |
| `.kilo/RULES.md` | Workflow & standar kode |
| `BRIEFING_DEVELOPMENT.md` | Briefing lengkap (audit 2026-10-05) |
| `docs/` | Dokumentasi project |

---

*"Intelligence without alignment is just noise."*
