# Release & OTA Process — Hunter Trades

> Dibuat setelah insiden 16 Okt 2026 (EXE tampil versi lama + OTA patch tidak konsisten).
> Tujuan: **tidak ada lagi kebingungan development/maintenance.**

---

## 1. Single Source of Truth — branch `main`

**SEMUA agent dan developer commit ke `main` saja.**

Latar belakang: repo pernah punya dua garis history tanpa common ancestor
(`main` root `93087554` vs `feat/checklist-display-only` root `e0941eb`).
Akibatnya kerja terpecah: `main` tertinggal di `frontend/src`, `server/src`, dan `desktop/`
(halaman Macro Terminal `main` terakhir diubah 4 Jul, sedangkan versi terbaru ada di `feat` 15 Okt).

Konsolidasi sudah dilakukan: commit `3efa5dc` menjadikan konten `feat/checklist-display-only`
sebagai konten `main` (histori kedua branch tetap tersimpan sebagai parent).
Backup branch lama: tag `backup/main-pre-consolidation-20261016`.

**Aturan:**
- Jangan membuat branch baru untuk kerja harian — commit langsung ke `main`.
- Kalau butuh branch untuk eksperimen, merge balik ke `main` sebelum rilis.
- **Jangan pernah** biarkan kode berjalan di dua branch paralel.

---

## 2. Versi — satu sumber, wajib seragam

Versi **wajib identik** di tiga tempat sebelum rilis:

| File | Dipakai untuk |
|---|---|
| `desktop/package.json` | `app.getVersion()` → dasar perbandingan OTA, judul installer |
| `frontend/package.json` | badge versi di header UI (`header.tsx` → `v{pkg.version}`) |
| `server/package.json` | metadata backend |

Cara cepat cek:

```bash
grep -m1 '"version"' desktop/package.json frontend/package.json server/package.json
```

**Penting:** Next.js **membake** `frontend/package.json` version ke dalam build.
Mengubah angka versi **tidak berpengaruh** sampai frontend di-rebuild dan bundle di-repack.

---

## 3. Checklist rilis (urutan wajib)

```bash
# 0. Set versi baru di KETIGA package.json (lihat bagian 2)

# 1. Build frontend
cd frontend && npm run build          # next build --webpack

# 2. Build server
cd ../server && npx tsc

# 3. Susun bundle desktop
cd ../desktop && npm run build:win    # buildHooks/buildApp.js
#    (atau repack manual: .next standalone + static + public + server.js + app files)

# 4. Verifikasi bundle
cat dist-app/win-unpacked/resources/frontend/.next/BUILD_ID
grep -m1 '"version"' dist-app/win-unpacked/resources/app/package.json

# 5. Generate artefak OTA (WAJIB — jangan edit version.json manual)
cd desktop && npm run build:patch     # buildHooks/buildPatch.js
#    → update/patch.zip  +  update/version.json (versi & checksum otomatis konsisten)

# 6. Verifikasi checksum cocok
sha256sum update/patch.zip
grep checksum update/version.json

# 7. Commit + push
git add -A && git commit -m "release(vX.Y.Z): ..."
git push origin main
```

**Jangan pernah mengedit `update/version.json` dengan tangan.** Versi dan checksum
harus selalu dihasilkan `buildPatch.js` dari bundle yang benar-benar dikirim.

---

## 4. Cara kerja OTA

- URL: `https://raw.githubusercontent.com/virgoarya/journal-trade/main/update/version.json`
  (di-hardcode di `desktop/main.js` → `OTA_VERSION_URL`).
- App membandingkan `remote.version` vs `app.getVersion()` (`compareVersions`, semver-aware).
- Kalau remote lebih baru → app menawarkan update, lalu mengunduh `patchUrl` dan
  mengekstraknya ke atas `process.resourcesPath`.
- Isi patch: `app/`, `server/`, `frontend/` — **tanpa** `node_modules`, `.env`, `logs/`,
  `monitoring-reports/` (dijaga oleh allowlist di `buildPatch.js`).

### Jebakan yang sudah pernah terjadi

1. **Loop update tak berujung** — `version.json` menyatakan `1.2.2` tetapi
   `app/package.json` di dalam patch berisi `1.2.1`. Setelah patch diterapkan versi app
   tidak naik → app terus menawarkan update yang sama. *Solusi: selalu generate lewat
   `buildPatch.js`.*
2. **Patch menurunkan versi kode** — patch berisi build frontend yang lebih lama daripada
   bundle yang dipakai. Kalau di-apply, UI baru tertimpa kode lama.
   *Solusi: build bundle dulu, baru generate patch dari bundle itu.*
3. **CDN cache GitHub raw** — `raw.githubusercontent.com` mengirim
   `Cache-Control: max-age=300`. Setelah push, app bisa masih membaca version.json lama
   sampai **±5 menit**. Jangan panik kalau OTA belum berubah segera setelah push.
4. **Perubahan dependency** — patch tidak membawa `node_modules`. Kalau rilis menambah
   dependency **runtime server**, kirim **installer penuh**, bukan hanya patch OTA.
   (Dependency frontend yang dipakai di client akan di-bundle webpack ke `.next/static`,
   jadi aman.)

---

## 5. Verifikasi setelah rilis

```bash
# remote sudah benar?
curl -s "https://raw.githubusercontent.com/virgoarya/journal-trade/main/update/version.json?t=$RANDOM"

# jalankan EXE, pastikan log tidak menampilkan "Update available" palsu
#   [OTA-UPDATER] Checking for updates (current: X.Y.Z)...
#   (tidak ada baris "Update available" bila versi sudah sama)
```

Cek juga:
- `🌐 Environment: Production (Packaged)`
- `[MAIN] ✅ Backend is ready!` dan `[MAIN] ✅ Frontend is ready!`
- Port 3000 (frontend), 5000 (backend), 20128 (9Router) LISTENING
- `http://127.0.0.1:5000/health` → `{"status":"OK"}`
