/* multiplayer.js — klien multiplayer + chat untuk Rimba Nusantara. Muat SETELAH map.js. */
(function () {
  var ws, me = 0, names = {}, pend = [], online = false, name = "";
  var WS = window.FOREST_WS || ((location.protocol === "https:" ? "wss://" : "ws://") + location.host);
  var css = document.createElement("style");
  css.textContent = "#mp-log{position:fixed;left:12px;bottom:44px;width:min(340px,70vw);z-index:6;pointer-events:none;font:13px system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000}#mp-log div{background:rgba(0,0,0,.45);padding:3px 8px;margin-top:2px;border-radius:4px;transition:opacity 1s}#mp-in{position:fixed;left:12px;bottom:10px;width:min(340px,70vw);z-index:7;display:none;padding:8px 10px;border:2px solid #e0b64a;border-radius:6px;background:rgba(0,0,0,.78);color:#fff;font:14px system-ui,sans-serif;box-sizing:border-box}#mp-btn{position:fixed;right:12px;top:238px;z-index:6;padding:6px 10px;border:2px solid #e0b64a;border-radius:16px;background:rgba(0,0,0,.6);color:#fff;font:700 12px system-ui,sans-serif}@media(pointer:coarse){#mp-log{bottom:auto;top:240px}}";
  var log = document.createElement("div"), inp = document.createElement("input"), btn = document.createElement("button");
  log.id = "mp-log"; inp.id = "mp-in"; inp.maxLength = 200; inp.placeholder = "Ketik pesan · Enter kirim · Esc batal"; btn.id = "mp-btn"; btn.textContent = "💬 Chat";

  function net() { return window.ForestMap && window.ForestMap.net; }
  function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
  function badge() { btn.textContent = "💬 Chat · " + (Object.keys(names).length + 1) + " online"; }
  function msg(who, text, sys) {
    var d = document.createElement("div");
    if (who) { var b = document.createElement("b"); b.textContent = who + ": "; b.style.color = "#9fe0ff"; d.appendChild(b); }
    d.appendChild(document.createTextNode(text)); if (sys) d.style.color = "#ffe9a8";
    log.appendChild(d); while (log.children.length > 6) log.removeChild(log.firstChild);
    setTimeout(function () { d.style.opacity = 0; setTimeout(function () { d.remove(); }, 1000); }, 12000);
  }
  function open() { inp.style.display = "block"; inp.focus(); }
  function close() { inp.value = ""; inp.style.display = "none"; inp.blur(); }
  btn.onclick = open;
  inp.addEventListener("keydown", function (e) {
    e.stopPropagation();
    if (e.key === "Escape") close();
    if (e.key === "Enter") {
      var t = inp.value.trim();
      if (t && online) send({ t: "chat", text: t });
      else if (t) { msg(name, t); var n = net(); if (n) n.say(null, t); }
      close();
    }
  });
  addEventListener("keydown", function (e) { if (e.key === "Enter" && inp.style.display !== "block" && log.parentNode) { e.preventDefault(); open(); } });

  function handle(m) {
    var n = net();
    if (m.t === "join") { names[m.id] = m.name; badge(); msg("", m.name + " bergabung ke rimba", 1); }
    else if (m.t === "s") n.upsert(m.id, names[m.id] || "?", m.s);
    else if (m.t === "leave") { n.remove(m.id); msg("", (names[m.id] || "Seseorang") + " meninggalkan rimba", 1); delete names[m.id]; badge(); }
    else if (m.t === "chat") { msg(m.name, m.text); n.say(m.id === me ? null : m.id, m.text); }
    else if (m.t === "spear") n.spear(m.id, m.d);
  }

  // kirim posisi 10x/detik; proses pesan yang tertunda sebelum game dimulai
  setInterval(function () {
    var n = net(); if (!n || !online) return;
    if (!n.emit) { n.emit = function (t, d) { send({ t: t, d: d }); }; n.setName(name); }
    while (pend.length) handle(pend.shift());
    var s = n.get(); for (var k in s) if (typeof s[k] === "number") s[k] = Math.round(s[k] * 100) / 100;
    send({ t: "s", s: s });
  }, 100);

  window.ForestMP = {
    ready: function (cb) {
      document.head.appendChild(css); document.body.append(log, inp, btn);
      var done = false, to;
      try { name = localStorage.getItem("fm_name") || ""; } catch (e) {}
      if (!name) {
        name = (prompt("Nama penjelajah (maks 16 huruf):") || "").trim().slice(0, 16) || "Penjelajah" + (100 + ((Math.random() * 900) | 0));
        try { localStorage.setItem("fm_name", name); } catch (e) {}
      }
      function fin(seed) { if (done) return; done = true; clearTimeout(to); cb(seed); }
      to = setTimeout(function () { msg("", "Server tidak terjangkau — bermain sendiri (offline).", 1); fin((Math.random() * 2147483646 | 0) + 1); }, 4000);
      try {
        ws = new WebSocket(WS);
        ws.onopen = function () { send({ t: "join", name: name }); };
        ws.onmessage = function (e) {
          var m; try { m = JSON.parse(e.data); } catch (x) { return; }
          if (m.t === "welcome") {
            me = m.id; online = true; m.players.forEach(function (p) { names[p.id] = p.name; });
            badge(); msg("", "Terhubung sebagai " + name, 1); fin(m.seed);
          } else if (net()) handle(m);
          else { if (pend.length > 300) pend.shift(); pend.push(m); }
        };
        ws.onclose = function () { if (online) { online = false; msg("", "Koneksi terputus.", 1); } };
      } catch (e) {}
    }
  };
})();
