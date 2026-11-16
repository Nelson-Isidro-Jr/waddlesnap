/* WaddleSnap main window */
(() => {
  const api = window.waddle;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ───────── icons ───────── */
  const P = {
    camera: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.3-1.8A1.5 1.5 0 0 1 10.6 3.6h2.8a1.5 1.5 0 0 1 1.2.6L15.9 6h1.6A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.4"/>',
    frame: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><rect x="8" y="8.5" width="8" height="7" rx="1.5"/>',
    clipboard: '<rect x="5" y="4.5" width="14" height="16.5" rx="3"/><path d="M9 4.5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1zM9 11h6M9 15h4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6l2 2h7.4A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    pencil: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7 14h10"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    heart: '<path d="M12 20s-7.5-4.6-9.2-9.3C1.7 7.5 3.8 4.5 7 4.5c2 0 3.6 1.2 5 3 1.4-1.8 3-3 5-3 3.2 0 5.3 3 4.2 6.2C19.5 15.4 12 20 12 20z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M7 7l10 10M17 7L7 17"/>',
  };
  const icon = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;
  const paintIcons = (root = document) => $$('i[data-icon]', root).forEach(el => { if (!el.firstChild) el.innerHTML = icon(el.dataset.icon); });

  /* ───────── helpers ───────── */
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  function ratio(w, h) {
    const g = gcd(w, h); const a = w / g, b = h / g;
    if (a <= 32 && b <= 32) return `${a}:${b}`;
    return (w / h).toFixed(2) + ':1';
  }
  function keyHTML(accel) {
    if (!accel) return '<span class="plus">Not set</span>';
    return accel.split('+').map(k => `<span class="kbd sm">${esc(prettyKey(k))}</span>`).join('<span class="plus">+</span>');
  }
  const prettyKey = (k) => ({ Control: 'Ctrl', CommandOrControl: 'Ctrl', CmdOrCtrl: 'Ctrl', Super: 'Win', Meta: 'Win' }[k] || k);
  const prettyAccel = (a) => (a ? a.split('+').map(prettyKey).join(' + ') : 'not set');

  let bubbleTimer;
  function bubble(msg) {
    const b = $('#bubble');
    b.textContent = msg;
    b.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => b.classList.remove('show'), 2000);
  }
  const sfx = (n) => { if (state && state.ui.sounds) Sounds.play(n); };
  function react(el, cls, ms = 900) {
    const p = el && el.querySelector('.peng');
    if (!p) return;
    p.classList.remove(cls); void p.getBoundingClientRect(); p.classList.add(cls);
    setTimeout(() => p.classList.remove(cls), ms);
  }
  function bumpNum(el, val) {
    if (String(el.textContent) === String(val)) return;
    el.textContent = val;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }

  /* ───────── state ───────── */
  let state = null;
  async function save(patch) { state = await api.invoke('state:set', patch); render(); return state; }

  /* ───────── navigation ───────── */
  function go(page) {
    const items = $$('.nav-item');
    const it = items.find(i => i.dataset.page === page) || items[0];
    items.forEach(i => i.classList.toggle('active', i === it));
    $('#navPill').style.transform = `translateY(${it.offsetTop}px)`;
    $$('.page').forEach(p => {
      const on = p.dataset.page === it.dataset.page;
      if (on && !p.classList.contains('active')) { p.classList.add('active'); p.scrollTop = 0; }
      if (!on) p.classList.remove('active');
    });
    const map = { snap: '#heroArt', paste: '#pastePeng' };
    if (map[page]) setTimeout(() => react($(map[page]), 'wave', 1600), 250);
  }
  $$('.nav-item').forEach(b => b.addEventListener('click', () => { go(b.dataset.page); sfx('tick'); }));
  $$('[data-goto]').forEach(b => b.addEventListener('click', () => go(b.dataset.goto)));

  /* ───────── window buttons ───────── */
  $$('[data-win]').forEach(b => b.addEventListener('click', () => api.invoke('win:' + b.dataset.win)));

  /* ───────── render ───────── */
  function render() {
    if (!state) return;
    const s = state;
    const active = s.presets.find(p => p.id === s.activePresetId) || s.presets[0];

    // side card
    const fails = s.hotkeyFailures || [];
    $('.live-dot').classList.toggle('off', fails.length > 0);
    $('#liveText').textContent = fails.length ? 'Some hotkeys are busy' : 'Hotkeys are on';
    $('#sideSnapKey').textContent = prettyAccel(s.hotkeys.snap);
    $('#sideFreeKey').textContent = prettyAccel(s.hotkeys.free);
    $('#sidePasteKey').textContent = s.superPaste.enabled ? prettyAccel(s.hotkeys.superPaste) : 'off';
    $('#sideCount').textContent = s.superPaste.count;

    // hero
    $('#snapNowName').textContent = active ? active.name : 'size';
    $('#snapNowDims').textContent = active ? `${active.w} × ${active.h} px` : '';
    $('#heroSnapKey').textContent = prettyAccel(s.hotkeys.snap);

    renderChips(active);
    renderMiniPaste();
    renderRecent();
    renderSizes();
    renderPaste();
    renderSettings();
  }

  function ratioBox(w, h, max = 26) {
    const k = max / Math.max(w, h);
    return `<i style="width:${Math.max(6, Math.round(w * k))}px;height:${Math.max(6, Math.round(h * k))}px"></i>`;
  }

  function renderChips(active) {
    const box = $('#presetChips');
    box.innerHTML = state.presets.map((p, i) => `
      <button class="chip ${p.id === (active && active.id) ? 'on' : ''}" data-id="${p.id}" title="Use ${esc(p.name)} for the Snap hotkey">
        <span class="ratio">${ratioBox(p.w, p.h)}</span>
        <span class="chip-text">${esc(p.name)}<small>${p.w} × ${p.h}</small></span>
      </button>`).join('') +
      `<button class="chip add" id="chipAdd"><span class="ratio">${icon('plus')}</span><span class="chip-text">New size</span></button>`;
    $$('.chip[data-id]', box).forEach(c => c.addEventListener('click', () => {
      if (c.classList.contains('on')) return;
      sfx('tick');
      save({ activePresetId: c.dataset.id });
      react($('#heroArt'), 'bow-boing', 800);
    }));
    $('#chipAdd').addEventListener('click', () => openSizeModal());
  }

  function renderMiniPaste() {
    const sp = state.superPaste;
    bumpNum($('#miniCount'), sp.count);
    $('#miniCountText').textContent = sp.count;
    $('#miniPasteToggle').checked = sp.enabled;
    $('.mini-paste').classList.toggle('off', !sp.enabled);
    $('#miniPasteKey').textContent = prettyAccel(state.hotkeys.superPaste);
  }

  let lastRecentTop = null;
  function renderRecent() {
    const grid = $('#recentGrid');
    const list = state.recent || [];
    if (!list.length) {
      grid.innerHTML = `<div class="empty">${Penguin.svg({ mood: 'wink' })}<div><b>No snaps yet</b>Press <span class="kbd sm">${esc(prettyAccel(state.hotkeys.snap))}</span> anywhere and I'll catch it!</div></div>`;
      lastRecentTop = null;
      return;
    }
    const isNew = lastRecentTop !== null && list[0].id !== lastRecentTop;
    lastRecentTop = list[0].id;
    grid.innerHTML = list.slice(0, 8).map((r, i) => `
      <div class="shot ${isNew && i === 0 ? 'new' : ''}" data-id="${r.id}" title="${esc(r.name)} · ${r.w}×${r.h}">
        <img src="${r.thumb}" alt="">
        <span class="tag">${r.w}×${r.h}</span>
        <div class="acts">
          <button data-act="copy" title="Copy again">${icon('copy')}</button>
          ${r.file ? `<button data-act="show" title="Show in folder">${icon('folder')}</button>` : ''}
        </div>
      </div>`).join('');
    $$('.shot', grid).forEach(el => {
      el.addEventListener('click', async (e) => {
        const act = e.target.closest('button') && e.target.closest('button').dataset.act;
        const id = el.dataset.id;
        const r = state.recent.find(x => x.id === id);
        if (act === 'show' && r) api.invoke('file:show', r.file);
        else { await api.invoke('recent:copy', id); sfx('pop'); bubble('Copied to clipboard ✿'); }
      });
    });
  }

  /* ───────── sizes page ───────── */
  function renderSizes() {
    const grid = $('#sizeGrid');
    const sw = Math.round(window.screen.width * window.devicePixelRatio);
    const sh = Math.round(window.screen.height * window.devicePixelRatio);
    const anim = !$('.page[data-page="sizes"]').classList.contains('active') ? 'stagger' : '';
    grid.innerHTML = state.presets.map((p, i) => {
      const k = Math.min(150 / p.w, 92 / p.h);
      const on = p.id === state.activePresetId;
      const big = p.w > sw || p.h > sh;
      return `<div class="card size-card ${anim} ${on ? 'is-active' : ''}" style="--i:${i + 1}" data-id="${p.id}">
        <div class="pv">${i < 9 ? `<span class="key" title="Press ${i + 1} while snapping">${i + 1}</span>` : ''}
          ${on ? `<span class="badge">${icon('star')} Hotkey size</span>` : ''}
          <i style="width:${Math.max(10, Math.round(p.w * k))}px;height:${Math.max(10, Math.round(p.h * k))}px"></i></div>
        <div class="meta"><div style="min-width:0"><h3>${esc(p.name)}</h3><span class="ar">${ratio(p.w, p.h)}${big ? ' · too big here' : ''}${p.pos ? ' · 📍 saved spot' : ''}</span></div><span class="dim">${p.w}×${p.h}</span></div>
        <div class="row">
          <button class="btn primary sm" data-act="snap">${icon('camera')}<span>Snap</span></button>
          <button class="icon-btn ${on ? 'starred' : ''}" data-act="star" title="Use for the Snap hotkey">${icon('star')}</button>
          <button class="icon-btn" data-act="edit" title="Edit">${icon('pencil')}</button>
          <button class="icon-btn" data-act="del" title="Delete">${icon('trash')}</button>
        </div>
      </div>`;
    }).join('') + `<div class="card size-card add ${anim}" style="--i:${state.presets.length + 1}" id="addCard">
        <div class="plus">${icon('plus')}</div><div>Add a size<br><span>type it in or draw it on screen</span></div></div>`;

    $$('.size-card[data-id]', grid).forEach(card => {
      card.addEventListener('click', async (e) => {
        const b = e.target.closest('button'); if (!b) return;
        const id = card.dataset.id;
        const p = state.presets.find(x => x.id === id);
        if (b.dataset.act === 'snap') { b.classList.add('flash'); sfx('tick'); setTimeout(() => api.invoke('snap:start', 'preset', id), 120); }
        if (b.dataset.act === 'star') { sfx('pop'); await save({ activePresetId: id }); bubble(`${p.name} is now your hotkey size`); }
        if (b.dataset.act === 'edit') openSizeModal(p);
        if (b.dataset.act === 'del') {
          if (state.presets.length <= 1) { bubble('Keep at least one size 🐧'); sfx('warn'); return; }
          card.classList.add('leaving');
          sfx('tick');
          setTimeout(() => {
            const presets = state.presets.filter(x => x.id !== id);
            const patch = { presets };
            if (state.activePresetId === id) patch.activePresetId = presets[0].id;
            save(patch);
            bubble(`Removed “${p.name}”`);
          }, 300);
        }
      });
    });
    $('#addCard').addEventListener('click', () => openSizeModal());
  }
  $('#addSize').addEventListener('click', () => openSizeModal());

  /* size modal */
  const QUICK = [[1920, 1080], [1280, 720], [1080, 1080], [1080, 1350], [1080, 1920], [800, 600], [512, 512], [400, 300]];
  let editing = null;
  let pendingPos = null; // spot of a size drawn on screen, saved with it
  function openSizeModal(preset = null, prefill = null) {
    editing = preset;
    pendingPos = (!preset && prefill && prefill.pos) || null;
    const m = $('#sizeModal');
    $('#sizeModalTitle').textContent = preset ? 'Edit size' : 'New size';
    $('#fName').value = preset ? preset.name : (prefill ? 'My size' : '');
    $('#fW').value = preset ? preset.w : (prefill ? prefill.w : 1280);
    $('#fH').value = preset ? preset.h : (prefill ? prefill.h : 720);
    $('#quickSizes').innerHTML = QUICK.map(([w, h]) => `<button data-w="${w}" data-h="${h}">${w}×${h}</button>`).join('');
    $$('#quickSizes button').forEach(b => b.addEventListener('click', () => { $('#fW').value = b.dataset.w; $('#fH').value = b.dataset.h; updatePreview(); sfx('tick'); }));
    m.hidden = false; m.classList.remove('closing');
    updatePreview();
    setTimeout(() => $('#fName').focus(), 60);
  }
  function closeSizeModal() {
    const m = $('#sizeModal');
    m.classList.add('closing');
    setTimeout(() => { m.hidden = true; m.classList.remove('closing'); }, 200);
  }
  function readSize() {
    const w = Math.round(Number($('#fW').value)); const h = Math.round(Number($('#fH').value));
    return { w, h, ok: w >= 8 && h >= 8 && w <= 16384 && h <= 16384 };
  }
  function updatePreview() {
    const { w, h, ok } = readSize();
    const r = $('#pvRect');
    if (!ok) { r.style.width = '40px'; r.style.height = '40px'; $('#pvLabel').textContent = '?'; }
    else {
      const k = Math.min(190 / w, 170 / h);
      r.style.width = Math.max(14, Math.round(w * k)) + 'px';
      r.style.height = Math.max(14, Math.round(h * k)) + 'px';
      $('#pvLabel').textContent = `${w} × ${h}`;
    }
    const sw = Math.round(window.screen.width * window.devicePixelRatio);
    const sh = Math.round(window.screen.height * window.devicePixelRatio);
    const warn = $('#fWarn');
    if (!ok) { warn.hidden = false; warn.textContent = 'Width and height should be between 8 and 16384 pixels.'; }
    else if (w > sw || h > sh) { warn.hidden = false; warn.textContent = `Heads up: that's bigger than this screen (${sw}×${sh}), so it'll be trimmed to fit.`; }
    else warn.hidden = true;
  }
  ['#fW', '#fH'].forEach(s => $(s).addEventListener('input', updatePreview));
  $$('#sizeModal [data-close]').forEach(b => b.addEventListener('click', closeSizeModal));
  $('#sizeModal').addEventListener('mousedown', (e) => { if (e.target.id === 'sizeModal') closeSizeModal(); });
  $('#sizeModal').addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSizeModal(); if (e.key === 'Enter') $('#saveSize').click(); });
  $('#saveSize').addEventListener('click', async () => {
    const { w, h, ok } = readSize();
    if (!ok) { sfx('warn'); $('#fWarn').hidden = false; return; }
    const name = ($('#fName').value.trim() || `${w}×${h}`).slice(0, 32);
    let presets;
    if (editing) presets = state.presets.map(p => (p.id === editing.id ? { ...p, name, w, h } : p));
    else presets = [...state.presets, { id: Math.random().toString(36).slice(2, 10), name, w, h, ...(pendingPos ? { pos: pendingPos } : {}) }];
    closeSizeModal();
    await save({ presets });
    sfx('pop');
    bubble(editing ? 'Size updated ✿' : `Saved “${name}” · ${w}×${h}`);
  });
  $('#drawSize').addEventListener('click', () => { closeSizeModal(); setTimeout(() => api.invoke('snap:start', 'define'), 120); });
  api.on('size-defined', (size) => { go('sizes'); setTimeout(() => openSizeModal(null, size), 250); });

  /* ───────── super paste page ───────── */
  const QUICK_COUNTS = [2, 3, 5, 6, 10, 20];
  function renderPaste() {
    const sp = state.superPaste;
    bumpNum($('#bigCount'), sp.count);
    $('#pasteHeroCount').textContent = sp.count;
    $('#pasteHeroKey').textContent = prettyAccel(state.hotkeys.superPaste);
    $('#pasteToggle').checked = sp.enabled;
    $('.paste-hero').classList.toggle('off', !sp.enabled);
    $('#quickCounts').innerHTML = QUICK_COUNTS.map(n => `<button class="${n === sp.count ? 'on' : ''}" data-n="${n}">×${n}</button>`).join('');
    $$('#quickCounts button').forEach(b => b.addEventListener('click', () => setCount(Number(b.dataset.n))));
    $$('#sepSeg button').forEach(b => b.classList.toggle('on', b.dataset.sep === sp.separator));
    $('#sepHint').textContent = {
      none: 'Pastes land right next to each other.',
      enter: 'Presses Enter between pastes, great for lists and chats.',
      tab: 'Presses Tab between pastes, great for forms and spreadsheets.',
      space: 'Adds a space between pastes.',
    }[sp.separator] || '';
    const d = $('#delay');
    if (document.activeElement !== d) d.value = sp.delay;
    $('#delayVal').textContent = `${sp.delay} ms`;
    d.style.setProperty('--p', ((sp.delay - 20) / 380 * 100) + '%');
    renderStack(sp.count);
  }

  let stackCount = 0;
  function renderStack(n) {
    if (n === stackCount) return;
    const box = $('#paperStack');
    const shown = Math.min(n, 8);
    const prev = Math.min(stackCount, 8);
    stackCount = n;
    const papers = $$('.paper', box);
    papers.slice(shown).forEach(p => p.remove());
    for (let i = prev; i < shown; i++) {
      const el = document.createElement('div');
      el.className = 'paper';
      el.style.animationDelay = ((i - prev) * 45) + 'ms';
      box.appendChild(el);
    }
    $$('.paper', box).forEach((p, i) => {
      const mid = (shown - 1) / 2;
      const off = i - mid;
      p.style.setProperty('--x', `${off * 22}px`);
      p.style.setProperty('--y', `${Math.abs(off) * 5 - 4}px`);
      p.style.setProperty('--r', `${off * 6}deg`);
      p.style.zIndex = i;
      p.dataset.n = i + 1;
    });
    const more = $('.paper-more', box);
    if (n > 8) {
      const m = more || Object.assign(document.createElement('span'), { className: 'paper-more' });
      m.textContent = `+${n - 8} more`;
      if (!more) box.appendChild(m);
    } else if (more) more.remove();
  }

  function setCount(n) {
    n = Math.max(1, Math.min(50, n));
    if (n === state.superPaste.count) return;
    sfx('tick');
    save({ superPaste: { count: n } });
  }
  $('#cntMinus').addEventListener('click', () => setCount(state.superPaste.count - 1));
  $('#cntPlus').addEventListener('click', () => setCount(state.superPaste.count + 1));
  $('#miniMinus').addEventListener('click', () => setCount(state.superPaste.count - 1));
  $('#miniPlus').addEventListener('click', () => setCount(state.superPaste.count + 1));
  const togglePaste = async (on) => {
    await save({ superPaste: { enabled: on } });
    sfx(on ? 'pop' : 'tick');
    bubble(on ? 'Super Paste is on! 💗' : 'Super Paste is off');
    if (on) react($('#pastePeng'), 'jump', 800);
  };
  $('#pasteToggle').addEventListener('change', (e) => togglePaste(e.target.checked));
  $('#miniPasteToggle').addEventListener('change', (e) => togglePaste(e.target.checked));
  $$('#sepSeg button').forEach(b => b.addEventListener('click', () => { sfx('tick'); save({ superPaste: { separator: b.dataset.sep } }); }));
  let delayT;
  $('#delay').addEventListener('input', (e) => {
    const v = Number(e.target.value);
    $('#delayVal').textContent = `${v} ms`;
    e.target.style.setProperty('--p', ((v - 20) / 380 * 100) + '%');
    clearTimeout(delayT);
    delayT = setTimeout(() => save({ superPaste: { delay: v } }), 200);
  });
  $('#clearTry').addEventListener('click', () => { $('#tryArea').value = ''; $('#tryArea').focus(); });

  /* ───────── settings page ───────── */
  const getPath = (o, p) => p.split('.').reduce((a, k) => (a ? a[k] : undefined), o);
  const setPath = (p, v) => p.split('.').reduceRight((acc, k) => ({ [k]: acc }), v);
  function renderSettings() {
    $$('[data-set]').forEach(inp => { inp.checked = !!getPath(state, inp.dataset.set); });
    $('#folderPath').textContent = state.capture.folder;
    $('#folderPath').title = state.capture.folder;
    $('#version').textContent = state.version;
    $$('.hotkey').forEach(b => {
      if (b.classList.contains('rec')) return;
      const n = b.dataset.hotkey;
      b.innerHTML = keyHTML(state.hotkeys[n]);
      b.title = (state.hotkeyFailures || []).includes(n) ? 'This combo is used by another app, pick a new one' : 'Click to change';
      b.classList.toggle('err', (state.hotkeyFailures || []).includes(n));
    });
  }
  $$('[data-set]').forEach(inp => inp.addEventListener('change', () => {
    sfx(inp.checked ? 'pop' : 'tick');
    if (inp.dataset.set === 'capture.copy' && !inp.checked && !state.capture.save) bubble('Heads up: snaps won’t be kept anywhere!');
    if (inp.dataset.set === 'capture.save' && !inp.checked && !state.capture.copy) bubble('Heads up: snaps won’t be kept anywhere!');
    save(setPath(inp.dataset.set, inp.checked));
  }));
  $('#changeFolder').addEventListener('click', async () => { state = await api.invoke('folder:choose'); render(); });
  $('#openFolder2').addEventListener('click', () => api.invoke('folder:open'));
  $('#openFolder').addEventListener('click', () => api.invoke('folder:open'));
  $('#clearRecent').addEventListener('click', async () => { state = await api.invoke('recent:clear'); render(); sfx('tick'); });
  $('#quitApp').addEventListener('click', () => api.invoke('app:quit'));

  /* hotkey recorder */
  const CODE = {
    Space: 'Space', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert',
    Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', PrintScreen: 'PrintScreen',
    ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
    Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';',
    Quote: "'", Comma: ',', Period: '.', Slash: '/', Backquote: '`',
  };
  function accelFrom(e) {
    let key = null;
    let m;
    if ((m = /^Key([A-Z])$/.exec(e.code))) key = m[1];
    else if ((m = /^Digit(\d)$/.exec(e.code))) key = m[1];
    else if ((m = /^Numpad(\d)$/.exec(e.code))) key = 'num' + m[1];
    else if (/^F\d{1,2}$/.test(e.code)) key = e.code;
    else if (CODE[e.code]) key = CODE[e.code];
    if (!key) return null;
    const mods = [];
    if (e.ctrlKey) mods.push('Control');
    if (e.altKey) mods.push('Alt');
    if (e.shiftKey) mods.push('Shift');
    if (e.metaKey) mods.push('Super');
    const solo = /^F\d+$/.test(key) || key === 'PrintScreen';
    if (!mods.length && !solo) return { error: 'Add Ctrl, Alt or Shift so normal typing still works.' };
    return { accel: [...mods, key].join('+') };
  }
  let recording = null;
  function stopRecording(btn) {
    if (!recording) return;
    window.removeEventListener('keydown', recording.handler, true);
    window.removeEventListener('mousedown', recording.cancel, true);
    recording = null;
    btn.classList.remove('rec');
    api.invoke('hotkey:pause', false);
    render();
  }
  $$('.hotkey').forEach(btn => btn.addEventListener('click', () => {
    if (recording) { stopRecording(recording.btn); return; }
    btn.classList.add('rec');
    btn.classList.remove('err');
    btn.innerHTML = 'Press your keys… <span class="plus">(Esc to cancel)</span>';
    api.invoke('hotkey:pause', true);
    const handler = async (e) => {
      e.preventDefault(); e.stopPropagation();
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Win'].filter(Boolean);
        btn.innerHTML = mods.map(k => `<span class="kbd sm">${k}</span>`).join('<span class="plus">+</span>') + '<span class="plus">+ …</span>';
        return;
      }
      if (e.key === 'Escape') { stopRecording(btn); return; }
      const r = accelFrom(e);
      if (!r) return;
      if (r.error) { bubble(r.error); sfx('warn'); return; }
      const name = btn.dataset.hotkey;
      stopRecording(btn);
      const res = await api.invoke('hotkey:set', name, r.accel);
      state = await api.invoke('state:get');
      render();
      if (res.ok) { sfx('pop'); bubble(`Hotkey set: ${prettyAccel(r.accel)}`); }
      else {
        sfx('warn'); bubble(res.error);
        $$(`.hotkey[data-hotkey="${name}"]`).forEach(b => { b.classList.remove('err'); void b.offsetWidth; b.classList.add('err'); });
      }
    };
    const cancel = (e) => { if (!btn.contains(e.target)) stopRecording(btn); };
    recording = { btn, handler, cancel };
    window.addEventListener('keydown', handler, true);
    window.addEventListener('mousedown', cancel, true);
  }));

  /* ───────── snap buttons ───────── */
  $('#snapNow').addEventListener('click', (e) => {
    e.currentTarget.classList.remove('flash'); void e.currentTarget.offsetWidth; e.currentTarget.classList.add('flash');
    sfx('tick');
    setTimeout(() => api.invoke('snap:start', 'preset'), 140);
  });
  $('#freeNow').addEventListener('click', () => { sfx('tick'); setTimeout(() => api.invoke('snap:start', 'free'), 100); });

  /* ───────── events from main ───────── */
  api.on('state', (s) => { state = s; render(); });
  api.on('navigate', (p) => go(p));
  api.on('snapped', () => setTimeout(() => react($('#heroArt'), 'jump', 800), 350));

  /* ───────── decoration ───────── */
  function sky() {
    const flake = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5"/></svg>';
    const heart = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.2-9.3C1.7 8.5 3.8 5.5 7 5.5c2 0 3.6 1.2 5 3 1.4-1.8 3-3 5-3 3.2 0 5.3 3 4.2 6.2C19.5 16.4 12 21 12 21z"/></svg>';
    const sky = $('.sky');
    for (let i = 0; i < 16; i++) {
      const f = document.createElement('span');
      f.className = 'flake';
      const size = 10 + Math.random() * 12;
      f.style.cssText = `left:${Math.random() * 100}%;width:${size}px;height:${size}px;animation-duration:${16 + Math.random() * 16}s;animation-delay:${-Math.random() * 30}s;opacity:${0.25 + Math.random() * 0.35};color:${i % 3 === 0 ? '#FFC2DA' : i % 3 === 1 ? '#E9D9FF' : '#FFB9D3'}`;
      f.innerHTML = i % 4 === 0 ? heart : flake;
      sky.appendChild(f);
    }
  }

  /* ───────── boot ───────── */
  async function boot() {
    paintIcons();
    $('#brandPeng').innerHTML = Penguin.svg();
    $('#heroPeng').innerHTML = Penguin.svg({ prop: 'camera' });
    $('#pastePeng').innerHTML = Penguin.svg({ prop: 'clipboard', mood: 'wink' });
    $('#aboutPeng').innerHTML = Penguin.svg({ mood: 'happy' });
    $('#heroPeng').classList.add('drop');
    sky();
    state = await api.invoke('state:get');
    render();
    await document.fonts.ready;
    go('snap');
    document.body.classList.remove('booting');
    document.body.classList.add('ready');
  }
  boot();
})();
