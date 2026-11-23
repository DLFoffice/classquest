// ส่วนประกอบหน้าตาที่ใช้ร่วมกัน: รูปทรงคำตอบ, อวตาร, มาสคอต, คอนเฟตตี, เสียง
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// รูปทรงประจำตัวเลือก (ดาว · หัวใจ · สามเหลี่ยม · วงกลม)
const P = {
  star: '<path d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4L2.8 9.3l6.4-.8z"/>',
  heart: '<path d="M12 20.5s-8.3-5-8.3-11A4.6 4.6 0 0 1 12 6.8a4.6 4.6 0 0 1 8.3 2.7c0 6-8.3 11-8.3 11z"/>',
  tri: '<path d="M12 3.2l9.4 16.6H2.6z"/>',
  circle: '<circle cx="12" cy="12" r="8.6"/>',
};
export const SHAPES = ['star', 'heart', 'tri', 'circle'];
export const shape = (i) => `<svg class="shp" viewBox="0 0 24 24" aria-hidden="true">${P[SHAPES[i]]}</svg>`;
export const LETTER = ['ก', 'ข', 'ค', 'ง'];

export const AVATARS = ['🦊', '🐼', '🐯', '🐸', '🐵', '🐧', '🐰', '🐨', '🦁', '🐙', '🦄', '🐳'];
export const avatar = (i) => AVATARS[Number(i) || 0] || AVATARS[0];

// มาสคอต "น้องดินสอ"
export const MASCOT = `<svg class="mascot" viewBox="0 0 120 150" aria-hidden="true">
  <g class="m-body">
    <path d="M38 34h44v78l-22 30-22-30z" fill="#FFB627" stroke="#22223B" stroke-width="4" stroke-linejoin="round"/>
    <path d="M38 112h44l-22 30z" fill="#FBE3C4" stroke="#22223B" stroke-width="4" stroke-linejoin="round"/>
    <path d="M53 132l7 10 7-10z" fill="#22223B"/>
    <rect x="38" y="20" width="44" height="18" rx="4" fill="#FF6B6B" stroke="#22223B" stroke-width="4"/>
    <rect x="38" y="34" width="44" height="8" fill="#C9D1E0" stroke="#22223B" stroke-width="4"/>
    <line x1="60" y1="46" x2="60" y2="108" stroke="#E79A12" stroke-width="3"/>
    <g class="m-eyes"><ellipse cx="50" cy="70" rx="5" ry="6.5" fill="#22223B"/><ellipse cx="70" cy="70" rx="5" ry="6.5" fill="#22223B"/>
      <circle cx="52" cy="68" r="1.8" fill="#fff"/><circle cx="72" cy="68" r="1.8" fill="#fff"/></g>
    <path class="m-mouth" d="M52 84q8 8 16 0" fill="none" stroke="#22223B" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="44" cy="82" r="4" fill="#FF8FA3" opacity=".7"/><circle cx="76" cy="82" r="4" fill="#FF8FA3" opacity=".7"/>
    <path class="m-arm l" d="M38 76q-14 4-18-10" fill="none" stroke="#22223B" stroke-width="4" stroke-linecap="round"/>
    <path class="m-arm r" d="M82 76q14 4 18-10" fill="none" stroke="#22223B" stroke-width="4" stroke-linecap="round"/>
  </g></svg>`;

// คอนเฟตตี (canvas เต็มจอ)
export function confetti(n = 140) {
  const cv = document.createElement('canvas'); cv.className = 'confetti';
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d'), W = (cv.width = innerWidth), H = (cv.height = innerHeight);
  const cols = ['#FF6B6B', '#FFB627', '#2EC4B6', '#7B61FF', '#22223B', '#FF8FA3'];
  const ps = Array.from({ length: n }, () => ({ x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35, vx: (Math.random() - 0.5) * 16,
    vy: -Math.random() * 16 - 6, r: Math.random() * 6 + 4, c: cols[(Math.random() * cols.length) | 0], a: Math.random() * 6, s: Math.random() < 0.5 }));
  let t = 0;
  (function f() {
    ctx.clearRect(0, 0, W, H); t++;
    ps.forEach((p) => { p.vy += 0.38; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += 0.15;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c;
      if (p.s) ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); else { ctx.beginPath(); ctx.arc(0, 0, p.r / 1.4, 0, 7); ctx.fill(); }
      ctx.restore(); });
    if (t < 220) requestAnimationFrame(f); else cv.remove();
  })();
}

// เสียง (สังเคราะห์ด้วย WebAudio — ไม่ต้องโหลดไฟล์)
let AC = null, muted = false;
const ac = () => (AC ||= new (window.AudioContext || window.webkitAudioContext)());
export const sound = {
  get muted() { return muted; },
  toggle() { muted = !muted; if (muted) music.stop(); return muted; },
  unlock() { try { ac().resume(); } catch (e) {} },
  tone(f, d = 0.12, type = 'sine', vol = 0.18, when = 0) {
    if (muted) return;
    try {
      const c = ac(), o = c.createOscillator(), g = c.createGain(), t = c.currentTime + when;
      o.type = type; o.frequency.value = f; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + 0.02);
    } catch (e) {}
  },
  pop() { this.tone(660, 0.08, 'triangle', 0.15); this.tone(990, 0.1, 'triangle', 0.12, 0.06); },
  tick(hi) { this.tone(hi ? 1180 : 880, 0.06, 'square', 0.06); },
  reveal() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.16, i * 0.09)); },
  wrong() { this.tone(330, 0.2, 'sawtooth', 0.08); this.tone(247, 0.3, 'sawtooth', 0.08, 0.16); },
  fanfare() { [523, 523, 659, 784, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.17, [0, .12, .24, .36, .6, .72, .9][i])); },
};

