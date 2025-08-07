import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { InstrumentsService, UsersService, SandboxService, OperationsService, OrdersService, MarketDataService, MarketDataStreamService, OrdersStreamService } from 'tinkoff-invest-api/cjs/generated';
import { TinkoffInvestApi } from 'tinkoff-invest-api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, 'dist/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  // IPC: fetch broker accounts via T-Invest API
  ipcMain.handle('tinkoff:getBrokerAccounts', async () => {
    const token = process.env.TINKOFF_TOKEN;
    if (!token) {
      return { ok: false, error: 'TINKOFF_TOKEN is not set in environment' };
    }
    try {
      const api = new TinkoffInvestApi({ token });
      const { accounts } = await api.users.getAccounts({});
      return { ok: true, data: accounts || [] };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('tinkoff:getPortfolio', async (_evt, accountId) => {
    const token = process.env.TINKOFF_TOKEN;
    if (!token) return { ok: false, error: 'TINKOFF_TOKEN is not set in environment' };
    try {
      const api = new TinkoffInvestApi({ token });
      const res = await api.operations.getPortfolio({ accountId });
      return { ok: true, data: res };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('tinkoff:getPositions', async (_evt, accountId) => {
    const token = process.env.TINKOFF_TOKEN;
    if (!token) return { ok: false, error: 'TINKOFF_TOKEN is not set in environment' };
    try {
      const api = new TinkoffInvestApi({ token });
      const res = await api.operations.getPositions({ accountId });
      return { ok: true, data: res };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  const envPath = join(__dirname, '.env');
  const readEnvToken = () => {
    if (process.env.TINKOFF_TOKEN) return process.env.TINKOFF_TOKEN;
    try {
      const raw = fs.readFileSync(envPath, 'utf8');
      const m = raw.match(/TINKOFF_TOKEN=(.*)/);
      return m ? m[1].trim() : '';
    } catch { return ''; }
  };
  const writeEnvToken = (token) => {
    let content = '';
    try { content = fs.readFileSync(envPath, 'utf8'); } catch { content = '' }
    if (content.includes('TINKOFF_TOKEN=')) {
      content = content.replace(/TINKOFF_TOKEN=.*/g, `TINKOFF_TOKEN=${token}`);
    } else {
      content += (content.endsWith('\n') ? '' : '\n') + `TINKOFF_TOKEN=${token}\n`;
    }
    fs.writeFileSync(envPath, content, 'utf8');
  };

  ipcMain.handle('tinkoff:getToken', async () => {
    const token = readEnvToken();
    return { ok: true, data: token };
  });
  ipcMain.handle('tinkoff:setToken', async (_evt, token) => {
    try {
      writeEnvToken(token || '');
      process.env.TINKOFF_TOKEN = token || '';
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
}); 