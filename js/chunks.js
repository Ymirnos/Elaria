// Parça kurulumu: oyundaki gibi (World/Chunks.cs) öğeler 16 px'lik karolarla, ekranın ortasından yayılan bir dalgayla
// yukarıdan düşerek kurulur. Düşen karolar üstteki #chunks tuvalinde çizilir (görselse resmin kendi parçası, değilse cam
// karo); yere oturan karo gerçek öğede clip-path ile açılır. Bir ekran boyu uzaklaşan öğe unutulur, dönünce yeniden kurulur.
// Hesaplar saf ve Node'dan da çağrılabilir (tests/chunks.check.js); tarayıcı kısmı yalnız sayfada çalışır.
const ElariaChunks = (() => {
  const B = 16;          // karo (css px)
  const M = 16;          // ızgara öğeden her yönde bu kadar taşar: gölge ve kenarlar kesilmesin
  const H = 38;          // karonun düşmeye başladığı yükseklik
  const FALL = 0.4;      // düşüş (sn)
  const SETTLE = 0.14;   // yere değince sekme (sn)
  const SPEED = 300;     // dalganın yayılma hızı (px/sn); yavaş gelirse tek ayar bu
  const JITTER = 0.11;   // karo başına gecikme (sn): dalga tırtıklı, mekanik görünmesin
  const SETTLED = 1 + SETTLE / FALL;   // ilerleme buna varınca karo yerinde

  // Oyundaki Noise ile aynı karışım: konuma bağlı, 0-1
  const noise = (x, y) => {
    let h = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h >>> 8) & 0xffff) / 65535;
  };

  // Karoların gecikmesi (sn). (ox, oy): dalganın merkezi, öğenin sol üst köşesine göre. burst değilse dalga öğenin
  // merkeze en yakın yerinden başlar (oyundaki _offset); burst'te (sayfa açılışı) uzaklık olduğu gibi kalır.
  function delays(cols, rows, ox, oy, burst, seed = 0) {
    const x0 = -M, y0 = -M, x1 = x0 + cols * B, y1 = y0 + rows * B;
    const off = burst ? 0 : Math.hypot(Math.max(x0 - ox, 0, ox - x1), Math.max(y0 - oy, 0, oy - y1)) / SPEED;
    const d = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++)
        d[j * cols + i] = Math.max(0, Math.hypot(x0 + (i + 0.5) * B - ox, y0 + (j + 0.5) * B - oy) / SPEED - off + noise(i + seed, j) * JITTER);
    return d;
  }

  // İlerleme p (0-1 düşüş, 1-SETTLED sekme) -> karonun dikey kayması (px) ve saydamlığı
  function fall(p) {
    if (p <= 0) return { dy: -H, alpha: 0 };
    if (p < 1) return { dy: -H * (1 - p) * (1 - p), alpha: Math.min(1, p * 2.2) };   // yerçekimi: yavaş başlar, hızlanır
    if (p >= SETTLED) return { dy: 0, alpha: 1 };
    const u = (p - 1) * FALL / SETTLE;
    return { dy: -2.2 * Math.sin(u * Math.PI) * (1 - u / 2), alpha: 1 };
  }

  // Yere oturmuş karoların birleşimi; bir satırdaki ardışık karolar tek dikdörtgen olur. Hiçbiri yoksa öğe gizli.
  function clipPath(done, cols, rows) {
    let s = "";
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; ) {
        if (!done[j * cols + i]) { i++; continue; }
        const a = i;
        while (i < cols && done[j * cols + i]) i++;
        s += `M${a * B - M} ${j * B - M}h${(i - a) * B}v${B}h${(a - i) * B}z`;
      }
    return s ? `path("${s}")` : "inset(50%)";
  }

  // object-fit: cover (ortalı): resmin kutuda kaç kat büyüdüğü ve kutuya göre sol üst köşesi
  function cover(nw, nh, w, h) {
    const s = Math.max(w / nw, h / nh);
    return { s, ox: (w - nw * s) / 2, oy: (h - nh * s) / 2 };
  }

  return { B, M, FALL, SETTLED, noise, delays, fall, clipPath, cover, live: false };
})();

