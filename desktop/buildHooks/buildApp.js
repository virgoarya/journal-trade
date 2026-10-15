const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n======================================================');
console.log('   🔨 Hunter Trades v1.0.5 — Fast Production Builder   ');
console.log('======================================================\n');

const projectRoot = path.resolve(__dirname, '../..');
const desktopDir = path.resolve(projectRoot, 'desktop');
const outDir = path.resolve(desktopDir, 'dist-app', 'win-unpacked');
const resourcesDir = path.join(outDir, 'resources');

function runRobocopy(source, destination, excludeFiles = '') {
    fs.mkdirSync(destination, { recursive: true });
    const xfParam = excludeFiles ? `/XF ${excludeFiles}` : '';
    try {
        execSync(`robocopy "${source}" "${destination}" /E ${xfParam} /MT:16 /R:1 /W:1 /NP /NFL /NDL /NJH /NJS`, { stdio: 'inherit' });
    } catch (e) {
        if (e.status && e.status > 7) {
            console.error(`Robocopy error status ${e.status} from ${source} to ${destination}`);
            throw e;
        }
    }
}

// Windows-safe recursive delete.
// fs.rmSync({recursive, force}) silently leaves a partial tree behind when a
// handle is still open (antivirus/indexer) or when a path exceeds MAX_PATH.
// The leftovers then make `npm ci` die with ENOTEMPTY on rmdir. Retry with
// short backoff, and clear the read-only bit that npm sets on some files.
function removeDirRobust(dir, attempts = 5) {
    if (!fs.existsSync(dir)) return;
    for (let i = 0; i < attempts; i++) {
        try {
            fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
        } catch (e) { /* fall through to verify */ }
        if (!fs.existsSync(dir)) return;
        try {
            execSync(`cmd /c rmdir /s /q "${dir}"`, { stdio: 'ignore' });
        } catch (e) { /* verify below */ }
        if (!fs.existsSync(dir)) return;
        // Last resort: clear read-only attributes, then retry.
        try {
            execSync(`cmd /c attrib -r -s -h "${dir}" /s /d`, { stdio: 'ignore' });
        } catch (e) { /* best effort */ }
        execSync('ping -n 2 127.0.0.1 > nul', { stdio: 'ignore' });
    }
    if (fs.existsSync(dir)) {
        console.error(`❌ Failed to fully remove ${dir} after ${attempts} attempts.`);
        console.error('   A process is holding a handle (antivirus, editor, or a running app).');
        console.error('   Close it and re-run the build.');
        process.exit(1);
    }
}

// 0. Kill any running Hunter Trades / Electron instance before build
try {
    execSync('taskkill /F /IM "Hunter Trades.exe" /T', { stdio: 'ignore' });
} catch (e) {}
try {
    execSync('taskkill /F /IM "electron.exe" /T', { stdio: 'ignore' });
} catch (e) {}

// 1. Clean output directory
console.log(`[1/6] Preparing destination: ${outDir}`);
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

// 2. Copy Electron distribution runtime & binary
const electronDist = path.join(desktopDir, 'node_modules', 'electron', 'dist');
console.log(`[2/6] Copying Electron runtime from ${electronDist}...`);
runRobocopy(electronDist, outDir, 'electron.exe');

// Copy binary directly as Hunter Trades.exe
const targetExe = path.join(outDir, 'Hunter Trades.exe');
fs.copyFileSync(path.join(electronDist, 'electron.exe'), targetExe);
console.log(`  ✓ Copied binary as ${targetExe}`);

// 3. Remove default_app.asar & any legacy app.asar
const defaultAppAsar = path.join(resourcesDir, 'default_app.asar');
if (fs.existsSync(defaultAppAsar)) {
    try { fs.unlinkSync(defaultAppAsar); } catch (e) {}
}
const legacyAppAsar = path.join(resourcesDir, 'app.asar');
if (fs.existsSync(legacyAppAsar)) {
    try { fs.unlinkSync(legacyAppAsar); } catch (e) {}
        }
        // 4. Copy Desktop App Files (main.js, preload.js, package.json, assets) -> resources/app
        const targetApp = path.join(resourcesDir, 'app');
        console.log(`[3/6] Bundling Desktop App to ${targetApp}...`);
        fs.mkdirSync(targetApp, { recursive: true });
        fs.copyFileSync(path.join(desktopDir, 'package.json'), path.join(targetApp, 'package.json'));
        fs.copyFileSync(path.join(desktopDir, 'main.js'), path.join(targetApp, 'main.js'));
        fs.copyFileSync(path.join(desktopDir, 'preload.js'), path.join(targetApp, 'preload.js'));
        // First-run setup wizard files
        fs.copyFileSync(path.join(desktopDir, 'setup.html'), path.join(targetApp, 'setup.html'));
        fs.copyFileSync(path.join(desktopDir, 'preload-setup.js'), path.join(targetApp, 'preload-setup.js'));
        if (fs.existsSync(path.join(desktopDir, 'assets'))) {
            runRobocopy(path.join(desktopDir, 'assets'), path.join(targetApp, 'assets'));
        }
        // Copy entire node_modules for desktop app to ensure all dependencies are present
        runRobocopy(path.join(desktopDir, 'node_modules'), path.join(targetApp, 'node_modules'));


