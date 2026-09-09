'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Puente seguro: la interfaz (renderer) no tiene acceso directo a Node ni al
// sistema. Solo puede llamar a estas funciones concretas y auditadas.
contextBridge.exposeInMainWorld('api', {
  netInfo: () => ipcRenderer.invoke('net:info'),
  scan: () => ipcRenderer.invoke('net:scan'),
  onScanProgress: (cb) => {
    const handler = (_e, pct) => cb(pct);
    ipcRenderer.on('net:scan-progress', handler);
    return () => ipcRenderer.removeListener('net:scan-progress', handler);
  },
  setAlias: (mac, name) => ipcRenderer.invoke('device:setAlias', { mac, name }),
  getConfig: () => ipcRenderer.invoke('config:get'),
  detectRouter: () => ipcRenderer.invoke('router:detect'),
  configureRouter: (config) => ipcRenderer.invoke('router:configure', config),
  routerAction: (payload) => ipcRenderer.invoke('router:action', payload),
});
