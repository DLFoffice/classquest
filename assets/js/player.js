// จอนักเรียน: เข้าห้อง → รอ → ตอบ → ดูผล → อันดับสุดท้าย
import { call, DEMO } from './api.js';
import { $, $$, esc, shape, AVATARS, avatar, MASCOT, mascotFor, foxSVG, confetti, toast, uid, sleep } from './ui.js';
import { backdrop, blizzard, swap, wordsHTML, countUp, sparkle, fireworks, floatEmoji, REDUCED } from './fx.js';

const view = $('#view');
const CFG = window.CQ_CONFIG || {};
$('#brandName').textContent = CFG.APP_NAME || 'ห้องเรียนผจญภัย';
const SS = { get: (k) => { try { return JSON.parse(sessionStorage.getItem('cqp:' + k)); } catch (e) { return null; } },
  set: (k, v) => { try { sessionStorage.setItem('cqp:' + k, JSON.stringify(v)); } catch (e) {} } };

let me = SS.get('me');
let ST_PARAM = Number(new URLSearchParams(location.search).get('st')) || 0; // { pin, pid, name, av }
let st = null, lastKey = '', pollT = null, timerT = null, deadline = 0, failCount = 0;
const POLL = DEMO ? 700 : 1800;

// ===================================================== เข้าห้อง
function showJoin(err) {
  stopPoll();
  $('#me').hidden = true;
  backdrop('class');
  const pinQ = (new URLSearchParams(location.search).get('pin') || (me && me.pin) || '').replace(/\D/g, '').slice(0, 4);
  const av = me ? me.av : Math.floor(Math.random() * AVATARS.length);
  view.innerHTML = `
    <form class="mj" id="fJoin" autocomplete="off">
      <div class="mj-hero"><div class="mj-m">${MASCOT}</div>
        <div><small>ห้องเรียนผจญภัย</small><h1>พร้อมผจญภัย<br>หรือยัง?</h1></div></div>
      <div class="mj-body">
        <p class="mj-lbl">รหัสห้อง <span>ดูบนจอคุณครู</span></p>
        <div class="pinbox">${[0, 1, 2, 3].map((i) => `<input class="pd" inputmode="numeric" maxlength="1" aria-label="รหัสหลักที่ ${i + 1}" value="${pinQ[i] || ''}">`).join('')}</div>
        <input type="hidden" id="iPin" value="${esc(pinQ)}">
        <label class="mj-lbl" for="iFull">ชื่อ-สกุล <span>สำหรับบันทึกผล</span></label>
        <div class="mj-in"><span>🪪</span><input id="iFull" maxlength="60" value="${esc(me ? me.full || '' : '')}" placeholder="เช่น ด.ญ. มะลิ ใจดี" autocomplete="name" required></div>
        <label class="mj-lbl" for="iName">ชื่อเล่น <span>ขึ้นบนจอ</span></label>
        <div class="mj-in"><span>😊</span><input id="iName" maxlength="20" value="${esc(me ? me.name : '')}" placeholder="เช่น น้องมะลิ" required></div>
        <p class="mj-lbl">เลือกตัวละคร <span id="avName"></span></p>
        <div class="avs mj-avs" role="radiogroup">${AVATARS.map((a, i) => `<button type="button" role="radio" aria-checked="${i === av}" data-i="${i}">${a}</button>`).join('')}</div>
        <button class="mj-go" id="bJoin"><span>เข้าห้องเลย</span><i>🚀</i></button>
      </div>
    </form>`;
  const boxes = $$('.pd'), sync = () => { $('#iPin').value = boxes.map((x) => x.value).join(''); boxes.forEach((x) => x.classList.toggle('on', !!x.value)); };
  boxes.forEach((bx, i) => {
    bx.addEventListener('input', () => {
      const d = bx.value.replace(/\D/g, '');
      if (d.length > 1) { d.slice(0, 4 - i).split('').forEach((c, k) => (boxes[i + k].value = c)); }
      else bx.value = d;
      sync();
      const nx = boxes.find((x) => !x.value); if (bx.value) (nx || $('#iName')).focus();
    });
    bx.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !bx.value && i > 0) { boxes[i - 1].value = ''; boxes[i - 1].focus(); sync(); } });
    bx.addEventListener('focus', () => bx.select());
  });
  sync();
  $$('.avs button').forEach((b) => b.addEventListener('click', () => { $$('.avs button').forEach((x) => x.setAttribute('aria-checked', x === b)); if (navigator.vibrate) navigator.vibrate(10); }));
  $('#fJoin').addEventListener('submit', onJoin);
  if (err) toast(err);
  if (!pinQ) setTimeout(() => boxes[0].focus(), 300);
}

