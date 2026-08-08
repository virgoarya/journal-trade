// ─────────────────────────────────────────────────────────────
// Hunter Trades Desktop — Electron Main Process
// Server orchestrator: starts backend + frontend, manages window & tray
// ─────────────────────────────────────────────────────────────

const { app, BrowserWindow, Tray, Menu, shell, nativeImage, dialog, utilityProcess, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const axios = require("axios");
const AdmZip = require("adm-zip");
const crypto = require("crypto");
const path = require("path");
const { spawn, fork, execFile } = require("child_process");
const http = require("http");
const fs = require("fs");
const os = require("os");

// ─── Configuration ───────────────────────────────────────────
const BACKEND_PORT = 5000;
const FRONTEND_PORT = 3000;
const isDev = !app.isPackaged;

// ─── Hardware & System Diagnostics ───────────────────────────
function logSystemDiagnostics() {
  const totalRamGb = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1);
  const freeRamGb = (os.freemem() / (1024 * 1024 * 1024)).toFixed(1);
  const cpuCount = os.cpus().length;
  const cpuModel = os.cpus()[0]?.model || "Unknown CPU";

  console.log("─────────────────────────────────────────────────────────────");
  console.log("🚀 Hunter Trades Desktop Initializing");
  console.log(`💻 OS: ${os.type()} ${os.release()} (${os.arch()})`);
  console.log(`⚡ CPU: ${cpuModel} (${cpuCount} cores)`);
  console.log(`🧠 RAM: ${totalRamGb} GB (Free: ${freeRamGb} GB)`);
  console.log(`🌐 Environment: ${isDev ? "Development" : "Production (Packaged)"}`);
  console.log("─────────────────────────────────────────────────────────────");

  if (os.totalmem() < 3.5 * 1024 * 1024 * 1024) {
    console.warn("⚠️ Warning: System has less than 4GB RAM. AI models and backtests may run slower.");
  }
}

// ─── Path Resolution ─────────────────────────────────────────
function getResourcePath(...segments) {
  if (isDev) {
    return path.join(__dirname, "..", ...segments);
  }
  return path.join(process.resourcesPath, ...segments);
}

// ─── State ───────────────────────────────────────────────────
let mainWindow = null;
let splashWindow = null;
let tray = null;
let backendProcess = null;
let frontendProcess = null;
let routerProcess = null;
let isQuitting = false;

// ─── .env Loader ─────────────────────────────────────────────
function loadEnvFile(envPath) {
  const env = {};
  if (!fs.existsSync(envPath)) return env;
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    env[key] = value;
  }
  return env;
}

// ─── Port Checker ────────────────────────────────────────────
function isPortResponding(port, checkPath = "/") {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}${checkPath}`, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

let backendLastStderr = "";
let frontendLastStderr = "";
let logDir = null;

function appendToLog(filename, str) {
  try {
    if (!logDir) {
      logDir = path.join(app.getPath("userData"), "logs");
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(path.join(logDir, filename), str, "utf-8");
  } catch (err) {
    // Ignore log write failure
  }
}

function getLogStream(filename) {
  return {
    write: (str) => appendToLog(filename, str),
  };
}

// Redirect main process logs to main.log
try {
  const origLog = console.log;
  const origErr = console.error;
  const origWarn = console.warn;
  console.log = (...args) => {
    origLog(...args);
    appendToLog("main.log", `[${new Date().toISOString()}] [INFO] ${args.map(a => typeof a === "object" ? JSON.stringify(a) : a).join(" ")}\n`);
  };
  console.warn = (...args) => {
    origWarn(...args);
    appendToLog("main.log", `[${new Date().toISOString()}] [WARN] ${args.map(a => typeof a === "object" ? JSON.stringify(a) : a).join(" ")}\n`);
  };
  console.error = (...args) => {
    origErr(...args);
    appendToLog("main.log", `[${new Date().toISOString()}] [ERR] ${args.map(a => typeof a === "object" ? JSON.stringify(a) : a).join(" ")}\n`);
  };
} catch (e) {
  // Ignore
}

process.on("uncaughtException", (err) => {
  console.error("[FATAL uncaughtException]", err.stack || err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("[FATAL unhandledRejection]", reason?.stack || reason);
});

// Kill leftover processes on backend and frontend ports
function killProcessOnPort(port) {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`).toString();
    const lines = output.trim().split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '' && !isNaN(pid)) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
          console.log(`[MAIN] Killed leftover process PID ${pid} on port ${port}`);
        } catch {
          // Ignore if already dead or access denied
        }
      }
    }
  } catch (err) {
    // No process found on port
  }
}

