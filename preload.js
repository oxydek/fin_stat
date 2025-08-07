import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getBrokerAccounts: async () => {
    return await ipcRenderer.invoke('tinkoff:getBrokerAccounts');
  },
  getPortfolio: async (accountId) => {
    return await ipcRenderer.invoke('tinkoff:getPortfolio', accountId);
  },
  getPositions: async (accountId) => {
    return await ipcRenderer.invoke('tinkoff:getPositions', accountId);
  },
  getTinkoffToken: async () => {
    return await ipcRenderer.invoke('tinkoff:getToken');
  },
  setTinkoffToken: async (token) => {
    return await ipcRenderer.invoke('tinkoff:setToken', token);
  }
}); 