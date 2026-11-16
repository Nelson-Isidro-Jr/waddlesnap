const {
  app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage,
  screen, desktopCapturer, clipboard, ClipboardItem, shell, dialog,
} = require('electron');
const path = require('path');
const fs = require('fs');
const { Store, uid } = require('./store');
const paster = require('./paster');

const START_HIDDEN = process.argv.includes('--hidden');
let logFile = null;
function log(...a) {
  try {
    if (!logFile) logFile = path.join(app.getPath('userData'), 'waddlesnap.log');
    const line = `[${new Date().toISOString()}] ` + a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ') + '\n';
    fs.appendFileSync(logFile, line);
  } catch { /* logging must never break the app */ }
}
const R = (...p) => path.join(__dirname, ...p);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showMain());
}
if (process.platform === 'win32') app.setAppUserModelId('com.waddlesnap.app');

let store;
let mainWin = null;
let overlayWin = null;
let toastWin = null;
let tray = null;
let quitting = false;
let snap = null; // active snap session
let hotkeyFailures = [];
let toastTimer = null;

const webPrefs = (extra = {}) => ({
  preload: R('preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  spellcheck: false,
  ...extra,
});

/* ───────────────────────── windows ───────────────────────── */

function createMain() {
  mainWin = new BrowserWindow({
    width: 1000, height: 720, minWidth: 880, minHeight: 600,
    frame: false, show: false, backgroundColor: '#FFF4F8',
    icon: R('assets', 'icon-256.png'),
    title: 'WaddleSnap',
    webPreferences: webPrefs({ autoplayPolicy: 'no-user-gesture-required' }),
  });
  mainWin.setMenu(null);
  mainWin.loadFile(R('renderer', 'index.html'));
  mainWin.once('ready-to-show', () => { if (!START_HIDDEN) mainWin.show(); });
  mainWin.on('close', (e) => {
    if (quitting || !store.get().closeToTray) return;
    e.preventDefault();
    mainWin.hide();
    if (!store.get().seenTrayTip) {
      store.set({ seenTrayTip: true });
      toast({ kind: 'info', title: 'Still waddling!', text: 'WaddleSnap is in your tray, hotkeys stay on.' });
    }
  });
  mainWin.on('closed', () => { mainWin = null; });
}

function showMain(page) {
  if (!mainWin) createMain();
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();
  if (page) mainWin.webContents.send('navigate', page);
}

function createToastWindow() {
  toastWin = new BrowserWindow({
    width: 380, height: 132, frame: false, transparent: true, resizable: false,
    skipTaskbar: true, alwaysOnTop: true, focusable: false, show: false, hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: webPrefs({ autoplayPolicy: 'no-user-gesture-required' }),
  });
  toastWin.setAlwaysOnTop(true, 'screen-saver');
  toastWin.loadFile(R('renderer', 'toast.html'));
  toastWin.on('closed', () => { toastWin = null; });
}

function toast(payload) {
  const st = store.get();
  if (!toastWin) createToastWindow();
  const deliver = () => {
    if (!toastWin) return;
    toastWin.webContents.send('toast:sound', { kind: payload.kind, on: st.ui.sounds });
    if (!st.ui.toasts) return;
    const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    const W = 380, H = 132;
    toastWin.setBounds({ x: wa.x + wa.width - W - 12, y: wa.y + wa.height - H - 12, width: W, height: H });
    toastWin.webContents.send('toast:show', payload);
    toastWin.showInactive();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (!toastWin) return;
      toastWin.webContents.send('toast:hide');
      toastTimer = setTimeout(() => toastWin && toastWin.hide(), 420);
    }, payload.ms || 2800);
  };
  if (toastWin.webContents.isLoading()) toastWin.webContents.once('did-finish-load', deliver);
  else deliver();
}

/* ───────────────────────── clipboard (Electron 44+ async API) ───────────────────────── */

async function copyPng(buf) {
  await clipboard.write([new ClipboardItem({ 'image/png': new Blob([buf], { type: 'image/png' }) })]);
}

async function clipboardIsEmpty() {
  try {
    const items = await clipboard.read();
    return !items.some(i => i.types && i.types.length);
  } catch { return false; }
}

/* ───────────────────────── capture ───────────────────────── */

