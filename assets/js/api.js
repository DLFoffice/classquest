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
  hpoll: 'hostPoll', join: 'join', answer: 'answer', poll: 'playerPoll' };

async function callLocal(action, body) {
  await sleep(60);
  if (action === 'check') return { ok: true };
  if (action === 'results') return { rooms: local.get('sheet_rooms') || [], answers: local.get('sheet_answers') || [], players: local.get('sheet_players') || [] };
  return window.CQ[LOCAL_MAP[action]](local, body);
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
