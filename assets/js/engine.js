/* ClassQuest game engine — ใช้ร่วมกันทั้งในเบราว์เซอร์ (โหมดทดลอง) และใน Google Apps Script
 * store = { get(k), put(k, v, durable), getAll(keys), lock(fn), now(), append(sheet, rows) }
 * ห้ามใช้ import/export (GAS ไม่รองรับ) */
var CQ = (function () {
  var MAX_PLAYERS = 80;
  var BASE = 500, SPEED = 500, STREAK = 100;

  function err(msg) { var e = new Error(msg); e.cq = true; return e; }
  function roomKey(pin) { return 'room_' + pin; }
  function ansKey(pin, idx, pid) { return 'a_' + pin + '_' + idx + '_' + pid; }
  function getRoom(store, pin) {
    var r = store.get(roomKey(String(pin || '').trim()));
    if (!r) throw err('ไม่พบห้องเกมนี้ ตรวจสอบรหัสห้องอีกครั้ง');
    return r;
  }
  function save(store, r) { r.ver = (r.ver || 0) + 1; store.put(roomKey(r.pin), r, true); }
  function clip(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n); }

  function cleanQuestions(qs) {
    if (!qs || !qs.length) throw err('ยังไม่มีข้อคำถาม');
    if (qs.length > 50) throw err('ข้อคำถามได้ไม่เกิน 50 ข้อ');
    return qs.map(function (q, i) {
      var c = (q.c || []).map(function (x) { return clip(x, 120); }).filter(function (x) { return x; });
      var a = Number(q.a);
      if (!clip(q.q, 300)) throw err('ข้อ ' + (i + 1) + ' ยังไม่มีคำถาม');
      if (c.length < 2) throw err('ข้อ ' + (i + 1) + ' ต้องมีตัวเลือกอย่างน้อย 2 ตัว');
      if (!(a >= 0 && a < c.length)) throw err('ข้อ ' + (i + 1) + ' ยังไม่ได้เลือกคำตอบที่ถูก');
      var t = Math.max(5, Math.min(120, Number(q.t) || 20));
      return { q: clip(q.q, 300), c: c, a: a, t: t, x: clip(q.x, 200) };
    });
  }

  function ranking(r) {
    return r.order.slice().sort(function (a, b) {
      var A = r.players[a], B = r.players[b];
      return B.s - A.s || B.c - A.c || A.j - B.j;
    });
  }
  function board(r, n) {
    return ranking(r).slice(0, n || 999).map(function (pid, i) {
      var p = r.players[pid]; return { rank: i + 1, name: p.n, score: p.s, correct: p.c, av: p.av };
    });
  }

  // ---------------------------------------------------------------- ครู
  function createRoom(store, o) {
    var qs = cleanQuestions(o.questions);
    return store.lock(function () {
      var pin = '';
      for (var k = 0; k < 40 && !pin; k++) {
        var p = String(Math.floor(1000 + Math.random() * 9000));
        if (!store.get(roomKey(p))) pin = p;
      }
      if (!pin) throw err('สร้างห้องไม่สำเร็จ ลองใหม่อีกครั้ง');
      var r = { pin: pin, title: clip(o.title, 80) || 'ภารกิจตอบคำถาม', qs: qs, phase: 'lobby', idx: -1,
        qStart: 0, qEnd: 0, players: {}, order: [], created: store.now(), last: null, ver: 0 };
      save(store, r);
      store.append('rooms', [[new Date(store.now()), pin, r.title, qs.length, 'สร้างห้อง']]);
      return { pin: pin };
    });
  }

  function next(store, o) {
    return store.lock(function () {
      var r = getRoom(store, o.pin);
      if (r.phase === 'question') throw err('ยังเฉลยข้อนี้ไม่เสร็จ');
      if (r.phase === 'end') return view(store, r);
      if (r.idx + 1 >= r.qs.length) return finish(store, r);
      r.idx++; r.phase = 'question'; r.qStart = store.now(); r.qEnd = r.qStart + r.qs[r.idx].t * 1000; r.last = null;
      save(store, r);
      return view(store, r);
    });
  }

  function reveal(store, o) {
    return store.lock(function () {
      var r = getRoom(store, o.pin);
      if (r.phase !== 'question') return view(store, r);
      var q = r.qs[r.idx], keys = r.order.map(function (pid) { return ansKey(r.pin, r.idx, pid); });
      var got = store.getAll(keys), dist = q.c.map(function () { return 0; }), res = {}, rows = [], now = new Date(store.now());
      r.order.forEach(function (pid) {
        var p = r.players[pid], a = got[ansKey(r.pin, r.idx, pid)], ok = !!a && a.c === q.a, g = 0;
        if (a && a.c >= 0 && a.c < dist.length) dist[a.c]++;
        if (ok) {
          p.st = (p.st || 0) + 1;
          g = BASE + Math.round(SPEED * Math.max(0, 1 - a.ms / (q.t * 1000))) + (p.st >= 3 ? STREAK : 0);
          p.c++;
        } else p.st = 0;
        p.s += g;
        res[pid] = { ch: a ? a.c : -1, ok: ok, g: g, ms: a ? a.ms : null };
        rows.push([now, r.pin, r.title, r.idx + 1, q.q, p.n, a ? q.c[a.c] || '' : '(ไม่ได้ตอบ)', ok ? 'ถูก' : 'ผิด',
          a ? Math.round(a.ms / 100) / 10 : '', g, p.s]);
      });
      r.phase = 'reveal'; r.last = { idx: r.idx, dist: dist, res: res, n: Object.keys(got).length };
      r.qEnd = Math.min(r.qEnd, store.now());
      save(store, r);
      if (rows.length) store.append('answers', rows);
      return view(store, r);
    });
  }

  function showBoard(store, o) {
    return store.lock(function () {
      var r = getRoom(store, o.pin);
      if (r.phase === 'reveal') { r.phase = 'board'; save(store, r); }
      return view(store, r);
    });
  }

  function finish(store, r) {
    r.phase = 'end'; save(store, r);
    var now = new Date(store.now()), total = r.qs.length;
    var rows = board(r).map(function (b) {
      return [now, r.pin, r.title, b.rank, b.name, b.score, b.correct, total, Math.round((b.correct / total) * 1000) / 10];
    });
    if (rows.length) store.append('players', rows);
    store.append('rooms', [[now, r.pin, r.title, total, 'จบเกม · ผู้เล่น ' + r.order.length + ' คน']]);
    return view(store, r);
  }
  function end(store, o) {
    return store.lock(function () {
      var r = getRoom(store, o.pin);
      if (r.phase === 'question') throw err('กรุณาเฉลยข้อนี้ก่อนจบเกม');
      return r.phase === 'end' ? view(store, r) : finish(store, r);
    });
  }

  function kick(store, o) {
    return store.lock(function () {
      var r = getRoom(store, o.pin), pid = String(o.pid || '');
      if (r.players[pid]) { delete r.players[pid]; r.order = r.order.filter(function (x) { return x !== pid; }); save(store, r); }
      return view(store, r);
    });
  }

  /** มุมมองของครู */
  function view(store, r) {
    var out = { pin: r.pin, title: r.title, phase: r.phase, idx: r.idx, total: r.qs.length, ver: r.ver,
      players: r.order.map(function (pid) { var p = r.players[pid]; return { pid: pid, name: p.n, av: p.av }; }) };
    if (r.idx >= 0) out.q = r.qs[r.idx];
    if (r.phase === 'question') {
      out.left = Math.max(0, r.qEnd - store.now());
      var got = store.getAll(r.order.map(function (pid) { return ansKey(r.pin, r.idx, pid); }));
      out.answered = Object.keys(got).length;
    }
    if (r.last) { out.dist = r.last.dist; out.answered = r.last.n; }
    if (r.phase !== 'lobby' && r.phase !== 'question') out.board = board(r, r.phase === 'end' ? 999 : 5);
    if (r.phase === 'reveal' && r.last) {
      // ใครตอบถูกเร็วที่สุด
      var fast = null;
      Object.keys(r.last.res).forEach(function (pid) {
        var x = r.last.res[pid]; if (x.ok && r.players[pid] && (!fast || x.ms < fast.ms)) fast = { name: r.players[pid].n, ms: x.ms };
      });
      out.fastest = fast;
    }
    return out;
  }
  function hostPoll(store, o) { return view(store, getRoom(store, o.pin)); }

  // ---------------------------------------------------------------- นักเรียน
  function join(store, o) {
    var name = clip(o.name, 20), pid = clip(o.pid, 24), av = Math.max(0, Math.min(11, Number(o.av) || 0));
    if (name.length < 1) throw err('กรุณาใส่ชื่อเล่น');
    if (!/^[a-zA-Z0-9]{6,24}$/.test(pid)) throw err('ข้อมูลผู้เล่นไม่ถูกต้อง');
    return store.lock(function () {
      var r = getRoom(store, o.pin);
      if (r.players[pid]) return { pid: pid, name: r.players[pid].n, title: r.title };
      if (r.phase === 'end') throw err('เกมนี้จบแล้ว');
      if (r.order.length >= MAX_PLAYERS) throw err('ห้องเต็มแล้ว');
      var used = {}; r.order.forEach(function (x) { used[r.players[x].n.toLowerCase()] = 1; });
      var n = name, k = 2; while (used[n.toLowerCase()]) n = name + ' ' + k++;
      r.players[pid] = { n: n, s: 0, st: 0, c: 0, j: store.now(), av: av };
      r.order.push(pid);
      save(store, r);
      return { pid: pid, name: n, title: r.title };
    });
  }

  function answer(store, o) {
    var r = getRoom(store, o.pin), pid = String(o.pid || ''), idx = Number(o.idx), c = Number(o.choice);
    if (!r.players[pid]) throw err('ไม่พบผู้เล่น กรุณาเข้าห้องใหม่');
    if (r.phase !== 'question' || idx !== r.idx) return { late: true };
    var now = store.now();
    if (now > r.qEnd + 1500) return { late: true };
    if (!(c >= 0 && c < r.qs[r.idx].c.length)) throw err('คำตอบไม่ถูกต้อง');
    var k = ansKey(r.pin, idx, pid);
    if (store.get(k)) return { dup: true };
    store.put(k, { c: c, ms: Math.max(0, now - r.qStart) });
    return { ok: true };
  }

  function playerPoll(store, o) {
    var r = getRoom(store, o.pin), pid = String(o.pid || ''), me = r.players[pid];
    if (!me) throw err('ไม่พบผู้เล่น กรุณาเข้าห้องใหม่');
    var out = { phase: r.phase, idx: r.idx, total: r.qs.length, ver: r.ver, title: r.title, name: me.n, score: me.s, players: r.order.length };
    if (r.phase === 'question') {
      var q = r.qs[r.idx];
      out.q = { q: q.q, c: q.c, t: q.t }; out.left = Math.max(0, r.qEnd - store.now());
      out.answered = !!store.get(ansKey(r.pin, r.idx, pid));
    } else if (r.phase !== 'lobby') {
      var rk = ranking(r), pos = rk.indexOf(pid);
      out.rank = pos + 1; out.correct = me.c; out.streak = me.st || 0;
      if (pos > 0) { var ahead = r.players[rk[pos - 1]]; out.behind = { name: ahead.n, by: ahead.s - me.s }; }
      if (r.last && r.idx >= 0) {
        var q2 = r.qs[r.idx], res = r.last.res[pid] || { ch: -1, ok: false, g: 0 };
        out.result = { ok: res.ok, gained: res.g, choice: res.ch, answer: q2.a, answerText: q2.c[q2.a], explain: q2.x };
      }
    }
    return out;
  }

  return { createRoom: createRoom, next: next, reveal: reveal, showBoard: showBoard, end: end, kick: kick,
    hostPoll: hostPoll, join: join, answer: answer, playerPoll: playerPoll, cleanQuestions: cleanQuestions };
})();
if (typeof module !== 'undefined') module.exports = CQ;