// Exact physical pixel size of a display. Electron's DIP sizes are rounded, so
// size * scaleFactor can be off by one (2560 px at 150% -> 1707 DIP -> 2561 px),
// which would make the capture get resampled. On Windows ask the OS directly.
function physicalSize(display) {
  if (process.platform === 'win32' && typeof screen.dipToScreenRect === 'function') {
    try {
      const r = screen.dipToScreenRect(null, display.bounds);
      if (r && r.width > 0 && r.height > 0) return { width: r.width, height: r.height };
    } catch { /* fall back below */ }
  }
  const sf = display.scaleFactor || 1;
  return { width: Math.round(display.bounds.width * sf), height: Math.round(display.bounds.height * sf) };
}

async function captureDisplay(display) {
  const want = physicalSize(display);
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: want, fetchWindowIcons: false });
  if (!sources.length) throw new Error('No screens available to capture');
  let src = sources.find(s => s.display_id && String(s.display_id) === String(display.id));
  if (!src) {
    const idx = screen.getAllDisplays().findIndex(d => d.id === display.id);
    src = sources[idx] || sources[0];
  }
  return src.thumbnail;
}

function createOverlay(display) {
  const b = display.bounds;
  const w = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    frame: false, show: false, resizable: false, movable: false, minimizable: false,
    maximizable: false, fullscreenable: false, skipTaskbar: true, alwaysOnTop: true,
    hasShadow: false, enableLargerThanScreen: true, backgroundColor: '#1a0f16',
    webPreferences: webPrefs({ autoplayPolicy: 'no-user-gesture-required' }),
  });
  w.setAlwaysOnTop(true, 'screen-saver');
  w.setBounds(b);
  w.loadFile(R('renderer', 'overlay.html'));
  return w;
}

async function startSnap(mode, opts = {}) {
  if (snap) return;
  snap = { mode, returnToMain: false };
  try {
    if (opts.fromApp && mainWin && mainWin.isVisible()) {
      snap.returnToMain = true;
      mainWin.hide();
      await sleep(260); // let the window fade out of the screen
    }
    if (toastWin && toastWin.isVisible()) { toastWin.hide(); await sleep(80); }

    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const ow = createOverlay(display);
    overlayWin = ow;
    const loaded = new Promise(r => ow.webContents.once('did-finish-load', r));
    const image = await captureDisplay(display);
    await loaded;
    if (ow.isDestroyed()) throw new Error('overlay closed');

    const size = image.getSize();
    // image pixels per CSS px in the overlay: the display's scale factor when the
    // capture came back at full physical resolution (the normal case)
    const phys = physicalSize(display);
    const scale = (display.scaleFactor || 1) * (size.width / phys.width);
    log('capture', { bounds: display.bounds, sf: display.scaleFactor, phys, img: size, scale });
    Object.assign(snap, { display, image, scale });

    const st = store.get();
    ow.webContents.send('overlay:init', {
      mode,
      image: 'data:image/jpeg;base64,' + image.toJPEG(92).toString('base64'),
      scale,
      imgW: size.width, imgH: size.height,
      presets: st.presets,
      activeId: opts.presetId || st.activePresetId,
      cursor: { x: cursor.x - display.bounds.x, y: cursor.y - display.bounds.y },
      sounds: st.ui.sounds,
    });
  } catch (e) {
    console.error('snap failed', e);
    log('snap failed', String(e && e.stack || e));
    endSnap();
    toast({ kind: 'warn', title: 'Snap failed', text: String(e.message || e).slice(0, 120) });
  }
}

ipcMain.on('overlay:ready', () => {
  if (!overlayWin || overlayWin.isDestroyed() || !snap) return;
  overlayWin.setBounds(snap.display.bounds); // twice: fixes mixed-DPI sizing on Windows
  overlayWin.show();
  overlayWin.moveTop();
  overlayWin.focus();
});

