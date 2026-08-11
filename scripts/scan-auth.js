const fs = require("fs");
function extract(p) {
  const c = fs.readFileSync(p, "utf8");
  const re = /router\.(get|post|put|delete)\(\s*["'`]([^"'`]+)["'`]/g;
  let m;
  const out = [];
  while ((m = re.exec(c))) out.push(m[1].toUpperCase().padEnd(6) + " " + m[2]);
  return out;
}
["auth.routes.ts", "auth-v1.routes.ts", "index.ts"].forEach((f) => {
  console.log("=== " + f + " ===");
  extract("D:/Journal Trade/server/src/routes/" + f).forEach((r) => console.log("  " + r));
});