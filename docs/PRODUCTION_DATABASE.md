# Database Produksi — MongoDB Atlas

Runbook DevOps untuk database produksi Hunter Trades Journal.
Terakhir diverifikasi: **26 Okt 2026** (FORGE).

---

## 1. Ringkasan

| Item | Nilai |
|---|---|
| Engine | MongoDB **8.0.34** di MongoDB Atlas |
| Cluster (live) | `cluster0.7dzhhrn.mongodb.net` |
| Replica set | `atlas-dim9bc-shard-0` — **3 node** (failover ✅) |
| Primary | `ac-ft3vdcs-shard-00-02.7dzhhrn.mongodb.net:27017` |
| Database produksi | `journal_trade_prod` (target) — **belum dibuat** |
| Koleksi wajib | 29 (25 domain + 4 better-auth), 61 index |
| Koleksi saat ini | `journal_trade_dev` (30 koleksi, data real) |
| Atlas Backup | ⚠️ **belum bisa diverifikasi dari kode** — lihat §5 |

### Temuan audit (26 Okt 2026)

Audit sebelumnya menyatakan *"tidak ada MongoDB Atlas URI di seluruh repo"*.
**Itu keliru.** Atlas URI ada di repo dan clusternya **hidup serta berisi data**:

- `server/.env` → baris Atlas **dikomentari** dengan label `# Stale Atlas Cluster:`
  (bukan dihapus — tinggal aktifkan).
- `scripts/setup-test-session.mjs` → URI SRV hardcoded.
- `server/scripts/setup-test-session.mjs` → kredensial + IP shard (replica set name di
  file ini **sudah basi**: `atlas-7dzhhrn-shard-0`, yang asli `atlas-dim9bc-shard-0`).

Klaim "stale" ternyata tidak terbukti: cluster live, MongoDB 8.0.34, 3 node,
semua koleksi ada.

---

## 2. Keputusan yang dibutuhkan dari Bang Vir 🔴

Tooling sudah lengkap dan terverifikasi. Yang **belum** bisa diputuskan oleh
engineer (butuh akses billing/console Atlas):

1. **Pakai cluster yang ada (`cluster0.7dzhhrn`) atau cluster baru?**
   - *Opsi A — pakai cluster existing:* cepat, zero biaya tambahan. Risiko: cluster ini
     sudah dipakai untuk dev/test (`journal_trade_dev`, `journal_trade_dev_local`),
     jadi beban produksi bercampur dengan beban dev.
   - *Opsi B — cluster baru khusus produksi:* isolation penuh, biaya tambahan,
     perlu Atlas project baru + billing.
2. **Database produksi: `journal_trade_prod` baru, atau promote `journal_trade_dev`?**
   Rekomendasi FORGE: **`journal_trade_prod` baru**. Data `journal_trade_dev`
   sekarang berisi data uji; mencampurnya ke produksi membuat rollout pertama
   jadi tidak bersih dan sulit di-audit.
3. **Tier Atlas untuk backup + failover.** Atlas Backup **tidak tersedia di tier
   Shared (M0/M2/M5)**. Minimal **M10** untuk Atlas Backup (continuous) dan
   Point-in-Time Recovery. Tier hanya bisa dikonfirmasi dari Atlas Console.
4. **Kredensial produksi.** User `virgoarya94_db_user` yang ada sekarang adalah user
   dev. Produksi butuh **database user terpisah** dengan role terbatas.

---

## 3. Setup Atlas (sekali)

### 3.1 Database user produksi

Atlas Console → **Database Access** → *Add New Database User*

- Username: `journal_trade_prod_user`
- Password: generate acak 24+ char, simpan di secret manager (Vault)
- Privileges: `readWrite@journal_trade_prod` (+ `read@admin` untuk verifikasi)
- **Jangan** pakai user dev untuk produksi.

### 3.2 Network access

Atlas Console → **Network Access**

- Tambahkan IP host produksi (static IP disarankan).
- `0.0.0.0/0` boleh untuk bootstrap, tapi **hapus setelah IP produksi known**.
- Atlas PrivateLink kalau host produksi di cloud yang sama.

### 3.3 Backup & failover (lihat §5)

### 3.4 Connection string

```
mongodb+srv://journal_trade_prod_user:<PASSWORD>@<CLUSTER>.mongodb.net/journal_trade_prod?retryWrites=true&w=majority&appName=JournalTradeProd
```

Masukkan ke `server/.env` (produksi) sebagai `DATABASE_URL`, dan
`DATABASE_NAME=journal_trade_prod`.

> **Jangan copy-paste URI dari `server/.env` yang sekarang** — itu URI dev dan
> database name-nya `journal_trade_dev`.

---

## 4. Migrasi & Verifikasi

Dua script, satu sumber kebenaran (`server/scripts/lib/atlas-schema.mjs`).

### 4.1 Migrasi (idempotent — aman diulang)

