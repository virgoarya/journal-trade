# RELEASE READINESS PLAN — Hunter Trades Journal
**Tanggal:** 26 Oktober 2026  
**Disusun:** SAGE (Docs/DX)  
**Status:** Disetujui Bang Vir  
**Target:** Release candidate yang reproducible, teruji, dan bisa di-install bersih.

---

## 1. Prinsip

**One commit → one build → one artifact → one manifest.**

Tidak ada build dari working tree kotor. Tidak ada rilis tanpa commit yang bisa dilacak. Tidak ada task `done` tanpa evidence.

---

## 2. Release Scope

### P0 — Release Blocker

**Backend**
- `AXIS-3` — 30 failing position-sizing tests.
- `PAY-BACKEND` — bug B1–B7 + server-side price source. Pilih satu ticket: `t_8426cfbd` atau `t_c95a3f4a`, jangan dua-duanya.
- `AXIS-2` — verdict gate Agent Consensus di `pipeline:1310`.

**Frontend**
- `NOVA-3` — bersihkan 8 typecheck error residue.
- `PAY-FRONTEND` — B4, C1, C5.
- `RIKU-1` — onboarding overlay z-index.

**QA**
- `VERIFY-2` — E2E Agent Consensus.
- `PAY-VERIFY` — E2E payment.
- Regression suite untuk flow kritis.

**DevOps**
- `FORGE-1` — production DB configuration.
- Build reproducibility: fix `EBUSY buildApp.js:78`, build dari clean tree.
- Clean install test di Windows.

**Docs**
- `DOCS-4` — ADR-0003 monetization pivot.
- `COMMIT-2` — commit DOCS-1 wiki updates.
- Release checklist + changelog.

**Tooling**
- `TOOL-1b` — vitest forks false-fail.

### P1 — Deferred

Jangan dikerjakan sebelum P0 selesai:
- `AXIS-4` dashscope removal.
- `AXIS-5` macro-ai stream.
- `AXIS-6` self-improvement.
- `UI-2` cleanup token/payment deprecated.
- Dokumen basi non-blocking.

---

## 3. Definition of Done

Sebuah task hanya `done` jika:

- Kode ter-commit di branch/PR.
- `typecheck` exit 0.
- `lint` tidak menambah error baru.
- Unit/integration test lulus.
- E2E lulus untuk flow yang tersentuh.
- Docs/changelog diperbarui jika perlu.
- Evidence: commit hash, exit code, screenshot untuk UI.
- Tidak ada file untracked yang tertinggal.

---

## 4. Release Gate

Rilis hanya boleh jalan jika semua ini lulus:

```bash
git status --porcelain          # harus kosong
npm run typecheck               # exit 0
npm run test                    # exit 0
npm run build:all               # exit 0, dari clean tree
npm run preflight:bundle        # exit 0
npm run build:patch             # exit 0
```

Lalu verifikasi:

- `source BUILD_ID == artifact BUILD_ID`
- SHA256 installer dicatat.
- Versi `1.2.1` atau versi rilis yang disepakati.
- Clean install: uninstall versi lama → install baru → launch → cek login/MT5/pipeline.
- Rollback plan tersedia.

---

## 5. WIP & Agent Rules

- Maksimal **2 task aktif**; target **1** setelah gateway restart.
- Kira hanya dispatcher; tidak menggarap semua task.
- Satu agent, satu area, satu ticket.
- Setelah **2 kegagalan tool yang sama**: stop, lapor, jangan retry ketiga.
- Dilarang `git restore`, `git clean -fd`, `git reset --hard` tanpa persetujuan Bang Vir.
- Jangan mass-unblock ticket.
- Jangan dispatch task baru saat masih ada 2 running.

---

## 6. Urutan Eksekusi

### Phase 0 — Stabilize
- Freeze fitur baru.
- Bersihkan kanban: merge duplikat, archive stale.
- Stabilkan Kira: reasoning `medium`, `max_iterations 20`, session baru dengan handoff singkat.
- Pastikan gateway membaca `max_in_progress: 1`.

### Phase 1 — Code Complete
- Selesaikan P0 backend, frontend, QA.
- Semua perubahan di branch/PR.
- CI hijau.

### Phase 2 — Release Candidate
- Build dari clean commit.
- `preflight:bundle` lulus.
- Clean install test.
- Manifest + SHA256 dicatat.

### Phase 3 — Release
- Tag versi.
- Publish installer.
- Changelog dan rollback runbook siap.

### Phase 4 — Post-Release
- Monitor error.
- Kumpulkan feedback.
- Baru rencanakan fitur berikutnya.

---

## 7. Assignment

- **Kira:** dispatch, WIP control, evidence review.
- **Axis:** AXIS-3, PAY-BACKEND, AXIS-2.
- **Nova:** NOVA-3, PAY-FRONTEND.
- **Vera:** VERIFY-2, PAY-VERIFY, regression.
- **Forge:** FORGE-1, build reproducibility, clean install.
- **Riku:** RIKU-1, QC aplikasi.
- **Sage:** DOCS-4, COMMIT-2, release checklist, changelog.
- **Volco:** TOOL-1b, CI reliability.

---

## 8. Aturan Briefing

Setiap briefing harus punya:

- **Tujuan:** satu hasil yang bisa diverifikasi.
- **File/area:** path konkret.
- **Langkah:** maksimal 5 langkah.
- **Evidence:** commit, exit code, screenshot.
- **Batasan:** apa yang tidak boleh dilakukan.
- **Definition of Done:** kapan task dianggap selesai.

Briefing tidak boleh berupa daftar 10 task sekaligus. Satu briefing, satu task.
