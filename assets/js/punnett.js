// ตารางพันนิตต์อัตโนมัติ — พิมพ์ "Bb x bb | ขนเทา | ขนขาว" (ลักษณะเด่น | ลักษณะด้อย ไม่บังคับ)
// รองรับ 1 ยีน (2×2) และ 2 ยีน (4×4) เช่น "AaBb x AaBb"
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function parsePunnett(src) {
  if (!src || !String(src).trim()) return null;
  const [cross, dom, rec] = String(src).split('|').map((x) => x.trim());
  const m = cross.split(/\s*[x×X*]\s*/).filter(Boolean);
  if (m.length !== 2) return { error: 'ใช้รูปแบบ  Bb x bb' };
  const pairs = (g) => {
    if (!/^[A-Za-z]+$/.test(g) || g.length % 2) return null;
    const out = [];
    for (let i = 0; i < g.length; i += 2) { if (g[i].toLowerCase() !== g[i + 1].toLowerCase()) return null; out.push([g[i], g[i + 1]]); }
    return out;
  };
  const a = pairs(m[0]), b = pairs(m[1]);
  if (!a || !b) return { error: 'จีโนไทป์ต้องเป็นคู่ เช่น BB, Bb, bb' };
  if (a.length !== b.length || a.length > 2) return { error: 'รองรับ 1–2 ยีน และพ่อแม่ต้องมีจำนวนยีนเท่ากัน' };
  if (a.some((p, i) => p[0].toLowerCase() !== b[i][0].toLowerCase())) return { error: 'พ่อแม่ต้องใช้ตัวอักษรยีนเดียวกัน' };
  const gam = (ps) => ps.reduce((acc, p) => acc.flatMap((x) => p.map((al) => x + al)), ['']);
  const g1 = gam(a), g2 = gam(b);
  const sortPair = (x, y) => (x === x.toUpperCase() && y !== y.toUpperCase() ? x + y : y === y.toUpperCase() && x !== x.toUpperCase() ? y + x : x + y);
  const cells = g2.map((r) => g1.map((c) => {
    let geno = '', key = '';
    for (let k = 0; k < c.length; k++) { const gg = sortPair(c[k], r[k]); geno += gg; key += /[A-Z]/.test(gg) ? 'D' : 'r'; }
    return { geno, key };
  }));
  return { p1: m[0], p2: m[1], g1, g2, cells, n: a.length, dom: dom || '', rec: rec || '' };
}

const KEY_CLASS = { D: 'pd', r: 'pr', DD: 'pd', Dr: 'pd2', rD: 'pr2', rr: 'pr' };
export function phenoName(P, key) {
  if (P.n === 1) return key === 'D' ? P.dom || 'ลักษณะเด่น' : P.rec || 'ลักษณะด้อย';
  return key.split('').map((k, i) => `${k === 'D' ? 'เด่น' : 'ด้อย'}`).join('–');
}

/** HTML ตาราง (ช่องว่างตอนถาม / เติมตอนเฉลย) */
export function punnettHTML(P, { filled = false, compact = false } = {}) {
  if (!P || P.error) return '';
  const N = P.g1.length;
  const cell = (c, i) => `<td class="pc ${KEY_CLASS[c.key]} ${filled ? 'fill' : ''}" style="--i:${i}"><b>${esc(c.geno)}</b></td>`;
  let k = 0;
  return `<div class="pun ${compact ? 'compact' : ''} n${N}">
    <div class="pun-title"><span>${esc(P.p1)}</span><i>×</i><span>${esc(P.p2)}</span></div>
    <table><tr><th class="corner"><small>♀\\♂</small></th>${P.g1.map((g) => `<th class="gm">${esc(g)}</th>`).join('')}</tr>
    ${P.g2.map((r, ri) => `<tr><th class="gm">${esc(r)}</th>${P.cells[ri].map((c) => cell(c, k++)).join('')}</tr>`).join('')}</table>
    ${filled ? summaryHTML(P) : ''}</div>`;
}

export function summaryHTML(P) {
  const ph = {}, ge = {}, total = P.cells.flat().length;
  P.cells.flat().forEach((c) => { ph[c.key] = (ph[c.key] || 0) + 1; ge[c.geno] = (ge[c.geno] || 0) + 1; });
  const order = Object.keys(ph).sort((a, b) => (a < b ? -1 : 1));
  const g = Object.entries(ge).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return `<div class="pun-sum" style="--n:${total}">
    <div>${order.map((k) => `<span class="ps ${KEY_CLASS[k]}"><i></i>${esc(phenoName(P, k))} ${ph[k]}/${total} <em>(${Math.round((ph[k] / total) * 100)}%)</em></span>`).join('')}</div>
    <small>จีโนไทป์ ${g.map(([k, v]) => `${esc(k)} ${v}`).join(' : ')}</small></div>`;
}
