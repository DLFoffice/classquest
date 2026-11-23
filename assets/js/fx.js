// เอฟเฟกต์และฉากหลังเคลื่อนไหว — ฉากตามเนื้อหา · ทรานซิชัน · ตัวเลขวิ่ง · พลุ · สปอตไลต์ · อีโมจิลอย
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width: 700px)').matches;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ===================================================== ฉากตามเนื้อหา
export const THEMES = {
  auto: 'อัตโนมัติ (ตามชื่อกิจกรรม)',
  snow: '❄️ ด่านหิมะ', fire: '🔥 ด่านอัคนี', earth: '🌿 ด่านปฐพี', wind: '🌪️ ด่านวายุ', space: '🪐 อวกาศ', nature: '🌿 ธรรมชาติ', ocean: '🐠 ใต้ทะเล', lab: '🧪 ห้องทดลอง', math: '🔢 คณิตคิดสนุก', class: '✏️ ห้องเรียน',
};
const KEYWORDS = [
  ['snow', /หิมะ|น้ำแข็ง|จิ้งจอก|ขั้วโลก|อาร์กติก|snow|arctic|fox/i],
  ['space', /ดาว|อวกาศ|สุริยะ|จันทร์|ดวงอาทิตย์|จักรวาล|กาแล็กซี|space|planet|solar/i],
  ['ocean', /ทะเล|มหาสมุทร|ปลา|น้ำ|ฝน|วัฏจักร|แม่น้ำ|ocean|sea|water/i],
  ['nature', /พืช|ต้นไม้|ใบไม้|ดอกไม้|สัตว์|ธรรมชาติ|สิ่งแวดล้อม|แมลง|ป่า|ระบบนิเวศ|plant|animal|nature/i],
  ['lab', /สาร|เคมี|ทดลอง|อะตอม|ไฟฟ้า|แรง|แม่เหล็ก|พลังงาน|ร่างกาย|เซลล์|chem|lab|energy/i],
  ['math', /คณิต|เลข|บวก|ลบ|คูณ|หาร|เศษส่วน|ทศนิยม|เรขา|รูปทรง|สมการ|math|number/i],
];
export function themeFor(choice, title) {
  if (choice && choice !== 'auto' && THEMES[choice]) return choice;
  for (const [k, re] of KEYWORDS) if (re.test(title || '')) return k;
  return 'class';
}

const SPRITES = {
  nature: ['🍃', '🌿', '🌸', '🍂', '🌼'], ocean: ['🐠', '🐟', '🐡', '🦀', '🐚'], lab: ['🧪', '⚗️', '🔬', '🧲', '⚡', '🧬'],
  math: ['➕', '➖', '✖️', '➗', '🔢', '📐', '📏', '%'], class: ['✏️', '📐', '⭐', '📚', '💡', '🎨', '📎'],
};
const spriteCache = new Map();
function sprite(ch, size) {
  const k = ch + size; if (spriteCache.has(k)) return spriteCache.get(k);
  const c = document.createElement('canvas'); c.width = c.height = Math.ceil(size * 1.3);
  const x = c.getContext('2d'); x.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, c.width / 2, c.height / 2 + size * 0.05);
  spriteCache.set(k, c); return c;
}

