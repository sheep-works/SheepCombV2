import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('apiConsole', {
  onServerLog: (callback: (msg: string) => void) => {
    const subscription = (_event: any, msg: string) => callback(msg);
    ipcRenderer.on('server-log', subscription);
    return () => {
      ipcRenderer.removeListener('server-log', subscription);
    };
  },
  onServerStatus: (callback: (status: string) => void) => {
    const subscription = (_event: any, status: string) => callback(status);
    ipcRenderer.on('server-status', subscription);
    return () => {
      ipcRenderer.removeListener('server-status', subscription);
    };
  },
  openWebUi: () => {
    ipcRenderer.send('open-web-ui');
  },
  restartServer: () => {
    ipcRenderer.send('restart-server');
  },
  greet: () => {
    return ipcRenderer.invoke('run-greet');
  },
  getSettings: () => {
    return ipcRenderer.invoke('get-settings');
  },
  saveSettings: (settings: { projectId: string; apiKeySheep: string }) => {
    return ipcRenderer.invoke('save-settings', settings);
  }
});
