// Köşe sisi: ekranın dört köşesinde oyundaki kara sis (WorldScene.Frontier.cs DrawFog). 8 px'lik bloklar; kenarda nefes
// alır ve oynar, derinde koyulaşır, parça parça parıldar, üstünden ağır bir çapraz ışık geçer, kenarından kara zerreler
// tüter. Fare (ya da parmak) yaklaşınca bloklar oyundaki açılış gibi yükselip küçülerek söner, uzaklaşınca geri gelir.
// Tuval düşük çözünürlükte (1 tuval pikseli = 2 css px) çizilip keskin büyütülür; ~30 kare/sn, sekme gizliyken durur.
(() => {
  const canvas = document.getElementById("corner-fog");
  if (!canvas || typeof ElariaChunks === "undefined") return;
  const ctx = canvas.getContext("2d");
  const noise = ElariaChunks.noise;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const B = 8, PX = 2, b = B / PX;                // blok: 8 css px = 4 tuval pikseli
  const REACH = 110, RISE = 0.65, HOLD = 1.2;     // fare yarıçapı (css px), kalkış süresi, geri gelmeden bekleme (sn)
  const wave = x => 0.5 + 0.5 * Math.sin(x);
  let cells = [], motes = [], W = 0, H = 0, mx = -1e4, my = -1e4, last = 0, moteTimer = 0, raf = 0;
  let img = null, buf = null;   // bloklar doğrudan piksel tamponuna yazılır, karede tek putImageData (~3 bin fillRect yerine)
  let boxes = [];               // dört köşenin kutusu: tampon yalnız buralarda basılır

  const rgba = (r, g, bl, a) => ((Math.round(a * 255) << 24) | (bl << 16) | (g << 8) | r) >>> 0;
  // Tampona bir blok: üst satır ve sol sütun `edge`, gerisi `body` (ekran dışı kırpılır). Karıştırma yok: sonra yazılan üstte.
  function block(x, y, size, body, edge) {
    for (let j = 0; j < size; j++) {
      const yy = y + j;
      if (yy < 0 || yy >= H) continue;
      const row = yy * W;
      for (let i = 0; i < size; i++) {
        const xx = x + i;
        if (xx >= 0 && xx < W) buf[row + xx] = j === 0 || i === 0 ? edge : body;
      }
    }
  }

  // Köşe başına, köşeye uzaklığı yarıçapın 1,2 katından az olan bloklar. Yarıçap: clamp(90px, 14vw, 220px), dar ekranda ≤ 64.
  function build() {
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    W = Math.ceil(cw / PX); H = Math.ceil(ch / PX);
    canvas.width = W; canvas.height = H;
    img = ctx.createImageData(W, H);
    buf = new Uint32Array(img.data.buffer);
    let R = Math.min(220, Math.max(90, cw * 0.14));
    if (cw <= 480) R = Math.min(R, 64);
    const n = Math.ceil((R * 1.2) / B);
    const s = Math.min(n * b + 16, W, H);   // +16: alttaki köşelerde kalkan bloklar kutunun üstüne çıkar
    boxes = [[0, 0], [W - s, 0], [0, H - s], [W - s, H - s]].map(([x, y]) => [x, y, s, s]);
    cells = [];
    [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([right, bottom], c) => {
      for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) {
          const dist = Math.hypot((i + 0.5) * B, (j + 0.5) * B);
          if (dist > R * 1.2) continue;
          const x = right ? W - (i + 1) * b : i * b, y = bottom ? H - (j + 1) * b : j * b;   // tuval pikseli
          cells.push({ x, y, gx: Math.round(x / b), gy: Math.round(y / b), dist, R, ang: Math.atan2(j + 0.5, i + 0.5), seed: c * 2.1,
            n: noise(i + c * 101, j), open: 0, until: 0, d: 0 });
        }
    });
  }

  // Oyundaki FogGlint: her parça (2x2 blok) kendi anında kısa bir an aydınlanır; üstünden ağır bir çapraz bant geçer
  function glint(cx, cy, diag, t) {
    const phase = (t * 0.22 + noise(cx, cy) * 7.3) % 1;
    const twinkle = phase < 0.07 ? Math.sin((phase / 0.07) * Math.PI) : 0;
    return Math.max(twinkle, Math.pow(Math.max(0, Math.sin(diag * 0.035 - t * 0.7)), 24) * 0.7);
  }

  function draw(t, dt) {
    buf.fill(0);
    ctx.clearRect(0, 0, W, H);   // kutuların dışına çıkan zerreler iz bırakmasın
    const fx = mx / PX, fy = my / PX, reach = REACH / PX;
    for (const c of cells) {
      // Sınır: köşeye uzaklık R ± %17,5, açıya bağlı yumuşak ve yavaş dalgalanan; derinlik sınırdan içeri blok sayısı
      const k = 0.6 * Math.sin(c.ang * 5 + c.seed * 3 + t * 0.35) + 0.4 * Math.sin(c.ang * 11 + c.seed * 7 - t * 0.5);
      const depth = (c.R * (1 + 0.175 * k) - c.dist) / B + (c.n - 0.5) * 0.6;
      if (Math.hypot(c.x + b / 2 - fx, c.y + b / 2 - fy) < reach) c.until = t + HOLD;
      c.open = Math.min(1, Math.max(0, c.open + ((t < c.until ? 1 : -1) * dt) / RISE));
      c.d = depth <= 0 ? 0 : depth < 1 ? 1 : depth < 2 ? 2 : depth < 3 ? 3 : 4;
      if (depth <= -1 || c.open >= 1) continue;
      if (c.d === 0) {   // sisin dibindeki açık blok: hafif gölge, kenar keskin bir çizgi olmasın
        const shade = rgba(0, 0, 0, 0.18 * (1 - c.open));
        block(c.x, c.y, b, shade, shade);
        continue;
      }
      const a = c.d === 1 ? 0.42 + 0.48 * wave(t * 1.7 + c.n * 6.283) : c.d === 2 ? 0.82 + 0.14 * wave(t * 1.3 + c.n * 6.283) : c.d === 3 ? 0.95 : 1;
      const bob = c.d === 1 ? Math.round(Math.sin(t * 2.1 + c.n * 6.283) * 0.8) : 0;
      const gl = glint(c.gx >> 1, c.gy >> 1, c.gx + c.gy, t);
      const g = Math.round(4 + 7 * c.n + 22 * gl), e = Math.round(g + 9 + 18 * gl);
      const size = Math.ceil(b * (1 - 0.45 * c.open));
      const x = Math.round(c.x + (b - size) / 2), y = Math.round(c.y + bob - 15 * c.open * c.open + (b - size) / 2);
      const alpha = a * (1 - c.open);
      block(x, y, size, rgba(g, g, g + 4, alpha), rgba(e, e, e + 5, alpha));   // üst ve sol kenar bir piksel açık: bloklar seçilir
    }
    for (const [x, y, w, h] of boxes) ctx.putImageData(img, 0, 0, x, y, w, h);
  }

  // Kenar bloklarından yükselen kara zerreler (aynı anda en çok 24)
  function drawMotes(dt) {
    for (const m of motes) { m.life -= dt; m.x += m.vx * dt; m.y += m.vy * dt; }
    motes = motes.filter(m => m.life > 0);
    for (moteTimer -= dt; moteTimer < 0 && motes.length < 24; moteTimer += 0.08) {
      const c = cells[(Math.random() * cells.length) | 0];
      if (!c || c.d < 1 || c.d > 2 || c.open > 0) continue;
      const life = 1.4 + Math.random() * 1.8;
      motes.push({ x: c.x + Math.random() * b, y: c.y + Math.random() * b, vx: (Math.random() - 0.5) * 5, vy: -2.5 - Math.random() * 4.5, life, max: life, size: Math.random() < 0.5 ? 1 : 2 });
    }
    if (moteTimer < -0.5) moteTimer = 0;
    ctx.fillStyle = "rgb(6,6,9)";
    for (const m of motes) {
      const k = m.life / m.max;
      ctx.globalAlpha = 0.82 * Math.min(1, k * 2.5) * k;
      ctx.fillRect(Math.round(m.x), Math.round(m.y), m.size, m.size);
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    raf = 0;
    if (document.hidden) return;
    if (now - last > 32) {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      draw(now / 1000, dt);
      drawMotes(dt);
    }
    raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } };

  build();
  let resizeTimer = 0;
  addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { build(); if (reduce) draw(0, 0); }, 120); });
  if (reduce) { draw(0, 0); ctx.globalAlpha = 1; return; }   // durağan tek kare, fareyle açılmaz

  const at = e => { mx = e.clientX; my = e.clientY; };
  addEventListener("pointermove", at, { passive: true });
  addEventListener("pointerdown", at, { passive: true });
  const away = e => { if (!e || e.pointerType !== "mouse") mx = my = -1e4; };
  addEventListener("pointerup", away, { passive: true });
  addEventListener("pointercancel", away, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { mx = my = -1e4; });
  document.addEventListener("visibilitychange", kick);
  kick();
})();
