// Dil: Türkçe metin HTML'de yazılıdır (JS çalışmasa da sayfa eksiksiz okunur); burada yalnız İngilizcesi var.
// Etiketler: data-i18n (yazı), data-i18n-alt (görsel açıklaması), data-i18n-content (meta). İlk dil: kayıtlı seçim,
// yoksa tarayıcının dili. Değişince "langchange" olayı yayılır (blocks.js harf harf yazıyı ve sayaçları tazeler).
(() => {
  const EN = {
    "meta.title": "Elaria",
    "meta.desc": "Elaria: a pixel world waiting under a black fog. Real-time combat, 43 bosses, 1,224 items. Ymir's Studio.",
    "nav.skip": "Skip to download",
    "nav.download": "Download",
    "hero.tag": "A Ymir's Studio game",
    "hero.lead": "A pixel world waiting under a black fog. Real-time combat, 43 bosses, over a thousand items, and a journey that is yours to the end.",
    "hero.download": "Download",
    "hero.play": "Play in browser",
    "hero.play.note": "No install · ~20 MB",
    "hero.scroll": "Scroll",

    "story.kicker": "Prologue",
    "story.title": "A box, a screen, a world",
    "story.l1": "In a basement no one had entered for years, there was a dusty box. At the bottom of the box lay a game.",
    "story.l2": "No publisher, no year. Only a single word: Elaria.",
    "story.l3": "That night, the child slid it into an old console. Before a single button was pressed, the screen lit up.",
    "story.l4": "And Elaria pulled the child in.",
    "story.end": "This is where the story begins.",
    "story.alt1": "A child by a box in a dusty basement with stairs",
    "story.alt2": "The Elaria game case with a moon and a castle on its cover",
    "story.alt3": "The word Elaria on an old TV in a room at night",
    "story.alt4": "The room breaking into blocks and being pulled into the screen",

    "map.kicker": "The Black Fog",
    "map.title": "Eight realms, eight gates",
    "map.lead": "At first only the Northern Plains are open. Defeat each realm's bosses and the black fog lifts from the next.",
    "danger": "Danger",
    "regions": "Regions",
    "bosses": "Bosses",
    "s1.name": "Northern Plains", "s1.regions": "North Village, Dark Forest, Green Meadows",
    "s1.bosses": "Slime King, Queen Bee, Lake Monster, Cursed Lich", "s1.alt": "The stone square of North Village",
    "s2.name": "Northern Frontier", "s2.regions": "Glacier Hills, Misty Swamp, Scorching Desert",
    "s2.bosses": "Yeti King, Pharaoh, Swamp Hydra, Ice Queen", "s2.alt": "Snowy Glacier Hills and the hunter's cabin",
    "s3.name": "Mountains and Jungle", "s3.regions": "Rocky Mountains, Jungle",
    "s3.bosses": "Spider Queen, Stone Titan, Jaguar God", "s3.alt": "The Jungle Village among dense trees",
    "s4.name": "Eastern Realms", "s4.regions": "Cherry Grove, Mushroom Realm, Savanna",
    "s4.bosses": "Mushroom Lord, Nine Tails", "s4.alt": "The Cherry Temple surrounded by cherry trees",
    "s5.name": "Ash and Coral", "s5.regions": "Ashlands, Coral Coast",
    "s5.bosses": "Sea King, Fire Dragon", "s5.alt": "The Volcano Fort between pools of lava",
    "s6.name": "South Elaria", "s6.regions": "Southern Strait, Lavender Plains, Golden Forest",
    "s6.bosses": "Storm Spirit, Pumpkin King, Kraken", "s6.alt": "The Golden Forest in autumn colours",
    "s7.name": "Canyon and Salt Flats", "s7.regions": "Red Canyon, White Salt Flats",
    "s7.bosses": "Giant Eagle, Salt Worm, Mine Golem", "s7.alt": "The Mining Town in the Red Canyon",
    "s8.name": "The Last Realms", "s8.regions": "Crystal Valley, Void Realm",
    "s8.bosses": "Crystal Dragon, Void Dragon, and whatever waits beyond the Last Gate", "s8.alt": "A night valley glowing with purple crystals",

    "feat.kicker": "What's in Elaria",
    "feat.title": "Fight, explore, build",
    "f1.t": "Real-time combat",
    "f1.p": "Attack cooldowns, dashes, critical hits. Every boss has its own moves and heals itself when wounded; hit it hard to break the healing.",
    "f1.alt": "Fighting the Fire Dragon in a lava arena, with the boss health bar on top",
    "f2.t": "12 races, 15 classes, 52 skills",
    "f2.p": "Every race has its own ability and every class its own fighting style. Skills learn new tricks as they rank up.",
    "f2.alt": "Characters in the outfits of fifteen classes, side by side",
    "f3.t": "Craft, build, farm",
    "f3.p": "902 recipes, anvil upgrades and enchantments, placeable blocks, furnaces, chests and farmland.",
    "f3.alt": "The crafting table and the bag screen",
    "f4.t": "A living world",
    "f4.p": "Four seasons, day and night, storms. Monsters rage under the Blood Moon; the sky is generous during a star shower.",
    "f4.alt": "The village square at night, lit by lanterns",
    "f5.t": "Dungeons and other realms",
    "f5.p": "The Forgotten Crypt, the Frost Keep, the Old Mine. Open their gates and step through portals into other realms; every rift has its own danger.",
    "f5.alt": "A dark crypt dungeon lit by torches",
    "f6.t": "Companions",
    "f6.p": "Saddle your horse, tame a wolf, take your boat out on the lake, cast your line.",
    "f6.alt": "A wooden pier reaching into the sea on the Coral Coast",

    "num.title": "Elaria in numbers",
    "num.items": "items", "num.recipes": "recipes", "num.creatures": "creatures",
    "num.bosses": "bosses", "num.quests": "quests", "num.chapters": "story chapters",

    "coop.kicker": "Two players",
    "coop.title": "Bring a friend",
    "coop.p": "One player hosts, the other joins over the same Wi-Fi. You share one world: a tree cut down, a chest opened, a boss defeated counts for both of you. Monsters grow stronger for two.",
    "coop.note": "Download version only.",
    "coop.alt": "Inside the Golden Barrel tavern",

    "play.kicker": "Begin the journey",
    "play.title": "Elaria is waiting",
    "play.dl.t": "Download for Windows",
    "play.dl.os": "Windows 10 / 11, 64-bit",
    "play.dl.one": "No install: one file, double-click",
    "play.dl.size": "About 95 MB",
    "play.dl.later": "The download link will be added when the site goes live.",
    "play.warn.t": "If Windows shows a warning",
    "play.warn.1": "In the \"Windows protected your PC\" window, click More info.",
    "play.warn.2": "Click Run anyway.",
    "play.warn.3": "The game opens. Your saves live in the %APPDATA%\\PixelRPG folder.",
    "play.warn.why": "The game isn't digitally signed yet, so everyone sees this warning.",
    "play.web.1": "No install: opens from this site",
    "play.web.2": "About 20 MB downloads on the first visit",
    "play.web.3": "Your saves stay in this browser",
    "play.web.4": "On a computer, with keyboard and mouse",
    "play.web.go": "Play",
    "play.web.note": "Chrome · Edge · Firefox",
    "device.note": "Elaria is made for computers: it cannot be played on a phone, tablet or TV. You can still look around.",
    "device.ok": "OK",

    "foot.by": "A Ymir's Studio game · Emir Destan Bakar",
  };

  const TR = {};   // HTML'deki Türkçe metin, ilk okunuşta saklanır
  const nodes = () => document.querySelectorAll("[data-i18n], [data-i18n-alt], [data-i18n-content]");
  for (const el of nodes()) {
    if (el.dataset.i18n) TR[el.dataset.i18n] = el.textContent.trim();
    if (el.dataset.i18nAlt) TR[el.dataset.i18nAlt] = el.getAttribute("alt");
    if (el.dataset.i18nContent) TR[el.dataset.i18nContent] = el.getAttribute("content");
  }

  let lang = "tr";
  function set(next) {
    lang = next === "en" ? "en" : "tr";
    const dict = lang === "en" ? EN : TR;
    for (const el of nodes()) {
      if (el.dataset.i18n && dict[el.dataset.i18n] != null) el.textContent = dict[el.dataset.i18n];
      if (el.dataset.i18nAlt && dict[el.dataset.i18nAlt] != null) el.setAttribute("alt", dict[el.dataset.i18nAlt]);
      if (el.dataset.i18nContent && dict[el.dataset.i18nContent] != null) el.setAttribute("content", dict[el.dataset.i18nContent]);
    }
    document.documentElement.lang = lang;
    for (const b of document.querySelectorAll("[data-lang]")) b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    try { localStorage.setItem("elaria.lang", lang); } catch { /* gizli pencere: hatırlanmaz */ }
    document.dispatchEvent(new CustomEvent("langchange", { detail: lang }));
  }

  // Sözlükte olmayan anahtar (yeni bir metin İngilizcesiz eklenmiş): geliştirirken konsolda görünür.
  const missing = Object.keys(TR).filter(k => !(k in EN));
  if (missing.length) console.warn("İngilizcesi eksik:", missing);

  let saved = null;
  try { saved = localStorage.getItem("elaria.lang"); } catch { /* yok */ }
  const first = saved || ((navigator.language || "").toLowerCase().startsWith("tr") ? "tr" : "en");
  for (const b of document.querySelectorAll("[data-lang]")) b.addEventListener("click", () => set(b.dataset.lang));
  window.ElariaI18n = { set, get lang() { return lang; }, missing };
  set(first);
})();
