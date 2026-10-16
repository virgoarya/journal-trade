#!/usr/bin/env node
/**
 * Preflight release gate — Journal Trade / Hunter Trades.
 *
 * Runs BEFORE the EXE is packed. Every check below is a hard gate: a release
 * that fails here must not be shipped. Exits non-zero on the first blocking
 * class of failures and prints exactly what is wrong.
 *
 * Usage:
 *   node scripts/preflight-release.mjs                 # source + secret checks
 *   node scripts/preflight-release.mjs --strict-bundle # also require packed bundle
 *
 * Never prints secret values — only the key NAME and where it leaked.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STRICT_BUNDLE = process.argv.includes("--strict-bundle");

const failures = [];
const warnings = [];
const notes = [];

const exists = (p) => fs.existsSync(p);
const p = (...seg) => path.join(ROOT, ...seg);

function fail(msg) {
  failures.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}
function note(msg) {
  notes.push(msg);
}

/* ------------------------------------------------------------------ *
 * 1. Build artifacts must exist (and be newer than their sources).
 * ------------------------------------------------------------------ */
const serverDist = p("server", "dist", "index.js");
const frontendStandalone = p("frontend", ".next", "standalone");
const frontendServerJsCandidates = [
  path.join(frontendStandalone, "server.js"),
  path.join(frontendStandalone, "frontend", "server.js"),
];
const bundleRoot = p("desktop", "dist-app", "win-unpacked");

if (!exists(serverDist)) {
  fail("server/dist/index.js missing — run `npm run build:server` first.");
}
if (!exists(frontendStandalone)) {
  fail("frontend/.next/standalone missing — run `npm run build:frontend` first.");
} else if (!frontendServerJsCandidates.some(exists)) {
  fail(
    "frontend/.next/standalone has no server.js (checked ./server.js and ./frontend/server.js).",
  );
}

if (STRICT_BUNDLE && !exists(bundleRoot)) {
  fail(
    "desktop/dist-app/win-unpacked missing — run `npm run build:desktop` before packing a release.",
  );
}

/* ------------------------------------------------------------------ *
 * 2. Staleness: dist must not predate any source file it was built from.
 * ------------------------------------------------------------------ */
function newestMtime(dir, ext) {
  let newest = 0;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === "__tests__") continue;
        stack.push(full);
      } else if (!ext || full.endsWith(ext)) {
        const m = fs.statSync(full).mtimeMs;
        if (m > newest) newest = m;
      }
    }
  }
  return newest;
}

if (exists(serverDist)) {
  const distM = fs.statSync(serverDist).mtimeMs;
  const srcM = newestMtime(p("server", "src"), ".ts");
  if (srcM > distM) {
    fail(
      "server/dist is STALE: server/src has .ts files newer than dist/index.js. " +
        "Rebuild (`npm run build:server`) — shipping this bundle ships old code.",
    );
  }
}

// 2b. Frontend build must not predate any frontend source file.
//     Same class of hole as the server check above: a frontend change committed
//     without a rebuild ships old UI while every artifact-to-artifact check
//     still agrees with itself. Compare against the source build's BUILD_ID,
//     not the bundle copy, so the check fires before anything is packed.
//     Caveat: git operations refresh mtimes, so a checkout can look "newer"
//     than a build that is in fact current — treat a hit as "verify by hand".
const feBuildId = p("frontend", ".next", "BUILD_ID");
if (exists(feBuildId)) {
  const builtM = fs.statSync(feBuildId).mtimeMs;
  const srcM = newestMtime(p("frontend", "src"), null);
  if (srcM > builtM) {
    fail(
      "frontend/.next is STALE: frontend/src has files newer than BUILD_ID. " +
        "Rebuild (`npm run build:frontend`) — shipping this bundle ships old UI code.",
    );
  }
}

/* ------------------------------------------------------------------ *
 * 3. Secret containment — the real gate.
 *    Read every credential value from the dev .env files and assert the
 *    value does not appear anywhere in the build output that gets shipped.
 *
 *    Only keys whose NAME marks them as credential-bearing are scanned.
 *    Compiled-in defaults such as GEMINI_MODEL / FRONTEND_URL / *_MODEL are
 *    public configuration, not secrets, and flagging them would train the
 *    team to ignore this gate.
 * ------------------------------------------------------------------ */
const ENV_FILES = [
  p("server", ".env"),
  p("frontend", ".env"),
  p(".env"),
];
const SHIP_DIRS = [
  p("server", "dist"),
  frontendStandalone,
  bundleRoot,
];

// A key is credential-bearing if its name says so.
const SECRET_KEY_PATTERN =
  /(SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|WEBHOOK|CREDENTIAL|CONNECTION_STRING|DATABASE_URL|(^|_)KEY($|_))/i;

// Local-only endpoints are development defaults, not credentials. They are
// routinely compiled in as `process.env.X || "mongodb://localhost:27017/..."`
// fallbacks and carry no access.
const LOCAL_ONLY = /(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i;

function readEnvValues(file) {
  if (!exists(file)) return [];
  const out = [];
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    // Only values long enough to be a real credential are worth scanning for.
    if (val.length < 12) continue;
    if (!SECRET_KEY_PATTERN.test(key)) continue;
    if (LOCAL_ONLY.test(val)) continue;
    out.push({ key, val });
  }
  return out;
}

