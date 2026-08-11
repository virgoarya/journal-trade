const fs = require("fs");
const dir = "D:/Journal Trade/server/node_modules/@better-auth/core/dist";
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = d + "/" + f;
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (f.endsWith(".mjs")) files.push(p);
  }
})(dir);
for (const f of files) {
  const c = fs.readFileSync(f, "utf8");
  if (/hashToken|hashedToken/.test(c)) {
    console.log("FILE:", f.split("core" + String.fromCharCode(92) + "dist")[1] || f);
    const ls = c.split("\n");
    for (let i = 0; i < ls.length; i++) {
      if (/hashToken|hashed|sha256|digest/i.test(ls[i])) {
        console.log("  L" + (i + 1) + ": " + ls[i].trim().slice(0, 170));
      }
    }
  }
}