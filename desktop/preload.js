// ─────────────────────────────────────────────────────────────
// Hunter Trades Desktop — Preload Script
// Exposes safe APIs to the renderer process via contextBridge
// ─────────────────────────────────────────────────────────────

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hunterTrades", {
  // Platform info
  platform: process.platform,
  isDesktopApp: true,

  // In-App Auto-Updater APIs
  updater: {
    checkNow: () => ipcRenderer.invoke("updater:check-now"),
    quitAndInstall: () => ipcRenderer.send("updater:quit-and-install"),
    onStatus: (callback) => {
      const listener = (event, data) => callback(data);
      ipcRenderer.on("updater:status", listener);
      return () => ipcRenderer.removeListener("updater:status", listener);
    },
    onProgress: (callback) => {
      const listener = (event, data) => callback(data);
      ipcRenderer.on("updater:progress", listener);
      return () => ipcRenderer.removeListener("updater:progress", listener);
    },
  },

  // IPC helpers (for settings, notifications, etc.)
  send: (channel, data) => {
    const validChannels = [
      "app:minimize-to-tray",
      "app:launch-mt5",
      "app:open-browser",
      "updater:quit-and-install",
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel, callback) => {
    const validChannels = [
      "app:server-status",
      "app:update-available",
      "updater:status",
      "updater:progress",
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
});
