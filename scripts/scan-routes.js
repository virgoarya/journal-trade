const fs = require("fs");
function extract(path) {
  const c = fs.readFileSync(path, "utf8");
  const re = /router\.(get|post|put|delete)\(\s*["']([^"']+)["']/g;
  const routes = [];
  let m;
  while ((m = re.exec(c))) routes.push(m[1].toUpperCase().padEnd(6) + " " + m[2]);
  return routes;
}
console.log("=== AI-TRADING ROUTES ===");
extract("D:/Journal Trade/server/src/routes/ai-trading.routes.ts").forEach((r) => console.log(r));
console.log("\n=== MT5 ROUTES ===");
extract("D:/Journal Trade/server/src/routes/mt5.routes.ts").forEach((r) => console.log(r));