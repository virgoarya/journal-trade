const fs = require("fs");
for (const f of ["frontend/package.json", "server/package.json", "package.json"]) {
  const p = "D:/Journal Trade/" + f;
  const c = fs.readFileSync(p, "utf8");
  const m = c.match(/"version": "[0-9.]+"/);
  console.log(f + ": " + (m ? m[0] : "NOT FOUND"));
}
