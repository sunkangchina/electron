/**
 * The preload script runs before. It has access to web APIs
 * as well as Electron's renderer process modules and some
 * polyfilled Node.js functions.
 *
 * https://www.electronjs.org/docs/latest/tutorial/sandbox
 */
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

  get_printers();

  function get_version(){
    ipcRenderer.invoke('get_version')
      .then((version) => { 
         window.parent.postMessage({ type: 'get_version', data: version }, '*'); 
      })
      .catch((error) => {
        console.error('Error get_version', error);
      });
  }
  get_version();
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

});