// Clean up any leftover processes on our ports before starting
killProcessOnPort(BACKEND_PORT);
killProcessOnPort(FRONTEND_PORT);

async function startBackend() {
  // Check if backend is already responding on port 5000
  const isUp = await isPortResponding(BACKEND_PORT, "/health");
  if (isUp) {
    console.log(`[MAIN] Backend is already running on port ${BACKEND_PORT}. Skipping spawn.`);
    return;
  }

  const serverCwd = isDev
    ? path.join(__dirname, "..", "server")
    : path.join(process.resourcesPath, "server");

  const envFilePath = path.join(serverCwd, ".env");
  const fileEnv = loadEnvFile(envFilePath);
  const logStream = getLogStream("backend.log");

  if (isDev) {
    const command = process.platform === "win32" ? "npx.cmd" : "npx";
    console.log(`[MAIN] Starting backend (dev): ${command} tsx src/index.ts`);
    backendProcess = spawn(command, ["tsx", "src/index.ts"], {
      cwd: serverCwd,
      env: {
        ...process.env,
        ...fileEnv,
        PORT: String(BACKEND_PORT),
        NODE_ENV: "development",
        PYTHONIOENCODING: "utf-8",
        FRONTEND_URL: `http://localhost:${FRONTEND_PORT}`,
        BETTER_AUTH_URL: `http://localhost:${BACKEND_PORT}`,
      },
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    backendProcess.stdout?.on("data", (d) => {
      const msg = d.toString().trim();
      if (msg) console.log(`[BACKEND] ${msg}`);
      if (logStream) logStream.write(`[${new Date().toISOString()}] ${d.toString()}`);
    });
    backendProcess.stderr?.on("data", (d) => {
      const msg = d.toString().trim();
      if (msg) {
        console.error(`[BACKEND] ${msg}`);
        backendLastStderr = msg.slice(-500);
      }
      if (logStream) logStream.write(`[${new Date().toISOString()}] [ERR] ${d.toString()}`);
    });
    backendProcess.on("exit", (code) => {
      console.log(`[MAIN] Backend exited with code ${code}`);
      if (!isQuitting && code !== 0) {
        console.log("[MAIN] Restarting backend in 3s...");
        setTimeout(startBackend, 3000);
      }
    });
  } else {
    const serverScript = path.join(serverCwd, "dist", "index.js");
    console.log(`[MAIN] Starting backend (production fork): ${serverScript}`);

    const forkEnv = {
      ...process.env,
      ...fileEnv,
      PORT: String(BACKEND_PORT),
      NODE_ENV: "production",
      PYTHONIOENCODING: "utf-8",
      FRONTEND_URL: `http://localhost:${FRONTEND_PORT}`,
      BETTER_AUTH_URL: `http://localhost:${BACKEND_PORT}`,
      NODE_PATH: path.join(serverCwd, "node_modules"),
    };

    backendProcess = require("child_process").fork(serverScript, [], {
      cwd: serverCwd,
      env: forkEnv,
      stdio: "pipe",
    });

    backendProcess.stdout?.on("data", (d) => {
      const msg = d.toString().trim();
      if (msg) console.log(`[BACKEND] ${msg}`);
      if (logStream) logStream.write(`[${new Date().toISOString()}] ${d.toString()}`);
    });
    backendProcess.stderr?.on("data", (d) => {
      const msg = d.toString().trim();
      if (msg) {
        console.error(`[BACKEND] ${msg}`);
        backendLastStderr = msg.slice(-500);
      }
      if (logStream) logStream.write(`[${new Date().toISOString()}] [ERR] ${d.toString()}`);
    });
    backendProcess.on("error", (err) => {
      console.error(`[MAIN] Backend process error: ${err.message}`);
      backendLastStderr = err.message;
      if (logStream) logStream.write(`[${new Date().toISOString()}] [ERR] ${err.stack || err.message}\n`);
    });
    backendProcess.on("exit", (code) => {
      console.log(`[MAIN] Backend exited with code ${code}`);
      if (!isQuitting && code !== 0) {
        console.log("[MAIN] Restarting backend in 3s...");
        setTimeout(startBackend, 3000);
      }
    });
  }
}

async function startRouter() {
  const isUp = await isPortResponding(20128, "/");
  if (isUp) {
    console.log(`[MAIN] 9Router is already running on port 20128. Skipping spawn.`);
    return;
  }

  const serverCwd = isDev
    ? path.join(__dirname, "..", "server")
    : path.join(process.resourcesPath, "server");
  
  const logStream = getLogStream("9router.log");

  console.log(`[MAIN] Starting 9Router proxy on port 20128...`);
  const nineRouterBinPath = path.join(serverCwd, "node_modules", ".bin", "9router.cmd");
  
  routerProcess = spawn(nineRouterBinPath, ["--tray", "--skip-update", "-p", "20128"], {
    cwd: serverCwd,
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
    shell: true, // Use shell for .cmd files on Windows
  });

  routerProcess.stdout?.on("data", (d) => {
    const msg = d.toString().trim();
    if (msg) console.log(`[9ROUTER] ${msg}`);
    if (logStream) logStream.write(`[${new Date().toISOString()}] ${d.toString()}`);
  });
  
  routerProcess.stderr?.on("data", (d) => {
    const msg = d.toString().trim();
    if (msg) console.error(`[9ROUTER] ${msg}`);
    if (logStream) logStream.write(`[${new Date().toISOString()}] [ERR] ${d.toString()}`);
  });
  
  routerProcess.on("exit", (code) => {
    console.log(`[MAIN] 9Router launcher exited with code ${code}`);
    // With --tray, it spawns a detached bg process and exits with 0.
    if (!isQuitting && code !== 0) {
      setTimeout(startRouter, 3000);
    }
  });
}

async function startFrontend() {
  const isUp = await isPortResponding(FRONTEND_PORT, "/");
  if (isUp) {
    console.log(`[MAIN] Frontend is already running on port ${FRONTEND_PORT}. Skipping spawn.`);
    return;
  }

  const logStream = getLogStream("frontend.log");

  if (isDev) {
    console.log("[MAIN] Dev mode: starting frontend via npm run dev...");
    const frontendDir = path.join(__dirname, "..", "frontend");
    const command = process.platform === "win32" ? "npm.cmd" : "npm";
    frontendProcess = spawn(command, ["run", "dev"], {
      cwd: frontendDir,
      env: {
        ...process.env,
        PORT: String(FRONTEND_PORT),
        HOSTNAME: "0.0.0.0",
        BACKEND_URL: `http://localhost:${BACKEND_PORT}`,
      },
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    frontendProcess.stdout?.on("data", (d) => {
      const msg = d.toString().trim();
      if (msg) console.log(`[FRONTEND] ${msg}`);
      if (logStream) logStream.write(`[${new Date().toISOString()}] ${d.toString()}`);
    });
    frontendProcess.stderr?.on("data", (d) => {
      const msg = d.toString().trim();
      if (msg) {
        console.error(`[FRONTEND] ${msg}`);
        frontendLastStderr = msg.slice(-500);
      }
      if (logStream) logStream.write(`[${new Date().toISOString()}] [ERR] ${d.toString()}`);
    });
    frontendProcess.on("exit", (code) => {
      console.log(`[MAIN] Frontend exited with code ${code}`);
      if (!isQuitting && code !== 0) {
        setTimeout(startFrontend, 3000);
      }
    });
    return;
  }

  const frontendDir = path.join(process.resourcesPath, "frontend");
  const serverJs = path.join(frontendDir, "server.js");

  if (!fs.existsSync(serverJs)) {
    console.error(`[MAIN] Frontend server.js not found at: ${serverJs}`);
    frontendLastStderr = `Frontend server.js not found at: ${serverJs}`;
    return;
  }

  console.log(`[MAIN] Starting frontend (production utilityProcess): ${serverJs}`);

  frontendProcess = require("child_process").fork(serverJs, [], {
    cwd: frontendDir,
    env: {
      ...process.env,
      PORT: String(FRONTEND_PORT),
      HOSTNAME: "0.0.0.0",
      NODE_ENV: "production",
      BACKEND_URL: `http://localhost:${BACKEND_PORT}`,
      NODE_PATH: path.join(frontendDir, "node_modules"),
    },
    stdio: "pipe",
  });

  frontendProcess.stdout?.on("data", (d) => {
    const msg = d.toString().trim();
    if (msg) console.log(`[FRONTEND] ${msg}`);
    if (logStream) logStream.write(`[${new Date().toISOString()}] ${d.toString()}`);
  });
  frontendProcess.stderr?.on("data", (d) => {
    const msg = d.toString().trim();
    if (msg) {
      console.error(`[FRONTEND] ${msg}`);
      frontendLastStderr = msg.slice(-500);
    }
    if (logStream) logStream.write(`[${new Date().toISOString()}] [ERR] ${d.toString()}`);
  });
  frontendProcess.on("error", (err) => {
    console.error(`[MAIN] Frontend process error: ${err.message}`);
    frontendLastStderr = err.message;
    if (logStream) logStream.write(`[${new Date().toISOString()}] [ERR] ${err.stack || err.message}\n`);
  });
  frontendProcess.on("exit", (code) => {
    console.log(`[MAIN] Frontend exited with code ${code}`);
    if (!isQuitting && code !== 0) {
      setTimeout(startFrontend, 3000);
    }
  });
}

// ─── MT5 Bridge ─────────────────────────────────────────────
// Python bridge has been removed. MT5 data is now provided by
// the native MetaTrader 5 built-in MCP server (port 22346).
// The backend connects automatically via SSE on startup.

// ─── Wait for Server ─────────────────────────────────────────
function waitForServer(port, checkPath = "/health", timeout = 60000, serverName = "Server", getLastError = null) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}${checkPath}`, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeout) {
          const errDetail = getLastError ? getLastError() : "";
          reject(new Error(`${serverName} on port ${port} did not start within ${timeout / 1000}s.${errDetail ? '\nDetails: ' + errDetail : ''}`));
        } else {
          setTimeout(check, 800);
        }
      });
      req.setTimeout(2500, () => {
        req.destroy();
        if (Date.now() - start > timeout) {
          const errDetail = getLastError ? getLastError() : "";
          reject(new Error(`${serverName} on port ${port} timed out.${errDetail ? '\nDetails: ' + errDetail : ''}`));
        } else {
          setTimeout(check, 800);
        }
      });
    };
    check();
  });
}

// ─── Splash Screen ──────────────────────────────────────────
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 360,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: path.join(__dirname, "assets", "icon.ico"),
    webPreferences: {
      contextIsolation: true,
    },
  });
  splashWindow.loadFile(path.join(__dirname, "assets", "splash.html"), {
    query: { version: app.getVersion() }
  });
  splashWindow.center();
}

// ─── Main Window ────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Hunter Trades",
    icon: path.join(__dirname, "assets", "icon.ico"),
    show: false,
    backgroundColor: "#0A0A0A",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: isDev,
    },
  });

  const targetUrl = `http://localhost:${FRONTEND_PORT}`;
  mainWindow.loadURL(targetUrl);

  // Remove default menu bar
  mainWindow.setMenuBarVisibility(false);

  // Auto-retry on load failure (e.g. Next.js still compiling route)
  mainWindow.webContents.on("did-fail-load", () => {
    console.warn(`[MAIN] Failed to load ${targetUrl}. Retrying in 2s...`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(targetUrl);
      }
    }, 2000);
  });

  mainWindow.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.focus();
  });

  // Close = minimize to tray (server keeps running)
  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // ─── OAuth Navigation Handling ──────────────────────────────
  // Allow Discord OAuth flow: let the BrowserWindow navigate to discord.com
  // and then redirect back to localhost after auth completes.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const parsedUrl = new URL(url);
    const allowedHosts = ["discord.com", "discordapp.com", "localhost", "127.0.0.1"];
    if (allowedHosts.some(h => parsedUrl.hostname === h || parsedUrl.hostname.endsWith(`.${h}`))) {
      console.log(`[MAIN] Allowing navigation to: ${url}`);
      // Allow navigation — do nothing (don't prevent default)
    } else {
      console.log(`[MAIN] Blocking navigation to external URL: ${url}`);
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Handle window.open() calls (e.g., popups from OAuth)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const parsedUrl = new URL(url);
    const allowedHosts = ["discord.com", "discordapp.com", "localhost", "127.0.0.1"];
    if (allowedHosts.some(h => parsedUrl.hostname === h || parsedUrl.hostname.endsWith(`.${h}`))) {
      console.log(`[MAIN] Allowing popup to: ${url}`);
      return { action: "allow" };
    }
    console.log(`[MAIN] Redirecting popup to external browser: ${url}`);
    shell.openExternal(url);
    return { action: "deny" };
  });
}

