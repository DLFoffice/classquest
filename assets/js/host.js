// จอครู: ตั้งค่าข้อคำถาม → ห้องรอ (PIN + QR) → คำถาม → เฉลย → อันดับ → โพเดียม
import { call, DEMO } from './api.js';
import { $, $$, esc, shape, avatar, MASCOT, mascotFor, confetti, toast, sound, music, sleep } from './ui.js';
import { SAMPLE, SAMPLES, SOLAR } from './sample.js';
import { parsePunnett, punnettHTML } from './punnett.js';
import { THEMES, themeFor, backdrop, blizzard, swap, wordsHTML, countUp, sparkle, fireworks, floatEmoji, peek, flipRows, REDUCED } from './fx.js';

const view = $('#view');
const CFG = window.CQ_CONFIG || {};
$('#brandName').textContent = CFG.APP_NAME || 'ห้องเรียนผจญภัย';
const LSget = (k, d) => { try { const v = localStorage.getItem('cqh:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const LSset = (k, v) => { try { localStorage.setItem('cqh:' + k, JSON.stringify(v)); } catch (e) {} };
const SSget = (k) => { try { return sessionStorage.getItem('cqh:' + k) || ''; } catch (e) { return ''; } };
const SSset = (k, v) => { try { v ? sessionStorage.setItem('cqh:' + k, v) : sessionStorage.removeItem('cqh:' + k); } catch (e) {} };
const clone = (o) => JSON.parse(JSON.stringify(o));

let SET = LSget('set', null) || clone(SAMPLE);
// อัปเดตชุดตัวอย่างเดิม (ระบบสุริยะที่ยังไม่ได้แก้) เป็นชุดพันธุกรรม
if (!LSget('v4', false)) { if (SET.title === SOLAR.title && !SET.story) SET = clone(SAMPLE); LSset('v4', true); LSset('set', SET); }
const M = () => mascotFor((G && G.theme) || themeFor(SET.theme, SET.title));
const isSnow = () => ((G && G.theme) || '') === 'snow';
let KEY = SSget('key');
let PIN = SSget('pin');
let G = null, lastKey = '', pollT = null, timerT = null, deadline = 0, busy = false, revealing = false;
const POLL = DEMO ? 400 : 1000;

if (DEMO) { const d = document.createElement('div'); d.className = 'demo-badge'; d.textContent = 'โหมดทดลอง · เปิด index.html อีกแท็บเพื่อเป็นนักเรียน'; document.body.appendChild(d); }

// ===================================================== ตั้งค่าข้อคำถาม
const TIMES = [5, 10, 15, 20, 30, 45, 60, 90];
const save = () => LSset('set', SET);
const estMin = () => Math.max(1, Math.round(SET.questions.reduce((a, q) => a + (Number(q.t) || 20) + 20, 0) / 60));

const ICON = {
  up: '<svg viewBox="0 0 24 24"><path d="M12 5l-7 7h4.5v7h5v-7H19z"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 19l7-7h-4.5V5h-5v7H5z"/></svg>',
  dup: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none"/></svg>',
  del: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" fill="none"/></svg>',
};
const THEME_LABEL = { auto: 'อัตโนมัติตามชื่อกิจกรรม', snow: 'ด่านหิมะ', space: 'อวกาศ', nature: 'ธรรมชาติ', ocean: 'ใต้ทะเล', lab: 'ห้องทดลอง', math: 'คณิตคิดสนุก', class: 'ห้องเรียน' };
const THEME_ART = { auto: '✨', snow: '❄️', space: '🪐', nature: '🌿', ocean: '🐠', lab: '🧪', math: '🔢', class: '✏️' };
const QUICK_T = [10, 20, 30, 45];

function showSetup() {
  stopPoll(); music.stop(); $('#phaseChip').hidden = true;
  const cur = SET.theme || 'auto';
  view.innerHTML = `
  <div class="setup ed">
    <aside class="ed-side">
      <div class="ed-hero"><div class="ed-hero-m" id="heroM">${M()}</div>
        <div><small>ClassQuest</small><h1>เตรียมภารกิจ<br>ของห้องเรียน</h1></div></div>
      <div class="ed-body">
        <label class="ed-lbl" for="iTitle">ชื่อกิจกรรม</label>
        <input class="ed-in" id="iTitle" maxlength="80" value="${esc(SET.title)}" placeholder="เช่น วิทยาศาสตร์ ป.5 · ระบบสุริยะ">
        <p class="ed-lbl">ฉากและเอฟเฟกต์</p>
        <div class="themes-pick">${Object.entries(THEMES).map(([k, v]) => `<button type="button" class="tp ${cur === k ? 'on' : ''}" data-theme="${k}">
          <span class="tp-art tp-${k}">${THEME_ART[k]}</span><span>${THEME_LABEL[k]}${k === 'auto' ? `<small id="autoTh"></small>` : ''}</span></button>`).join('')}</div>
        <label class="ed-lbl" for="iStory">📜 เรื่องเล่าเปิดเกม <small>(บรรทัดละ 1 ฉาก · เว้นว่าง = ไม่เล่า)</small></label>
        <textarea class="ed-in" id="iStory" rows="4" maxlength="1500" placeholder="เช่น ยินดีต้อนรับสู่ด่านหิมะ…">${esc(SET.story || '')}</textarea>
        <div class="stats"><div><b id="stQ">0</b><small>ข้อ</small></div><div><b id="stM">0</b><small>นาที (ประมาณ)</small></div><div><b id="stR">0</b><small>พร้อมเล่น</small></div></div>
        ${DEMO ? '' : `<label class="ed-lbl" for="iKey">รหัสครู (HOST_KEY)</label><input class="ed-in" id="iKey" type="password" value="${esc(KEY)}" autocomplete="current-password">`}
        <button class="ed-go" id="bCreate"><span>สร้างห้องเกม</span><i>🚀</i></button>
        <div class="ed-acts">
          <button class="ed-ghost" id="bImport">📋 วางจาก Excel</button>
          <span class="smenu-wrap"><button class="ed-ghost" id="bSample">✨ ชุดตัวอย่าง ▾</button>
            <span class="smenu" id="sMenu" hidden>${SAMPLES.map((x) => `<button type="button" data-sample="${x.key}">${esc(x.label)}</button>`).join('')}</span></span>
          <button class="ed-ghost danger" id="bClear">🗑 ล้างทั้งหมด</button>
        </div>
        <p class="ed-tip"><kbd>Space</kbd> ขั้นต่อไป · <kbd>F</kbd> เต็มจอ · <kbd>M</kbd> เสียง · ใช้รีโมตเลื่อนสไลด์ได้</p>
      </div>
    </aside>
    <section>
      <div class="qlist" id="qlist"></div>
      <button class="ed-add" id="bAdd"><span>＋</span>เพิ่มคำถาม</button>
    </section>
  </div>`;
  renderList();
  const preview = () => { const th = themeFor(SET.theme, SET.title); backdrop(th); $('#heroM').innerHTML = mascotFor(th); const a = $('#autoTh'); if (a) a.textContent = 'ตอนนี้: ' + THEME_LABEL[themeFor('auto', SET.title)]; };
  preview();
  $('#iTitle').addEventListener('input', (e) => { SET.title = e.target.value; save(); preview(); });
  $$('.tp').forEach((b) => b.addEventListener('click', () => { SET.theme = b.dataset.theme; save(); $$('.tp').forEach((x) => x.classList.toggle('on', x === b)); preview(); }));
  $('#bAdd').onclick = () => { SET.questions.push({ q: '', c: ['', '', '', ''], a: 0, t: 20, x: '' }); save(); renderList(); const c = $('#qlist').lastElementChild; c.scrollIntoView({ behavior: 'smooth', block: 'center' }); c.querySelector('textarea').focus(); };
  $('#iStory').addEventListener('input', (e) => { SET.story = e.target.value; save(); });
  $('#bSample').onclick = (e) => { e.stopPropagation(); $('#sMenu').hidden = !$('#sMenu').hidden; };
  $$('[data-sample]').forEach((b) => (b.onclick = () => {
    const x = SAMPLES.find((y) => y.key === b.dataset.sample);
    if (confirm(`แทนที่ข้อคำถามทั้งหมดด้วยชุด "${x.label}"?`)) { SET = clone(x.set); save(); showSetup(); }
  }));
  document.addEventListener('click', () => { const m = $('#sMenu'); if (m) m.hidden = true; }, { once: true });
  $('#bClear').onclick = () => { if (confirm('ลบข้อคำถามทั้งหมด?')) { SET.questions = [{ q: '', c: ['', '', '', ''], a: 0, t: 20, x: '' }]; save(); renderList(); } };
  $('#bImport').onclick = () => { $('#mImport').hidden = false; $('#taImport').focus(); };
  $('#bCreate').onclick = createRoom;
}

function pchk(g) { if (!g || !g.trim()) return ''; const P = parsePunnett(g); return P.error ? `⚠ ${esc(P.error)}` : `✓ ตาราง ${P.g2.length}×${P.g1.length}`; }
const ready = (q) => q.q.trim() && q.c.filter((c) => c.trim()).length === q.c.length && q.a >= 0 && q.a < q.c.length;
function updStats() {
  if (!$('#stQ')) return;
  $('#stQ').textContent = SET.questions.length; $('#stM').textContent = estMin();
  $('#stR').textContent = `${SET.questions.filter(ready).length}/${SET.questions.length}`;
  $$('.qed').forEach((card) => { const ok = ready(SET.questions[+card.dataset.i]); card.classList.toggle('done', !!ok);
    const s = card.querySelector('.qstate'); if (s) s.textContent = ok ? '✓ พร้อม' : 'ยังไม่ครบ'; });
}

function renderList() {
  $('#qlist').innerHTML = SET.questions.map((q, i) => {
    const tf = q.c.length === 2, t = Number(q.t) || 20;
    return `<article class="qed" data-i="${i}" style="--acc:var(--c${i % 4});--d:${Math.min(i, 8) * 0.04}s">
      <header class="qed-h">
        <span class="qed-no"><small>ข้อ</small>${i + 1}</span>
        <div class="seg" role="group" aria-label="ชนิดคำถาม">
          <button type="button" data-type="4" class="${tf ? '' : 'on'}">4 ตัวเลือก</button><button type="button" data-type="2" class="${tf ? 'on' : ''}">ถูก / ผิด</button></div>
        <div class="seg time" role="group" aria-label="เวลา">${QUICK_T.map((x) => `<button type="button" data-time="${x}" class="${t === x ? 'on' : ''}">${x}s</button>`).join('')}
          <select data-k="t" title="เวลาอื่น" class="${QUICK_T.includes(t) ? '' : 'on'}">${QUICK_T.includes(t) ? '<option selected disabled>อื่น ๆ</option>' : ''}${TIMES.map((x) => `<option value="${x}" ${t === x && !QUICK_T.includes(t) ? 'selected' : ''}>${x} วิ</option>`).join('')}</select></div>
        <span class="qstate"></span>
        <div class="tools">${['up', 'down', 'dup', 'del'].map((a) => `<button type="button" data-act="${a}" title="${{ up: 'เลื่อนขึ้น', down: 'เลื่อนลง', dup: 'ทำซ้ำ', del: 'ลบ' }[a]}" class="${a}">${ICON[a]}</button>`).join('')}</div>
      </header>
      <textarea data-k="q" rows="1" maxlength="300" placeholder="พิมพ์คำถามที่นี่…">${esc(q.q)}</textarea>
      <div class="opts">${q.c.map((c, j) => `<div class="opt o${j} ${q.a === j ? 'right' : ''}">
        <button type="button" class="mark" data-correct="${j}" title="ตั้งเป็นคำตอบที่ถูก">${shape(j)}</button>
        <input type="text" data-k="c" data-j="${j}" value="${esc(c)}" placeholder="ตัวเลือกที่ ${j + 1}" maxlength="120" ${tf ? 'readonly' : ''}>
        <button type="button" class="okpill" data-correct="${j}">${q.a === j ? '✓ คำตอบที่ถูก' : 'ตั้งเป็นคำตอบ'}</button></div>`).join('')}</div>
      <div class="genrow"><label class="pun-in"><span>🧬</span><input data-k="g" value="${esc(q.g || '')}" maxlength="60" placeholder="ตารางพันนิตต์ (ไม่บังคับ) เช่น  Bb x bb | ขนเทา | ขนขาว"><em class="pchk">${pchk(q.g)}</em></label>
        <label class="gs" title="ถ้าไม่ติ๊ก ตารางจะขึ้นเฉพาะตอนเฉลย (กันเฉลยหลุด)"><input type="checkbox" data-k="gs" ${q.gs ? 'checked' : ''}>แสดงตอนถาม</label></div>
      <label class="xpl"><span>💡</span><input data-k="x" value="${esc(q.x || '')}" maxlength="200" placeholder="คำอธิบายหลังเฉลย (ไม่บังคับ) — ขึ้นทั้งจอครูและมือถือนักเรียน"></label>
    </article>`;
  }).join('');
  $$('.qed textarea').forEach(autosize);
  updStats();
}
function autosize(t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 2 + 'px'; }

// แก้ไขแบบ delegation
document.addEventListener('input', (e) => {
  const card = e.target.closest('.qed'); if (!card) return;
  const q = SET.questions[+card.dataset.i], k = e.target.dataset.k;
  if (k === 'q') { q.q = e.target.value; autosize(e.target); }
  if (k === 'x') q.x = e.target.value;
  if (k === 'c') q.c[+e.target.dataset.j] = e.target.value;
  if (k === 'g') { q.g = e.target.value; const c = e.target.parentNode.querySelector('.pchk'); c.innerHTML = pchk(q.g); c.classList.toggle('bad', /⚠/.test(c.textContent)); }
  save(); updStats();
});
document.addEventListener('change', (e) => {
  const card = e.target.closest('.qed'); if (!card) return;
  if (e.target.dataset.k === 'gs') { SET.questions[+card.dataset.i].gs = e.target.checked; save(); return; }
  if (e.target.dataset.k !== 't') return;
  SET.questions[+card.dataset.i].t = Number(e.target.value); save(); renderList();
});
document.addEventListener('click', (e) => {
  const card = e.target.closest('.qed'); if (!card) return;
  const i = +card.dataset.i, L = SET.questions, q = L[i];
  const tb = e.target.closest('[data-type]'), tm = e.target.closest('[data-time]'), cr = e.target.closest('[data-correct]'), b = e.target.closest('[data-act]');
  if (tb) {
    if ((tb.dataset.type === '2') === (q.c.length === 2)) return;
    if (tb.dataset.type === '2') { q._keep = q.c.slice(); q._keepA = q.a; q.c = ['ถูก', 'ผิด']; q.a = 0; }
    else { const k = q._keep && q._keep.length === 4; q.c = k ? q._keep : ['', '', '', '']; q.a = k ? q._keepA || 0 : 0; }
  } else if (tm) q.t = Number(tm.dataset.time);
  else if (cr) {
    q.a = Number(cr.dataset.correct);
    $$('.opt', card).forEach((o, j) => { o.classList.toggle('right', j === q.a); o.querySelector('.okpill').textContent = j === q.a ? '✓ คำตอบที่ถูก' : 'ตั้งเป็นคำตอบ'; });
    sound.pop(); save(); updStats(); return;
  } else if (b) {
    if (b.dataset.act === 'up' && i > 0) [L[i - 1], L[i]] = [L[i], L[i - 1]];
    if (b.dataset.act === 'down' && i < L.length - 1) [L[i + 1], L[i]] = [L[i], L[i + 1]];
    if (b.dataset.act === 'dup') L.splice(i + 1, 0, clone(L[i]));
    if (b.dataset.act === 'del') { if (L.length === 1) return toast('ต้องมีอย่างน้อย 1 ข้อ'); if (!confirm(`ลบข้อ ${i + 1}?`)) return; L.splice(i, 1); }
  } else return;
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
    const r = await call('create', { key: KEY, title: SET.title, theme: themeFor(SET.theme, SET.title), questions: SET.questions.map(({ q, c, a, t, x, g, gs }) => ({ q, c, a, t, x, g, gs })) });
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
  backdrop(g.theme || 'class');
  if (key !== lastKey) {
    const first = !lastKey;
    lastKey = key; clearInterval(timerT); revealing = false; document.body.classList.remove('hurry');
    g._t = performance.now();
    const fn = () => ({ lobby: vLobby, question: vQuestion, reveal: vReveal, board: vBoard, end: vEnd })[g.phase](g);
    const label = { question: `ข้อ ${g.idx + 1}`, reveal: 'เฉลย!', board: '🏆 อันดับ', end: 'ผลสุดท้าย!' }[g.phase];
    if (first || g.phase === 'lobby') fn(); else swap(fn, label);
  } else live(g);
}
function live(g) {
  if (g.phase === 'lobby') { updatePeople(g); showReacts(g); }
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
      <div class="pin-big">${[...g.pin].map((d) => `<span class="dg">${d}</span>`).join('')}</div>
    </div>
    <div class="card crowd rise">
      <div class="crowd-head"><div><div style="font-size:18px" class="muted">${esc(g.title)} · ${g.total} ข้อ</div>
        <div><span class="count" id="nPeople">0</span> <span style="font-size:22px">คนพร้อมแล้ว</span></div></div>
        <button class="btn hot big" id="bGo">เริ่มเกม ▶</button></div>
      <div class="people" id="people"></div>
      <p class="muted sarabun" style="margin:0;font-size:14px">คลิกที่ชื่อเพื่อนำออกจากห้อง · นักเรียนกดส่งอีโมจิขึ้นจอได้ · กด Space เพื่อเริ่ม</p>
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
    const ang = Math.random() * 6.283; el.style.setProperty('--fx', Math.round(Math.cos(ang) * 500) + 'px'); el.style.setProperty('--fy', Math.round(Math.sin(ang) * 400) + 'px');
    el.innerHTML = `<span class="av">${avatar(p.av)}</span>${esc(p.name)}`;
    el.title = 'คลิกเพื่อนำออก';
    el.onclick = async () => { if (confirm(`นำ "${p.name}" ออกจากห้อง?`)) { await call('kick', { key: KEY, pin: PIN, pid: p.pid }); } };
    box.appendChild(el);
    if (!shown.has(p.pid)) { shown.add(p.pid); sound.pop(); }
  });
  if (!g.players.length && !box.querySelector('.empty')) box.innerHTML = `<div class="empty"><div class="hero-mascot">${M()}</div>${isSnow() ? 'จ่าฝูงรอนักสำรวจอยู่…' : 'รอเพื่อน ๆ เข้าห้อง…'}</div>`;
  else if (g.players.length) box.querySelector('.empty')?.remove();
}
const seenRx = new Set();
function showReacts(g) {
  (g.rx || []).forEach((r) => { if (seenRx.has(r.id)) return; seenRx.add(r.id); floatEmoji(r.e, esc(r.n)); });
}
let toldPin = '', starting = false;
async function startGame() {
  if (storyOpen || starting || !G || G.phase !== 'lobby') return;
  if (!G.players.length && !confirm('ยังไม่มีนักเรียนในห้อง เริ่มเลยไหม?')) return;
  starting = true;
  try {
    const lines = String(SET.story || '').split('\n').map((x) => x.trim()).filter(Boolean);
    if (lines.length && toldPin !== PIN) { toldPin = PIN; await story(lines); }
    await act('next');
  } finally { starting = false; }
}

// ===================================================== เรื่องเล่าเปิดเกม
let storyOpen = false, storyNext = null;
function story(lines) {
  return new Promise((done) => {
    storyOpen = true; music.stop();
    const ov = document.createElement('div'); ov.className = 'story';
    ov.innerHTML = `<div class="st-m">${M()}</div><div class="st-box"><div class="st-name">${isSnow() ? '🦊 จ่าฝูงจิ้งจอก' : '✏️ น้องดินสอ'}</div>
      <p id="stText"></p><div class="st-foot"><span class="st-dots">${lines.map((_, i) => `<i data-i="${i}"></i>`).join('')}</span>
      <button class="btn sm ghost" id="stSkip">ข้าม</button><button class="btn sm sun" id="stNext">ต่อไป ▶</button></div></div>`;
    document.body.appendChild(ov);
    const seg = (t) => (window.Intl && Intl.Segmenter ? [...new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(t)].map((x) => x.segment) : [...t]);
    let i = -1, typing = null, full = '';
    const show = () => {
      i++; if (i >= lines.length) return close();
      $$('.st-dots i', ov).forEach((d, k) => d.classList.toggle('on', k <= i));
      $('#stNext', ov).textContent = i === lines.length - 1 ? 'เริ่มภารกิจ! 🚀' : 'ต่อไป ▶';
      const ch = seg(lines[i]); full = lines[i]; let k = 0; const el = $('#stText', ov); el.textContent = '';
      ov.querySelector('.st-m').classList.remove('talk'); void ov.offsetWidth; ov.querySelector('.st-m').classList.add('talk');
      clearInterval(typing);
      typing = setInterval(() => { el.textContent += ch[k++] || ''; if (k % 3 === 0) sound.tone(isSnow() ? 1320 : 990, 0.03, 'sine', 0.04); if (k >= ch.length) { clearInterval(typing); typing = null; } }, 32);
    };
    const next = () => { if (typing) { clearInterval(typing); typing = null; $('#stText', ov).textContent = full; } else show(); };
    const close = () => { coolUntil = performance.now() + 1800; storyOpen = false; storyNext = null; ov.classList.add('bye'); setTimeout(() => ov.remove(), 500); done(); };
    storyNext = next;
    $('#stNext', ov).onclick = next; $('#stSkip', ov).onclick = close;
    if (isSnow()) blizzard(1400);
    setTimeout(show, 500);
  });
}

// ===================================================== เส้นทางข้ามด่าน
const TRAIL = { snow: { team: '⛷️', gate: '🧊', open: '🏔️', camp: '⛺', guard: '🦊' }, def: { team: '🚀', gate: '🏁', open: '🏆', camp: '🏠', guard: '⭐' } };
const needPass = (n) => Math.max(1, Math.ceil(n * 0.6));
const passedOf = (g) => (g.trail || []).filter((r) => r != null && r >= 0.5).length;
function trailHTML(g, pos) {
  const T = isSnow() ? TRAIL.snow : TRAIL.def, need = needPass(g.total), at = Math.min(pos, need), open = pos >= need;
  const L = (k) => (k / (need + 1)) * 100;
  return `<div class="trail ${open ? 'open' : ''}"><div class="tr-line"><i style="width:${L(at)}%"></i></div>
    <span class="tr-node camp" style="left:0%">${T.camp}</span>
    ${Array.from({ length: need }, (_, k) => `<span class="tr-node ${k < at ? 'ok' : ''}" style="left:${L(k + 1)}%">${T.guard}</span>`).join('')}
    <span class="tr-node gate" style="left:100%">${open ? T.open : T.gate}</span>
    <span class="tr-me" style="left:${L(at)}%">${T.team}</span>
    <span class="tr-cap">ผ่าน ${Math.min(pos, need)}/${need} ด่าน${open ? ' · ประตูเปิดแล้ว!' : ''}</span></div>`;
}

function vQuestion(g) {
  music.start(true);
  const q = g.q, two = q.c.length === 2;
  const P = q.g ? parsePunnett(q.g) : null, pun = P && !P.error && q.gs ? punnettHTML(P) : '';
  deadline = (g._t || performance.now()) + g.left;
  const C = 2 * Math.PI * 54;
  view.innerHTML = `
    <div class="qtop"><span class="chip" style="font-size:18px">ข้อ ${g.idx + 1} / ${g.total}</span>${trailHTML(g, passedOf(g))}</div>
    <div class="qstage ${pun ? 'has-pun' : ''}">
      <div class="card qcard rise"><span class="qno">คำถามข้อ ${g.idx + 1}</span><span>${wordsHTML(q.q, esc)}</span></div>${pun}
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
    document.body.classList.toggle('hurry', left < 5500 && left > 0);
    if (sec !== lastSec) { if (sec <= 5 && sec > 0) sound.tick(sec <= 3); lastSec = sec; }
    if (left <= 0) {
      clearInterval(timerT); document.body.classList.remove('hurry');
      const st = document.createElement('div'); st.className = 'stamp'; st.textContent = 'หมดเวลา!'; document.body.appendChild(st);
      sound.wrong(); if (isSnow()) blizzard(1600); setTimeout(() => st.remove(), 1400); setTimeout(doReveal, 1100);
    }
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
  const P = q.g ? parsePunnett(q.g) : null, pun = P && !P.error ? punnettHTML(P, { filled: true }) : '';
  view.innerHTML = `
    <div class="qtop"><span class="chip" style="font-size:18px">เฉลยข้อ ${g.idx + 1} / ${g.total}</span>${trailHTML({ ...g, trail: (g.trail || []).slice(0, g.idx) }, passedOf({ trail: (g.trail || []).slice(0, g.idx) }))}</div>
    <div class="qstage ${pun ? 'has-pun' : ''}"><div class="card qcard"><span class="qno">คำถามข้อ ${g.idx + 1}</span>${esc(q.q)}</div>${pun}
      <div class="timer"><svg viewBox="0 0 130 130"><circle class="tr-bg" cx="65" cy="65" r="60"/></svg><b style="font-size:34px;line-height:1.1;text-align:center">${pctOk}%<small style="display:block;font-size:15px;font-weight:400">ตอบถูก</small></b></div></div>
    <div class="hans revealed ${two ? 'two' : ''}">${q.c.map((c, i) => `<div class="ha o${i} ${i === q.a ? 'right' : ''}">${shape(i)}<span>${esc(c)}</span>
      <span class="cnt"><i style="width:0" data-w="${Math.round((g.dist[i] / max) * 120)}"></i><em data-n="${g.dist[i]}">0</em></span>${i === q.a ? '<span class="tick">✓</span>' : ''}</div>`).join('')}</div>
    <div class="qfoot"><div class="revnote">
        <div class="card">✅ ตอบถูก <b>${g.dist[q.a]}</b> จาก ${total} คน</div>
        ${g.fastest ? `<div class="card">⚡ ตอบถูกเร็วที่สุด: <b>${esc(g.fastest.name)}</b> (${(g.fastest.ms / 1000).toFixed(1)} วิ)</div>` : ''}
        ${q.x ? `<div class="card xpl">💡 ${esc(q.x)}</div>` : ''}</div>
      <button class="btn vio big" id="bBoard">ดูอันดับ ▶</button></div>`;
  requestAnimationFrame(() => setTimeout(() => $$('.cnt i').forEach((i) => (i.style.width = i.dataset.w + 'px')), 80));
  $$('.cnt em').forEach((e) => countUp(e, 0, +e.dataset.n, 900));
  setTimeout(() => sparkle($('.ha.right'), 16), 500);
  const pc = total ? g.dist[q.a] / total : 0;
  const lines = isSnow()
    ? [!total ? 'เฉลยแล้ว!' : pc >= 0.8 ? 'ฮึ่ม… พวกเจ้ารู้ความลับขนของพวกเราแล้วสินะ 🦊' : pc >= 0.5 ? 'ไม่เลว! ข้ายอมให้ผ่านด่านนี้' : pc > 0 ? 'ฮึ! ยังไม่เก่งพอ ฟังเฉลยให้ดีนะ ❄️' : 'ฮ่า ๆ! ไม่มีใครไขปริศนาข้าได้เลย 🌨️']
    : [!total ? 'เฉลยแล้ว!' : pc >= 0.8 ? 'ว้าว! เก่งกันทั้งห้องเลย 🎉' : pc >= 0.5 ? 'เยี่ยม! ถูกกันเกินครึ่ง 👍' : pc > 0 ? 'ข้อนี้ยากนะ ฟังเฉลยกันหน่อย 🤔' : 'โอ๊ะ! ไม่มีใครถูกเลย 😮'];
  setTimeout(() => peek(M(), lines[0], pc >= 0.5 ? 'happy' : 'sad', P ? 5200 : 3800), 700);
  if (isSnow() && total && pc < 0.5) setTimeout(() => blizzard(1500), 400);
  if (pc >= 0.8 && total) setTimeout(() => confetti(90), 600);
  $('#bBoard').onclick = () => act('board');
}

let prevBoard = [];
function vBoard(g) {
  const last = g.idx + 1 >= g.total, top = Math.max(1, ...g.board.map((b) => b.score));
  const prev = prevBoard; prevBoard = g.board.map((b) => ({ name: b.name, score: b.score }));
  const pIdx = (name) => { const k = prev.findIndex((p) => p.name === name); return k < 0 ? (prev.length ? g.board.length : null) : k; };
  const before = passedOf({ trail: (g.trail || []).slice(0, g.idx) }), after = passedOf(g), need = needPass(g.total), r = (g.trail || [])[g.idx] || 0;
  const msg = after >= need && before < need ? `${isSnow() ? '🧊 ประตูน้ำแข็งเปิดแล้ว!' : '🏁 ถึงเส้นชัยแล้ว!'} ทั้งห้องผ่านครบ ${need} ด่าน`
    : r >= 0.5 ? `🎉 ทั้งห้องตอบถูก ${Math.round(r * 100)}% — ผ่านด่าน! ขบวนเดินหน้า`
    : `${isSnow() ? '🌨️ พายุหิมะ!' : '😵 ไม่ผ่าน!'} ตอบถูกแค่ ${Math.round(r * 100)}% — ขบวนยังติดอยู่ที่เดิม`;
  view.innerHTML = `<div class="boardwrap">
    <div class="trail-wrap rise">${trailHTML(g, before)}<p class="tr-msg ${r >= 0.5 ? 'ok' : 'bad'}">${msg}</p></div>
    <h1 class="rise">🏆 อันดับหลังข้อ ${g.idx + 1}</h1>
    ${g.board.length ? g.board.map((b, i) => { const pi = pIdx(b.name), up = pi != null && pi > i ? pi - i : 0;
      return `<div class="card brow flip ${i === 0 ? 'top1' : ''}"><span class="bar" style="width:0" data-w="${(b.score / top) * 100}"></span>
      <span class="n">${b.rank === 1 ? '👑' : b.rank}</span><span class="av">${avatar(b.av)}</span><span>${esc(b.name)}${up ? `<span class="mv">▲ ${up}</span>` : ''}</span>
      <span class="sc" data-from="${(prev.find((p) => p.name === b.name) || { score: 0 }).score}" data-to="${b.score}">0</span></div>`; }).join('')
      : '<p class="empty">ยังไม่มีผู้เล่น</p>'}
    <div style="display:flex;justify-content:flex-end;margin-top:6px"><button class="btn ${last ? 'hot' : 'go'} big" id="bNext">${last ? 'ดูผลสุดท้าย 🏆' : 'ข้อต่อไป ▶'}</button></div></div>`;
  const rows = $$('.brow');
  rows.forEach((el, i) => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: i * 90, fill: 'backwards' }));
  flipRows(rows, (i) => pIdx(g.board[i].name), rows[0] ? rows[0].offsetHeight + 16 : 0);
  $$('.brow .sc').forEach((e) => countUp(e, +e.dataset.from, +e.dataset.to, 1400));
  requestAnimationFrame(() => setTimeout(() => $$('.brow .bar').forEach((b) => (b.style.width = b.dataset.w + '%')), 600));
  if (!REDUCED) setTimeout(() => sound.tone(880, 0.15, 'triangle', 0.12), 1500);
  if (after !== before) setTimeout(() => { const w = $('.trail-wrap'); if (w) { w.firstElementChild.outerHTML = trailHTML(g, after); $('.trail-wrap .trail').classList.add('moved'); sound.pop(); if (after >= need && before < need) { confetti(120); sound.fanfare(); } } }, 700);
  else if (r < 0.5 && isSnow()) setTimeout(() => blizzard(1300), 500);
  $('#bNext').onclick = () => act('next');
}

function vEnd(g) {
  stopPoll(); music.stop(); SSset('pin', '');
  const b = g.board, P = (i, cls) => b[i] ? `<div class="pod ${cls}"><div class="av">${avatar(b[i].av)}</div><div class="nm">${esc(b[i].name)}</div>
    <div class="sc">${b[i].score.toLocaleString()} คะแนน · ถูก ${b[i].correct}/${g.total}</div><div class="block">${i + 1}</div></div>` : '';
  const P1 = b[0] ? P(0, 'p1').replace('<div class="av">', '<div class="av"><span class="crown">👑</span>') : '';
  view.innerHTML = `<div class="boardwrap" style="max-width:1200px">
    <h1 class="rise">🎉 ภารกิจสำเร็จ! ${esc(g.title)}</h1>
    ${(() => { const p = passedOf(g), n = needPass(g.total); return `<p class="gate-banner ${p >= n ? 'ok' : ''}">${p >= n ? (isSnow() ? '🧊✨ ประตูน้ำแข็งเปิดออกแล้ว!' : '🏆 ทั้งห้องพิชิตเส้นชัย!') : (isSnow() ? '❄️ ประตูน้ำแข็งยังปิดอยู่…' : '🏁 เกือบถึงเส้นชัยแล้ว')} · ทั้งห้องผ่าน ${Math.min(p, n)}/${n} ด่าน</p>`; })()}
    <div class="beam b1"></div><div class="beam b2"></div>
    <div class="drum">🥁 แล้วผู้ชนะก็คือ…</div>
    <div class="podium">${P1}${P(1, 'p2')}${P(2, 'p3')}</div>
    ${b.length > 3 ? `<div class="rest">${b.slice(3).map((x) => `<span class="chip">${x.rank}. ${avatar(x.av)} ${esc(x.name)} · ${x.score.toLocaleString()}</span>`).join('')}</div>` : ''}
    <div style="display:flex;gap:12px;justify-content:center;margin-top:18px;flex-wrap:wrap">
      <a class="btn vio big" href="results.html?pin=${g.pin}" target="_blank">📊 ดูสรุปผลรายคน</a>
      <button class="btn big" id="bNew">สร้างเกมใหม่</button></div></div>`;
  [0, 0.6].forEach((d, k) => setTimeout(() => sound.tone(k ? 523 : 392, 0.25, 'triangle', 0.15), d * 1000));
  for (let k = 0; k < 10; k++) setTimeout(() => sound.tick(k % 2), 1300 + k * 90);
  setTimeout(() => { sound.fanfare(); confetti(240); fireworks(7000); }, 2300);
  setTimeout(() => peek(M(), isSnow() ? (passedOf(g) >= needPass(g.total) ? 'พวกเจ้าคือนักสำรวจตัวจริง! ข้ายอมรับ 🦊' : 'ครั้งหน้าข้าจะรอพวกเจ้าอีกนะ ❄️') : 'ปรบมือให้แชมป์หน่อย! 👏', 'happy', 4500), 3400);
  $('#bNew').onclick = () => { PIN = ''; G = null; lastKey = ''; shown = new Set(); prevBoard = []; showSetup(); };
}

// ===================================================== ปุ่มลัด
let coolUntil = 0;
function primary() {
  if (!G || !PIN || performance.now() < coolUntil) return;
  coolUntil = performance.now() + 900;
  ({ lobby: startGame, question: doReveal, reveal: () => act('board'), board: () => act('next') })[G.phase]?.();
}
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input,textarea,select') || !$('#mImport').hidden) return;
  if ([' ', 'Enter', 'ArrowRight', 'PageDown'].includes(e.key)) { e.preventDefault(); if (storyOpen) storyNext && storyNext(); else primary(); }
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
