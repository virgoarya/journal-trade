# HYBRID WORKFLOW — Hunter Trades Journal
**Berlaku untuk:** Kira, Nova, Axis, Vera, Riku, Forge, Sage, Volco, Lyra  
**Tanggal:** 26 Oktober 2026  
**Tujuan:** mengurangi birokrasi kanban tanpa kehilangan jejak pekerjaan.

---

## 1. Dua jalur kerja

### Chat / mention langsung
Dipakai untuk:
- Pertanyaan status.
- Penjelasan error.
- Keputusan cepat.
- Konfirmasi hasil.
- Diskusi arsitektur.
- Hal yang selesai dalam satu balasan.

Tidak perlu membuat ticket.

### Kanban
Dipakai hanya untuk:
- Perubahan kode.
- Commit.
- Test / E2E.
- Build / release.
- Pekerjaan yang perlu dilacak lintas session.
- Pekerjaan yang perlu evidence (hash, screenshot, exit code).

---

## 2. Aturan kanban

1. **Maksimal 2 ticket aktif** di board pada satu waktu.
2. **`kanban.max_in_progress: 1`** — dispatcher hanya boleh menjalankan satu task.
3. **Satu ticket = satu pekerjaan yang bisa selesai.** Jangan gabung 5 bug dalam satu ticket tanpa sub-item.
4. **Tidak boleh ada ticket duplikat.** Jika overlap, merge atau tutup salah satu.
5. **Ticket `blocked` wajib punya alasan dan owner.** Kalau tidak, archive.
6. **Ticket lama yang sudah tidak relevan di-archive**, bukan dibiarkan menumpuk.
7. **Agent wajib lapor evidence** sebelum ticket dianggap `done`.

---

## 3. Siklus ticket

`todo` → `running` → `review` → `done`

- `blocked` hanya untuk dependency nyata atau guard yang belum bisa dibuka.
- `review` maksimal 1 hari; kalau tidak ada review, kembalikan ke `todo` atau `blocked`.
- `done` harus punya: file berubah, test, commit hash, dan exit code.

---

## 4. Aturan git

1. **Dilarang `git restore`, `git clean -fd`, atau `git reset --hard`** tanpa persetujuan Bang Vir.
2. Sebelum build: `git stash push -u -m "pre-build freeze"`, lalu catat isi stash.
3. Setelah build: verifikasi stash masih utuh sebelum `pop`.
4. Commit harus atomik dan sesuai format SOP 6.1.
5. Jangan commit dari working tree yang bercampur dengan perubahan agent lain.

---

## 5. Peran Kira

- Kira adalah **dispatcher**, bukan penggarap semua task.
- Kira hanya dispatch satu ticket pada satu waktu.
- Kira tidak melakukan batch dispatch.
- Kira tidak melakukan DB surgery tanpa persetujuan.
- Kira melaporkan status board di chat, bukan membuat ticket status.

---

## 6. Format laporan agent

```
@Kira — [AGENT] — [STATUS] — [EVIDENCE]
- File:
- Commit:
- Test:
- Exit code:
- Screenshot (jika UI):
```

---

## 7. Prinsip

- Chat untuk kecepatan.
- Kanban untuk akuntabilitas.
- Jangan pakai kanban untuk hal yang bisa dijawab dalam satu pesan.
- Jangan pakai chat untuk pekerjaan yang butuh bukti dan commit.
