// สรุปผลรายห้อง: ภาพรวม · อัตราตอบถูกรายข้อ · ตารางรายคน (✓/✗ ทุกข้อ) · ส่งออก CSV
import { call, DEMO } from './api.js';
import { $, esc, MASCOT, toast } from './ui.js';

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
    return { n, by, correct, score: fr ? Number(fr[5]) : score, rank: fr ? Number(fr[3]) : 0, avgT: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null };
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

function color(r) { return r >= 0.8 ? 'var(--c2)' : r >= 0.5 ? 'var(--c1)' : 'var(--c0)'; }
function render() {
  if (!D || !$('#selRoom').value) { $('#out').innerHTML = `<div class="card sec center"><div class="hero-mascot" style="width:100px;margin:auto">${MASCOT}</div><p>ยังไม่มีผลการเล่น — เมื่อเฉลยข้อแรกแล้ว ข้อมูลจะขึ้นที่นี่</p></div>`; return; }
  const s = compute(), P = s.people, N = P.length;
  const avg = N ? P.reduce((a, p) => a + p.correct, 0) / N : 0;
  const hard = s.qs.slice().sort((a, b) => a.rate - b.rate)[0];
  const pass = P.filter((p) => s.total && p.correct / s.total >= 0.5).length;
  $('#out').innerHTML = `
    <h1 style="margin:0 0 14px;font-size:28px">${esc(s.title)} <span class="chip">ห้อง ${esc(s.pin)}</span> ${s.finished ? '' : '<span class="chip" style="background:#FFE3E3">ยังเล่นไม่จบ</span>'}</h1>
    <div class="kp">
      <div class="card"><small>นักเรียน</small><b>${N} คน</b></div>
      <div class="card"><small>ตอบถูกเฉลี่ย</small><b>${avg.toFixed(1)} / ${s.total}</b></div>
      <div class="card"><small>ผ่านเกณฑ์ (ถูก ≥ 50%)</small><b>${pass} คน</b><small>${N ? Math.round((pass / N) * 100) : 0}% ของห้อง</small></div>
      <div class="card"><small>ข้อที่ยากที่สุด</small><b>${hard ? 'ข้อ ' + hard.q : '-'}</b><small>${hard ? `ตอบถูก ${Math.round(hard.rate * 100)}%` : ''}</small></div>
    </div>
    <section class="card sec"><h2>อัตราการตอบถูกรายข้อ</h2><div class="qbars">${s.qs.map((q) => `
      <div class="qb"><span class="no">${q.q}</span><span class="t">${esc(q.text)}${q.wrongTop && q.rate < 0.8 ? `<br><small class="muted">คำตอบผิดที่พบบ่อย: ${esc(q.wrongTop[0])} (${q.wrongTop[1]} คน)</small>` : ''}</span>
        <span class="track"><i style="width:${q.rate * 100}%;background:${color(q.rate)}"></i><span>${q.ok}/${q.n} · ${Math.round(q.rate * 100)}%</span></span></div>`).join('')}</div></section>
    <section class="card sec"><h2>ผลรายบุคคล</h2><div class="scroll"><table class="tbl">
      <tr><th>อันดับ</th><th class="l">ชื่อ</th><th>คะแนน</th><th>ถูก</th><th>ร้อยละ</th>${s.qn.map((q) => `<th>ข้อ ${q}</th>`).join('')}<th>เวลาเฉลี่ย (วิ)</th></tr>
      ${P.map((p) => `<tr><td>${p.rank}</td><td class="l">${esc(p.n)}</td><td>${p.score.toLocaleString()}</td><td>${p.correct}/${s.total}</td>
        <td>${s.total ? Math.round((p.correct / s.total) * 100) : 0}%</td>
        ${s.qn.map((q) => { const r = p.by[q]; return `<td class="${r && r[7] === 'ถูก' ? 'y' : 'n'}" title="${esc(r ? r[6] : 'ไม่ได้ตอบ')}">${r ? (r[7] === 'ถูก' ? '✓' : r[6] === '(ไม่ได้ตอบ)' ? '–' : '✗') : '–'}</td>`; }).join('')}
        <td>${p.avgT == null ? '-' : p.avgT.toFixed(1)}</td></tr>`).join('')}
    </table></div><p class="muted sarabun" style="font-size:13px;margin:8px 0 0">✓ ถูก · ✗ ผิด · – ไม่ได้ตอบ (ชี้ที่เครื่องหมายเพื่อดูคำตอบที่เลือก)</p></section>`;
}

function csv() {
  if (!D) return;
  const s = compute(), q = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
  const head = ['อันดับ', 'ชื่อ', 'คะแนน', 'ตอบถูก', 'จำนวนข้อ', 'ร้อยละ'].concat(s.qn.map((n) => 'ข้อ ' + n));
  const rows = s.people.map((p) => [p.rank, p.n, p.score, p.correct, s.total, s.total ? Math.round((p.correct / s.total) * 100) : 0]
    .concat(s.qn.map((n) => (p.by[n] ? p.by[n][7] : 'ไม่ได้ตอบ'))));
  const txt = '﻿' + [head].concat(rows).map((r) => r.map(q).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
  a.download = `ผลคะแนน-ห้อง${s.pin}.csv`; a.click();
}

load();
