const fs = require("fs");
const dir = "D:/Journal Trade/server/node_modules/better-auth/dist";
function walk(d) {
  let out = [];
  try {
    for (const f of fs.readdirSync(d)) {
      const p = d + "/" + f;
      const st = fs.statSync(p);
      if (st.isDirectory()) out = out.concat(walk(p));
      else if (f.endsWith(".mjs")) out.push(p);
    }
  } catch (e) {}
  return out;
}
const files = walk(dir);
for (const f of files) {
  try {
    const c = fs.readFileSync(f, "utf8");
    if (/createHash|digest/.test(c)) {
      const lines = c.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (/createHash|digest/i.test(lines[i])) {
          const ctx = lines.slice(Math.max(0, i - 3), i + 3).join(" | ");
          if (/token|session/i.test(ctx)) {
            console.log(f.split("better-auth")[1].slice(0, 50) + " L" + (i + 1) + ": " + ctx.slice(0, 200));
          }
        }
      }
    }
  } catch (e) {}
}