let BD = null;
export function backdrop(theme) {
  if (BD && BD.theme === theme) return;
  if (BD) { cancelAnimationFrame(BD.raf); BD.el.remove(); }
  document.body.classList.remove(...[...document.body.classList].filter((c) => c.startsWith('th-')));
  document.body.classList.add('th-' + theme);
  if (theme === 'space' || theme === 'snow' || theme === 'fire') document.body.classList.add('th-dark');
  else document.body.classList.remove('th-dark');
  const el = document.createElement('div'); el.className = 'bd'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = STATIC[theme] || '';
  const cv = document.createElement('canvas'); el.appendChild(cv);
  document.body.prepend(el);
  BD = { theme, el, raf: 0 };
  if (REDUCED) return;
  const ctx = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
  let W, H;
  const size = () => { W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); addEventListener('resize', size);
  const k = MOBILE ? 0.5 : 1;
  let parts = [], extra = [], t0 = performance.now();

  if (theme === 'fire') {
    parts = Array.from({ length: (110 * k) | 0 }, () => ({ x: rnd(0, 1), y: rnd(0, 1.2), v: rnd(0.0015, 0.005), r: rnd(1, 3.4), p: rnd(0, 6.3), h: rnd(10, 45) }));
  } else if (theme === 'earth') {
    parts = Array.from({ length: (40 * k) | 0 }, () => ({ x: rnd(0, 1), y: rnd(0, 1), v: rnd(0.0003, 0.0012), r: rnd(1, 3), p: rnd(0, 6.3) }));
    extra = Array.from({ length: (10 * k) | 0 }, () => ({ ch: pick(['🍂', '🌿', '🍃']), x: rnd(0, 1), y: rnd(-0.2, 1), sz: rnd(20, 32), v: rnd(0.008, 0.02), a: rnd(0, 6), p: rnd(0, 6) }));
  } else if (theme === 'wind') {
    parts = Array.from({ length: (26 * k) | 0 }, () => ({ x: rnd(-0.5, 1), y: rnd(0.05, 0.9), v: rnd(0.003, 0.008), l: rnd(0.08, 0.22), a: rnd(0.008, 0.03), p: rnd(0, 6.3) }));
    extra = Array.from({ length: (12 * k) | 0 }, () => ({ ch: pick(['🍃', '🍂', '🌸', '🪶']), x: rnd(-0.2, 1), y: rnd(0.1, 0.9), sz: rnd(18, 30), v: rnd(0.004, 0.009), a: rnd(0, 6), p: rnd(0, 6) }));
  } else if (theme === 'snow') {
    parts = Array.from({ length: (190 * k) | 0 }, () => ({ x: rnd(0, 1), y: rnd(0, 1), z: rnd(0.3, 1), p: rnd(0, 6.3) }));
  } else if (theme === 'space') {
    parts = Array.from({ length: (150 * k) | 0 }, () => ({ x: rnd(0, 1), y: rnd(0, 1), r: rnd(0.4, 1.9), p: rnd(0, 6.3), s: rnd(0.6, 2.2) }));
  } else if (theme === 'ocean') {
    parts = Array.from({ length: (34 * k) | 0 }, () => ({ x: rnd(0, 1), y: rnd(0, 1.2), r: rnd(3, 13), v: rnd(0.02, 0.07), p: rnd(0, 6) }));
    extra = Array.from({ length: (5 * k + 1) | 0 }, () => fish());
  } else {
    const L = SPRITES[theme] || SPRITES.class;
    parts = Array.from({ length: ((theme === 'nature' ? 22 : 15) * k) | 0 }, () => ({ ch: pick(L), x: rnd(0, 1), y: rnd(-0.2, 1), sz: rnd(18, 38),
      v: rnd(0.008, 0.03), a: rnd(0, 6.3), va: rnd(-0.6, 0.6), p: rnd(0, 6), al: theme === 'class' || theme === 'math' ? 0.32 : 0.75 }));
    if (theme === 'nature') extra = Array.from({ length: 3 }, () => ({ ch: '🦋', x: rnd(-0.2, 1), y: rnd(0.1, 0.7), v: rnd(0.025, 0.05), p: rnd(0, 6) }));
  }
  function fish() { const d = Math.random() < 0.5 ? 1 : -1; return { ch: pick(SPRITES.ocean.slice(0, 3)), d, x: d > 0 ? -0.1 : 1.1, y: rnd(0.25, 0.85), v: rnd(0.02, 0.05), sz: rnd(28, 46), p: rnd(0, 6) }; }
  let shoot = null, nextShoot = 1500, plane = null, nextPlane = 4000;

  const frame = (now) => {
    const t = (now - t0) / 1000, dt = 1 / 60;
    ctx.clearRect(0, 0, W, H);
    if (theme === 'fire') {
      ctx.globalCompositeOperation = 'lighter';
      parts.forEach((e) => { e.y -= e.v; e.x += Math.sin(t * 2 + e.p) * 0.0008; if (e.y < -0.05) { e.y = 1.05; e.x = rnd(0, 1); }
        const fl = 0.5 + 0.5 * Math.sin(t * 8 + e.p), g = ctx.createRadialGradient(e.x * W, e.y * H, 0, e.x * W, e.y * H, e.r * 3);
        g.addColorStop(0, `hsla(${e.h},100%,70%,${0.9 * fl + 0.1})`); g.addColorStop(1, 'hsla(20,100%,50%,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x * W, e.y * H, e.r * 3, 0, 7); ctx.fill(); });
      ctx.globalCompositeOperation = 'source-over';
    } else if (theme === 'earth') {
      ctx.fillStyle = '#C98A4B';
      parts.forEach((d) => { d.y += d.v; d.x += Math.sin(t * 0.7 + d.p) * 0.0006; if (d.y > 1.02) { d.y = -0.02; d.x = rnd(0, 1); }
        ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(d.x * W, d.y * H, d.r, 0, 7); ctx.fill(); });
      extra.forEach((p) => { p.y += p.v * dt * 1.2; p.a += 0.01; if (p.y > 1.1) { p.y = -0.1; p.x = rnd(0, 1); }
        const im = sprite(p.ch, p.sz | 0); ctx.globalAlpha = 0.8; ctx.save(); ctx.translate(p.x * W + Math.sin(t + p.p) * 40, p.y * H); ctx.rotate(p.a); ctx.drawImage(im, -im.width / 2, -im.height / 2); ctx.restore(); });
    } else if (theme === 'wind') {
      ctx.lineCap = 'round';
      parts.forEach((w) => { w.x += w.v; if (w.x > 1.3) { w.x = rnd(-0.6, -0.2); w.y = rnd(0.05, 0.9); }
        ctx.globalAlpha = 0.55; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath();
        for (let q = 0; q <= 1; q += 0.05) { const X = (w.x + q * w.l) * W, Y = w.y * H + Math.sin(q * 8 + t * 2 + w.p) * 14 * (1 - q) + q * q * 30 * Math.sin(w.p);
          q === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); }
        ctx.stroke(); });
      extra.forEach((p) => { p.x += p.v; p.a += 0.06; if (p.x > 1.1) { p.x = -0.1; p.y = rnd(0.1, 0.9); }
        const im = sprite(p.ch, p.sz | 0), y = p.y * H + Math.sin(t * 2.5 + p.p) * 40; ctx.globalAlpha = 0.85; ctx.save(); ctx.translate(p.x * W, y); ctx.rotate(p.a); ctx.drawImage(im, -im.width / 2, -im.height / 2); ctx.restore(); });
    } else if (theme === 'snow') {
      const wind = (BD.wind || 0) + Math.sin(t * 0.3) * 0.25;
      ctx.fillStyle = '#fff';
      parts.forEach((f) => {
        f.y += (0.0009 + f.z * 0.0022) * (1 + (BD.wind || 0) * 3); f.x += (wind * 0.0012 + Math.sin(t + f.p) * 0.0004) * f.z;
        if (f.y > 1.02) { f.y = -0.02; f.x = rnd(-0.1, 1.1); } if (f.x > 1.05) f.x = -0.05; if (f.x < -0.05) f.x = 1.05;
        ctx.globalAlpha = 0.35 + f.z * 0.6; ctx.beginPath(); ctx.arc(f.x * W, f.y * H, 0.8 + f.z * 2.8, 0, 7); ctx.fill();
      });
    } else if (theme === 'space') {
      parts.forEach((s) => { const a = 0.35 + 0.65 * Math.abs(Math.sin(t * s.s + s.p)); ctx.globalAlpha = a; ctx.fillStyle = s.r > 1.5 ? '#FFE9A8' : '#fff';
        ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, 7); ctx.fill(); });
      if (now - t0 > nextShoot && !shoot) shoot = { x: rnd(0.1, 0.9) * W, y: rnd(0, 0.4) * H, l: 0 };
      if (shoot) {
        shoot.l += 0.025; const L = shoot.l, x = shoot.x + L * 520, y = shoot.y + L * 260;
        const g = ctx.createLinearGradient(x - 140, y - 70, x, y); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.95)');
        ctx.globalAlpha = Math.min(1, (1 - L) * 2); ctx.strokeStyle = g; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 140, y - 70); ctx.lineTo(x, y); ctx.stroke();
        if (L >= 1) { shoot = null; nextShoot = now - t0 + rnd(2500, 6000); }
      }
    } else if (theme === 'ocean') {
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2;
      parts.forEach((b) => { b.y -= b.v * dt * 2; if (b.y < -0.05) { b.y = 1.1; b.x = rnd(0, 1); }
        const x = b.x * W + Math.sin(t * 1.5 + b.p) * 12; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(x, b.y * H, b.r, 0, 7); ctx.stroke();
        ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(x - b.r * 0.35, b.y * H - b.r * 0.35, b.r * 0.22, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); });
      extra.forEach((f, i) => { f.x += f.d * f.v * dt; const im = sprite(f.ch, f.sz), y = f.y * H + Math.sin(t * 2 + f.p) * 10;
        ctx.globalAlpha = 0.9; ctx.save(); ctx.translate(f.x * W, y); ctx.scale(-f.d, 1); ctx.drawImage(im, -im.width / 2, -im.height / 2); ctx.restore();
        if (f.x > 1.2 || f.x < -0.2) extra[i] = fish(); });
    } else {
      parts.forEach((p) => { p.y += p.v * dt * (theme === 'nature' ? 1.6 : 0.6) * (theme === 'nature' ? 1 : -1); p.a += p.va * dt;
        if (p.y > 1.15) { p.y = -0.1; p.x = rnd(0, 1); } if (p.y < -0.15) { p.y = 1.1; p.x = rnd(0, 1); }
        const im = sprite(p.ch, p.sz | 0), x = p.x * W + Math.sin(t * 0.8 + p.p) * 30;
        ctx.globalAlpha = p.al; ctx.save(); ctx.translate(x, p.y * H); ctx.rotate(p.a); ctx.drawImage(im, -im.width / 2, -im.height / 2); ctx.restore(); });
      extra.forEach((b) => { b.x += b.v * dt; if (b.x > 1.15) { b.x = -0.15; b.y = rnd(0.1, 0.7); }
        const im = sprite(b.ch, 34), y = b.y * H + Math.sin(t * 3 + b.p) * 26, fl = 0.55 + 0.45 * Math.abs(Math.sin(t * 9 + b.p));
        ctx.globalAlpha = 0.95; ctx.save(); ctx.translate(b.x * W, y); ctx.scale(fl, 1); ctx.drawImage(im, -im.width / 2, -im.height / 2); ctx.restore(); });
      if (theme === 'class' || theme === 'math') {
        if (now - t0 > nextPlane && !plane) plane = { p: 0, y: rnd(0.2, 0.6) };
        if (plane) {
          plane.p += 0.004; const x = -0.1 + plane.p * 1.25, y = plane.y + Math.sin(plane.p * 9) * 0.06;
          ctx.globalAlpha = 0.5; ctx.setLineDash([6, 8]); ctx.strokeStyle = '#4A4E69'; ctx.lineWidth = 2; ctx.beginPath();
          for (let q = Math.max(0, plane.p - 0.25); q <= plane.p; q += 0.01) { const X = (-0.1 + q * 1.25) * W, Y = (plane.y + Math.sin(q * 9) * 0.06) * H; q === Math.max(0, plane.p - 0.25) ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); }
          ctx.stroke(); ctx.setLineDash([]);
          const im = sprite('🛩️', 38); ctx.globalAlpha = 0.9; ctx.save(); ctx.translate(x * W, y * H); ctx.rotate(Math.cos(plane.p * 9) * 0.35); ctx.drawImage(im, -im.width / 2, -im.height / 2); ctx.restore();
          if (plane.p > 1) { plane = null; nextPlane = now - t0 + rnd(7000, 12000); }
        }
      }
    }
    ctx.globalAlpha = 1;
    BD.raf = requestAnimationFrame(frame);
  };
  BD.raf = requestAnimationFrame(frame);
}

