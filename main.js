const http_url = 'https:///main'
const getVersionUrl = 'https:///api/app/version';

const localShortcut = require('electron-localshortcut'); 
const { app, BrowserWindow, ipcMain, Menu, ipcRenderer, webContents, screen, shell, MenuItem, dialog, Tray,globalShortcut  } = require('electron')
const electron = require('electron')
const path = require('path')
const fs = require('fs');
const https = require('https');
const { print } = require('pdf-to-printer');
const { download } = require('electron-dl');
const axios = require('axios');
const { autoUpdater } = require('electron-updater');

const contextMenu = require('electron-context-menu');
const appVersion = app.getVersion();

let win = null;

const additionalData = { myKey: 'myValue' }
const gotTheLock = app.requestSingleInstanceLock(additionalData)
if (!gotTheLock) {
  app.quit()
  return 
} else {
  app.on('second-instance', (event, commandLine, workingDirectory, additionalData) => {
    //输入从第二个实例中接收到的数据
    console.log(additionalData)
    //有人试图运行第二个实例，我们应该关注我们的窗口
    if (win) { 
      win.show()
      win.focus()
      return 
    }
  })
}

let tray;
let shortcutRegistered = false;
function registerShortcut() {
  globalShortcut.register('F5', () => {
    win.reload();
  });
  shortcutRegistered = true;
}

function unregisterShortcut() {
  globalShortcut.unregister('F5');
  shortcutRegistered = false;
}
function createWindow() {
  // Create the browser window.
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    icon: 'logo.ico',
    width: width,
    height: height,
    //frame: false, // 隐藏标题栏
    //titleBarStyle: 'hidden', // 在 macOS 上隐藏标题栏
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  require('./background.js');

  win.loadURL(http_url)
  Menu.setApplicationMenu(null);
  win.minimize()
  win.maximize()
  win.show()
  win.on('focus', () => {
    if (!shortcutRegistered) {
      registerShortcut();
    }
  });
  win.on('blur', () => {
    if (shortcutRegistered) {
      unregisterShortcut();
    }
  }); 
  // 监听 webContents 的 contextMenu 事件
  win.webContents.on('context-menu', (event, params) => {
    event.preventDefault(); // 阻止默认的右键菜单显示
    const template = [
      {
        label: '复制',
        click: () => {
          win.webContents.copy();
        }
      },
      {
        label: '黏贴',
        click: () => {
          win.webContents.paste();
        }
      }
    ];
    const menu = Menu.buildFromTemplate(template);
    const menuElement = menu.popup(win, params.x, params.y);
  });


  win.webContents.on('did-navigate', () => {
    win.webContents.executeJavaScript(`
      (async () => {
        try { 

        } catch (error) {
          console.error('JavaScript execution failed:', error);
        }
      })();
    `);
  });
  const iconPath = path.join(app.getAppPath(), 'logo.ico');
  win.on('close', (event) => {
    if (!win.isVisible()) {
      // 窗口不可见，表示用户在任务栏上点击了关闭按钮 

    } else {
      win.hide();
      // 设置托盘图标的闪烁效果
      tray.on('balloon-click', () => {
        tray.setImage(iconPath); // 设置活动状态下的图标
        win.show();
      });
      /*tray.displayBalloon({
        title: '应用程序',
        content: '应用程序在后台运行',
      });*/

      event.preventDefault();
    }

  });
  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    { label: '打开应用程序', click: () => win.show() },
    { label: '退出', click: () => app.exit() }
  ]);
  tray.setToolTip('应用程序');
  tray.setContextMenu(contextMenu);
  // 双击托盘图标打开应用程序
  tray.on('double-click', () => {
    win.show();
  });

  // app.on('window-all-closed', () => {
  //   if (process.platform !== 'darwin') {
  //     app.quit();
  //   }
  // });

  // Open the DevTools.
  //win.webContents.openDevTools()
}



