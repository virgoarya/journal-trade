// ─────────────────────────────────────────────────────────────
// Hunter Trades Desktop — Setup Window Preload Script
// Exposes safe APIs to the setup wizard renderer process
// ─────────────────────────────────────────────────────────────

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("setupWizard", {
  // Save configuration to %APPDATA%/hunter-trades/server.env
  saveConfig: (config) => ipcRenderer.invoke("setup:save-config", config),

  // Notify main process that setup is complete
  onComplete: () => ipcRenderer.send("setup:done"),
});
