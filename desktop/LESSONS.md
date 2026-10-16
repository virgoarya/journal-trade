# LESSONS.md — Agent Self-Learning Log

## 2026-10-16T10:00:00.000Z — Agent Memory & Delegation Discipline (dari Kira)

**Lesson:**
- **Brief & decision → file permanen:** Memory agent terbatas & hilang saat restart. Semua brief, plan, dan decision WAJIB disimpan di file (`.hermes/plans/`, `LESSONS.md`, dst), bukan di head memory.
- **Cek file sebelum nanya:** Jangan nanya hal yang sudah ada answer di plan/LESSONS file. Baca dulu, baru execute.
- **Jangan delegasi kalau bisa execute sendiri:** Task yang sudah clear → langsung jalanin. Delegasi hanya untuk parallel workstream yang genuinely independent.

## 2026-10-16T01:30:00.000Z — Build & Startup Precision

**Lesson:**
- **Frontend packaging:** Before creating the desktop EXE, run `npm run build` and copy the entire `frontend/.next/standalone` directory (including `server.js`, `node_modules`, and all `.next` manifests) into `desktop/dist-app/win-unpacked/resources/frontend`. Missing files cause the bundled app to crash with `MODULE_NOT_FOUND`.
- **Backend start timeout:** The backend may take >2 minutes (MongoDB, Prisma, MT5 MCP). Increase the wait timeout in `desktop/main.js` from 120 000 ms to at least 300 000 ms (`await waitForServer(BACKEND_PORT, "/health", 300000, ...)`). Prevents premature “Startup error”.
- **TS/JSX linting:** Duplicate JSX attributes (e.g., `aria-label`) stop the build. Resolve such errors before packaging.

**Outcome:** After applying these fixes, the desktop app launches with UI, backend, and router all listening (ports 3000, 5000, 20128).