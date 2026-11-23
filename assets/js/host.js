// จอครู: ตั้งค่าข้อคำถาม → ห้องรอ (PIN + QR) → คำถาม → เฉลย → อันดับ → โพเดียม
import { call, DEMO } from './api.js';
import { $, $$, esc, shape, avatar, MASCOT, confetti, toast, sound, music, sleep } from './ui.js';
import { SAMPLE } from './sample.js';

const view = $('#view');
const CFG = window.CQ_CONFIG || {};
$('#brandName').textContent = CFG.APP_NAME || 'ห้องเรียนผจญภัย';
const LSget = (k, d) => { try { const v = localStorage.getItem('cqh:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const LSset = (k, v) => { try { localStorage.setItem('cqh:' + k, JSON.stringify(v)); } catch (e) {} };
const SSget = (k) => { try { return sessionStorage.getItem('cqh:' + k) || ''; } catch (e) { return ''; } };
const SSset = (k, v) => { try { v ? sessionStorage.setItem('cqh:' + k, v) : sessionStorage.removeItem('cqh:' + k); } catch (e) {} };
const clone = (o) => JSON.parse(JSON.stringify(o));

let SET = LSget('set', null) || clone(SAMPLE);
let KEY = SSget('key');
let PIN = SSget('pin');
let G = null, lastKey = '', pollT = null, timerT = null, deadline = 0, busy = false, revealing = false;
const POLL = DEMO ? 400 : 1000;

if (DEMO) { const d = document.createElement('div'); d.className = 'demo-badge'; d.textContent = 'โหมดทดลอง · เปิด index.html อีกแท็บเพื่อเป็นนักเรียน'; document.body.appendChild(d); }

// ===================================================== ตั้งค่าข้อคำถาม
const TIMES = [5, 10, 15, 20, 30, 45, 60, 90];
const save = () => LSset('set', SET);
const estMin = () => Math.max(1, Math.round(SET.questions.reduce((a, q) => a + (Number(q.t) || 20) + 20, 0) / 60));

function showSetup() {
  stopPoll(); music.stop(); $('#phaseChip').hidden = true;
  view.innerHTML = `
  <div class="setup">
    <aside class="card side">
      <div class="hero-mascot">${MASCOT}</div>
      <h1>เตรียมภารกิจ<br>ของห้องเรียน</h1>
      <div><label class="label" for="iTitle">ชื่อกิจกรรม</label>
        <input class="input" id="iTitle" maxlength="80" value="${esc(SET.title)}" style="font-size:17px"></div>
      <p class="chip" id="sum"></p>
      ${DEMO ? '' : `<div><label class="label" for="iKey">รหัสครู (HOST_KEY)</label><input class="input" id="iKey" type="password" value="${esc(KEY)}" style="font-size:17px" autocomplete="current-password"></div>`}
      <button class="btn go big" id="bCreate">สร้างห้องเกม 🚀</button>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn sm" id="bImport">📋 วางจาก Excel</button>
        <button class="btn sm" id="bSample">ชุดตัวอย่าง</button>
        <button class="btn sm ghost" id="bClear">ล้างทั้งหมด</button>
      </div>
      <p class="muted sarabun" style="font-size:14px;margin:0">ระหว่างเล่นกด <b>Space</b> หรือปุ่มเลื่อนสไลด์ (รีโมต) เพื่อไปขั้นต่อไป · <b>F</b> เต็มจอ · <b>M</b> ปิดเสียง</p>
    </aside>
    <section>
      <div class="qlist" id="qlist"></div>
      <div class="add-q" id="bAdd" style="margin-top:16px">＋ เพิ่มคำถาม</div>
    </section>
  </div>`;
  renderList();
  $('#iTitle').addEventListener('input', (e) => { SET.title = e.target.value; save(); });
  $('#bAdd').onclick = () => { SET.questions.push({ q: '', c: ['', '', '', ''], a: 0, t: 20, x: '' }); save(); renderList(); $('#qlist').lastElementChild.querySelector('textarea').focus(); };
  $('#bSample').onclick = () => { if (confirm('แทนที่ข้อคำถามทั้งหมดด้วยชุดตัวอย่าง?')) { SET = clone(SAMPLE); save(); showSetup(); } };
  $('#bClear').onclick = () => { if (confirm('ลบข้อคำถามทั้งหมด?')) { SET.questions = [{ q: '', c: ['', '', '', ''], a: 0, t: 20, x: '' }]; save(); renderList(); } };
  $('#bImport').onclick = () => { $('#mImport').hidden = false; $('#taImport').focus(); };
  $('#bCreate').onclick = createRoom;
}

function renderList() {
  $('#sum').textContent = `${SET.questions.length} ข้อ · ใช้เวลาประมาณ ${estMin()} นาที`;
  $('#qlist').innerHTML = SET.questions.map((q, i) => {
    const tf = q.c.length === 2;
    return `<article class="card qed" data-i="${i}">
      <div class="qed-head"><span class="qed-no">${i + 1}</span>
        <select data-k="type" title="ชนิดคำถาม"><option value="4" ${tf ? '' : 'selected'}>4 ตัวเลือก</option><option value="2" ${tf ? 'selected' : ''}>ถูก / ผิด</option></select>
        <select data-k="t" title="เวลา">${TIMES.map((t) => `<option value="${t}" ${Number(q.t) === t ? 'selected' : ''}>⏱ ${t} วินาที</option>`).join('')}</select>
        <span class="sp"></span>
        <button class="mini" data-act="up" title="เลื่อนขึ้น">▲</button><button class="mini" data-act="down" title="เลื่อนลง">▼</button>
        <button class="mini" data-act="dup" title="ทำซ้ำ">⧉</button><button class="mini" data-act="del" title="ลบ">✕</button>
      </div>
      <textarea data-k="q" rows="2" placeholder="พิมพ์คำถาม…">${esc(q.q)}</textarea>
      <div class="opts">${q.c.map((c, j) => `<div class="opt o${j} ${q.a === j ? 'right' : ''}"><span class="sw">${shape(j)}</span>
        <input type="text" data-k="c" data-j="${j}" value="${esc(c)}" placeholder="ตัวเลือกที่ ${j + 1}" ${tf ? 'readonly' : ''}>
        <label><input type="radio" name="a${i}" data-k="a" value="${j}" ${q.a === j ? 'checked' : ''}>ถูก</label></div>`).join('')}</div>
      <input class="x" data-k="x" value="${esc(q.x || '')}" placeholder="💡 คำอธิบายหลังเฉลย (ไม่บังคับ) — ขึ้นจอและมือถือนักเรียน">
    </article>`;
  }).join('');
}

// แก้ไขแบบ delegation (ไม่ต้อง render ใหม่ทุกตัวอักษร)
document.addEventListener('input', (e) => {
  const card = e.target.closest('.qed'); if (!card) return;
  const q = SET.questions[+card.dataset.i], k = e.target.dataset.k;
  if (k === 'q') q.q = e.target.value;
  if (k === 'x') q.x = e.target.value;
  if (k === 'c') q.c[+e.target.dataset.j] = e.target.value;
  save();
});
document.addEventListener('change', (e) => {
  const card = e.target.closest('.qed'); if (!card) return;
  const q = SET.questions[+card.dataset.i], k = e.target.dataset.k;
  if (k === 't') q.t = Number(e.target.value);
  if (k === 'a') { q.a = Number(e.target.value); $$('.opt', card).forEach((o, j) => o.classList.toggle('right', j === q.a)); }
  if (k === 'type') {
    if (e.target.value === '2') { q._keep = q.c.slice(); q.c = ['ถูก', 'ผิด']; q.a = Math.min(q.a, 1); }
    else { q.c = q._keep && q._keep.length === 4 ? q._keep : ['', '', '', '']; q.a = 0; }
    renderList();
  }
  save(); if ($('#sum')) $('#sum').textContent = `${SET.questions.length} ข้อ · ใช้เวลาประมาณ ${estMin()} นาที`;
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const i = +b.closest('.qed').dataset.i, L = SET.questions;
  if (b.dataset.act === 'up' && i > 0) [L[i - 1], L[i]] = [L[i], L[i - 1]];
  if (b.dataset.act === 'down' && i < L.length - 1) [L[i + 1], L[i]] = [L[i], L[i + 1]];
  if (b.dataset.act === 'dup') L.splice(i + 1, 0, clone(L[i]));
  if (b.dataset.act === 'del') { if (L.length === 1) return toast('ต้องมีอย่างน้อย 1 ข้อ'); if (!confirm(`ลบข้อ ${i + 1}?`)) return; L.splice(i, 1); }
  save(); renderList();
});

// วางจาก Excel
function parseTSV(txt) {
  return txt.split(/\r?\n/).map((l) => l.split('\t').map((x) => x.trim())).filter((r) => r[0]).map((r) => {
    const choices = r.slice(1, 5).filter((x) => x);
    let a = parseInt(r[5], 10);
    if (!(a >= 1)) { const k = choices.findIndex((c) => c === r[5]); a = k >= 0 ? k + 1 : 1; }
    return { q: r[0], c: choices.length >= 2 ? choices : ['ถูก', 'ผิด'], a: Math.min(a, Math.max(choices.length, 2)) - 1, t: TIMES.includes(+r[6]) ? +r[6] : 20, x: r[7] || '' };
  });
}
const closeImp = () => { $('#mImport').hidden = true; $('#taImport').value = ''; };
$('#bImpCancel').onclick = closeImp;
['bImpAppend', 'bImpReplace'].forEach((id) => ($('#' + id).onclick = () => {
  const qs = parseTSV($('#taImport').value);
  if (!qs.length) return toast('ไม่พบข้อมูล — คัดลอกจากตารางแล้ววางอีกครั้ง');
  SET.questions = id === 'bImpReplace' ? qs : SET.questions.filter((q) => q.q.trim()).concat(qs);
  save(); closeImp(); showSetup(); toast(`นำเข้า ${qs.length} ข้อแล้ว`);
}));

async function createRoom() {
  try { window.CQ.cleanQuestions(SET.questions); } catch (e) {
    toast(e.message);
    const m = e.message.match(/ข้อ (\d+)/); if (m) { const c = $(`.qed[data-i="${m[1] - 1}"]`); c && c.scrollIntoView({ behavior: 'smooth', block: 'center' }); c && (c.style.animation = 'shake .5s'); }
    return;
  }
  if (!DEMO) { KEY = $('#iKey').value.trim(); if (!KEY) return toast('ใส่รหัสครูก่อน'); }
  sound.unlock();
  const b = $('#bCreate'); b.disabled = true; b.textContent = 'กำลังสร้างห้อง…';
  try {
    if (!DEMO) { await call('check', { key: KEY }); SSset('key', KEY); }
    const r = await call('create', { key: KEY, title: SET.title, questions: SET.questions.map(({ q, c, a, t, x }) => ({ q, c, a, t, x })) });
    PIN = r.pin; SSset('pin', PIN); lastKey = ''; startPoll();
  } catch (e) { toast(e.message); b.disabled = false; b.textContent = 'สร้างห้องเกม 🚀'; }
}

// ===================================================== เกม
function startPoll() { stopPoll(); poll(); }
function stopPoll() { clearTimeout(pollT); pollT = null; }
async function poll() {
  try { render(await call('hpoll', { key: KEY, pin: PIN })); }
  catch (e) { if (/ไม่พบห้อง|รหัสครู/.test(e.message)) { toast(e.message); SSset('pin', ''); PIN = ''; return showSetup(); } }
  if (G && G.phase === 'end') return;
  pollT = setTimeout(poll, POLL);
}
async function act(action) {
  if (busy) return; busy = true;
  try { render(await call(action, { key: KEY, pin: PIN })); }
  catch (e) { toast(e.message); }
  finally { busy = false; }
}
const joinUrl = () => new URL('index.html', location.href).href.replace(/\/index\.html$/, '/') ;

function render(g) {
  G = g;
  const key = g.phase + ':' + g.idx;
  const chip = $('#phaseChip'); chip.hidden = false; chip.textContent = `ห้อง ${g.pin}`;
  if (key !== lastKey) {
    lastKey = key; clearInterval(timerT); revealing = false;
    ({ lobby: vLobby, question: vQuestion, reveal: vReveal, board: vBoard, end: vEnd })[g.phase](g);
  } else live(g);
}
function live(g) {
  if (g.phase === 'lobby') updatePeople(g);
  if (g.phase === 'question') {
    $('#nAns').textContent = g.answered; $('#nAll').textContent = g.players.length;
    if (g.players.length && g.answered >= g.players.length && !revealing) { revealing = true; setTimeout(() => doReveal(), 700); }
  }
}

function vLobby(g) {
  music.start();
  const url = joinUrl(), link = url + '?pin=' + g.pin;
  view.innerHTML = `<div class="lobby">
    <div class="card joinbox rise"><span class="tape"></span>
      <p style="margin:0;font-size:22px">สแกน QR หรือเข้าเว็บ</p>
      <div class="url"><b>${esc(url.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</b></div>
      <div class="qr" id="qr"></div>
      <p style="margin:0;font-size:20px">แล้วใส่รหัสห้อง</p>
      <div class="pin-big">${g.pin}</div>
    </div>
    <div class="card crowd rise">
      <div class="crowd-head"><div><div style="font-size:18px" class="muted">${esc(g.title)} · ${g.total} ข้อ</div>
        <div><span class="count" id="nPeople">0</span> <span style="font-size:22px">คนพร้อมแล้ว</span></div></div>
        <button class="btn hot big" id="bGo">เริ่มเกม ▶</button></div>
      <div class="people" id="people"></div>
      <p class="muted sarabun" style="margin:0;font-size:14px">คลิกที่ชื่อเพื่อนำออกจากห้อง · กด Space เพื่อเริ่ม</p>
    </div></div>`;
  drawQR(link);
  $('#bGo').onclick = startGame;
  updatePeople(g);
}
function drawQR(link) {
  const box = $('#qr');
  const tryDraw = (n) => {
    if (window.qrcode) { const q = window.qrcode(0, 'M'); q.addData(link); q.make(); box.innerHTML = q.createSvgTag({ cellSize: 8, margin: 0, scalable: true }); }
    else if (n < 20) setTimeout(() => tryDraw(n + 1), 250);
    else box.innerHTML = `<p class="sarabun" style="font-size:15px;word-break:break-all">${esc(link)}</p>`;
  };
  tryDraw(0);
}
let shown = new Set();
function updatePeople(g) {
  const box = $('#people'); if (!box) return;
  $('#nPeople').textContent = g.players.length;
  const ids = new Set(g.players.map((p) => p.pid));
  [...box.children].forEach((el) => { if (!ids.has(el.dataset.pid)) el.remove(); });
  g.players.forEach((p) => {
    if (box.querySelector(`[data-pid="${p.pid}"]`)) return;
    const el = document.createElement('span'); el.className = 'person'; el.dataset.pid = p.pid;
    el.style.setProperty('--rot', (Math.random() * 6 - 3).toFixed(1) + 'deg');
    el.innerHTML = `<span class="av">${avatar(p.av)}</span>${esc(p.name)}`;
    el.title = 'คลิกเพื่อนำออก';
    el.onclick = async () => { if (confirm(`นำ "${p.name}" ออกจากห้อง?`)) { await call('kick', { key: KEY, pin: PIN, pid: p.pid }); } };
    box.appendChild(el);
    if (!shown.has(p.pid)) { shown.add(p.pid); sound.pop(); }
  });
  if (!g.players.length && !box.querySelector('.empty')) box.innerHTML = `<div class="empty"><div class="hero-mascot">${MASCOT}</div>รอเพื่อน ๆ เข้าห้อง…</div>`;
  else if (g.players.length) box.querySelector('.empty')?.remove();
}
function startGame() {
  if (!G.players.length && !confirm('ยังไม่มีนักเรียนในห้อง เริ่มเลยไหม?')) return;
  act('next');
}

function vQuestion(g) {
  music.start(true);
  const q = g.q, two = q.c.length === 2;
  deadline = performance.now() + g.left;
  const C = 2 * Math.PI * 54;
  view.innerHTML = `
    <div class="qtop"><span class="chip" style="font-size:18px">ข้อ ${g.idx + 1} / ${g.total}</span>
      <div class="progress">${Array.from({ length: g.total }, (_, i) => `<i class="${i < g.idx ? 'done' : i === g.idx ? 'now' : ''}"></i>`).join('')}</div></div>
    <div class="qstage">
      <div class="card qcard rise"><span class="qno">คำถามข้อ ${g.idx + 1}</span>${esc(q.q)}</div>
      <div class="timer" id="timer"><svg viewBox="0 0 130 130"><circle class="tr-bg" cx="65" cy="65" r="60"/>
        <circle class="tr" id="ring" cx="65" cy="65" r="54" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg><b id="tNum">${q.t}</b></div>
    </div>
    <div class="hans ${two ? 'two' : ''}" id="hans">${q.c.map((c, i) => `<div class="ha o${i}">${shape(i)}<span>${esc(c)}</span></div>`).join('')}</div>
    <div class="qfoot"><div class="answered">ตอบแล้ว <b id="nAns">${g.answered}</b> / <span id="nAll">${g.players.length}</span> คน</div>
      <button class="btn sun big" id="bReveal">เฉลยเลย ✓</button></div>`;
  $('#bReveal').onclick = doReveal;
  let lastSec = -1;
  timerT = setInterval(() => {
    const left = Math.max(0, deadline - performance.now()), sec = Math.ceil(left / 1000);
    $('#ring').style.strokeDashoffset = C * (1 - left / (q.t * 1000));
    $('#tNum').textContent = sec;
    $('#timer').classList.toggle('low', left < 5500);
    if (sec !== lastSec) { if (sec <= 5 && sec > 0) sound.tick(sec <= 3); lastSec = sec; }
    if (left <= 0) { clearInterval(timerT); setTimeout(doReveal, 900); }
  }, 100);
  live(g);
}
async function doReveal() {
  if (!G || G.phase !== 'question') return;
  revealing = true; clearInterval(timerT);
  await act('reveal');
}

function vReveal(g) {
  music.stop(); sound.reveal();
  const q = g.q, two = q.c.length === 2, max = Math.max(1, ...g.dist), total = g.players.length;
  const pctOk = total ? Math.round((g.dist[q.a] / total) * 100) : 0;
  view.innerHTML = `
    <div class="qtop"><span class="chip" style="font-size:18px">เฉลยข้อ ${g.idx + 1} / ${g.total}</span>
      <div class="progress">${Array.from({ length: g.total }, (_, i) => `<i class="${i <= g.idx ? 'done' : ''}"></i>`).join('')}</div></div>
    <div class="qstage"><div class="card qcard"><span class="qno">คำถามข้อ ${g.idx + 1}</span>${esc(q.q)}</div>
      <div class="timer"><svg viewBox="0 0 130 130"><circle class="tr-bg" cx="65" cy="65" r="60"/></svg><b style="font-size:34px;line-height:1.1;text-align:center">${pctOk}%<small style="display:block;font-size:15px;font-weight:400">ตอบถูก</small></b></div></div>
    <div class="hans revealed ${two ? 'two' : ''}">${q.c.map((c, i) => `<div class="ha o${i} ${i === q.a ? 'right' : ''}">${shape(i)}<span>${esc(c)}</span>
      <span class="cnt"><i style="width:0" data-w="${Math.round((g.dist[i] / max) * 120)}"></i>${g.dist[i]}</span>${i === q.a ? '<span class="tick">✓</span>' : ''}</div>`).join('')}</div>
    <div class="qfoot"><div class="revnote">
        <div class="card">✅ ตอบถูก <b>${g.dist[q.a]}</b> จาก ${total} คน</div>
        ${g.fastest ? `<div class="card">⚡ ตอบถูกเร็วที่สุด: <b>${esc(g.fastest.name)}</b> (${(g.fastest.ms / 1000).toFixed(1)} วิ)</div>` : ''}
        ${q.x ? `<div class="card xpl">💡 ${esc(q.x)}</div>` : ''}</div>
      <button class="btn vio big" id="bBoard">ดูอันดับ ▶</button></div>`;
  requestAnimationFrame(() => setTimeout(() => $$('.cnt i').forEach((i) => (i.style.width = i.dataset.w + 'px')), 80));
  $('#bBoard').onclick = () => act('board');
}

function vBoard(g) {
  const last = g.idx + 1 >= g.total, top = Math.max(1, ...g.board.map((b) => b.score));
  view.innerHTML = `<div class="boardwrap">
    <h1 class="rise">🏆 อันดับหลังข้อ ${g.idx + 1}</h1>
    ${g.board.length ? g.board.map((b, i) => `<div class="card brow" style="animation-delay:${i * 0.08}s"><span class="bar" style="width:0" data-w="${(b.score / top) * 100}"></span>
      <span class="n">${b.rank}</span><span class="av">${avatar(b.av)}</span><span>${esc(b.name)}</span><span class="sc">${b.score.toLocaleString()}</span></div>`).join('')
      : '<p class="empty">ยังไม่มีผู้เล่น</p>'}
    <div style="display:flex;justify-content:flex-end;margin-top:6px"><button class="btn ${last ? 'hot' : 'go'} big" id="bNext">${last ? 'ดูผลสุดท้าย 🏆' : 'ข้อต่อไป ▶'}</button></div></div>`;
  requestAnimationFrame(() => setTimeout(() => $$('.brow .bar').forEach((b) => (b.style.width = b.dataset.w + '%')), 60));
  $('#bNext').onclick = () => act('next');
}

function vEnd(g) {
  stopPoll(); music.stop(); SSset('pin', '');
  const b = g.board, P = (i, cls) => b[i] ? `<div class="pod ${cls}"><div class="av">${avatar(b[i].av)}</div><div class="nm">${esc(b[i].name)}</div>
    <div class="sc">${b[i].score.toLocaleString()} คะแนน · ถูก ${b[i].correct}/${g.total}</div><div class="block">${i + 1}</div></div>` : '';
  view.innerHTML = `<div class="boardwrap" style="max-width:1200px">
    <h1 class="rise">🎉 ภารกิจสำเร็จ! ${esc(g.title)}</h1>
    <div class="podium">${P(0, 'p1')}${P(1, 'p2')}${P(2, 'p3')}</div>
    ${b.length > 3 ? `<div class="rest">${b.slice(3).map((x) => `<span class="chip">${x.rank}. ${avatar(x.av)} ${esc(x.name)} · ${x.score.toLocaleString()}</span>`).join('')}</div>` : ''}
    <div style="display:flex;gap:12px;justify-content:center;margin-top:18px;flex-wrap:wrap">
      <a class="btn vio big" href="results.html?pin=${g.pin}" target="_blank">📊 ดูสรุปผลรายคน</a>
      <button class="btn big" id="bNew">สร้างเกมใหม่</button></div></div>`;
  setTimeout(() => { sound.fanfare(); confetti(220); }, 1300);
  $('#bNew').onclick = () => { PIN = ''; G = null; lastKey = ''; shown = new Set(); showSetup(); };
}

// ===================================================== ปุ่มลัด
function primary() {
  if (!G || !PIN) return;
  ({ lobby: startGame, question: doReveal, reveal: () => act('board'), board: () => act('next') })[G.phase]?.();
}
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input,textarea,select') || !$('#mImport').hidden) return;
  if ([' ', 'Enter', 'ArrowRight', 'PageDown'].includes(e.key)) { e.preventDefault(); primary(); }
  if (e.key === 'f' || e.key === 'F') toggleFull();
  if (e.key === 'm' || e.key === 'M') toggleSound();
});
function toggleFull() { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {}); }
function toggleSound() {
  const m = sound.toggle(); $('#bSound').textContent = m ? '🔇' : '🔊';
  if (!m && G && (G.phase === 'lobby' || G.phase === 'question')) music.start(G.phase === 'question');
}
$('#bFull').onclick = toggleFull;
$('#bSound').onclick = toggleSound;
document.addEventListener('pointerdown', () => sound.unlock(), { once: true });

if (PIN) startPoll(); else showSetup();
