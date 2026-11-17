// Sayfadaki küçük davranışlar. JS çalışmazsa ya da hareket azaltma açıksa her şey baştan son hâlindedir.
//   .fog-card    kara sis: kart bloklarla kurulunca (chunk:built, js/chunks.js) bloklar alttan üste dalgayla yükselip söner
//   .type        harf harf yazılır (oyundaki konuşma kutusu gibi)
//   [data-count] .stats kurulunca sayarak artar (ilk seferde), dile göre binlik ayırıcı
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const below = el => el.getBoundingClientRect().top > innerHeight * 0.9;
  const lang = () => (window.ElariaI18n && window.ElariaI18n.lang) || document.documentElement.lang || "tr";
  const fmt = n => n.toLocaleString(lang() === "tr" ? "tr-TR" : "en-US");

  // ---- Üst çubuk: kaydırınca cam olur ----
  const bar = document.querySelector(".bar");
  const solid = () => bar && bar.classList.toggle("is-solid", scrollY > 40);
  addEventListener("scroll", solid, { passive: true });
  solid();

  // ---- İndir düğmeleri: bağlantı varsa indirir, yoksa yayında ekleneceğini söyler ----
  const url = (window.ELARIA_CONFIG || {}).downloadUrl;
  const toast = document.querySelector(".toast");
  for (const a of document.querySelectorAll(".js-download")) {
    if (url) { a.href = url; a.setAttribute("download", ""); continue; }
    a.addEventListener("click", () => {
      if (!toast) return;
      toast.hidden = false;
      clearTimeout(toast._t);
      toast._t = setTimeout(() => (toast.hidden = true), 6000);
    });
  }

  // ---- Telefon, tablet, TV (index.html <head>: no-play): "Tarayıcıda oyna" klavyeyle de açılmasın; şerit kapatılınca
  // bu oturumda bir daha çıkmaz ----
  if (document.documentElement.classList.contains("no-play")) {
    for (const a of document.querySelectorAll('a[href="play/"]')) {
      a.setAttribute("aria-disabled", "true");
      a.tabIndex = -1;
      a.addEventListener("click", e => e.preventDefault());
    }
    document.querySelector(".device-ok")?.addEventListener("click", () => {
      document.documentElement.classList.add("device-ok");
      try { sessionStorage.setItem("elaria.deviceOk", "1"); } catch { /* gizli pencere */ }
    });
  }

  // Sayaçlar: son değerleriyle (dile göre) yazılır; parça kurulumu çalışıyorsa 0'dan başlayıp .stats kurulunca sayar
  const counters = [...document.querySelectorAll("[data-count]")];
  const showCount = (el, v) => { el._v = v; el.textContent = fmt(Math.round(v)); };
  const live = typeof ElariaChunks !== "undefined" && ElariaChunks.live;
  counters.forEach(el => showCount(el, live ? 0 : +el.dataset.count));
  document.addEventListener("langchange", () => counters.forEach(el => showCount(el, el._v)));
  if (reduce) return;

  // ---- Harf harf yazı: yalnız ekranın altında kalan satırlar hazırlanır ----
  const typers = new Map();   // el -> { full, done, timer }
  for (const el of document.querySelectorAll(".type")) {
    if (!below(el)) continue;
    el.style.minHeight = el.offsetHeight + "px";   // yazılırken düzen zıplamasın
    typers.set(el, { full: el.textContent, done: false, timer: 0 });
    el.textContent = "";
  }
  function type(el) {
    const st = typers.get(el);
    if (!st || st.done) return;
    el.classList.add("typing");
    let i = 0;
    const step = Math.max(14, Math.min(34, 2200 / st.full.length));
    st.timer = setInterval(() => {
      i += 1;
      el.textContent = st.full.slice(0, i);
      if (i >= st.full.length) finishType(el);
    }, step);
  }
  function finishType(el) {
    const st = typers.get(el);
    clearInterval(st.timer);
    st.done = true;
    el.textContent = st.full;
    el.classList.remove("typing");
    el.style.minHeight = "";
  }
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { type(e.target); io.unobserve(e.target); }
  }, { threshold: 0.35 });
  typers.forEach((_, el) => io.observe(el));

  function count(el) {
    const target = +el.dataset.count, t0 = performance.now(), dur = 1200;
    const tick = now => {
      const k = Math.min(1, (now - t0) / dur);
      showCount(el, target * (1 - (1 - k) ** 3));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Kara sis: kartın üstünde düşük çözünürlüklü tuval; her blok 3x3 tuval pikseli (~12 css px), aralarında koyuluk farkı.
  function makeFog(card) {
    const c = document.createElement("canvas");
    c.className = "fog";
    c.setAttribute("aria-hidden", "true");
    card.appendChild(c);
    const B = 3, CSS_BLOCK = 12;
    let cols = 0, rows = 0, cells = [];
    const size = () => {
      const r = card.getBoundingClientRect();
      cols = Math.ceil(r.width / CSS_BLOCK); rows = Math.ceil(r.height / CSS_BLOCK);
      c.width = cols * B; c.height = rows * B;
      cells = [];
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
          const n = Math.random();
          cells.push({ x, y, shade: n < 0.12 ? 18 : n < 0.4 ? 8 : 2, delay: ((rows - 1 - y) / rows) * 0.9 + Math.random() * 0.28 });
        }
    };
    const ctx = c.getContext("2d");
    const paint = t => {
      ctx.clearRect(0, 0, c.width, c.height);
      let alive = false;
      for (const cell of cells) {
        const p = t == null ? 0 : Math.min(1, Math.max(0, (t - cell.delay) / 0.45));
        if (p >= 1) continue;
        alive = true;
        const s = cell.shade;
        ctx.fillStyle = `rgba(${s},${s},${s + 6},${1 - p * p})`;
        ctx.fillRect(cell.x * B, cell.y * B - Math.round(p * p * 8), B, B);
      }
      return alive;
    };
    size(); paint(null);
    return {
      lifted: false,
      lift() {
        if (this.lifted) return;
        this.lifted = true;
        const t0 = performance.now();
        const frame = now => (paint((now - t0) / 1000) ? requestAnimationFrame(frame) : c.remove());
        requestAnimationFrame(frame);
      },
      resize() { if (!this.lifted) { size(); paint(null); } },
    };
  }
  // Sis yalnız parça kurulumu çalışıyorsa: onu kaldıracak olay (chunk:built) ancak o zaman gelir
  const fogs = new Map();
  if (live) for (const card of document.querySelectorAll(".fog-card")) fogs.set(card, makeFog(card));
  addEventListener("resize", () => fogs.forEach(f => f.resize()));

  let counted = false;
  document.addEventListener("chunk:built", e => {
    const el = e.target;
    if (fogs.has(el)) fogs.get(el).lift();
    if (!counted && el.matches(".stats")) { counted = true; el.querySelectorAll("[data-count]").forEach(count); }
  });

  // Dil değişince: yazılmamış satırlar yeni dilde beklesin, yazılanlar bitsin.
  document.addEventListener("langchange", () => {
    for (const [el, st] of typers) {
      if (st.done) continue;
      clearInterval(st.timer);
      st.full = el.textContent;
      if (el.classList.contains("typing")) { st.timer = 0; st.done = false; el.textContent = ""; type(el); }
      else el.textContent = "";
    }
  });
})();
