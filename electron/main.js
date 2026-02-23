
const { app, BrowserWindow, ipcMain, protocol, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

// Constants
const ASSETS_DIR_NAME = 'assets';
const STATE_FILE = 'window-state.json';
const CONFIG_FILE = 'app-config.json';
const PROTOCOL_SCHEME = 'fictosphere';

let mainWindow;
let currentAssetPathCache = null;

// --- Protocol Privileges (MUST BE BEFORE app.ready) ---
protocol.registerSchemesAsPrivileged([
  { 
    scheme: PROTOCOL_SCHEME, 
    privileges: { 
      secure: true, 
      standard: true, 
      supportFetchAPI: true, 
      corsEnabled: true, 
      bypassCSP: true,
      stream: true
    } 
  }
]);

// --- Helper: Paths & Config ---
function getUserDataPath() {
  return app.getPath('userData');
}

function loadConfig() {
  try {
    const configPath = path.join(getUserDataPath(), CONFIG_FILE);
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    console.error("Failed to load config", e);
  }
  return {};
}

function saveConfig(config) {
  try {
    const configPath = path.join(getUserDataPath(), CONFIG_FILE);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error("Failed to save config", e);
  }
}

function getAssetsPath() {
  if (currentAssetPathCache) return currentAssetPathCache;
  const config = loadConfig();
  if (config.customAssetPath && fs.existsSync(config.customAssetPath)) {
    currentAssetPathCache = config.customAssetPath;
    return config.customAssetPath;
  }
  const p = path.join(getUserDataPath(), ASSETS_DIR_NAME);
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
  currentAssetPathCache = p;
  return p;
}

function getWindowStatePath() {
  return path.join(getUserDataPath(), STATE_FILE);
}

// --- Window State Management ---
function loadWindowState() {
  try {
    const data = fs.readFileSync(getWindowStatePath(), 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return { width: 1280, height: 800, isMaximized: false };
  }
}

function saveWindowState(window) {
  if (!window) return;
  try {
    const bounds = window.getBounds();
    const isMaximized = window.isMaximized();
    const isFullScreen = window.isFullScreen();
    fs.writeFileSync(getWindowStatePath(), JSON.stringify({ ...bounds, isMaximized, isFullScreen }));
  } catch (e) {
    console.error("Failed to save window state", e);
  }
}

// --- Protocol Setup ---
function setupProtocol() {
  protocol.registerFileProtocol(PROTOCOL_SCHEME, (request, callback) => {
    const url = request.url.replace(`${PROTOCOL_SCHEME}://`, '');
    try {
      const decodedUrl = decodeURIComponent(url);
      const cleanUrl = decodedUrl.split('?')[0].split('#')[0];
      const filename = path.basename(cleanUrl);
      const finalPath = path.join(getAssetsPath(), filename);
      callback({ path: finalPath });
    } catch (error) {
      console.error('[Fictosphere Protocol] Error:', error);
      callback({ error: -2 });
    }
  });
}

// --- Main Window Creation ---
function createWindow() {
  const state = loadWindowState();
  const iconPath = path.join(__dirname, '../assets/icon.svg');

  mainWindow = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width || 1280,
    height: state.height || 800,
    backgroundColor: '#0f172a',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    },
    autoHideMenuBar: true,
    title: "Fictosphere"
  });

  if (state.isMaximized) mainWindow.maximize();
  if (state.isFullScreen) mainWindow.setFullScreen(true);

  const isDev = !app.isPackaged;
  if (isDev && process.env['VITE_DEV_SERVER_URL']) {
     mainWindow.loadURL(process.env['VITE_DEV_SERVER_URL']);
  } else if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  const saveState = () => saveWindowState(mainWindow);
  mainWindow.on('resize', saveState);
  mainWindow.on('move', saveState);
  mainWindow.on('close', saveState);
}

// --- IPC Handlers ---

ipcMain.handle('save-asset', async (event, buffer, originalName) => {
  try {
    const assetsDir = getAssetsPath();
    const ext = path.extname(originalName) || '.png';
    const hash = crypto.createHash('md5').update(Buffer.from(buffer)).digest('hex');
    const filename = `${hash}${ext}`;
    const filePath = path.join(assetsDir, filename);
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return `${PROTOCOL_SCHEME}://${filename}`;
  } catch (e) {
    console.error("Save asset failed:", e);
    throw e;
  }
});

