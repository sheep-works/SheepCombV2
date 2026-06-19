import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn, fork, ChildProcess } from 'child_process';
import dotenv from 'dotenv';

function loadEnv() {
  const devEnvPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(devEnvPath)) {
    dotenv.config({ path: devEnvPath });
    return;
  }
  const exeDir = path.dirname(process.execPath);
  const prodEnvPath1 = path.join(exeDir, '.env');
  if (fs.existsSync(prodEnvPath1)) {
    dotenv.config({ path: prodEnvPath1 });
    return;
  }
  if (process.resourcesPath) {
    const prodEnvPath2 = path.join(process.resourcesPath, '.env');
    if (fs.existsSync(prodEnvPath2)) {
      dotenv.config({ path: prodEnvPath2 });
      return;
    }
  }
  dotenv.config();
}
loadEnv();

let mainWindow: BrowserWindow | null = null;
let apiProcess: ChildProcess | null = null;

function startHonoServer(win: BrowserWindow) {
  if (apiProcess) {
    win.webContents.send('server-log', '[Desktop Info] Hono API server is already running.\n');
    return;
  }

  let apiScript = '';
  if (app.isPackaged) {
    apiScript = path.resolve(__dirname, '../node_modules/@sheep-family/api/dist/index.js');
  } else {
    apiScript = path.resolve(__dirname, '../../api/dist/index.js');
  }
  console.log(`Starting Hono server from: ${apiScript}`);

  if (!fs.existsSync(apiScript)) {
    win.webContents.send('server-log', `[Desktop Error] Compiled Hono API script not found at:\n  ${apiScript}\n\nPlease run "pnpm run build:api" first to compile the API.\n`);
    win.webContents.send('server-status', 'ERROR');
    return;
  }

  win.webContents.send('server-log', `[Desktop Info] Starting Hono API server sidecar...\n`);
  win.webContents.send('server-status', 'STARTING');

  // Use fork instead of spawn('node') so it runs via Electron's Node environment
  // and supports reading from app.asar transparently.
  const proc = fork(apiScript, [], {
    env: { ...process.env, PORT: '8000' },
    stdio: 'pipe'
  });
  apiProcess = proc;

  proc.stdout?.on('data', (data) => {
    if (win.isDestroyed()) return;
    const msg = data.toString();
    win.webContents.send('server-log', msg);
    win.webContents.send('server-status', 'RUNNING');
  });

  proc.stderr?.on('data', (data) => {
    if (win.isDestroyed()) return;
    const msg = data.toString();
    win.webContents.send('server-log', `[API Stderr] ${msg}`);
  });

  proc.on('error', (err) => {
    if (win.isDestroyed()) return;
    win.webContents.send('server-log', `[Desktop Error] Failed to start Hono API server: ${err.message}\n`);
    win.webContents.send('server-status', 'ERROR');
    apiProcess = null;
  });

  proc.on('close', (code) => {
    if (win.isDestroyed() || win.webContents.isDestroyed()) {
      apiProcess = null;
      return;
    }
    win.webContents.send('server-log', `[Desktop Info] Hono API server exited with code ${code}\n`);
    win.webContents.send('server-status', 'STOPPED');
    apiProcess = null;
  });
}

function stopHonoServer(win: BrowserWindow) {
  if (apiProcess) {
    if (!win.isDestroyed()) {
      win.webContents.send('server-log', `[Desktop Info] Stopping Hono API server...\n`);
    }
    apiProcess.kill();
    apiProcess = null;
  }
}
function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function loadConfig() {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      const data = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(data);
      if (config.PROJECT_ID) process.env.PROJECT_ID = config.PROJECT_ID;
      if (config.API_KEY_SHEEP) process.env.API_KEY_SHEEP = config.API_KEY_SHEEP;
      console.log('Loaded config from:', configPath);
    } catch (err) {
      console.error('Failed to read config.json:', err);
    }
  } else {
    const defaultConfig = {
      PROJECT_ID: process.env.PROJECT_ID || '',
      API_KEY_SHEEP: process.env.API_KEY_SHEEP || ''
    };
    try {
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
      console.log('Created default config.json at:', configPath);
    } catch (err) {
      console.error('Failed to create default config.json:', err);
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 700,
    minHeight: 500,
    title: 'SheepHub Local',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.webContents.once('did-finish-load', () => {
    startHonoServer(mainWindow!);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.on('open-web-ui', () => {
  shell.openExternal('https://sheepcomb.netlify.app');
});

ipcMain.on('restart-server', () => {
  if (mainWindow) {
    stopHonoServer(mainWindow);
    setTimeout(() => {
      if (mainWindow) {
        startHonoServer(mainWindow);
      }
    }, 1000);
  }
});

ipcMain.handle('get-settings', () => {
  return {
    projectId: process.env.PROJECT_ID || '',
    apiKeySheep: process.env.API_KEY_SHEEP || ''
  };
});

ipcMain.handle('save-settings', async (_event, settings: { projectId: string; apiKeySheep: string }) => {
  process.env.PROJECT_ID = settings.projectId;
  process.env.API_KEY_SHEEP = settings.apiKeySheep;

  const configPath = getConfigPath();
  const configData = {
    PROJECT_ID: settings.projectId,
    API_KEY_SHEEP: settings.apiKeySheep
  };

  try {
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf-8');
    console.log('Saved settings to:', configPath);
    
    if (mainWindow) {
      stopHonoServer(mainWindow);
      setTimeout(() => {
        if (mainWindow) {
          startHonoServer(mainWindow);
        }
      }, 1000);
    }
    return { success: true };
  } catch (err: any) {
    console.error('Failed to save settings:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('run-greet', async () => {
  // Use the API key loaded from .env
  const apiKey = process.env.API_KEY_SHEEP || '';
  try {
    const res = await fetch('http://localhost:8000/gen/greet', {
      headers: {
        'X-API-KEY': apiKey
      }
    });
    if (!res.ok) {
      const text = await res.text();
      return { status: 'error', error: `HTTP ${res.status}: ${text}` };
    }
    return await res.json();
  } catch (err: any) {
    return { status: 'error', error: err.message };
  }
});

// App lifecycle
app.whenReady().then(() => {
  loadConfig();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (apiProcess) {
    apiProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (apiProcess) {
    apiProcess.kill();
  }
});
