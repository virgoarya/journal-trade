const fs = require("fs");
const c = fs.readFileSync("D:/Journal Trade/server/src/index.ts", "utf8");
c.split("\n").forEach((l, i) => {
  if (/app\.use|router\.use|mount|listen|api/i.test(l)) console.log(i + 1 + ": " + l.trim());
});