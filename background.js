const { ipcMain, BrowserWindow,app } = require('electron');
const { ipcRenderer } = require('electron');

 
ipcMain.handle('get_printers', async (event) => {
  const win = BrowserWindow.getFocusedWindow();
  const printers = await win.webContents.getPrintersAsync(); 
  return printers;
});

ipcMain.handle('get_version', async (event) => {
  return app.getVersion();
});
