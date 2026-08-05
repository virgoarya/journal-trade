const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectDir = path.resolve(__dirname, '..');
const appOutDir = path.resolve(projectDir, 'dist-build', 'win-unpacked');
const resourcesDir = path.join(appOutDir, 'resources');

console.log(`\n================== [Copy Resources Starting] ==================`);
console.log(`appOutDir: ${appOutDir}`);
console.log(`resourcesDir: ${resourcesDir}`);

if (!fs.existsSync(appOutDir)) {
    console.error(`[copyResources] appOutDir does not exist: ${appOutDir}`);
    process.exit(1);
}

function runRobocopy(source, destination) {
    fs.mkdirSync(destination, { recursive: true });
    try {
        execSync(`robocopy "${source}" "${destination}" /E /MT:16 /R:1 /W:1 /NP /NFL /NDL /NJH /NJS`, { stdio: 'inherit' });
    } catch (e) {
        // Robocopy returns exit code 0-7 for normal copy operations
        if (e.status && e.status > 7) {
            console.error(`Robocopy error status ${e.status} from ${source} to ${destination}`);
            throw e;
        }
    }
}

// 1. Copy backend node_modules
const serverNodeModules = path.resolve(projectDir, '../server/node_modules');
const targetServerNodeModules = path.join(resourcesDir, 'server', 'node_modules');
console.log(`[copyResources] Copying server node_modules -> ${targetServerNodeModules}`);
runRobocopy(serverNodeModules, targetServerNodeModules);

// 2. Copy frontend standalone bundle (server.js, package.json, .next, node_modules)
const frontendStandaloneDir = path.resolve(projectDir, '../frontend/.next/standalone/frontend');
const targetFrontend = path.join(resourcesDir, 'frontend');
console.log(`[copyResources] Copying frontend standalone -> ${targetFrontend}`);
runRobocopy(frontendStandaloneDir, targetFrontend);

// 3. Copy frontend static assets (.next/static)
const frontendStatic = path.resolve(projectDir, '../frontend/.next/static');
const targetFrontendStatic = path.join(targetFrontend, '.next', 'static');
console.log(`[copyResources] Copying frontend static -> ${targetFrontendStatic}`);
runRobocopy(frontendStatic, targetFrontendStatic);

// 4. Copy frontend public assets (public/)
const frontendPublic = path.resolve(projectDir, '../frontend/public');
const targetFrontendPublic = path.join(targetFrontend, 'public');
console.log(`[copyResources] Copying frontend public -> ${targetFrontendPublic}`);
runRobocopy(frontendPublic, targetFrontendPublic);

// 5. Verification
const hasNext = fs.existsSync(path.join(targetFrontend, 'node_modules', 'next'));
const hasServerJs = fs.existsSync(path.join(targetFrontend, 'server.js'));
const hasExpress = fs.existsSync(path.join(targetServerNodeModules, 'express'));
console.log(`[copyResources] Verification in ${resourcesDir}:`);
console.log(`  - hasNext: ${hasNext}`);
console.log(`  - hasServerJs: ${hasServerJs}`);
console.log(`  - hasExpress: ${hasExpress}`);

if (!hasNext || !hasServerJs || !hasExpress) {
    console.error(`[copyResources] Verification failed! Required resources are missing.`);
    process.exit(1);
}

console.log(`================== [Copy Resources Complete] ==================\n`);
