const fs = require("fs");
const dir = "D:/Journal Trade/frontend/src/app/(dashboard)/ai-trading";
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = d + "/" + f;
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(f)) files.push(p);
  }
})(dir);
for (const f of files) {
  const c = fs.readFileSync(f, "utf8");
  if (!/useEffect\s*\(/.test(c)) continue;
  const importLine = c.split("\n").find((l) => /from ["']react["']/.test(l) && /import/.test(l));
  const hasEffectImport = importLine && /useEffect/.test(importLine);
  if (!hasEffectImport) console.log("MISSING useEffect import:", f.replace(dir, ""));
  // Also check useMemo, useCallback, useRef usage without imports
  for (const hook of ["useMemo", "useCallback", "useRef", "useContext"]) {
    if (new RegExp(hook + "\\s*\\(").test(c) && (!importLine || !new RegExp(hook).test(importLine))) {
      console.log("MISSING " + hook + " import:", f.replace(dir, ""));
    }
  }
}
console.log("scan selesai, total files:", files.length);