```bash
cd server
DATABASE_URL='mongodb+srv://<PROD_USER>:<PASS>@<CLUSTER>.mongodb.net/journal_trade_prod?retryWrites=true&w=majority' \
DATABASE_NAME=journal_trade_prod \
node scripts/migrate-atlas.mjs
```

- Membuat 29 koleksi + 61 index bila belum ada.
- **Tidak pernah** drop/delete/ubah data.
- Index yang definisinya menyimpang → dilaporkan `MISMATCH`, **tidak** diutak-atik.
- Dry-run dulu: tambahkan `MIGRATE_DRY_RUN=1` untuk lihat rencana tanpa menulis.

### 4.2 Verifikasi (bukti go/no-go)

**Verifikasi dari sisi APP** (jalur produksi: `config/env.ts` + `db/mongoose.ts`) —
ini yang menentukan app bisa start atau tidak:

```bash
cd server
DATABASE_URL='mongodb+srv://<PROD_USER>:***@<CLUSTER>.mongodb.net/journal_trade_prod?retryWrites=true&w=majority' \
DATABASE_NAME=journal_trade_prod \
BETTER_AUTH_SECRET=<dummy> BETTER_AUTH_URL=http://localhost:5000 \
DISCORD_CLIENT_ID=<dummy> DISCORD_CLIENT_SECRET=<dummy> DISCORD_GUILD_ID=<dummy> \
FRONTEND_URL=http://localhost:3000 \
npm run verify:atlas
```

Output JSON membuktikan: app tersambung lewat `connectDB()`, ping OK, replica set
≥3 node, 29/29 koleksi, deteksi koleksi legacy, dan pembacaan lewat model layer.
Exit code `0` = app production akan tersambung.

**Verifikasi cluster saja** (MongoClient polos, tanpa start app):

```bash
DATABASE_URL='...' DATABASE_NAME=journal_trade_prod VERIFY_WRITE_PROBE=1 \
node scripts/verify-atlas.mjs
```

Output JSON membuktikan: cluster reachable, replica set ≥3 node, ping OK,
29/29 koleksi, write permission, deteksi koleksi legacy.
Exit code `0` = siap produksi.

### 4.3 Bukti yang sudah dihasilkan (26 Okt 2026)

| Cek | Hasil |
|---|---|
| SRV DNS | 3 node: `ac-ft3vdcs-shard-00-00/01/02.7dzhhrn.mongodb.net` |
| Koneksi app → Atlas | ✅ ok |
| Replica set | `atlas-dim9bc-shard-0`, 3 node, primary `...-00-02` |
| `journal_trade_dev` | 29/29 koleksi wajib, 61 index, write probe ✅ |
| Migrasi DB baru | ✅ 29 koleksi + 61 index dibuat |
| Migrasi ulang (idempotensi) | ✅ 0 dibuat, 0 mismatch |
| Verifikasi DB hasil migrasi | ✅ 29/29, failover ✅ |
| DB uji sementara | ✅ di-drop setelah dibuktikan |

---

## 5. Backup & Failover

### Failover — ✅ sudah terpenuhi

Cluster adalah **replica set 3 node**. Failover otomatis oleh driver MongoDB
(menggunakan SRV). Saat primary turun, election < 10 detik.

### Backup — ⚠️ belum terverifikasi

Atlas Backup **tidak tersedia di tier Shared (M0/M2/M5)**. Verifikasi hanya bisa
dari Atlas Console → **Backup** (butuh akses Atlas, tidak ada Atlas API key di repo).

**Target FORGE:**

| Metrik | Target |
|---|---|
| RPO | ≤ 24 jam (Atlas Backup continuous) |
| RTO | ≤ 1 jam |
| Retensi | ≥ 35 hari |
| Restore test | tiap 90 hari, terdokumentasi |

**Langkah di Atlas Console:** Backup → Enable → pilih M10+ → aktifkan
Point-in-Time Recovery. Setelah aktif, **lakukan restore test ke cluster samping**
sekali sebelum go-live — backup yang tidak pernah di-restore adalah asumsi, bukan jaminan.

### Kalau tier Shared (tanpa Atlas Backup)

Kandidat pengganti (butuh keputusan Bang Vir):
- `mongodump` terjadwal ke object storage (S3/GCS) — RPO mengikuti jadwal.
- Atlas continuous backup via third-party (Percona, Studio 3T).

---

## 6. Pitfalls yang ditemukan

### 6.1 DNS SRV — `querySrv ECONNREFUSED`

**Gejala:** koneksi Atlas gagal dengan `querySrv ECONNREFUSED _mongodb._tcp.<cluster>.mongodb.net`
di host Windows, padahal `nslookup -type=SRV` berhasil.

**Penyebab:** Node.js memakai **c-ares** untuk DNS. Resolver sistem di host ini
tidak bisa menjawab SRV lewat c-ares.

**Bukti (26 Okt 2026):**

