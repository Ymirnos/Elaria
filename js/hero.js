// Arka plan sahnesi: başlık ekranındaki ay ışıklı göl ve kale, bütün sayfanın arkasında sabit durur (#scene); bölümler
// üstünden buzlu cam olarak kayar. Koddan, düşük çözünürlükte çizilir ve tam sayı katıyla keskin büyütülür (her sanal
// piksel S x S ekran pikseli). Durağan katmanlar boyut değişince bir kez önbelleğe çizilir; her karede yıldızlar,
// pencereler, bayrak, göl yansıması, kamp ateşi ve ateş böcekleri canlanır. Sekme gizliyken çizmez; hareket azaltmada tek kare.
(() => {
  const canvas = document.getElementById("scene");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const off = document.createElement("canvas");
  const g = off.getContext("2d");
  const mirror = document.createElement("canvas");   // göl yansıması bundan okunur: tuvali kendi üstüne çizmek her satırda kopya alır
  const mg = mirror.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = 320, H = 180, S = 4, horizon = 115;
  let layers = {};
  let stars = [], sparks = [], flies = [];
  let windows = [];
  let castle = {}, fire = {}, moon = {};

  // Tohumlu rastgele: sahne her açılışta aynı (yıldızlar, dağ çizgisi).
  const rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const layer = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;

  // Gökyüzü: renk bantları, aralarında 4x4 Bayer taraması (oyunun ışık haritasındaki gibi).
  function paintSky(c) {
    const x = c.getContext("2d");
    const stops = [[3, 5, 14], [8, 12, 36], [20, 26, 70], [44, 38, 92], [70, 52, 104]];
    const img = x.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      const t = Math.min(1, y / (horizon + 2)) * (stops.length - 1);
      const i = Math.min(stops.length - 2, Math.floor(t)), f = t - i;
      const steps = 6, q = f * steps, lo = Math.floor(q), frac = q - lo;
      for (let xx = 0; xx < W; xx++) {
        const k = frac * 16 > BAYER[(y & 3) * 4 + (xx & 3)] ? lo + 1 : lo;
        const col = mix(stops[i], stops[i + 1], Math.min(1, k / steps));
        const o = (y * W + xx) * 4;
        img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
  }

  function paintMoon(c) {
    const x = c.getContext("2d");
    const { cx, cy, r } = moon;
    // Hale: taranmış, dışa doğru seyrelen halkalar
    for (let y = -r * 3; y <= r * 3; y++)
      for (let xx = -r * 3; xx <= r * 3; xx++) {
        const d = Math.hypot(xx, y) / r;
        if (d < 1 || d > 3) continue;
        const a = (1 - (d - 1) / 2) ** 2;
        if (a * 16 > BAYER[((cy + y) & 3) * 4 + ((cx + xx) & 3)] * 1.9) {
          x.fillStyle = `rgba(190,200,255,${0.08 + a * 0.12})`;
          x.fillRect(cx + xx, cy + y, 1, 1);
        }
      }
    for (let y = -r; y <= r; y++)
      for (let xx = -r; xx <= r; xx++) {
        const d = Math.hypot(xx + 0.5, y + 0.5);
        if (d > r) continue;
        const shade = (xx + y) / (r * 2);   // sağ alt hafif gölgeli
        x.fillStyle = shade > 0.32 ? "#d8d1b2" : "#f6f1da";
        x.fillRect(cx + xx, cy + y, 1, 1);
      }
    const R = rng(11);
    x.fillStyle = "#c9c1a0";
    for (let i = 0; i < 6; i++) {
      const a = R() * Math.PI * 2, d = R() * r * 0.6, s = 1 + Math.round(R() * r * 0.18);
      x.fillRect(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), s, s);
    }
  }

  function ridge(c, color, base, amp, seed, freq) {
    const x = c.getContext("2d"), R = rng(seed);
    const ph = [R() * 6, R() * 6, R() * 6];
    x.fillStyle = color;
    for (let xx = 0; xx < W; xx++) {
      const h = base + amp * (0.55 * Math.sin(xx * freq + ph[0]) + 0.3 * Math.sin(xx * freq * 2.3 + ph[1]) + 0.15 * Math.sin(xx * freq * 5.1 + ph[2]));
      const top = Math.round(horizon - h);
      x.fillRect(xx, top, 1, horizon - top + 1);
    }
  }

  function pine(x, px, base, h, color) {
    x.fillStyle = color;
    for (let i = 0; i < h; i++) {
      const w = Math.max(1, Math.round((i / h) * h * 0.45) | 1);
      x.fillRect(px - (w >> 1), base - h + i, w, 1);
    }
    x.fillRect(px, base, 1, 2);
  }

  function paintCastle(c) {
    const x = c.getContext("2d");
    const u = Math.max(1, Math.round(Math.min(H / 180, W / 150)));
    const cx = castle.cx, top = castle.hilltop;
    const body = "#090e24", rim = "#222c5e";
    // Tepe
    x.fillStyle = "#080c1f";
    const hw = Math.round(W * 0.2);
    for (let xx = -hw; xx <= hw; xx++) {
      const k = 1 - (xx / hw) ** 2;
      const y = Math.round(horizon - k * (horizon - top) );
      x.fillRect(cx + xx, y, 1, horizon - y + 1);
    }
    windows = [];
    const rect = (rx, ry, rw, rh) => { x.fillStyle = body; x.fillRect(cx + rx * u, top - ry * u, rw * u, rh * u); };
    const battlements = (rx, ry, rw) => { x.fillStyle = body; for (let i = 0; i < rw; i += 2) x.fillRect(cx + (rx + i) * u, top - (ry + 2) * u, u, 2 * u); };
    const roof = (rx, ry, rw, rh) => {
      x.fillStyle = "#0c1230";
      for (let i = 0; i < rh; i++) {
        const w = Math.max(1, Math.round(rw * (i + 1) / rh));
        x.fillRect(cx + Math.round((rx + (rw - w) / 2) * u), top - (ry + rh - i) * u, w * u, u);
      }
    };
    const win = (rx, ry) => windows.push({ x: cx + rx * u, y: top - ry * u, w: u, h: 2 * u, p: windows.length * 1.7 });
    // Duvar
    rect(-34, 12, 70, 12); battlements(-34, 12, 70);
    // Küçük sol kule
    rect(-38, 20, 7, 20); roof(-39, 20, 9, 8);
    // Sol kule
    rect(-24, 30, 9, 30); roof(-25, 30, 11, 11); win(-21, 24); win(-21, 15);
    // Ana yapı
    rect(-12, 36, 22, 36); battlements(-12, 36, 22); win(-8, 28); win(-2, 28); win(4, 28); win(-5, 18); win(1, 18);
    // Kapı: kemer, içi sıcak ışık
    x.fillStyle = "#3a2410"; x.fillRect(cx - 3 * u, top - 7 * u, 6 * u, 7 * u);
    x.fillStyle = "#ffb54a"; x.fillRect(cx - 2 * u, top - 6 * u, 4 * u, 6 * u);
    // Uzun sağ kule (ayın önünde)
    rect(13, 50, 9, 50); roof(12, 50, 11, 13); win(16, 42); win(16, 32); win(16, 20);
    // Sağ uç kule
    rect(28, 24, 7, 24); roof(27, 24, 9, 8); win(30, 16);
    // Ay tarafında ince kenar ışığı
    x.fillStyle = rim;
    x.fillRect(cx + 13 * u, top - 50 * u, u, 50 * u);
    x.fillRect(cx - 12 * u, top - 36 * u, u, 36 * u);
    castle.flag = { x: cx + 17 * u, y: top - (50 + 13) * u - 6 * u, u };
    x.fillStyle = body; x.fillRect(castle.flag.x, castle.flag.y, u, 7 * u);   // direk
  }

  // Sol kıyının üst çizgisi (x'te): ateş de bunun üstüne oturur.
  const shoreEdge = () => Math.round(W * 0.4);
  const shoreTop = xx => {
    const y0 = horizon + Math.round((H - horizon) * 0.42), t = xx / shoreEdge();
    return Math.round(y0 + t * t * (H - y0) * 0.9 + Math.sin(xx * 0.35) * 1.2);
  };

  function paintShore(c) {
    const x = c.getContext("2d");
    const edge = shoreEdge();
    const y0 = horizon + Math.round((H - horizon) * 0.42);
    x.fillStyle = "#05070f";
    for (let xx = 0; xx < edge; xx++) {
      const y = shoreTop(xx);
      x.fillRect(xx, y, 1, H - y);
    }
    // Kıyıda çam ağaçları ve sazlar
    const R = rng(5);
    for (let i = 0; i < 9; i++) {
      const px = Math.round(R() * edge * 0.75);
      const base = Math.round(y0 + (px / edge) ** 2 * (H - y0) * 0.9) + 1;
      if (Math.abs(px - fire.x) < 12) continue;
      pine(x, px, base, Math.round(12 + R() * 20), "#03050b");
    }
    x.fillStyle = "#0b1226";
    for (let i = 0; i < 26; i++) {
      const px = Math.round(R() * edge);
      const base = Math.round(y0 + (px / edge) ** 2 * (H - y0) * 0.9);
      x.fillRect(px, base - 2, 1, 2);
    }
    // Sağ kıyı: alçak siyah çizgi ve birkaç çam
    const ry = horizon + Math.round((H - horizon) * 0.7);
    x.fillStyle = "#05070f";
    for (let xx = Math.round(W * 0.78); xx < W; xx++) {
      const t = (xx - W * 0.78) / (W * 0.22);
      const y = Math.round(ry - t * 10 + Math.sin(xx * 0.4));
      x.fillRect(xx, y, 1, H - y);
    }
    for (let i = 0; i < 4; i++) pine(x, Math.round(W * 0.84 + i * W * 0.04), Math.round(ry - i * 2.5), 14 + i * 4, "#03050b");
  }

  function build() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.max(1, Math.round(r.width * dpr)), ph = Math.max(1, Math.round(r.height * dpr));
    S = Math.max(2, Math.round(Math.min(ph / 190, pw / 170)));   // dar ekranda da kale ekranı doldurmasın
    W = Math.ceil(pw / S); H = Math.ceil(ph / S);
    horizon = Math.round(H * (W / H > 1.2 ? 0.66 : 0.84));
    canvas.width = pw; canvas.height = ph;
    off.width = W; off.height = H;
    mirror.width = W; mirror.height = horizon;

    const wide = W / H > 1.2;
    // Geniş ekranda yazılar solda (css): ay ve kale sağda. Dar ekranda ortada, yazıların altında (ufuk aşağıda).
    moon = wide ? { cx: Math.round(W * 0.74), cy: Math.round(H * 0.25), r: Math.max(10, Math.round(H * 0.085)) }
                : { cx: Math.round(W * 0.8), cy: Math.round(H * 0.1), r: Math.max(8, Math.round(Math.min(W, H) * 0.09)) };
    castle = { cx: Math.round(W * (wide ? 0.77 : 0.62)), hilltop: horizon - Math.round(H * 0.06) };
    fire = { x: Math.round(W * (wide ? 0.2 : 0.17)) };
    fire.y = shoreTop(fire.x) + 2;

    layers.sky = layer(); paintSky(layers.sky);
    layers.moon = layer(); paintMoon(layers.moon);
    layers.far = layer(); ridge(layers.far, "#151d45", H * 0.12, H * 0.07, 3, 0.021);
    layers.near = layer(); ridge(layers.near, "#0e1536", H * 0.05, H * 0.05, 9, 0.034);
    layers.castle = layer(); paintCastle(layers.castle);
    layers.shore = layer(); paintShore(layers.shore);

    const R = rng(1);
    stars = Array.from({ length: Math.round((W * horizon) / 70) }, () => ({
      x: Math.floor(R() * W), y: Math.floor(R() * (horizon - 14)), p: R() * 6.28, sp: 0.6 + R() * 2.2, big: R() < 0.06,
    })).filter(s => Math.hypot(s.x - moon.cx, s.y - moon.cy) > moon.r * 2.2);
    flies = Array.from({ length: 7 }, (_, i) => ({ x: R() * W * 0.36, y: horizon + 4 + R() * (H - horizon) * 0.45, p: i * 1.3 }));
    sparks = [];
    draw(performance.now());
  }

  function drawStars(t) {
    for (const s of stars) {
      const b = 0.5 + 0.5 * Math.sin(t * s.sp + s.p);
      if (b < 0.12) continue;
      const v = Math.round(150 + b * 105);
      g.fillStyle = `rgb(${v},${v},${Math.min(255, v + 25)})`;
      g.fillRect(s.x, s.y, 1, 1);
      if (s.big && b > 0.75) {
        g.fillStyle = "rgba(200,210,255,.55)";
        g.fillRect(s.x - 1, s.y, 1, 1); g.fillRect(s.x + 1, s.y, 1, 1);
        g.fillRect(s.x, s.y - 1, 1, 1); g.fillRect(s.x, s.y + 1, 1, 1);
      }
    }
    // Ara sıra kayan yıldız
    const cyc = t % 9;
    if (cyc < 0.7) {
      const k = cyc / 0.7, sx = Math.round(W * 0.1 + k * W * 0.3), sy = Math.round(H * 0.08 + k * H * 0.12);
      for (let i = 0; i < 6; i++) {
        g.fillStyle = `rgba(255,255,255,${(1 - i / 6) * (1 - k)})`;
        g.fillRect(sx - i * 2, sy - i, 2, 1);
      }
    }
  }

  function drawFire(t) {
    const fx = fire.x, fy = fire.y;
    // Sıcak ışık: taranmış daire
    for (let y = -16; y <= 6; y++)
      for (let x = -22; x <= 22; x++) {
        const d = Math.hypot(x, y * 1.6) / 22;
        if (d > 1) continue;
        const a = (1 - d) * (0.85 + 0.15 * Math.sin(t * 11));
        if (a * 16 > BAYER[((fy + y) & 3) * 4 + ((fx + x) & 3)] * 1.3) {
          g.fillStyle = `rgba(255,140,50,${0.1 + a * 0.18})`;
          g.fillRect(fx + x, fy + y, 1, 1);
        }
      }
    // Kütükler
    g.fillStyle = "#3a200c"; g.fillRect(fx - 4, fy, 9, 2);
    g.fillStyle = "#5a3416"; g.fillRect(fx - 3, fy - 1, 7, 1);
    // Alevler
    const cols = ["#c8381a", "#ff7a2a", "#ffc23a", "#fff2a8"];
    for (let i = -3; i <= 3; i++) {
      const h = Math.max(1, Math.round(7 - Math.abs(i) * 1.6 + Math.sin(t * 13 + i * 2.1) * 1.6 + Math.sin(t * 7.3 + i) * 1.1));
      for (let k = 0; k < h; k++) {
        const level = Math.min(3, Math.floor(((h - k) / h) * 3.2 + (Math.abs(i) < 2 ? 0.8 : 0)));
        g.fillStyle = cols[level];
        g.fillRect(fx + i, fy - 1 - k, 1, 1);
      }
    }
    // Kıvılcımlar
    if (Math.random() < 0.35) sparks.push({ x: fx + (Math.random() * 4 - 2), y: fy - 6, vx: (Math.random() - 0.5) * 6, life: 1 });
    for (const s of sparks) { s.y -= 0.55; s.x += s.vx * 0.03 + Math.sin(t * 5 + s.y) * 0.15; s.life -= 0.018; }
    sparks = sparks.filter(s => s.life > 0);
    for (const s of sparks) { g.fillStyle = `rgba(255,${180 + Math.round(s.life * 60)},90,${s.life})`; g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1); }
  }

  function draw(now) {
    const t = now / 1000;
    g.clearRect(0, 0, W, H);
    g.drawImage(layers.sky, 0, 0);
    drawStars(t);
    g.drawImage(layers.moon, 0, 0);
    g.drawImage(layers.far, 0, 0);
    g.drawImage(layers.near, 0, 0);
    g.drawImage(layers.castle, 0, 0);
    // Pencereler titrer, bayrak dalgalanır
    for (const w of windows) {
      const b = 0.75 + 0.25 * Math.sin(t * 2.3 + w.p) * Math.sin(t * 5.1 + w.p * 2);
      g.fillStyle = b > 0.62 ? "#ffcf6a" : "#e08a32";
      g.fillRect(w.x, w.y, w.w, w.h);
    }
    const f = castle.flag;
    g.fillStyle = "#c8384a";
    for (let i = 0; i < 6; i++) {
      const wave = Math.round(Math.sin(t * 6 - i * 0.9) * 0.9);
      g.fillRect(f.x + (i + 1) * f.u, f.y + wave * f.u, f.u, 3 * f.u);
    }
    // Göl: ufkun üstü satır satır aynalanır, dalgayla kayar, koyulaşır
    mg.clearRect(0, 0, W, horizon);
    mg.drawImage(off, 0, 0);
    for (let y = horizon; y < H; y++) {
      const depth = y - horizon;
      const src = horizon - depth - 1;
      if (src < 0) break;
      const dx = Math.round(Math.sin(y * 0.9 + t * 2.2) * (0.6 + depth * 0.05));
      g.drawImage(mirror, 0, src, W, 1, dx, y, W, 1);
    }
    g.fillStyle = "rgba(6,12,34,.5)";
    g.fillRect(0, horizon, W, H - horizon);
    // Ayın gölde parıltısı
    for (let y = horizon + 2; y < H; y += 2) {
      const w = Math.round(2 + Math.abs(Math.sin(y * 1.7 + t * 3)) * (3 + (y - horizon) * 0.12));
      if ((y * 7 + Math.floor(t * 6)) % 3 === 0) continue;
      g.fillStyle = "rgba(240,236,210,.55)";
      g.fillRect(moon.cx - (w >> 1) + Math.round(Math.sin(y + t * 2) * 2), y, w, 1);
    }
    g.drawImage(layers.shore, 0, 0);
    drawFire(t);
    // Ateş böcekleri
    for (const fl of flies) {
      if (Math.sin(t * 2.2 + fl.p) <= 0.2) continue;
      g.fillStyle = "#d6ff7a";
      g.fillRect(Math.round(fl.x + Math.sin(t * 0.7 + fl.p) * 6), Math.round(fl.y + Math.cos(t * 0.9 + fl.p) * 3), 1, 1);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, W * S, H * S);
  }

  // Döngü: ~30 kare/sn (piksel sahneye yeter); sekme gizliyken durur.
  let last = 0, raf = 0;
  function loop(now) {
    raf = 0;
    if (document.hidden) return;
    if (now - last > 32) { last = now; draw(now); }
    raf = requestAnimationFrame(loop);
  }
  const kick = () => { if (!reduce && !raf && !document.hidden) raf = requestAnimationFrame(loop); };

  build();
  document.addEventListener("visibilitychange", kick);
  let resizeTimer = 0;
  addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(build, 120); });
  kick();
})();
