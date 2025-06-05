
const { ipcRenderer,ipcMain } = require('electron')
  
ipcRenderer.on('print-response', (event, response) => {
    window.parent.postMessage({ type: response.type }, '*');
});

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type])
  }
 
  /**
   * 发送打印机列表到WEB端
   */
  function get_printers() { 
    ipcRenderer.invoke('get_printers')
      .then((printers) => {
         console.log('Electron Printers:', printers);
         window.parent.postMessage({ type: 'printers', data: printers }, '*'); 
      })
      .catch((error) => {
        console.error('Error reloading printers:', error);
      });
  }

  //get_printers();

   
})


 
window.addEventListener('message', async (event) => { 
  if (event.data.type === 'do_print') {
    const message = event.data.content;
    console.log('Electron Get Do Print:', message); 
    ipcRenderer.send('send-print', message); 
  }

  if (event.data.type === 'open_excel') {
    const message = event.data.content;
    console.log('Electron Open Excel:', message); 
    ipcRenderer.send('open-excel', message); 
  }
  /**
   * 窗口控制
  window.parent.postMessage(
    { 
      type: `window_control`, 
      content:action, 
    } , '*'
  );
   */
  if (event.data.type === 'window_control') {
    const message = event.data.content;
    console.log('window_control:', message);  
    
    // 添加窗口控制功能
    if (message === 'minimize') {
      ipcRenderer.send('window-control', 'minimize');
    } else if (message === 'maximize') {
      ipcRenderer.send('window-control', 'maximize');
    } else if (message === 'close') {
      ipcRenderer.send('window-control', 'close');
    }
  }
  
  // 添加文件夹选择功能
  if (event.data.type === 'open-folder') {
    console.log('Electron Open Folder');
    try {
      const result = await ipcRenderer.invoke('open-folder');
      window.parent.postMessage({ 
        type: 'folder-selected', 
        data: result 
      }, '*');
    } catch (error) {
      console.error('Error selecting folder:', error);
      window.parent.postMessage({ 
        type: 'folder-selected', 
        error: error.message 
      }, '*');
    }
  }
});