// ─── Local IP Detection ─────────────────────────────────────
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}

// ─── System Tray ──────────────────────────────────// ─── OTA Updater Implementation ───────────────────────────────────────
const OTA_VERSION_URL = "https://raw.githubusercontent.com/virgoarya/journal-trade/main/update/version.json";

function setupAutoUpdater() {
  if (isDev) {
    console.log("[OTA-UPDATER] Running in dev mode, skipping updates.");
    return;
  }
  
  const currentVersion = app.getVersion();

  async function checkOtaUpdate() {
    try {
      console.log(`[OTA-UPDATER] Checking for updates (current: ${currentVersion})...`);
      const response = await axios.get(`${OTA_VERSION_URL}?t=${Date.now()}`);
      const remoteInfo = response.data;
      
      if (!remoteInfo || !remoteInfo.version) return;

      // Simple version compare (assumes semver e.g., 1.0.5)
      const isNewer = remoteInfo.version.localeCompare(currentVersion, undefined, { numeric: true, sensitivity: 'base' }) > 0;
      
      if (isNewer) {
        console.log(`[OTA-UPDATER] Update available: v${remoteInfo.version}`);
        sendToRenderer("updater:status", {
          status: "downloaded", // We mock downloaded so the UI asks to install immediately
          version: remoteInfo.version,
          releaseNotes: remoteInfo.notes || "A new update is available.",
          patchUrl: remoteInfo.patchUrl
        });
      }
    } catch (err) {
      console.warn("[OTA-UPDATER] Update check failed:", err.message);
    }
  }

  // Check on startup after 10s
  setTimeout(checkOtaUpdate, 10000);
  // Periodic check every 1 hour
  setInterval(checkOtaUpdate, 60 * 60 * 1000);
}

