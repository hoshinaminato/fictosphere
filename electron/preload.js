
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveAsset: (buffer, filename) => ipcRenderer.invoke('save-asset', buffer, filename),
  exportProject: (data) => ipcRenderer.invoke('export-project', data),
  importProject: () => ipcRenderer.invoke('import-project'),
  getAssetPath: () => ipcRenderer.invoke('get-asset-path'),
  selectAssetPath: () => ipcRenderer.invoke('select-asset-path'),
  reloadApp: () => ipcRenderer.send('reload-app')
});
