import { readdirSync, copyFileSync, mkdirSync, existsSync, rmdirSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';

const frontendDir = join(process.cwd(), '..', 'frontend');
const distDir = join(process.cwd(), 'dist');

// Ensure dist/public exists
const publicDist = join(distDir, 'public');
if (existsSync(publicDist)) {
  // Clean up old files
  const files = readdirSync(publicDist, { withFileTypes: true });
  for (const file of files) {
    const filePath = join(publicDist, file.name);
    if (file.isDirectory()) {
      rmdirSync(filePath, { recursive: true });
    } else {
      unlinkSync(filePath);
    }
  }
} else {
  mkdirSync(publicDist, { recursive: true });
}

// Copy public folder
const frontendPublic = join(frontendDir, 'public');
if (existsSync(frontendPublic)) {
  copyDirSync(frontendPublic, publicDist);
  console.log('Copied public folder');
}

// Handle .next build output
const frontendNextDir = join(frontendDir, '.next');
const nextDist = join(distDir, '_next');

if (existsSync(frontendNextDir)) {
  // Remove old _next if exists
  if (existsSync(nextDist)) {
    rmdirSync(nextDist, { recursive: true });
  }

  // Copy .next to _next, but exclude server directory
  copyDirExcluding(frontendNextDir, nextDist, ['server', 'cache']);
  console.log('Copied .next directory (excluding server)');

  // Ensure manifest exists at _next/static/... (already copied above)
} else {
  console.warn('Frontend .next directory not found. Make sure frontend is built.');
}

console.log('✅ Frontend build files copied successfully');

function copyDirSync(src, dest) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

function copyDirExcluding(src, dest, exclude) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (exclude.includes(entry.name)) {
      continue;
    }
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirExcluding(srcPath, destPath, exclude);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}
