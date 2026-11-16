/* Corner pop-up after snaps and pastes */
(() => {
  const api = window.waddle;
  const t = document.getElementById('toast');
  let file = null;
  const heart = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.2-9.3C1.7 8.5 3.8 5.5 7 5.5c2 0 3.6 1.2 5 3 1.4-1.8 3-3 5-3 3.2 0 5.3 3 4.2 6.2C19.5 16.4 12 21 12 21z"/></svg>';
  function burst() {
    const box = document.getElementById('hearts');
    box.innerHTML = '';
    for (let i = 0; i < 7; i++) {
      const h = document.createElement('span');
      h.className = 'heart';
      h.innerHTML = heart;
      h.style.left = (40 + Math.random() * 260) + 'px';
      h.style.top = (40 + Math.random() * 30) + 'px';
      h.style.setProperty('--dx', (Math.random() * 40 - 20) + 'px');
      h.style.setProperty('--r', (Math.random() * 60 - 30) + 'deg');
      h.style.animationDelay = (i * 70) + 'ms';
      h.style.color = ['#FF5E9C', '#FF8DBB', '#C7B3FF', '#FFB36B'][i % 4];
      box.appendChild(h);
    }
  }
  api.on('toast:show', (p) => {
    file = p.file || null;
    const mood = p.kind === 'warn' ? 'wink' : 'happy';
    const prop = p.kind === 'paste' ? 'clipboard' : p.kind === 'snap' ? null : null;
    document.getElementById('peng').innerHTML = Penguin.svg({ mood, prop, cls: p.kind === 'warn' ? 'wiggle' : 'jump' });
    document.getElementById('title').textContent = p.title || '';
    document.getElementById('text').textContent = p.text || '';
    const th = document.getElementById('thumb');
    th.hidden = !p.thumb; if (p.thumb) th.src = p.thumb;
    const c = document.getElementById('count');
    c.hidden = p.kind !== 'paste'; c.textContent = '×' + (p.count || '');
    t.classList.toggle('warn', p.kind === 'warn');
    t.classList.remove('show', 'hide'); void t.offsetWidth; t.classList.add('show');
    if (p.kind === 'paste' || p.kind === 'snap') burst();
  });
  api.on('toast:hide', () => { t.classList.remove('show'); t.classList.add('hide'); });
  api.on('toast:sound', (s) => { if (s.on) Sounds.play({ snap: 'snap', paste: 'paste', warn: 'warn', info: 'info' }[s.kind] || 'pop'); });
  t.addEventListener('click', () => api.send('toast:click', file));
})();
