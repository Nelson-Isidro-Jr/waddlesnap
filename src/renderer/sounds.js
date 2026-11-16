/* Cute UI sounds synthesized with WebAudio (no audio files). */
(function () {
  let ctx = null;
  const ac = () => (ctx = ctx || new (window.AudioContext || window.webkitAudioContext)());

  function tone(freq, t0, dur, { type = 'sine', vol = 0.18, to = null } = {}) {
    const c = ac(), o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime + t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, c.currentTime + t0 + dur);
    g.gain.setValueAtTime(0.0001, c.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(vol, c.currentTime + t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(c.currentTime + t0);
    o.stop(c.currentTime + t0 + dur + 0.02);
  }

  function noise(t0, dur, vol = 0.25, freq = 2400) {
    const c = ac(), len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.9;
    g.gain.value = vol;
    s.buffer = buf; s.connect(f).connect(g).connect(c.destination);
    s.start(c.currentTime + t0);
  }

  const S = {
    shutter() { noise(0, 0.06, 0.35, 3200); noise(0.07, 0.09, 0.28, 1800); tone(1400, 0.0, 0.05, { type: 'square', vol: 0.03 }); },
    pop() { tone(520, 0, 0.12, { to: 1180, vol: 0.16 }); },
    paste() { tone(660, 0, 0.09, { vol: 0.13 }); tone(880, 0.08, 0.09, { vol: 0.13 }); tone(1320, 0.16, 0.14, { vol: 0.12 }); },
    snap() { tone(784, 0, 0.1, { vol: 0.12 }); tone(1175, 0.09, 0.16, { vol: 0.12 }); },
    warn() { tone(440, 0, 0.12, { type: 'triangle', vol: 0.16 }); tone(330, 0.12, 0.18, { type: 'triangle', vol: 0.16 }); },
    tick() { tone(1500, 0, 0.035, { type: 'triangle', vol: 0.06 }); },
    info() { tone(880, 0, 0.12, { vol: 0.1 }); },
  };
  window.Sounds = { play(name) { try { (S[name] || S.pop)(); } catch { /* audio unavailable */ } } };
})();