// 5. Copy Server Files -> resources/server
const targetServer = path.join(resourcesDir, 'server');
console.log(`[4/6] Bundling Backend Server to ${targetServer}...`);
fs.mkdirSync(targetServer, { recursive: true });
fs.copyFileSync(path.join(projectRoot, 'server', 'package.json'), path.join(targetServer, 'package.json'));
// Never ship the developer's .env. At runtime the packaged server resolves
// its config from %APPDATA%/hunter-trades/server.env (see resolveEnvFile in
// server/src/index.ts); this template is only the first-run seed and gets
// freshly generated secrets on first launch. Shipping server/.env put 40
// production credentials on every user's disk.
const envExampleSrc = path.join(projectRoot, 'server', '.env.example');
if (!fs.existsSync(envExampleSrc)) {
    console.error('❌ server/.env.example is missing — refusing to build an installer without a config template.');
    process.exit(1);
}
fs.copyFileSync(envExampleSrc, path.join(targetServer, '.env.example'));
if (fs.existsSync(path.join(projectRoot, 'server', 'fetch_rates.py'))) {
    fs.copyFileSync(path.join(projectRoot, 'server', 'fetch_rates.py'), path.join(targetServer, 'fetch_rates.py'));
}
if (fs.existsSync(path.join(projectRoot, 'server', 'trade_api.py'))) {
    fs.copyFileSync(path.join(projectRoot, 'server', 'trade_api.py'), path.join(targetServer, 'trade_api.py'));
}
// Copy Prisma schema for prisma generate
const prismaSchemaSrc = path.join(projectRoot, 'server', 'prisma', 'schema.prisma');
if (fs.existsSync(prismaSchemaSrc)) {
    const prismaDir = path.join(targetServer, 'prisma');
    fs.mkdirSync(prismaDir, { recursive: true });
    fs.copyFileSync(prismaSchemaSrc, path.join(prismaDir, 'schema.prisma'));
    console.log('  ✓ Copied Prisma schema');
}
runRobocopy(path.join(projectRoot, 'server', 'dist'), path.join(targetServer, 'dist'));

// Deterministic dependency install: the lockfile decides which bytes ship.
// A bare `npm install` lets the registry decide at build time, so two builds of
// the same commit could ship different code.
const serverLockSrc = path.join(projectRoot, 'server', 'package-lock.json');
if (!fs.existsSync(serverLockSrc)) {
    console.error('❌ server/package-lock.json is missing — refusing to build a non-reproducible installer.');
    process.exit(1);
}
fs.copyFileSync(serverLockSrc, path.join(targetServer, 'package-lock.json'));
// Copy .npmrc so npm ci respects allowScripts (e.g. 9router postinstall)
const serverNpmrcSrc = path.join(projectRoot, 'server', '.npmrc');
if (fs.existsSync(serverNpmrcSrc)) {
    fs.copyFileSync(serverNpmrcSrc, path.join(targetServer, '.npmrc'));
}
console.log(`[4.1/6] Installing backend dependencies (npm ci)...`);
// Clean node_modules before npm ci to avoid ENOTEMPTY on Windows
const targetNodeModules = path.join(targetServer, 'node_modules');
if (fs.existsSync(targetNodeModules)) {
    console.log('  Cleaning existing node_modules...');
    removeDirRobust(targetNodeModules);
}
try {
    execSync('npm ci', { cwd: targetServer, stdio: 'inherit' });
} catch (e) {
    console.error(`[buildApp] npm ci failed for server: ${e.message}`);
    console.error('[buildApp] Refusing to fall back to copying node_modules from the dev tree.');
    process.exit(1);
}

