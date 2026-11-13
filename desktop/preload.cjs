'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('AbyssalNativeUpdater', Object.freeze({
  installUpdate(payload) {
    return ipcRenderer.invoke('abyssal:install-update', payload || {});
  }
}));