// IPC Handlers for Updater
ipcMain.handle("updater:check-now", async () => {
  if (isDev) {
    return { status: "dev-mode", message: "Auto-updater is disabled in dev mode." };
  }
  return { status: "success", message: "OTA update check running in background." };
});

ipcMain.on("updater:quit-and-install", async (event) => {
  console.log("[OTA-UPDATER] Applying OTA Patch...");
  
  const tempZipPath = path.join(app.getPath("temp"), "hunter_trades_patch.zip");
  const backupPath = process.resourcesPath + "_backup";
  const otaFlagPath = path.join(app.getPath("userData"), "ota_updating.txt");

  try {
    // 1. Fetch latest version info for patch URL and checksum
    const responseInfo = await axios.get(`${OTA_VERSION_URL}?t=${Date.now()}`);
    const remoteInfo = responseInfo.data;
    if (!remoteInfo || !remoteInfo.patchUrl) throw new Error("Invalid version data from server");

    // 2. Download zip with progress tracking & timeout
    console.log(`[OTA-UPDATER] Downloading patch from: ${remoteInfo.patchUrl}`);
    const response = await axios.request({
      url: remoteInfo.patchUrl,
      method: 'GET',
      responseType: 'arraybuffer',
      timeout: 30000, // 30 second timeout
      onDownloadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total || 1)
        );
        console.log(`[OTA-UPDATER] Download progress: ${percentCompleted}% (${(progressEvent.loaded / 1024 / 1024).toFixed(2)} MB / ${(progressEvent.total / 1024 / 1024).toFixed(2)} MB)`);
        // Send progress to renderer UI
        sendToRenderer("updater:status", {
          status: "downloading",
          version: remoteInfo.version,
          progress: percentCompleted,
          message: `Mendownload patch... ${percentCompleted}% (${(progressEvent.loaded / 1024 / 1024).toFixed(2)} MB / ${(progressEvent.total / 1024 / 1024).toFixed(2)} MB)`
        });
      }
    });
    const fileBuffer = response.data;
    
    // 3. Verify Checksum
    if (remoteInfo.checksum) {
      console.log(`[OTA-UPDATER] Verifying checksum...`);
      const hashSum = crypto.createHash('sha256');
      hashSum.update(fileBuffer);
      const calculatedChecksum = hashSum.digest('hex');
      if (calculatedChecksum !== remoteInfo.checksum) {
        throw new Error(`Checksum mismatch! Expected ${remoteInfo.checksum}, got ${calculatedChecksum}. Patch file might be corrupted.`);
      }
      console.log(`[OTA-UPDATER] Checksum OK!`);
    }

    fs.writeFileSync(tempZipPath, fileBuffer);

    // 4. Create Backup (Auto-Rollback Layer)
    console.log(`[OTA-SAFETY] Creating backup of current resources...`);
    if (fs.existsSync(backupPath)) {
      await fs.promises.rm(backupPath, { recursive: true, force: true });
    }
    // Using fs.promises.cp for non-blocking recursive copy
    await fs.promises.cp(process.resourcesPath, backupPath, { recursive: true });
    
    // 5. Write safety flag
    fs.writeFileSync(otaFlagPath, "updating");

    // 6. Extract over resourcesPath
    console.log(`[OTA-UPDATER] Extracting patch to: ${process.resourcesPath}`);
    const zip = new AdmZip(tempZipPath);
    await new Promise((resolve, reject) => {
      zip.extractAllToAsync(process.resourcesPath, true, false, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 7. Clean up and restart
    console.log(`[OTA-UPDATER] Patch applied successfully. Restarting for health check...`);
    fs.unlinkSync(tempZipPath);
    
    isQuitting = true;
    app.relaunch();
    app.exit(0);

  } catch (err) {
    console.error("[OTA-UPDATER] Failed to apply patch:", err);
    sendToRenderer("updater:status", {
      status: "error",
      message: "Gagal menerapkan update: " + err.message
    });
  }
});