// 4.2/6 Generate Prisma client (postinstall may be blocked by allowScripts)
const prismaSchemaDest = path.join(targetServer, 'prisma', 'schema.prisma');
if (fs.existsSync(prismaSchemaDest)) {
    console.log('[4.2/6] Generating Prisma client...');
    try {
        execSync('npx prisma generate', { cwd: targetServer, stdio: 'inherit' });
        console.log('  ✓ Prisma client generated');
    } catch (e) {
        console.error(`[buildApp] prisma generate failed: ${e.message}`);
        process.exit(1);
    }
}

// 6. Copy Frontend Files -> resources/frontend
const frontendStandalone = path.join(projectRoot, 'frontend', '.next', 'standalone');
const targetFrontend = path.join(resourcesDir, 'frontend');
console.log(`[5/6] Bundling Frontend Standalone to ${targetFrontend}...`);
if (fs.existsSync(targetFrontend)) {
    removeDirRobust(targetFrontend);
}
fs.mkdirSync(targetFrontend, { recursive: true });

// Determine the actual source directory for the standalone build
let actualSourceFrontendDir = frontendStandalone;
const nestedFrontendDir = path.join(frontendStandalone, 'frontend');
if (fs.existsSync(nestedFrontendDir) && fs.existsSync(path.join(nestedFrontendDir, 'server.js'))) {
    actualSourceFrontendDir = nestedFrontendDir;
}

runRobocopy(actualSourceFrontendDir, targetFrontend, '.env');
// Next.js standalone server reads static assets from .next/static relative to server.js
runRobocopy(path.join(projectRoot, 'frontend', '.next', 'static'), path.join(targetFrontend, '.next', 'static'));
runRobocopy(path.join(projectRoot, 'frontend', 'public'), path.join(targetFrontend, 'public')); // Public assets

// 7. Verify All Requirements
console.log(`[6/6] Verifying bundle integrity...`);
const checks = [
    { name: 'Executable (Hunter Trades.exe)', path: targetExe },
    { name: 'Desktop App Entry (resources/app/main.js)', path: path.join(targetApp, 'main.js') },
    { name: 'Setup Wizard (resources/app/setup.html)', path: path.join(targetApp, 'setup.html') },
    { name: 'Setup Preload (resources/app/preload-setup.js)', path: path.join(targetApp, 'preload-setup.js') },
    { name: 'Backend Entry (resources/server/dist/index.js)', path: path.join(targetServer, 'dist', 'index.js') },
    { name: 'Backend Express Module', path: path.join(targetServer, 'node_modules', 'express') },
    { name: 'Backend 9Router CLI', path: path.join(targetServer, 'node_modules', '.bin', '9router.cmd') },
    { name: 'Frontend Entry (resources/frontend/server.js)', path: path.join(targetFrontend, 'server.js') },
    { name: 'Frontend Next Module', path: path.join(targetFrontend, 'node_modules', 'next') },
    { name: 'Server config template (.env.example)', path: path.join(targetServer, '.env.example') },
];
// Check for nested frontend server.js
const nestedFrontendServerJs = path.join(targetFrontend, 'frontend', 'server.js');
if (fs.existsSync(nestedFrontendServerJs)) {
    checks.push({ name: 'Frontend Entry (resources/frontend/frontend/server.js)', path: nestedFrontendServerJs });
}

let allPassed = true;
for (const check of checks) {
    const exists = fs.existsSync(check.path);
    console.log(`  ${exists ? '✅' : '❌'} ${check.name}`);
    if (!exists) allPassed = false;
}

// Negative assertion: no real .env may exist anywhere in the bundle.
const forbiddenEnv = [
    path.join(targetServer, '.env'),
    path.join(targetFrontend, '.env'),
    path.join(targetFrontend, 'frontend', '.env'),
].filter(fs.existsSync);
if (forbiddenEnv.length) {
    console.error('\n❌ Error: secret .env file(s) present in the bundle:');
    for (const p of forbiddenEnv) console.error('   - ' + p);
    console.error('   Installers must ship a .env.example template, never live credentials.');
    process.exit(1);
}

if (!allPassed) {
    console.error(`\n❌ Error: Some required bundle components are missing.`);
    process.exit(1);
}

console.log('\n======================================================');
console.log('   🎉 Build Complete! Ready to launch:');
console.log(`   📂 ${targetExe}`);
console.log('======================================================\n');
