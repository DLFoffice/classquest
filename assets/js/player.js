// จอนักเรียน: เข้าห้อง → รอ → ตอบ → ดูผล → อันดับสุดท้าย
import { call, DEMO } from './api.js';
import { $, $$, esc, shape, AVATARS, avatar, MASCOT, mascotFor, confetti, toast, uid, sleep } from './ui.js';
import { backdrop, blizzard, swap, wordsHTML, countUp, sparkle, fireworks, floatEmoji, REDUCED } from './fx.js';

const view = $('#view');
const CFG = window.CQ_CONFIG || {};
$('#brandName').textContent = CFG.APP_NAME || 'ห้องเรียนผจญภัย';
const SS = { get: (k) => { try { return JSON.parse(sessionStorage.getItem('cqp:' + k)); } catch (e) { return null; } },
  set: (k, v) => { try { sessionStorage.setItem('cqp:' + k, JSON.stringify(v)); } catch (e) {} } };

let me = SS.get('me'); // { pin, pid, name, av }
let st = null, lastKey = '', pollT = null, timerT = null, deadline = 0, failCount = 0;
const POLL = DEMO ? 700 : 1800;

// ===================================================== เข้าห้อง
function showJoin(err) {
  stopPoll();
  $('#me').hidden = true;
  const pinQ = new URLSearchParams(location.search).get('pin') || (me && me.pin) || '';
  const av = me ? me.av : Math.floor(Math.random() * AVATARS.length);
  view.innerHTML = `
    <div class="hero-mascot rise">${MASCOT}</div>
    <h1 class="center rise">พร้อมผจญภัยหรือยัง?</h1>
    <form class="card join-card rise" id="fJoin" autocomplete="off">
      <span class="tape"></span>
      <label class="label" for="iPin">รหัสห้อง (ดูบนจอครู)</label>
      <input class="input pin-input" id="iPin" inputmode="numeric" maxlength="4" pattern="\\d{4}" value="${esc(pinQ)}" placeholder="0000" required>
      <label class="label" for="iName" style="margin-top:14px">ชื่อเล่นของฉัน</label>
      <input class="input" id="iName" maxlength="20" value="${esc(me ? me.name : '')}" placeholder="เช่น น้องมะลิ" required>
      <p class="label" style="margin-top:14px">เลือกตัวละคร</p>
      <div class="avs" role="radiogroup">${AVATARS.map((a, i) => `<button type="button" role="radio" aria-checked="${i === av}" data-i="${i}">${a}</button>`).join('')}</div>
      <button class="btn go big" style="width:100%;margin-top:18px" id="bJoin">เข้าห้องเลย 🚀</button>
    </form>`;
  $$('.avs button').forEach((b) => b.addEventListener('click', () => { $$('.avs button').forEach((x) => x.setAttribute('aria-checked', x === b)); }));
  $('#iPin').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); if (e.target.value.length === 4 && !$('#iName').value) $('#iName').focus(); });
  $('#fJoin').addEventListener('submit', onJoin);
  if (err) toast(err);
}

