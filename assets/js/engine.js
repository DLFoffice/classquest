/* ClassQuest game engine — ใช้ร่วมกันทั้งในเบราว์เซอร์ (โหมดทดลอง) และใน Google Apps Script
 * store = { get(k), put(k, v, durable), getAll(keys), lock(fn), now(), append(sheet, rows) }
 * ห้ามใช้ import/export (GAS ไม่รองรับ) */
var CQ = (function () {
  var MAX_PLAYERS = 80;
  var BASE = 500, SPEED = 500, STREAK = 100;

  function err(msg) { var e = new Error(msg); e.cq = true; return e; }
  function spKey(pin, pid) { return 'sp_' + pin + '_' + pid; }
  function phoneQ(q) {
    var o = phoneQ0(q); if (q.img) o.img = q.img; return o;
  }
  function phoneQ0(q) {
    if (q.type === 'fill' && q.gen) return { type: 'fill', gen: true, q: q.q, t: q.t, lay: q.lay, cw: q.cw, h1: q.h1, h2: q.h2, opts: q.opts, n: q.k.length };
    if (q.type === 'fill') return { type: 'fill', q: q.q, t: q.t, hx: q.hx, h1: q.hx ? null : q.h1, h2: q.hx ? null : q.h2, cols: q.h1.length, rows: q.h2.length, opts: q.opts, pl: q.pl, fur: q.fur };
    if (q.type === 'match') return { type: 'match', q: q.q, t: q.t, L: q.p.map(function (x) { return x.l; }), R: q.perm.map(function (j) { return q.p[j].r; }) };
    return { type: 'mc', q: q.q, c: q.c, t: q.t };
  }
  function resultOf(q, res) {
    var out = { type: q.type || 'mc', ok: res.ok, gained: res.g, choice: res.ch, explain: q.x, frac: res.frac == null ? (res.ok ? 1 : 0) : res.frac, items: res.items || null };
    if (q.type === 'fill' && q.gen) { out.key = q.k; out.gen = true; out.lay = q.lay; out.cw = q.cw; out.h1 = q.h1; out.h2 = q.h2; }
    else if (q.type === 'fill') { out.key = q.k; out.cols = q.h1.length; out.rows = q.h2.length; out.hx = q.hx; out.h1 = q.h1; out.h2 = q.h2; }
    else if (q.type === 'match') out.pairs = q.p;
    else { out.answer = q.a; out.answerText = q.c[q.a]; }
    return out;
  }
  function stageInfo(r, i) { var q = r.qs[i], sg = q && r.stages && q.st >= 0 ? r.stages[q.st] : null; return sg ? { n: sg.n, ic: sg.ic, th: sg.th, d: sg.d, no: q.st + 1 } : null; }
  function rxKey(pin) { return 'rx_' + pin; }
  var EMOJI = ['🎉', '😆', '👍', '❤️', '🔥', '🚀'];
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
      var no = 'ข้อ ' + (i + 1) + ' ', ty = q.type === 'fill' || q.type === 'match' ? q.type : 'mc';
      if (!clip(q.q, 300)) throw err(no + 'ยังไม่มีคำถาม');
      var st = Number(q.st); st = st >= 0 && st < 8 ? Math.floor(st) : -1;
      var img = String(q.img || ''); img = /^https:\/\/[^\s"'<>]{8,800}$/.test(img) || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(img) ? img : '';
      if (ty === 'fill' && q.gen) {
        var cw = Math.max(1, Math.min(6, Math.floor(Number(q.cw) || 0))), lay = (q.lay || []).slice(0, 48).map(function (x) { return x == null ? null : clip(x, 80); });
        var kk = (q.k || []).map(function (x) { return clip(x, 60); }), nb = lay.filter(function (x) { return x === null; }).length;
        if (!lay.length || lay.length % cw || !nb || nb !== kk.length || kk.some(function (x) { return !x; })) throw err(no + 'ตารางยังไม่ถูกต้อง (ต้องมีช่องให้เติมและใส่คำตอบทุกช่อง)');
        var op = (q.opts || []).slice(0, 30).map(function (x) { return clip(x, 60); }).filter(Boolean);
        kk.forEach(function (x) { if (op.indexOf(x) < 0) op.push(x); });
        return { type: 'fill', gen: true, q: clip(q.q, 300), t: Math.max(10, Math.min(180, Number(q.t) || 60)), x: clip(q.x, 200), st: st, img: img,
          lay: lay, cw: cw, h1: (q.h1 || []).slice(0, cw).map(function (x) { return clip(x, 60); }), h2: (q.h2 || []).slice(0, lay.length / cw).map(function (x) { return clip(x, 60); }), k: kk, opts: op };
      }
      if (ty === 'fill') {
        var k = (q.k || []).map(function (x) { return clip(x, 8); }), h1 = (q.h1 || []).map(function (x) { return clip(x, 4); }), h2 = (q.h2 || []).map(function (x) { return clip(x, 4); });
        if (!k.length || k.length > 40 || !h1.length || !h2.length || k.some(function (x) { return !x; })) throw err(no + 'ตารางพันนิตต์ยังไม่ถูกต้อง');
        var fur = (q.fur || []).slice(0, 2).map(function (x) { return /^#[0-9a-fA-F]{3,8}$/.test(String(x)) ? String(x) : '#ffffff'; });
        return { type: 'fill', q: clip(q.q, 300), t: Math.max(10, Math.min(180, Number(q.t) || 60)), x: clip(q.x, 200), st: st, img: img, g: clip(q.g, 60),
          k: k, h1: h1, h2: h2, hx: !!q.hx, opts: (q.opts || []).slice(0, 12).map(function (x) { return clip(x, 8); }),
          pl: [clip((q.pl || [])[0], 40), clip((q.pl || [])[1], 40)], fur: fur };
      }
      if (ty === 'match') {
        var pr = (q.p || []).map(function (x) { return { l: clip(x && x.l, 60), r: clip(x && x.r, 90) }; }).filter(function (x) { return x.l && x.r; });
        if (pr.length < 2 || pr.length > 6) throw err(no + 'ต้องมีคู่จับคู่ 2–6 คู่');
        var perm = pr.map(function (_, j) { return j; });
        for (var tries = 0; tries < 10; tries++) {
          for (var m = perm.length - 1; m > 0; m--) { var j2 = Math.floor(Math.random() * (m + 1)), tmp = perm[m]; perm[m] = perm[j2]; perm[j2] = tmp; }
          if (perm.some(function (v, j) { return v !== j; })) break;
        }
        return { type: 'match', q: clip(q.q, 300), t: Math.max(10, Math.min(180, Number(q.t) || 45)), x: clip(q.x, 200), st: st, img: img, p: pr, perm: perm };
      }
      var c = (q.c || []).map(function (x) { return clip(x, 120); }).filter(function (x) { return x; });
      var a = Number(q.a);
      if (c.length < 2) throw err('ข้อ ' + (i + 1) + ' ต้องมีตัวเลือกอย่างน้อย 2 ตัว');
      if (!(a >= 0 && a < c.length)) throw err('ข้อ ' + (i + 1) + ' ยังไม่ได้เลือกคำตอบที่ถูก');
      var t = Math.max(5, Math.min(120, Number(q.t) || 20));
      return { type: 'mc', q: clip(q.q, 300), c: c, a: a, t: t, x: clip(q.x, 200), g: clip(q.g, 60), gs: !!q.gs, st: st, img: img };
    });
  }

  function cleanStages(a) {
    return (a || []).slice(0, 8).map(function (x) { return { n: clip(x && x.n, 40), th: clip(x && x.th, 12), d: clip(x && x.d, 90), ic: clip(x && x.ic, 6) }; });
  }
  function themeOf(r, idx) {
    var q = r.qs[idx];
    if (q && r.stages && q.st >= 0 && r.stages[q.st] && r.stages[q.st].th) return r.stages[q.st].th;
    return r.theme || '';
  }
  function normG(x) {
    x = String(x || '');
    if (x.length === 2 && x[0].toLowerCase() === x[1].toLowerCase() && x[0] !== x[0].toUpperCase() && x[1] === x[1].toUpperCase()) return x[1] + x[0];
    return x;
  }
  function grade(q, a) {
    if (!a) return { ok: false, frac: 0, items: null };
    if (q.type === 'fill') {
      var it = q.k.map(function (v, i) { return String(a.c[i] || '') === v; });
      if (q.hx) { // เติมหัวตารางเอง: ลำดับเซลล์สืบพันธุ์สลับกันได้ → ตรวจตารางลูกตามหัวตารางที่นักเรียนเติม
        var n1 = q.h1.length, n2 = q.h2.length, s1 = a.c.slice(0, n1), s2 = a.c.slice(n1, n1 + n2);
        var same = function (x, y) { return x.slice().sort().join() === y.slice().sort().join(); };
        var r1 = same(s1, q.h1), r2 = same(s2, q.h2), H1 = r1 ? s1 : q.h1, H2 = r2 ? s2 : q.h2;
        it = [];
        for (var i1 = 0; i1 < n1; i1++) it.push(r1 || s1[i1] === q.h1[i1]);
        for (var i2 = 0; i2 < n2; i2++) it.push(r2 || s2[i2] === q.h2[i2]);
        for (var rr = 0; rr < n2; rr++) for (var cc = 0; cc < n1; cc++) it.push(String(a.c[n1 + n2 + rr * n1 + cc] || '') === normG(H1[cc] + H2[rr]));
      }
      var n = it.filter(Boolean).length; return { ok: n === it.length, frac: n / it.length, items: it };
    }
    if (q.type === 'match') {
      var im = q.p.map(function (_, i) { return q.perm[a.c[i]] === i; });
      var nm = im.filter(Boolean).length; return { ok: nm === im.length, frac: nm / im.length, items: im };
    }
    var ok = a.c === q.a; return { ok: ok, frac: ok ? 1 : 0, items: null };
  }
  function ranking(r) {
    return r.order.slice().sort(function (a, b) {
      var A = r.players[a], B = r.players[b];
      return B.s - A.s || B.c - A.c || A.j - B.j;
    });
  }
  function board(r, n) {
    return ranking(r).slice(0, n || 999).map(function (pid, i) {
      var p = r.players[pid]; return { rank: i + 1, name: p.n, full: p.f || '', score: p.s, correct: p.c, av: p.av };
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
      if (o.mode === 'station' && !(o.stages || []).length) throw err('โหมดฐานต้องเปิดใช้ระบบด่านก่อน');
      var r = { pin: pin, title: clip(o.title, 80) || 'ภารกิจตอบคำถาม', theme: clip(o.theme, 12), qs: qs, stages: cleanStages(o.stages), mode: o.mode === 'self' || o.mode === 'station' ? o.mode : 'live', rotate: o.rotate !== false, phase: o.mode === 'self' || o.mode === 'station' ? 'self' : 'lobby', idx: -1,
        qStart: 0, qEnd: 0, players: {}, order: [], created: store.now(), last: null, ver: 0 };
      save(store, r);
      store.append('rooms', [[new Date(store.now()), pin, r.title, qs.length, r.mode === 'station' ? 'สร้างห้อง (แบบฐาน)' : r.mode === 'self' ? 'สร้างห้อง (นักเรียนเล่นเอง)' : 'สร้างห้อง (เล่นสด)']]);
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
      var got = store.getAll(keys), res = {}, rows = [], now = new Date(store.now());
      var mc = q.type === 'mc', nItems = q.type === 'fill' ? q.k.length : q.type === 'match' ? q.p.length : 0;
      var dist = mc ? q.c.map(function () { return 0; }) : [0, 0, 0], itemOk = [], sumFrac = 0;
      for (var z = 0; z < nItems; z++) itemOk.push(0);
      r.order.forEach(function (pid) {
        var p = r.players[pid], a = got[ansKey(r.pin, r.idx, pid)], gr = grade(q, a), g = 0;
        if (mc) { if (a && a.c >= 0 && a.c < dist.length) dist[a.c]++; }
        else if (a) { dist[gr.ok ? 0 : gr.frac > 0 ? 1 : 2]++; gr.items.forEach(function (v, i) { if (v) itemOk[i]++; }); }
        sumFrac += gr.frac;
        if (gr.ok) p.st = (p.st || 0) + 1; else p.st = 0;
        if (gr.frac > 0) g = Math.round((BASE + SPEED * Math.max(0, 1 - a.ms / (q.t * 1000))) * gr.frac) + (gr.ok && p.st >= 3 ? STREAK : 0);
        if (gr.ok) p.c++;
        p.s += g;
        res[pid] = { ch: a ? a.c : -1, ok: gr.ok, g: g, ms: a ? a.ms : null, frac: gr.frac, items: gr.items };
        var txt = !a ? '(ไม่ได้ตอบ)' : mc ? q.c[a.c] || '' : q.type === 'fill' ? a.c.join(' ')
          : q.p.map(function (x, i) { return x.l + '→' + (q.p[q.perm[a.c[i]]] || {}).r; }).join(' | ');
        var cnt = gr.items ? gr.items.filter(Boolean).length : 0;
        rows.push([now, r.pin, r.title, r.idx + 1, q.q, p.n, txt, gr.ok ? 'ถูก' : !mc && cnt ? 'ถูกบางส่วน ' + cnt + '/' + nItems : 'ผิด',
          a ? Math.round(a.ms / 100) / 10 : '', g, p.s, p.f || '', q.st >= 0 && r.stages && r.stages[q.st] ? r.stages[q.st].n : '']);
      });
      r.phase = 'reveal'; r.last = { idx: r.idx, dist: dist, res: res, n: Object.keys(got).length, itemOk: itemOk };
      r.trail = r.trail || [];
      r.trail[r.idx] = !r.order.length ? 0 : mc ? Math.round((dist[q.a] / r.order.length) * 1000) / 1000 : Math.round((sumFrac / r.order.length) * 1000) / 1000;
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
    if (r.mode === 'self' || r.mode === 'station') {
      var sps = store.getAll(r.order.map(function (pid) { return spKey(r.pin, pid); }));
      r.order.forEach(function (pid) { var sp = sps[spKey(r.pin, pid)]; if (sp) { r.players[pid].s = sp.s; r.players[pid].c = sp.c; } });
    }
    r.phase = 'end'; save(store, r);
    var now = new Date(store.now()), total = r.qs.length;
    var rows = board(r).map(function (b) {
      return [now, r.pin, r.title, b.rank, b.name, b.score, b.correct, total, Math.round((b.correct / total) * 1000) / 10, b.full];
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
    var out = { pin: r.pin, title: r.title, theme: r.phase === 'lobby' || r.phase === 'end' ? r.theme || '' : themeOf(r, r.idx), stages: r.stages || [],
      nst: r.qs[r.idx + 1] ? r.qs[r.idx + 1].st : null, stq: r.qs.map(function (x) { return x.st; }), phase: r.phase, idx: r.idx, total: r.qs.length, ver: r.ver,
      players: r.order.map(function (pid) { var p = r.players[pid]; return { pid: pid, name: p.n, full: p.f || '', av: p.av }; }) };
    out.mode = r.mode || 'live';
    if (r.phase === 'self') {
      var sps = store.getAll(r.order.map(function (pid) { return spKey(r.pin, pid); }));
      var nAll = r.qs.length;
      out.rotate = !!r.rotate;
      out.self = r.order.map(function (pid) { var p = r.players[pid], sp = sps[spKey(r.pin, pid)] || { P: {} }, P = sp.P || {}, A = P.a || {};
        var stp = {}; Object.keys(P).forEach(function (key) { if (key !== 'a') stp[key] = { i: P[key].i, done: !!P[key].done, s: P[key].s, c: P[key].c }; });
        return { pid: pid, name: p.n, full: p.f || '', av: p.av, i: r.mode === 'station' ? Object.keys(stp).reduce(function (a, x) { return a + stp[x].i; }, 0) : A.i || 0,
          s: sp.s || 0, c: sp.c || 0, done: r.mode === 'station' ? false : !!A.done, started: !!sp.t0, cur: sp.cur == null ? null : sp.cur, stp: stp }; });
    }
    if (r.idx >= 0) out.q = r.qs[r.idx];
    out.trail = r.trail || [];
    if (r.phase === 'lobby') out.rx = (store.get(rxKey(r.pin)) || []).filter(function (x) { return x.t > store.now() - 6000; });
    if (r.phase === 'question') {
      out.left = Math.max(0, r.qEnd - store.now());
      var got = store.getAll(r.order.map(function (pid) { return ansKey(r.pin, r.idx, pid); }));
      out.answered = Object.keys(got).length;
    }
    if (r.last) { out.dist = r.last.dist; out.answered = r.last.n; out.itemOk = r.last.itemOk || []; }
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
    var name = clip(o.name, 20), full = clip(o.full, 60), pid = clip(o.pid, 24), av = Math.max(0, Math.min(11, Number(o.av) || 0));
    if (full.length < 2) throw err('กรุณาใส่ชื่อ-สกุล');
    if (name.length < 1) throw err('กรุณาใส่ชื่อเล่น');
    if (!/^[a-zA-Z0-9]{6,24}$/.test(pid)) throw err('ข้อมูลผู้เล่นไม่ถูกต้อง');
    return store.lock(function () {
      var r = getRoom(store, o.pin);
      if (r.players[pid]) return { pid: pid, name: r.players[pid].n, title: r.title, mode: r.mode || 'live' };
      if (r.phase === 'end') throw err('เกมนี้จบแล้ว');
      if (r.order.length >= MAX_PLAYERS) throw err('ห้องเต็มแล้ว');
      var used = {}; r.order.forEach(function (x) { used[r.players[x].n.toLowerCase()] = 1; });
      var n = name, k = 2; while (used[n.toLowerCase()]) n = name + ' ' + k++;
      r.players[pid] = { n: n, f: full, s: 0, st: 0, c: 0, j: store.now(), av: av };
      r.order.push(pid);
      save(store, r);
      return { pid: pid, name: n, title: r.title, mode: r.mode || 'live' };
    });
  }

  function answer(store, o) {
    var r = getRoom(store, o.pin), pid = String(o.pid || ''), idx = Number(o.idx), c;
    if (!r.players[pid]) throw err('ไม่พบผู้เล่น กรุณาเข้าห้องใหม่');
    if (r.phase !== 'question' || idx !== r.idx) return { late: true };
    var now = store.now();
    if (now > r.qEnd + 1500) return { late: true };
    var q = r.qs[r.idx];
    if (q.type === 'fill') {
      if (!Array.isArray(o.choice) || o.choice.length !== q.k.length) throw err('กรุณาเติมให้ครบทุกช่อง');
      c = o.choice.map(function (x) { return clip(x, 60); });
    } else if (q.type === 'match') {
      if (!Array.isArray(o.choice) || o.choice.length !== q.p.length) throw err('กรุณาจับคู่ให้ครบ');
      c = o.choice.map(Number);
      if (c.some(function (x) { return !(x >= 0 && x < q.p.length); })) throw err('คำตอบไม่ถูกต้อง');
    } else {
      c = Number(o.choice);
      if (!(c >= 0 && c < q.c.length)) throw err('คำตอบไม่ถูกต้อง');
    }
    var k = ansKey(r.pin, idx, pid);
    if (store.get(k)) return { dup: true };
    store.put(k, { c: c, ms: Math.max(0, now - r.qStart) });
    return { ok: true };
  }

  // ---------------------------------------------------------------- โหมดนักเรียนเล่นเอง / โหมดฐาน
  // sp = { s, c, st, t0, cur: 'a' | '0'..'7' | null, P: { key: { i, qs, f[], done, s, c } } }
  function listFor(r, key) {
    if (key === 'a') return r.qs.map(function (_, i) { return i; });
    var k = Number(key); return r.qs.map(function (q, i) { return q.st === k ? i : -1; }).filter(function (i) { return i >= 0; });
  }
  function spLoad(store, r, pid) {
    var sp = store.get(spKey(r.pin, pid)) || { s: 0, c: 0, st: 0, t0: 0, cur: r.mode === 'station' ? null : 'a', P: {} };
    if (!sp.P) sp.P = {};
    return sp;
  }
  function pg(sp, key) { return sp.P[key] || (sp.P[key] = { i: 0, qs: 0, f: [], done: false, s: 0, c: 0 }); }
  function stationList(r, sp) {
    return (r.stages || []).map(function (x, k) {
      var L = listFor(r, String(k)), P = (sp && sp.P[String(k)]) || null;
      return { k: k, n: x.n, ic: x.ic, th: x.th, d: x.d, total: L.length, i: P ? P.i : 0, done: !!(P && P.done), s: P ? P.s : 0, c: P ? P.c : 0 };
    }).filter(function (x) { return x.total > 0; });
  }
  function selfRank(store, r, pid) {
    var sps = store.getAll(r.order.map(function (x) { return spKey(r.pin, x); })), me = sps[spKey(r.pin, pid)] || { s: 0 }, rank = 1;
    r.order.forEach(function (x) { var o2 = sps[spKey(r.pin, x)]; if (x !== pid && o2 && o2.s > me.s) rank++; });
    return { rank: rank, players: r.order.length };
  }
  function sStart(store, o) {
    var r = getRoom(store, o.pin), pid = String(o.pid || '');
    if (!r.players[pid]) throw err('ไม่พบผู้เล่น กรุณาเข้าห้องใหม่');
    if (r.mode !== 'station') throw err('ห้องนี้ไม่ใช่โหมดฐาน');
    var k = String(Math.floor(Number(o.st))), sp = spLoad(store, r, pid);
    if (!listFor(r, k).length) throw err('ไม่พบฐานนี้');
    if (sp.cur != null && sp.cur !== k) {
      var curP = sp.P[sp.cur];
      if (curP && !curP.done && curP.i > 0) throw err('ทำฐานเดิมให้เสร็จก่อนนะ');
      if (!r.rotate && sp.P[sp.cur] && sp.P[sp.cur].done) throw err('คุณครูกำหนดให้ทำฐานเดียว');
    }
    sp.cur = k; store.put(spKey(r.pin, pid), sp);
    return { ok: true, st: Number(k) };
  }
  function doneInfo(store, r, pid, sp) {
    var rk = selfRank(store, r, pid), key = sp.cur, P = sp.P[key] || { f: [], s: 0, c: 0 };
    return { done: true, score: sp.s, correct: sp.c, total: listFor(r, key).length, rank: rk.rank, players: rk.players, f: P.f,
      stationScore: P.s, stationCorrect: P.c, station: key === 'a' ? null : stageInfo(r, listFor(r, key)[0]),
      stations: r.mode === 'station' ? stationList(r, sp) : null, rotate: !!r.rotate,
      stq: listFor(r, key).map(function (i) { return r.qs[i].st; }), stages: r.stages || [] };
  }
  function sQuestion(store, o) {
    var r = getRoom(store, o.pin), pid = String(o.pid || '');
    if (!r.players[pid]) throw err('ไม่พบผู้เล่น กรุณาเข้าห้องใหม่');
    if (r.phase === 'end') return { ended: true };
    if (r.mode !== 'self' && r.mode !== 'station') throw err('ห้องนี้เป็นโหมดเล่นสด');
    var k = spKey(r.pin, pid), sp = spLoad(store, r, pid), now = store.now();
    if (sp.cur == null) return { pick: true, stations: stationList(r, sp), score: sp.s };
    var L = listFor(r, sp.cur), P = pg(sp, sp.cur);
    if (P.done || P.i >= L.length) return doneInfo(store, r, pid, sp);
    var gi = L[P.i];
    if (o.peek && !P.qs) return { peek: true, idx: gi, pos: P.i, n: L.length, total: L.length, stage: stageInfo(r, gi), theme: themeOf(r, gi), score: sp.s };
    if (!P.qs) { P.qs = now; if (!sp.t0) sp.t0 = now; store.put(k, sp); }
    var q = r.qs[gi];
    return { idx: gi, pos: P.i, n: L.length, total: L.length, q: phoneQ(q), left: Math.max(0, q.t * 1000 - (now - P.qs)), stage: stageInfo(r, gi), theme: themeOf(r, gi), score: sp.s };
  }
  function sAnswer(store, o) {
    return store.lock(function () {
      var r = getRoom(store, o.pin), pid = String(o.pid || ''), p = r.players[pid];
      if (!p) throw err('ไม่พบผู้เล่น กรุณาเข้าห้องใหม่');
      if (r.phase === 'end') return { ended: true };
      var k = spKey(r.pin, pid), sp = spLoad(store, r, pid), now = store.now();
      if (sp.cur == null) return { stale: true };
      var L = listFor(r, sp.cur), P = pg(sp, sp.cur);
      if (P.done || Number(o.idx) !== L[P.i] || !P.qs) return { stale: true };
      var gi = L[P.i], q = r.qs[gi], ms = now - P.qs, c = o.choice, a = null;
      if (c != null && ms <= q.t * 1000 + 2500) {
        if (q.type === 'fill' && Array.isArray(c) && c.length === q.k.length) a = { c: c.map(function (x) { return clip(x, 60); }), ms: ms };
        else if (q.type === 'match' && Array.isArray(c) && c.length === q.p.length) a = { c: c.map(Number), ms: ms };
        else if (q.type === 'mc' && Number(c) >= 0 && Number(c) < q.c.length) a = { c: Number(c), ms: ms };
      }
      var gr = grade(q, a), g = 0;
      if (gr.ok) sp.st = (sp.st || 0) + 1; else sp.st = 0;
      if (gr.frac > 0) g = Math.round((BASE + SPEED * Math.max(0, 1 - ms / (q.t * 1000))) * gr.frac) + (gr.ok && sp.st >= 3 ? STREAK : 0);
      if (gr.ok) { sp.c++; P.c++; }
      sp.s += g; P.s += g; P.f.push(Math.round(gr.frac * 1000) / 1000);
      var mc = q.type === 'mc', nIt = gr.items ? gr.items.length : 0, cnt = gr.items ? gr.items.filter(Boolean).length : 0;
      var txt = !a ? '(ไม่ได้ตอบ)' : mc ? q.c[a.c] || '' : q.type === 'fill' ? a.c.join(' ')
        : q.p.map(function (x, i) { return x.l + '→' + (q.p[q.perm[a.c[i]]] || {}).r; }).join(' | ');
      var sg = q.st >= 0 && r.stages && r.stages[q.st] ? r.stages[q.st].n : '';
      store.append('answers', [[new Date(now), r.pin, r.title, gi + 1, q.q, p.n, txt, gr.ok ? 'ถูก' : !mc && cnt ? 'ถูกบางส่วน ' + cnt + '/' + nIt : 'ผิด',
        a ? Math.round(ms / 100) / 10 : '', g, sp.s, p.f || '', sg]]);
      var res = resultOf(q, { ok: gr.ok, g: g, ch: a ? a.c : -1, frac: gr.frac, items: gr.items });
      P.i++; P.qs = 0; if (P.i >= L.length) P.done = true;
      store.put(k, sp);
      var rk = selfRank(store, r, pid);
      return { result: res, score: sp.s, correct: sp.c, streak: sp.st, idx: gi, pos: P.i - 1, n: L.length, total: L.length, done: P.done, rank: rk.rank, players: rk.players };
    });
  }

  // อีโมจิในห้องรอ (ไม่ใช้ lock — เสียบางอันได้ไม่เป็นไร)
  function react(store, o) {
    var r = getRoom(store, o.pin), p = r.players[String(o.pid || '')], e = Number(o.e);
    if (!p || r.phase !== 'lobby' || !(e >= 0 && e < EMOJI.length)) return { ok: false };
    var now = store.now(), list = (store.get(rxKey(r.pin)) || []).filter(function (x) { return x.t > now - 6000; });
    list.push({ t: now, n: p.n, e: EMOJI[e], id: now + '_' + String(o.pid).slice(0, 4) });
    store.put(rxKey(r.pin), list.slice(-40));
    return { ok: true };
  }

  function playerPoll(store, o) {
    var r = getRoom(store, o.pin), pid = String(o.pid || ''), me = r.players[pid];
    if (!me) throw err('ไม่พบผู้เล่น กรุณาเข้าห้องใหม่');
    var cq = r.qs[r.idx], sg = cq && r.stages && cq.st >= 0 ? r.stages[cq.st] : null;
    var out = { phase: r.phase, idx: r.idx, total: r.qs.length, ver: r.ver, title: r.title, theme: r.phase === 'lobby' || r.phase === 'end' ? r.theme || '' : themeOf(r, r.idx),
      stage: sg ? { n: sg.n, ic: sg.ic, th: sg.th, no: cq.st + 1 } : null, name: me.n, score: me.s, players: r.order.length };
    out.mode = r.mode || 'live';
    if (r.phase === 'self') {
      var sp0 = spLoad(store, r, pid), A0 = sp0.P.a || {};
      out.me = { i: A0.i || 0, s: sp0.s, c: sp0.c, done: !!A0.done, cur: sp0.cur };
      if (r.mode === 'station') { out.stations = stationList(r, sp0); out.rotate = !!r.rotate; }
      out.score = sp0.s; out.theme = r.theme || ''; return out;
    }
    if (r.phase === 'question') {
      var q = r.qs[r.idx];
      out.q = phoneQ(q);
      out.left = Math.max(0, r.qEnd - store.now());
      out.answered = !!store.get(ansKey(r.pin, r.idx, pid));
    } else if (r.phase !== 'lobby') {
      var rk = ranking(r), pos = rk.indexOf(pid);
      out.rank = pos + 1; out.correct = me.c; out.streak = me.st || 0;
      if (pos > 0) { var ahead = r.players[rk[pos - 1]]; out.behind = { name: ahead.n, by: ahead.s - me.s }; }
      if (r.last && r.idx >= 0) {
        var q2 = r.qs[r.idx], res = r.last.res[pid] || { ch: -1, ok: false, g: 0 };
        out.result = resultOf(q2, res);
      }
    }
    return out;
  }

  return { createRoom: createRoom, next: next, reveal: reveal, showBoard: showBoard, end: end, kick: kick,
    hostPoll: hostPoll, join: join, answer: answer, sQuestion: sQuestion, sAnswer: sAnswer, sStart: sStart, react: react, EMOJI: EMOJI, playerPoll: playerPoll, cleanQuestions: cleanQuestions };
})();
if (typeof module !== 'undefined') module.exports = CQ;
