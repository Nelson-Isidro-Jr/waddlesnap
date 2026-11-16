/* Waddles — WaddleSnap's original penguin mascot, drawn as inline SVG.
   Penguin.svg({ mood, prop, cls }) returns markup; animation lives in penguin.css. */
(function () {
  let uid = 0;

  const C = {
    body1: '#4D4675', body2: '#2C2648', flip: '#332C52',
    face: '#FFFBFD', belly2: '#FFE6F0', eye: '#241D3B',
    beak: '#FFAE5E', beakHi: '#FFC98F', feet: '#FFA75A',
    blush: '#FF8DB6', bow: '#FF5E9C', bowHi: '#FF92BE', bowKnot: '#E8457F',
  };

  function eyes(mood) {
    if (mood === 'happy') {
      return `<g class="pg-eyes happy">
        <path d="M71 91 Q79 79 87 91" fill="none" stroke="${C.eye}" stroke-width="4.6" stroke-linecap="round"/>
        <path d="M113 91 Q121 79 129 91" fill="none" stroke="${C.eye}" stroke-width="4.6" stroke-linecap="round"/>
      </g>`;
    }
    if (mood === 'wink') {
      return `<g class="pg-eyes">
        <ellipse cx="80" cy="88" rx="9.6" ry="11.6" fill="${C.eye}"/>
        <circle cx="83.5" cy="82.5" r="3.6" fill="#fff"/><circle cx="77.5" cy="92.5" r="1.6" fill="#fff"/>
        <path d="M113 90 Q121 80 129 90" fill="none" stroke="${C.eye}" stroke-width="4.6" stroke-linecap="round"/>
      </g>`;
    }
    return `<g class="pg-eyes">
      <ellipse cx="80" cy="88" rx="9.6" ry="11.6" fill="${C.eye}"/>
      <ellipse cx="120" cy="88" rx="9.6" ry="11.6" fill="${C.eye}"/>
      <circle cx="83.5" cy="82.5" r="3.6" fill="#fff"/><circle cx="77.5" cy="92.5" r="1.6" fill="#fff"/>
      <circle cx="123.5" cy="82.5" r="3.6" fill="#fff"/><circle cx="117.5" cy="92.5" r="1.6" fill="#fff"/>
    </g>`;
  }

  function prop(kind) {
    if (kind === 'camera') {
      return `<g class="pg-prop pg-camera" transform="translate(100 160)">
        <rect x="-15" y="-31" width="24" height="13" rx="4" fill="${C.bowKnot}"/>
        <rect x="-36" y="-23" width="72" height="48" rx="13" fill="#FF7EB0"/>
        <rect x="-36" y="-23" width="72" height="16" rx="8" fill="#FF97C1" opacity=".7"/>
        <circle cx="0" cy="2" r="16.5" fill="#fff"/>
        <circle cx="0" cy="2" r="12" fill="${C.body2}"/>
        <circle cx="0" cy="2" r="7" fill="#5B5290"/>
        <circle cx="-4" cy="-2" r="3.2" fill="#BFE6FF"/>
        <circle cx="25" cy="-12" r="3.6" fill="#FFE27A" class="pg-flash"/>
      </g>`;
    }
    if (kind === 'clipboard') {
      return `<g class="pg-prop pg-clip" transform="translate(100 158)">
        <rect x="-30" y="-32" width="60" height="68" rx="10" fill="#FFCF9E"/>
        <rect x="-23" y="-22" width="46" height="50" rx="5" fill="#fff"/>
        <rect x="-15" y="-11" width="30" height="4" rx="2" fill="#FFB0CF"/>
        <rect x="-15" y="-1" width="24" height="4" rx="2" fill="#FFB0CF"/>
        <rect x="-15" y="9" width="28" height="4" rx="2" fill="#FFB0CF"/>
        <rect x="-13" y="-38" width="26" height="13" rx="5" fill="${C.bow}"/>
      </g>`;
    }
    if (kind === 'heart') {
      return `<g class="pg-prop pg-heart" transform="translate(100 162)">
        <path d="M0 18 C -26 2 -28 -16 -16 -22 C -8 -26 -2 -20 0 -14 C 2 -20 8 -26 16 -22 C 28 -16 26 2 0 18 Z" fill="${C.bow}"/>
        <path d="M-15 -14 C -12 -18 -7 -18 -5 -15" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>
      </g>`;
    }
    return '';
  }

  function svg(opts = {}) {
    const { mood = 'idle', prop: p = null, cls = '' } = opts;
    const id = 'pg' + (++uid);
    const hold = p ? ' hold' : '';
    const flippers = `<path class="pg-flip-l" d="M42 108 C 24 118 14 142 20 158 C 24 165 32 161 36 153 C 42 141 46 127 49 116 Z" fill="${C.flip}"/>
    <path class="pg-flip-r" d="M158 108 C 176 118 186 142 180 158 C 176 165 168 161 164 153 C 158 141 154 127 151 116 Z" fill="${C.flip}"/>`;
    return `<svg class="peng ${cls}${hold}" viewBox="0 0 200 222" role="img" aria-label="Waddles the penguin">
  <defs>
    <radialGradient id="${id}b" cx="38%" cy="26%" r="80%">
      <stop offset="0" stop-color="${C.body1}"/><stop offset="1" stop-color="${C.body2}"/>
    </radialGradient>
    <linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.face}"/><stop offset="1" stop-color="${C.belly2}"/>
    </linearGradient>
  </defs>
  <ellipse class="pg-shadow" cx="100" cy="214" rx="50" ry="6.5" fill="#E07AA6" opacity=".28"/>
  <g class="pg-bob">
    <g class="pg-feet">
      <ellipse cx="79" cy="204" rx="17" ry="9" fill="${C.feet}"/>
      <ellipse cx="121" cy="204" rx="17" ry="9" fill="${C.feet}"/>
    </g>
    ${p ? '' : flippers}
    <path d="M100 22 C 147 22 171 62 171 113 C 171 171 140 203 100 203 C 60 203 29 171 29 113 C 29 62 53 22 100 22 Z" fill="url(#${id}b)"/>
    <path d="M97 23 C 95 13 104 8 108 14" fill="none" stroke="${C.body1}" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="100" cy="158" rx="49" ry="42" fill="url(#${id}w)"/>
    <path d="M100 70 C 92 51 67 45 55 60 C 43 75 49 97 66 109 C 78 118 92 122 100 129 C 108 122 122 118 134 109 C 151 97 157 75 145 60 C 133 45 108 51 100 70 Z" fill="${C.face}"/>
    <ellipse class="pg-blush" cx="65" cy="105" rx="10" ry="5.5" fill="${C.blush}" opacity=".75"/>
    <ellipse class="pg-blush" cx="135" cy="105" rx="10" ry="5.5" fill="${C.blush}" opacity=".75"/>
    ${eyes(mood)}
    <path d="M90.5 100 Q100 94.5 109.5 100 Q105.5 110.5 100 111.5 Q94.5 110.5 90.5 100 Z" fill="${C.beak}"/>
    <path d="M94 99.5 Q100 96.5 106 99.5" fill="none" stroke="${C.beakHi}" stroke-width="2.2" stroke-linecap="round"/>
    <g transform="translate(133 36) rotate(18)"><g class="pg-bow">
      <path d="M0 0 C -12 -15 -29 -10 -25 3 C -22 13 -9 8 0 0 Z" fill="${C.bow}"/>
      <path d="M0 0 C 12 -15 29 -10 25 3 C 22 13 9 8 0 0 Z" fill="${C.bow}"/>
      <path d="M-19 -3 C -16 -8 -10 -8 -7 -5" fill="none" stroke="${C.bowHi}" stroke-width="2.4" stroke-linecap="round"/>
      <circle r="5.6" fill="${C.bowKnot}"/>
    </g></g>
    ${prop(p)}
    ${p ? flippers : ''}
  </g>
</svg>`;
  }

  window.Penguin = { svg };
})();
