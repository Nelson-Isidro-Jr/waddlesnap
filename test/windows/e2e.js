/*
 * WaddleSnap end-to-end test on real Windows (GitHub Actions windows runner).
 * Drives the INSTALLED app with Playwright, but uses real OS input (wintool.exe SendInput)
 * for hotkeys, keys and mouse, and an independent GDI screen capture as ground truth.
 */
const { _electron } = require('playwright-core');
const { PNG } = require('pngjs');
const { execFile, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'test', 'out');
const SHOTS = path.join(OUT, 'shots');
// Overridable so the harness itself can be dry-run on Linux before spending a Windows CI run.
const TOOL = process.env.WINTOOL || path.join(__dirname, 'bin', 'wintool.exe');
const EXE = process.env.WADDLE_EXE || path.join(process.env.LOCALAPPDATA || '', 'Programs', 'WaddleSnap', 'WaddleSnap.exe');
const BASE_ARGS = process.env.WADDLE_ARGS ? process.env.WADDLE_ARGS.split(' ') : [];
fs.mkdirSync(SHOTS, { recursive: true });

const VK = { CTRL: 0x11, ALT: 0x12, SHIFT: 0x10, ENTER: 0x0D, ESC: 0x1B, S: 0x53, F: 0x46, P: 0x50, V: 0x56, D3: 0x33, D1: 0x31 };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const logLines = [];
function log(...a) { const l = a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); console.log(l); logLines.push(l); }
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail: String(detail).slice(0, 2000) });
  log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + String(detail).slice(0, 400) : ''}`);
}

function tool(...args) {
  return new Promise((resolve) => {
    execFile(TOOL, args.map(String), { timeout: 20000, windowsHide: true, encoding: 'utf8' }, (err, stdout) => {
      resolve({ code: err ? (err.code ?? -1) : 0, out: (stdout || '').trim() });
    });
  });
}
const keys = (...vks) => tool('keys', ...vks.map(v => '0x' + v.toString(16)));

let shotN = 0;
async function gdi(name) {
  const f = path.join(SHOTS, `${String(++shotN).padStart(2, '0')}-${name}.bmp`);
  await tool('shot', f);
  return f;
}

function readBmp(file) {
  const b = fs.readFileSync(file);
  const off = b.readUInt32LE(10), w = b.readInt32LE(18), hRaw = b.readInt32LE(22), bpp = b.readUInt16LE(28);
  const h = Math.abs(hRaw), top = hRaw < 0, stride = Math.ceil((w * bpp) / 32) * 4, px = bpp / 8;
  const rgb = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    const sy = top ? y : h - 1 - y;
    for (let x = 0; x < w; x++) {
      const i = off + sy * stride + x * px, o = (y * w + x) * 3;
      rgb[o] = b[i + 2]; rgb[o + 1] = b[i + 1]; rgb[o + 2] = b[i];
    }
  }
  return { w, h, rgb };
}
function readPng(file) {
  const p = PNG.sync.read(fs.readFileSync(file));
  const rgb = Buffer.alloc(p.width * p.height * 3);
  for (let i = 0, j = 0; i < p.data.length; i += 4, j += 3) { rgb[j] = p.data[i]; rgb[j + 1] = p.data[i + 1]; rgb[j + 2] = p.data[i + 2]; }
  return { w: p.width, h: p.height, rgb };
}
// Compare image A against region of B at (x0,y0). Returns number of differing pixels.
function compare(a, b, x0, y0, tol = 0) {
  let diff = 0, maxd = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const ia = (y * a.w + x) * 3, ib = ((y + y0) * b.w + (x + x0)) * 3;
    const d = Math.max(Math.abs(a.rgb[ia] - b.rgb[ib]), Math.abs(a.rgb[ia + 1] - b.rgb[ib + 1]), Math.abs(a.rgb[ia + 2] - b.rgb[ib + 2]));
    if (d > tol) diff++;
    if (d > maxd) maxd = d;
  }
  return { diff, total: a.w * a.h, maxd };
}
// Find where image A sits inside B (searches a window around the guess) — for diagnostics.
function locate(a, b, gx, gy, r = 6) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = gx + dx, y = gy + dy;
    if (x < 0 || y < 0 || x + a.w > b.w || y + a.h > b.h) continue;
    if (compare(a, b, x, y, 2).diff === 0) return { dx, dy };
  }
  return null;
}

async function step(name, fn, ms = 120000) {
  log(`\n=== ${name}`);
  try {
    await Promise.race([fn(), sleep(ms).then(() => { throw new Error('step timed out'); })]);
  } catch (e) {
    check(name + ' (crashed)', false, e && e.stack ? e.stack : e);
    await gdi('fail-' + name.replace(/\W+/g, '-').slice(0, 40)).catch(() => {});
  }
}

async function launch(extraArgs = []) {
  const app = await _electron.launch({ executablePath: EXE, args: [...BASE_ARGS, ...extraArgs], timeout: 90000 });
  app.process().stderr.on('data', d => { const s = String(d); if (/error|exception|fail/i.test(s) && !/gpu|dbus|viz|crashpad|WSALookupService|network_change/i.test(s)) logLines.push('[app stderr] ' + s.trim()); });
  app.process().stdout.on('data', d => logLines.push('[app stdout] ' + String(d).trim()));
  await app.firstWindow({ timeout: 60000 });
  let win = null;
  for (let i = 0; i < 100 && !win; i++) { win = app.windows().find(w => w.url().endsWith('index.html')); if (!win) await sleep(150); }
  if (!win) throw new Error('main window not found: ' + app.windows().map(w => w.url()).join(','));
  win.on('pageerror', e => check('no renderer errors (main window)', false, e.message));
  win.on('console', m => { if (m.type() === 'error') logLines.push('[renderer error] ' + m.text()); });
  await win.waitForSelector('body.ready', { timeout: 30000 });
  return { app, win };
}

const state = (win) => win.evaluate(() => window.waddle.invoke('state:get'));
const setState = (win, patch) => win.evaluate((p) => window.waddle.invoke('state:set', p), patch);

async function waitOverlay(app, trigger) {
  const p = app.waitForEvent('window', { timeout: 15000 });
  await trigger();
  const ov = await p;
  ov.on('pageerror', e => check('no renderer errors (overlay)', false, e.message));
  await ov.waitForSelector('body.in', { timeout: 15000 });
  await sleep(450);
  return ov;
}
async function newFile(dir, before, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const f = (fs.existsSync(dir) ? fs.readdirSync(dir) : []).filter(x => x.endsWith('.png') && !before.includes(x));
    if (f.length) { await sleep(300); return path.join(dir, f[0]); }
    await sleep(150);
  }
  return null;
}
const listPngs = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter(x => x.endsWith('.png')) : []);
async function selRect(ov) {
  return ov.evaluate(() => {
    const s = document.getElementById('sel');
    return { x: parseFloat(s.style.left), y: parseFloat(s.style.top), w: parseFloat(s.style.width), h: parseFloat(s.style.height), scale: Number(document.body.dataset.scale), label: document.getElementById('labelDims').textContent };
  });
}
async function elCenterOnScreen(app, page, selector, urlEnds) {
  const r = await page.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, selector);
  const wb = await app.evaluate(({ BrowserWindow, screen }, u) => {
    const w = BrowserWindow.getAllWindows().find(x => x.webContents.getURL().endsWith(u));
    const b = w.getContentBounds();
    const d = screen.getDisplayMatching(b);
    return { x: b.x, y: b.y, sf: d.scaleFactor };
  }, urlEnds);
  return { x: Math.round((wb.x + r.x) * wb.sf), y: Math.round((wb.y + r.y) * wb.sf) };
}

async function showPattern(app) {
  await app.evaluate(async ({ BrowserWindow, screen }) => {
    const d = screen.getPrimaryDisplay();
    const w = new BrowserWindow({ ...d.bounds, frame: false, show: false, skipTaskbar: true, focusable: false, resizable: false, backgroundColor: '#000000' });
    const html = `<html><body style="margin:0;overflow:hidden;background:#000"><canvas id=c></canvas><script>
      const c = document.getElementById('c'), r = devicePixelRatio, W = Math.round(innerWidth * r), H = Math.round(innerHeight * r);
      c.width = W; c.height = H; c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px';
      const x = c.getContext('2d'), im = x.createImageData(W, H);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = (j * W + i) * 4; im.data[k] = (i * 7) & 255; im.data[k + 1] = (j * 5) & 255; im.data[k + 2] = ((i + j) * 3) & 255; im.data[k + 3] = 255; }
      x.putImageData(im, 0, 0);</script></body></html>`;
    await w.loadURL('data:text/html;base64,' + Buffer.from(html).toString('base64'));
    w.showInactive();
    globalThis.__pattern = w;
  });
  await sleep(1200);
}
const hidePattern = (app) => app.evaluate(() => { if (globalThis.__pattern) { globalThis.__pattern.destroy(); globalThis.__pattern = null; } });

/* Preset snap with REAL hotkey + REAL keys + REAL mouse drag, verified against a GDI capture. */
async function presetSnapTest(app, win, tag) {
  const st = await state(win);
  const dir = st.capture.folder;
  const classic = st.presets.findIndex(p => p.w === 640 && p.h === 480);
  await showPattern(app);
  await win.evaluate(() => window.waddle.invoke('win:close')); // hide to tray
  await sleep(1500);
  const gtFile = await gdi(`${tag}-ground-truth`);
  const before = listPngs(dir);
  const ov = await waitOverlay(app, () => keys(VK.CTRL, VK.ALT, VK.S));
  check(`${tag}: Ctrl+Alt+S opens the snap frame`, true);
  await gdi(`${tag}-overlay-opened`);
  await keys(0x31 + classic); // real key "3" -> Classic 640x480
  await sleep(500);
  let r = await selRect(ov);
  check(`${tag}: real number key switches size (overlay has keyboard focus)`, r.label.replace(/\s/g, '') === '640×480', `label=${r.label}`);
  if (r.label.replace(/\s/g, '') !== '640×480') { await ov.keyboard.press(String(classic + 1)); await sleep(400); r = await selRect(ov); }
  const s = r.scale;
  // real mouse drag: grab the frame centre, drop it so the top-left lands near (150,120) DIP
  const from = { x: Math.round((r.x + r.w / 2) * s), y: Math.round((r.y + r.h / 2) * s) };
  const to = { x: Math.round((150 + r.w / 2) * s), y: Math.round((120 + r.h / 2) * s) };
  await tool('drag', from.x, from.y, to.x, to.y);
  await sleep(400);
  const r2 = await selRect(ov);
  check(`${tag}: real mouse drag moves the frame`, Math.abs(r2.x - 150) < 3 && Math.abs(r2.y - 120) < 3, JSON.stringify(r2));
  await gdi(`${tag}-overlay-moved`);
  await keys(VK.ENTER);
  const f = await newFile(dir, before);
  check(`${tag}: Enter saves a PNG`, !!f, f || 'no file');
  if (!f) { await ov.keyboard.press('Escape').catch(() => {}); return; }
  await sleep(600);
  await gdi(`${tag}-toast-after-snap`);
  const img = readPng(f), gt = readBmp(gtFile);
  check(`${tag}: saved image is exactly 640×480`, img.w === 640 && img.h === 480, `${img.w}x${img.h}`);
  const px = Math.round(r2.x * s), py = Math.round(r2.y * s);
  const cmp = compare(img, gt, px, py, 2);
  const where = cmp.diff ? locate(img, gt, px, py) : { dx: 0, dy: 0 };
  check(`${tag}: pixels match the screen exactly where the frame was`, cmp.diff === 0, `diff=${cmp.diff}/${cmp.total} maxDelta=${cmp.maxd} at=(${px},${py}) actualOffset=${JSON.stringify(where)}`);
  const ci = await tool('clipinfo');
  log('clipboard:', ci.out);
  const m = /dib: (\d+)x(\d+)/.exec(ci.out);
  check(`${tag}: clipboard holds a 640×480 Windows bitmap (pasteable in Paint/Word/Discord)`, m && m[1] === '640' && m[2] === '480', ci.out);
  const dump = path.join(SHOTS, `${tag}-clipboard.bmp`);
  const cd = await tool('clipdump', dump);
  if (cd.code === 0 && fs.existsSync(dump)) {
    const cb = readBmp(dump);
    const cc = compare(cb, img, 0, 0, 2);
    check(`${tag}: clipboard pixels identical to the saved PNG`, cb.w === img.w && cb.h === img.h && cc.diff === 0, `${cb.w}x${cb.h} diff=${cc.diff} maxDelta=${cc.maxd} (${cd.out})`);
  } else check(`${tag}: clipboard bitmap readable`, false, cd.out);
  await hidePattern(app);
}

async function freeSnapTest(app, win, tag, saveName) {
  const st = await state(win);
  const dir = st.capture.folder;
  const before = listPngs(dir);
  const ov = await waitOverlay(app, () => keys(VK.CTRL, VK.ALT, VK.F));
  check(`${tag}: Ctrl+Alt+F opens free snap`, true);
  const s = Number(await ov.evaluate(() => document.body.dataset.scale));
  await tool('drag', Math.round(100 * s), Math.round(120 * s), Math.round(421 * s), Math.round(351 * s));
  await sleep(500);
  const r = await selRect(ov);
  check(`${tag}: real mouse drag draws a box`, Math.abs(r.w - 321) < 2 && Math.abs(r.h - 231) < 2, JSON.stringify(r));
  await gdi(`${tag}-free-drawn`);
  const btn = await elCenterOnScreen(app, ov, '[data-act="name"]', 'overlay.html');
  await tool('click', btn.x, btn.y);
  await sleep(400);
  const hasInput = await ov.evaluate(() => !!document.getElementById('tbName'));
  check(`${tag}: real click on "Save size" opens the name box`, hasInput);
  if (hasInput) { await ov.fill('#tbName', saveName); }
  await keys(VK.ENTER);
  const f = await newFile(dir, before);
  const img = f && readPng(f);
  const ew = Math.round(r.w * s), eh = Math.round(r.h * s);
  check(`${tag}: free snap saved at the drawn size`, img && img.w === ew && img.h === eh, img ? `${img.w}x${img.h} expected ${ew}x${eh}` : 'no file');
  await sleep(800);
  const st2 = await state(win);
  check(`${tag}: "Save size" added a custom size`, st2.presets.some(p => p.name === saveName && p.w === ew && p.h === eh), st2.presets.map(p => `${p.name}:${p.w}x${p.h}`).join(', '));
}

(async () => {
  log('WaddleSnap Windows E2E', new Date().toISOString());
  check('installed app exists', fs.existsSync(EXE), EXE);
  const disp = await tool('shot', path.join(SHOTS, '00-desktop.bmp'));
  log('screen:', disp.out);

  let { app, win } = await launch();
  const appPid = app.process().pid;

  await step('main window renders', async () => {
    await sleep(1500);
    const fonts = await win.evaluate(() => ({ fredoka: document.fonts.check('600 20px Fredoka'), nunito: document.fonts.check('16px Nunito') }));
    check('bundled fonts load', fonts.fredoka && fonts.nunito, JSON.stringify(fonts));
    const vis = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(w => ({ url: w.webContents.getURL().split('/').pop(), visible: w.isVisible(), bounds: w.getBounds() })));
    log('windows:', vis);
    check('main window is visible on first launch', vis.some(w => w.url === 'index.html' && w.visible));
    await gdi('main-snap-page');
    for (const p of ['sizes', 'paste', 'settings']) {
      await win.click(`.nav-item[data-page="${p}"]`);
      await sleep(900);
      await gdi('main-' + p);
    }
    await win.click('.nav-item[data-page="snap"]');
    const st = await state(win);
    check('default hotkeys registered', (st.hotkeyFailures || []).length === 0, JSON.stringify(st.hotkeyFailures));
  });

  await step('preset snap @100%', () => presetSnapTest(app, win, 'dpi100'));
  await step('free snap + save size @100%', () => freeSnapTest(app, win, 'dpi100', 'CI Free'));

  await step('custom size from the form', async () => {
    await win.evaluate(() => window.waddle.invoke('state:get'));
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().find(x => x.webContents.getURL().endsWith('index.html')); w.show(); w.focus(); });
    await sleep(500);
    await win.click('.nav-item[data-page="sizes"]'); await sleep(500);
    await win.click('#addSize'); await sleep(400);
    await win.fill('#fName', 'CI Banner'); await win.fill('#fW', '777'); await win.fill('#fH', '333');
    await gdi('size-form');
    await win.click('#saveSize'); await sleep(700);
    const st = await state(win);
    const p = st.presets.find(x => x.name === 'CI Banner');
    check('typed custom size is saved', p && p.w === 777 && p.h === 333);
    const before = listPngs(st.capture.folder);
    const ov = await waitOverlay(app, () => win.evaluate((id) => window.waddle.invoke('snap:start', 'preset', id), p.id));
    await keys(VK.ENTER);
    const f = await newFile(st.capture.folder, before);
    const img = f && readPng(f);
    check('snap with typed custom size is exactly 777×333', img && img.w === 777 && img.h === 333, img ? `${img.w}x${img.h}` : 'no file');
    await sleep(1200);
  });

  await step('draw a size on screen', async () => {
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().find(x => x.webContents.getURL().endsWith('index.html')); w.show(); w.focus(); });
    await win.click('.nav-item[data-page="sizes"]'); await sleep(400);
    await win.click('#addSize'); await sleep(400);
    const ov = await waitOverlay(app, () => win.click('#drawSize'));
    await tool('drag', 200, 200, 612, 509);
    await sleep(400);
    await keys(VK.ENTER);
    await win.waitForSelector('#sizeModal:not([hidden])', { timeout: 8000 });
    await sleep(500);
    const w = await win.inputValue('#fW'), h = await win.inputValue('#fH');
    check('drawn size pre-fills the form', w === '412' && h === '309', `${w}x${h}`);
    await gdi('drawn-size-form');
    await win.click('[data-close]');
    await sleep(400);
  });

  await step('super paste into the app (real hotkey)', async () => {
    await setState(win, { superPaste: { count: 3, separator: 'none', delay: 60, enabled: true } });
    await app.evaluate(async ({ clipboard, BrowserWindow }) => {
      await clipboard.writeText('hi ');
      const w = BrowserWindow.getAllWindows().find(x => x.webContents.getURL().endsWith('index.html')); w.show(); w.focus();
    });
    await win.click('.nav-item[data-page="paste"]'); await sleep(600);
    await win.fill('#tryArea', '');
    const c = await elCenterOnScreen(app, win, '#tryArea', 'index.html');
    await tool('click', c.x, c.y); // real click so the window is really in the foreground
    await sleep(400);
    await keys(VK.CTRL, VK.ALT, VK.P);
    await sleep(3000);
    const v = await win.inputValue('#tryArea');
    check('Ctrl+Alt+P pastes 3 times', v === 'hi hi hi ', JSON.stringify(v));
    await gdi('paste-in-app');
  });

  let notepad = null;
  await step('super paste into Notepad (×4, Enter between)', async () => {
    notepad = spawn('notepad.exe', [], { detached: false });
    const spawnErr = await new Promise(r => { notepad.once('error', r); setTimeout(() => r(null), 2500); });
    if (spawnErr) throw new Error('could not start Notepad: ' + spawnErr.message);
    await setState(win, { superPaste: { count: 4, separator: 'enter' } });
    await app.evaluate(async ({ clipboard }) => { await clipboard.writeText('hello penguin'); });
    let cw = await tool('clickwin', notepad.pid);
    if (cw.code !== 0) cw = await tool('clickwin', 0, 'Notepad');
    log('notepad window:', cw.out);
    await sleep(500);
    await keys(VK.CTRL, VK.ALT, VK.P);
    await sleep(3500);
    let t = await tool('gettext', notepad.pid);
    if (t.code !== 0) t = await tool('gettext', 0, 'Notepad');
    const want = ['hello penguin', 'hello penguin', 'hello penguin', 'hello penguin'].join('\r\n');
    check('Notepad receives exactly 4 pastes on separate lines', t.out.replace(/\r?\n/g, '\r\n') === want, JSON.stringify(t.out));
    await gdi('paste-in-notepad');
    // empty clipboard -> warning, nothing pasted
    await app.evaluate(async ({ clipboard }) => { await clipboard.clear(); });
    await keys(VK.CTRL, VK.ALT, VK.P);
    await sleep(900);
    await gdi('empty-clipboard-toast');
    let t2 = await tool('gettext', notepad.pid);
    if (t2.code !== 0) t2 = await tool('gettext', 0, 'Notepad');
    check('empty clipboard pastes nothing', t2.out === t.out, JSON.stringify(t2.out));
  });
  try { if (notepad) process.kill(notepad.pid); } catch { /* gone */ }

  await step('change hotkey with the recorder', async () => {
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().find(x => x.webContents.getURL().endsWith('index.html')); w.show(); w.focus(); });
    await win.click('.nav-item[data-page="settings"]'); await sleep(600);
    await win.click('.settings-group .hotkey[data-hotkey="superPaste"]');
    await sleep(300);
    await win.keyboard.press('Control+Alt+KeyV');
    await sleep(800);
    const st = await state(win);
    check('recorder saves Ctrl+Alt+V', st.hotkeys.superPaste === 'Control+Alt+V', st.hotkeys.superPaste);
    await gdi('hotkey-recorded');
    await setState(win, { superPaste: { count: 2, separator: 'none' } });
    await app.evaluate(async ({ clipboard }) => { await clipboard.writeText('yo'); });
    await win.click('.nav-item[data-page="paste"]'); await sleep(500);
    await win.fill('#tryArea', '');
    const c = await elCenterOnScreen(app, win, '#tryArea', 'index.html');
    await tool('click', c.x, c.y); await sleep(300);
    await keys(VK.CTRL, VK.ALT, VK.V);
    await sleep(2500);
    check('new hotkey works', (await win.inputValue('#tryArea')) === 'yoyo', await win.inputValue('#tryArea'));
    const res = await win.evaluate(() => window.waddle.invoke('hotkey:set', 'superPaste', 'Control+Alt+P'));
    check('hotkey restored to Ctrl+Alt+P', res.ok, JSON.stringify(res));
  });

  await step('start with Windows toggle', async () => {
    const q = () => new Promise(r => execFile('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'], { encoding: 'utf8' }, (e, o) => r(o || '')));
    await setState(win, { startup: true }); await sleep(800);
    const on = await q();
    log('Run key (on):', on);
    check('turning on adds a Run entry with --hidden', /WaddleSnap\.exe/i.test(on) && /--hidden/.test(on), on.split('\n').filter(l => /waddle/i.test(l)).join(' | '));
    await setState(win, { startup: false }); await sleep(800);
    const off = await q();
    check('turning off removes it', !/WaddleSnap\.exe/i.test(off));
  });

  await step('close button keeps it running in the tray', async () => {
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().find(x => x.webContents.getURL().endsWith('index.html')); w.show(); });
    await sleep(400);
    await win.evaluate(() => window.waddle.invoke('win:close'));
    await sleep(800);
    const alive = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(w => w.webContents.getURL().split('/').pop() + ':' + w.isVisible()));
    check('app still running with window hidden', alive.some(x => x === 'index.html:false'), alive.join(','));
    const ov = await waitOverlay(app, () => keys(VK.CTRL, VK.ALT, VK.S));
    check('hotkeys still work from the tray', true);
    await keys(VK.ESC);
    await sleep(800);
    const wins = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(w => w.webContents.getURL().split('/').pop()));
    check('Esc closes the frame', !wins.includes('overlay.html'), wins.join(','));
  });

  await app.close().catch(() => {});
  await sleep(2000);

  // ── second pass: emulate 150 % display scaling
  await step('150% scaling pass', async () => {
    ({ app, win } = await launch(['--force-device-scale-factor=1.5']));
    await sleep(1200);
    await gdi('dpi150-main');
    await presetSnapTest(app, win, 'dpi150');
    await freeSnapTest(app, win, 'dpi150', 'CI Free 150');
    await app.close().catch(() => {});
  }, 240000);

  const failed = results.filter(r => !r.ok);
  const md = ['# WaddleSnap Windows E2E', '', `${results.length - failed.length}/${results.length} checks passed`, '',
    ...results.map(r => `- ${r.ok ? '✅' : '❌'} ${r.name}${r.ok ? '' : `\n  - ${r.detail.replace(/\n/g, '\n    ')}`}`)].join('\n');
  fs.writeFileSync(path.join(OUT, 'results.md'), md);
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(OUT, 'e2e-log.txt'), logLines.join('\n'));
  log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => {
  console.error('FATAL', e);
  fs.writeFileSync(path.join(OUT, 'e2e-log.txt'), logLines.join('\n') + '\nFATAL ' + (e && e.stack));
  process.exit(2);
});