const pines = (n, h, col, seed) => { let d = ''; for (let i = 0; i <= n; i++) { const x = (i / n) * 1440 + ((i * seed) % 37) - 18, hh = h * (0.7 + ((i * seed * 7) % 10) / 22);
  d += `M${x - hh * 0.38} 200 L${x} ${200 - hh} L${x + hh * 0.38} 200 Z M${x - hh * 0.3} ${200 - hh * 0.45} L${x} ${200 - hh * 1.02} L${x + hh * 0.3} ${200 - hh * 0.45} Z `; }
  return `<path d="${d}" fill="${col}"/>`; };
const STATIC = {
  fire: `<div class="glow"></div>
    <svg class="volc v1" viewBox="0 0 1440 300" preserveAspectRatio="none"><path d="M0 300 L0 210 L180 160 L300 190 L470 80 L520 70 L560 85 L720 190 L900 150 L1040 60 L1090 55 L1130 70 L1300 180 L1440 150 L1440 300Z" fill="#3A1410"/>
      <path d="M470 80 L520 70 L560 85 L548 120 L530 105 L515 140 L500 110 L482 125 Z M1040 60 L1090 55 L1130 70 L1118 100 L1098 88 L1086 120 L1070 92 L1052 104 Z" fill="#FF6B2E" class="lava"/></svg>
    <svg class="volc v2" viewBox="0 0 1440 200" preserveAspectRatio="none"><path d="M0 200 L0 120 Q200 80 380 130 T760 110 T1100 140 T1440 100 L1440 200Z" fill="#200A08"/></svg>
    <div class="lavafloor"></div><div class="heart">❤️‍🔥</div>`,
  earth: `<svg class="mesa m1" viewBox="0 0 1440 300" preserveAspectRatio="none"><path d="M0 300 L0 150 L120 150 L140 110 L330 110 L350 150 L520 150 L540 90 L760 90 L790 160 L980 160 L1000 120 L1220 120 L1240 170 L1440 170 L1440 300Z" fill="#D9895A"/></svg>
    <svg class="mesa m2" viewBox="0 0 1440 200" preserveAspectRatio="none"><path d="M0 200 L0 110 Q240 60 480 105 T960 95 T1440 100 L1440 200Z" fill="#8C5A3C"/></svg>
    <div class="crystal c1"></div><div class="crystal c2"></div><div class="crystal c3"></div><div class="vine"></div>`,
  wind: `<div class="cl cl1">☁️</div><div class="cl cl2">☁️</div><div class="cl cl3">☁️</div><div class="cl cl4">☁️</div>
    <div class="swirl s1"></div><div class="swirl s2"></div>
    <svg class="hills2" viewBox="0 0 1440 200" preserveAspectRatio="none"><path d="M0 200 L0 130 Q300 70 640 130 T1440 110 L1440 200Z" fill="#BFE3D0"/></svg>
    <div class="mill"><i></i></div>`,
  snow: `<div class="aurora"><i></i><i></i><i></i></div><div class="smoon"></div>
    <svg class="mtn" viewBox="0 0 1440 300" preserveAspectRatio="none"><path d="M0 300 L0 190 L140 90 L230 150 L360 40 L470 140 L560 100 L700 20 L820 130 L930 70 L1060 160 L1180 60 L1300 140 L1440 90 L1440 300Z" fill="#2E5583"/>
      <path d="M360 40 L320 78 L345 72 L362 86 L380 70 L402 80 Z M700 20 L660 58 L688 52 L705 66 L722 50 L742 60 Z M1180 60 L1145 92 L1168 88 L1184 98 L1200 86 L1218 92 Z" fill="#EAF4FF"/></svg>
    <svg class="pine p1" viewBox="0 0 1440 200" preserveAspectRatio="none">${pines(26, 120, '#1F3F66', 7)}</svg>
    <svg class="pine p2" viewBox="0 0 1440 200" preserveAspectRatio="none">${pines(18, 170, '#16304F', 13)}</svg>
    <div class="ground"><div class="prints"></div></div>
    <svg class="runfox" viewBox="0 0 120 60"><g fill="#F4F8FF" stroke="#9FB4CC" stroke-width="2" stroke-linejoin="round">
      <path d="M8 30 C20 18 34 22 44 26 C58 18 78 20 88 26 L100 16 L102 28 C108 30 112 34 110 38 C104 40 96 38 90 40 C84 48 72 50 62 46 L54 56 L50 46 C40 46 32 44 26 40 L16 50 L18 38 C12 38 6 36 8 30Z"/></g>
      <circle cx="101" cy="31" r="1.8" fill="#22223B"/></svg>`,
  space: `<div class="neb n1"></div><div class="neb n2"></div>
    <div class="solar"><div class="sun"></div>
      <div class="orbit o1"><i style="--pc:#C9B8A6;--ps:12px"></i></div><div class="orbit o2"><i style="--pc:#F2C14E;--ps:18px"></i></div>
      <div class="orbit o3"><i style="--pc:#4D9DE0;--ps:20px"></i></div><div class="orbit o4"><i style="--pc:#E15554;--ps:15px"></i></div>
      <div class="orbit o5"><i class="ring" style="--pc:#E8C47A;--ps:30px"></i></div></div>
    <div class="moon"></div>`,
  ocean: `<div class="rays"><i></i><i></i><i></i><i></i></div>
    <svg class="wave w1" viewBox="0 0 1440 120" preserveAspectRatio="none"><path d="M0 60 C240 10 480 110 720 60 S1200 10 1440 60 V120 H0Z"/></svg>
    <svg class="wave w2" viewBox="0 0 1440 120" preserveAspectRatio="none"><path d="M0 70 C240 120 480 20 720 70 S1200 120 1440 70 V120 H0Z"/></svg>
    <div class="weed s1">🌿</div><div class="weed s2">🪸</div><div class="weed s3">🌿</div>`,
  nature: `<div class="nsun"><i></i></div>
    <svg class="hill h1" viewBox="0 0 1440 200" preserveAspectRatio="none"><path d="M0 120 Q360 20 720 110 T1440 90 V200 H0Z"/></svg>
    <svg class="hill h2" viewBox="0 0 1440 200" preserveAspectRatio="none"><path d="M0 150 Q400 80 800 150 T1440 130 V200 H0Z"/></svg>
    <div class="cloud c1">☁️</div><div class="cloud c2">☁️</div>`,
  lab: `<div class="hex"></div><div class="atom"><i></i><i></i><i></i><b></b></div>`,
  math: `<div class="grid"></div>`,
  class: ``,
};

