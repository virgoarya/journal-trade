const fs = require("fs");
const p = "D:/Journal Trade/.kilo/LESSONS.md";
const c = fs.readFileSync(p, "utf8");
const newLessons = `

### [20260810] Next.js Standalone: Static Assets Harus di .next/static
**Area**: Frontend / Build / Electron Packaging
**Root Cause**: \`buildApp.js\` menyalin static ke \`resources/frontend/_next/static\`, tapi Next.js standalone \`server.js\` membaca aset dari \`.next/static\` (relatif ke lokasi server.js). Akibatnya CSS/JS 404 → halaman tanpa styling.
**Solusi**: Ubah \`runRobocopy(frontend/.next/static, targetFrontend/.next/static)\` — path \`.next/static\` bukan \`_next/static\`.
**Hindari**: Selalu verifikasi \`resources/frontend/.next/static/css\` ada setelah buildApp.js. Jangan pakai \`postinstall\` npm di root yang memanggil install subdirectory (timeout berantai).

### [20260810] ignoreBuildErrors:true Menyembunyikan Bug Runtime
**Area**: Frontend / TypeScript
**Root Cause**: \`next.config.ts\` pakai \`typescript.ignoreBuildErrors: true\` → build sukses meski ada 18 error TS, termasuk \`useEffect\` dipakai tanpa import di PipelineLogs.tsx → ReferenceError → halaman AI trading crash "This page couldn't load".
**Solusi**: Aktifkan type checking (\`ignoreBuildErrors: false\`) dan jalankan \`npx tsc --noEmit\` sebelum build. Fix semua error: PipelineStatus.circuitBreakerReason, PipelineConfig.smartRisk.globalDrawdownLimit, BacktestConfig.maxDailyRisk, BacktestStreamView sessionStats type, OtaUpdaterModal setUpdateInfo.
**Hindari**: JANGAN pernah matikan type checking di produksi. Error TS yang lolos = bug runtime.

### [20260810] Debug "This page couldn't load" di Halaman Spesifik
**Area**: Frontend / Debugging
**Root Cause**: Dashboard OK tapi 1 halaman crash = error JS spesifik di komponen halaman itu (bukan aset).
**Solusi**: (1) Scan import React hooks hilang (useEffect/useMemo/useCallback tanpa import). (2) \`npx tsc --noEmit\` untuk error tersembunyi. (3) Scan module-scope browser API (window/localStorage) yang crash SSR. (4) Verifikasi via frontend standalone + browser biasa (Electron DevTools Ctrl+Shift+I sering nonaktif di packaged).
**Hindari**: Jangan tebak error — selalu scan kode dulu.

### [20260810] npm Reinstall Mengubah Versi Library → Type Error Baru
**Area**: Backend / Dependencies
**Root Cause**: \`rm -rf node_modules\` + install ulang mengubah versi (mongoose, mongodb, better-auth, ai SDK, @modelcontextprotocol) → type error baru.
**Solusi**: \`noImplicitAny: false\` di tsconfig, cast constructor (\`const ObjectIdCtor: any = mongoose.Types.ObjectId\`), \`as any\` untuk opsi baru, tipe eksplisit untuk array kosong (hindari \`never[]\`).
**Hindari**: Setelah reinstall besar, selalu jalankan \`npx tsc\` dan fix error sebelum build. npm install Windows butuh timeout 900000.
`;
fs.writeFileSync(p, c + newLessons);
console.log("LESSONS.md updated");
