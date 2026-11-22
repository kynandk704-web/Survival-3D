/* map.js — Rimba Nusantara: peta hutan penjelajah + satwa buruan
   API: ForestMap.generate(onProgress, onDone) lalu ForestMap.start(canvasElement) */
(function () {
  var T = 24, N = 100, W = T * N, CELL = 120, TS = 2, rs = null;
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function R() { return rs ? rs() : Math.random(); }
  var G, F, terrain, trees = [], tb = {}, animals = [];
  var SPAWN = { x: 420, y: 480 };

  var D = {
    rusa:    { e: "🦌", name: "Rusa",       hp: 2, sp: 95,  fr: 180, pts: 3,  r: 11, n: 22 },
    kancil:  { e: "🐇", name: "Kancil",     hp: 1, sp: 130, fr: 200, pts: 5,  r: 8,  n: 18 },
    babi:    { e: "🐗", name: "Babi hutan", hp: 3, sp: 80,  fr: 0,   pts: 4,  r: 11, n: 18, aggr: 1 },
    ayam:    { e: "🐓", name: "Ayam hutan", hp: 1, sp: 85,  fr: 150, pts: 1,  r: 8,  n: 28 },
    monyet:  { e: "🐒", name: "Monyet",     hp: 1, sp: 140, fr: 220, pts: 4,  r: 9,  n: 16 },
    merak:   { e: "🦚", name: "Merak",      hp: 1, sp: 100, fr: 170, pts: 6,  r: 10, n: 10 },
    biawak:  { e: "🦎", name: "Biawak",     hp: 2, sp: 55,  fr: 0,   pts: 3,  r: 9,  n: 10, aggr: 1, dmg: 7 },
    ular:    { e: "🐍", name: "Ular",       hp: 1, sp: 0,   fr: 0,   pts: 4,  r: 8,  n: 12, ambush: 1 },
    banteng: { e: "🐂", name: "Banteng",    hp: 4, sp: 90,  fr: 0,   pts: 8,  r: 14, n: 8,  aggr: 1 },
    gajah:   { e: "🐘", name: "Gajah",      hp: 8, sp: 80,  fr: 0,   pts: 12, r: 18, n: 3,  aggr: 1, dmg: 20 },
    buaya:   { e: "🐊", name: "Buaya",      hp: 5, sp: 150, fr: 0,   pts: 12, r: 13, n: 5,  croc: 1 },
    harimau: { e: "🐅", name: "Harimau",    hp: 5, sp: 125, fr: 0,   pts: 15, r: 13, n: 4,  tiger: 1 }
  };

  function rnd(a, b) { return a + R() * (b - a); }
  function mkNoise() {
    var g = [], i;
    for (i = 0; i < 289; i++) g.push(R());
    function sm(t) { return t * t * (3 - 2 * t); }
    return function (x, y) {
      x = Math.min(x, .9999) * 16; y = Math.min(y, .9999) * 16;
      var a = x | 0, b = y | 0, fx = sm(x - a), fy = sm(y - b);
      var p = g[b * 17 + a], q = g[b * 17 + a + 1], r = g[(b + 1) * 17 + a], s = g[(b + 1) * 17 + a + 1];
      return (p * (1 - fx) + q * fx) * (1 - fy) + (r * (1 - fx) + s * fx) * fy;
    };
  }
  var n1, n2;

  function water(x, y) {
    var i = (x / T) | 0, j = (y / T) | 0;
    return x < 0 || y < 0 || i >= N || j >= N || G[j * N + i] === 1;
  }
  function flood(x, y) { var i = (x / T) | 0, j = (y / T) | 0; return i >= 0 && j >= 0 && i < N && j < N && F[j * N + i] === 1; }
  function pblock(x, y, r) { return hitTree(x, y, r) || x < r || y < r || x > W - r || y > W - r; }
  function hitTree(x, y, r) {
    var cx = (x / CELL) | 0, cy = (y / CELL) | 0, i, j, k, l, t, dx, dy, rr;
    for (i = cx - 1; i <= cx + 1; i++) for (j = cy - 1; j <= cy + 1; j++) {
      l = tb[i + "," + j];
      if (l) for (k = 0; k < l.length; k++) {
        t = l[k]; dx = x - t.x; dy = y - t.y; rr = 6 + r;
        if (dx * dx + dy * dy < rr * rr) return true;
      }
    }
    return false;
  }
  function blocked(x, y, r) {
    return water(x, y) || water(x + r, y) || water(x - r, y) || water(x, y + r) || water(x, y - r) || hitTree(x, y, r);
  }

  function newAnimal(type, far) {
    var d = D[type], x, y, tries = 0;
    do {
      x = rnd(60, W - 60); y = rnd(60, W - 60); tries++;
    } while ((blocked(x, y, d.r) || (far && Math.hypot(x - far.x, y - far.y) < 700) || (d.croc && !(water(x + 34, y) || water(x - 34, y) || water(x, y + 34) || water(x, y - 34)))) && tries < 700);
    return { type: type, d: d, x: x, y: y, hx: x, hy: y, hp: d.hp, vx: 0, vy: 0, t: 0, angry: false, face: 1 };
  }

  /* ---------- pembuatan peta (bertahap supaya loading screen bisa menampilkan progres) ---------- */
  function generate(onProgress, onDone) {
    if (window.ForestMP && !ForestMap.seed) { onProgress(0, "Menghubungkan ke server…"); return ForestMP.ready(function (sd) { ForestMap.seed = sd; generate(onProgress, onDone); }); }
    rs = ForestMap.seed ? mulberry(ForestMap.seed) : null;
    G = new Uint8Array(N * N); trees = []; tb = {}; animals = [];
    var steps = [
      ["Membentuk daratan dan rawa…", function () {
        n1 = mkNoise(); n2 = mkNoise();
        for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) {
          var x = i * T, y = j * T;
          if (n1(i / N, j / N) < .2 && Math.hypot(x - SPAWN.x, y - SPAWN.y) > 300) G[j * N + i] = 1;
        }
      }],
      ["Mengalirkan sungai…", function () {
        var off = rnd(0, 6);
        for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) {
          var x = i * T, y = j * T, cy = W * .55 + Math.sin(x / 320 + off) * 280 + Math.sin(x / 90) * 30;
          if (Math.abs(y - cy) < 34 && !(x > 1050 && x < 1150 && Math.abs(y - cy) < 40 && false)) G[j * N + i] = 1;
        }
        // jembatan alami (batu pijakan) agar sungai bisa diseberangi
        for (var b = 0; b < 3; b++) {
          var bx = ((rnd(300, W - 300) / T) | 0);
          for (var jj = 0; jj < N; jj++) {
            var yy = jj * T, c = W * .55 + Math.sin(bx * T / 320 + 0) * 280;
            if (Math.abs(yy - (W * .55 + Math.sin(bx * T / 320 + off) * 280 + Math.sin(bx * T / 90) * 30)) < 40) G[jj * N + bx] = 0, G[jj * N + bx + 1] = 0;
          }
        }
      }],
      ["Melukis tanah dan rerumputan…", function () {
        terrain = document.createElement("canvas"); terrain.width = terrain.height = W * TS;
        var g = terrain.getContext("2d"), i, j, x, y, v, k; g.scale(TS, TS);
        for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
          v = n2(i / N, j / N);
          if (G[j * N + i] === 1) g.fillStyle = "hsl(205," + (45 + v * 15) + "%," + (26 + v * 10) + "%)";
          else {
            var shore = water(i * T - T, j * T) || water(i * T + T, j * T) || water(i * T, j * T - T) || water(i * T, j * T + T);
            g.fillStyle = shore ? "hsl(42,35%," + (34 + v * 8) + "%)" : "hsl(" + (105 + v * 22) + ",38%," + (20 + v * 12) + "%)";
          }
          g.fillRect(i * T, j * T, T + 1, T + 1);
        }
        for (k = 0; k < 1400; k++) {
          x = rnd(0, W); y = rnd(0, W); if (water(x, y)) continue;
          var rr = rnd(30, 90), gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, R() < .5 ? "rgba(30,70,25,.22)" : "rgba(110,150,60,.16)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
        }
        for (k = 0; k < 42000; k++) {
          x = rnd(0, W); y = rnd(0, W);
          if (water(x, y)) continue;
          var q = R(); g.fillStyle = q < .4 ? "rgba(20,60,20,.35)" : q < .8 ? "rgba(120,170,70,.25)" : q < .9 ? "rgba(70,50,30,.3)" : "rgba(210,220,120,.18)";
          g.fillRect(x, y, 1.3, rnd(3, 8));
        }
        F = new Uint8Array(N * N); // zona rawan banjir: 3 petak dari air
        for (j = 0; j < N; j++) for (i = 0; i < N; i++) if (G[j * N + i] === 1)
          for (var dj = -3; dj <= 3; dj++) for (var di = -3; di <= 3; di++) { var ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < N && jj < N && G[jj * N + ii] === 0) F[jj * N + ii] = 1; }
      }],
      ["Menanam pepohonan rimba…", function () {
        var tries = 0;
        while (trees.length < 950 && tries++ < 9000) {
          var x = rnd(30, W - 30), y = rnd(30, W - 30);
          if (n2(x / W, y / W) + R() * .3 < .5) continue;
          if (blocked(x, y, 12) || Math.hypot(x - SPAWN.x, y - SPAWN.y) < 110) continue;
          var t = { x: x, y: y, s: rnd(.8, 1.4), c: (R() * 3) | 0 };
          trees.push(t);
          var key = ((x / CELL) | 0) + "," + ((y / CELL) | 0);
          (tb[key] = tb[key] || []).push(t);
        }
      }],
      ["Melepas satwa liar…", function () {
        for (var k in D) for (var i = 0; i < D[k].n; i++) animals.push(newAnimal(k, SPAWN));
      }]
    ];
    var i = 0;
    (function run() {
      onProgress(i / steps.length, steps[i][0]);
      setTimeout(function () {
        steps[i][1](); i++;
        if (i < steps.length) run();
        else { rs = null; onProgress(1, "Rimba siap dijelajahi!"); onDone(); }
      }, 350);
    })();
  }

  /* ---------- permainan ---------- */
  function start(cv) {
    var ctx = cv.getContext("2d"), vw, vh, dpr;
    var TOUCH = "ontouchstart" in window || navigator.maxTouchPoints > 0, camX = 0, camY = 0;
    var P, E, shx = 0, spears, floats, kills, score, keys = {}, stick = null, mouseDown = false, last = performance.now();
    var mini = document.createElement("canvas"); mini.width = mini.height = 130; var lc = document.createElement("canvas"), lg = lc.getContext("2d");
    mini.getContext("2d").drawImage(terrain, 0, 0, W * TS, W * TS, 0, 0, 130, 130);

    function reset() {
      P = { x: SPAWN.x, y: SPAWN.y, hp: 100, a: 0, cd: 0, st: 100, hu: 85, th: 90, bleed: 0, meat: 0, eat: 0, walk: 0, face: 1, still: 0, z: 0, vz: 0, down: 0, dm: 1, hurt: 0, kx: 0, ky: 0, pois: 0, wet: 0, lx: SPAWN.x, ly: SPAWN.y, sw: false, wasSw: false };
      E = { tod: E ? E.tod : .1, rain: 0, raining: false, rainT: rnd(40, 80), dark: 0, foot: [], ft: 0, msg: "", mt: 0, dis: null, disT: 35, qk: 0, sto: 0, fl: 0, rocks: [], bolts: [], strikes: [], scars: [], flash: 0, rt: 0, lt: 0, drops: [], rip: [] };
      spears = []; floats = []; kills = {}; score = 0;
    }
    reset();
    /* ---------- multiplayer: pemain lain, tombak mereka, label nama & balon chat ---------- */
    var remote = [], rspears = [], myName = "", myBub = { s: "", t: 0 };
    var net = window.ForestMap.net = {
      emit: null,
      get: function () { return { x: P.x, y: P.y, a: P.a, walk: P.walk, face: P.face, hp: P.hp, z: P.z, down: P.down, dm: P.dm, bleed: P.bleed, hurt: P.hurt, wet: P.wet, st: P.st, sw: P.sw }; },
      setName: function (n) { myName = n; },
      sync: function (t) { E.tod = t; },
      find: function (id) { for (var i = 0; i < remote.length; i++) if (remote[i].id === id) return remote[i]; },
      upsert: function (id, name, s) {
        var r = net.find(id);
        if (!r) { r = { id: id, name: name, p: { x: s.x, y: s.y, walk: 0 }, tx: s.x, ty: s.y, say: { s: "", t: 0 } }; remote.push(r); }
        r.name = name || r.name; r.tx = s.x; r.ty = s.y;
        for (var k in s) if (k !== "x" && k !== "y" && k !== "walk") r.p[k] = s[k];
      },
      remove: function (id) { remote = remote.filter(function (r) { return r.id !== id; }); },
      say: function (id, text) { var b = id == null ? myBub : (net.find(id) || {}).say; if (b) { b.s = text; b.t = 7; } },
      spear: function (id, d) { rspears.push({ x: d.x, y: d.y, a: d.a, d: 0 }); }
    };
    function remoteStep(dt) {
      var i, r, k = Math.min(1, dt * 10);
      for (i = 0; i < remote.length; i++) {
        r = remote[i]; var dd = Math.hypot(r.tx - r.p.x, r.ty - r.p.y);
        r.p.x += (r.tx - r.p.x) * k; r.p.y += (r.ty - r.p.y) * k; r.p.walk = dd > 2 ? r.p.walk + dt * 9 : r.p.walk * .8; r.say.t -= dt;
      }
      myBub.t -= dt;
      for (i = rspears.length - 1; i >= 0; i--) { var q = rspears[i], st = 440 * dt; q.x += Math.cos(q.a) * st; q.y += Math.sin(q.a) * st; q.d += st; if (q.d > 260 || hitTree(q.x, q.y, 2)) rspears.splice(i, 1); }
    }
    function drawRemote(r) { var keep = P; P = r.p; drawPlayer(); P = keep; }
    function tag(x, y, name, say, col) {
      ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.font = "bold 11px system-ui,sans-serif";
      if (name) { var w = ctx.measureText(name).width + 10; ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(x - w / 2, y - 52, w, 14); ctx.fillStyle = col; ctx.fillText(name, x, y - 41); }
      if (say.t > 0) { var t = say.s.length > 36 ? say.s.slice(0, 35) + "…" : say.s; ctx.font = "12px system-ui,sans-serif"; var tw = ctx.measureText(t).width + 14; ctx.fillStyle = "rgba(255,255,255,.93)"; ctx.fillRect(x - tw / 2, y - 76, tw, 20); ctx.fillStyle = "#222"; ctx.fillText(t, x, y - 62); }
      ctx.restore();
    }
    function size() {
      dpr = Math.min(devicePixelRatio || 1, TOUCH ? 2 : 3); vw = innerWidth; vh = innerHeight;
      cv.width = vw * dpr; cv.height = vh * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; lc.width = Math.ceil(vw / 2); lc.height = Math.ceil(vh / 2);
    }
    addEventListener("resize", size); size();

    function throwSpear(a) {
      if (P.hp <= 0 || P.cd > 0 || P.down > 0) return;
      if (P.sw) { E.msg = "Tidak bisa melempar tombak saat berenang."; E.mt = 1.5; return; }
      P.cd = .45; spears.push({ x: P.x, y: P.y, a: a, d: 0 }); if (net.emit) net.emit("spear", { x: P.x, y: P.y, a: a });
    }
    function jump() { if (P.hp > 0 && !P.sw && P.z === 0 && P.down <= 0 && P.st > 8) { P.vz = 230; P.st -= 10; } }
    function hurtP(dmg, ax, ay, down) {
      P.hp -= dmg; P.bleed = 1; P.hurt = .5; var l = Math.hypot(ax, ay) || 1; P.kx = ax / l * 170; P.ky = ay / l * 170;
      if (down) { P.down = P.dm = down; } E.msg = "Kamu terluka!"; E.mt = 2;
    }
    function mix(h, k) {
      var n = parseInt(h.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; k *= .4;
      return "rgb(" + ((r * (1 - k) + 20 * k) | 0) + "," + ((g * (1 - k) + 40 * k) | 0) + "," + ((b * (1 - k) + 60 * k) | 0) + ")";
    }
    function mkControls() {
      var css = document.createElement("style");
      css.textContent = ".fm-b{position:fixed;z-index:5;border-radius:50%;border:3px solid rgba(255,255,255,.85);color:#fff;font:700 12px system-ui,sans-serif;white-space:pre-line;display:flex;align-items:center;justify-content:center;text-align:center;touch-action:none;user-select:none;-webkit-user-select:none;opacity:.9}.fm-b:active{filter:brightness(1.3);transform:scale(.94)}#fm-js{position:fixed;z-index:5;left:calc(36px + env(safe-area-inset-left,0px));bottom:calc(28px + env(safe-area-inset-bottom,0px));width:150px;height:150px;border-radius:50%;border:3px solid rgba(255,255,255,.7);background:rgba(255,255,255,.12);touch-action:none}#fm-kn{position:absolute;left:50%;top:50%;width:62px;height:62px;margin:-31px 0 0 -31px;border-radius:50%;background:rgba(235,235,235,.85)}";
      document.head.appendChild(css);
      var js = document.createElement("div"), kn = document.createElement("div"); js.id = "fm-js"; kn.id = "fm-kn"; js.appendChild(kn); document.body.appendChild(js);
      function mv2(e) {
        var r = js.getBoundingClientRect(), dx = e.clientX - (r.left + 75), dy = e.clientY - (r.top + 75), l = Math.hypot(dx, dy) || 1, m = Math.min(l, 55);
        stick.dx = dx / l * m / 55; stick.dy = dy / l * m / 55; kn.style.transform = "translate(" + stick.dx * 55 + "px," + stick.dy * 55 + "px)";
      }
      js.addEventListener("pointerdown", function (e) { js.setPointerCapture(e.pointerId); stick = { id: e.pointerId, dx: 0, dy: 0 }; mv2(e); });
      js.addEventListener("pointermove", function (e) { if (stick && stick.id === e.pointerId) mv2(e); });
      function end(e) { if (stick && stick.id === e.pointerId) { stick = null; kn.style.transform = ""; } }
      js.addEventListener("pointerup", end); js.addEventListener("pointercancel", end);
      function btn(label, bg, right, bottom, size, down, up) {
        var b = document.createElement("div"); b.className = "fm-b"; b.textContent = label;
        b.style.cssText = "background:" + bg + ";width:" + size + "px;height:" + size + "px;right:calc(" + right + "px + env(safe-area-inset-right,0px));bottom:calc(" + bottom + "px + env(safe-area-inset-bottom,0px))";
        b.addEventListener("pointerdown", function (e) { e.preventDefault(); b.setPointerCapture(e.pointerId); down(); });
        if (up) { b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); }
        document.body.appendChild(b);
      }
      btn("LARI", "rgba(190,60,45,.92)", 112, 40, 74, function () { keys.shift = true; }, function () { keys.shift = false; });
      btn("LOMPAT", "rgba(30,180,90,.94)", 24, 58, 80, jump);
      btn("TOMBAK", "rgba(200,130,30,.94)", 24, 150, 60, function () { throwSpear(P.a); });
      btn("MINUM\nMAKAN", "rgba(50,120,200,.94)", 112, 128, 60, function () { keys.e = true; }, function () { keys.e = false; });
    }
    if (TOUCH) mkControls();
    addEventListener("keydown", function (e) {
      if (/INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || "")) return;
      keys[e.key.toLowerCase()] = true;
      if (e.key === " ") { e.preventDefault(); jump(); }
      if (e.key.toLowerCase() === "f") throwSpear(P.a);
      if (e.key.toLowerCase() === "r" && P.hp <= 0) reset();
    });
    addEventListener("keyup", function (e) { keys[e.key.toLowerCase()] = false; });
    cv.addEventListener("pointerdown", function (e) {
      if (P.hp <= 0) { reset(); return; }
      throwSpear(Math.atan2(e.clientY + camY - P.y, e.clientX + camX - P.x));
    });
    cv.addEventListener("pointermove", function (e) {
      if (stick && stick.id === e.pointerId) {
        var dx = e.clientX - stick.x, dy = e.clientY - stick.y, l = Math.hypot(dx, dy) || 1, m = Math.min(l, 50);
        stick.dx = dx / l * m / 50; stick.dy = dy / l * m / 50;
      }
    });
    function up(e) { if (stick && stick.id === e.pointerId) stick = null; }
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);

    function update(dt) {
      var i, a, d, mx = 0, my = 0;
      if (P.hp <= 0) return;
      if (keys.a || keys.arrowleft) mx -= 1; if (keys.d || keys.arrowright) mx += 1;
      if (keys.w || keys.arrowup) my -= 1; if (keys.s || keys.arrowdown) my += 1;
      if (stick) { mx = stick.dx; my = stick.dy; }
      var l = Math.hypot(mx, my), mv = l > .05, sprint = mv && (keys.shift || (stick && l > .95)) && P.st > 5;
      // waktu, cuaca
      E.tod = (E.tod + dt / 240) % 1; var t0 = E.tod;
      E.dark = t0 < .6 ? 0 : t0 < .7 ? (t0 - .6) / .1 : t0 < .9 ? 1 : 1 - (t0 - .9) / .1;
      if (E.dark > .5 && !E.nt) { E.nt = 1; E.msg = "Malam tiba. Hati-hati, harimau lebih berani!"; E.mt = 5; }
      else if (E.dark < .2 && E.nt) { E.nt = 0; E.msg = "Fajar menyingsing."; E.mt = 4; }
      E.rainT -= dt;
      if (E.rainT <= 0) { E.raining = !E.raining; E.rainT = E.raining ? rnd(25, 50) : rnd(50, 110); E.msg = E.raining ? "Hujan turun, tanah menjadi licin." : "Hujan reda."; E.mt = 4; }
      E.rain += ((E.sto > .5 ? 1.25 : E.raining ? .75 : 0) - E.rain) * Math.min(1, dt * .5);
      // medan
      var shore = water(P.x + 28, P.y) || water(P.x - 28, P.y) || water(P.x, P.y + 28) || water(P.x, P.y - 28);
      var dense = n2(P.x / W, P.y / W) > .6, spd = sprint ? 165 : 105;
      P.sw = water(P.x, P.y) && P.z <= 0; if (P.sw) sprint = false;
      if (shore) spd *= .82;
      if (dense) spd *= .8;
      spd *= 1 - .18 * E.rain;
      if (P.hu < 20 || P.th < 20) spd *= .85;
      if (P.bleed) spd *= .75;
      if (P.st <= 5) spd *= .65;
      if (P.sw) spd = 62 * (1 - .3 * E.fl);
      if (P.sw && !P.wasSw) { E.msg = "Kamu berenang. Tenaga terkuras, jangan sampai habis!"; E.mt = 3.5; }
      P.wasSw = P.sw;
      // ---- bencana ----
      if (!E.dis) {
        E.disT -= dt;
        if (E.disT <= 0) {
          var tp = ["gempa", "badai", "banjir"][(R() * 3) | 0]; E.dis = { type: tp, on: false, t: 7 };
          E.msg = { gempa: "⚠ Tanah mulai bergetar… GEMPA akan terjadi!", badai: "⚠ Langit menghitam… BADAI PETIR mendekat!", banjir: "⚠ Suara air menderu… BANJIR BANDANG datang!" }[tp]; E.mt = 6;
        }
      } else {
        E.dis.t -= dt;
        if (E.dis.t <= 0) {
          if (!E.dis.on) { E.dis.on = true; E.dis.t = rnd(22, 30); }
          else { E.msg = "Bencana mereda. Tetap waspada."; E.mt = 4; E.dis = null; E.disT = rnd(70, 120); }
        }
      }
      var dn = E.dis && E.dis.on ? E.dis.type : "", wn = E.dis && !E.dis.on ? E.dis.type : "";
      E.qk += ((dn === "gempa" ? 1 : wn === "gempa" ? .2 : 0) - E.qk) * Math.min(1, dt * 3);
      E.sto += ((dn === "badai" ? 1 : wn === "badai" ? .3 : 0) - E.sto) * Math.min(1, dt * .8);
      E.fl += ((dn === "banjir" ? 1 : 0) - E.fl) * Math.min(1, dt * .4);
      var inFl = flood(P.x, P.y), blk = pblock;
      if (inFl) spd *= 1 - .45 * E.fl;
      if (P.down > 0) { P.down -= dt; mv = false; sprint = false; }
      P.hurt = Math.max(0, P.hurt - dt); E.flash = Math.max(0, E.flash - dt * 3);
      if (P.pois > 0) { P.pois -= dt; P.hp -= 1.2 * dt; }
      P.wet = Math.max(0, Math.min(1, P.wet + ((P.sw ? .8 : E.rain > .3 || (inFl && E.fl > .3) ? .14 : -.04) * dt)));
      E.rt -= dt;
      if (dn === "gempa" && E.rt <= 0) { E.rt = rnd(.3, .7); var ra = rnd(0, 6.28), rd = R() < .35 ? rnd(20, 90) : rnd(60, 300); E.rocks.push({ x: P.x + Math.cos(ra) * rd, y: P.y + Math.sin(ra) * rd, t: 1.1 }); }
      if (dn === "gempa" && P.z <= 0 && P.down <= 0 && R() < dt * (mv ? .22 : .06)) { P.down = P.dm = 1.2; P.st = Math.max(0, P.st - 10); E.msg = "Kamu terjatuh karena guncangan!"; E.mt = 2; }
      for (i = E.rocks.length - 1; i >= 0; i--) {
        var rk = E.rocks[i]; rk.t -= dt;
        if (rk.t <= 0) { E.scars.push({ x: rk.x, y: rk.y, t: 10, k: 1 }); if (P.z < 8 && Math.hypot(P.x - rk.x, P.y - rk.y) < 26) hurtP(24, P.x - rk.x, P.y - rk.y, .9); E.rocks.splice(i, 1); }
      }
      E.lt -= dt;
      if (dn === "badai" && E.lt <= 0) {
        E.lt = rnd(1.6, 3.8); var tx, ty, nt = null, nd = 280;
        if (R() < .5) trees.forEach(function (t) { var dd = Math.hypot(t.x - P.x, t.y - P.y); if (dd < nd) { nd = dd; nt = t; } });
        if (nt) { tx = nt.x; ty = nt.y; } else { var la = rnd(0, 6.28), ld = rnd(40, 280); tx = P.x + Math.cos(la) * ld; ty = P.y + Math.sin(la) * ld; }
        E.bolts.push({ x: tx, y: ty, t: 1 });
      }
      for (i = E.bolts.length - 1; i >= 0; i--) {
        var bo = E.bolts[i]; bo.t -= dt;
        if (bo.t <= 0) { E.flash = 1; E.strikes.push({ x: bo.x, y: bo.y, t: .25 }); E.scars.push({ x: bo.x, y: bo.y, t: 14, k: 0 }); if (Math.hypot(P.x - bo.x, P.y - bo.y) < 38) hurtP(30, P.x - bo.x, P.y - bo.y, 1.6); E.bolts.splice(i, 1); }
      }
      for (i = E.strikes.length - 1; i >= 0; i--) { E.strikes[i].t -= dt; if (E.strikes[i].t <= 0) E.strikes.splice(i, 1); }
      for (i = E.scars.length - 1; i >= 0; i--) { E.scars[i].t -= dt; if (E.scars[i].t <= 0) E.scars.splice(i, 1); }
      if (E.sto > .2 && P.z <= 0) { var wx = P.x + 14 * E.sto * dt; if (!pblock(wx, P.y, 8)) P.x = wx; }
      if (inFl && E.fl > .3 && P.z <= 0) {
        var pw = (P.st <= 0 ? 110 : 55) * E.fl, px2 = P.x + pw * dt, py2 = P.y + pw * .35 * dt;
        if (!pblock(px2, P.y, 8)) P.x = px2;
        if (!pblock(P.x, py2, 8)) P.y = py2;
        P.st = Math.max(0, P.st - 12 * E.fl * dt); if (P.st <= 0) P.hp -= 6 * E.fl * dt;
        E.msg = "Arus deras! Cari tanah tinggi!"; E.mt = .4;
      }
      if (mv) {
        if (l > 1) { mx /= l; my /= l; }
        P.a = Math.atan2(my, mx); P.face = mx >= 0 ? 1 : -1;
        var nx = P.x + mx * spd * dt + rnd(-1, 1) * E.qk * 30 * dt, ny = P.y + my * spd * dt + rnd(-1, 1) * E.qk * 30 * dt;
        if (!blk(nx, P.y, 8)) P.x = nx;
        if (!blk(P.x, ny, 8)) P.y = ny;
        P.walk += dt * (spd / 105) * (P.bleed ? 7 : 9); P.still = 0;
        E.ft -= dt;
        if (E.ft <= 0) { E.ft = sprint ? .18 : .3; if (P.sw) E.rip.push({ x: P.x, y: P.y, t: 1.2 }); else { E.foot.push({ x: P.x, y: P.y + 7, t: 8, k: E.foot.length % 2 }); if (E.foot.length > 50) E.foot.shift(); } }
      } else { P.still += dt; P.walk *= .8; }
      if (P.z > 0 || P.vz) {
        P.vz -= 640 * dt; P.z += P.vz * dt;
        if (P.z <= 0) { P.z = 0; P.vz = 0; if (hitTree(P.x, P.y, 8)) { P.x = P.lx; P.y = P.ly; P.st = Math.max(0, P.st - 15); E.msg = "Gagal mendarat! Kembali ke tepi."; E.mt = 2.5; } }
      } else if (!blocked(P.x, P.y, 8)) { P.lx = P.x; P.ly = P.y; }
      if (P.kx || P.ky) {
        var kx2 = P.x + P.kx * dt, ky2 = P.y + P.ky * dt;
        if (!pblock(kx2, P.y, 8)) P.x = kx2;
        if (!pblock(P.x, ky2, 8)) P.y = ky2;
        P.kx *= .88; P.ky *= .88; if (Math.abs(P.kx) + Math.abs(P.ky) < 5) P.kx = P.ky = 0;
      }
      // kebutuhan tubuh
      P.st = Math.max(0, Math.min(100, P.st + (P.sw ? (mv ? -9 : -3) : sprint ? -24 : mv ? 6 : 16) * dt * (P.hu < 20 ? .6 : 1)));
      if (P.sw && P.st <= 0) { P.hp -= 8 * dt; E.msg = "Tenagamu habis, kamu tenggelam! Segera ke tepi!"; E.mt = .4; }
      P.hu = Math.max(0, P.hu - dt * (sprint ? .55 : .3));
      P.th = Math.max(0, P.th - dt * (sprint ? .8 : .45) * (E.rain > .5 ? .6 : 1));
      if (P.hu <= 0 || P.th <= 0) P.hp -= 1.5 * dt;
      if (P.bleed) {
        P.hp -= 1.4 * dt;
        if (P.still > 5) { P.bleed = 0; E.msg = "Luka dibalut dengan kain. Pendarahan berhenti."; E.mt = 4; }
      } else if (P.still > 3 && P.hp < 100 && P.hu > 25 && P.th > 25) P.hp = Math.min(100, P.hp + 2 * dt);
      if (keys.e && !mv) {
        if (shore && (P.th < 95 || P.meat <= 0)) { P.th = Math.min(100, P.th + 35 * dt); E.msg = "Minum dari sungai…"; E.mt = .3; }
        else if (P.meat > 0) {
          P.eat += dt; E.msg = "Memanggang daging…"; E.mt = .3;
          if (P.eat >= 2.5) { P.eat = 0; P.meat--; P.hu = Math.min(100, P.hu + 30); E.msg = "Perut terasa lebih tenang."; E.mt = 3; }
        }
      } else P.eat = 0;
      E.mt -= dt;
      for (i = E.drops.length - 1; i >= 0; i--) {
        var dr2 = E.drops[i]; dr2.t -= dt;
        if (dr2.t <= 0) { E.drops.splice(i, 1); continue; }
        if (P.z < 6 && !P.sw && Math.hypot(P.x - dr2.x, P.y - dr2.y) < 22) { P.meat += dr2.m; floats.push({ x: dr2.x, y: dr2.y - 10, t: 1, s: "+" + dr2.m + " daging", c: "#ffd0b0" }); E.drops.splice(i, 1); }
      }
      for (i = E.rip.length - 1; i >= 0; i--) { E.rip[i].t -= dt; if (E.rip[i].t <= 0) E.rip.splice(i, 1); }
      for (i = E.foot.length - 1; i >= 0; i--) { E.foot[i].t -= dt; if (E.foot[i].t <= 0) E.foot.splice(i, 1); }
      P.cd -= dt;

      for (i = 0; i < animals.length; i++) {
        a = animals[i]; d = Math.hypot(P.x - a.x, P.y - a.y);
        if (a.d.ambush) { a.cd = (a.cd || 0) - dt; if (d < 55 && P.z < 8 && a.cd <= 0) { a.cd = 1.6; P.hp -= 6; P.pois = 8; E.msg = "Digigit ular berbisa!"; E.mt = 3; } continue; }
        if (a.d.croc) {
          var fl2 = E.dis && E.dis.on && E.dis.type === "banjir" ? 1 : 0, hd = Math.hypot(a.hx - a.x, a.hy - a.y), tg = d < 90 + 80 * fl2 && P.z < 8 && hd < 170;
          var ca = tg ? Math.atan2(P.y - a.y, P.x - a.x) : Math.atan2(a.hy - a.y, a.hx - a.x);
          if (tg || hd > 6) { var cs = tg ? a.d.sp : 50; a.x += Math.cos(ca) * cs * dt; a.y += Math.sin(ca) * cs * dt; a.face = Math.cos(ca) > 0 ? -1 : 1; }
          if (d < 28 && P.z < 8) { P.hp -= 20 * dt; P.bleed = 1; }
          continue;
        }
        var sp = 0, ang = a.t > 0 ? a.ang : 0;
        a.t -= dt;
        if (a.d.tiger && d < 240 + 110 * E.dark) { a.ang = Math.atan2(P.y - a.y, P.x - a.x); sp = a.d.sp; if (d < 22 && P.z < 8) { P.hp -= 14 * dt; P.bleed = 1; } }
        else if (a.angry) { a.ang = Math.atan2(P.y - a.y, P.x - a.x); sp = a.d.sp * 1.15; if (d < 13 + a.d.r && P.z < 8) { P.hp -= (a.d.dmg || 9) * dt; P.bleed = 1; } if (d > 380) a.angry = false; }
        else if (a.d.fr && d < a.d.fr) { a.ang = Math.atan2(a.y - P.y, a.x - P.x) + rnd(-.3, .3); sp = a.d.sp; }
        else {
          if (a.t <= 0) { a.t = rnd(1, 3); a.ang = rnd(0, 6.28); a.idle = R() < .4; }
          sp = a.idle ? 0 : a.d.sp * .35;
        }
        if (sp) {
          var ax = a.x + Math.cos(a.ang) * sp * dt, ay = a.y + Math.sin(a.ang) * sp * dt;
          if (!blocked(ax, ay, a.d.r * .7)) { a.x = ax; a.y = ay; a.face = Math.cos(a.ang) > 0 ? -1 : 1; }
          else { a.ang += 2 + R() * 2; a.t = .5; }
        }
      }

      for (i = spears.length - 1; i >= 0; i--) {
        var s = spears[i], step = 440 * dt, hit = false;
        s.x += Math.cos(s.a) * step; s.y += Math.sin(s.a) * step; s.d += step;
        if (s.d > 260 || hitTree(s.x, s.y, 2)) { spears.splice(i, 1); continue; }
        for (var k = 0; k < animals.length && !hit; k++) {
          a = animals[k];
          if (Math.hypot(s.x - a.x, s.y - a.y) < a.d.r + 5) {
            hit = true; a.hp--; if (a.d.aggr) a.angry = true;
            floats.push({ x: a.x, y: a.y - 14, t: .8, s: a.hp > 0 ? "−1" : "+" + a.d.pts, c: a.hp > 0 ? "#ffd3c0" : "#ffe27a" });
            if (a.hp <= 0) {
              kills[a.type] = (kills[a.type] || 0) + 1; score += a.d.pts; var mp = { rusa: 2, kancil: 1, babi: 2, ayam: 1, banteng: 3, harimau: 1, monyet: 1, merak: 2, biawak: 1, ular: 1, gajah: 5, buaya: 3 }[a.type]; E.drops.push({ x: a.x, y: a.y, m: mp, t: 90 }); floats.push({ x: a.x, y: a.y - 26, t: 1.2, s: "🍖 daging!", c: "#ffd0b0" });
              animals[k] = newAnimal(a.type, P);
            }
          }
        }
        if (hit) spears.splice(i, 1);
      }
      for (i = floats.length - 1; i >= 0; i--) { floats[i].t -= dt; floats[i].y -= 28 * dt; if (floats[i].t <= 0) floats.splice(i, 1); }
    }

    function drawTree(t) {
      var s = t.s, cols = [["#173d1c", "#2c6b30", "#4f9a48"], ["#1c4722", "#37803a", "#62ad52"], ["#15351f", "#2a5f3c", "#4c8f5e"]][t.c], sw = Math.sin(performance.now() / 900 + t.x) * 1.2 * (1 + E.rain + E.sto * 2);
      ctx.fillStyle = "rgba(0,0,0," + (.3 * (1 - E.dark)) + ")"; ctx.beginPath(); ctx.ellipse(t.x + shx * s, t.y + 2, (22 + Math.abs(shx)) * s, 8 * s, 0, 0, 7); ctx.fill();
      var tg = ctx.createLinearGradient(t.x - 5 * s, 0, t.x + 5 * s, 0); tg.addColorStop(0, "#5a3a1e"); tg.addColorStop(1, "#2e1b0c");
      ctx.fillStyle = tg; ctx.beginPath(); ctx.moveTo(t.x - 5 * s, t.y + 2); ctx.lineTo(t.x - 3 * s, t.y - 30 * s); ctx.lineTo(t.x + 3 * s, t.y - 30 * s); ctx.lineTo(t.x + 5 * s, t.y + 2); ctx.fill();
      [[0, -38, 25], [-9, -34, 15], [10, -37, 14], [-3, -50, 14]].forEach(function (b) {
        var bx = t.x + (b[0] + sw * (-b[1] / 40)) * s, by = t.y + b[1] * s, br = b[2] * s, gr = ctx.createRadialGradient(bx - br * .35, by - br * .4, br * .1, bx, by, br);
        gr.addColorStop(0, cols[2]); gr.addColorStop(.55, cols[1]); gr.addColorStop(1, cols[0]); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fill();
      });
    }
    function drawAnimal(a) {
      var r = a.d.r;
      ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(a.x, a.y + r * .6, r, r * .4, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(a.x, a.y); ctx.scale(a.face, 1);
      ctx.font = Math.round(r * 2.6) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(a.d.e, 0, -r * .3); ctx.restore();
      if (a.hp < a.d.hp) {
        ctx.fillStyle = "#400"; ctx.fillRect(a.x - 12, a.y - r * 2.2, 24, 3);
        ctx.fillStyle = "#e4503c"; ctx.fillRect(a.x - 12, a.y - r * 2.2, 24 * a.hp / a.d.hp, 3);
      }
      if (a.angry || (a.d.tiger && Math.hypot(P.x - a.x, P.y - a.y) < 240)) {
        ctx.font = "bold 14px sans-serif"; ctx.fillStyle = "#ff5a3c"; ctx.fillText("!", a.x, a.y - r * 2.6);
      }
    }
    function drawPlayer() {
      var now = performance.now(), sw = Math.sin(P.walk), c0 = Math.cos(P.a), s0 = Math.sin(P.a);
      var view = Math.abs(s0) > Math.abs(c0) * 1.1 ? (s0 > 0 ? "f" : "b") : "s";
      var bob = Math.abs(sw) * (P.bleed ? 1 : 1.8), br = Math.sin(now / (P.st < 25 ? 140 : 900)) * .5, lean = P.bleed ? 1.5 : 0;
      var sg = sw * (P.bleed ? .45 : .85);
      var qk = E.qk, sto = E.sto, armUp = qk * 1.1 + sto * 1.3, crouch = qk * .16 + sto * .08;
      lean += sto * 2 + qk; br += sto * 1.5 - qk * .5 + Math.sin(now / 40) * qk * .6;
      if (P.sw) { armUp += .5; lean += 2; }
      var shiv = P.wet > .5 && (E.dark > .4 || sto > .3) ? Math.sin(now / 35) * .7 : 0, fl = Math.sin(now / 90) * 1.5 * sto + sto * 2;
      var wt = P.wet, SK = mix("#c58b5b", wt), SKD = mix("#a8714a", wt), RED = mix("#b02a2a", wt), KAIN = mix("#5a2412", wt), HAIR = mix("#1a1008", wt), GOLD = mix("#e3b95a", wt), SHOE = mix("#3a2410", wt);
      function box(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }
      function limb(px, py, w, h, ang, col, tip) {
        ctx.save(); ctx.translate(px, py); ctx.rotate(ang); box(-w / 2, 0, w, h, col); if (tip) box(-w / 2, h - 3, w, 3, tip); ctx.restore();
      }
      function spear(hx, hy, la) {
        var c = Math.cos(la), s2 = Math.sin(la);
        ctx.strokeStyle = "#cfa86a"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.beginPath();
        ctx.moveTo(hx - c * 8, hy - s2 * 8); ctx.lineTo(hx + c * 24, hy + s2 * 24); ctx.stroke();
        ctx.fillStyle = "#cfd3d6"; ctx.beginPath(); ctx.arc(hx + c * 25, hy + s2 * 25, 2, 0, 7); ctx.fill();
      }
      ctx.fillStyle = "rgba(0,0,0," + (.3 - .2 * E.dark) + ")"; ctx.beginPath(); ctx.ellipse(P.x + shx * .4, P.y + 8, 11, 4, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(P.x + shiv, P.y - bob - P.z);
      ctx.translate(0, 9);
      if (P.down > 0) { var dr = Math.min(1, (P.dm - P.down) * 6, P.down * 6); ctx.rotate(P.face * 1.5 * Math.max(0, dr)); }
      ctx.scale(1, 1 - crouch); ctx.translate(0, -9);
      if (view === "s") {
        ctx.scale(P.face, 1);
        limb(0, -3, 5.5, 12, -sg, SKD, SHOE); limb(lean, -15, 4, 12, sg - armUp * .8, SKD);
        ctx.fillStyle = KAIN; ctx.beginPath(); ctx.moveTo(-4 + lean * .3, -7); ctx.lineTo(4 + lean * .3, -7); ctx.lineTo(4 + fl, 2); ctx.lineTo(-4 + fl * .6, 2); ctx.fill(); box(-4 + lean * .3, -2, 8, 1.5, GOLD);
        box(-3.5 + lean, -16, 7, 13, SK); box(-4 + lean * .5, -7.5, 8, 2.2, RED);
        limb(0, -3, 5.5, 12, sg, SK, SHOE);
        var ang = -sg - armUp, hx = lean - 12 * Math.sin(ang), hy = -15 + 12 * Math.cos(ang);
        limb(lean, -15, 4, 12, ang, SK);
        spear(hx, hy, P.face > 0 ? P.a : Math.PI - P.a);
        box(-5 + lean, -26 + br, 10, 10, SK); box(-5.5 + lean, -27 + br, 11, 3.5, HAIR); box(-5 + lean, -26 + br, 3.5, 9, HAIR);
        box(-5.5 + lean, -27.5 + br, 11, 3, RED); box(-8 + lean, -30 + br, 3.5, 5, RED);
        box(2 + lean, -22 + br, 1.8, 2.4, "#111"); box(2.5 + lean, -18.5 + br, 2.6, 1, "#6b2a1a");
      } else {
        var back = view === "b", lL = Math.max(0, sw) * 3, lR = Math.max(0, -sw) * 3;
        box(-6, -3, 6, 12 - lL, SK); box(-6, 6 - lL, 6, 3, SHOE);
        box(0, -3, 6, 12 - lR, SK); box(0, 6 - lR, 6, 3, SHOE);
        ctx.fillStyle = KAIN; ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(7, -7); ctx.lineTo(7 + fl, 2); ctx.lineTo(-7 + fl, 2); ctx.fill(); box(-7, -2, 14, 1.5, GOLD);
        box(-6, -16, 12, 13, SK); box(-7, -7.5, 14, 2.2, RED);
        if (!back) { ctx.fillStyle = RED; ctx.beginPath(); ctx.moveTo(-6, -16); ctx.lineTo(-2, -16); ctx.lineTo(6, -8); ctx.lineTo(6, -11); ctx.closePath(); ctx.fill(); }
        box(-10 - armUp * 2, -15 + sw * 2 - armUp * 4, 4, 12 - armUp * 3, SK); box(6 + armUp * 2, -15 - sw * 2 - armUp * 4, 4, 12 - armUp * 3, SK);
        spear(8 + armUp * 2, -3 - sw * 2 - armUp * 7, P.a);
        if (back) {
          box(-5, -26 + br, 10, 10, HAIR); box(-5.5, -27.5 + br, 11, 3.5, RED); box(-2, -31 + br, 4, 4, RED);
        } else {
          box(-5, -26 + br, 10, 10, SK); box(-5.5, -27 + br, 11, 3.5, HAIR); box(-5.5, -27.5 + br, 11, 3, RED);
          box(-3, -22 + br, 1.8, 2.4, "#111"); box(1.2, -22 + br, 1.8, 2.4, "#111");
          ctx.strokeStyle = "#6b2a1a"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, -19.8 + br, 2.6, .15 * Math.PI, .85 * Math.PI); ctx.stroke();
        }
      }
      if (P.sw) { ctx.fillStyle = "rgba(55,105,155,.8)"; ctx.fillRect(-14, -6, 28, 20); ctx.strokeStyle = "rgba(225,240,255,.85)"; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.ellipse(0, -6, 12 + Math.sin(now / 160) * 2, 3, 0, 0, 7); ctx.stroke(); }
      if (P.hurt > 0) box(-9, -32, 18, 42, "rgba(255,50,30," + .4 * P.hurt + ")");
      if (P.wet > .5) for (var dq = 0; dq < 2; dq++) box(-5 + dq * 8, -3 + ((now / 160 + dq * 3) % 8), 1.5, 2, "rgba(120,170,230,.85)");
      if (P.bleed) box(-3 + lean, -13, 3, 3, "#a01818");
      ctx.restore();
      if (E.fl > .3 && flood(P.x, P.y)) {
        ctx.fillStyle = "rgba(70,120,170,.55)"; ctx.fillRect(P.x - 14, P.y + 1, 28, 10);
        ctx.strokeStyle = "rgba(220,240,255,.7)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(P.x, P.y + 3, 14 + Math.sin(now / 150) * 2, 4, 0, 0, 7); ctx.stroke();
      }
    }

    function draw() {
      var cx = Math.max(0, Math.min(W - vw, P.x - vw / 2)), cy = Math.max(0, Math.min(W - vh, P.y - vh / 2)), i, a, list = [];
      ctx.fillStyle = "#0e0c08"; ctx.fillRect(0, 0, vw, vh);
      shx = (2 * Math.min(1, E.tod / .6) - 1) * 28;
      camX = cx; camY = cy;
      var tn = performance.now(), shk = E.qk * 5; ctx.save(); ctx.translate(rnd(-shk, shk), rnd(-shk, shk));
      ctx.drawImage(terrain, cx * TS, cy * TS, vw * TS, vh * TS, 0, 0, vw, vh);
      ctx.save(); ctx.translate(-cx, -cy);
      E.foot.forEach(function (f) { ctx.fillStyle = "rgba(30,20,10," + Math.min(.4, f.t / 8 * .4) + ")"; ctx.beginPath(); ctx.ellipse(f.x + (f.k ? 4 : -4), f.y, 3, 1.6, 0, 0, 7); ctx.fill(); });
      E.scars.forEach(function (sc2) {
        var al = Math.min(1, sc2.t / 4); ctx.fillStyle = sc2.k ? "rgba(40,30,20," + .5 * al + ")" : "rgba(10,8,6," + .6 * al + ")";
        ctx.beginPath(); ctx.ellipse(sc2.x, sc2.y, sc2.k ? 16 : 20, sc2.k ? 8 : 10, 0, 0, 7); ctx.fill();
        if (sc2.k) { ctx.fillStyle = "rgba(120,115,105," + al + ")"; ctx.fillRect(sc2.x - 5, sc2.y - 3, 6, 5); ctx.fillRect(sc2.x + 2, sc2.y, 5, 4); }
      });
      E.drops.forEach(function (d2) {
        var bb = Math.sin(tn / 300 + d2.x) * 1.5; ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(d2.x, d2.y + 6, 9, 3, 0, 0, 7); ctx.fill();
        if (d2.t > 10 || ((tn / 200) | 0) % 2) { ctx.font = "18px serif"; ctx.textAlign = "center"; ctx.fillText("🍖", d2.x, d2.y + bb); ctx.font = "bold 10px Georgia"; ctx.fillStyle = "#ffe9c0"; ctx.fillText("x" + d2.m, d2.x + 13, d2.y + 8); }
      });
      E.rip.forEach(function (r) { var k = 1 - r.t / 1.2; ctx.strokeStyle = "rgba(225,240,255," + .6 * (1 - k) + ")"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(r.x, r.y + 2, 6 + k * 18, 2 + k * 6, 0, 0, 7); ctx.stroke(); });
      if (E.fl > .02) {
        var i0 = Math.max(0, (cx / T) | 0), i1 = Math.min(N - 1, ((cx + vw) / T) | 0), j0 = Math.max(0, (cy / T) | 0), j1 = Math.min(N - 1, ((cy + vh) / T) | 0);
        for (var jj = j0; jj <= j1; jj++) for (var ii = i0; ii <= i1; ii++) if (F[jj * N + ii] === 1 || G[jj * N + ii] === 1) {
          ctx.fillStyle = "rgba(70,120,170," + .4 * E.fl + ")"; ctx.fillRect(ii * T, jj * T, T, T);
          if ((ii + jj) % 2 === 0) { ctx.strokeStyle = "rgba(220,240,255," + .3 * E.fl + ")"; ctx.beginPath(); var wv = Math.sin(tn / 300 + ii) * 4; ctx.moveTo(ii * T + 3 + wv, jj * T + 12); ctx.lineTo(ii * T + 15 + wv, jj * T + 12); ctx.stroke(); }
        }
      }
      E.rocks.forEach(function (r) { var k = Math.max(0, r.t) / 1.1; ctx.fillStyle = "rgba(0,0,0," + .35 * (1 - k) + ")"; ctx.beginPath(); ctx.ellipse(r.x, r.y, 22 * (1 - k) + 4, 10 * (1 - k) + 2, 0, 0, 7); ctx.fill(); ctx.strokeStyle = "rgba(255,80,40," + .6 * (1 - k) + ")"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(r.x, r.y, 26, 12, 0, 0, 7); ctx.stroke(); });
      E.bolts.forEach(function (b) { var p = .5 + .5 * Math.sin(tn * .02); ctx.strokeStyle = "rgba(255,240,120," + (.35 + .45 * p) + ")"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(b.x, b.y, 34, 15, 0, 0, 7); ctx.stroke(); });
      for (i = 0; i < trees.length; i++) { var t = trees[i]; if (t.x > cx - 60 && t.x < cx + vw + 60 && t.y > cy && t.y < cy + vh + 80) list.push({ y: t.y, f: drawTree, o: t }); }
      for (i = 0; i < animals.length; i++) { a = animals[i]; if (a.x > cx - 40 && a.x < cx + vw + 40 && a.y > cy - 40 && a.y < cy + vh + 40) list.push({ y: a.y, f: drawAnimal, o: a }); }
      list.push({ y: P.y, f: drawPlayer, o: null });
      remote.forEach(function (r) { if (r.p.hp > 0) list.push({ y: r.p.y, f: drawRemote, o: r }); });
      list.sort(function (p, q) { return p.y - q.y; });
      for (i = 0; i < list.length; i++) list[i].f(list[i].o);
      remote.forEach(function (r) { if (r.p.hp > 0) tag(r.p.x, r.p.y - (r.p.z || 0), r.name, r.say, "#9fe0ff"); });
      if (P.hp > 0) tag(P.x, P.y - P.z, myName, myBub, "#ffe27a");
      E.rocks.forEach(function (r) { var h = Math.max(0, r.t) * 300; ctx.fillStyle = "#7d776c"; ctx.beginPath(); ctx.moveTo(r.x - 12, r.y - h); ctx.lineTo(r.x - 4, r.y - h - 12); ctx.lineTo(r.x + 10, r.y - h - 8); ctx.lineTo(r.x + 13, r.y - h + 3); ctx.lineTo(r.x, r.y - h + 8); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#a39d90"; ctx.fillRect(r.x - 3, r.y - h - 8, 6, 4); });
      E.strikes.forEach(function (s3) { ctx.strokeStyle = "rgba(255,250,200," + Math.min(1, s3.t * 5) + ")"; ctx.lineWidth = 3; ctx.beginPath(); var yy = s3.y - 500, xx = s3.x + rnd(-30, 30); ctx.moveTo(xx, yy); while (yy < s3.y) { yy += 50; xx += rnd(-22, 22); ctx.lineTo(yy >= s3.y ? s3.x : xx, Math.min(yy, s3.y)); } ctx.stroke(); });
      ctx.strokeStyle = "#e8d9a8"; ctx.lineWidth = 2;
      spears.concat(rspears).forEach(function (s) { ctx.beginPath(); ctx.moveTo(s.x, s.y - 4); ctx.lineTo(s.x - Math.cos(s.a) * 16, s.y - 4 - Math.sin(s.a) * 16); ctx.stroke(); });
      ctx.font = "bold 15px Georgia"; ctx.textAlign = "center";
      floats.forEach(function (f) { ctx.globalAlpha = Math.min(1, f.t * 2); ctx.fillStyle = f.c; ctx.fillText(f.s, f.x, f.y); });
      ctx.globalAlpha = 1; ctx.restore(); ctx.restore();

      // kabut hutan: area pandang terbatas
      var px = P.x - cx, py = P.y - cy, vr = Math.max(vw, vh) * .55 * (1 - .22 * Math.max(E.dark, E.sto * .55) - .15 * E.rain), fg = ctx.createRadialGradient(px, py, 90 - 40 * Math.max(E.dark, E.sto * .55), px, py, vr);
      fg.addColorStop(0, "rgba(8,10,6,0)"); fg.addColorStop(.55, "rgba(8,10,6,.55)"); fg.addColorStop(1, "rgba(8,10,6,.95)");
      ctx.fillStyle = "rgba(10,25,60," + (.3 * Math.max(E.dark, E.sto * .6)) + ")"; ctx.fillRect(0, 0, vw, vh);
      var dusk = E.tod > .52 && E.tod < .7 ? 1 - Math.abs(E.tod - .61) / .09 : 0;
      if (dusk > 0) { ctx.fillStyle = "rgba(255,120,40," + (.16 * dusk) + ")"; ctx.fillRect(0, 0, vw, vh); }
      ctx.fillStyle = fg; ctx.fillRect(0, 0, vw, vh);
      if (E.dark > .02) { // malam: gelap pekat, hanya sekitar obor yang terang
        var lw = lc.width, lh = lc.height, ls = lw / vw, fk = .92 + Math.sin(tn / 90) * .04 + Math.sin(tn / 37) * .03;
        var lamp = function (x, y, r) { var gx = (x - cx) * ls, gy = (y - cy) * ls, rr = r * ls, gg = lg.createRadialGradient(gx, gy, rr * .1, gx, gy, rr); gg.addColorStop(0, "rgba(0,0,0,1)"); gg.addColorStop(.5, "rgba(0,0,0,.6)"); gg.addColorStop(1, "rgba(0,0,0,0)"); lg.fillStyle = gg; lg.fillRect(gx - rr, gy - rr, rr * 2, rr * 2); };
        lg.globalCompositeOperation = "source-over"; lg.clearRect(0, 0, lw, lh); lg.fillStyle = "rgba(3,6,22," + .86 * E.dark + ")"; lg.fillRect(0, 0, lw, lh);
        lg.globalCompositeOperation = "destination-out"; lamp(P.x, P.y - 10, 200 * fk); remote.forEach(function (r) { lamp(r.p.x, r.p.y - 10, 90); });
        ctx.drawImage(lc, 0, 0, vw, vh);
        ctx.globalCompositeOperation = "lighter";
        var wx = P.x - cx, wy = P.y - cy - 10, wg = ctx.createRadialGradient(wx, wy, 5, wx, wy, 170 * fk); wg.addColorStop(0, "rgba(255,160,60," + .22 * E.dark + ")"); wg.addColorStop(1, "rgba(255,120,30,0)"); ctx.fillStyle = wg; ctx.fillRect(wx - 180, wy - 180, 360, 360);
        for (var f = 0; f < 36; f++) { // kunang-kunang
          var fx = ((f * 211 - cx + Math.sin(tn / 700 + f) * 30) % (vw + 60) + vw + 60) % (vw + 60) - 30, fy = ((f * 127 - cy + Math.cos(tn / 900 + f * 2) * 40) % (vh + 60) + vh + 60) % (vh + 60) - 30;
          ctx.fillStyle = "rgba(200,255,120," + .8 * (.5 + .5 * Math.sin(tn / 400 + f * 1.7)) * E.dark + ")"; ctx.beginPath(); ctx.arc(fx, fy, 1.8, 0, 7); ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
      }
      if (E.flash > 0) { ctx.fillStyle = "rgba(255,255,255," + .75 * E.flash + ")"; ctx.fillRect(0, 0, vw, vh); }
      if (E.rain > .05) {
        ctx.fillStyle = "rgba(60,80,100," + (.18 * E.rain) + ")"; ctx.fillRect(0, 0, vw, vh);
        ctx.strokeStyle = "rgba(190,210,230," + (.35 * E.rain) + ")"; ctx.lineWidth = 1; ctx.beginPath();
        var tm = performance.now() / 1000;
        for (var q = 0; q < 110; q++) { var rx = (q * 97 + tm * 120) % (vw + 60) - 30, ry = (q * 53 + tm * 900) % (vh + 40) - 20; ctx.moveTo(rx, ry); ctx.lineTo(rx - 5, ry + 14); }
        ctx.stroke();
      }

      // HUD
      var hs = Math.min(1, vh / 420), hvw = vw / hs; ctx.save(); ctx.scale(hs, hs);
      ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(12, 12, 232, 96);
      [["Nyawa", P.hp, "#d8452f"], ["Tenaga", P.st, "#c9c13a"], ["Lapar", P.hu, "#d98a2b"], ["Haus", P.th, "#4a9ad8"]].forEach(function (b, n) {
        ctx.fillStyle = "#222"; ctx.fillRect(66, 18 + n * 16, 170, 8);
        ctx.fillStyle = b[2]; ctx.fillRect(66, 18 + n * 16, 170 * Math.max(0, b[1]) / 100, 8);
        ctx.fillStyle = "#f3ead6"; ctx.font = "11px Georgia"; ctx.textAlign = "left"; ctx.fillText(b[0], 18, 26 + n * 16);
      });
      var tl = E.dark > .6 ? "Malam" : E.tod > .5 ? "Senja" : E.tod < .08 ? "Fajar" : E.tod < .35 ? "Pagi" : "Siang";
      ctx.fillStyle = "#f3ead6"; ctx.font = "bold 12px Georgia";
      ctx.fillText("Skor " + score + " · Daging " + P.meat + " · " + tl + (E.rain > .5 ? " · Hujan" : "") + (P.bleed ? " · Luka" : ""), 18, 100);
      var ci = 0; ctx.font = "14px serif"; ctx.textAlign = "left";
      for (var k in D) {
        var kx = 12 + (ci % 3) * 58, ky = 114 + ((ci / 3) | 0) * 25; ci++;
        ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(kx, ky, 54, 22);
        ctx.fillStyle = "#f3ead6"; ctx.fillText(D[k].e + " " + (kills[k] || 0), kx + 4, ky + 16);
      }
      var mx = hvw - 142; ctx.drawImage(mini, mx, 12);
      ctx.strokeStyle = "#e0b64a"; ctx.lineWidth = 2; ctx.strokeRect(mx, 12, 130, 130);
      var sc = 130 / W;
      animals.forEach(function (an) { if (Math.hypot(P.x - an.x, P.y - an.y) < 420) { ctx.fillStyle = an.d.tiger ? "#ff5a3c" : "#ffe27a"; ctx.fillRect(mx + an.x * sc - 1.5, 12 + an.y * sc - 1.5, 3, 3); } });
      remote.forEach(function (r) { ctx.fillStyle = "#6fd0ff"; ctx.fillRect(mx + r.p.x * sc - 2, 12 + r.p.y * sc - 2, 4, 4); });
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(mx + P.x * sc, 12 + P.y * sc, 3.5, 0, 7); ctx.fill();
      // mawar angin: dibaca dari matahari (siang) atau Gubuk Penceng/Rasi Layang-layang di selatan (malam)
      var rx0 = mx + 65, ry0 = 187, R0 = 20, names = ["Utara", "Timur Laut", "Timur", "Tenggara", "Selatan", "Barat Daya", "Barat", "Barat Laut"];
      ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(mx, 150, 130, 80);
      ctx.strokeStyle = "#e0b64a"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(rx0, ry0, R0, 0, 7); ctx.stroke();
      ctx.fillStyle = "#e0b64a"; ctx.font = "bold 10px Georgia"; ctx.textAlign = "center";
      ctx.fillText("U", rx0, ry0 - R0 - 3); ctx.fillText("S", rx0, ry0 + R0 + 10); ctx.fillText("T", rx0 + R0 + 9, ry0 + 3); ctx.fillText("B", rx0 - R0 - 9, ry0 + 3);
      var ma = E.dark > .5 ? Math.PI / 2 : Math.PI * Math.min(1, E.tod / .6);
      ctx.fillStyle = E.dark > .5 ? "#cfe3ff" : "#ffd24a"; ctx.beginPath(); ctx.arc(rx0 + Math.cos(ma) * R0, ry0 + Math.sin(ma) * R0, 3.5, 0, 7); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(rx0, ry0); ctx.lineTo(rx0 + Math.cos(P.a) * (R0 - 4), ry0 + Math.sin(P.a) * (R0 - 4)); ctx.stroke();
      ctx.fillStyle = "#f3ead6"; ctx.font = "11px Georgia"; ctx.fillText("Menghadap " + names[Math.round(((P.a * 180 / Math.PI + 90 + 360) % 360) / 45) % 8], rx0, 224);
      ctx.restore();
      if (E.dis) {
        var nm = { gempa: "GEMPA BUMI", badai: "BADAI PETIR", banjir: "BANJIR BANDANG" }[E.dis.type], tipd = { gempa: "Lompat untuk menghindari batu jatuh", badai: "Jauhi pohon tinggi, cari tempat terbuka", banjir: "Menjauh dari sungai, cari tanah tinggi" }[E.dis.type];
        ctx.fillStyle = E.dis.on ? "rgba(150,20,20,.82)" : "rgba(180,130,10,.82)"; ctx.fillRect(vw / 2 - 150, 10, 300, 42);
        ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = "bold 14px Georgia";
        ctx.fillText("⚠ " + nm + (E.dis.on ? " · " + Math.ceil(E.dis.t) + " dtk" : " · bersiap!"), vw / 2, 28);
        ctx.font = "12px Georgia"; ctx.fillText(tipd, vw / 2, 44);
      }
      var tags = []; if (P.bleed) tags.push("Luka berdarah"); if (P.pois > 0) tags.push("Keracunan"); if (P.sw) tags.push("Berenang"); if (P.wet > .6) tags.push("Basah kuyup");
      if (tags.length) { ctx.fillStyle = "#ffb8a8"; ctx.font = "12px Georgia"; ctx.textAlign = "center"; ctx.fillText(tags.join(" · "), vw / 2, E.dis ? 66 : 24); }
      if (E.mt > 0 && E.msg) { ctx.fillStyle = "#ffe9a8"; ctx.font = "bold 15px Georgia"; ctx.textAlign = "center"; ctx.fillText(E.msg, vw / 2, vh - 40); }
      ctx.fillStyle = "rgba(243,234,214,.7)"; ctx.font = "12px Georgia"; ctx.textAlign = "center";
      if (!TOUCH) ctx.fillText("WASD jalan · Shift lari · Spasi lompat · klik/F tombak · E minum/makan", vw / 2, vh - 12);
      if (P.hp <= 0) {
        ctx.fillStyle = "rgba(0,0,0,.7)"; ctx.fillRect(0, 0, vw, vh);
        ctx.fillStyle = "#e0b64a"; ctx.font = "bold 30px Georgia"; ctx.fillText("Sang penjelajah gugur", vw / 2, vh / 2 - 8);
        ctx.fillStyle = "#f3ead6"; ctx.font = "16px Georgia"; ctx.fillText("Skor akhir " + score + "  ·  ketuk atau tekan R untuk mengulang", vw / 2, vh / 2 + 24);
      }
    }

    (function loop(now) {
      requestAnimationFrame(loop);
      var dt = Math.min(.05, (now - last) / 1000); last = now;
      remoteStep(dt); update(dt); draw();
    })(last);
  }

  window.ForestMap = { generate: generate, start: start, animals: D };
})();
