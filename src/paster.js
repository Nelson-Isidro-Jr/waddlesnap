// Super Paste engine: presses Ctrl+V N times for one hotkey press.
// Windows: bundled native helper bin/waddlepaste.exe (SendInput), PowerShell SendKeys as a backup.
// Other platforms (used for development): xdotool on Linux, osascript on macOS.
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const isWin = process.platform === 'win32';

// Executables can't run from inside app.asar, so the helper is shipped unpacked.
const HELPER = path.join(__dirname, 'bin', 'waddlepaste.exe').replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');

function run(cmd, args, timeout = 60000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, timeout }, (err) => {
      resolve(err ? (typeof err.code === 'number' ? err.code : -1) : 0);
    });
  });
}

async function pasteWindows({ count, delay, separator, hotkeyVk }) {
  if (fs.existsSync(HELPER)) {
    const code = await run(HELPER, [String(count), String(delay), separator || 'none', String(hotkeyVk || 0)]);
    if (code === 0) return 'helper';
    if (code === 2) throw new Error('Windows blocked the keypresses. Is that app running as administrator?');
  }
  // Backup: PowerShell SendKeys (slower to start, but always available).
  const sepKey = { enter: '{ENTER}', tab: '{TAB}', space: ' ' }[separator] || '';
  const script = `$w = New-Object -ComObject wscript.shell; Start-Sleep -Milliseconds 400; ` +
    `for ($i = 0; $i -lt ${count}; $i++) { $w.SendKeys('^v'); ` +
    (sepKey ? `if ($i -lt ${count - 1}) { Start-Sleep -Milliseconds 30; $w.SendKeys('${sepKey}') }; ` : '') +
    `Start-Sleep -Milliseconds ${delay} }`;
  const code = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', script]);
  if (code !== 0) throw new Error('Could not send the paste keys.');
  return 'powershell';
}

async function pasteOther({ count, delay, separator }) {
  await sleep(300);
  if (process.platform === 'darwin') {
    const lines = [];
    for (let i = 0; i < count; i++) {
      lines.push('tell application "System Events" to keystroke "v" using command down');
      if (i < count - 1) {
        if (separator === 'enter') lines.push('tell application "System Events" to key code 36');
        if (separator === 'tab') lines.push('tell application "System Events" to key code 48');
        if (separator === 'space') lines.push('tell application "System Events" to keystroke " "');
        lines.push(`delay ${delay / 1000}`);
      }
    }
    await run('osascript', lines.flatMap(l => ['-e', l]));
    return 'osascript';
  }
  const k = { enter: 'Return', tab: 'Tab', space: 'space' }[separator];
  for (let i = 0; i < count; i++) {
    await run('xdotool', ['key', '--clearmodifiers', 'ctrl+v']);
    if (i < count - 1) {
      if (k) await run('xdotool', ['key', '--clearmodifiers', k]);
      await sleep(delay);
    }
  }
  return 'xdotool';
}

let busy = false;
async function superPaste(opts) {
  if (busy) return { ok: false, error: 'busy' };
  busy = true;
  const o = {
    ...opts,
    count: Math.max(1, Math.min(100, Math.round(opts.count || 1))),
    delay: Math.max(10, Math.min(2000, Math.round(opts.delay || 60))),
  };
  try {
    const engine = isWin ? await pasteWindows(o) : await pasteOther(o);
    return { ok: true, count: o.count, engine };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  } finally {
    busy = false;
  }
}

// Windows virtual-key code of an accelerator's main key, so the helper can wait for it to be released.
function acceleratorVk(accel) {
  const parts = String(accel || '').split('+');
  const k = parts[parts.length - 1];
  if (/^[A-Z0-9]$/i.test(k)) return k.toUpperCase().charCodeAt(0);
  const f = /^F(\d{1,2})$/i.exec(k);
  if (f) return 0x6F + Number(f[1]);
  return 0;
}

module.exports = { superPaste, acceleratorVk, HELPER };
