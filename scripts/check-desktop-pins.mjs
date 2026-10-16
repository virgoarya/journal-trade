#!/usr/bin/env node
/**
 * Verify desktop/package.json pins every dependency to an exact version.
 * A caret/tilde range means the installer produced today may carry different
 * bytes than the one produced tomorrow — unacceptable for a released EXE.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = path.join(ROOT, "desktop", "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

const bad = [];
for (const section of ["dependencies", "devDependencies"]) {
  for (const [name, spec] of Object.entries(pkg[section] || {})) {
    if (/^[\^~]/.test(spec) || spec === "*" || spec === "latest") {
      bad.push(`${section}.${name} = "${spec}"`);
    }
  }
}

if (bad.length) {
  console.error("❌ Unpinned desktop dependencies:");
  for (const b of bad) console.error(`   - ${b}`);
  process.exit(1);
}
console.log("✅ All desktop dependencies are pinned to exact versions.");
