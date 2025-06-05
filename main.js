const { app, BrowserWindow, ipcMain, Menu, screen, dialog, Tray, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { print } = require('pdf-to-printer');
const { download } = require('electron-dl');
const { autoUpdater } = require('electron-updater');

// ==================== 配置常量 ====================
const HTTP_URL = 'http://localhost:5174/'; 
const ICON_PATH = path.join(__dirname, 'logo.ico');

// ==================== 安全工具函数 ====================
const safeLog = (...args) => {
  try {
    process.stderr.write(`${args.map(String).join(' ')}\n`);
  } catch (err) {
    if (err.code !== 'EPIPE') process.stderr.write(`[LOG_ERROR] ${err.message}\n`);
  }
};

// ==================== 主窗口管理 ====================
let win = null;
let tray = null;

function createWindow() {
  if (win) return win.focus();

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    icon: ICON_PATH,
    width: width,
    height: height,
    frame: false, // 隐藏默认标题栏（实现自定义黑色状态栏）
    titleBarStyle: 'hidden', // macOS 隐藏标题栏
    backgroundColor: '#000000', // 窗口背景设为黑色
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // ========== 自定义黑色状态栏 ==========
  win.setMenuBarVisibility(false); // 隐藏菜单栏
  win.setBackgroundColor('#000000'); // 确保背景为黑色

  // ========== 窗口事件 ==========
  
  /*
  win.loadURL(HTTP_URL)
    .then(() => safeLog('窗口加载完成'))
    .catch(err => safeLog('加载失败:', err));
  */

  // 加载Vue应用
  win.loadFile('dist/index.html')
 

  win.on('closed', () => (win = null));
  win.on('focus', registerShortcut);
  win.on('blur', unregisterShortcut);

  // ========== 托盘图标 ==========
  setupTray();
}

// ==================== 快捷键管理 ====================
function registerShortcut() {
  globalShortcut.register('F5', () => win?.reload());
}
function unregisterShortcut() {
  globalShortcut.unregister('F5');
}

// ==================== 托盘功能 ====================
function setupTray() {
  tray = new Tray(ICON_PATH);
  const contextMenu = Menu.buildFromTemplate([
    { label: '打开', click: () => win.show() },
    { label: '退出', click: () => app.quit() }
  ]);
  tray.setToolTip('应用程序');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => win.show());
}

// ==================== 文件下载 ====================
async function downloadPDF(url) {
  const tempPath = path.join(app.getPath('temp'), `${Date.now()}.pdf`);
  const file = fs.createWriteStream(tempPath);

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(tempPath);
      });
    }).on('error', (err) => {
      fs.unlink(tempPath, () => reject(err));
    });
  });
}

// ==================== IPC通信 ====================
ipcMain.handle('print-pdf', async (event, { pdfUrl, printer }) => {
  try {
    const filePath = await downloadPDF(pdfUrl);
    await print(filePath, { printer: printer.name });
    fs.unlinkSync(filePath);
    return { success: true };
  } catch (err) {
    safeLog('打印失败:', err);
    return { success: false, error: err.message };
  }
});

// ==================== 应用生命周期 ====================
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => win || createWindow());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ==================== 全局错误处理 ====================
process.on('uncaughtException', (err) => {
  safeLog('[CRASH]', err);
  if (err.code !== 'EPIPE') app.quit();
});

// 在 IPC通信 部分添加以下代码

// 文件夹选择
ipcMain.handle('open-folder', async () => {
  if (!win) return { canceled: true };
  
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory']
  });
  
  return {
    canceled: result.canceled,
    filePaths: result.filePaths
  };
});

// 窗口控制
ipcMain.on('window-control', (event, command) => {
  if (!win) return;
  
  if (command === 'minimize') {
    win.minimize();
  } else if (command === 'maximize') {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  } else if (command === 'close') {
    win.close();
  }
});


 