ipcMain.on('overlay:done', async (_e, res) => {
  const s = snap;
  if (!s) return;
  if (overlayWin && !overlayWin.isDestroyed()) overlayWin.destroy();
  overlayWin = null;
  try {
    if (!res || res.action === 'cancel') return;
    if (res.action === 'define') {
      const size = { w: Math.round(res.rect.w * s.scale), h: Math.round(res.rect.h * s.scale) };
      s.returnToMain = false;
      showMain('sizes');
      mainWin.webContents.send('size-defined', size);
      return;
    }
    // action === 'snap'
    const { width: imgW, height: imgH } = s.image.getSize();
    const st = store.get();
    const preset = res.presetId ? st.presets.find(p => p.id === res.presetId) : null;
    let w = preset ? preset.w : Math.round(res.rect.w * s.scale);
    let h = preset ? preset.h : Math.round(res.rect.h * s.scale);
    w = Math.max(1, Math.min(w, imgW));
    h = Math.max(1, Math.min(h, imgH));
    const x = Math.max(0, Math.min(Math.round(res.rect.x * s.scale), imgW - w));
    const y = Math.max(0, Math.min(Math.round(res.rect.y * s.scale), imgH - h));
    let out = s.image.crop({ x, y, width: w, height: h });
    const got = out.getSize();
    if (got.width !== w || got.height !== h) out = out.resize({ width: w, height: h, quality: 'best' });

    if (res.savePresetName) {
      const p = { id: uid(), name: res.savePresetName.slice(0, 32), w, h };
      store.set({ presets: [...st.presets, p] });
      onStateChanged();
    }
    if (preset && st.activePresetId !== preset.id) { store.set({ activePresetId: preset.id }); onStateChanged(); }
    await deliver(out, { w, h, name: preset ? preset.name : (res.savePresetName || 'Free snap') });
  } catch (e) {
    console.error(e);
    log('deliver failed', String(e && e.stack || e));
    toast({ kind: 'warn', title: 'Could not save', text: String(e.message || e).slice(0, 120) });
  } finally {
    endSnap();
  }
});

