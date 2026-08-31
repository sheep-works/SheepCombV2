import { app, BrowserWindow, ipcMain, shell, Menu } from 'electron';
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

function emitLog(win: BrowserWindow | null, msg: string) {
  try {
    const logFilePath = path.join(app.getPath('userData'), 'server.log');
    const timestamp = new Date().toISOString();
    const cleanMsg = msg.endsWith('\n') ? msg.slice(0, -1) : msg;
    fs.appendFileSync(logFilePath, `[${timestamp}] ${cleanMsg}\n`);
  } catch (err) {
    console.error('Failed to write log:', err);
  }
  if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
    win.webContents.send('server-log', msg.endsWith('\n') ? msg : msg + '\n');
  }
}

function startHonoServer(win: BrowserWindow) {
  if (apiProcess) {
    emitLog(win, '[Desktop Info] Hono API server is already running.');
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
    emitLog(win, `[Desktop Error] Compiled Hono API script not found at:\n  ${apiScript}\n\nPlease run "pnpm run build:api" first to compile the API.`);
    win.webContents.send('server-status', 'ERROR');
    return;
  }

  emitLog(win, `[Desktop Info] Starting Hono API server sidecar...`);
  win.webContents.send('server-status', 'STARTING');

  // Use fork instead of spawn('node') so it runs via Electron's Node environment
  // and supports reading from app.asar transparently.
  const proc = fork(apiScript, [], {
    env: { 
      ...process.env, 
      PORT: '8000',
      USER_DATA_PATH: app.getPath('userData'),
      DEBUG_LOG: String(process.env.DEBUG_LOG || 'false')
    },
    stdio: 'pipe'
  });
  apiProcess = proc;

  proc.stdout?.on('data', (data) => {
    if (win.isDestroyed()) return;
    const msg = data.toString();
    emitLog(win, msg);
    if (msg.includes('Server is running on port')) {
      win.webContents.send('server-status', 'RUNNING');
    }
  });

  proc.stderr?.on('data', (data) => {
    if (win.isDestroyed()) return;
    const msg = data.toString();
    emitLog(win, `[API Stderr] ${msg}`);
  });

  proc.on('error', (err) => {
    if (win.isDestroyed()) return;
    emitLog(win, `[Desktop Error] Failed to start Hono API server: ${err.message}`);
    win.webContents.send('server-status', 'ERROR');
    apiProcess = null;
  });

  proc.on('close', (code) => {
    if (win.isDestroyed() || win.webContents.isDestroyed()) {
      apiProcess = null;
      return;
    }
    emitLog(win, `[Desktop Info] Hono API server exited with code ${code}`);
    win.webContents.send('server-status', 'STOPPED');
    apiProcess = null;
  });
}

function stopHonoServer(win: BrowserWindow) {
  if (apiProcess) {
    if (!win.isDestroyed()) {
      emitLog(win, `[Desktop Info] Stopping Hono API server...`);
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
      if (config.VERTEX_MODEL) process.env.VERTEX_MODEL = config.VERTEX_MODEL;
      if (config.API_KEY_SHEEP) process.env.API_KEY_SHEEP = config.API_KEY_SHEEP;
      if (config.AI_STUDIO_FREE) process.env.AI_STUDIO_FREE = config.AI_STUDIO_FREE;
      if (config.DEBUG_LOG !== undefined) process.env.DEBUG_LOG = String(config.DEBUG_LOG);
      console.log('Loaded config from:', configPath);
    } catch (err) {
      console.error('Failed to read config.json:', err);
    }
  } else {
    const defaultConfig = {
      ACTIVE_PROVIDER: 'vertex-sheep',
      PROJECT_ID: process.env.PROJECT_ID || 'project-5c3c5988-edd9-4109-907',
      VERTEX_MODEL: 'gemini-3.1-pro-preview',
      API_KEY_SHEEP: process.env.API_KEY_SHEEP || '71TMRzhzwQSvITAd01PKWVlRfI4zSLa21cdpj_RWu4c',
      OLLAMA_URL: 'http://localhost:11434',
      OLLAMA_MODEL: 'gemma4:e2b',
      LMSTUDIO_URL: 'http://127.0.0.1:1234',
      LMSTUDIO_MODEL: 'local-model',
      AI_STUDIO_FREE: process.env.AI_STUDIO_FREE || '',
      GEMINI_MODEL: 'gemini-1.5-flash',
      DEBUG_LOG: false
    };
    try {
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
      console.log('Created default config.json at:', configPath);
      process.env.PROJECT_ID = defaultConfig.PROJECT_ID;
      process.env.VERTEX_MODEL = defaultConfig.VERTEX_MODEL;
      process.env.API_KEY_SHEEP = defaultConfig.API_KEY_SHEEP;
      process.env.AI_STUDIO_FREE = defaultConfig.AI_STUDIO_FREE;
      process.env.DEBUG_LOG = String(defaultConfig.DEBUG_LOG);
    } catch (err) {
      console.error('Failed to create default config.json:', err);
    }
  }
}

function createWindow() {
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 700,
    minHeight: 500,
    title: 'SheepBobbin Local',
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
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.on('open-web-ui', () => {
  shell.openExternal('https://sheepcomb.netlify.app');
});

ipcMain.on('open-logs-folder', () => {
  const logFilePath = path.join(app.getPath('userData'), 'server.log');
  shell.showItemInFolder(logFilePath);
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
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      const data = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }
  return {};
});

ipcMain.handle('save-settings', async (_event, settings: any) => {
  const configPath = getConfigPath();
  try {
    fs.writeFileSync(configPath, JSON.stringify(settings, null, 2), 'utf-8');
    console.log('Saved settings to:', configPath);

    if (settings.PROJECT_ID) process.env.PROJECT_ID = settings.PROJECT_ID;
    if (settings.VERTEX_MODEL) process.env.VERTEX_MODEL = settings.VERTEX_MODEL;
    if (settings.API_KEY_SHEEP) process.env.API_KEY_SHEEP = settings.API_KEY_SHEEP;
    if (settings.AI_STUDIO_FREE) process.env.AI_STUDIO_FREE = settings.AI_STUDIO_FREE;
    if (settings.DEBUG_LOG !== undefined) process.env.DEBUG_LOG = String(settings.DEBUG_LOG);

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

ipcMain.handle('fetch-models', async (_event, provider: string, url: string) => {
  const apiKey = process.env.API_KEY_SHEEP || '';
  const maxRetries = 5;
  const retryDelay = 300; // ms

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch('http://localhost:8000/gen/models', {
        headers: {
          'X-API-KEY': apiKey,
          'X-LLM-Provider': provider,
          'X-LLM-URL': url
        }
      });
      if (!res.ok) {
        console.warn(`[Desktop Warning] Failed to fetch models: Hono returned HTTP ${res.status}`);
        return [];
      }
      return await res.json();
    } catch (err: any) {
      const isConnRefused = 
        err.code === 'ECONNREFUSED' || 
        err.message?.includes('ECONNREFUSED') || 
        err.cause?.code === 'ECONNREFUSED' || 
        err.cause?.message?.includes('ECONNREFUSED');

      if (isConnRefused && attempt < maxRetries) {
        console.log(`[Desktop Info] Hono server not ready (ECONNREFUSED). Retrying model fetch (${attempt}/${maxRetries}) in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      console.warn(`[Desktop Warning] Failed to fetch models via IPC: ${err.message}`);
      return [];
    }
  }
  return [];
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
