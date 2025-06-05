const { ipcMain, BrowserWindow,app } = require('electron');
const { ipcRenderer } = require('electron');

/**
 * 主动获取本地打印机列表
 * @returns {Promise<Array>} 打印机列表
 */
ipcMain.handle('get_printers', async (event) => {
  const win = BrowserWindow.getFocusedWindow();
  const printers = await win.webContents.getPrintersAsync(); 
  return printers;
}); 

