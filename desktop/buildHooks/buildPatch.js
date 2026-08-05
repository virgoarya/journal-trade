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
const patchDir = path.resolve(desktopDir, 'dist-patch');

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
    // We use tar.exe built-in on Windows 10+ to create a zip file (-a auto-detects from .zip extension)
    // We exclude node_modules to keep the OTA patch small (< 100MB for GitHub)
    execSync(`tar.exe -a -c -f "${patchPath}" --exclude=node_modules app server frontend`, {
        cwd: resourcesDir,
        stdio: 'inherit'
    });
} catch (error) {
    console.error(`❌ Failed to create zip file using tar.exe:`, error.message);
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
