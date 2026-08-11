const fs = require("fs");
const c = fs.readFileSync("D:/Journal Trade/frontend/src/services/ai-trading.service.ts", "utf8");
console.log("=== ai-trading.service.ts methods ===");
[...c.matchAll(/async (get|post|put|delete)\w*\s*\(\s*([^):,]+)/g)].forEach((m) => console.log("  " + m[1] + "(" + m[2].trim() + ")"));

const c2 = fs.readFileSync("D:/Journal Trade/server/src/mt5-streamer.ts", "utf8");
console.log("\n=== executeMt5Command actions ===");
[...c2.matchAll(/case "([a-z_0-9]+)"/g)].forEach((m) => console.log("  " + m[1]));

const c3 = fs.readFileSync("D:/Journal Trade/server/src/services/mt5-mcp.service.ts", "utf8");
console.log("\n=== mt5-mcp.service.ts methods ===");
[...c3.matchAll(/async (\w+)\(/g)].forEach((m) => console.log("  " + m[1]));