// ─────────────────────────────────────────────────────────────
// Hunter Trades Desktop — Electron Main Process
// Server orchestrator: starts backend + frontend, manages window & tray
// ─────────────────────────────────────────────────────────────

const { app, BrowserWindow, Tray, Menu, shell, nativeImage, dialog, utilityProcess, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const { spawn, execFile } = require("child_process");
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
    const req = http.get(`http://localhost:${port}${checkPath}`, (res) => {
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

// ─── Server Management ──────────────────────────────────────
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
      },
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    backendProcess.stdout?.on("data", (d) => {
      const msg = d.toString().trim();
      if (msg) console.log(`[BACKEND] ${msg}`);
    });
    backendProcess.stderr?.on("data", (d) => {
      const msg = d.toString().trim();
      if (msg) console.error(`[BACKEND] ${msg}`);
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
    console.log(`[MAIN] Starting backend (production utilityProcess): ${serverScript}`);

    backendProcess = utilityProcess.fork(serverScript, [], {
      cwd: serverCwd,
      env: {
        ...process.env,
        ...fileEnv,
        PORT: String(BACKEND_PORT),
        NODE_ENV: "production",
        PYTHONIOENCODING: "utf-8",
      },
      stdio: "pipe",
    });

    backendProcess.stdout?.on("data", (d) => {
      const msg = d.toString().trim();
      if (msg) console.log(`[BACKEND] ${msg}`);
    });
    backendProcess.stderr?.on("data", (d) => {
      const msg = d.toString().trim();
      if (msg) console.error(`[BACKEND] ${msg}`);
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

async function startFrontend() {
  const isUp = await isPortResponding(FRONTEND_PORT, "/");
  if (isUp) {
    console.log(`[MAIN] Frontend is already running on port ${FRONTEND_PORT}. Skipping spawn.`);
    return;
  }

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
    });
    frontendProcess.stderr?.on("data", (d) => {
      const msg = d.toString().trim();
      if (msg) console.error(`[FRONTEND] ${msg}`);
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
    return;
  }

  console.log(`[MAIN] Starting frontend (production utilityProcess): ${serverJs}`);

  frontendProcess = utilityProcess.fork(serverJs, [], {
    cwd: frontendDir,
    env: {
      ...process.env,
      PORT: String(FRONTEND_PORT),
      HOSTNAME: "0.0.0.0",
      NODE_ENV: "production",
      BACKEND_URL: `http://localhost:${BACKEND_PORT}`,
    },
    stdio: "pipe",
  });

  frontendProcess.stdout?.on("data", (d) => {
    const msg = d.toString().trim();
    if (msg) console.log(`[FRONTEND] ${msg}`);
  });
  frontendProcess.stderr?.on("data", (d) => {
    const msg = d.toString().trim();
    if (msg) console.error(`[FRONTEND] ${msg}`);
  });
  frontendProcess.on("exit", (code) => {
    console.log(`[MAIN] Frontend exited with code ${code}`);
    if (!isQuitting && code !== 0) {
      setTimeout(startFrontend, 3000);
    }
  });
}

// ─── Wait for Server ─────────────────────────────────────────
function waitForServer(port, checkPath = "/health", timeout = 60000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(`http://localhost:${port}${checkPath}`, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeout) {
          reject(new Error(`Server on port ${port} did not start within ${timeout / 1000}s`));
        } else {
          setTimeout(check, 800);
        }
      });
      req.setTimeout(2500, () => {
        req.destroy();
        if (Date.now() - start > timeout) {
          reject(new Error(`Server on port ${port} timed out`));
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
  splashWindow.loadFile(path.join(__dirname, "assets", "splash.html"));
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

// ─── System Tray ─────────────────────────────────────────────
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
      label: "Launch MT5 Client",
      click: () => launchMT5Client(),
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

// ─── MT5 Client Launcher ────────────────────────────────────
function launchMT5Client() {
  const mt5Dir = isDev
    ? path.join(__dirname, "..", "server", "mcp-mt5-server", "dist")
    : path.join(process.resourcesPath, "mt5-client");

  const mt5Exe = path.join(mt5Dir, "Hunter Trades AI Trading.exe");

  if (fs.existsSync(mt5Exe)) {
    execFile(mt5Exe, { detached: true, stdio: "ignore" }, (err) => {
      if (err) {
        dialog.showErrorBox("MT5 Client Error", `Failed to launch: ${err.message}`);
      }
    });
  } else {
    dialog.showMessageBox({
      type: "warning",
      title: "MT5 Client",
      message: "MT5 Client not found",
      detail: `Expected at: ${mt5Exe}\n\nPlease build the MT5 client first using build.bat in server/mcp-mt5-server/`,
    });
  }
}

// ─── Auto-Updater (GitHub Releases) ───────────────────────────
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send(channel, data);
  }
}

function setupAutoUpdater() {
  if (isDev) {
    console.log("[AUTO-UPDATER] Development mode detected. In-app updater is idle.");
    return;
  }

  try {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = console;

    autoUpdater.on("checking-for-update", () => {
      console.log("[AUTO-UPDATER] Checking for updates on GitHub Releases...");
      sendToRenderer("updater:status", { status: "checking" });
    });

    autoUpdater.on("update-available", (info) => {
      console.log(`[AUTO-UPDATER] 🚀 New version available: v${info.version}`);
      sendToRenderer("updater:status", {
        status: "available",
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      });
    });

    autoUpdater.on("update-not-available", (info) => {
      console.log(`[AUTO-UPDATER] Application is up-to-date (v${info.version}).`);
      sendToRenderer("updater:status", {
        status: "not-available",
        version: info.version,
      });
    });

    autoUpdater.on("error", (err) => {
      console.warn("[AUTO-UPDATER] Update check warning/error:", err.message);
      sendToRenderer("updater:status", {
        status: "error",
        message: err.message,
      });
    });

    autoUpdater.on("download-progress", (progressObj) => {
      sendToRenderer("updater:progress", {
        percent: Math.round(progressObj.percent || 0),
        bytesPerSecond: progressObj.bytesPerSecond || 0,
        transferred: progressObj.transferred || 0,
        total: progressObj.total || 0,
      });
    });

    autoUpdater.on("update-downloaded", (info) => {
      console.log(`[AUTO-UPDATER] ✅ Version v${info.version} downloaded and ready to install.`);
      sendToRenderer("updater:status", {
        status: "downloaded",
        version: info.version,
        releaseNotes: info.releaseNotes,
      });
    });

    // Check after 10s of launch
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.warn("[AUTO-UPDATER] Initial check error:", err.message);
      });
    }, 10000);

    // Periodic check every 1 hour
    setInterval(() => {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.warn("[AUTO-UPDATER] Periodic check error:", err.message);
      });
    }, 60 * 60 * 1000);
  } catch (err) {
    console.error("[AUTO-UPDATER] Failed to initialize:", err);
  }
}

