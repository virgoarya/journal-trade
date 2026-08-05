const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

console.log('\n======================================================');
console.log('   🔨 Hunter Trades — Building OTA Patch              ');
console.log('======================================================\n');

const projectRoot = path.resolve(__dirname, '../..');
const desktopDir = path.resolve(projectRoot, 'desktop');
const resourcesDir = path.resolve(desktopDir, 'dist-app', 'win-unpacked', 'resources');
const patchDir = path.resolve(projectRoot, 'update');

if (!fs.existsSync(resourcesDir)) {
    console.error(`❌ Resources directory not found: ${resourcesDir}`);
    console.error('Please run "npm run build:fast" first to generate the unpacked app.');
    process.exit(1);
}

if (!fs.existsSync(patchDir)) {
    fs.mkdirSync(patchDir, { recursive: true });
}

const packageJson = require(path.join(desktopDir, 'package.json'));
const version = packageJson.version;

console.log(`[1/3] Preparing patch for version ${version}...`);

const { execSync } = require('child_process');

console.log(`[2/3] Adding files to archive using tar.exe...`);
const patchPath = path.join(patchDir, 'patch.zip');

if (fs.existsSync(patchPath)) {
    fs.rmSync(patchPath, { force: true });
}

try {
    const zip = new AdmZip();
    
    // Helper to add local folder recursively excluding node_modules
    function addDirToZip(dirPath, zipPath) {
        if (!fs.existsSync(dirPath)) return;
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
            if (item === 'node_modules') continue;
            
            const fullPath = path.join(dirPath, item);
            const relativePath = zipPath ? `${zipPath}/${item}` : item;
            
            if (fs.statSync(fullPath).isDirectory()) {
                addDirToZip(fullPath, relativePath);
            } else {
                zip.addLocalFile(fullPath, zipPath);
            }
        }
    }

    addDirToZip(path.join(resourcesDir, 'app'), 'app');
    addDirToZip(path.join(resourcesDir, 'server'), 'server');
    addDirToZip(path.join(resourcesDir, 'frontend'), 'frontend');

    zip.writeZip(patchPath);
} catch (error) {
    console.error(`❌ Failed to create zip file using adm-zip:`, error.message);
    process.exit(1);
}

console.log(`[3/4] Calculating checksum...`);
const fileBuffer = fs.readFileSync(patchPath);
const hashSum = crypto.createHash('sha256');
hashSum.update(fileBuffer);
const checksum = hashSum.digest('hex');
console.log(`  ✓ SHA-256: ${checksum}`);

console.log(`[4/4] Generating version.json...`);
const versionData = {
    version: version,
    releaseDate: new Date().toISOString(),
    patchUrl: "https://raw.githubusercontent.com/virgoarya/journal-trade/main/update/patch.zip",
    checksum: checksum,
    notes: "Update patch for " + version
};
fs.writeFileSync(path.join(patchDir, 'version.json'), JSON.stringify(versionData, null, 2));

console.log(`\n✅ OTA Patch built successfully!`);
console.log(`📂 Output Directory: ${patchDir}`);
console.log(`\nNext Steps:`);
console.log(`1. Commit and push the contents of 'desktop/dist-patch' to GitHub.`);
console.log(`2. Ensure they are available at the URL configured in the app.`);