function endSnap() {
  if (overlayWin && !overlayWin.isDestroyed()) overlayWin.destroy();
  overlayWin = null;
  const back = snap && snap.returnToMain;
  snap = null;
  if (back) showMain();
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

async function deliver(img, meta) {
  const st = store.get();
  let file = null;
  const png = img.toPNG();
  if (st.capture.copy) await copyPng(png);
  if (st.capture.save) {
    const dir = st.capture.folder;
    await fs.promises.mkdir(dir, { recursive: true });
    let base = `WaddleSnap_${stamp()}_${meta.w}x${meta.h}`;
    file = path.join(dir, base + '.png');
    for (let i = 2; fs.existsSync(file); i++) file = path.join(dir, `${base}_${i}.png`);
    await fs.promises.writeFile(file, png);
  }
  const k = Math.min(1, 360 / meta.w, 220 / meta.h);
  const thumbImg = k < 1 ? img.resize({ width: Math.max(1, Math.round(meta.w * k)), height: Math.max(1, Math.round(meta.h * k)), quality: 'good' }) : img;
  const entry = {
    id: uid(), file, w: meta.w, h: meta.h, name: meta.name, time: Date.now(),
    thumb: 'data:image/jpeg;base64,' + thumbImg.toJPEG(82).toString('base64'),
  };
  store.set({ recent: [entry, ...st.recent].slice(0, 12) });
  onStateChanged();
  if (mainWin) mainWin.webContents.send('snapped', entry);
  const text = st.capture.copy && file ? 'Copied & saved · click to open'
    : st.capture.copy ? 'Copied! Ready to paste anywhere'
    : file ? 'Saved · click to open the folder' : 'Snapped!';
  toast({ kind: 'snap', title: `Snapped ${meta.w} × ${meta.h}!`, text, thumb: entry.thumb, file });
}

/* ───────────────────────── super paste ───────────────────────── */

async function doSuperPaste() {
  const st = store.get();
  if (!st.superPaste.enabled || snap) return;
  if (await clipboardIsEmpty()) {
    toast({ kind: 'warn', title: 'Clipboard is empty', text: 'Copy something first, then Super Paste!' });
    return;
  }
  const res = await paster.superPaste({ ...st.superPaste, hotkeyVk: paster.acceleratorVk(st.hotkeys.superPaste) });
  log('super paste', res);
  if (res.ok) {
    const sep = { enter: ' with Enter', tab: ' with Tab', space: ' with spaces' }[st.superPaste.separator] || '';
    toast({ kind: 'paste', title: `Pasted ×${res.count}!`, text: `One hotkey, ${res.count} pastes${sep}.`, count: res.count, ms: 1800 });
  } else if (res.error !== 'busy') {
    toast({ kind: 'warn', title: 'Super Paste hiccup', text: res.error });
  }
}

/* ───────────────────────── hotkeys ───────────────────────── */

const ACTIONS = {
  snap: () => startSnap('preset'),
  free: () => startSnap('free'),
  superPaste: () => doSuperPaste(),
};

function registerHotkeys() {
  globalShortcut.unregisterAll();
  const st = store.get();
  hotkeyFailures = [];
  for (const [name, accel] of Object.entries(st.hotkeys)) {
    if (!accel || !ACTIONS[name]) continue;
    if (name === 'superPaste' && !st.superPaste.enabled) continue;
    let ok = false;
    try { ok = globalShortcut.register(accel, ACTIONS[name]); } catch { ok = false; }
    if (!ok) hotkeyFailures.push(name);
  }
  if (hotkeyFailures.length) log('hotkeys unavailable', hotkeyFailures.map(n => `${n}=${st.hotkeys[n]}`));
  return hotkeyFailures;
}

function setHotkey(name, accel) {
  const st = store.get();
  if (!(name in ACTIONS)) return { ok: false, error: 'Unknown hotkey' };
  const clash = Object.entries(st.hotkeys).find(([n, a]) => n !== name && a && accel && a.toLowerCase() === accel.toLowerCase());
  if (clash) return { ok: false, error: 'That combo is already used by another WaddleSnap action.' };
  globalShortcut.unregisterAll();
  let ok = true;
  if (accel) {
    try { ok = globalShortcut.register(accel, () => {}); } catch { ok = false; }
    globalShortcut.unregisterAll();
  }
  if (!ok) {
    registerHotkeys();
    return { ok: false, error: 'Another app is already using that combo. Try a different one!' };
  }
  store.set({ hotkeys: { [name]: accel } });
  registerHotkeys();
  onStateChanged();
  return { ok: true };
}

/* ───────────────────────── tray ───────────────────────── */

function pretty(accel) {
  return String(accel || '').replace(/CommandOrControl|Control/g, 'Ctrl').replace(/\+/g, ' + ');
}

function buildTray() {
  const img = nativeImage.createFromPath(R('assets', 'tray.png'));
  const img2 = nativeImage.createFromPath(R('assets', 'tray@2x.png'));
  if (!img2.isEmpty()) img.addRepresentation({ scaleFactor: 2, buffer: img2.toPNG() });
  tray = new Tray(img);
  tray.setToolTip('WaddleSnap');
  tray.on('click', () => showMain());
  tray.on('double-click', () => showMain());
  updateTray();
}

function updateTray() {
  if (!tray) return;
  const st = store.get();
  const active = st.presets.find(p => p.id === st.activePresetId) || st.presets[0];
  const counts = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20];
  if (!counts.includes(st.superPaste.count)) counts.push(st.superPaste.count), counts.sort((a, b) => a - b);
  const menu = Menu.buildFromTemplate([
    { label: `Snap  ${active ? `${active.name} (${active.w}×${active.h})` : ''}\t${pretty(st.hotkeys.snap)}`, click: () => startSnap('preset') },
    { label: `Free snap\t${pretty(st.hotkeys.free)}`, click: () => startSnap('free') },
    {
      label: 'Snap size',
      submenu: st.presets.map(p => ({
        label: `${p.name}  ${p.w}×${p.h}`, type: 'radio', checked: p.id === st.activePresetId,
        click: () => { store.set({ activePresetId: p.id }); onStateChanged(); },
      })),
    },
    { type: 'separator' },
    {
      label: `Super Paste ×${st.superPaste.count}\t${pretty(st.hotkeys.superPaste)}`,
      submenu: [
        { label: 'Enabled', type: 'checkbox', checked: st.superPaste.enabled, click: (m) => applyPatch({ superPaste: { enabled: m.checked } }) },
        { type: 'separator' },
        ...counts.map(n => ({
          label: `Paste ×${n}`, type: 'radio', checked: n === st.superPaste.count,
          click: () => applyPatch({ superPaste: { count: n } }),
        })),
      ],
    },
    { type: 'separator' },
    { label: 'Open WaddleSnap', click: () => showMain() },
    { label: 'Open screenshots folder', click: () => openFolder() },
    { type: 'separator' },
    { label: 'Quit WaddleSnap', click: () => { quitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(`WaddleSnap · ${active ? active.w + '×' + active.h : ''} · Paste ×${st.superPaste.count}`);
}

/* ───────────────────────── state / ipc ───────────────────────── */

function publicState() {
  return {
    ...store.get(),
    version: app.getVersion(),
    platform: process.platform,
    hotkeyFailures,
  };
}

function onStateChanged() {
  updateTray();
  if (mainWin) mainWin.webContents.send('state', publicState());
}

function applyPatch(patch) {
  const before = store.get();
  store.set(patch);
  const after = store.get();
  if (patch.superPaste && before.superPaste.enabled !== after.superPaste.enabled) registerHotkeys();
  if ('startup' in patch) {
    try { app.setLoginItemSettings({ openAtLogin: !!after.startup, args: ['--hidden'] }); } catch { /* unsupported */ }
  }
  onStateChanged();
  return publicState();
}

async function openFolder() {
  const dir = store.get().capture.folder;
  await fs.promises.mkdir(dir, { recursive: true }).catch(() => {});
  shell.openPath(dir);
}

ipcMain.handle('state:get', () => publicState());
ipcMain.handle('state:set', (_e, patch) => applyPatch(patch || {}));
ipcMain.handle('hotkey:set', (_e, name, accel) => setHotkey(name, accel));
ipcMain.handle('hotkey:pause', (_e, paused) => { if (paused) globalShortcut.unregisterAll(); else registerHotkeys(); return true; });
ipcMain.handle('snap:start', (_e, mode, presetId) => {
  if (presetId) { store.set({ activePresetId: presetId }); onStateChanged(); }
  startSnap(mode === 'free' ? 'free' : mode === 'define' ? 'define' : 'preset', { fromApp: true, presetId });
  return true;
});
ipcMain.handle('folder:choose', async () => {
  const r = await dialog.showOpenDialog(mainWin, { title: 'Choose where to save screenshots', properties: ['openDirectory', 'createDirectory'], defaultPath: store.get().capture.folder });
  if (r.canceled || !r.filePaths[0]) return publicState();
  return applyPatch({ capture: { folder: r.filePaths[0] } });
});
ipcMain.handle('folder:open', () => openFolder());
ipcMain.handle('file:show', (_e, file) => { if (file && fs.existsSync(file)) shell.showItemInFolder(file); else openFolder(); });
ipcMain.handle('recent:copy', async (_e, id) => {
  const r = store.get().recent.find(x => x.id === id);
  if (!r) return false;
  const png = r.file && fs.existsSync(r.file)
    ? await fs.promises.readFile(r.file)
    : nativeImage.createFromDataURL(r.thumb).toPNG();
  await copyPng(png);
  return true;
});
ipcMain.handle('recent:clear', () => applyPatch({ recent: [] }));
ipcMain.handle('win:minimize', () => mainWin && mainWin.minimize());
ipcMain.handle('win:close', () => mainWin && mainWin.close());
ipcMain.handle('app:quit', () => { quitting = true; app.quit(); });

ipcMain.on('toast:click', (_e, file) => {
  if (toastWin) toastWin.hide();
  if (file && fs.existsSync(file)) shell.showItemInFolder(file);
  else showMain();
});

/* ───────────────────────── lifecycle ───────────────────────── */

app.whenReady().then(() => {
  store = new Store();
  log('start', { version: app.getVersion(), platform: process.platform, os: require('os').release(), electron: process.versions.electron,
    displays: screen.getAllDisplays().map(d => ({ bounds: d.bounds, sf: d.scaleFactor })) });
  createMain();
  createToastWindow();
  buildTray();
  registerHotkeys();
  if (hotkeyFailures.length) {
    setTimeout(() => toast({ kind: 'warn', title: 'Some hotkeys are taken', text: 'Open Settings to pick different combos.' }), 1500);
  }
});

app.on('window-all-closed', (e) => { /* keep running in the tray */ });
app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => globalShortcut.unregisterAll());
