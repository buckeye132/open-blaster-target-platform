const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  connect: (targetId, ip) => ipcRenderer.send('connect-target', { targetId, ip }),
  disconnect: (targetId) => ipcRenderer.send('disconnect-target', targetId),
  hit: (targetId) => ipcRenderer.send('hit', targetId),
  onStatusChange: (callback) => ipcRenderer.on('target-status-change', (_event, { targetId, status }) => {
    callback(targetId, status);
  }),
  onStateChange: (callback) => ipcRenderer.on('target-state-change', (_event, payload) => {
    callback(payload.targetId, payload.state);
  }),
  onTargetLog: (callback) => ipcRenderer.on('target-log', (_event, { targetId, direction, message }) => {
    callback(targetId, direction, message);
  })
});