async function onJoin(e) {
  e.preventDefault();
  const pin = $('#iPin').value.trim(), name = $('#iName').value.trim(), full = $('#iFull').value.trim().replace(/\s+/g, ' ');
  const av = Number($('.avs [aria-checked="true"]').dataset.i);
  if (!/^\d{4}$/.test(pin)) return toast('รหัสห้องต้องเป็นตัวเลข 4 หลัก');
  if (full.replace(/^(ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง|นาย|นางสาว|นาง)\s*/, '').split(' ').filter(Boolean).length < 2) { $('#iFull').focus(); return toast('ใส่ทั้งชื่อและนามสกุลนะ (เว้นวรรค 1 ช่อง)'); }
  if (!name) { $('#iName').focus(); return toast('ใส่ชื่อเล่นก่อนนะ'); }
  const btn = $('#bJoin'); btn.disabled = true; btn.querySelector('span').textContent = 'กำลังเข้าห้อง…';
  try {
    const pid = me && me.pin === pin ? me.pid : uid();
    const r = await call('join', { pin, pid, name, full, av });
    me = { pin, pid, name: r.name, full, av }; SS.set('me', me);
    history.replaceState(null, '', location.pathname + '?pin=' + pin);
    startPoll();
  } catch (err) {
    toast(err.message); btn.disabled = false; btn.querySelector('span').textContent = 'เข้าห้องเลย';
  }
}

// ===================================================== ติดตามสถานะ
function startPoll() { stopPoll(); poll(); }
function stopPoll() { clearTimeout(pollT); pollT = null; }
async function poll() {
  try {
    const s = await call('poll', { pin: me.pin, pid: me.pid });
    failCount = 0; render(s);
  } catch (err) {
    if (/ไม่พบ/.test(err.message)) { me = null; SS.set('me', null); return showJoin(err.message); }
    if (++failCount === 3) toast('สัญญาณไม่ค่อยดี กำลังเชื่อมต่อใหม่…');
  }
  if (st && st.phase === 'end') return;
  pollT = setTimeout(poll, POLL + Math.random() * (DEMO ? 100 : 600));
}

function header(s) {
  $('#me').hidden = false; $('#meAv').textContent = avatar(me.av); $('#meName').textContent = s.name; $('#meScore').textContent = s.score.toLocaleString();
}

let prevRank = 0, prevScore = 0, SELF = false;
function render(s) {
  const prev = st; st = s; header(s);
  if (s.phase === 'self') { if (!SELF && lastKey !== 'self' && lastKey !== 'self-end') { lastKey = 'self'; backdrop(s.theme || 'class'); vSelfHome(s); } return; }
  if (SELF && s.phase !== 'end') return;
  if (SELF && s.phase === 'end') { SELF = false; clearInterval(timerT); }
  backdrop(s.theme || 'class');
  const key = `${s.phase}:${s.idx}:${s.phase === 'question' ? s.answered : ''}`;
  if (key === lastKey) { if (s.phase === 'question' && !s.answered) syncTimer(s.left); if (s.phase === 'lobby') $('#nPl') && ($('#nPl').textContent = s.players); return; }
  const firstView = !lastKey || (prev && prev.phase === 'reveal' && s.phase === 'board');
  lastKey = key;
  clearInterval(timerT);
  s._t = performance.now();
  const fn = () => {
    if (s.phase === 'lobby') return vLobby(s);
    if (s.phase === 'question') return s.answered ? vSent(s) : vQuestion(s);
    if (s.phase === 'reveal' || s.phase === 'board') return vResult(s, prev);
    if (s.phase === 'end') return vEnd(s);
  };
  const newStage = s.stage && (!prev || !prev.stage || prev.stage.no !== s.stage.no) && s.phase === 'question';
  const label = s.phase === 'question' && !s.answered ? (newStage ? `${s.stage.ic} ${s.stage.n}` : `ข้อ ${s.idx + 1}`) : s.phase === 'end' ? '🏆' : '';
  if (firstView || s.phase === 'lobby' || (s.phase === 'question' && s.answered)) fn(); else swap(fn, label);
}

function vLobby(s) {
  view.innerHTML = `<div class="center rise" style="display:flex;flex-direction:column;gap:16px;align-items:center">
    <div class="wait-av">${avatar(me.av)}</div>
    <h1>สวัสดี ${esc(s.name)}!</h1>
    <p class="chip">✅ ชื่อของเธอขึ้นบนจอแล้ว</p>
    <div class="card" style="padding:16px 22px"><b>${esc(s.title)}</b><br><span class="muted">${s.total} ข้อ · เพื่อนในห้อง <b id="nPl">${s.players}</b> คน</span></div>
    <p class="muted">รอคุณครูเริ่มเกม</p><div class="dots"><span></span><span></span><span></span></div>
    <p class="muted" style="font-size:14px">ส่งอีโมจิขึ้นจอครู 👇</p>
    <div class="reacts">${window.CQ.EMOJI.map((e, i) => `<button data-e="${i}" aria-label="ส่ง ${e}">${e}</button>`).join('')}</div>
    <button class="btn ghost sm" id="bLeave">เปลี่ยนชื่อ / ออกจากห้อง</button></div>`;
  let lastRx = 0;
  $$('.reacts button').forEach((b) => b.addEventListener('click', () => {
    floatEmoji(b.textContent, '', 0.2 + Math.random() * 0.6);
    if (navigator.vibrate) navigator.vibrate(15);
    if (Date.now() - lastRx < 1200) return; lastRx = Date.now();
    call('react', { pin: me.pin, pid: me.pid, e: +b.dataset.e }).catch(() => {});
  }));
  $('#bLeave').onclick = () => { SS.set('me', { ...me, pid: '' }); me = { ...me, pid: '' }; lastKey = ''; showJoin(); };
}

