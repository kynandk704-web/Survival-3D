// server.js — jalankan: npm i ws && node server.js  (lalu buka http://localhost:3000)
const http = require("http"), fs = require("fs"), path = require("path");
const { WebSocketServer } = require("ws");
const PORT = process.env.PORT || 3000, ROOT = __dirname;
const SEED = 1 + ((Math.random() * 2147483646) | 0); // semua pemain memakai peta yang sama
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json" };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p === "/") p = "/index.html";
  const f = path.join(ROOT, path.normalize(p));
  if (!f.startsWith(ROOT + path.sep) || /node_modules|server\.js|package/.test(f)) { res.writeHead(404); return res.end("404"); }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end("404"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); res.end(d);
  });
});

const wss = new WebSocketServer({ server, maxPayload: 4096 });
const players = new Map(); let nextId = 1;
const send = (ws, o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
const bcast = (o, except) => { const m = JSON.stringify(o); for (const c of wss.clients) if (c !== except && c.readyState === 1) c.send(m); };
const NUM = ["x", "y", "a", "walk", "face", "hp", "z", "down", "dm", "bleed", "hurt", "wet", "st"];
const clean = (t, n) => String(t || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const num = v => (typeof v === "number" && isFinite(v) ? v : 0);

wss.on("connection", ws => {
  const id = nextId++, me = { id, name: "Penjelajah" + id, s: null };
  let lastS = 0, lastC = 0, lastSp = 0; players.set(id, me);
  ws.on("message", raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    const now = Date.now();
    if (m.t === "join") {
      me.name = clean(m.name, 16) || me.name;
      send(ws, { t: "welcome", id, seed: SEED, players: [...players.values()].filter(p => p.id !== id).map(p => ({ id: p.id, name: p.name })) });
      bcast({ t: "join", id, name: me.name }, ws);
    } else if (m.t === "s" && m.s && typeof m.s === "object") {
      if (now - lastS < 40) return; lastS = now;
      const s = {}; for (const k of NUM) s[k] = num(m.s[k]);
      s.x = Math.max(0, Math.min(2400, s.x)); s.y = Math.max(0, Math.min(2400, s.y)); s.sw = !!m.s.sw;
      me.s = s; bcast({ t: "s", id, s }, ws);
    } else if (m.t === "chat") {
      if (now - lastC < 700) return; lastC = now;
      const text = clean(m.text, 200); if (text) bcast({ t: "chat", id, name: me.name, text });
    } else if (m.t === "spear" && m.d) {
      if (now - lastSp < 300) return; lastSp = now;
      bcast({ t: "spear", id, d: { x: num(m.d.x), y: num(m.d.y), a: num(m.d.a) } }, ws);
    }
  });
  ws.on("close", () => { players.delete(id); bcast({ t: "leave", id }); });
});

server.listen(PORT, () => console.log("Rimba Nusantara multiplayer di http://localhost:" + PORT));
