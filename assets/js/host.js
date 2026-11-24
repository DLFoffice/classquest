// จอครู: ตั้งค่าข้อคำถาม → ห้องรอ (PIN + QR) → คำถาม → เฉลย → อันดับ → โพเดียม
import { call, DEMO } from './api.js';
import { $, $$, esc, shape, avatar, MASCOT, FOX, FOX_THEMES, mascotFor, foxSVG, confetti, toast, sound, music, sleep } from './ui.js';
import { SAMPLE, SAMPLES, SOLAR, GENETICS, STAGES4 } from './sample.js';
import { parsePunnett, punnettHTML, buildFill, normGeno, FUR } from './punnett.js';
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
if (!LSget('v5', false)) { if (SET.title === GENETICS.title && !SET.stages) SET = clone(SAMPLE); LSset('v5', true); LSset('v4', true); LSset('set', SET); }
if (!LSget('v4', false)) { if (SET.title === SOLAR.title && !SET.story) SET = clone(SAMPLE); LSset('v4', true); LSset('set', SET); }
const M = () => (isFox() ? FOX : mascotFor((G && G.theme) || themeFor(SET.theme, SET.title)));
const isSnow = () => ((G && G.theme) || '') === 'snow';
const isFox = () => FOX_THEMES.includes((G && G.theme) || themeFor(SET.theme, SET.title)) || !!(G && G.stages && G.stages.length);
let KEY = SSget('key');
let PIN = SSget('pin');
let G = null, lastKey = '', pollT = null, timerT = null, deadline = 0, busy = false, revealing = false;
const POLL = DEMO ? 400 : 1000;

if (DEMO) { const d = document.createElement('div'); d.className = 'demo-badge'; d.textContent = 'โหมดทดลอง · เปิด index.html อีกแท็บเพื่อเป็นนักเรียน'; document.body.appendChild(d); }

// ===================================================== ตั้งค่าข้อคำถาม
const TIMES = [5, 10, 15, 20, 30, 45, 60, 90];
const save = () => { LSset('set', SET); dirty = true; updSaveSt(); };
const estMin = () => Math.max(1, Math.round(SET.questions.reduce((a, q) => a + (Number(q.t) || 20) + 20, 0) / 60));

const ICON = {
  up: '<svg viewBox="0 0 24 24"><path d="M12 5l-7 7h4.5v7h5v-7H19z"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 19l7-7h-4.5V5h-5v7H5z"/></svg>',
  dup: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none"/></svg>',
  del: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" fill="none"/></svg>',
};
const THEME_LABEL = { auto: 'อัตโนมัติตามชื่อกิจกรรม', snow: 'ด่านหิมะ', fire: 'ด่านอัคนี', earth: 'ด่านปฐพี', wind: 'ด่านวายุ', space: 'อวกาศ', nature: 'ธรรมชาติ', ocean: 'ใต้ทะเล', lab: 'ห้องทดลอง', math: 'คณิตคิดสนุก', class: 'ห้องเรียน' };
const THEME_ART = { auto: '✨', snow: '❄️', fire: '🔥', earth: '🌿', wind: '🌪️', space: '🪐', nature: '🌿', ocean: '🐠', lab: '🧪', math: '🔢', class: '✏️' };
const QUICK_T = [10, 20, 30, 45];

