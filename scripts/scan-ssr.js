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
  const lines = fs.readFileSync(f, "utf8").split("\n");
  let inModuleScope = true;
  let braceDepth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith("export function") || trimmed.startsWith("export const") || trimmed.startsWith("function ") || trimmed.startsWith("const ") && !trimmed.includes("=")) {
      // count braces
    }
    // naive: check top-level (before any function/component definition)
    if (/^(export\s+)?(function|const|class)\s/.test(trimmed) && !trimmed.includes("=>")) {
      inModuleScope = false;
    }
    if (inModuleScope && /window\.|localStorage\.|document\./.test(line) && !trimmed.startsWith("//") && !trimmed.startsWith("/*")) {
      console.log("MODULE-SCOPE browser API:", f.replace(dir, ""), "L" + (i + 1), trimmed.slice(0, 80));
    }
  }
}
console.log("scan module-scope selesai");
