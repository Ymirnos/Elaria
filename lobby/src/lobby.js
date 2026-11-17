// Elaria lobisi: tarayıcıda oynayanların listesi, katılma istekleri ve eşleşen ikilinin oyun iletilerinin aktarımı.
// Saf sınıf: bağlantıları tanımaz; her oyuncu için bir send(obj) işlevi alır (src/room.js verir). Kurallar:
// ElariaWeb/docs/2026-11-08-browser-multiplayer-design.md, bölüm 3. Sınama: npm test
export const ASK_TIMEOUT = 30_000, ASK_EVERY = 3_000;

const clean = s => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 20);

export class Lobby {
  #players = new Map();   // id -> oyuncu
  #now;
  #newId;

  constructor(now = () => Date.now(), newId = () => crypto.randomUUID().slice(0, 8)) {
    this.#now = now;
    this.#newId = newId;
  }

  get size() { return this.#players.size; }

  join(send) {
    const id = this.#newId();
    this.#players.set(id, {
      id, send, name: "Oyuncu", level: 1, race: "human", open: false,
      peer: null,          // eşleşilen oyuncu
      asking: null,        // istek attığım ev sahibi
      askAt: 0, lastAsk: -Infinity,
      askedBy: null,       // bana istek atan misafir
    });
    send({ t: "hi", id });
    send({ t: "list", players: this.#listFor(id) });
    return id;
  }

  leave(id) {
    const p = this.#players.get(id);
    if (!p) return;
    this.#unpair(p);
    this.#withdraw(p);
    this.#refuseIncoming(p, "gone");
    this.#players.delete(id);
    this.#broadcast();
  }

  message(id, m) {
    const p = this.#players.get(id);
    if (!p || !m || typeof m !== "object") return;
    this.tick();
    switch (m.t) {
      case "me":
        p.name = clean(m.name) || "Oyuncu";
        p.level = Math.min(999, Math.max(1, Math.trunc(Number(m.level)) || 1));
        p.race = clean(m.race) || "human";
        p.open = m.open === true;
        if (!p.open) this.#refuseIncoming(p, "busy");
        break;
      case "ask": {
        if (p.peer || p.asking) { p.send({ t: "error", why: "busy" }); return; }
        const now = this.#now();
        if (now - p.lastAsk < ASK_EVERY) { p.send({ t: "error", why: "too_fast" }); return; }
        p.lastAsk = now;
        const h = this.#players.get(m.to);
        if (!h || h === p || !this.#listed(h) || h.askedBy) { p.send({ t: "answered", from: m.to, yes: false, why: "busy" }); return; }
        p.asking = h.id;
        p.askAt = now;
        h.askedBy = p.id;
        h.send({ t: "asked", from: p.id, name: p.name, level: p.level });
        break;
      }
      case "cancel":
        this.#withdraw(p);
        break;
      case "answer": {
        const g = this.#players.get(m.to);
        if (!g || p.askedBy !== g.id || g.asking !== p.id) return;
        p.askedBy = null;
        g.asking = null;
        if (m.yes === true && !p.peer && !g.peer) {
          this.#refuseIncoming(g, "busy");   // misafire de bir istek gelmiş olabilir
          p.peer = g.id;
          g.peer = p.id;
          p.send({ t: "paired", peer: g.id, role: "host" });
          g.send({ t: "paired", peer: p.id, role: "guest" });
        } else g.send({ t: "answered", from: p.id, yes: false, why: "no" });
        break;
      }
      case "data":   // eşime olduğu gibi; liste değişmez
        if (p.peer && Array.isArray(m.d)) this.#players.get(p.peer)?.send({ t: "data", d: m.d });
        return;
      case "leave":
        this.#unpair(p);
        break;
      default:
        return;
    }
    this.#broadcast();
  }

  // Cevapsız istekler 30 sn'de düşer (room.js 5 sn'de bir, ayrıca her iletide çağırır).
  tick() {
    const now = this.#now();
    let changed = false;
    for (const p of this.#players.values()) {
      if (!p.asking || now - p.askAt < ASK_TIMEOUT) continue;
      const h = this.#players.get(p.asking);
      if (h && h.askedBy === p.id) { h.askedBy = null; h.send({ t: "withdrawn", from: p.id }); }
      p.send({ t: "answered", from: p.asking, yes: false, why: "timeout" });
      p.asking = null;
      changed = true;
    }
    if (changed) this.#broadcast();
  }

  #listed(p) { return p.open && !p.peer && !p.asking; }
  #info(p) { return { id: p.id, name: p.name, level: p.level, race: p.race }; }
  #listFor(id) { return [...this.#players.values()].filter(q => q.id !== id && this.#listed(q)).map(q => this.#info(q)); }

  // ponytail: her değişiklikte eşsiz herkese tam liste; yüzlerce oyuncuya dek yeter, sonra yalnız farkı yollamak gerekir
  #broadcast() {
    const all = [...this.#players.values()].filter(q => this.#listed(q)).map(q => this.#info(q));
    for (const q of this.#players.values()) if (!q.peer) q.send({ t: "list", players: all.filter(x => x.id !== q.id) });
  }

  // Bekleyen isteğimi geri çek
  #withdraw(p) {
    if (!p.asking) return;
    const h = this.#players.get(p.asking);
    if (h && h.askedBy === p.id) { h.askedBy = null; h.send({ t: "withdrawn", from: p.id }); }
    p.asking = null;
  }

  // Bana gelen isteği düşür (kapattım, eşleştim, ayrıldım)
  #refuseIncoming(p, why) {
    if (!p.askedBy) return;
    const g = this.#players.get(p.askedBy);
    p.askedBy = null;
    if (!g || g.asking !== p.id) return;
    g.asking = null;
    g.send({ t: "answered", from: p.id, yes: false, why });
    p.send({ t: "withdrawn", from: g.id });
  }

  #unpair(p) {
    if (!p.peer) return;
    const q = this.#players.get(p.peer);
    p.peer = null;
    if (q) { q.peer = null; q.send({ t: "unpaired" }); }
  }
}
