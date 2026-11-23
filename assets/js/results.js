// สรุปผลรายห้อง: ภาพรวม · อัตราตอบถูกรายข้อ · ตารางรายคน (✓/✗ ทุกข้อ) · ส่งออก CSV
import { call, DEMO } from './api.js';
import { $, $$, esc, MASCOT, toast } from './ui.js';
import { backdrop, countUp } from './fx.js';
backdrop('class');

let KEY = sessionStorage.getItem('cqh:key') || '';
let D = null;
$('#lgMascot').innerHTML = MASCOT;

$('#login').addEventListener('submit', (e) => { e.preventDefault(); KEY = $('#iKey').value.trim(); load(); });
$('#bReload').onclick = () => load();
$('#bPrint').onclick = () => window.print();
$('#bCsv').onclick = csv;
$('#selRoom').onchange = () => render();

async function load() {
  if (!DEMO && !KEY) { $('#login').hidden = false; return; }
  try {
    D = await call('results', { key: KEY });
    try { sessionStorage.setItem('cqh:key', KEY); } catch (e) {}
    $('#login').hidden = true; $('#rp').hidden = false;
    fillRooms(); render();
  } catch (e) { $('#login').hidden = false; toast(e.message); }
}

// answers: [วันเวลา, pin, ชื่อกิจกรรม, ข้อ, คำถาม, ชื่อ, คำตอบ, ผล, เวลา, คะแนนที่ได้, คะแนนสะสม]
// players: [วันเวลา, pin, ชื่อกิจกรรม, อันดับ, ชื่อ, คะแนน, ถูก, จำนวนข้อ, ร้อยละ]
function rooms() {
  const m = new Map();
  D.answers.forEach((r) => { const k = r[1] + '|' + r[2]; if (!m.has(k)) m.set(k, { pin: r[1], title: r[2], t: r[0] }); });
  D.players.forEach((r) => { const k = r[1] + '|' + r[2]; if (!m.has(k)) m.set(k, { pin: r[1], title: r[2], t: r[0] }); });
  return [...m.values()].sort((a, b) => String(b.t).localeCompare(String(a.t)));
}
function fillRooms() {
  const want = new URLSearchParams(location.search).get('pin'), cur = $('#selRoom').value, R = rooms();
  $('#selRoom').innerHTML = R.length ? R.map((r) => `<option value="${esc(r.pin + '|' + r.title)}">${esc(String(r.t).slice(0, 16))} · ห้อง ${esc(r.pin)} · ${esc(r.title)}</option>`).join('')
    : '<option value="">ยังไม่มีข้อมูล</option>';
  const pick = R.find((r) => r.pin + '|' + r.title === cur) || R.find((r) => r.pin === want) || R[0];
  if (pick) $('#selRoom').value = pick.pin + '|' + pick.title;
}

function compute() {
  const [pin, title] = ($('#selRoom').value || '|').split('|');
  const A = D.answers.filter((r) => r[1] === pin && r[2] === title);
  const qn = [...new Set(A.map((r) => Number(r[3])))].sort((a, b) => a - b);
  const qText = {}; A.forEach((r) => (qText[r[3]] = r[4]));
  const names = [...new Set(A.map((r) => r[5]))];
  const final = D.players.filter((r) => r[1] === pin && r[2] === title);
  const people = names.map((n) => {
    const rows = A.filter((r) => r[5] === n), by = {};
    rows.forEach((r) => (by[r[3]] = r));
    const correct = rows.filter((r) => r[7] === 'ถูก').length;
    const score = Math.max(0, ...rows.map((r) => Number(r[10]) || 0));
    const fr = final.find((r) => r[4] === n);
    const times = rows.filter((r) => r[8] !== '').map((r) => Number(r[8]));
    const full = (rows.find((x) => x[11]) || [])[11] || (fr ? fr[9] || '' : '');
    return { n, full, by, correct, score: fr ? Number(fr[5]) : score, rank: fr ? Number(fr[3]) : 0, avgT: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null };
  }).sort((a, b) => b.score - a.score || b.correct - a.correct);
  people.forEach((p, i) => { if (!p.rank) p.rank = i + 1; });
  const qs = qn.map((q) => {
    const rows = A.filter((r) => Number(r[3]) === q), ok = rows.filter((r) => r[7] === 'ถูก').length;
    const wrong = {}; rows.filter((r) => r[7] !== 'ถูก').forEach((r) => (wrong[r[6]] = (wrong[r[6]] || 0) + 1));
    const top = Object.entries(wrong).sort((a, b) => b[1] - a[1])[0];
    return { q, text: qText[q], n: rows.length, ok, rate: rows.length ? ok / rows.length : 0, wrongTop: top };
  });
  return { pin, title, qn, qs, people, total: qn.length, finished: final.length > 0 };
}

