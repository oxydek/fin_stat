import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Здесь будут методы для взаимодействия с main процессом
  // Например: openFile, saveFile, showNotification и т.д.
}); 