app.whenReady().then(() => {
  createWindow();

  ipcMain.on('open-excel', async (event, message) => {
    console.log('打开Excel');
    if (message.url) {
      openExcel(message.url)
    }
  });

  ipcMain.on('send-print', async (event, message) => {
    console.log('发起打印');
    let pdf = message.pdf;
    // 下载远程 PDF 文件
    const filePath = await downloadPDF(pdf);
    console.log('下载的PDF:' + filePath);

    if (filePath) {
      try {
        print(filePath, {
          printer: message.printer.name,
        })
          .then(() => {
            // 发送打印成功的响应给渲染进程 
            event.sender.send('print-response', { type: 'print_ok' });
            // 打印完成后删除临时文件
            fs.unlinkSync(filePath);
          })
          .catch((error) => {
            console.error('Printing failed:', error);
            // 发送打印失败的响应给渲染进程
            event.sender.send('print-response', { type: 'print_error' });
          });
      } catch (error) {
        console.error('Failed to print:', error);
        event.sender.send('print-response', { type: 'print_failed' });
      }
    } else {
      console.error('Failed to download PDF');
      event.sender.send('print-response', { type: 'print_error' });
    }
  });


  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  });
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

function openExcel(fileUrl) {
  const win = BrowserWindow.getFocusedWindow();

  // 处理下载事件
  ipcMain.on('download-complete', (event, { filePath }) => {
    console.log('Excel 文件已下载完成：', filePath);
  });

  // 下载 Excel 文件
  const downloadOptions = {
    directory: app.getPath('downloads'), // 可自定义下载目录
    saveAs: true // 可根据需求自行设置
  };

  download(win, fileUrl, downloadOptions)
    .then(downloadItem => {
      console.log('正在下载 Excel 文件：', downloadItem.getSavePath());
    })
    .catch(err => {
      console.error('下载 Excel 文件时发生错误：', err);
    });
}

function downloadPDF(url) {
  return new Promise((resolve, reject) => {
    const fileURL = new URL(url);
    const fileName = `${Date.now()}.pdf`;
    const filePath = `${app.getPath('temp')}/${fileName}`;

    const file = fs.createWriteStream(filePath);

    https.get(fileURL, (response) => {
      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve(filePath);
      });

      file.on('error', (err) => {
        fs.unlinkSync(filePath);
        reject(err);
      });
    }).on('error', (err) => {
      fs.unlinkSync(filePath);
      reject(err);
    });
  });
}


const updateUrl = getVersionUrl + `?plat=${process.platform}&version=${appVersion}`;
//checkAppVersionAndUpdate(updateUrl);
function checkAppVersionAndUpdate(updateUrl) {
  // 检查是否有可用更新
  app.on('ready', () => {
    autoUpdater.setFeedURL({ url: updateUrl, provider: 'generic' });
    // 检查更新并弹出提示框
    autoUpdater.checkForUpdatesAndNotify();
    // 监听更新可用事件
    autoUpdater.on('update-available', (info) => {
      dialog.showMessageBox({
        type: 'info',
        title: '发现新版本',
        message: '发现新版本，是否立即更新？',
        buttons: ['是', '否']
      }, (buttonIndex) => {
        if (buttonIndex === 0) {
          // 用户选择更新，下载并安装更新
          autoUpdater.downloadUpdate();
        }
      });
    });

    // 监听下载进度事件
    autoUpdater.on('download-progress', (progress) => {
      console.log('下载进度:', progress.percent);
    });

    // 监听更新下载完成事件
    autoUpdater.on('update-downloaded', (info) => {
      dialog.showMessageBox({
        type: 'info',
        title: '更新已下载',
        message: '新版本已下载完成，是否立即重新启动以完成应用更新？',
        buttons: ['是', '否']
      }, (buttonIndex) => {
        if (buttonIndex === 0) {
          // 用户选择重新启动应用程序
          autoUpdater.quitAndInstall();
        }
      });
    });
    // 监听错误事件
    autoUpdater.on('error', (error) => {
      dialog.showErrorBox('更新错误', error == null ? '未知错误' : (error.stack || error).toString());
    });
  });
} 