// เพลงประกอบเบา ๆ (วนลูป) สำหรับจอครู
export const music = {
  timer: null, step: 0,
  start(fast) {
    this.stop(); if (muted) return;
    const bass = [196, 196, 262, 262, 220, 220, 175, 196], mel = [392, 494, 523, 659, 587, 523, 494, 440, 392, 440, 494, 523, 494, 440, 392, 330];
    const beat = fast ? 0.2 : 0.28;
    this.timer = setInterval(() => {
      if (muted) return;
      const i = this.step++;
      if (i % 2 === 0) sound.tone(bass[(i / 2) % 8], beat * 1.6, 'triangle', 0.05);
      if (i % 4 !== 3) sound.tone(mel[i % 16], beat * 0.9, 'sine', 0.035);
    }, beat * 1000);
  },
  stop() { clearInterval(this.timer); this.timer = null; },
};

export function toast(msg, ms = 2600) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms);
}

export function uid() {
  const a = new Uint8Array(9); crypto.getRandomValues(a);
  return [...a].map((x) => 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]).join('') + Date.now().toString(36).slice(-3);
}

// จ่าฝูงจิ้งจอกอาร์กติก (ฉากหิมะ)
const FOX_T = `<svg class="mascot fox" viewBox="0 0 140 150" aria-hidden="true">
  <g class="m-body">
    <path class="f-tail" d="M90 132 C128 128 140 92 122 64 C120 88 106 104 86 112 Z" fill="{F}" stroke="#22223B" stroke-width="4" stroke-linejoin="round"/>
    <path d="M120 70 C126 84 124 100 116 112 C120 96 120 84 116 74 Z" fill="#DCE6F2"/>
    <path d="M40 144 C34 112 44 92 70 88 C96 92 106 112 100 144 Z" fill="{F}" stroke="#22223B" stroke-width="4" stroke-linejoin="round"/>
    <path d="M58 102 q12 12 24 0 q-3 20 -12 24 q-9 -4 -12 -24z" fill="#EEF4FB"/>
    <ellipse cx="56" cy="143" rx="11" ry="6" fill="{F}" stroke="#22223B" stroke-width="3.5"/>
    <ellipse cx="84" cy="143" rx="11" ry="6" fill="{F}" stroke="#22223B" stroke-width="3.5"/>
    <path d="M45 46 L38 10 L66 36 Z" fill="{F}" stroke="#22223B" stroke-width="4" stroke-linejoin="round"/>
    <path d="M47 39 L43 20 L59 35 Z" fill="#9FB4CC"/>
    <path d="M95 46 L102 10 L74 36 Z" fill="{F}" stroke="#22223B" stroke-width="4" stroke-linejoin="round"/>
    <path d="M93 39 L97 20 L81 35 Z" fill="#9FB4CC"/>
    <path d="M38 60 C36 34 104 34 102 60 C102 70 108 74 100 78 C92 90 80 94 70 94 C60 94 48 90 40 78 C32 74 38 70 38 60 Z" fill="{F}" stroke="#22223B" stroke-width="4" stroke-linejoin="round"/>
    <g class="m-eyes"><ellipse cx="56" cy="60" rx="5" ry="6.5" fill="#22223B"/><ellipse cx="84" cy="60" rx="5" ry="6.5" fill="#22223B"/>
      <circle cx="58" cy="58" r="1.8" fill="#fff"/><circle cx="86" cy="58" r="1.8" fill="#fff"/></g>
    <path d="M54 50 l8 3 M86 50 l-8 3" stroke="#22223B" stroke-width="3" stroke-linecap="round"/>
    <path d="M60 72 q10 -7 20 0 q-3 10 -10 11 q-7 -1 -10 -11z" fill="#F1F5FB"/>
    <ellipse cx="70" cy="72" rx="5" ry="3.6" fill="#22223B"/>
    <path class="m-mouth" d="M63 80 q7 6 7 0 q0 6 7 0" fill="none" stroke="#22223B" stroke-width="3" stroke-linecap="round"/>
    <circle cx="47" cy="72" r="4.5" fill="#FF9FB2" opacity=".7"/><circle cx="93" cy="72" r="4.5" fill="#FF9FB2" opacity=".7"/>
    <path d="M46 90 q24 13 48 0 l-2 10 q-22 11 -44 0 z" fill="#4D8DFF" stroke="#22223B" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M86 98 l9 22 l-10 -3 z" fill="#4D8DFF" stroke="#22223B" stroke-width="3" stroke-linejoin="round"/>
    <g transform="translate(70 99)" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M0 -6 V6 M-5 -3 L5 3 M5 -3 L-5 3"/></g>
  </g></svg>`;
export const foxSVG = (fur = '#fff') => FOX_T.split('{F}').join(fur);
export const FOX = foxSVG('#fff');
export const FOX_THEMES = ['snow', 'fire', 'earth', 'wind'];
export const mascotFor = (theme) => (FOX_THEMES.includes(theme) ? FOX : MASCOT);
