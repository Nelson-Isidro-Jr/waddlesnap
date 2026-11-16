const { contextBridge, ipcRenderer } = require('electron');

const INVOKE = new Set([
  'state:get', 'state:set', 'hotkey:set', 'hotkey:pause', 'snap:start', 'folder:choose', 'folder:open',
  'file:show', 'recent:copy', 'recent:clear', 'win:minimize', 'win:close', 'app:quit',
]);
const SEND = new Set(['overlay:ready', 'overlay:done', 'toast:click']);
const LISTEN = new Set(['state', 'snapped', 'size-defined', 'navigate', 'overlay:init', 'toast:show', 'toast:hide', 'toast:sound']);

contextBridge.exposeInMainWorld('waddle', {
  invoke: (ch, ...args) => (INVOKE.has(ch) ? ipcRenderer.invoke(ch, ...args) : Promise.reject(new Error('blocked ' + ch))),
  send: (ch, ...args) => { if (SEND.has(ch)) ipcRenderer.send(ch, ...args); },
  on: (ch, cb) => {
    if (!LISTEN.has(ch)) return () => {};
    const fn = (_e, ...args) => cb(...args);
    ipcRenderer.on(ch, fn);
    return () => ipcRenderer.removeListener(ch, fn);
  },
});