function createTray() {
  const iconPath = path.join(__dirname, "assets", "icon.png");
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  const localIP = getLocalIP();

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Hunter Trades (Running)",
      enabled: false,
      icon: trayIcon,
    },
    { type: "separator" },
    {
      label: "Open App",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createMainWindow();
        }
      },
    },
    {
      label: "Open in Browser",
      click: () => shell.openExternal(`http://localhost:${FRONTEND_PORT}`),
    },
    { type: "separator" },
    {
      label: `Desktop: http://localhost:${FRONTEND_PORT}`,
      enabled: false,
    },
    {
      label: `Mobile:  http://${localIP}:${FRONTEND_PORT}`,
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("Hunter Trades Server");
  tray.setContextMenu(contextMenu);

  // Double-click tray = show window
  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createMainWindow();
    }
  });
}

// ─── Auto-Updater (GitHub Releases) ───────────────────────────
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send(channel, data);
  }
}
// (Cleaned up old auto-updater)

// ─── App Lifecycle ──────────────────────────────────────────
app.whenReady().then(async () => {
  logSystemDiagnostics();

  // Show splash while servers start
  createSplashWindow();

  try {
    // Start backend & frontend (MT5 data via native MCP in MetaTrader 5)
    await startRouter();
    await startBackend();
    await startFrontend();

    // Wait for backend to be ready (frontend depends on it)
    console.log("[MAIN] Waiting for backend server on port 5000 (max 120s)...");
    await waitForServer(BACKEND_PORT, "/health", 120000, "Backend API", () => backendLastStderr);
    console.log("[MAIN] ✅ Backend is ready!");

    // Wait for frontend
    console.log("[MAIN] Waiting for frontend server on port 3000 (max 120s)...");
    await waitForServer(FRONTEND_PORT, "/", 120000, "Frontend UI", () => frontendLastStderr);
    console.log("[MAIN] ✅ Frontend is ready!");

    // Check OTA Safety Verification
    const otaFlagPath = path.join(app.getPath("userData"), "ota_updating.txt");
    const backupPath = process.resourcesPath + "_backup";
    if (fs.existsSync(otaFlagPath)) {
      console.log("[OTA-SAFETY] Update verified successfully! Servers are healthy. Cleaning up backup.");
      fs.unlinkSync(otaFlagPath);
      if (fs.existsSync(backupPath)) {
        fs.rmSync(backupPath, { recursive: true, force: true });
      }
    }

    // Create main window + tray
    createMainWindow();
    createTray();

    // Initialize auto-updater
    setupAutoUpdater();
  } catch (err) {
    console.error("[MAIN] Startup error:", err);

    // OTA Auto-Rollback Handler
    const otaFlagPath = path.join(app.getPath("userData"), "ota_updating.txt");
    const backupPath = process.resourcesPath + "_backup";
    if (fs.existsSync(otaFlagPath)) {
       console.log("[OTA-SAFETY] Health check failed! Rolling back to backup...");
       try {
         fs.rmSync(process.resourcesPath, { recursive: true, force: true });
         fs.renameSync(backupPath, process.resourcesPath);
         fs.unlinkSync(otaFlagPath);
         dialog.showErrorBox("OTA Update Failed", "Patch pembaruan gagal dimuat (Server Error). Sistem telah melakukan rollback otomatis ke versi sebelumnya agar aplikasi tetap bisa digunakan.");
       } catch (rbErr) {
         console.error("[OTA-SAFETY] CRITICAL: Rollback failed!", rbErr);
       }
       isQuitting = true;
       app.relaunch();
       app.exit(0);
       return;
    }

    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
    dialog.showErrorBox(
      "Hunter Trades — Startup Error",
      `Failed to start servers:\n\n${err.message}\n\nPlease check that ports ${BACKEND_PORT} and ${FRONTEND_PORT} are available.`
    );
    isQuitting = true;
    app.quit();
  }
});