function tone(r) { return r >= 0.8 ? 'good' : r >= 0.5 ? 'mid' : 'low'; }
const MEDAL = ['🥇', '🥈', '🥉'];
function ring(p, col) {
  const C = 2 * Math.PI * 26;
  return `<svg class="ring" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" class="rb"/><circle cx="32" cy="32" r="26" class="rf" style="stroke:${col};stroke-dasharray:${C};stroke-dashoffset:${C * (1 - p)}"/></svg>`;
}
function render() {
  if (!D || !$('#selRoom').value) { $('#out').innerHTML = `<div class="rc empty-rc"><div class="mj-m" style="width:110px;margin:auto">${MASCOT}</div><p>ยังไม่มีผลการเล่น — เมื่อเฉลยข้อแรกแล้ว ข้อมูลจะขึ้นที่นี่</p></div>`; return; }
  const s = compute(), P = s.people, N = P.length;
  const avg = N ? P.reduce((a, p) => a + p.correct, 0) / N : 0, avgP = s.total ? avg / s.total : 0;
  const pass = P.filter((p) => s.total && p.correct / s.total >= 0.5).length;
  const hardList = s.qs.slice().sort((a, b) => a.rate - b.rate).filter((q) => q.rate < 0.6).slice(0, 3);
  const hard = s.qs.slice().sort((a, b) => a.rate - b.rate)[0];
  const strong = s.qs.filter((q) => q.rate >= 0.8).length;
  const date = (D.answers.find((r) => r[1] === s.pin && r[2] === s.title) || [''])[0];
  $('#out').innerHTML = `
    <section class="rp-hero">
      <div class="rp-hero-m">${MASCOT}</div>
      <div class="rp-hero-t"><small>สรุปผลการเรียนรู้ · ห้อง ${esc(s.pin)}${date ? ' · ' + esc(String(date).slice(0, 16)) : ''}</small>
        <h1>${esc(s.title)}</h1>
        <p>${s.finished ? '✅ เล่นจบแล้ว' : '⏳ ยังเล่นไม่จบ'} · ${s.total} ข้อ · นักเรียน ${N} คน</p></div>
      <div class="rp-hero-score">${ring(avgP, '#fff')}<b>${Math.round(avgP * 100)}%</b><small>ตอบถูกเฉลี่ย</small></div>
    </section>
    <div class="kp2">
      <div class="k"><i style="--kc:#7B61FF">👥</i><div><b data-n="${N}">0</b><small>นักเรียนที่ร่วมเล่น</small></div></div>
      <div class="k"><i style="--kc:#2EC4B6">🎯</i><div><b>${avg.toFixed(1)}<em>/${s.total}</em></b><small>ข้อที่ตอบถูกเฉลี่ย</small></div></div>
      <div class="k"><i style="--kc:#22B07D">✅</i><div><b data-n="${pass}">0</b><em class="sub">${N ? Math.round((pass / N) * 100) : 0}% ของห้อง</em><small>ผ่านเกณฑ์ (ถูก ≥ 50%)</small></div></div>
      <div class="k"><i style="--kc:#FF6B6B">🧩</i><div><b>${hard ? 'ข้อ ' + hard.q : '-'}</b><em class="sub">${hard ? `ตอบถูก ${Math.round(hard.rate * 100)}%` : ''}</em><small>ข้อที่ยากที่สุด</small></div></div>
    </div>
    <div class="rp-grid">
      <section class="rc"><h2><span>📈</span>อัตราการตอบถูกรายข้อ</h2>
        <div class="qrows">${s.qs.map((q, i) => `
          <div class="qrow ${tone(q.rate)}" style="--d:${i * 0.05}s">
            <span class="qn">${q.q}</span>
            <div class="qt">${esc(q.text)}${q.wrongTop && q.rate < 0.8 ? `<small>คำตอบผิดที่พบบ่อย: <b>${esc(q.wrongTop[0])}</b> (${q.wrongTop[1]} คน)</small>` : ''}</div>
            <div class="qbar"><i style="--w:${q.rate * 100}%"></i></div>
            <span class="qp">${Math.round(q.rate * 100)}%<small>${q.ok}/${q.n}</small></span>
          </div>`).join('')}</div>
        <p class="legend"><span class="good">● ≥ 80% เข้าใจดี</span><span class="mid">● 50–79% พอใช้</span><span class="low">● &lt; 50% ควรทบทวน</span></p>
      </section>
      <aside class="rc tips"><h2><span>💡</span>สิ่งที่ควรสอนซ้ำ</h2>
        ${hardList.length ? hardList.map((q) => `<div class="tip"><b>ข้อ ${q.q}</b> · ตอบถูก ${Math.round(q.rate * 100)}%<p>${esc(q.text)}</p>${q.wrongTop ? `<small>นักเรียนมักตอบ “${esc(q.wrongTop[0])}”</small>` : ''}</div>`).join('')
          : '<div class="tip ok"><b>เยี่ยมมาก!</b><p>ทุกข้อมีนักเรียนตอบถูกตั้งแต่ 60% ขึ้นไป</p></div>'}
        <div class="tip strong"><b>จุดแข็งของห้อง</b><p>${strong} จาก ${s.total} ข้อ ที่นักเรียนตอบถูกตั้งแต่ 80% ขึ้นไป</p></div>
      </aside>
    </div>
    <section class="rc"><h2><span>🧑‍🎓</span>ผลรายบุคคล</h2><div class="scroll"><table class="tb">
      <thead><tr><th>อันดับ</th><th class="l">ชื่อ-สกุล (ชื่อเล่น)</th><th>คะแนน</th><th class="l">ตอบถูก</th>${s.qn.map((q) => `<th>${q}</th>`).join('')}<th>เวลาเฉลี่ย</th></tr></thead>
      <tbody>${P.map((p) => { const pc = s.total ? p.correct / s.total : 0; return `<tr>
        <td><span class="rk r${p.rank}">${MEDAL[p.rank - 1] || p.rank}</span></td><td class="l nm">${esc(p.full || p.n)}${p.full ? `<small class="nk">${esc(p.n)}</small>` : ''}</td><td class="sc">${p.score.toLocaleString()}</td>
        <td class="l"><div class="minibar ${tone(pc)}"><i style="width:${pc * 100}%"></i></div><span class="mt">${p.correct}/${s.total}</span></td>
        ${s.qn.map((q) => { const r = p.by[q], ok = r && r[7] === 'ถูก', none = !r || r[6] === '(ไม่ได้ตอบ)'; return `<td><span class="dot ${ok ? 'y' : none ? 'z' : 'n'}" title="${esc(r ? r[6] : 'ไม่ได้ตอบ')}">${ok ? '✓' : none ? '–' : '✕'}</span></td>`; }).join('')}
        <td class="tm">${p.avgT == null ? '-' : p.avgT.toFixed(1) + ' วิ'}</td></tr>`; }).join('')}</tbody>
    </table></div><p class="legend"><span class="good">✓ ถูก</span><span class="low">✕ ผิด</span><span>– ไม่ได้ตอบ</span><span>· ชี้ที่วงกลมเพื่อดูคำตอบที่เลือก</span></p></section>`;
  $$('.kp2 [data-n]').forEach((e) => countUp(e, 0, +e.dataset.n, 900));
}

function csv() {
  if (!D) return;
  const s = compute(), q = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
  const head = ['อันดับ', 'ชื่อ-สกุล', 'ชื่อเล่น', 'คะแนน', 'ตอบถูก', 'จำนวนข้อ', 'ร้อยละ'].concat(s.qn.map((n) => 'ข้อ ' + n));
  const rows = s.people.map((p) => [p.rank, p.full, p.n, p.score, p.correct, s.total, s.total ? Math.round((p.correct / s.total) * 100) : 0]
    .concat(s.qn.map((n) => (p.by[n] ? p.by[n][7] : 'ไม่ได้ตอบ'))));
  const txt = '﻿' + [head].concat(rows).map((r) => r.map(q).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
  a.download = `ผลคะแนน-ห้อง${s.pin}.csv`; a.click();
}

load();