// ===================================================== พายุหิมะ (ตอนหมดเวลา / ตอบผิด)
export function blizzard(ms = 1800) {
  if (REDUCED) return;
  if (BD) { BD.wind = 4; setTimeout(() => { if (BD) BD.wind = 0; }, ms); }
  const cv = document.createElement('canvas'); cv.className = 'confetti blz'; document.body.appendChild(cv);
  const ctx = cv.getContext('2d'), W = (cv.width = innerWidth), H = (cv.height = innerHeight);
  const fl = Array.from({ length: MOBILE ? 160 : 360 }, () => ({ x: rnd(-0.6, 1), y: rnd(-0.2, 1), v: rnd(0.012, 0.03), r: rnd(1, 3.6) }));
  const t0 = performance.now();
  const f = (now) => {
    const p = (now - t0) / ms; ctx.clearRect(0, 0, W, H);
    const a = p < 0.2 ? p / 0.2 : p > 0.75 ? Math.max(0, (1 - p) / 0.25) : 1;
    const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, `rgba(235,245,255,${0.55 * a})`); g.addColorStop(1, `rgba(235,245,255,${0.15 * a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = `rgba(255,255,255,${0.9 * a})`; ctx.lineCap = 'round';
    fl.forEach((s) => { s.x += s.v * 1.6; s.y += s.v * 0.5; if (s.x > 1.05) { s.x = rnd(-0.3, -0.05); s.y = rnd(-0.1, 1); }
      ctx.lineWidth = s.r; ctx.beginPath(); ctx.moveTo(s.x * W, s.y * H); ctx.lineTo(s.x * W - 26 * s.r, s.y * H - 8 * s.r); ctx.stroke(); });
    if (p < 1) requestAnimationFrame(f); else cv.remove();
  };
  requestAnimationFrame(f);
}

// ===================================================== ทรานซิชันแถบสีกวาด
let wiping = Promise.resolve();
export function swap(fn, label = '') {
  if (REDUCED) { fn(); return Promise.resolve(); }
  wiping = wiping.then(async () => {
    const w = document.createElement('div'); w.className = 'wipe';
    w.innerHTML = '<i></i><i></i><i></i><i></i>' + (label ? `<div class="wipe-label"><span>${label}</span></div>` : '');
    document.body.appendChild(w);
    await wait(30); w.classList.add('in');
    await wait(label ? 620 : 380);
    try { fn(); } catch (e) { console.error(e); }
    w.classList.add('out');
    await wait(520); w.remove();
  });
  return wiping;
}

// ===================================================== ข้อความลอยเข้าทีละคำ
export function wordsHTML(text, esc, base = 0) {
  if (REDUCED || !window.Intl || !Intl.Segmenter) return esc(text);
  const seg = [...new Intl.Segmenter('th', { granularity: 'word' }).segment(text)].map((s) => s.segment);
  return seg.map((w, i) => (/^\s+$/.test(w) ? w : `<span class="wd" style="--d:${(base + i * 0.045).toFixed(3)}s">${esc(w)}</span>`)).join('');
}

// ===================================================== ตัวเลขวิ่ง
export function countUp(el, from, to, ms = 1000, fmt = (n) => Math.round(n).toLocaleString()) {
  if (!el) return;
  if (REDUCED || from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = (now) => { const p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(from + (to - from) * e); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

// ===================================================== ประกายรอบองค์ประกอบ
export function sparkle(el, n = 14) {
  if (REDUCED || !el) return;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span'); s.className = 'spk'; s.textContent = pick(['✦', '✧', '★', '✨']);
    s.style.cssText = `left:${rnd(-5, 105)}%;top:${rnd(-15, 115)}%;--d:${rnd(0, 1.2).toFixed(2)}s;--s:${rnd(0.7, 1.6).toFixed(2)};color:${pick(['#fff', '#FFE066', '#FFB627'])}`;
    el.appendChild(s);
  }
}

// ===================================================== พลุ
export function fireworks(ms = 6000) {
  if (REDUCED) return;
  const cv = document.createElement('canvas'); cv.className = 'confetti'; document.body.appendChild(cv);
  const ctx = cv.getContext('2d'), W = (cv.width = innerWidth), H = (cv.height = innerHeight);
  const cols = ['#FF6B6B', '#FFB627', '#2EC4B6', '#7B61FF', '#FF8FA3', '#FFE066', '#fff'];
  let rockets = [], sparks = [], t0 = performance.now(), last = 0;
  const frame = (now) => {
    ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    if (now - t0 < ms && now - last > rnd(260, 620)) { last = now; rockets.push({ x: rnd(0.15, 0.85) * W, y: H, vy: -rnd(11, 15), tx: rnd(0.15, 0.45) * H, c: pick(cols) }); }
    rockets = rockets.filter((r) => { r.y += r.vy; r.vy += 0.12; ctx.fillStyle = r.c; ctx.beginPath(); ctx.arc(r.x, r.y, 3, 0, 7); ctx.fill();
      if (r.y <= r.tx || r.vy >= 0) { const n = 70; for (let i = 0; i < n; i++) { const a = (i / n) * 6.283, v = rnd(2, 6.5); sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, c: Math.random() < 0.25 ? '#fff' : r.c }); } return false; }
      return true; });
    sparks = sparks.filter((s) => { s.x += s.vx; s.y += s.vy; s.vy += 0.06; s.vx *= 0.985; s.l -= 0.012;
      ctx.globalAlpha = Math.max(0, s.l); ctx.fillStyle = s.c; ctx.beginPath(); ctx.arc(s.x, s.y, 2.4, 0, 7); ctx.fill(); return s.l > 0; });
    ctx.globalAlpha = 1;
    if (now - t0 < ms + 2500) requestAnimationFrame(frame); else cv.remove();
  };
  requestAnimationFrame(frame);
}

// ===================================================== อีโมจิลอยขึ้น (รีแอ็กชัน)
export function floatEmoji(ch, label = '', x = rnd(0.08, 0.92)) {
  const e = document.createElement('div'); e.className = 'floaty';
  e.style.cssText = `left:${x * 100}%;--dx:${rnd(-80, 80)}px;--r:${rnd(-25, 25)}deg;--dur:${rnd(2.6, 3.8).toFixed(2)}s`;
  e.innerHTML = `<b>${ch}</b>${label ? `<small>${label}</small>` : ''}`;
  document.body.appendChild(e); setTimeout(() => e.remove(), 4000);
}

// ===================================================== มาสคอตโผล่มุมจอพร้อมคำพูด
export function peek(mascotSVG, text, mood = 'happy', ms = 3800) {
  document.querySelector('.peek')?.remove();
  const p = document.createElement('div'); p.className = 'peek ' + mood;
  p.innerHTML = `<div class="bubble">${text}</div><div class="pm">${mascotSVG}</div>`;
  document.body.appendChild(p);
  setTimeout(() => p.classList.add('bye'), ms); setTimeout(() => p.remove(), ms + 700);
}

// ===================================================== FLIP: เลื่อนแถวจากตำแหน่งเดิม
export function flipRows(rows, prevIndex, rowH) {
  if (REDUCED) return;
  rows.forEach((el, i) => {
    const from = prevIndex(i); if (from == null || from === i) return;
    el.style.transition = 'none'; el.style.transform = `translateY(${(from - i) * rowH}px)`;
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = 'transform 1s cubic-bezier(.34,1.3,.64,1) .5s'; el.style.transform = ''; }));
  });
}