function walkFiles(dir, exts) {
  const files = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === ".git") continue;
        stack.push(full);
      } else if (!exts || exts.some((x) => full.endsWith(x))) {
        files.push(full);
      }
    }
  }
  return files;
}

const secrets = ENV_FILES.flatMap(readEnvValues);

// 3a. .env files must never reach the shipped bundle.
//   - Inside the packed bundle: always a hard failure, whatever it contains.
//   - Inside intermediate build output (Next.js copies frontend/.env into
//     .next/standalone): a hard failure only if it carries credentials, since
//     the packer strips it and the packed-bundle check above is the backstop.
for (const dir of SHIP_DIRS) {
  if (!exists(dir)) continue;
  const isBundle = dir === bundleRoot;
  for (const f of walkFiles(dir, null)) {
    const base = path.basename(f);
    if (base !== ".env" && !/^\.env\.[a-z]+$/i.test(base)) continue;
    // Templates are not secrets. The installer is REQUIRED to ship a template
    // (see desktop/buildHooks/buildApp.js) so a fresh install has a config
    // skeleton; only real credential-bearing .env files are blocking here.
    if (/^\.env\.(example|sample|template)$/i.test(base)) continue;
    const rel = path.relative(ROOT, f);
    if (isBundle) {
      fail(
        `Secret file inside the packed bundle: ${rel} — ` +
          "installers must ship only a .env.example template.",
      );
      continue;
    }
    const content = fs.readFileSync(f, "utf8");
    const credKeys = content
      .split(/\r?\n/)
      .map((l) => l.split("=")[0].trim())
      .filter((k) => k && !k.startsWith("#") && SECRET_KEY_PATTERN.test(k));
    if (credKeys.length) {
      fail(
        `Credential-class keys in ${rel}: ${credKeys.join(", ")}. ` +
          "Build output must never carry credentials.",
      );
    } else {
      warn(
        `${rel} sits in intermediate build output (no credentials). ` +
          "The packer strips it; verify with `npm run preflight:bundle`.",
      );
    }
  }
}

// 3b. No dev secret VALUE may appear in the shipped text output.
if (secrets.length) {
  const SCAN_EXTS = [".js", ".mjs", ".cjs", ".json", ".ts", ".map", ".txt"];
  const reported = new Set();
  for (const dir of SHIP_DIRS) {
    if (!exists(dir)) continue;
    for (const f of walkFiles(dir, SCAN_EXTS)) {
      let content;
      try {
        const stat = fs.statSync(f);
        if (stat.size > 8 * 1024 * 1024) continue; // skip huge bundles
        content = fs.readFileSync(f, "utf8");
      } catch {
        continue;
      }
      for (const { key, val } of secrets) {
        if (!content.includes(val)) continue;
        const rel = path.relative(ROOT, f);
        const sig = `${key}\u0000${rel}`;
        if (reported.has(sig)) continue;
        reported.add(sig);
        fail(
          `LEAK: value of ${key} found in ${rel}. ` +
            "This build must not be released.",
        );
      }
    }
  }
  note(
    `Scanned ${secrets.length} credential value(s) against shipped output ` +
      `(${[...new Set(secrets.map((s) => s.key))].join(", ")}).`,
  );
}

/* ------------------------------------------------------------------ *
 * 4. Desktop dependency pins must be exact (reproducible installer).
 * ------------------------------------------------------------------ */
const desktopPkg = JSON.parse(fs.readFileSync(p("desktop", "package.json"), "utf8"));
for (const section of ["dependencies", "devDependencies"]) {
  for (const [name, spec] of Object.entries(desktopPkg[section] || {})) {
    if (/^[\^~]/.test(spec) || spec === "*" || spec === "latest") {
      fail(
        `desktop/${section}.${name} = "${spec}" is not pinned. ` +
          "Exact versions only — a caret lets today's installer differ from yesterday's.",
      );
    }
  }
}

/* ------------------------------------------------------------------ *
 * 5. Security scanning must be wired up.
 * ------------------------------------------------------------------ */
if (!exists(p(".gitleaks.toml"))) {
  warn("No .gitleaks.toml found at repo root.");
}
const ciFile = p(".github", "workflows", "node-ci.yml");
if (!exists(ciFile)) {
  warn("No .github/workflows/node-ci.yml found.");
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */
console.log("\n=== Hunter Trades — preflight release gate ===\n");
for (const n of notes) console.log(`  ℹ  ${n}`);
for (const w of warnings) console.log(`  ⚠  ${w}`);
if (failures.length === 0) {
  console.log("  ✅ All preflight checks passed.\n");
  process.exit(0);
}
console.error(`  ❌ ${failures.length} blocking issue(s):\n`);
for (const f of failures) console.error(`   - ${f}`);
console.error("");
process.exit(1);