// Prevent default quit behavior — stay in tray
app.on("window-all-closed", () => {
  // Do nothing — tray keeps running
});

// Clean up child processes on quit
app.on("before-quit", () => {
  isQuitting = true;
  console.log("[MAIN] Shutting down...");

  if (backendProcess && !backendProcess.killed) {
    console.log("[MAIN] Killing backend process...");
    backendProcess.kill("SIGTERM");
    setTimeout(() => {
      if (backendProcess && !backendProcess.killed) {
        backendProcess.kill("SIGKILL");
      }
    }, 3000);
  }

  if (frontendProcess && !frontendProcess.killed) {
    console.log("[MAIN] Killing frontend process...");
    frontendProcess.kill("SIGTERM");
    setTimeout(() => {
      if (frontendProcess && !frontendProcess.killed) {
        frontendProcess.kill("SIGKILL");
      }
    }, 3000);
  }

  if (routerProcess && !routerProcess.killed) {
    console.log("[MAIN] Killing 9Router process...");
    routerProcess.kill("SIGTERM");
  }

  // Also kill the detached tray server on Windows
  if (process.platform === "win32") {
    try {
      require("child_process").execSync("FOR /F \"tokens=5\" %a IN ('netstat -aon ^| findstr :20128') DO taskkill /F /PID %a", { stdio: 'ignore' });
    } catch (e) {}
  }
});
