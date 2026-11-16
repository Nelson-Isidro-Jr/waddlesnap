/* Capture overlay: frozen screenshot + a frame you position (fixed size) or draw (free). */
(() => {
  const api = window.waddle;
  const $ = (s) => document.querySelector(s);
  const sel = $('#sel'), label = $('#label'), toolbar = $('#toolbar'), hint = $('#hint');
  const VW = () => window.innerWidth, VH = () => window.innerHeight;
  const ICON = {
    snap: '<svg viewBox="0 0 24 24"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.3-1.8A1.5 1.5 0 0 1 10.6 3.6h2.8a1.5 1.5 0 0 1 1.2.6L15.9 6h1.6A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.4"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    save: '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
  };

  let cfg = null;           // init payload
  let mode = 'preset';      // preset | free | define
  let rect = null;          // {x,y,w,h} in screen DIP
  let preset = null;
  let drag = null;
  let done = false;
  let naming = false;
  let atLastSpot = false;   // frame opened at the previous snap's position and hasn't been moved yet
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const px = (dip) => Math.round(dip * cfg.scale);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function presetSize(p) {
    const w = Math.min(p.w / cfg.scale, VW());
    const h = Math.min(p.h / cfg.scale, VH());
    return { w, h, trimmed: p.w > cfg.imgW || p.h > cfg.imgH };
  }

  function clampRect(r) {
    r.w = clamp(r.w, 1, VW()); r.h = clamp(r.h, 1, VH());
    r.x = clamp(r.x, 0, VW() - r.w); r.y = clamp(r.y, 0, VH() - r.h);
    // align to whole image pixels so what you see is exactly what you get
    const s = cfg.scale;
    r.x = Math.round(r.x * s) / s; r.y = Math.round(r.y * s) / s;
    return r;
  }

  /* ───────── drawing ───────── */
  function paint() {
    if (!rect) {
      sel.classList.add('none');
      Object.assign(sel.style, { left: '-10px', top: '-10px', width: '0px', height: '0px' });
      label.classList.add('hide'); toolbar.classList.add('hide');
      document.body.classList.remove('has-sel');
      return;
    }
    sel.classList.remove('none');
    document.body.classList.add('has-sel');
    Object.assign(sel.style, { left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px' });
    const W = mode === 'preset' && preset ? Math.min(preset.w, cfg.imgW) : px(rect.w);
    const H = mode === 'preset' && preset ? Math.min(preset.h, cfg.imgH) : px(rect.h);
    $('#labelDims').textContent = `${W} × ${H}`;
    $('#labelName').textContent = mode === 'preset' && preset ? preset.name + (atLastSpot ? ' · last spot' : '') : (mode === 'define' ? 'new size' : 'free size');
    label.classList.remove('hide');
    placeFloaters();
    if (!drag || drag.kind !== 'draw') toolbar.classList.remove('hide');
    // keep the hint out of the way
    const hr = { top: 14, bottom: 70, left: VW() / 2 - 330, right: VW() / 2 + 330 };
    const overlapTop = rect.y < hr.bottom && rect.y + rect.h > hr.top && rect.x < hr.right && rect.x + rect.w > hr.left;
    const canGoLow = rect.y + rect.h < VH() - 90;
    hint.classList.toggle('low', overlapTop && canGoLow);
    if (overlapTop && !canGoLow) hint.classList.add('faint'); // frame needs the whole height: get out of the way
  }

  function placeFloaters() {
    const lw = label.offsetWidth, lh = label.offsetHeight;
    let lx = clamp(rect.x, 8, VW() - lw - 8);
    let ly = rect.y - lh - 10;
    if (ly < 8) ly = rect.y + 10, lx = clamp(rect.x + 10, 8, VW() - lw - 8);
    if (ly + lh > VH() - 8) ly = VH() - lh - 8;
    label.style.left = lx + 'px'; label.style.top = ly + 'px';

    const tw = toolbar.offsetWidth, th = toolbar.offsetHeight;
    let tx = clamp(rect.x + rect.w / 2 - tw / 2, 8, VW() - tw - 8);
    let ty = rect.y + rect.h + 14;
    if (ty + th > VH() - 8) {
      ty = rect.y - th - 14 - (ly < rect.y ? lh + 8 : 0);
      if (ty < 8) ty = rect.y + rect.h - th - 14;
    }
    toolbar.style.left = tx + 'px'; toolbar.style.top = ty + 'px';
  }

  function buildToolbar() {
    if (mode === 'preset') {
      const chips = cfg.presets.slice(0, 9).map((p, i) => {
        const big = p.w > cfg.imgW || p.h > cfg.imgH;
        return `<button class="tb-chip ${preset && p.id === preset.id ? 'on' : ''} ${big ? 'big' : ''}" data-i="${i}" title="${esc(p.name)}"><span class="n">${i + 1}</span>${esc(p.name)} <small>${p.w}×${p.h}</small></button>`;
      }).join('');
      toolbar.innerHTML = `<div class="tb-chips">${chips}</div><span class="tb-sep"></span>
        <button class="tb-btn go" data-act="snap">${ICON.snap} Snap <kbd>Enter</kbd></button>
        <button class="tb-btn x" data-act="cancel" title="Cancel (Esc)">${ICON.x}</button>`;
    } else if (mode === 'free') {
      toolbar.innerHTML = naming
        ? `<input class="tb-name" id="tbName" maxlength="32" placeholder="Name this size">
           <button class="tb-btn go" data-act="savesnap">${ICON.check} Save &amp; snap</button>
           <button class="tb-btn x" data-act="unname" title="Back">${ICON.x}</button>`
        : `<button class="tb-btn soft" data-act="name" title="Keep this size for next time">${ICON.save} Save size</button>
           <button class="tb-btn go" data-act="snap">${ICON.snap} Snap <kbd>Enter</kbd></button>
           <button class="tb-btn x" data-act="cancel" title="Cancel (Esc)">${ICON.x}</button>`;
    } else {
      toolbar.innerHTML = `<button class="tb-btn go" data-act="define">${ICON.check} Use this size <kbd>Enter</kbd></button>
        <button class="tb-btn x" data-act="cancel" title="Cancel (Esc)">${ICON.x}</button>`;
    }
    if (naming) setTimeout(() => { const n = $('#tbName'); if (n) { n.focus(); n.addEventListener('keydown', nameKeys); } }, 30);
    const strip = toolbar.querySelector('.tb-chips');
    if (strip) {
      strip.classList.toggle('overflow', strip.scrollWidth > strip.clientWidth + 1);
      const on = strip.querySelector('.tb-chip.on');
      if (on) {
        const l = on.offsetLeft - strip.offsetLeft, r = l + on.offsetWidth;
        if (l < strip.scrollLeft + 16) strip.scrollLeft = Math.max(0, l - 24);
        else if (r > strip.scrollLeft + strip.clientWidth - 16) strip.scrollLeft = r - strip.clientWidth + 24;
      }
    }
    if (rect) placeFloaters();
  }

  function setHint() {
    const k = (t) => `<kbd>${t}</kbd>`, d = '<span class="dot">•</span>';
    $('#hintText').innerHTML = mode === 'preset'
      ? `Drag to move${d}${k('Arrow keys')} nudge${d}${k('1')}–${k('9')} size${d}${k('Enter')} snap${d}${k('Esc')} cancel`
      : `Drag to draw${d}handles resize${d}${k('Enter')} ${mode === 'define' ? 'use size' : 'snap'}${d}${k('Esc')} cancel`;
  }

  function choosePreset(i, animate = true) {
    const p = cfg.presets[i];
    if (!p) return;
    preset = p;
    const s = presetSize(p);
    let x, y;
    if (rect) { x = rect.x; y = rect.y; }                                // switching size: top-left corner stays put
    else if (cfg.anchor) { x = cfg.anchor.x; y = cfg.anchor.y; }       // open exactly where the last snap was taken
    else { x = cfg.cursor.x - s.w / 2; y = cfg.cursor.y - s.h / 2; }   // no previous snap: centre on the mouse
    rect = clampRect({ x, y, w: s.w, h: s.h });
    if (animate) { sel.classList.add('morph'); setTimeout(() => sel.classList.remove('morph'), 340); label.classList.remove('pop'); void label.offsetWidth; label.classList.add('pop'); }
    buildToolbar();
    paint();
    if (animate && cfg.sounds) Sounds.play('tick');
  }

  /* ───────── actions ───────── */
  function finish(payload) {
    if (done) return;
    done = true;
    if (payload.action === 'cancel') { api.send('overlay:done', payload); return; }
    document.body.classList.add('snapping');
    if (cfg.sounds) Sounds.play(payload.action === 'define' ? 'pop' : 'shutter');
    setTimeout(() => api.send('overlay:done', payload), 300);
  }
  const doSnap = (extra = {}) => rect && finish({ action: mode === 'define' ? 'define' : 'snap', rect: { ...rect }, presetId: mode === 'preset' && preset ? preset.id : null, ...extra });
  const cancel = () => finish({ action: 'cancel' });

  function nameKeys(e) {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); saveAndSnap(); }
    if (e.key === 'Escape') { e.preventDefault(); naming = false; buildToolbar(); }
  }
  function saveAndSnap() {
    const n = $('#tbName');
    const name = (n && n.value.trim()) || `${px(rect.w)}×${px(rect.h)}`;
    doSnap({ savePresetName: name });
  }

  toolbar.addEventListener('mousedown', (e) => e.stopPropagation());
  toolbar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.i) return choosePreset(Number(b.dataset.i));
    const a = b.dataset.act;
    if (a === 'snap' || a === 'define') doSnap();
    if (a === 'cancel') cancel();
    if (a === 'name') { naming = true; buildToolbar(); }
    if (a === 'unname') { naming = false; buildToolbar(); }
    if (a === 'savesnap') saveAndSnap();
  });

  /* counters read by the automated tests */
  const dbg = window.__dbg = { down: 0, move: 0, up: 0, keys: 0 };

  /* ───────── mouse ───────── */
  const inside = (x, y) => rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;

  window.addEventListener('mousedown', (e) => {
    dbg.down++;
    if (done || !cfg) return;
    if (e.button === 2) { cancel(); return; }
    if (e.button !== 0) return;
    if (naming) { naming = false; buildToolbar(); }
    const x = e.clientX, y = e.clientY;
    const handle = e.target.closest('.h');
    if (mode !== 'preset' && handle && rect) {
      drag = { kind: 'resize', h: handle.dataset.h, start: { ...rect } };
    } else if (inside(x, y)) {
      drag = { kind: 'move', dx: x - rect.x, dy: y - rect.y };
    } else if (mode === 'preset') {
      atLastSpot = false;
      rect = clampRect({ ...rect, x: x - rect.w / 2, y: y - rect.h / 2 });
      drag = { kind: 'move', dx: x - rect.x, dy: y - rect.y };
      paint();
    } else {
      drag = { kind: 'draw', ox: x, oy: y };
      rect = null; paint();
    }
    sel.classList.add('drag');
  });

  window.addEventListener('mousemove', (e) => {
    dbg.move++;
    if (!cfg || done) return;
    const x = e.clientX, y = e.clientY;
    $('#guideX').style.top = y + 'px';
    $('#guideY').style.left = x + 'px';
    if (!drag) return;
    if (drag.kind === 'move') {
      atLastSpot = false;
      rect = clampRect({ ...rect, x: x - drag.dx, y: y - drag.dy });
    } else if (drag.kind === 'draw') {
      const x0 = clamp(Math.min(drag.ox, x), 0, VW()), y0 = clamp(Math.min(drag.oy, y), 0, VH());
      const x1 = clamp(Math.max(drag.ox, x), 0, VW()), y1 = clamp(Math.max(drag.oy, y), 0, VH());
      if (x1 - x0 < 2 && y1 - y0 < 2) return;
      rect = { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
      document.body.classList.add('drawing');
      toolbar.classList.add('hide');
    } else if (drag.kind === 'resize') {
      const s = drag.start; let { x: L, y: T } = s; let R = s.x + s.w, B = s.y + s.h;
      if (drag.h.includes('w')) L = clamp(x, 0, R - 4);
      if (drag.h.includes('e')) R = clamp(x, L + 4, VW());
      if (drag.h.includes('n')) T = clamp(y, 0, B - 4);
      if (drag.h.includes('s')) B = clamp(y, T + 4, VH());
      rect = { x: L, y: T, w: R - L, h: B - T };
    }
    paint();
  });

  window.addEventListener('mouseup', () => {
    dbg.up++;
    if (!drag) return;
    const wasDraw = drag.kind === 'draw';
    drag = null;
    sel.classList.remove('drag');
    document.body.classList.remove('drawing');
    if (wasDraw && (!rect || rect.w < 4 || rect.h < 4)) { rect = null; }
    if (rect) { rect = clampRect(rect); buildToolbar(); }
    paint();
  });

  window.addEventListener('dblclick', (e) => { if (inside(e.clientX, e.clientY) && !e.target.closest('#toolbar')) doSnap(); });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('wheel', (e) => {
    if (mode !== 'preset' || done) return;
    const i = cfg.presets.indexOf(preset);
    const n = (i + (e.deltaY > 0 ? 1 : -1) + cfg.presets.length) % cfg.presets.length;
    choosePreset(n);
  }, { passive: true });

  /* ───────── keyboard ───────── */
  window.addEventListener('keydown', (e) => {
    dbg.keys++;
    if (!cfg || done) return;
    if (e.key === 'Escape') { e.preventDefault(); return cancel(); }
    if (e.key === 'Enter' || (e.key === ' ' && !naming)) { e.preventDefault(); return doSnap(); }
    if (mode === 'preset' && /^[1-9]$/.test(e.key)) { e.preventDefault(); return choosePreset(Number(e.key) - 1); }
    if (mode === 'preset' && e.key === 'Tab') {
      e.preventDefault();
      const i = cfg.presets.indexOf(preset);
      return choosePreset((i + (e.shiftKey ? -1 : 1) + cfg.presets.length) % cfg.presets.length);
    }
    const step = (e.shiftKey ? 10 : 1) / cfg.scale;
    const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (mv && rect) {
      e.preventDefault();
      if (mode !== 'preset' && e.altKey) { rect.w = Math.max(4 / cfg.scale, rect.w + mv[0]); rect.h = Math.max(4 / cfg.scale, rect.h + mv[1]); }
      else { rect.x += mv[0]; rect.y += mv[1]; atLastSpot = false; }
      rect = clampRect(rect);
      paint();
    }
  });

  /* ───────── init ───────── */
  api.on('overlay:init', async (data) => {
    cfg = data;
    mode = data.mode;
    document.body.dataset.scale = String(data.scale); // read by the automated tests
    document.body.classList.toggle('free', mode !== 'preset');
    $('#labelPeng').innerHTML = Penguin.svg({ mood: mode === 'preset' ? 'idle' : 'wink' });
    $('#hintPeng').innerHTML = Penguin.svg({ mood: 'happy' });
    setHint();
    const bg = $('#bg');
    bg.src = data.image;
    try { await bg.decode(); } catch { /* still show */ }
    if (mode === 'preset') {
      const idx = Math.max(0, data.presets.findIndex(p => p.id === data.activeId));
      atLastSpot = !!data.anchor;
      choosePreset(idx, false);
    } else {
      rect = null; buildToolbar(); paint();
      $('#guideX').style.top = data.cursor.y + 'px';
      $('#guideY').style.left = data.cursor.x + 'px';
    }
    requestAnimationFrame(() => {
      document.body.classList.add('in');
      api.send('overlay:ready');
      window.focus();
    });
    setTimeout(() => hint.classList.add('faint'), 6000);
  });
})();