| Resolver | Hasil |
|---|---|
| Default (sistem) | ❌ `ECONNREFUSED` |
| `1.1.1.1, 8.8.8.8, 1.0.0.1, 8.8.4.4` | ✅ 3 node |

**Fix:** `server/src/db/mongoose.ts` sudah melakukan
`dns.setServers(["1.1.1.1","8.8.8.8","1.0.0.1","8.8.4.4"])`.
**Jangan dihapus.** Script `verify-atlas.mjs` dan `migrate-atlas.mjs` mengikuti
perilaku yang sama (override via `ATLAS_DNS_SERVERS`, `ATLAS_DNS_SERVERS=none`
untuk memaksa resolver sistem).

> Catatan: `server/scripts/setup-test-session.mjs` mencoba koneksi **direct IP**
> sebagai fallback. IP shard bisa berubah; jangan dijadikan jalur utama.

### 6.2 Koleksi legacy `tokenbalances`

Ada **dua** koleksi untuk konsep yang sama di cluster live:

| Koleksi | Dokumen | Status |
|---|---|---|
| `tokenbalances` | 1 | **legacy** — pluralisasi default Mongoose dari `TokenBalance` |
| `token_balances` | 0 | **dipakai app** — `collection: "token_balances"` di `TokenBalance.ts` |

`verify-atlas.mjs` akan **memperingatkan** kalau `tokenbalances` ada.
**Jangan buat `tokenbalances` di DB produksi baru.** Pindahkan 1 dokumen legacy
ke `token_balances` lalu drop `tokenbalances` setelah direview.

### 6.3 Koleksi tanpa data

`chat_sessions`, `daily_snapshots`, `token_balances`, `vector_memories` berisi 0
dokumen di cluster live — normal untuk fitur yang belum dipakai, bukan error.

### 6.4 `agentinsights` bukan `agent_insights`

Nama koleksi legacy camelCase. Jangan "rapikan" jadi snake_case — app masih
membaca `agentinsights`.

---

## 7. Rotasi Kredensial

1. Atlas Console → Database Access → edit user → reset password.
2. Update secret di secret manager (Vault) — **bukan** di `server/.env`.
3. Rolling restart service supaya `authMongoClient` + Mongoose reconnect.
4. Verifikasi: `node scripts/verify-atlas.mjs`.

**Rotasi wajib** untuk user `virgoarya94_db_user` — passwordnya tertulis plaintext
di `server/scripts/setup-test-session.mjs` (dan sempat di-commit). Lihat §8.

---

## 8. Keamanan — tindakan lanjutan 🔴

Masalah terpisah dari konfigurasi DB, tapi ditemukan saat audit ini:

1. **Kredensial Atlas plaintext di repo.**
   `server/scripts/setup-test-session.mjs` menyimpan password DB user.
   → Rotasi password, pindahkan ke env var, hapus dari git history.
2. **`server/.env` dan `.env` berisi secret asli** (API key, Discord secret,
   Midtrans server key, webhook URL). Pastikan keduanya ada di `.gitignore`
   dan **tidak** ikut ter-bundle ke installer desktop.
3. **Jalankan secret scanner** sebelum release: `gitleaks detect` atau
   `trufflehog`. (Catatan: `gitleaks` belum terpasang di host ini.)

---

## 9. Runbook Incident

**Gejala:** app gagal start / `Error connecting to MongoDB`.

```bash
# 1. Apakah Atlas reachable?
DATABASE_URL='...' DATABASE_NAME=journal_trade_prod node scripts/verify-atlas.mjs

# 2. Apakah DNS SRV bermasalah? (penyebab paling umum di Windows)
#    jalankan dengan resolver paksa:
ATLAS_DNS_SERVERS="1.1.1.1,8.8.8.8" DATABASE_URL='...' node scripts/verify-atlas.mjs

# 3. Apakah DB user kena lockout / IP belum di-whitelist?
#    cek Atlas Console → Network Access & Database Access

# 4. Apakah database ada?
#    verify-atlas.mjs melaporkan "koleksi wajib belum ada" → jalankan migrasi
node scripts/migrate-atlas.mjs
```

**Failover:** tidak perlu action — driver mengganti primary otomatis.
Kalau semua node down, cek status Atlas (status.mongodb.com).

---

## 10. Definisi Selesai (DoD)

- [ ] Keputusan §2 dari Bang Vir
- [ ] Database user produksi dibuat, IP di-whitelist
- [ ] `DATABASE_URL` produksi diisi di host produksi (Atlas, bukan localhost)
- [ ] `DATABASE_NAME=journal_trade_prod`
- [ ] `migrate-atlas.mjs` dijalankan, exit 0
- [ ] `verify-atlas.mjs` exit 0 (29/29 koleksi, 3 node, write probe ✅)
- [ ] Atlas Backup aktif + restore test tercatat
- [ ] Rotasi kredensial dev yang bocor (§8)