// ===================================================== คลังกิจกรรม (รายวิชา › กิจกรรม)
let LIBC = { subjects: [], items: [] }, libLoaded = false, dirty = false, savedAt = '';
const libSet = () => ({ title: SET.title, theme: SET.theme || 'auto', stages: SET.stages || [], story: SET.story || '', mode: SET.mode || 'live', rotate: SET.rotate !== false, questions: SET.questions });
const MODE_LABEL = { live: '🎮 เล่นสด', self: '🏃 เล่นเอง', station: '🏕️ แบบฐาน' };
const LIB_ART = { auto: '✨', snow: '❄️', fire: '🔥', earth: '🌿', wind: '🌪️', space: '🪐', nature: '🌿', ocean: '🐠', lab: '🧪', math: '🔢', class: '✏️' };
function vLogin(err) {
  view.innerHTML = `<form class="mj lib-login" id="fLogin"><div class="mj-hero"><div class="mj-m">${MASCOT}</div><div><small>ห้องเรียนผจญภัย</small><h1>คลังกิจกรรม<br>ของครู</h1></div></div>
    <div class="mj-body"><label class="mj-lbl" for="iKey0">รหัสครู (HOST_KEY)</label><div class="mj-in"><span>🔑</span><input id="iKey0" type="password" autocomplete="current-password" required></div>
    <button class="mj-go"><span>เข้าสู่คลังกิจกรรม</span><i>📚</i></button></div></form>`;
  $('#fLogin').onsubmit = async (e) => {
    e.preventDefault(); const k = $('#iKey0').value.trim();
    try { await call('check', { key: k }); KEY = k; SSset('key', k); showLibrary(); } catch (x) { toast(x.message); }
  };
  if (err) toast(err);
}
async function loadLib() {
  LIBC = await call('lib_list', { key: KEY }); libLoaded = true;
  if (SET.subject && !LIBC.subjects.includes(SET.subject)) LIBC.subjects.push(SET.subject);
}
async function showLibrary() {
  stopPoll(); music.stop(); backdrop('class'); $('#phaseChip').hidden = true;
  if (!DEMO && !KEY) return vLogin();
  view.innerHTML = `<div class="lib"><p class="lib-loading">กำลังโหลดคลังกิจกรรม…</p></div>`;
  try { await loadLib(); } catch (e) { if (/รหัสครู/.test(e.message)) { KEY = ''; SSset('key', ''); return vLogin(e.message); } toast(e.message); }
  renderLibrary();
}
function renderLibrary() {
  const S = LIBC.subjects.slice(), by = {};
  S.forEach((s) => (by[s] = []));
  LIBC.items.forEach((x) => { (by[x.subject] = by[x.subject] || []).push(x); if (!S.includes(x.subject)) S.push(x.subject); });
  Object.values(by).forEach((a) => a.sort((p, q) => String(q.updated).localeCompare(String(p.updated))));
  const draft = SET.questions && SET.questions.length && (!SET.libId || dirty);
  const card = (x) => `<article class="lc ${SET.libId === x.id ? 'cur' : ''}">
      <div class="lc-ban tp-${esc(x.theme || 'auto')}"><span>${LIB_ART[x.theme] || '✨'}</span>${SET.libId === x.id ? '<em>กำลังแก้ไข</em>' : ''}</div>
      <div class="lc-body"><b>${esc(x.title)}</b><small>${x.n} ข้อ · ${MODE_LABEL[x.mode] || MODE_LABEL.live}</small><small class="lc-when">แก้ไขล่าสุด ${esc(x.updated)}</small></div>
      <div class="lc-act"><button class="lc-open" data-lopen="${esc(x.id)}">✏️ เปิด</button><button data-ldup="${esc(x.id)}" title="ทำสำเนา">⧉</button><button data-ldel="${esc(x.id)}" title="ลบ">🗑</button></div></article>`;
  view.innerHTML = `<div class="lib">
    <header class="lib-hero"><div class="lib-m">${MASCOT}</div><div><small>ห้องเรียนผจญภัย</small><h1>คลังกิจกรรมของฉัน</h1>
      <p>${S.length} รายวิชา · ${LIBC.items.length} กิจกรรม${DEMO ? ' · โหมดทดลอง (เก็บในเครื่องนี้)' : ' · บันทึกใน Google Sheets'}</p></div>
      <div class="lib-acts"><button class="ed-go" id="bNewAct"><span>＋ กิจกรรมใหม่</span></button><button class="ed-ghost" id="bNewSubj">＋ รายวิชาใหม่</button></div></header>
    ${draft ? `<div class="lib-draft"><span>📝</span><div><b>${esc(SET.title || 'ไม่มีชื่อ')}</b><small>${SET.libId ? 'มีการแก้ไขที่ยังไม่บันทึก' : 'ชุดที่แก้ไว้ในเครื่องนี้ ยังไม่ได้บันทึกลงคลัง'} · ${SET.questions.length} ข้อ</small></div>
      <button class="ed-ghost" id="bDraftOpen">เปิดแก้ไขต่อ</button><button class="ed-go sm" id="bDraftSave">💾 บันทึกลงคลัง</button></div>` : ''}
    ${S.length ? S.map((s) => `<section class="lib-sub"><div class="ls-head"><h2>📘 ${esc(s)}</h2><span>${by[s].length} กิจกรรม</span>
        <button class="ls-btn" data-sren="${esc(s)}" title="เปลี่ยนชื่อวิชา">✏️</button>${by[s].length ? '' : `<button class="ls-btn" data-sdel="${esc(s)}" title="ลบวิชา">🗑</button>`}</div>
      <div class="lc-grid">${by[s].map(card).join('')}<button class="lc-add" data-snew="${esc(s)}"><span>＋</span>เพิ่มกิจกรรมในวิชานี้</button></div></section>`).join('')
      : `<div class="lib-empty"><div class="lib-m">${MASCOT}</div><h2>เริ่มจากสร้างรายวิชาแรก</h2><p>เช่น "วิทยาศาสตร์ ม.3/1" แล้วเพิ่มกิจกรรมเก็บไว้ได้หลายชุด</p><button class="ed-go" id="bFirstSubj"><span>＋ สร้างรายวิชา</span></button></div>`}
  </div>`;
  $('#bNewAct').onclick = () => newActivity(S[0] || '');
  $('#bNewSubj').onclick = newSubject; if ($('#bFirstSubj')) $('#bFirstSubj').onclick = newSubject;
  if ($('#bDraftOpen')) $('#bDraftOpen').onclick = () => showSetup();
  if ($('#bDraftSave')) $('#bDraftSave').onclick = async () => { if (!SET.subject) { const s = await pickSubject(); if (!s) return; SET.subject = s; } if (await saveCloud()) renderLibrary(); };
}
async function newSubject() {
  const n = (prompt('ชื่อรายวิชา (เช่น วิทยาศาสตร์ ม.3/1)') || '').trim(); if (!n) return;
  try { await call('subj_save', { key: KEY, name: n }); await loadLib(); renderLibrary(); toast('เพิ่มรายวิชาแล้ว'); } catch (e) { toast(e.message); }
}
function pickSubject(def) {
  return new Promise((res) => {
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="card lib-modal"><h2>เลือกรายวิชา</h2><select class="ed-in" id="pkS">${LIBC.subjects.map((s) => `<option ${s === def ? 'selected' : ''}>${esc(s)}</option>`).join('')}<option value="__new">＋ รายวิชาใหม่…</option></select>
      <input class="ed-in" id="pkN" placeholder="ชื่อรายวิชาใหม่" ${LIBC.subjects.length ? 'hidden' : ''}>
      <div class="lm-btns"><button class="ed-ghost" id="pkX">ยกเลิก</button><button class="ed-go sm" id="pkOk"><span>ตกลง</span></button></div></div>`;
    document.body.appendChild(m);
    if (!LIBC.subjects.length) $('#pkS', m).value = '__new';
    $('#pkS', m).onchange = () => { $('#pkN', m).hidden = $('#pkS', m).value !== '__new'; };
    const done = (v) => { m.remove(); res(v); };
    $('#pkX', m).onclick = () => done(null);
    $('#pkOk', m).onclick = async () => {
      let v = $('#pkS', m).value; if (v === '__new') { v = $('#pkN', m).value.trim(); if (!v) return toast('ใส่ชื่อรายวิชา'); try { await call('subj_save', { key: KEY, name: v }); LIBC.subjects.push(v); } catch (e) { return toast(e.message); } }
      done(v);
    };
  });
}
function newActivity(subject) {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="card lib-modal"><h2>สร้างกิจกรรมใหม่</h2>
    <label class="ed-lbl">รายวิชา</label><select class="ed-in" id="naS">${LIBC.subjects.map((s) => `<option ${s === subject ? 'selected' : ''}>${esc(s)}</option>`).join('')}<option value="__new">＋ รายวิชาใหม่…</option></select>
    <input class="ed-in" id="naSN" placeholder="ชื่อรายวิชาใหม่ เช่น วิทยาศาสตร์ ม.3/1" ${LIBC.subjects.length ? 'hidden' : ''}>
    <label class="ed-lbl">ชื่อกิจกรรม</label><input class="ed-in" id="naT" maxlength="80" placeholder="เช่น พันธุกรรม · ด่านหิมะ">
    <label class="ed-lbl">เริ่มจาก</label><div class="na-tpl"><label><input type="radio" name="tpl" value="" checked><span>📄 ชุดว่าง</span></label>
      ${SAMPLES.map((x) => `<label><input type="radio" name="tpl" value="${x.key}"><span>${esc(x.label)}</span></label>`).join('')}</div>
    <div class="lm-btns"><button class="ed-ghost" id="naX">ยกเลิก</button><button class="ed-go sm" id="naOk"><span>สร้าง</span></button></div></div>`;
  document.body.appendChild(m);
  if (!LIBC.subjects.length) $('#naS', m).value = '__new';
  $('#naS', m).onchange = () => { $('#naSN', m).hidden = $('#naS', m).value !== '__new'; };
  $('#naX', m).onclick = () => m.remove();
  setTimeout(() => $('#naT', m).focus(), 50);
  $('#naOk', m).onclick = async () => {
    let subj = $('#naS', m).value; const title = $('#naT', m).value.trim(), tpl = (m.querySelector('[name=tpl]:checked') || {}).value;
    if (subj === '__new') subj = $('#naSN', m).value.trim();
    if (!subj) return toast('เลือกหรือพิมพ์ชื่อรายวิชา'); if (!title) return toast('ตั้งชื่อกิจกรรมก่อน');
    if (dirty && SET.libId && !confirm('กิจกรรมที่เปิดอยู่มีการแก้ไขที่ยังไม่บันทึก สร้างใหม่เลยไหม? (การแก้ไขนั้นจะหายไป)')) return;
    const base = tpl ? clone(SAMPLES.find((x) => x.key === tpl).set) : { theme: 'auto', mode: 'live', story: '', stages: [], questions: [{ type: 'mc', q: '', c: ['', '', '', ''], a: 0, t: 20, x: '' }] };
    SET = { ...base, title, subject: subj }; delete SET.libId;
    m.remove(); LSset('set', SET);
    if (await saveCloud()) showSetup();
  };
}
async function openActivity(id) {
  if (dirty && SET.libId && SET.libId !== id && !confirm('กิจกรรมที่เปิดอยู่มีการแก้ไขที่ยังไม่บันทึก เปิดกิจกรรมอื่นเลยไหม?')) return;
  try {
    const r = await call('lib_get', { key: KEY, id });
    SET = { ...r.set, title: r.title, subject: r.subject, libId: r.id }; LSset('set', SET); dirty = false;
    savedAt = (LIBC.items.find((x) => x.id === id) || {}).updated || '';
    showSetup();
  } catch (e) { toast(e.message); }
}
async function saveCloud(quiet) {
  if (!SET.subject) { toast('เลือกรายวิชาก่อนบันทึก'); $('#selSubj') && $('#selSubj').focus(); return false; }
  if (!String(SET.title || '').trim()) { toast('ตั้งชื่อกิจกรรมก่อนบันทึก'); $('#iTitle') && $('#iTitle').focus(); return false; }
  const b = $('#bSave'); if (b) { b.disabled = true; b.textContent = 'กำลังบันทึก…'; }
  try {
    const r = await call('lib_save', { key: KEY, id: SET.libId || '', subject: SET.subject, title: SET.title, set: libSet() });
    SET.libId = r.id; LSset('set', SET); dirty = false; savedAt = r.updated;
    const it = LIBC.items.find((x) => x.id === r.id), meta = { id: r.id, subject: SET.subject, title: SET.title, n: SET.questions.length, updated: r.updated, theme: SET.theme || 'auto', mode: SET.mode || 'live' };
    if (it) Object.assign(it, meta); else LIBC.items.push(meta);
    if (!LIBC.subjects.includes(SET.subject)) LIBC.subjects.push(SET.subject);
    if (!quiet) toast('บันทึกลงคลังกิจกรรมแล้ว ✓');
    return true;
  } catch (e) { toast(e.message); return false; }
  finally { if (b) { b.disabled = false; b.textContent = '💾 บันทึก'; } updSaveSt(); }
}
function updSaveSt() {
  const el = $('#saveSt'); if (!el) return;
  el.className = 'savest ' + (dirty ? 'dirty' : SET.libId ? 'ok' : 'new');
  el.textContent = dirty ? '● ยังไม่บันทึก' : SET.libId ? `✓ บันทึกแล้ว${savedAt ? ' · ' + savedAt.slice(-5) : ''}` : 'ยังไม่ได้บันทึกลงคลัง';
}
function edBarHTML() {
  const subs = LIBC.subjects.slice(); if (SET.subject && !subs.includes(SET.subject)) subs.push(SET.subject);
  return `<div class="ed-bar"><button class="ed-ghost" id="bLib">← คลังกิจกรรม</button>
    <div class="crumb"><span>📘</span><select id="selSubj"><option value="" ${SET.subject ? '' : 'selected'} disabled>เลือกรายวิชา…</option>${subs.map((s) => `<option ${s === SET.subject ? 'selected' : ''}>${esc(s)}</option>`).join('')}<option value="__new">＋ รายวิชาใหม่…</option></select>
      <i>›</i><b id="crTitle">${esc(SET.title || 'ไม่มีชื่อ')}</b></div>
    <span id="saveSt" class="savest"></span><button class="ed-save" id="bSave">💾 บันทึก</button></div>`;
}
function bindEdBar() {
  $('#bLib').onclick = async () => {
    if (dirty && confirm('มีการแก้ไขที่ยังไม่บันทึก — กด "ตกลง" เพื่อบันทึกก่อนกลับคลัง\n(กด "ยกเลิก" เพื่อกลับโดยไม่บันทึก งานจะยังค้างอยู่ในเครื่องนี้)')) { if (!(await saveCloud(true))) return; }
    showLibrary();
  };
  $('#bSave').onclick = () => saveCloud();
  bindEdBarSubj();
  updSaveSt();
  if (!libLoaded) loadLib().then(fillSubjSel).catch(() => {});
}
function fillSubjSel() {
  const sel = $('#selSubj'); if (!sel) return;
  const subs = LIBC.subjects.slice(); if (SET.subject && !subs.includes(SET.subject)) subs.push(SET.subject);
  sel.innerHTML = `<option value="" ${SET.subject ? '' : 'selected'} disabled>เลือกรายวิชา…</option>${subs.map((s) => `<option ${s === SET.subject ? 'selected' : ''}>${esc(s)}</option>`).join('')}<option value="__new">＋ รายวิชาใหม่…</option>`;
}
function bindEdBarSubj() {
  $('#selSubj').onchange = async (e) => {
    let v = e.target.value;
    if (v === '__new') { v = (prompt('ชื่อรายวิชาใหม่') || '').trim(); if (!v) { e.target.value = SET.subject || ''; return; }
      try { await call('subj_save', { key: KEY, name: v }); LIBC.subjects.push(v); } catch (x) { toast(x.message); return; }
      const o = document.createElement('option'); o.textContent = v; e.target.insertBefore(o, e.target.lastElementChild); e.target.value = v; }
    SET.subject = v; save();
  };
}
document.addEventListener('click', async (e) => {
  const o = e.target.closest('[data-lopen]'), d = e.target.closest('[data-ldup]'), x = e.target.closest('[data-ldel]');
  const sr = e.target.closest('[data-sren]'), sd = e.target.closest('[data-sdel]'), sn = e.target.closest('[data-snew]');
  try {
    if (o) return openActivity(o.dataset.lopen);
    if (sn) return newActivity(sn.dataset.snew);
    if (d) { const r = await call('lib_get', { key: KEY, id: d.dataset.ldup }); await call('lib_save', { key: KEY, subject: r.subject, title: r.title + ' (สำเนา)', set: r.set }); await loadLib(); renderLibrary(); return toast('ทำสำเนาแล้ว'); }
    if (x) { const it = LIBC.items.find((y) => y.id === x.dataset.ldel); if (!confirm(`ลบกิจกรรม "${it ? it.title : ''}"? ลบแล้วกู้คืนไม่ได้`)) return;
      await call('lib_delete', { key: KEY, id: x.dataset.ldel }); if (SET.libId === x.dataset.ldel) { delete SET.libId; LSset('set', SET); } await loadLib(); return renderLibrary(); }
    if (sr) { const n = (prompt('เปลี่ยนชื่อรายวิชา', sr.dataset.sren) || '').trim(); if (!n || n === sr.dataset.sren) return;
      await call('subj_save', { key: KEY, old: sr.dataset.sren, name: n }); if (SET.subject === sr.dataset.sren) { SET.subject = n; LSset('set', SET); } await loadLib(); return renderLibrary(); }
    if (sd) { if (!confirm(`ลบรายวิชา "${sd.dataset.sdel}"?`)) return; await call('subj_delete', { key: KEY, name: sd.dataset.sdel }); await loadLib(); return renderLibrary(); }
  } catch (err) { toast(err.message); }
});
window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

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
        <p class="ed-lbl">🗺️ ด่านภารกิจ <small>(คำถามแต่ละข้อเลือกด่านได้ที่ไอคอนในการ์ด)</small></p>
        <div id="stEd"></div>
        <div class="stats"><div><b id="stQ">0</b><small>ข้อ</small></div><div><b id="stM">0</b><small>นาที (ประมาณ)</small></div><div><b id="stR">0</b><small>พร้อมเล่น</small></div></div>
        ${DEMO || KEY ? '' : `<label class="ed-lbl" for="iKey">รหัสครู (HOST_KEY)</label><input class="ed-in" id="iKey" type="password" value="${esc(KEY)}" autocomplete="current-password">`}
        <p class="ed-lbl">รูปแบบการเล่น</p>
        <div class="modes">
          <button type="button" class="mode ${SET.mode === 'self' ? '' : 'on'}" data-mode="live"><b>🎮 เล่นสด</b><small>ครูคุมจังหวะบนจอ ทุกคนตอบพร้อมกัน</small></button>
          <button type="button" class="mode ${SET.mode === 'self' ? 'on' : ''}" data-mode="self"><b>🏃 นักเรียนเล่นเอง</b><small>ทำตามจังหวะตัวเอง ครูดูความคืบหน้า</small></button>
          <button type="button" class="mode wide ${SET.mode === 'station' ? 'on' : ''}" data-mode="station"><b>🏕️ แบบฐาน</b><small>แบ่งกลุ่มไปคนละฐาน · QR แยกแต่ละฐาน · ทำเฉพาะโจทย์ของฐานนั้น</small></button>
        </div>
        <label class="gs rot" id="rotWrap" ${SET.mode === 'station' ? '' : 'hidden'}><input type="checkbox" id="cRot" ${SET.rotate === false ? '' : 'checked'}>ทำครบฐานแล้วให้เลือกฐานอื่นต่อได้ (หมุนฐาน)</label>
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
      ${edBarHTML()}
      <div class="qlist" id="qlist"></div>
      <button class="ed-add" id="bAdd"><span>＋</span>เพิ่มคำถาม</button>
    </section>
  </div>`;
  renderList();
  const preview = () => { const th = themeFor(SET.theme, SET.title); backdrop(th); $('#heroM').innerHTML = mascotFor(th); const a = $('#autoTh'); if (a) a.textContent = 'ตอนนี้: ' + THEME_LABEL[themeFor('auto', SET.title)]; };
  preview();
  $('#iTitle').addEventListener('input', (e) => { SET.title = e.target.value; save(); preview(); $('#crTitle').textContent = SET.title || 'ไม่มีชื่อ'; });
  bindEdBar();
  $$('.tp').forEach((b) => b.addEventListener('click', () => { SET.theme = b.dataset.theme; save(); $$('.tp').forEach((x) => x.classList.toggle('on', x === b)); preview(); }));
  $('#bAdd').onclick = () => { SET.questions.push({ q: '', c: ['', '', '', ''], a: 0, t: 20, x: '' }); save(); renderList(); const c = $('#qlist').lastElementChild; c.scrollIntoView({ behavior: 'smooth', block: 'center' }); c.querySelector('textarea').focus(); };
  $('#iStory').addEventListener('input', (e) => { SET.story = e.target.value; save(); });
  renderStages();
  $('#bSample').onclick = (e) => { e.stopPropagation(); $('#sMenu').hidden = !$('#sMenu').hidden; };
  $$('[data-sample]').forEach((b) => (b.onclick = () => {
    const x = SAMPLES.find((y) => y.key === b.dataset.sample);
    if (confirm(`แทนที่ข้อคำถามทั้งหมดด้วยชุด "${x.label}"?`)) { SET = clone(x.set); save(); showSetup(); }
  }));
  document.addEventListener('click', () => { const m = $('#sMenu'); if (m) m.hidden = true; }, { once: true });
  $('#bClear').onclick = () => { if (confirm('ลบข้อคำถามทั้งหมด?')) { SET.questions = [{ q: '', c: ['', '', '', ''], a: 0, t: 20, x: '' }]; save(); renderList(); } };
  $('#bImport').onclick = () => { $('#mImport').hidden = false; $('#taImport').focus(); };
  $('#bCreate').onclick = createRoom;
  $$('.mode').forEach((b) => (b.onclick = () => {
    if (b.dataset.mode === 'station' && !(SET.stages || []).length) { SET.stages = clone(STAGES4); SET.questions.forEach((q) => { if (!(q.st >= 0)) q.st = 0; }); renderStages(); renderList(); toast('เปิดระบบ 4 ด่านให้แล้ว · เลือกฐานของแต่ละข้อที่ไอคอนบนการ์ด'); }
    SET.mode = b.dataset.mode; save(); $$('.mode').forEach((x) => x.classList.toggle('on', x === b)); $('#rotWrap').hidden = SET.mode !== 'station';
  }));
  $('#cRot').onchange = (e) => { SET.rotate = e.target.checked; save(); };
}

function pchk(g) { if (!g || !g.trim()) return ''; const P = parsePunnett(g); return P.error ? `⚠ ${esc(P.error)}` : `✓ ตาราง ${P.g2.length}×${P.g1.length}`; }
function fchk(q) { if (!q.g || !q.g.trim()) return ''; const b = buildFill(q.g, q.hx); return b.error ? `⚠ ${esc(b.error)}` : `✓ เด็กต้องเติม ${b.k.length} ช่อง`; }
function renderStages() {
  const ST = SET.stages || [], box = $('#stEd'); if (!box) return;
  box.innerHTML = ST.length ? `<div class="stl">${ST.map((x, k) => `<div class="stl-row st-${x.th}"><span class="stl-ic">${esc(x.ic)}</span>
      <div><input data-sk="n" data-si="${k}" value="${esc(x.n)}" maxlength="40" placeholder="ชื่อด่าน"><input data-sk="d" data-si="${k}" value="${esc(x.d || '')}" maxlength="90" placeholder="คำอธิบายกิจกรรม"></div>
      <small>${SET.questions.filter((q) => (q.st || 0) === k).length} ข้อ</small></div>`).join('')}</div>
      <button class="ed-ghost" id="bNoStage" style="width:100%;margin-top:6px">ไม่ใช้ระบบด่าน</button>`
    : `<button class="ed-ghost" id="bUseStage" style="width:100%">🔥 ใช้ 4 ด่านธาตุ (น้ำ · ไฟ · ดิน · ลม)</button>`;
  $$('[data-sk]', box).forEach((inp) => inp.addEventListener('input', () => { SET.stages[+inp.dataset.si][inp.dataset.sk] = inp.value; save(); }));
  if ($('#bNoStage')) $('#bNoStage').onclick = () => { if (!confirm('เลิกใช้ระบบด่าน? (ข้อคำถามยังอยู่ครบ)')) return; SET.stages = []; save(); renderStages(); renderList(); };
  if ($('#bUseStage')) $('#bUseStage').onclick = () => { SET.stages = clone(STAGES4); SET.questions.forEach((q) => { if (!(q.st >= 0)) q.st = 0; }); save(); renderStages(); renderList(); };
}
const typeOf = (q) => q.type === 'fill' || q.type === 'match' ? q.type : q.c && q.c.length === 2 ? 'tf' : 'mc';
const ready = (q) => {
  if (!q.q || !q.q.trim()) return false;
  if (q.type === 'fill') return q.g && !buildFill(q.g, q.hx).error;
  if (q.type === 'match') return (q.p || []).filter((x) => x.l.trim() && x.r.trim()).length >= 2 && (q.p || []).every((x) => x.l.trim() && x.r.trim());
  return q.c.filter((c) => c.trim()).length === q.c.length && q.a >= 0 && q.a < q.c.length;
};
function updStats() {
  if (!$('#stQ')) return;
  $('#stQ').textContent = SET.questions.length; $('#stM').textContent = estMin();
  $('#stR').textContent = `${SET.questions.filter(ready).length}/${SET.questions.length}`;
  $$('.qed').forEach((card) => { const ok = ready(SET.questions[+card.dataset.i]); card.classList.toggle('done', !!ok);
    const s = card.querySelector('.qstate'); if (s) s.textContent = ok ? '✓ พร้อม' : 'ยังไม่ครบ'; });
}
const TYPES = [['mc', '4 ตัวเลือก'], ['tf', 'ถูก / ผิด'], ['fill', '🧬 เติมตาราง'], ['match', '🔗 จับคู่']];
const parentsPreview = (q) => { const b = q.g ? buildFill(q.g, q.hx) : null; if (!b || b.error) return '';
  return `<div class="ppv">${[0, 1].map((i) => `<div class="pp"><div class="pfox">${foxSVG(b.fur[i])}</div><span>${esc((q.pl || [])[i] || '')}</span></div>`).join('<b>×</b>')}
    <div class="ppgrid">${punnettHTML(b.P, { filled: true, compact: true })}</div></div>`; };

function bodyFor(q, i) {
  const ty = typeOf(q);
  if (ty === 'fill') return `
      <div class="fl-row"><label class="pun-in"><span>🧬</span><input data-k="g" value="${esc(q.g || '')}" maxlength="60" placeholder="การผสม เช่น  Bb x bb | ขนเทา | ขนขาว"><em class="pchk">${fchk(q)}</em></label>
        <label class="gs" title="ขั้นสูง: นักเรียนต้องเติมเซลล์สืบพันธุ์ (หัวตาราง) เองด้วย"><input type="checkbox" data-k="hx" ${q.hx ? 'checked' : ''}>ให้เติมเซลล์สืบพันธุ์เองด้วย</label></div>
      <div class="fl-row two"><label class="mj-in2"><span>🦊</span><input data-k="pl" data-j="0" value="${esc((q.pl || [])[0] || '')}" maxlength="40" placeholder="ป้ายใต้ภาพพ่อ เช่น จ่าฝูง · Bb"></label>
        <label class="mj-in2"><span>🦊</span><input data-k="pl" data-j="1" value="${esc((q.pl || [])[1] || '')}" maxlength="40" placeholder="ป้ายใต้ภาพแม่ เช่น ขนขาว"></label></div>
      <div class="fl-prev" id="prev${i}">${parentsPreview(q)}</div>`;
  if (ty === 'match') return `
      <div class="pairs">${(q.p || []).map((x, j) => `<div class="pair"><span class="pn">${j + 1}</span>
        <input data-k="pl2" data-j="${j}" value="${esc(x.l)}" maxlength="60" placeholder="คำ / ข้อความด้านซ้าย"><i>⟷</i>
        <input data-k="pr2" data-j="${j}" value="${esc(x.r)}" maxlength="90" placeholder="คู่ที่ถูกต้อง">
        <button type="button" class="pdel" data-pdel="${j}" title="ลบคู่นี้">✕</button></div>`).join('')}
        ${(q.p || []).length < 6 ? `<button type="button" class="padd" data-padd="1">＋ เพิ่มคู่</button>` : ''}
        <p class="phint">ฝั่งขวาจะถูกสลับลำดับอัตโนมัติบนมือถือนักเรียน</p></div>`;
  const tf = ty === 'tf';
  return `
      <div class="opts">${q.c.map((c, j) => `<div class="opt o${j} ${q.a === j ? 'right' : ''}">
        <button type="button" class="mark" data-correct="${j}" title="ตั้งเป็นคำตอบที่ถูก">${shape(j)}</button>
        <input type="text" data-k="c" data-j="${j}" value="${esc(c)}" placeholder="ตัวเลือกที่ ${j + 1}" maxlength="120" ${tf ? 'readonly' : ''}>
        <button type="button" class="okpill" data-correct="${j}">${q.a === j ? '✓ คำตอบที่ถูก' : 'ตั้งเป็นคำตอบ'}</button></div>`).join('')}</div>
      <div class="genrow"><label class="pun-in"><span>🧬</span><input data-k="g" value="${esc(q.g || '')}" maxlength="60" placeholder="ตารางพันนิตต์ประกอบ (ไม่บังคับ) เช่น  Bb x bb | ขนเทา | ขนขาว"><em class="pchk">${pchk(q.g)}</em></label>
        <label class="gs" title="ถ้าไม่ติ๊ก ตารางจะขึ้นเฉพาะตอนเฉลย (กันเฉลยหลุด)"><input type="checkbox" data-k="gs" ${q.gs ? 'checked' : ''}>แสดงตอนถาม</label></div>`;
}

function renderList() {
  const ST = SET.stages || [];
  let lastSt = null;
  $('#qlist').innerHTML = SET.questions.map((q, i) => {
    const ty = typeOf(q), t = Number(q.t) || 20, st = ST.length ? (q.st >= 0 && q.st < ST.length ? q.st : 0) : -1;
    const head = ST.length && st !== lastSt ? `<div class="st-head st-${ST[st].th}"><span>${esc(ST[st].ic)}</span><div><small>ด่านที่ ${st + 1}</small><b>${esc(ST[st].n)}</b></div><em>${esc(ST[st].d || '')}</em></div>` : '';
    lastSt = st;
    return `${head}<article class="qed" data-i="${i}" style="--acc:var(--c${(st >= 0 ? st : i) % 4});--d:${Math.min(i, 8) * 0.04}s">
      <header class="qed-h">
        <span class="qed-no"><small>ข้อ</small>${i + 1}</span>
        <div class="seg" role="group" aria-label="ชนิดคำถาม">${TYPES.map(([k, l]) => `<button type="button" data-type="${k}" class="${ty === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        ${ST.length ? `<div class="seg stg" role="group" aria-label="ด่าน">${ST.map((s2, k) => `<button type="button" data-stage="${k}" class="${st === k ? 'on' : ''}" title="ด่าน ${k + 1} · ${esc(s2.n)}">${esc(s2.ic)}</button>`).join('')}</div>` : ''}
        <div class="seg time" role="group" aria-label="เวลา">${QUICK_T.map((x) => `<button type="button" data-time="${x}" class="${t === x ? 'on' : ''}">${x}s</button>`).join('')}
          <select data-k="t" title="เวลาอื่น" class="${QUICK_T.includes(t) ? '' : 'on'}">${QUICK_T.includes(t) ? '<option selected disabled>อื่น ๆ</option>' : ''}${TIMES.map((x) => `<option value="${x}" ${t === x && !QUICK_T.includes(t) ? 'selected' : ''}>${x} วิ</option>`).join('')}</select></div>
        <span class="qstate"></span>
        <div class="tools">${['up', 'down', 'dup', 'del'].map((a) => `<button type="button" data-act="${a}" title="${{ up: 'เลื่อนขึ้น', down: 'เลื่อนลง', dup: 'ทำซ้ำ', del: 'ลบ' }[a]}" class="${a}">${ICON[a]}</button>`).join('')}</div>
      </header>
      <textarea data-k="q" rows="1" maxlength="300" placeholder="พิมพ์คำถาม / คำสั่งที่นี่…">${esc(q.q)}</textarea>
      ${q.img ? `<div class="imgrow has"><img src="${esc(q.img)}" alt="" data-zoomh="1"><div><b>🖼️ ภาพประกอบโจทย์</b><small>ขึ้นทั้งจอครูและมือถือนักเรียน</small>
          <span><button type="button" class="ed-ghost" data-img="pick">เปลี่ยนภาพ</button><button type="button" class="ed-ghost danger" data-img="del">ลบภาพ</button></span></div></div>`
        : `<div class="imgrow"><button type="button" class="imgadd" data-img="pick">🖼️ เพิ่มภาพประกอบ</button><button type="button" class="imglink" data-img="link">🔗 ใช้ลิงก์ภาพ</button></div>`}
      ${bodyFor(q, i)}
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
  const i = +card.dataset.i, q = SET.questions[i], k = e.target.dataset.k, j = +e.target.dataset.j;
  if (k === 'q') { q.q = e.target.value; autosize(e.target); }
  if (k === 'x') q.x = e.target.value;
  if (k === 'c') q.c[j] = e.target.value;
  if (k === 'pl') { q.pl = q.pl || ['', '']; q.pl[j] = e.target.value; const pv = $('#prev' + i); if (pv) pv.innerHTML = parentsPreview(q); }
  if (k === 'pl2') q.p[j].l = e.target.value;
  if (k === 'pr2') q.p[j].r = e.target.value;
  if (k === 'g') {
    q.g = e.target.value; const c = e.target.parentNode.querySelector('.pchk');
    c.innerHTML = q.type === 'fill' ? fchk(q) : pchk(q.g); c.classList.toggle('bad', /⚠/.test(c.textContent));
    const pv = $('#prev' + i); if (pv) pv.innerHTML = parentsPreview(q);
  }
  save(); updStats();
});
document.addEventListener('change', (e) => {
  const card = e.target.closest('.qed'); if (!card) return;
  const q = SET.questions[+card.dataset.i];
  if (e.target.dataset.k === 'gs') { q.gs = e.target.checked; save(); return; }
  if (e.target.dataset.k === 'hx') { q.hx = e.target.checked; if (q.hx && (q.t || 0) < 90) q.t = 90; save(); renderList(); return; }
  if (e.target.dataset.k !== 't') return;
  q.t = Number(e.target.value); save(); renderList();
});
function setType(q, ty) {
  const cur = typeOf(q); if (cur === ty) return;
  if (cur === 'mc') { q._keep = q.c.slice(); q._keepA = q.a; }
  if (ty === 'tf') { q.type = 'mc'; q.c = ['ถูก', 'ผิด']; q.a = 0; }
  else if (ty === 'mc') { q.type = 'mc'; const k = q._keep && q._keep.length === 4; q.c = k ? q._keep : ['', '', '', '']; q.a = k ? q._keepA || 0 : 0; }
  else if (ty === 'fill') { q.type = 'fill'; q.g = q.g || 'Bb x bb | ขนเทา | ขนขาว'; q.pl = q.pl || ['พ่อ', 'แม่']; q.t = Math.max(Number(q.t) || 0, 60); }
  else if (ty === 'match') { q.type = 'match'; q.p = q.p && q.p.length ? q.p : [{ l: '', r: '' }, { l: '', r: '' }, { l: '', r: '' }]; q.t = Math.max(Number(q.t) || 0, 45); }
  if (!q.c) q.c = ['', '', '', '']; if (q.a == null) q.a = 0;
}
document.addEventListener('click', (e) => {
  const card = e.target.closest('.qed'); if (!card) return;
  const i = +card.dataset.i, L = SET.questions, q = L[i];
  const tb = e.target.closest('[data-type]'), tm = e.target.closest('[data-time]'), cr = e.target.closest('[data-correct]'), b = e.target.closest('[data-act]');
  const sg = e.target.closest('[data-stage]'), pa = e.target.closest('[data-padd]'), pd = e.target.closest('[data-pdel]'), im = e.target.closest('[data-img]');
  if (im) {
    if (im.dataset.img === 'pick') return pickImage(i);
    if (im.dataset.img === 'link') { const u = prompt('วางลิงก์ภาพ (ขึ้นต้นด้วย https://)'); if (!u) return; if (!/^https:\/\//.test(u.trim())) return toast('ลิงก์ต้องขึ้นต้นด้วย https://'); q.img = u.trim(); save(); renderList(); return; }
    if (im.dataset.img === 'del') { if (!confirm('ลบภาพของข้อนี้?')) return; q.img = ''; save(); renderList(); return; }
  }
  if (tb) setType(q, tb.dataset.type);
  else if (sg) q.st = Number(sg.dataset.stage);
  else if (pa) q.p.push({ l: '', r: '' });
  else if (pd) { if (q.p.length <= 2) return toast('ต้องมีอย่างน้อย 2 คู่'); q.p.splice(+pd.dataset.pdel, 1); }
  else if (tm) q.t = Number(tm.dataset.time);
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

// ===================================================== ภาพประกอบโจทย์
const filePick = document.createElement('input'); filePick.type = 'file'; filePick.accept = 'image/*'; filePick.hidden = true; document.body.appendChild(filePick);
let pickFor = -1;
function pickImage(i) { if (!DEMO && !KEY && !($('#iKey') && $('#iKey').value.trim())) { $('#iKey') && $('#iKey').focus(); return toast('ใส่รหัสครู (HOST_KEY) ก่อนอัปโหลดภาพ'); } pickFor = i; filePick.value = ''; filePick.click(); }
function shrink(file, max = 1280) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.82)); };
    im.onerror = () => rej(new Error('เปิดไฟล์ภาพไม่ได้')); im.src = url;
  });
}
filePick.addEventListener('change', async () => {
  const f = filePick.files[0], i = pickFor; if (!f || i < 0) return;
  const card = $(`.qed[data-i="${i}"]`); card && card.classList.add('uploading');
  try {
    const data = await shrink(f, DEMO ? 960 : 1280);
    if (DEMO) SET.questions[i].img = data;
    else { KEY = ($('#iKey') ? $('#iKey').value.trim() : '') || KEY; const r = await call('upload', { key: KEY, name: `q${i + 1}-${f.name}`, data }); SET.questions[i].img = r.url; SSset('key', KEY); }
    save(); renderList(); toast('เพิ่มภาพแล้ว ✓');
  } catch (e) { toast(e.message); card && card.classList.remove('uploading'); }
});
document.addEventListener('click', (e) => {
  const z = e.target.closest('[data-zoomh]'); if (!z) return;
  const ov = document.createElement('div'); ov.className = 'zoom'; ov.innerHTML = `<img src="${esc(z.getAttribute('src') || z.querySelector('img').src)}" alt=""><span>คลิกเพื่อปิด</span>`;
  ov.onclick = () => ov.remove(); document.body.appendChild(ov);
});
const himg = (q) => (q.img ? `<figure class="himg" data-zoomh="1"><img src="${esc(q.img)}" alt="ภาพประกอบโจทย์"></figure>` : '');

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

function payload() {
  const ST = SET.stages || [];
  return SET.questions.map((q, i) => {
    const st = ST.length ? (q.st >= 0 && q.st < ST.length ? q.st : 0) : -1, base = { q: q.q, t: q.t, x: q.x, st, img: q.img || '' };
    if (!DEMO && /^data:/.test(q.img || '')) throw new Error(`ข้อ ${i + 1} ภาพยังไม่ได้อัปโหลด ลองเลือกภาพใหม่อีกครั้ง`);
    if (q.type === 'fill') {
      const b = buildFill(q.g, q.hx);
      if (b.error) throw new Error(`ข้อ ${i + 1} ${b.error}`);
      return { ...base, type: 'fill', g: q.g, k: b.k, h1: b.h1, h2: b.h2, hx: b.hx, opts: b.opts, fur: b.fur, pl: q.pl || ['', ''] };
    }
    if (q.type === 'match') return { ...base, type: 'match', p: (q.p || []).map((x) => ({ l: x.l.trim(), r: x.r.trim() })) };
    return { ...base, type: 'mc', c: q.c, a: q.a, g: q.g, gs: q.gs };
  });
}
async function createRoom() {
  let qs;
  try { qs = payload(); window.CQ.cleanQuestions(qs); } catch (e) {
    toast(e.message);
    const m = e.message.match(/ข้อ (\d+)/); if (m) { const c = $(`.qed[data-i="${m[1] - 1}"]`); c && c.scrollIntoView({ behavior: 'smooth', block: 'center' }); c && (c.style.animation = 'shake .5s'); }
    return;
  }
  if (!DEMO) { KEY = ($('#iKey') ? $('#iKey').value.trim() : '') || KEY; if (!KEY) return toast('ใส่รหัสครูก่อน'); }
  if (dirty && SET.subject && SET.title) await saveCloud(true);
  sound.unlock();
  const b = $('#bCreate'); b.disabled = true; b.querySelector('span').textContent = 'กำลังสร้างห้อง…';
  try {
    if (!DEMO) { await call('check', { key: KEY }); SSset('key', KEY); }
    const r = await call('create', { key: KEY, title: SET.title, theme: themeFor(SET.theme, SET.title), stages: SET.stages || [], mode: ['self', 'station'].includes(SET.mode) ? SET.mode : 'live', rotate: SET.rotate !== false, questions: qs });
    PIN = r.pin; SSset('pin', PIN); lastKey = ''; startPoll();
  } catch (e) { toast(e.message); b.disabled = false; b.querySelector('span').textContent = 'สร้างห้องเกม'; }
}

// ===================================================== เกม
function startPoll() { stopPoll(); poll(); }
function stopPoll() { clearTimeout(pollT); pollT = null; }
async function poll() {
  try { render(await call('hpoll', { key: KEY, pin: PIN })); }
  catch (e) { if (/ไม่พบห้อง|รหัสครู/.test(e.message)) { toast(e.message); SSset('pin', ''); PIN = ''; return showSetup(); } }
  if (G && G.phase === 'end') return;
  pollT = setTimeout(poll, G && G.phase === 'self' ? (DEMO ? 700 : 2500) : POLL);
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
    const fn = () => ({ lobby: vLobby, self: vSelf, question: vQuestion, reveal: vReveal, board: vBoard, end: vEnd })[g.phase](g);
    const label = { question: `ข้อ ${g.idx + 1}`, reveal: 'เฉลย!', board: '🏆 อันดับ', end: 'ผลสุดท้าย!' }[g.phase];
    if (first || g.phase === 'lobby' || g.phase === 'self') fn(); else swap(fn, label);
  } else live(g);
}
function live(g) {
  if (g.phase === 'lobby') { updatePeople(g); showReacts(g); }
  if (g.phase === 'self') updateSelf(g);
  if (g.phase === 'question') {
    $('#nAns').textContent = g.answered; $('#nAll').textContent = g.players.length;
    if (g.players.length && g.answered >= g.players.length && !revealing) { revealing = true; setTimeout(() => doReveal(), 700); }
  }
}

// ===================================================== แดชบอร์ดโหมดนักเรียนเล่นเอง
function vSelf(g) {
  if (g.mode === 'station') return vStationDash(g);
  music.start();
  const url = joinUrl(), link = url + '?pin=' + g.pin;
  view.innerHTML = `<div class="selfdash">
    <aside class="card joinbox sd-join rise"><span class="tape"></span>
      <p style="margin:0;font-size:19px">สแกน QR หรือเข้าเว็บ</p><div class="url"><b>${esc(url.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</b></div>
      <div class="qr" id="qr"></div><p style="margin:0;font-size:18px">รหัสห้อง</p>
      <div class="pin-big">${[...g.pin].map((d) => `<span class="dg">${d}</span>`).join('')}</div>
      <p class="sd-mode">🏃 โหมดนักเรียนเล่นเอง · ${g.total} ข้อ</p></aside>
    <section class="sd-main">
      <div class="sd-head"><div><small>${esc(g.title)}</small><h1>ความคืบหน้าของห้อง</h1></div>
        <button class="btn hot" id="bClose">🏁 ปิดห้องและประกาศผล</button></div>
      <div class="sd-kpi"><div><b id="kIn">0</b><small>เข้าห้อง</small></div><div><b id="kGo">0</b><small>กำลังทำ</small></div><div><b id="kDone">0</b><small>ทำเสร็จแล้ว</small></div><div><b id="kAvg">0%</b><small>ถูกเฉลี่ย</small></div></div>
      <div class="sd-list" id="sdList"></div>
    </section></div>`;
  drawQR(link);
  $('#bClose').onclick = async () => {
    const left = (G.self || []).filter((x) => !x.done).length;
    if (!confirm(left ? `ยังมีนักเรียนทำไม่เสร็จ ${left} คน ปิดห้องเลยไหม? (คะแนนที่ทำไปแล้วจะถูกบันทึก)` : 'ปิดห้องและประกาศผล?')) return;
    await act('end');
  };
  updateSelf(g);
}
let selfSeen = new Set();
function updateSelf(g) {
  if (g.mode === 'station') return updateStation(g);
  const box = $('#sdList'); if (!box) return;
  const L = (g.self || []).slice().sort((a, b) => b.s - a.s || b.i - a.i), T = g.total, stq = g.stq || [], ST = g.stages || [];
  $('#kIn').textContent = L.length; $('#kGo').textContent = L.filter((x) => x.started && !x.done).length; $('#kDone').textContent = L.filter((x) => x.done).length;
  const ans = L.reduce((a, x) => a + x.i, 0); $('#kAvg').textContent = ans ? Math.round((L.reduce((a, x) => a + x.c, 0) / ans) * 100) + '%' : '–';
  if (!L.length) { box.innerHTML = `<div class="empty"><div class="hero-mascot">${M()}</div>รอนักเรียนเข้าห้อง…</div>`; return; }
  box.innerHTML = L.map((x, k) => { const st = x.done ? null : stq[x.i], ic = st != null && st >= 0 && ST[st] ? ST[st].ic : '';
    return `<div class="sd-row ${x.done ? 'done' : ''} ${selfSeen.has(x.pid) ? '' : 'new'}">
      <span class="sd-rk">${k < 3 && x.s > 0 ? ['🥇', '🥈', '🥉'][k] : k + 1}</span><span class="av">${avatar(x.av)}</span>
      <div class="sd-nm"><b>${esc(x.name)}</b><small>${esc(x.full)}</small></div>
      <div class="sd-pg"><div class="sd-bar"><i style="width:${(x.i / T) * 100}%"></i></div><small>${x.done ? '✅ เสร็จแล้ว' : x.started ? `${ic} ข้อ ${x.i + 1}/${T}` : 'ยังไม่เริ่ม'}</small></div>
      <span class="sd-sc">${x.s.toLocaleString()}</span><span class="sd-c">ถูก ${x.c}</span></div>`; }).join('');
  L.forEach((x) => { if (!selfSeen.has(x.pid)) { selfSeen.add(x.pid); sound.pop(); } });
}

// ===================================================== แดชบอร์ดโหมดฐาน
const stQs = (g, k) => (g.stq || []).filter((x) => x === k).length;
function vStationDash(g) {
  music.start();
  const url = joinUrl(), ST = g.stages || [];
  view.innerHTML = `<div class="stdash">
    <div class="std-top">
      <div class="card std-join"><div class="qr sm" id="qr"></div><div><small>เข้าเว็บ</small><b>${esc(url.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</b>
        <small>รหัสห้อง</small><div class="pin-mid">${esc(g.pin)}</div></div></div>
      <div class="std-title"><small>🏕️ โหมดฐาน${g.rotate ? ' · หมุนฐานได้' : ' · ฐานเดียว'} · ${esc(g.title)}</small><h1>ความคืบหน้าแต่ละฐาน</h1>
        <div class="sd-kpi kmini"><div><b id="kIn">0</b><small>เข้าห้อง</small></div><div><b id="kGo">0</b><small>กำลังทำ</small></div><div><b id="kWait">0</b><small>ยังไม่เลือกฐาน</small></div><div><b id="kAvg">–</b><small>ถูกเฉลี่ย</small></div></div></div>
      <div class="std-btns"><button class="btn sun" id="bPrintQR">🖨️ พิมพ์ QR ทุกฐาน</button><button class="btn hot" id="bClose">🏁 ปิดห้องและประกาศผล</button></div>
    </div>
    <div class="std-cols">${ST.map((x, k) => stQs(g, k) ? `<section class="stcol st-${esc(x.th)}" data-k="${k}">
      <header><span>${esc(x.ic)}</span><div><small>ฐานที่ ${k + 1} · ${stQs(g, k)} ข้อ</small><b>${esc(x.n)}</b></div></header>
      <div class="stc-kpi"><span>กำลังทำ <b class="kg">0</b></span><span>ผ่านแล้ว <b class="kd">0</b></span><span>ถูกเฉลี่ย <b class="ka">–</b></span></div>
      <div class="stc-list"></div><div class="stc-done"></div></section>` : '').join('')}</div>
  </div>`;
  drawQR(url + '?pin=' + g.pin);
  $('#bPrintQR').onclick = () => printStationQR(g);
  $('#bClose').onclick = async () => {
    const going = (G.self || []).filter((x) => x.cur != null && x.stp[x.cur] && !x.stp[x.cur].done).length;
    if (!confirm(going ? `ยังมีนักเรียนกำลังทำฐานอยู่ ${going} คน ปิดห้องเลยไหม? (คะแนนที่ทำไปแล้วจะถูกบันทึก)` : 'ปิดห้องและประกาศผล?')) return;
    await act('end');
  };
  updateStation(g);
}
function updateStation(g) {
  if (!$('.std-cols')) return;
  const L = (g.self || []).slice().sort((a, b) => b.s - a.s);
  const going = L.filter((x) => x.cur != null && !(x.stp[x.cur] || {}).done);
  $('#kIn').textContent = L.length; $('#kGo').textContent = going.length; $('#kWait').textContent = L.filter((x) => x.cur == null).length;
  const tot = L.reduce((a, x) => a + x.i, 0); $('#kAvg').textContent = tot ? Math.round((L.reduce((a, x) => a + x.c, 0) / tot) * 100) + '%' : '–';
  $$('.stcol').forEach((col) => {
    const k = String(col.dataset.k), n = stQs(g, +k);
    const here = L.filter((x) => x.cur === k && !(x.stp[k] || {}).done), done = L.filter((x) => (x.stp[k] || {}).done);
    const ans = L.reduce((a, x) => a + ((x.stp[k] || {}).i || 0), 0), cor = L.reduce((a, x) => a + ((x.stp[k] || {}).c || 0), 0);
    col.querySelector('.kg').textContent = here.length; col.querySelector('.kd').textContent = done.length; col.querySelector('.ka').textContent = ans ? Math.round((cor / ans) * 100) + '%' : '–';
    col.querySelector('.stc-list').innerHTML = here.length ? here.map((x) => { const P = x.stp[k] || { i: 0, s: 0 };
      return `<div class="stp-row ${selfSeen.has(x.pid + k) ? '' : 'new'}"><span class="av">${avatar(x.av)}</span><div><b>${esc(x.name)}</b><small>${esc(x.full)}</small>
        <div class="sd-bar"><i style="width:${(P.i / n) * 100}%"></i></div></div><em>${P.i}/${n}</em></div>`; }).join('') : '<p class="stc-empty">ยังไม่มีใครอยู่ที่ฐานนี้</p>';
    col.querySelector('.stc-done').innerHTML = done.length ? `<small>✅ ผ่านแล้ว</small>${done.map((x) => `<span title="${esc(x.full)}">${avatar(x.av)} ${esc(x.name)} · ${(x.stp[k].c)}/${n}</span>`).join('')}` : '';
    here.forEach((x) => { if (!selfSeen.has(x.pid + k)) { selfSeen.add(x.pid + k); sound.pop(); } });
  });
}
function printStationQR(g) {
  const url = joinUrl(), ST = g.stages || [];
  const qrSvg = (link) => { if (!window.qrcode) return `<p style="word-break:break-all">${esc(link)}</p>`; const q = window.qrcode(0, 'M'); q.addData(link); q.make(); return q.createSvgTag({ cellSize: 8, margin: 0, scalable: true }); };
  const cards = ST.map((x, k) => (stQs(g, k) ? `<div class="c"><div class="ic">${esc(x.ic)}</div><small>ฐานที่ ${k + 1}</small><h2>${esc(x.n)}</h2><p>${esc(x.d || '')}</p>
    <div class="qr">${qrSvg(`${url}?pin=${g.pin}&st=${k + 1}`)}</div><div class="u">${esc(url.replace(/^https?:\/\//, ''))} · รหัสห้อง <b>${esc(g.pin)}</b></div></div>` : '')).join('');
  const w = window.open('', '_blank');
  if (!w) return toast('เบราว์เซอร์บล็อกหน้าต่างใหม่ — อนุญาตป๊อปอัปก่อน');
  w.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><title>QR ฐาน · ห้อง ${esc(g.pin)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Mitr:wght@400;600&display=swap" rel="stylesheet">
    <style>body{margin:0;font-family:Mitr,sans-serif;background:#f4f4f8}.bar{padding:12px;text-align:center}.bar button{font:inherit;font-size:18px;padding:8px 20px;border-radius:12px;border:0;background:#7B61FF;color:#fff;cursor:pointer}
    .g{display:grid;grid-template-columns:1fr 1fr;gap:10mm;padding:10mm;max-width:190mm;margin:0 auto}.c{background:#fff;border:3px solid #22223B;border-radius:18px;padding:8mm;text-align:center;break-inside:avoid}
    .ic{font-size:44px}.c small{color:#666}.c h2{margin:2px 0;font-size:26px}.c p{margin:0 0 6px;font-size:13px;color:#555;min-height:2.6em}.qr{width:55mm;height:55mm;margin:0 auto}.qr svg{width:100%;height:100%}.u{font-size:12px;margin-top:6px}
    @media print{.bar{display:none}body{background:#fff}.g{padding:0}}</style></head>
    <body><div class="bar"><button onclick="print()">🖨️ พิมพ์</button></div><div class="g">${cards}</div></body></html>`);
  w.document.close();
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
    el.title = (p.full ? p.full + ' · ' : '') + 'คลิกเพื่อนำออก';
    el.onclick = async () => { if (confirm(`นำ "${p.name}" ออกจากห้อง?`)) { await call('kick', { key: KEY, pin: PIN, pid: p.pid }); } };
    box.appendChild(el);
    if (!shown.has(p.pid)) { shown.add(p.pid); sound.pop(); }
  });
  if (!g.players.length && !box.querySelector('.empty')) box.innerHTML = `<div class="empty"><div class="hero-mascot">${M()}</div>${isFox() ? 'จ่าฝูงรอนักสำรวจอยู่…' : 'รอเพื่อน ๆ เข้าห้อง…'}</div>`;
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
    await goNext();
  } finally { starting = false; }
}

// ===================================================== เรื่องเล่าเปิดเกม
let storyOpen = false, storyNext = null;
function story(lines) {
  return new Promise((done) => {
    storyOpen = true; music.stop();
    const ov = document.createElement('div'); ov.className = 'story';
    ov.innerHTML = `<div class="st-m">${M()}</div><div class="st-box"><div class="st-name">${isFox() ? '🦊 จ่าฝูงจิ้งจอก' : '✏️ น้องดินสอ'}</div>
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
      typing = setInterval(() => { el.textContent += ch[k++] || ''; if (k % 3 === 0) sound.tone(isFox() ? 1320 : 990, 0.03, 'sine', 0.04); if (k >= ch.length) { clearInterval(typing); typing = null; } }, 32);
    };
    const next = () => { if (typing) { clearInterval(typing); typing = null; $('#stText', ov).textContent = full; } else show(); };
    const close = () => { coolUntil = performance.now() + 1800; storyOpen = false; storyNext = null; ov.classList.add('bye'); setTimeout(() => ov.remove(), 500); done(); };
    storyNext = next;
    $('#stNext', ov).onclick = next; $('#stSkip', ov).onclick = close;
    if (isSnow()) blizzard(1400);
    setTimeout(show, 500);
  });
}

// ===================================================== ระบบด่าน (คริสตัลธาตุ)
const hasStages = (g) => !!(g && g.stages && g.stages.length);
function gemsOf(g) {
  const ST = g.stages || [], stq = g.stq || [], tr = g.trail || [];
  const st = ST.map((_, k) => {
    const idx = stq.map((s, i) => (s === k ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) return null;
    if (!idx.every((i) => tr[i] != null)) return undefined;
    return idx.reduce((a, i) => a + tr[i], 0) / idx.length >= 0.5;
  });
  const need = Math.max(1, Math.ceil(ST.filter((_, k) => st[k] !== null).length * 0.75));
  return { st, got: st.filter((x) => x === true).length, need };
}
function stageAvg(g, k) { const stq = g.stq || [], tr = g.trail || []; const idx = stq.map((s, i) => (s === k ? i : -1)).filter((i) => i >= 0 && tr[i] != null); return idx.length ? idx.reduce((a, i) => a + tr[i], 0) / idx.length : 0; }
function gemTrailHTML(g) {
  const ST = g.stages, gm = gemsOf(g), cur = g.q && g.q.st >= 0 ? g.q.st : gm.st.findIndex((x) => x === undefined);
  const n = ST.length, L = (k) => ((k + 1) / (n + 1)) * 100, done = gm.st.filter((x) => x === true || x === false).length;
  const at = Math.max(0, Math.min(n, cur >= 0 ? cur : done)), open = gm.got >= gm.need && done === n;
  return `<div class="trail gems ${open ? 'open' : ''}"><div class="tr-line"><i style="width:${(at / (n + 1)) * 100 + 100 / (n + 1) * (cur >= 0 ? 0.5 : 0)}%"></i></div>
    <span class="tr-node camp" style="left:0%">⛺</span>
    ${ST.map((x, k) => `<span class="tr-node gem st-${x.th} ${gm.st[k] === true ? 'ok' : gm.st[k] === false ? 'miss' : k === cur ? 'now' : ''}" style="left:${L(k)}%" title="${esc(x.n)}">${esc(x.ic)}</span>`).join('')}
    <span class="tr-node gate" style="left:100%">${open ? '🏛️' : '🚪'}</span>
    <span class="tr-me" style="left:${cur >= 0 ? L(cur) - 50 / (n + 1) : L(Math.max(0, done - 1)) + (done ? 0 : -100 / (n + 1))}%">🦊</span>
    <span class="tr-cap">💎 คริสตัล ${gm.got}/${n} · ต้องการ ${gm.need} ชิ้นเพื่อเปิดประตู</span></div>`;
}
const stageChip = (g) => { if (!hasStages(g) || !g.q || !(g.q.st >= 0)) return ''; const x = g.stages[g.q.st]; return `<span class="chip stg-chip st-${x.th}">${esc(x.ic)} ด่าน ${g.q.st + 1} · ${esc(x.n)}</span>`; };
const STAGE_SAY = {
  snow: 'ธารน้ำแข็งนี้ซ่อนความรู้พื้นฐานไว้… ตอบให้ถูกล่ะ! 💧',
  fire: 'ดวงใจอัคนีต้องการผู้ที่เติมตารางพันธุกรรมได้แม่นยำ 🔥',
  earth: 'ผืนดินนี้ผูกคำแต่ละคู่ไว้ด้วยเล่ห์กล… จับคู่ให้ถูกนะ 🌿',
  wind: 'สายลมสุดท้าย! ดูพ่อแม่ให้ดี แล้วไขทั้งตารางด้วยตัวเอง 🌪️',
};
function stageIntro(k) {
  return new Promise((done) => {
    const S = G.stages[k], gm = gemsOf(G);
    storyOpen = true; music.stop(); backdrop(S.th || 'class');
    const ov = document.createElement('div'); ov.className = `stage-in st-${S.th}`;
    ov.innerHTML = `<div class="si-rays"></div>
      <div class="si-card"><div class="si-ic">${esc(S.ic)}</div><small>ด่านที่ ${k + 1} / ${G.stages.length}</small><h1>${esc(S.n)}</h1>
        <p>${esc(S.d || '')}</p>
        <div class="si-gems">${G.stages.map((x, i) => `<span class="${gm.st[i] === true ? 'got' : gm.st[i] === false ? 'miss' : i === k ? 'now' : ''}">${esc(x.ic)}</span>`).join('')}</div>
        <button class="btn sun big" id="siGo">เริ่มด่าน ▶</button></div>
      <div class="si-fox"><div class="bubble">${STAGE_SAY[S.th] || 'พร้อมหรือยัง นักสำรวจ?'}</div>${FOX}</div>`;
    document.body.appendChild(ov);
    [523, 659, 784].forEach((f, i) => sound.tone(f, 0.3, 'triangle', 0.14, 0.15 + i * 0.12));
    if (S.th === 'snow') blizzard(1200);
    const close = () => { coolUntil = performance.now() + 1500; storyOpen = false; storyNext = null; ov.classList.add('bye'); setTimeout(() => ov.remove(), 600); done(); };
    const t0 = performance.now();
    storyNext = () => { if (performance.now() - t0 > 1200) close(); }; $('#siGo', ov).onclick = close;
  });
}
async function goNext() {
  if (busy || storyOpen || !G) return;
  const ns = G.nst, cs = G.q ? G.q.st : null;
  if (hasStages(G) && G.phase !== 'end' && ns != null && ns >= 0 && ns !== cs) await stageIntro(ns);
  await act('next');
}

// ===================================================== ข้อแบบเติมตาราง / จับคู่ (จอครู)
const pfox = (fur, label) => `<div class="pfox-card"><div class="pfox">${foxSVG(fur || '#fff')}</div><span>${esc(label || '')}</span></div>`;
function fillHTML(q) {
  const P = parsePunnett(q.g);
  return `<div class="fillstage"><div class="parents">${pfox(q.fur[0], q.pl[0])}<b class="x">×</b>${pfox(q.fur[1], q.pl[1])}</div>
    <div class="bigpun ${q.hx ? 'hx' : ''}">${P && !P.error ? punnettHTML(P) : ''}</div></div>`;
}
function matchHTML(q, revealed, g) {
  const A = 'กขคงจฉ';
  if (!revealed) return `<div class="matchstage"><div class="mcol">${q.p.map((x, i) => `<div class="mcard l" style="--d:${i * 0.08}s"><b>${i + 1}</b>${esc(x.l)}</div>`).join('')}</div>
    <div class="mmid">🔗</div><div class="mcol">${q.perm.map((j, i) => `<div class="mcard r" style="--d:${0.3 + i * 0.08}s"><b>${A[i]}</b>${esc(q.p[j].r)}</div>`).join('')}</div></div>`;
  const n = g.answered || 0;
  return `<div class="matchstage rev">${q.p.map((x, i) => { const p = n ? Math.round(((g.itemOk || [])[i] || 0) / n * 100) : 0;
    return `<div class="mrow" style="--d:${i * 0.18}s"><div class="mcard l"><b>${i + 1}</b>${esc(x.l)}</div><span class="mline"></span><div class="mcard r ok">${esc(x.r)}</div>
      <div class="mpct"><i style="--w:${p}%"></i><span>${p}%</span></div></div>`; }).join('')}</div>`;
}
function runTimer(q) {
  const C = 2 * Math.PI * 54; let lastSec = -1;
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
}
const timerSVG = (q) => { const C = 2 * Math.PI * 54; return `<div class="timer" id="timer"><svg viewBox="0 0 130 130"><circle class="tr-bg" cx="65" cy="65" r="60"/>
  <circle class="tr" id="ring" cx="65" cy="65" r="54" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg><b id="tNum">${q.t}</b></div>`; };
function vQuestionX(g) {
  music.start(true);
  const q = g.q; deadline = (g._t || performance.now()) + g.left;
  view.innerHTML = `
    <div class="qtop"><span class="chip" style="font-size:18px">ข้อ ${g.idx + 1} / ${g.total}</span>${stageChip(g)}${trailHTML(g, passedOf(g))}</div>
    <div class="qstage ${q.img ? 'has-img' : ''}"><div class="card qcard rise"><span class="qno">${q.type === 'fill' ? '🧬 เติมตาราง' : '🔗 จับคู่'} · ข้อ ${g.idx + 1}</span><span>${wordsHTML(q.q, esc)}</span></div>${himg(q)}${timerSVG(q)}</div>
    ${q.type === 'fill' ? fillHTML(q) : matchHTML(q, false, g)}
    <div class="qfoot"><div class="answered">ส่งแล้ว <b id="nAns">${g.answered}</b> / <span id="nAll">${g.players.length}</span> คน</div>
      <button class="btn sun big" id="bReveal">เฉลยเลย ✓</button></div>`;
  if (q.type === 'fill' && q.hx) { $('.bigpun .pun-title')?.remove(); $$('.bigpun th.gm').forEach((t) => (t.textContent = '?')); }
  $('#bReveal').onclick = doReveal;
  runTimer(q); live(g);
}
function vRevealX(g) {
  music.stop(); sound.reveal();
  const q = g.q, total = g.players.length, n = g.answered || 0, avg = (g.trail || [])[g.idx] || 0;
  view.innerHTML = `
    <div class="qtop"><span class="chip" style="font-size:18px">เฉลยข้อ ${g.idx + 1} / ${g.total}</span>${stageChip(g)}${trailHTML({ ...g, trail: (g.trail || []).slice(0, g.idx) }, 0)}</div>
    <div class="qstage ${q.img ? 'has-img' : ''}"><div class="card qcard"><span class="qno">${q.type === 'fill' ? '🧬 เติมตาราง' : '🔗 จับคู่'} · ข้อ ${g.idx + 1}</span>${esc(q.q)}</div>${himg(q)}
      <div class="timer"><svg viewBox="0 0 130 130"><circle class="tr-bg" cx="65" cy="65" r="60"/></svg><b style="font-size:34px;line-height:1.1;text-align:center">${Math.round(avg * 100)}%<small style="display:block;font-size:15px;font-weight:400">ถูกเฉลี่ย</small></b></div></div>
    ${q.type === 'fill' ? fillHTML(q) : matchHTML(q, true, g)}
    <div class="qfoot"><div class="revnote">
        <div class="card">✅ ถูกครบ <b>${g.dist[0] || 0}</b> คน</div><div class="card">🟡 ถูกบางส่วน <b>${g.dist[1] || 0}</b> คน</div>
        ${g.fastest ? `<div class="card">⚡ เร็วสุด: <b>${esc(g.fastest.name)}</b></div>` : ''}
        ${q.x ? `<div class="card xpl">💡 ${esc(q.x)}</div>` : ''}</div>
      <button class="btn vio big" id="bBoard">ดูอันดับ ▶</button></div>`;
  if (q.type === 'fill') {
    const P = parsePunnett(q.g); $('.bigpun').innerHTML = punnettHTML(P, { filled: true });
    const off = q.hx ? q.h1.length + q.h2.length : 0, pct = (i) => (n ? Math.round((((g.itemOk || [])[i] || 0) / n) * 100) : 0);
    $$('.bigpun td.pc').forEach((td, i) => td.insertAdjacentHTML('beforeend', `<em class="pcp ${pct(off + i) >= 50 ? 'hi' : 'lo'}">${pct(off + i)}%</em>`));
    if (q.hx) $$('.bigpun th.gm').forEach((th, i) => th.insertAdjacentHTML('beforeend', `<em class="pcp ${pct(i) >= 50 ? 'hi' : 'lo'}">${pct(i)}%</em>`));
  }
  setTimeout(() => sparkle($('.bigpun') || $('.matchstage'), 14), 900);
  const lines = !total ? 'เฉลยแล้ว!' : avg >= 0.8 ? 'ฮึ่ม… พวกเจ้าเก่งเกินคาด! 🦊' : avg >= 0.5 ? 'ไม่เลว! แต่ยังพลาดบางช่องนะ' : 'ยังไม่แม่นพอ… ดูเฉลยให้ดี ❄️';
  setTimeout(() => peek(M(), lines, avg >= 0.5 ? 'happy' : 'sad', 5200), 900);
  if (avg >= 0.8 && total) setTimeout(() => confetti(90), 700);
  if (isSnow() && total && avg < 0.5) setTimeout(() => blizzard(1500), 400);
  $('#bBoard').onclick = () => act('board');
}

// ===================================================== เส้นทางข้ามด่าน
const TRAIL = { snow: { team: '⛷️', gate: '🧊', open: '🏔️', camp: '⛺', guard: '🦊' }, def: { team: '🚀', gate: '🏁', open: '🏆', camp: '🏠', guard: '⭐' } };
const needPass = (n) => Math.max(1, Math.ceil(n * 0.6));
const passedOf = (g) => (g.trail || []).filter((r) => r != null && r >= 0.5).length;
function trailHTML(g, pos) {
  if (hasStages(g)) return gemTrailHTML(g);
  const T = isFox() ? TRAIL.snow : TRAIL.def, need = needPass(g.total), at = Math.min(pos, need), open = pos >= need;
  const L = (k) => (k / (need + 1)) * 100;
  return `<div class="trail ${open ? 'open' : ''}"><div class="tr-line"><i style="width:${L(at)}%"></i></div>
    <span class="tr-node camp" style="left:0%">${T.camp}</span>
    ${Array.from({ length: need }, (_, k) => `<span class="tr-node ${k < at ? 'ok' : ''}" style="left:${L(k + 1)}%">${T.guard}</span>`).join('')}
    <span class="tr-node gate" style="left:100%">${open ? T.open : T.gate}</span>
    <span class="tr-me" style="left:${L(at)}%">${T.team}</span>
    <span class="tr-cap">ผ่าน ${Math.min(pos, need)}/${need} ด่าน${open ? ' · ประตูเปิดแล้ว!' : ''}</span></div>`;
}

function vQuestion(g) {
  if (g.q.type === 'fill' || g.q.type === 'match') return vQuestionX(g);
  music.start(true);
  const q = g.q, two = q.c.length === 2;
  const P = q.g ? parsePunnett(q.g) : null, pun = P && !P.error && q.gs ? punnettHTML(P) : '';
  deadline = (g._t || performance.now()) + g.left;
  const C = 2 * Math.PI * 54;
  view.innerHTML = `
    <div class="qtop"><span class="chip" style="font-size:18px">ข้อ ${g.idx + 1} / ${g.total}</span>${stageChip(g)}${trailHTML(g, passedOf(g))}</div>
    <div class="qstage ${pun ? 'has-pun' : ''} ${q.img ? 'has-img' : ''}">
      <div class="card qcard rise"><span class="qno">คำถามข้อ ${g.idx + 1}</span><span>${wordsHTML(q.q, esc)}</span></div>${himg(q)}${pun}
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
  if (g.q.type === 'fill' || g.q.type === 'match') return vRevealX(g);
  music.stop(); sound.reveal();
  const q = g.q, two = q.c.length === 2, max = Math.max(1, ...g.dist), total = g.players.length;
  const pctOk = total ? Math.round((g.dist[q.a] / total) * 100) : 0;
  const P = q.g ? parsePunnett(q.g) : null, pun = P && !P.error ? punnettHTML(P, { filled: true }) : '';
  view.innerHTML = `
    <div class="qtop"><span class="chip" style="font-size:18px">เฉลยข้อ ${g.idx + 1} / ${g.total}</span>${stageChip(g)}${trailHTML({ ...g, trail: (g.trail || []).slice(0, g.idx) }, passedOf({ trail: (g.trail || []).slice(0, g.idx) }))}</div>
    <div class="qstage ${pun ? 'has-pun' : ''} ${q.img ? 'has-img' : ''}"><div class="card qcard"><span class="qno">คำถามข้อ ${g.idx + 1}</span>${esc(q.q)}</div>${himg(q)}${pun}
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
  const lines = isFox()
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
  const SG = hasStages(g), gPrev = { ...g, trail: (g.trail || []).slice(0, g.idx) };
  let smsg = msg, sOk = r >= 0.5, justDone = false;
  if (SG && g.q && g.q.st >= 0) {
    const k = g.q.st, X = g.stages[k], gb = gemsOf(gPrev), ga = gemsOf(g), av = Math.round(stageAvg(g, k) * 100);
    justDone = gb.st[k] === undefined && (ga.st[k] === true || ga.st[k] === false);
    const allDone = ga.st.every((x) => x !== undefined);
    smsg = !justDone ? `ข้อนี้ทั้งห้องได้ ${Math.round(r * 100)}% · ด่าน${esc(X.n)} ไปต่อ!`
      : ga.st[k] ? `💎 ได้คริสตัล ${esc(X.ic)} ด่าน${esc(X.n)}! (ถูกเฉลี่ย ${av}%)` : `💨 ด่าน${esc(X.n)} ยังไม่ได้คริสตัล (ถูกเฉลี่ย ${av}%)`;
    if (justDone && allDone) smsg += ga.got >= ga.need ? ' · 🏛️ ประตูแห่งพันธุกรรมเปิดแล้ว!' : ' · 🚪 ประตูยังไม่เปิด…';
    sOk = justDone ? ga.st[k] : r >= 0.5;
  }
  view.innerHTML = `<div class="boardwrap">
    <div class="trail-wrap rise">${SG ? trailHTML(gPrev, 0) : trailHTML(g, before)}<p class="tr-msg ${sOk ? 'ok' : 'bad'}">${smsg}</p></div>
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
  if (SG) { if (justDone) setTimeout(() => { const w = $('.trail-wrap'); w.firstElementChild.outerHTML = trailHTML(g, 0); $('.trail-wrap .trail').classList.add('moved', 'gemup'); sound.fanfare(); if (sOk) confetti(110); }, 800); }
  else if (after !== before) setTimeout(() => { const w = $('.trail-wrap'); if (w) { w.firstElementChild.outerHTML = trailHTML(g, after); $('.trail-wrap .trail').classList.add('moved'); sound.pop(); if (after >= need && before < need) { confetti(120); sound.fanfare(); } } }, 700);
  else if (r < 0.5 && isSnow()) setTimeout(() => blizzard(1300), 500);
  $('#bNext').onclick = () => goNext();
}

function vEnd(g) {
  stopPoll(); music.stop(); SSset('pin', '');
  const b = g.board, P = (i, cls) => b[i] ? `<div class="pod ${cls}"><div class="av">${avatar(b[i].av)}</div><div class="nm">${esc(b[i].name)}${b[i].full ? `<small class="fn">${esc(b[i].full)}</small>` : ''}</div>
    <div class="sc">${b[i].score.toLocaleString()} คะแนน · ถูก ${b[i].correct}/${g.total}</div><div class="block">${i + 1}</div></div>` : '';
  const P1 = b[0] ? P(0, 'p1').replace('<div class="av">', '<div class="av"><span class="crown">👑</span>') : '';
  view.innerHTML = `<div class="boardwrap" style="max-width:1200px">
    <h1 class="rise">🎉 ภารกิจสำเร็จ! ${esc(g.title)}</h1>
    ${g.mode === 'self' ? `<p class="gate-banner">🏃 นักเรียนเล่นเอง · ผู้ร่วมภารกิจ ${g.board.length} คน</p>` : hasStages(g) ? (() => { const gm = gemsOf(g); return `<p class="gate-banner ${gm.got >= gm.need ? 'ok' : ''}">${gm.got >= gm.need ? '🏛️✨ ประตูแห่งพันธุกรรมเปิดออกแล้ว!' : '🚪 ประตูแห่งพันธุกรรมยังปิดอยู่…'} · 💎 ${g.stages.map((x, k) => `<span class="eg ${gm.st[k] ? 'got' : ''}">${esc(x.ic)}</span>`).join('')} ${gm.got}/${g.stages.length}</p>`; })() : (() => { const p = passedOf(g), n = needPass(g.total); return `<p class="gate-banner ${p >= n ? 'ok' : ''}">${p >= n ? (isSnow() ? '🧊✨ ประตูน้ำแข็งเปิดออกแล้ว!' : '🏆 ทั้งห้องพิชิตเส้นชัย!') : (isSnow() ? '❄️ ประตูน้ำแข็งยังปิดอยู่…' : '🏁 เกือบถึงเส้นชัยแล้ว')} · ทั้งห้องผ่าน ${Math.min(p, n)}/${n} ด่าน</p>`; })()}
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
  setTimeout(() => peek(M(), isFox() ? ((hasStages(g) ? gemsOf(g).got >= gemsOf(g).need : passedOf(g) >= needPass(g.total)) ? 'พวกเจ้าคือนักสำรวจตัวจริง! ข้ายอมรับ 🦊' : 'ครั้งหน้าข้าจะรอพวกเจ้าอีกนะ ❄️') : 'ปรบมือให้แชมป์หน่อย! 👏', 'happy', 4500), 3400);
  $('#bNew').onclick = () => { PIN = ''; G = null; lastKey = ''; shown = new Set(); selfSeen = new Set(); prevBoard = []; showSetup(); };
}

// ===================================================== ปุ่มลัด
let coolUntil = 0;
function primary() {
  if (!G || !PIN || performance.now() < coolUntil) return;
  coolUntil = performance.now() + 900;
  ({ lobby: startGame, question: doReveal, reveal: () => act('board'), board: goNext })[G.phase]?.();
}
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); if ($('#bSave')) saveCloud(); return; }
  if (e.target.closest('input,textarea,select') || !$('#mImport').hidden || $('.modal:not([hidden])')) return;
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

if (PIN) startPoll(); else showLibrary();
