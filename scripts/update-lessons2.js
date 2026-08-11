const fs = require("fs");
const p = "D:/Journal Trade/.kilo/LESSONS.md";
const c = fs.readFileSync(p, "utf8");
const lesson = `

### [20260810] Skeleton Stuck di PositionsTable — Infinite Loop useEffect
**Area**: Frontend / React Hooks
**Root Cause**: \`usePositions.ts\` menaruh \`positions.length\` & \`orders.length\` di dependency \`useEffect\`. Setiap WebSocket kirim update posisi → length berubah → useEffect re-run → \`setIsLoading(true)\` → tapi karena data sudah ada, \`fetchPositions()\` tidak dipanggil → \`setIsLoading(false)\` tidak pernah jalan → skeleton stuck selamanya.
**Solusi**: (1) \`isInitialLoadingRef\` — hanya set loading saat mount pertama. (2) WebSocket onTick set \`setIsLoading(false)\` saat data real-time sampai. (3) Fetch hanya jika data kosong.
**Hindari**: Jangan gabungkan data.length di useEffect dependency dengan flag isLoading yang dikontrol terpisah. WebSocket = sumber data utama; fetch HTTP hanya fallback awal.
`;
fs.writeFileSync(p, c + lesson);
console.log("LESSONS.md updated");
