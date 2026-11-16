// Tiny JSON settings store kept in the user's AppData folder.
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const uid = () => Math.random().toString(36).slice(2, 10);

function defaults() {
  const presets = [
    { id: uid(), name: 'HD Wide', w: 1280, h: 720 },
    { id: uid(), name: 'Square', w: 800, h: 800 },
    { id: uid(), name: 'Classic', w: 640, h: 480 },
    { id: uid(), name: 'Story', w: 540, h: 960 },
  ];
  return {
    presets,
    activePresetId: presets[0].id,
    hotkeys: {
      snap: 'Control+Alt+S',
      free: 'Control+Alt+F',
      superPaste: 'Control+Alt+P',
    },
    superPaste: { enabled: true, count: 3, delay: 60, separator: 'none' },
    capture: { copy: true, save: true, folder: path.join(app.getPath('pictures'), 'WaddleSnap') },
    ui: { toasts: true, sounds: true },
    startup: false,
    closeToTray: true,
    seenTrayTip: false,
    recent: [],
  };
}

class Store {
  constructor() {
    this.file = path.join(app.getPath('userData'), 'settings.json');
    this.data = defaults();
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.data = merge(this.data, saved);
      if (!Array.isArray(this.data.presets) || this.data.presets.length === 0) this.data.presets = defaults().presets;
      if (!this.data.presets.find(p => p.id === this.data.activePresetId)) this.data.activePresetId = this.data.presets[0].id;
    } catch { /* first run */ }
  }
  get() { return this.data; }
  set(patch) {
    this.data = merge(this.data, patch);
    this.save();
    return this.data;
  }
  save() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
      fs.renameSync(tmp, this.file);
    } catch (e) { console.error('save failed', e); }
  }
}

// Objects merge deeply; arrays and primitives replace.
function merge(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch === undefined ? base : patch;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = (v && typeof v === 'object' && !Array.isArray(v) && base && typeof base[k] === 'object' && !Array.isArray(base[k]))
      ? merge(base[k], v) : v;
  }
  return out;
}

module.exports = { Store, uid };
