const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

exports.default = async function(context) {
    console.log(`\n================== [afterPack Hook Starting] ==================`);
    const appOutDir = context.appOutDir;
    const projectDir = context.packager.projectDir;
    const resourcesDir = path.join(appOutDir, 'resources');

    console.log(`appOutDir: ${appOutDir}`);
    console.log(`resourcesDir: ${resourcesDir}`);

    // 1. Copy backend node_modules
    const serverNodeModules = path.resolve(projectDir, '../server/node_modules');
    const targetServerNodeModules = path.join(resourcesDir, 'server', 'node_modules');
    console.log(`[afterPack] Copying server node_modules -> ${targetServerNodeModules}`);
    fs.mkdirSync(targetServerNodeModules, { recursive: true });
    try {
        execSync(`robocopy "${serverNodeModules}" "${targetServerNodeModules}" /E /MT:16 /R:1 /W:1 /NP /NFL /NDL /NJH /NJS`, { stdio: 'inherit' });
    } catch (e) {
        // Robocopy returns exit code 1-7 for successful copies with changes
    }

    // 2. Copy frontend standalone bundle (server.js, .next, node_modules, package.json)
    const frontendStandaloneDir = path.resolve(projectDir, '../frontend/.next/standalone/frontend');
    const targetFrontend = path.join(resourcesDir, 'frontend');
    console.log(`[afterPack] Copying frontend standalone -> ${targetFrontend}`);
    fs.mkdirSync(targetFrontend, { recursive: true });
    try {
        execSync(`robocopy "${frontendStandaloneDir}" "${targetFrontend}" /E /MT:16 /R:1 /W:1 /NP /NFL /NDL /NJH /NJS`, { stdio: 'inherit' });
    } catch (e) {}

    // 3. Copy frontend .next/static
    const frontendStatic = path.resolve(projectDir, '../frontend/.next/static');
    const targetFrontendStatic = path.join(targetFrontend, '.next', 'static');
    console.log(`[afterPack] Copying frontend static -> ${targetFrontendStatic}`);
    fs.mkdirSync(targetFrontendStatic, { recursive: true });
    try {
        execSync(`robocopy "${frontendStatic}" "${targetFrontendStatic}" /E /MT:16 /R:1 /W:1 /NP /NFL /NDL /NJH /NJS`, { stdio: 'inherit' });
    } catch (e) {}

    // 4. Copy frontend public
    const frontendPublic = path.resolve(projectDir, '../frontend/public');
    const targetFrontendPublic = path.join(targetFrontend, 'public');
    console.log(`[afterPack] Copying frontend public -> ${targetFrontendPublic}`);
    fs.mkdirSync(targetFrontendPublic, { recursive: true });
    try {
        execSync(`robocopy "${frontendPublic}" "${targetFrontendPublic}" /E /MT:16 /R:1 /W:1 /NP /NFL /NDL /NJH /NJS`, { stdio: 'inherit' });
    } catch (e) {}

    // 5. Verification
    const hasNext = fs.existsSync(path.join(targetFrontend, 'node_modules', 'next'));
    const hasServerJs = fs.existsSync(path.join(targetFrontend, 'server.js'));
    const hasExpress = fs.existsSync(path.join(targetServerNodeModules, 'express'));
    console.log(`[afterPack] Verification in ${resourcesDir}:`);
    console.log(`  - hasNext: ${hasNext}`);
    console.log(`  - hasServerJs: ${hasServerJs}`);
    console.log(`  - hasExpress: ${hasExpress}`);

    if (!hasNext || !hasServerJs || !hasExpress) {
        throw new Error(`[afterPack] Verification failed! Required resources are missing.`);
    }

    console.log(`================== [afterPack Hook Complete] ==================\n`);
};
