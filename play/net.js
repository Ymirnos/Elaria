// Tarayıcıda iki kişilik oyun: Elaria lobi sunucusuna (ElariaServer) WebSocket köprüsü. Oyun (C#, PixelRPG/Core/Net.Web.cs)
// forGame işlevlerini JSImport ile çağırır (main.js "elaria-net" adıyla bağlar); gelen olaylar poll() ile satır satır
// alınır, her satır oyunun NetMessage biçiminde bir JSON'udur. Tasarım: docs/2026-11-08-browser-multiplayer-design.md.
// Saf yardımcılar (pack, joiner) Node'dan da sınanır: node --test "test/*.test.mjs"

export const CHUNK = 32 * 1024, FRAME = 64 * 1024;
const PART = "\u0001";   // parça satırı: \u0001<kimlik>/<sıra>/<adet>|<metin>

// Bir karede biriken satırları data çerçevelerine böler: 32 KB'tan uzun satır parçalanır, bir çerçeve 64 KB'ı geçmez.
let chunks = 0;
export function pack(lines) {
  const frames = [];
  let cur = [], size = 0;
  const push = s => {
    const cost = s.length + 3;   // tırnaklar ve virgül
    if (size + cost > FRAME && cur.length) { frames.push(cur); cur = []; size = 0; }
    cur.push(s);
    size += cost;
  };
  for (const line of lines) {
    if (line.length <= CHUNK) { push(line); continue; }
    const id = ++chunks, n = Math.ceil(line.length / CHUNK);
    for (let k = 0; k < n; k++) push(`${PART}${id}/${k}/${n}|${line.slice(k * CHUNK, (k + 1) * CHUNK)}`);
  }
  if (cur.length) frames.push(cur);
  return frames;
}

// Parçaları birleştirir: tam satırı ya da (parça eksikse) null döner.
export function joiner() {
  const parts = new Map();
  return s => {
    if (s[0] !== PART) return s;
    const bar = s.indexOf("|");
    const [id, k, n] = s.slice(1, bar).split("/").map(Number);
    const got = parts.get(id) || [];
    got[k] = s.slice(bar + 1);
    parts.set(id, got);
    if (got.filter(x => x !== undefined).length < n) return null;
    parts.delete(id);
    return got.join("");
  };
}

// ---- Bağlantı (yalnız tarayıcıda) ----

// Lobi adresi: yayında Render'daki lobi (site GitHub Pages'te; bazı Türk ev bağlantıları *.workers.dev'i engellediği için
// lobi Cloudflare'de değil: ElariaServer/OKU.md). Yerelde (python önizlemesi, node node/server.js ya da wrangler dev)
// 127.0.0.1:8787; "localhost" IPv6'ya gidebilir.
const LOBBY = "wss://elaria-lobi.onrender.com/ws";
const lobby = () => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ? "ws://127.0.0.1:8787/ws" : LOBBY;

let ws = null, online = false, wait = 1000, profile = null, out = [], events = [], players = [];
let state = { paired: false, asking: null, askingName: "", askedBy: null };
let join = joiner();
const emit = m => events.push(JSON.stringify(m));
const raw = m => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };

export function connect() {
  if (ws) return;
  ws = new WebSocket(lobby());
  ws.onopen = () => { online = true; wait = 1000; if (profile) raw({ t: "me", ...profile }); };
  ws.onmessage = e => { try { receive(JSON.parse(e.data)); } catch { /* bozuk çerçeve */ } };
  ws.onclose = () => {
    online = false;
    ws = null;
    players = [];
    join = joiner();
    if (state.paired) emit({ T: "close" });
    if (state.asking) emit({ T: "refused", Text: "gone", Name: state.askingName });
    if (state.askedBy) emit({ T: "withdrawn" });
    state = { paired: false, asking: null, askingName: "", askedBy: null };
    setTimeout(connect, wait);
    wait = Math.min(wait * 2, 15000);
  };
}

function receive(m) {
  switch (m.t) {
    case "list": players = Array.isArray(m.players) ? m.players : []; break;
    case "asked": state.askedBy = m.from; emit({ T: "ask", Name: m.name, Level: m.level }); break;
    case "withdrawn": if (state.askedBy === m.from) { state.askedBy = null; emit({ T: "withdrawn" }); } break;
    case "answered": if (state.asking === m.from) { state.asking = null; emit({ T: "refused", Text: m.why || "no", Name: state.askingName }); } break;
    case "error": if (state.asking) { state.asking = null; emit({ T: "refused", Text: m.why, Name: state.askingName }); } break;
    case "paired": Object.assign(state, { paired: true, asking: null, askedBy: null }); emit({ T: "open", Text: m.role }); break;
    case "unpaired": if (state.paired) { state.paired = false; emit({ T: "close" }); } break;
    case "data":
      if (state.paired && Array.isArray(m.d)) for (const s of m.d) { const line = join(String(s)); if (line !== null) events.push(line); }
      break;
  }
}

// Karenin sonunda (main.js): biriken satırlar tek pakette
export function flush() {
  if (out.length && state.paired) for (const d of pack(out)) raw({ t: "data", d });
  out = [];
}

// ---- Oyunun çağırdıkları (C#: ElariaWeb/WebNet.cs) ----
export const forGame = {
  me(name, level, race, open) { profile = { name, level, race, open }; raw({ t: "me", ...profile }); },
  ask(id) {
    const p = players.find(x => x.id === id);
    if (!online) { emit({ T: "refused", Text: "offline", Name: p ? p.name : "" }); return; }
    Object.assign(state, { asking: id, askingName: p ? p.name : "" });
    raw({ t: "ask", to: id });
  },
  cancel() { if (state.asking) { state.asking = null; raw({ t: "cancel" }); } },
  answer(yes) { if (state.askedBy) { raw({ t: "answer", to: state.askedBy, yes }); state.askedBy = null; } },
  send(line) { if (state.paired) out.push(line); },
  leave() { if (state.paired) { state.paired = false; out = []; raw({ t: "leave" }); } },
  poll() { const s = events.join("\n"); events = []; return s; },
  players() { return players.map(p => `${p.id}\t${p.name}\t${p.level}`).join("\n"); },
  online() { return online; },
};
