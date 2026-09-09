'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { scanNetwork, getLocalNetwork } = require('./scanner');
const { createDriver } = require('./router/driver');

let mainWindow = null;
let router = createDriver('unconfigured');

// Config persistente sencilla (router, alias de dispositivos) en userData.
function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch {
    return { router: { model: 'unconfigured' }, aliases: {} };
  }
}
function saveConfig(cfg) {
  try {
    fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f1420',
    title: 'Control de Red',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  const cfg = loadConfig();
  router = createDriver(cfg.router?.model || 'unconfigured');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---- IPC: puente entre la UI y el sistema ----

ipcMain.handle('net:info', async () => {
  return getLocalNetwork();
});

ipcMain.handle('net:scan', async (evt) => {
  const send = (pct) => {
    if (mainWindow) mainWindow.webContents.send('net:scan-progress', pct);
  };
  const result = await scanNetwork(send);
  // Fusionar alias guardados.
  const cfg = loadConfig();
  for (const d of result.devices || []) {
    if (d.mac && cfg.aliases && cfg.aliases[d.mac]) {
      d.name = cfg.aliases[d.mac];
    }
  }
  return result;
});

ipcMain.handle('device:setAlias', async (evt, { mac, name }) => {
  const cfg = loadConfig();
  cfg.aliases = cfg.aliases || {};
  if (name) cfg.aliases[mac] = name;
  else delete cfg.aliases[mac];
  saveConfig(cfg);
  return { ok: true };
});

ipcMain.handle('config:get', async () => loadConfig());

ipcMain.handle('router:configure', async (evt, config) => {
  const cfg = loadConfig();
  cfg.router = { ...cfg.router, ...config };
  saveConfig(cfg);
  router = createDriver(cfg.router.model || 'unconfigured');
  const res = await router.connect(cfg.router);
  return res;
});

ipcMain.handle('router:action', async (evt, { action, mac, downKbps, upKbps }) => {
  switch (action) {
    case 'limit':
      return router.setSpeedLimit(mac, downKbps, upKbps);
    case 'clearLimit':
      return router.clearSpeedLimit(mac);
    case 'block':
      return router.blockDevice(mac);
    case 'unblock':
      return router.unblockDevice(mac);
    case 'prioritize':
      return router.prioritizeDevice(mac);
    default:
      return { ok: false, message: 'Accion desconocida.' };
  }
});
