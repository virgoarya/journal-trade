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
fs.copyFileSync(path.join(projectRoot, 'server', '.env'), path.join(targetServer, '.env'));
if (fs.existsSync(path.join(projectRoot, 'server', 'fetch_rates.py'))) {
    fs.copyFileSync(path.join(projectRoot, 'server', 'fetch_rates.py'), path.join(targetServer, 'fetch_rates.py'));
}
runRobocopy(path.join(projectRoot, 'server', 'dist'), path.join(targetServer, 'dist'));

    // Use regular install instead of production to ensure devDependencies like 9router CLI are available
    console.log(`[4.1/6] Installing dependencies for backend server...`);
    try {
        execSync('npm install', { cwd: targetServer, stdio: 'inherit' });
    } catch (e) {
        console.warn(`[buildApp] npm install failed for server: ${e.message}`);
        // Fallback to robocopy
        runRobocopy(path.join(projectRoot, 'server', 'node_modules'), path.join(targetServer, 'node_modules'));
    }


// 6. Copy Frontend Files -> resources/frontend
const targetFrontend = path.join(resourcesDir, 'frontend');
console.log(`[5/6] Bundling Frontend Standalone to ${targetFrontend}...`);
if (fs.existsSync(targetFrontend)) {
    fs.rmSync(targetFrontend, { recursive: true, force: true });
}
fs.mkdirSync(targetFrontend, { recursive: true });

const frontendStandalone = path.join(projectRoot, 'frontend', '.next', 'standalone');
const standaloneInner = path.join(frontendStandalone, 'frontend');
const sourceFrontend = fs.existsSync(standaloneInner) ? standaloneInner : frontendStandalone;

runRobocopy(sourceFrontend, targetFrontend);
runRobocopy(path.join(projectRoot, 'frontend', '.next', 'static'), path.join(targetFrontend, '.next', 'static'));
runRobocopy(path.join(projectRoot, 'frontend', 'public'), path.join(targetFrontend, 'public'));

// 7. Verify All Requirements
console.log(`[6/6] Verifying bundle integrity...`);
const checks = [
    { name: 'Executable (Hunter Trades.exe)', path: targetExe },
    { name: 'Desktop App Entry (resources/app/main.js)', path: path.join(targetApp, 'main.js') },
    { name: 'Backend Entry (resources/server/dist/index.js)', path: path.join(targetServer, 'dist', 'index.js') },
    { name: 'Backend Express Module', path: path.join(targetServer, 'node_modules', 'express') },
    { name: 'Frontend Entry (resources/frontend/server.js)', path: path.join(targetFrontend, 'server.js') },
    { name: 'Frontend Next Module', path: path.join(targetFrontend, 'node_modules', 'next') },
];

let allPassed = true;
for (const check of checks) {
    const exists = fs.existsSync(check.path);
    console.log(`  ${exists ? '✅' : '❌'} ${check.name}`);
    if (!exists) allPassed = false;
}

if (!allPassed) {
    console.error(`\n❌ Error: Some required bundle components are missing.`);
    process.exit(1);
}

console.log('\n======================================================');
console.log('   🎉 Build Complete! Ready to launch:');
console.log(`   📂 ${targetExe}`);
console.log('======================================================\n');
