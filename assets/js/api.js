// เชื่อมต่อเซิร์ฟเวอร์ (Google Apps Script) หรือโหมดทดลองในเครื่อง (localStorage + engine เดียวกัน)
const CFG = window.CQ_CONFIG || {};
export const API_URL = String(CFG.API_URL || '').trim();
export const DEMO = !API_URL;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------- โหมดทดลอง ----------------
const LS = 'cq:';
const local = {
  get(k) { try { const v = localStorage.getItem(LS + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  put(k, v) { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} },
  getAll(keys) { const o = {}; keys.forEach((k) => { const v = local.get(k); if (v) o[k] = v; }); return o; },
  lock: (fn) => fn(),
  now: () => Date.now(),
  append(sheet, rows) {
    const all = local.get('sheet_' + sheet) || [];
    rows.forEach((r) => all.push(r.map((x) => (x instanceof Date ? fmt(x) : x))));
    local.put('sheet_' + sheet, all);
  },
};
const p2 = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
const LOCAL_MAP = { create: 'createRoom', next: 'next', reveal: 'reveal', board: 'showBoard', end: 'end', kick: 'kick',
  hpoll: 'hostPoll', react: 'react', squestion: 'sQuestion', sanswer: 'sAnswer', sstart: 'sStart', join: 'join', answer: 'answer', poll: 'playerPoll' };

async function callLocal(action, body) {
  await sleep(60);
  if (action === 'check') return { ok: true };
  if (action === 'upload') return { url: body.data };
  if (action.startsWith('lib_') || action.startsWith('subj_')) return libLocal(action, body);
  if (action === 'results') return { rooms: local.get('sheet_rooms') || [], answers: local.get('sheet_answers') || [], players: local.get('sheet_players') || [] };
  return window.CQ[LOCAL_MAP[action]](local, body);
}

// คลังกิจกรรมในเครื่อง (โหมดทดลอง)
function libLocal(action, b) {
  const L = local.get('lib') || { subjects: [], items: {} }, put = () => local.put('lib', L), now = fmt(new Date()).slice(0, 16);
  const addSubj = (n) => { if (n && !L.subjects.includes(n)) L.subjects.push(n); };
  if (action === 'lib_list') {
    const items = Object.values(L.items).map(({ data, ...x }) => x);
    items.forEach((x) => addSubj(x.subject));
    return { subjects: L.subjects.slice(), items };
  }
  if (action === 'lib_get') { const x = L.items[b.id]; if (!x) throw new Error('ไม่พบกิจกรรมนี้ (อาจถูกลบไปแล้ว)'); return { id: x.id, subject: x.subject, title: x.title, set: JSON.parse(x.data) }; }
  if (action === 'lib_save') {
    const subject = String(b.subject || '').trim(), title = String(b.title || '').trim();
    if (!subject) throw new Error('กรุณาเลือกรายวิชา'); if (!title) throw new Error('กรุณาตั้งชื่อกิจกรรม');
    const id = b.id && L.items[b.id] ? b.id : Math.random().toString(36).slice(2, 12), set = b.set || {};
    L.items[id] = { id, subject, title, n: (set.questions || []).length, updated: now, theme: set.theme || '', mode: set.mode || '', data: JSON.stringify(set) };
    addSubj(subject); put(); return { id, updated: now };
  }
  if (action === 'lib_delete') { delete L.items[b.id]; put(); return { ok: true }; }
  if (action === 'subj_save') {
    const name = String(b.name || '').trim(), old = String(b.old || '').trim(); if (!name) throw new Error('กรุณาใส่ชื่อรายวิชา');
    if (old) { L.subjects = L.subjects.map((s) => (s === old ? name : s)); Object.values(L.items).forEach((x) => { if (x.subject === old) x.subject = name; }); }
    addSubj(name); put(); return { ok: true };
  }
  if (action === 'subj_delete') {
    if (Object.values(L.items).some((x) => x.subject === b.name)) throw new Error('ยังมีกิจกรรมในวิชานี้ — ย้ายหรือลบกิจกรรมก่อน');
    L.subjects = L.subjects.filter((s) => s !== b.name); put(); return { ok: true };
  }
}

// ---------------- Google Apps Script ----------------
async function callRemote(action, body, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...body, action }), redirect: 'follow' });
      if (res.status === 429 || res.status >= 500) throw new TypeError('busy ' + res.status);
      const j = await res.json();
      if (!j.ok) { const e = new Error(j.error || 'เกิดข้อผิดพลาด'); e.server = true; throw e; }
      return j.data;
    } catch (e) {
      last = e;
      if (e.server && !/ทำงานหนัก/.test(e.message)) throw e;
      await sleep(400 * (i + 1) + Math.random() * 400);
    }
  }
  throw last && last.server ? last : new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
}

export const call = (action, body = {}) => (DEMO ? callLocal(action, body) : callRemote(action, body));