async function onJoin(e) {
  e.preventDefault();
  const pin = $('#iPin').value.trim(), name = $('#iName').value.trim();
  const av = Number($('.avs [aria-checked="true"]').dataset.i);
  if (!/^\d{4}$/.test(pin)) return toast('รหัสห้องต้องเป็นตัวเลข 4 หลัก');
  if (!name) return toast('ใส่ชื่อเล่นก่อนนะ');
  const btn = $('#bJoin'); btn.disabled = true; btn.textContent = 'กำลังเข้าห้อง…';
  try {
    const pid = me && me.pin === pin ? me.pid : uid();
    const r = await call('join', { pin, pid, name, av });
    me = { pin, pid, name: r.name, av }; SS.set('me', me);
    history.replaceState(null, '', location.pathname + '?pin=' + pin);
    startPoll();
  } catch (err) {
    toast(err.message); btn.disabled = false; btn.textContent = 'เข้าห้องเลย 🚀';
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

let prevRank = 0, prevScore = 0;
function render(s) {
  const prev = st; st = s; header(s);
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
  const label = s.phase === 'question' && !s.answered ? `ข้อ ${s.idx + 1}` : s.phase === 'end' ? '🏆' : '';
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

function syncTimer(left) { deadline = performance.now() + left; }
function vQuestion(s) {
  const q = s.q, two = q.c.length === 2;
  deadline = (s._t || performance.now()) + s.left;
  view.innerHTML = `
    <div class="pq-head"><span class="chip">ข้อ ${s.idx + 1} / ${s.total}</span><span id="tLeft" class="chip">⏱ ${Math.ceil(s.left / 1000)}</span></div>
    <div class="tbar" id="tbar"><i></i></div>
    <div class="card pq-text rise">${wordsHTML(q.q, esc)}</div>
    <div class="pans ${two ? 'two' : ''}">${q.c.map((c, i) => `<button class="o${i}" data-i="${i}">${shape(i)}<span>${esc(c)}</span></button>`).join('')}</div>`;
  $$('.pans button').forEach((b) => b.addEventListener('click', () => send(Number(b.dataset.i), s.idx)));
  const bar = $('#tbar i'), total = q.t * 1000;
  timerT = setInterval(() => {
    const left = Math.max(0, deadline - performance.now());
    bar.style.transform = `scaleX(${left / total})`;
    $('#tbar').classList.toggle('low', left < 5000);
    $('#tLeft').textContent = '⏱ ' + Math.ceil(left / 1000);
    if (left <= 0) { clearInterval(timerT); $$('.pans button').forEach((b) => (b.disabled = true)); }
  }, 100);
}

async function send(choice, idx) {
  $$('.pans button').forEach((b) => (b.disabled = true));
  if (navigator.vibrate) navigator.vibrate(30);
  clearInterval(timerT);
  const box = $('.pans'); box.classList.add('picked'); box.children[choice].classList.add('sel');
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
    ${i != null ? `<div class="big-shape o${i}">${shape(i)}</div>` : `<div class="wait-av">${avatar(me.av)}</div>`}
    <h1>ส่งคำตอบแล้ว!</h1><p class="muted">รอดูเฉลยบนจอนะ…</p><div class="dots"><span></span><span></span><span></span></div></div>`;
}

function vResult(s, prev) {
  const r = s.result || { ok: false, gained: 0, choice: -1 };
  const noAns = r.choice === -1;
  view.innerHTML = `
    <div class="res ${r.ok ? 'ok' : 'bad'}">
      <div class="icon">${r.ok ? '🎉' : noAns ? '⏰' : '💪'}</div>
      <h1>${r.ok ? 'ถูกต้อง!' : noAns ? 'ไม่ทันข้อนี้' : 'ยังไม่ถูก'}</h1>
      <span class="pts">+<span id="gain">0</span></span>
      ${r.ok ? '' : `<div class="ans">คำตอบที่ถูก: ${esc(r.answerText || '')}</div>`}
    </div>
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
    <p class="muted">${s.theme === 'snow' ? 'จ่าฝูงจิ้งจอกขอบใจนักสำรวจทุกคน ❄️' : 'ขอบคุณที่ร่วมผจญภัยกันนะ ✨'}</p>
    <button class="btn sun" id="bAgain">เข้าห้องใหม่</button></div>`;
  if (s.rank <= 3) { confetti(160); fireworks(4000); }
  $('#bAgain').onclick = () => { me = { ...me, pid: '', pin: '' }; SS.set('me', me); lastKey = ''; history.replaceState(null, '', location.pathname); showJoin(); };
}

document.addEventListener('visibilitychange', () => { if (!document.hidden && me && me.pid && pollT) { stopPoll(); poll(); } });
const urlPin = new URLSearchParams(location.search).get('pin');
if (me && me.pid && me.pin && (!urlPin || urlPin === me.pin)) startPoll(); else showJoin();