// ===================================================== ข้อแบบเติมตาราง / จับคู่ (มือถือ)
const stChip = (s) => (s.stage ? `<span class="chip stg-chip st-${esc(s.stage.th || '')}">${esc(s.stage.ic)} ด่าน ${s.stage.no}</span>` : '');
const dNo = (s) => (s.dno != null ? `${s.dno}/${s.dtot}` : `${s.idx + 1}/${s.total}`);
function imgHTML(q) { return q.img ? `<figure class="qimg" data-zoom="1"><img src="${esc(q.img)}" alt="ภาพประกอบโจทย์" loading="eager"><span>🔍 แตะเพื่อขยาย</span></figure>` : ''; }
document.addEventListener('click', (e) => {
  const f = e.target.closest('[data-zoom]'); if (!f) return;
  const src = f.querySelector('img').src, ov = document.createElement('div'); ov.className = 'zoom';
  ov.innerHTML = `<img src="${esc(src)}" alt=""><span>แตะเพื่อปิด</span>`; ov.onclick = () => ov.remove(); document.body.appendChild(ov);
});
function qHead(s, label) {
  return `<div class="pq-head"><span class="chip">${label} ${dNo(s)}</span>${stChip(s)}<span id="tLeft" class="chip">⏱ ${Math.ceil(s.left / 1000)}</span></div>
    <div class="tbar" id="tbar"><i></i></div>`;
}
function phoneTimer(s, onEnd) {
  const bar = $('#tbar i'), total = s.q.t * 1000;
  timerT = setInterval(() => {
    const left = Math.max(0, deadline - performance.now());
    bar.style.transform = `scaleX(${left / total})`; $('#tbar').classList.toggle('low', left < 5000);
    $('#tLeft').textContent = '⏱ ' + Math.ceil(left / 1000);
    if (left <= 0) { clearInterval(timerT); onEnd(); if (SELF) selfSubmit(null, s.idx); }
  }, 100);
}
async function sendX(choice, idx, icon) {
  clearInterval(timerT); if (navigator.vibrate) navigator.vibrate(30);
  if (SELF) return selfSubmit(choice, idx);
  vSent({ ...st, icon }); lastKey = `question:${idx}:true`;
  try { const r = await call('answer', { pin: me.pin, pid: me.pid, idx, choice }); if (r.late) toast('หมดเวลาแล้ว ไม่ทันข้อนี้ 😅'); }
  catch (err) { toast(err.message); lastKey = ''; }
}
function vFill(s) {
  const q = s.q, n1 = q.cols, n2 = q.rows, hx = q.hx;
  const A = { h1: Array(n1).fill(''), h2: Array(n2).fill(''), c: Array(n1 * n2).fill('') };
  const alle = q.opts.filter((o) => o.length === 1), geno = q.opts.filter((o) => o.length === 2);
  let sel = hx ? alle[0] : geno[0];
  deadline = (s._t || performance.now()) + s.left;
  const slot = (kind, i, txt) => `<button class="fs ${kind === 'c' ? 'cell' : 'hd'}" data-kind="${kind}" data-i="${i}">${txt}</button>`;
  view.innerHTML = `${qHead(s, '🧬')}
    <div class="card pq-text rise">${wordsHTML(q.q, esc)}</div>${imgHTML(q)}
    <div class="fparents">${[0, 1].map((i) => `<div><div class="pfox">${foxSVG(q.fur[i])}</div><span>${esc(q.pl[i] || '')}</span></div>`).join('<b>×</b>')}</div>
    <div class="fgrid" style="--c:${n1}"><table><tr><th class="corner">♀\\♂</th>${Array.from({ length: n1 }, (_, i) => `<th>${hx ? slot('h1', i, '?') : esc(q.h1[i])}</th>`).join('')}</tr>
      ${Array.from({ length: n2 }, (_, r) => `<tr><th>${hx ? slot('h2', r, '?') : esc(q.h2[r])}</th>${Array.from({ length: n1 }, (_, c) => `<td>${slot('c', r * n1 + c, '')}</td>`).join('')}</tr>`).join('')}</table></div>
    <div class="palette">${hx ? `<small>เซลล์สืบพันธุ์</small>${alle.map((o) => `<button class="pc-chip al" data-v="${esc(o)}">${esc(o)}</button>`).join('')}<i></i>` : ''}
      <small>ลูก</small>${geno.map((o) => `<button class="pc-chip ${/[A-Z]/.test(o) ? 'dom' : 'rec'}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>
    <div class="fbtns"><button class="btn ghost sm" id="fClear">ล้าง</button><button class="btn go" id="fSend" disabled>ส่งคำตอบ ✔</button></div>`;
  const paint = () => {
    $$('.pc-chip').forEach((b) => b.classList.toggle('on', b.dataset.v === sel));
    $$('.fs').forEach((b) => { const v = A[b.dataset.kind][+b.dataset.i]; b.textContent = v || (b.dataset.kind === 'c' ? '' : '?'); b.classList.toggle('filled', !!v);
      b.classList.toggle('dom', /[A-Z]/.test(v)); b.classList.toggle('rec', !!v && !/[A-Z]/.test(v)); });
    $('#fSend').disabled = !(A.c.every(Boolean) && (!hx || (A.h1.every(Boolean) && A.h2.every(Boolean))));
  };
  $$('.pc-chip').forEach((b) => b.addEventListener('click', () => { sel = b.dataset.v; paint(); if (navigator.vibrate) navigator.vibrate(8); }));
  $$('.fs').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.kind, i = +b.dataset.i, need = k === 'c' ? 2 : 1;
    if (!sel || sel.length !== need) return toast(k === 'c' ? 'ช่องลูกต้องใส่จีโนไทป์ 2 ตัว เช่น Bb' : 'หัวตารางต้องใส่เซลล์สืบพันธุ์ 1 ตัว เช่น B');
    A[k][i] = A[k][i] === sel ? '' : sel; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); paint();
  }));
  $('#fClear').onclick = () => { A.h1.fill(''); A.h2.fill(''); A.c.fill(''); paint(); };
  $('#fSend').onclick = () => sendX(hx ? [...A.h1, ...A.h2, ...A.c] : A.c.slice(), s.idx, '🧬');
  paint();
  phoneTimer(s, () => { $$('.fs,.pc-chip,#fSend').forEach((b) => (b.disabled = true)); });
}
const PAIR_COL = ['#FF6B6B', '#FFB627', '#2EC4B6', '#7B61FF', '#FF8FB8', '#5BBF5A'];
function vMatch(s) {
  const q = s.q, n = q.L.length, P = Array(n).fill(-1), TH = 'กขคงจฉ';
  let selL = null;
  deadline = (s._t || performance.now()) + s.left;
  view.innerHTML = `${qHead(s, '🔗')}
    <div class="card pq-text rise">${wordsHTML(q.q, esc)}</div>${imgHTML(q)}
    <p class="mhint">แตะคำด้านซ้าย แล้วแตะคู่ของมันด้านขวา</p>
    <div class="mgrid"><div class="mc">${q.L.map((x, i) => `<button class="mi l" data-l="${i}"><b>${i + 1}</b><span>${esc(x)}</span><em></em></button>`).join('')}</div>
      <div class="mc">${q.R.map((x, j) => `<button class="mi r" data-r="${j}"><b>${TH[j]}</b><span>${esc(x)}</span></button>`).join('')}</div></div>
    <div class="fbtns"><button class="btn ghost sm" id="mClear">ล้าง</button><button class="btn go" id="mSend" disabled>ส่งคำตอบ ✔</button></div>`;
  const paint = () => {
    $$('.mi.l').forEach((b) => { const i = +b.dataset.l, j = P[i]; b.classList.toggle('sel', selL === i); b.style.setProperty('--pc', j >= 0 ? PAIR_COL[i % 6] : 'transparent');
      b.classList.toggle('paired', j >= 0); b.querySelector('em').textContent = j >= 0 ? TH[j] : ''; });
    $$('.mi.r').forEach((b) => { const j = +b.dataset.r, i = P.indexOf(j); b.style.setProperty('--pc', i >= 0 ? PAIR_COL[i % 6] : 'transparent'); b.classList.toggle('paired', i >= 0); });
    $('#mSend').disabled = P.some((x) => x < 0);
  };
  $$('.mi.l').forEach((b) => b.addEventListener('click', () => { const i = +b.dataset.l; if (P[i] >= 0) P[i] = -1; selL = i; paint(); }));
  $$('.mi.r').forEach((b) => b.addEventListener('click', () => {
    const j = +b.dataset.r;
    if (selL == null) { const i = P.indexOf(j); if (i >= 0) { P[i] = -1; selL = i; paint(); } else toast('แตะคำด้านซ้ายก่อนนะ'); return; }
    const other = P.indexOf(j); if (other >= 0) P[other] = -1;
    P[selL] = j; if (navigator.vibrate) navigator.vibrate(12);
    const nx = P.findIndex((x, k) => x < 0 && k !== selL); selL = nx >= 0 ? nx : null; paint();
  }));
  $('#mClear').onclick = () => { P.fill(-1); selL = 0; paint(); };
  $('#mSend').onclick = () => sendX(P.slice(), s.idx, '🔗');
  selL = 0; paint();
  phoneTimer(s, () => { $$('.mi,#mSend').forEach((b) => (b.disabled = true)); });
}
function detailHTML(r) {
  if (r.type === 'fill' && r.key) {
    const n1 = r.cols, n2 = r.rows, off = r.hx ? n1 + n2 : 0, mine = Array.isArray(r.choice) ? r.choice : [], it = r.items || [];
    const cell = (i) => { const ok = it[i], v = mine[i] || '–'; return `<td class="${ok ? 'y' : 'n'}">${esc(v)}${ok ? '' : `<small>${esc(r.key[i])}</small>`}</td>`; };
    const hd = (i, fixed) => (r.hx ? cell(i).replace('<td', '<th') .replace('</td>', '</th>') : `<th>${esc(fixed)}</th>`);
    return `<div class="card rdet"><b>ตารางของฉัน</b><table class="rgrid"><tr><th></th>${Array.from({ length: n1 }, (_, c) => hd(c, r.h1[c])).join('')}</tr>
      ${Array.from({ length: n2 }, (_, rr) => `<tr>${hd(n1 + rr, r.h2[rr])}${Array.from({ length: n1 }, (_, c) => cell(off + rr * n1 + c)).join('')}</tr>`).join('')}</table>
      <small class="muted">ช่องแดง = ผิด (ตัวเล็กคือคำตอบที่ถูก)</small></div>`;
  }
  if (r.type === 'match' && r.pairs) {
    const it = r.items || [];
    return `<div class="card rdet"><b>คู่ที่ถูกต้อง</b>${r.pairs.map((p, i) => `<div class="rpair ${it[i] ? 'y' : 'n'}"><span>${it[i] ? '✓' : '✗'}</span><b>${esc(p.l)}</b><i>→</i>${esc(p.r)}</div>`).join('')}</div>`;
  }
  return '';
}

// ===================================================== โหมดนักเรียนเล่นเอง
let selfStage = null, submitting = -1;
function vSelfHome(s) {
  if (s.mode === 'station') {
    const want = ST_PARAM;
    const curOpen = s.me && s.me.cur != null && (s.stations || []).find((x) => String(x.k) === String(s.me.cur) && !x.done);
    if (curOpen) return vStationGo(s, curOpen);
    if (want >= 1 && !(s.stations || []).find((x) => x.k === want - 1 && x.done) && (s.me.cur == null || s.rotate)) { ST_PARAM = 0; return startStation(want - 1); }
    return vStations(s.stations || [], s);
  }
  const m = s.me || { i: 0 }, started = m.i > 0;
  view.innerHTML = `<div class="center rise selfhome">
    <div class="wait-av">${avatar(me.av)}</div>
    <h1>สวัสดี ${esc(s.name)}!</h1>
    <div class="card sh-card"><small>ภารกิจ</small><b>${esc(s.title)}</b>
      <div class="sh-stats"><div><b>${s.total}</b><small>ข้อ</small></div><div><b>${m.i}/${s.total}</b><small>ทำแล้ว</small></div><div><b>${(m.s || 0).toLocaleString()}</b><small>คะแนน</small></div></div>
      <p class="muted">🏃 ทำได้ตามจังหวะของตัวเอง · แต่ละข้อมีเวลาจำกัด · รู้ผลทันทีหลังตอบ</p></div>
    <button class="mj-go" id="bSelf"><span>${m.done ? 'ดูผลของฉัน' : started ? 'ทำต่อ' : 'เริ่มภารกิจ'}</span><i>${m.done ? '🏆' : '▶'}</i></button>
    <button class="btn ghost sm" id="bLeave">เปลี่ยนชื่อ / ออกจากห้อง</button></div>`;
  $('#bSelf').onclick = () => { SELF = true; selfNext(); };
  $('#bLeave').onclick = () => { SS.set('me', { ...me, pid: '' }); me = { ...me, pid: '' }; lastKey = ''; showJoin(); };
}
function vStations(list, s) {
  SELF = false; lastKey = 'self';
  const doneN = list.filter((x) => x.done).length;
  view.innerHTML = `<div class="center rise stpick">
    <div class="wait-av">${avatar(me.av)}</div><h1>${doneN ? 'เลือกฐานต่อไป' : 'เลือกฐานของฉัน'}</h1>
    <p class="muted">${doneN ? `ผ่านแล้ว ${doneN}/${list.length} ฐาน · คะแนนรวม ${(st && st.score || 0).toLocaleString()}` : 'แตะฐานที่คุณครูกำหนดให้กลุ่มของเรา'}</p>
    <div class="stgrid">${list.map((x) => `<button class="stc st-${esc(x.th || '')} ${x.done ? 'done' : ''}" data-st="${x.k}" ${x.done ? 'disabled' : ''}>
      <span class="stc-ic">${esc(x.ic)}</span><small>ฐานที่ ${x.k + 1}</small><b>${esc(x.n)}</b><em>${x.done ? `✅ ผ่านแล้ว · ${x.s.toLocaleString()} คะแนน` : `${x.total} ข้อ${x.i ? ` · ทำแล้ว ${x.i}` : ''}`}</em></button>`).join('')}</div></div>`;
  $$('.stc[data-st]').forEach((b) => (b.onclick = () => startStation(+b.dataset.st)));
}
function vStationGo(s, x) {
  SELF = false; lastKey = 'self';
  view.innerHTML = `<div class="center rise selfhome"><div class="wait-av">${avatar(me.av)}</div><h1>สวัสดี ${esc(s.name)}!</h1>
    <div class="card sh-card st-${esc(x.th || '')}"><small>ฐานที่ ${x.k + 1}</small><b>${esc(x.ic)} ${esc(x.n)}</b><p class="muted">ทำไปแล้ว ${x.i}/${x.total} ข้อ</p></div>
    <button class="mj-go" id="bSelf"><span>ทำต่อ</span><i>▶</i></button></div>`;
  $('#bSelf').onclick = () => { SELF = true; selfStage = null; selfNext(); };
}
async function startStation(k) {
  try { await call('sstart', { pin: me.pin, pid: me.pid, st: k }); SELF = true; selfStage = null; history.replaceState(null, '', location.pathname + '?pin=' + me.pin); selfNext(); }
  catch (e) { toast(e.message); }
}
async function selfNext(force) {
  try {
    const pk = force ? null : await call('squestion', { pin: me.pin, pid: me.pid, peek: true });
    if (pk && pk.pick) { SELF = false; return vStations(pk.stations, st); }
    if (pk && pk.done) return swap(() => vSelfEnd(pk), '🏆');
    if (pk && pk.peek && pk.stage && (!selfStage || selfStage.no !== pk.stage.no)) {
      selfStage = pk.stage; backdrop(pk.theme || 'class');
      return swap(() => vSelfStage(pk), `${pk.stage.ic} ${pk.stage.n}`);
    }
    const d = await call('squestion', { pin: me.pin, pid: me.pid });
    if (d.ended) { SELF = false; lastKey = ''; return toast('คุณครูปิดห้องแล้ว'); }
    if (d.pick) { SELF = false; return vStations(d.stations, st); }
    if (d.done) return swap(() => vSelfEnd(d), '🏆');
    const s = { ...st, phase: 'question', idx: d.idx, total: d.total, dno: d.pos + 1, dtot: d.n, q: d.q, left: d.left, stage: d.stage, theme: d.theme, _t: performance.now() };
    st = s; submitting = -1;
    selfStage = d.stage || selfStage;
    backdrop(d.theme || 'class');
    if (force) { s._t = performance.now(); return vQuestion(s); }
    swap(() => { s._t = performance.now(); vQuestion(s); }, `ข้อ ${d.idx + 1}`);
  } catch (e) { toast(e.message); }
}
function vSelfStage(d) {
  view.innerHTML = `<div class="center rise selfstage st-${esc(d.stage.th || '')}">
    <div class="ss-ic">${esc(d.stage.ic)}</div><small>ด่านที่ ${d.stage.no}</small><h1>${esc(d.stage.n)}</h1>
    ${d.stage.d ? `<p>${esc(d.stage.d)}</p>` : ''}<div class="hero-mascot">${mascotFor(d.theme)}</div>
    <button class="mj-go" id="bGoStage"><span>เริ่มด่าน</span><i>▶</i></button></div>`;
  $('#bGoStage').onclick = (e) => { e.target.closest('button').disabled = true; selfNext(true); };
}
async function selfSubmit(choice, idx) {
  if (submitting === idx) return; submitting = idx; clearInterval(timerT);
  try {
    const d = await call('sanswer', { pin: me.pin, pid: me.pid, idx, choice });
    if (d.ended) { SELF = false; lastKey = ''; return toast('คุณครูปิดห้องแล้ว'); }
    if (d.stale) return selfNext();
    swap(() => vSelfResult(d));
  } catch (e) { submitting = -1; toast(e.message); }
}
function vSelfResult(d) {
  const r = d.result, noAns = r.choice === -1, part = !r.ok && !noAns && r.frac > 0, nIt = (r.items || []).length, nOk = (r.items || []).filter(Boolean).length;
  view.innerHTML = `
    <div class="res ${r.ok ? 'ok' : part ? 'part' : 'bad'}">
      <div class="icon">${r.ok ? '🎉' : noAns ? '⏰' : part ? '✨' : '💪'}</div>
      <h1>${r.ok ? (nIt ? 'ถูกครบทุกช่อง!' : 'ถูกต้อง!') : noAns ? 'หมดเวลา' : part ? `เกือบแล้ว! ถูก ${nOk}/${nIt}` : 'ยังไม่ถูก'}</h1>
      <span class="pts">+<span id="gain">0</span></span>
      ${r.ok || r.type !== 'mc' ? '' : `<div class="ans">คำตอบที่ถูก: ${esc(r.answerText || '')}</div>`}
    </div>
    ${r.ok ? '' : detailHTML(r)}
    ${d.streak >= 2 ? `<div class="center"><span class="streak"><span class="fire">🔥</span> ตอบถูกติดกัน ${d.streak} ข้อ</span></div>` : ''}
    ${r.explain ? `<div class="card explain rise">💡 ${esc(r.explain)}</div>` : ''}
    <div class="card selfprog"><div class="sp-bar"><i style="width:${((d.pos + 1) / d.n) * 100}%"></i></div>
      <span>ข้อ ${d.pos + 1}/${d.n}</span><span>อันดับตอนนี้ <b>${d.rank}</b>/${d.players}</span></div>
    <button class="mj-go" id="bNextQ"><span>${d.done ? 'ดูผลสรุป' : 'ข้อต่อไป'}</span><i>${d.done ? '🏆' : '▶'}</i></button>`;
  countUp($('#gain'), 0, r.gained, 800);
  countUp($('#meScore'), prevScore, d.score, 1000); prevScore = d.score;
  if (navigator.vibrate) navigator.vibrate(r.ok ? [40, 60, 40] : 200);
  if (r.ok) { confetti(70); setTimeout(() => sparkle($('.res'), 10), 300); } else if (st.theme === 'snow') setTimeout(() => blizzard(1000), 300);
  $('#bNextQ').onclick = () => selfNext();
}
function vSelfEnd(d) {
  if (d.stations) return vStationEnd(d);
  SELF = false; lastKey = 'self-end';
  const medal = d.rank === 1 ? '🥇' : d.rank === 2 ? '🥈' : d.rank === 3 ? '🥉' : '🏅';
  const gems = (d.stages || []).map((x, k) => { const ix = (d.stq || []).map((s2, i) => (s2 === k ? i : -1)).filter((i) => i >= 0 && d.f[i] != null);
    const ok = ix.length && ix.reduce((a, i) => a + d.f[i], 0) / ix.length >= 0.5; return `<span class="${ok ? 'got' : ''}" title="${esc(x.n)}">${esc(x.ic)}</span>`; }).join('');
  view.innerHTML = `<div class="center" style="display:flex;flex-direction:column;gap:14px;align-items:center">
    <div class="final-medal">${medal}</div><h1>ภารกิจสำเร็จ!</h1>
    <div class="card rankcard" style="width:100%"><div class="rk">${d.rank}</div><div style="text-align:left">
      <b style="font-size:20px">อันดับที่ ${d.rank} จาก ${d.players} คน <small style="display:inline">(ตอนนี้)</small></b>
      <small>คะแนน ${d.score.toLocaleString()} · ตอบถูก ${d.correct}/${d.total} ข้อ</small></div></div>
    ${gems ? `<div class="card mygems"><small>คริสตัลธาตุของฉัน</small><div>${gems}</div></div>` : ''}
    <div class="hero-mascot">${mascotFor(st.theme)}</div>
    <p class="muted">ผลจะบันทึกให้คุณครูแล้ว ✨ รอคุณครูประกาศผลบนจอได้เลย</p></div>`;
  confetti(140); if (d.rank <= 3) fireworks(3500);
}

function vStationEnd(d) {
  SELF = false; lastKey = 'self-end';
  const left = d.stations.filter((x) => !x.done), X = d.station || {};
  view.innerHTML = `<div class="center" style="display:flex;flex-direction:column;gap:14px;align-items:center">
    <div class="final-medal">${esc(X.ic || '🏅')}</div><h1>ผ่านฐาน${esc(X.n || '')}!</h1>
    <div class="card rankcard" style="width:100%"><div class="rk">${d.stationCorrect}/${d.total}</div><div style="text-align:left">
      <b style="font-size:19px">ได้ ${d.stationScore.toLocaleString()} คะแนนในฐานนี้</b>
      <small>คะแนนรวม ${d.score.toLocaleString()} · อันดับ ${d.rank}/${d.players} (ตอนนี้)</small></div></div>
    <div class="card mygems"><small>ฐานที่ผ่านแล้ว</small><div>${d.stations.map((x) => `<span class="${x.done ? 'got' : ''}" title="${esc(x.n)}">${esc(x.ic)}</span>`).join('')}</div></div>
    ${left.length && d.rotate ? `<p class="muted">เมื่อคุณครูให้สัญญาณ ไปฐานต่อไปได้เลย</p><button class="mj-go" id="bMore"><span>เลือกฐานต่อไป</span><i>🧭</i></button>`
      : `<div class="hero-mascot">${mascotFor(st.theme)}</div><p class="muted">${left.length ? 'รอคุณครูให้สัญญาณนะ ✨' : 'ผ่านครบทุกฐานแล้ว! สุดยอด 🎉'}</p>`}</div>`;
  confetti(120); if (!left.length) fireworks(3500);
  if ($('#bMore')) $('#bMore').onclick = () => vStations(d.stations, st);
}

function syncTimer(left) { deadline = performance.now() + left; }
function vQuestion(s) {
  if (s.q.type === 'fill') return vFill(s);
  if (s.q.type === 'match') return vMatch(s);
  const q = s.q, two = q.c.length === 2;
  deadline = (s._t || performance.now()) + s.left;
  view.innerHTML = `
 <div class="pq-head"><span class="chip">ข้อ ${dNo(s).replace('/', ' / ')}</span>${stChip(s)}<span id="tLeft" class="chip">⏱ ${Math.ceil(s.left / 1000)}</span></div>
    <div class="tbar" id="tbar"><i></i></div>
    <div class="card pq-text rise">${wordsHTML(q.q, esc)}</div>${imgHTML(q)}
    <div class="pans ${two ? 'two' : ''}">${q.c.map((c, i) => `<button class="o${i}" data-i="${i}">${shape(i)}<span>${esc(c)}</span></button>`).join('')}</div>`;
  $$('.pans button').forEach((b) => b.addEventListener('click', () => send(Number(b.dataset.i), s.idx)));
  const bar = $('#tbar i'), total = q.t * 1000;
  timerT = setInterval(() => {
    const left = Math.max(0, deadline - performance.now());
    bar.style.transform = `scaleX(${left / total})`;
    $('#tbar').classList.toggle('low', left < 5000);
    $('#tLeft').textContent = '⏱ ' + Math.ceil(left / 1000);
    if (left <= 0) { clearInterval(timerT); $$('.pans button').forEach((b) => (b.disabled = true)); if (SELF) selfSubmit(null, s.idx); }
  }, 100);
}

async function send(choice, idx) {
  $$('.pans button').forEach((b) => (b.disabled = true));
  if (navigator.vibrate) navigator.vibrate(30);
  clearInterval(timerT);
  const box = $('.pans'); box.classList.add('picked'); box.children[choice].classList.add('sel');
  if (SELF) return setTimeout(() => selfSubmit(choice, idx), REDUCED ? 0 : 420);
  setTimeout(() => vSent({ ...st, picked: choice }), REDUCED ? 0 : 480);
  lastKey = `question:${idx}:true`;
  try {
    const r = await call('answer', { pin: me.pin, pid: me.pid, idx, choice });
    if (r.late) toast('หมดเวลาแล้ว ไม่ทันข้อนี้ 😅');
  } catch (err) { toast(err.message); lastKey = ''; }
}

function vSent(s) {
  const i = s.picked;
  view.innerHTML = `<div class="sent center rise" style="display:flex;flex-direction:column;gap:18px">
    ${s.icon ? `<div class="big-shape o2">${s.icon}</div>` : i != null ? `<div class="big-shape o${i}">${shape(i)}</div>` : `<div class="wait-av">${avatar(me.av)}</div>`}
    <h1>ส่งคำตอบแล้ว!</h1><p class="muted">รอดูเฉลยบนจอนะ…</p><div class="dots"><span></span><span></span><span></span></div></div>`;
}

function vResult(s, prev) {
  const r = s.result || { ok: false, gained: 0, choice: -1 };
  const noAns = r.choice === -1, part = !r.ok && !noAns && r.frac > 0, nIt = (r.items || []).length, nOk = (r.items || []).filter(Boolean).length;
  view.innerHTML = `
    <div class="res ${r.ok ? 'ok' : part ? 'part' : 'bad'}">
      <div class="icon">${r.ok ? '🎉' : noAns ? '⏰' : part ? '✨' : '💪'}</div>
      <h1>${r.ok ? (nIt ? 'ถูกครบทุกช่อง!' : 'ถูกต้อง!') : noAns ? 'ไม่ทันข้อนี้' : part ? `เกือบแล้ว! ถูก ${nOk}/${nIt}` : 'ยังไม่ถูก'}</h1>
      <span class="pts">+<span id="gain">0</span></span>
      ${r.ok || r.type === 'fill' || r.type === 'match' ? '' : `<div class="ans">คำตอบที่ถูก: ${esc(r.answerText || '')}</div>`}
    </div>
    ${r.ok ? '' : detailHTML(r)}
    ${s.streak >= 2 ? `<div class="center"><span class="streak"><span class="fire">🔥</span> ตอบถูกติดกัน ${s.streak} ข้อ${s.streak >= 3 ? ' · โบนัส +100' : ''}</span></div>` : ''}
    <div class="card rankcard rise"><div class="rk">${s.rank}</div><div>
      <b style="font-size:20px">อันดับที่ ${s.rank} จาก ${s.players} คน${prevRank && s.rank < prevRank ? `<span class="rk-up">▲ ${prevRank - s.rank}</span>` : ''}</b>
      <small>${s.behind ? `ตามหลัง ${esc(s.behind.name)} อยู่ ${s.behind.by.toLocaleString()} คะแนน` : 'อยู่อันดับ 1 ตอนนี้! 👑'}</small></div></div>
    ${r.explain ? `<div class="card explain rise">💡 ${esc(r.explain)}</div>` : ''}`;
  if (navigator.vibrate) navigator.vibrate(r.ok ? [40, 60, 40] : 200);
  const fresh = !prev || prev.phase === 'question';
  countUp($('#gain'), fresh ? 0 : r.gained, r.gained, 900);
  countUp($('#meScore'), fresh ? prevScore : s.score, s.score, 1100);
  if (r.ok && fresh) { confetti(80); setTimeout(() => sparkle($('.res'), 12), 300); }
  if (!r.ok && fresh && s.theme === 'snow') setTimeout(() => blizzard(1200), 300);
  if (fresh) { prevRank = s.rank; prevScore = s.score; }
}

function vEnd(s) {
  stopPoll();
  const medal = s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : '🏅';
  view.innerHTML = `<div class="center" style="display:flex;flex-direction:column;gap:16px;align-items:center">
    <div class="final-medal">${medal}</div>
    <h1>${s.rank <= 3 ? 'สุดยอดไปเลย!' : 'เก่งมาก!'}</h1>
    <div class="card rankcard" style="width:100%"><div class="rk">${s.rank}</div><div style="text-align:left">
      <b style="font-size:20px">อันดับที่ ${s.rank} จาก ${s.players} คน</b>
      <small>คะแนน ${s.score.toLocaleString()} · ตอบถูก ${s.correct}/${s.total} ข้อ</small></div></div>
    <div class="hero-mascot">${mascotFor(s.theme)}</div>
    <p class="muted">${['snow', 'fire', 'earth', 'wind'].includes(s.theme) ? 'จ่าฝูงจิ้งจอกขอบใจนักสำรวจทุกคน 🦊' : 'ขอบคุณที่ร่วมผจญภัยกันนะ ✨'}</p>
    <button class="btn sun" id="bAgain">เข้าห้องใหม่</button></div>`;
  if (s.rank <= 3) { confetti(160); fireworks(4000); }
  $('#bAgain').onclick = () => { me = { ...me, pid: '', pin: '' }; SS.set('me', me); lastKey = ''; history.replaceState(null, '', location.pathname); showJoin(); };
}

document.addEventListener('visibilitychange', () => { if (!document.hidden && me && me.pid && pollT) { stopPoll(); poll(); } });
const urlPin = new URLSearchParams(location.search).get('pin');
if (me && me.pid && me.pin && (!urlPin || urlPin === me.pin)) startPoll(); else showJoin();