ipcMain.handle('export-project', async (event, exportData) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '导出工程包',
      defaultPath: `fictosphere_project_${Date.now()}.fictosphere`,
      filters: [{ name: 'Fictosphere Project Package', extensions: ['fictosphere', 'zip'] }]
    });

    if (canceled || !filePath) return false;

    const zip = new AdmZip();
    const assetsDir = getAssetsPath();
    
    // 写入 JSON 数据
    const jsonStr = JSON.stringify(exportData, null, 2);
    zip.addFile("project.json", Buffer.from(jsonStr, "utf8"));

    // 扫描资源文件并打包
    const assetRegex = /"fictosphere:\/\/([^"]+)"/g;
    let match;
    const addedAssets = new Set();

    while ((match = assetRegex.exec(jsonStr)) !== null) {
      const filename = match[1].split('?')[0];
      if (!addedAssets.has(filename)) {
        const localPath = path.join(assetsDir, filename);
        if (fs.existsSync(localPath)) {
          zip.addLocalFile(localPath, ASSETS_DIR_NAME); 
          addedAssets.add(filename);
        }
      }
    }

    zip.writeZip(filePath);
    return true;
  } catch (e) {
    console.error("Export failed", e);
    return false;
  }
});

ipcMain.handle('import-project', async (event) => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: '导入工程包',
      filters: [{ name: 'Fictosphere Project Package', extensions: ['fictosphere', 'zip', 'json'] }],
      properties: ['openFile']
    });

    if (canceled || filePaths.length === 0) return null;
    const filePath = filePaths[0];

    // 处理原始 JSON 导入
    if (filePath.endsWith('.json')) {
       const content = fs.readFileSync(filePath, 'utf8');
       const parsed = JSON.parse(content);
       // 确保返回 ExportData 结构
       return parsed.project ? parsed : { version: '1.0', timestamp: new Date().toISOString(), project: parsed };
    }

    // 处理压缩包导入
    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries(); 

    // 1. 查找 project.json
    const projectEntry = zipEntries.find(entry => entry.entryName === 'project.json');
    if (!projectEntry) throw new Error("Invalid package: missing project.json");
    
    let projectData = JSON.parse(projectEntry.getData().toString('utf8'));
    // 兼容层：如果 project.json 里是原始工程，包装它
    if (!projectData.project) {
        projectData = { version: '1.0', timestamp: new Date().toISOString(), project: projectData };
    }

    // 2. 解压资产到本地目录
    let extractedCount = 0;
    zipEntries.forEach(entry => {
      // 检查 entry 是否在 assets/ 文件夹内且不是文件夹本身
      if (entry.entryName.startsWith(ASSETS_DIR_NAME + '/') && !entry.isDirectory) {
         const fileName = path.basename(entry.entryName);
         const targetPath = path.join(getAssetsPath(), fileName);
         fs.writeFileSync(targetPath, entry.getData());
         extractedCount++;
      }
    });

    console.log(`[Import] Extracted ${extractedCount} assets to ${getAssetsPath()}`);
    return projectData;

  } catch (e) {
    console.error("Import failed", e);
    dialog.showErrorBox("导入失败", "无法解析工程文件: " + e.message);
    return null;
  }
});

ipcMain.handle('get-asset-path', () => getAssetsPath());

ipcMain.handle('open-asset-path', async () => {
  const p = getAssetsPath();
  if (fs.existsSync(p)) {
    shell.openPath(p);
  }
});

ipcMain.handle('select-asset-path', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: '选择资源存储目录',
      properties: ['openDirectory', 'createDirectory']
    });
    if (canceled || filePaths.length === 0) return null;
    const newPath = filePaths[0];
    const config = loadConfig();
    config.customAssetPath = newPath;
    saveConfig(config);
    currentAssetPathCache = newPath;
    return newPath;
  } catch (e) {
    console.error("Select asset path failed", e);
    return null;
  }
});

ipcMain.on('reload-app', () => {
  if (mainWindow) mainWindow.reload();
});

app.whenReady().then(() => {
  setupProtocol();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