if (typeof module === "object") module.exports = ElariaChunks;
else (() => {
  const C = ElariaChunks;
  const root = document.documentElement;
  const canvas = document.getElementById("chunks");
  const units = new Map([...document.querySelectorAll(".chunk")].map((el, k) => [el, { state: "hidden", seed: k * 37 }]));
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !canvas || !units.size) { root.classList.remove("chunking"); return; }
  const ctx = canvas.getContext("2d");
  const active = new Set();
  let dust = [], raf = 0, last = 0, first = true, dead = false, checking = 0;

  const hide = el => { el.style.clipPath = "inset(50%)"; };
  function built(el, st) {
    st.state = "built";
    active.delete(el);
    el.style.clipPath = "";
    el.dispatchEvent(new CustomEvent("chunk:built", { bubbles: true }));
  }
  // Hata olursa hiçbir şey gizli kalmasın: her öğe açılır, kurulmuş sayılır (sis kalkar, sayaçlar sayar).
  function release(e) {
    console.error(e);
    dead = true;
    cancelAnimationFrame(raf);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const [el, st] of units) if (st.state !== "built") built(el, st);
  }

  // Aynı anda giren öğeler aynı dalgayı paylaşır: tek başlangıç anı, merkez ekranın ortası.
  function start(els, burst) {
    const t0 = performance.now() / 1000, ox = innerWidth / 2, oy = innerHeight / 2;
    for (const el of els) {
      const st = units.get(el), r = el.getBoundingClientRect();
      const cols = Math.ceil((r.width + 2 * C.M) / C.B), rows = Math.ceil((r.height + 2 * C.M) / C.B);
      const imgs = [...el.querySelectorAll("img")].filter(i => i.complete && i.naturalWidth).map(img => {
        const q = img.getBoundingClientRect();
        return { img, x: q.left - r.left, y: q.top - r.top, w: q.width, h: q.height, fit: C.cover(img.naturalWidth, img.naturalHeight, q.width, q.height) };
      });
      // Karonun ortası hangi resmin üstünde: o karo resmin kendi parçası olarak düşer (-1: cam karo)
      const pic = new Int8Array(cols * rows).fill(-1);
      imgs.forEach((m, n) => {
        for (let j = 0; j < rows; j++)
          for (let i = 0; i < cols; i++) {
            const cx = (i + 0.5) * C.B - C.M - m.x, cy = (j + 0.5) * C.B - C.M - m.y;
            if (cx >= 0 && cy >= 0 && cx < m.w && cy < m.h) pic[j * cols + i] = n;
          }
      });
      Object.assign(st, {
        state: "building", t0, cols, rows, imgs, pic, left: cols * rows, done: new Uint8Array(cols * rows),
        d: C.delays(cols, rows, ox - r.left, oy - r.top, burst, st.seed),
      });
      hide(el);
      active.add(el);
    }
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function forget(el) {
    const st = units.get(el);
    if (st.state === "hidden") return;
    st.state = "hidden";
    active.delete(el);
    hide(el);
  }

  // Oyundaki gibi: yere oturan karonun altından biraz toz kalkar
  function puff(x, y) {
    for (let n = 0; n < 3; n++) dust.push({ x: x + Math.random() * C.B, y, vx: (Math.random() - 0.5) * 30, vy: -15 - Math.random() * 25, life: 0.3 });
  }

  function frame(now) {
    raf = 0;
    try {
      const t = now / 1000, dt = last ? Math.min(0.05, t - last) : 0;
      last = t;
      const dpr = Math.min(devicePixelRatio || 1, 2), w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);
      for (const el of active) {
        const st = units.get(el), r = el.getBoundingClientRect();
        let changed = false;
        for (let k = 0; k < st.d.length; k++) {
          if (st.done[k]) continue;
          const p = (t - st.t0 - st.d[k]) / C.FALL;
          if (p <= 0) continue;
          const i = k % st.cols, j = (k / st.cols) | 0;
          const x = r.left - C.M + i * C.B, y = r.top - C.M + j * C.B;
          if (p >= C.SETTLED) {   // yerinde: artık gerçek öğede görünür
            st.done[k] = 1;
            st.left--;
            changed = true;
            if (C.noise(j + st.seed, i) < 0.2 && y > 0 && y < h) puff(x, y + C.B);
            continue;
          }
          const f = C.fall(p), yy = y + f.dy;
          if (yy > h || yy + C.B < 0 || x > w || x + C.B < 0) continue;
          ctx.globalAlpha = f.alpha;
          const m = st.pic[k];
          if (m >= 0) {
            const im = st.imgs[m], s = im.fit.s;
            ctx.drawImage(im.img, (x - r.left - im.x - im.fit.ox) / s, (y - r.top - im.y - im.fit.oy) / s, C.B / s, C.B / s, x, yy, C.B, C.B);
          } else {   // cam karo: üst ve sol kenarı açık (sis blokları gibi)
            ctx.fillStyle = "rgba(233,236,255,.14)";
            ctx.fillRect(x, yy, C.B, C.B);
            ctx.fillStyle = "rgba(233,236,255,.32)";
            ctx.fillRect(x, yy, C.B, 1);
            ctx.fillRect(x, yy + 1, 1, C.B - 1);
          }
        }
        if (!st.left) built(el, st);
        else if (changed) el.style.clipPath = C.clipPath(st.done, st.cols, st.rows);
      }
      for (const d of dust) { d.life -= dt; d.x += d.vx * dt; d.y += d.vy * dt; }
      dust = dust.filter(d => d.life > 0);
      ctx.fillStyle = "rgb(200,210,255)";
      for (const d of dust) { ctx.globalAlpha = (d.life / 0.3) * 0.6; ctx.fillRect(d.x, d.y, 2, 2); }
      ctx.globalAlpha = 1;
      if (active.size || dust.length) raf = requestAnimationFrame(frame);
      else last = 0;
    } catch (e) { release(e); }
  }

  // Hangi öğe kurulmalı, hangisi unutulmalı: kaydırınca ve boyut değişince, karede bir kez bakılır. %15'i (ekrandan uzunsa
  // ekranın %15'i kadarı) görünen gizli öğe kurulur; bir ekran boyu uzaklaşan unutulur. İlk bakışta görünenler (sayfa
  // açılışı) ortadan tek bir patlama dalgasıyla kurulur, oyunda haritaya girerken olduğu gibi. IntersectionObserver
  // kullanılmaz: Chrome, clip-path: inset(50%) ile gizlenmiş öğeyi ekranda olsa da hiç görünür saymıyor.
  function check() {
    checking = 0;
    if (dead) return;
    try {
      const vw = innerWidth, vh = innerHeight, els = [];
      for (const [el, st] of units) {
        const r = el.getBoundingClientRect();
        if (st.state === "hidden") {
          const seen = Math.min(r.bottom, vh) - Math.max(r.top, 0);
          if (seen > 0 && seen >= Math.min(r.height, vh) * 0.15 && r.right > 0 && r.left < vw) els.push(el);
        } else if (r.bottom < -vh || r.top > 2 * vh) forget(el);
      }
      if (els.length) start(els, first);
      first = false;
    } catch (e) { release(e); }
  }
  const soon = () => { if (!checking && !first) checking = requestAnimationFrame(check); };

  try {
    for (const el of units.keys()) hide(el);   // artık satır içi stil yönetir; <head>'deki emniyet sınıfı gereksiz
    root.classList.remove("chunking");
    C.live = true;
    // Açılış dalgası yazı tipleri gelince (en çok 1 sn beklenir): sonradan gelen yazı tipi karoları kaydırmasın
    Promise.race([document.fonts && document.fonts.ready, new Promise(r => setTimeout(r, 1000))]).then(check, check);
    addEventListener("scroll", soon, { passive: true });
    document.addEventListener("langchange", soon);   // yazılar uzayıp kısalınca öğeler yer değiştirir
    addEventListener("resize", () => { for (const el of [...active]) built(el, units.get(el)); soon(); });
  } catch (e) { release(e); }
})();
