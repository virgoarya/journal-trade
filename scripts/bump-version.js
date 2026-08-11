const fs = require("fs");
const files = ["frontend/package.json", "server/package.json", "package.json"];
for (const f of files) {
  const p = "D:/Journal Trade/" + f;
  let c = fs.readFileSync(p, "utf8");
  c = c.replace(/"version": "[0-9.]+"/, '"version": "1.0.15"');
  fs.writeFileSync(p, c);
  console.log("updated: " + f);
}