// IPC Handlers for Updater
ipcMain.handle("updater:check-now", async () => {
  if (isDev) {
    return { status: "dev-mode", message: "Auto-updater is disabled in dev mode." };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return { status: "success", updateInfo: result?.updateInfo };
  } catch (err) {
    return { status: "error", message: err.message };
  }
});

ipcMain.on("updater:quit-and-install", () => {
  console.log("[AUTO-UPDATER] Applying update: quit and install...");
  isQuitting = true;
  autoUpdater.quitAndInstall(false, true);
});

// ─── App Lifecycle ──────────────────────────────────────────
app.whenReady().then(async () => {
  logSystemDiagnostics();

  // Show splash while servers start
  createSplashWindow();

  try {
    // Start servers
    await startBackend();
    await startFrontend();

    // Wait for backend to be ready (frontend depends on it)
    console.log("[MAIN] Waiting for backend server on port 5000...");
    await waitForServer(BACKEND_PORT, "/health", 60000);
    console.log("[MAIN] ✅ Backend is ready!");

    // Wait for frontend
    console.log("[MAIN] Waiting for frontend server on port 3000...");
    await waitForServer(FRONTEND_PORT, "/", 60000);
    console.log("[MAIN] ✅ Frontend is ready!");

    // Create main window + tray
    createMainWindow();
    createTray();

    // Initialize auto-updater
    setupAutoUpdater();
  } catch (err) {
    console.error("[MAIN] Startup error:", err);
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
});
