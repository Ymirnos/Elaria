// Elaria tarayıcı sürümü: oyun dosyalarını (assets.zip) ve .NET çalışma zamanını birlikte indirir; tıklayınca oyunu başlatır
// (ses ancak bir tıklamadan sonra açılabilir), sonra her karede C# tarafındaki WebMain.Frame'i çağırır.
// İki kişilik oyun: net.js (lobi sunucusu köprüsü), oyuna "elaria-net" adıyla bağlanır.
import * as net from './net.js';   // .NET yükleyicisi boot()'ta: telefonda hiç inmesin

const $ = id => document.getElementById(id);
// Dil: sitenin seçimi (js/i18n.js aynı anahtarı yazar), yoksa tarayıcının dili. Oyun da ilk açılışta bununla başlar.
let saved = null;
try { saved = localStorage.getItem('elaria.lang'); } catch { /* gizli pencere */ }
const lang = saved === 'en' || saved === 'tr' ? saved : (navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en';
const tr = lang === 'tr';
const say = (t, e) => { $('status').textContent = tr ? t : e; };
// Sayfa yazıları: Türkçesi index.html'de, İngilizcesi burada (data-t anahtarları).
const EN = {
  back: '← Back to the site', kicker: 'Browser version', play: 'Play', again: 'Restart', site: 'Back to the site',
  'k.move.k': 'WASD / arrows', 'k.move': 'walk · Shift: run', 'k.act.k': 'Left / right click', 'k.act': 'attack · talk, open, gather',
  'k.inv': 'inventory', 'k.menu': 'menu, save, settings',
  saves: 'Your saves stay in this browser. About 20 MB is downloaded on the first visit.',
  touch: 'Elaria is made for computers: it cannot be played on a phone, tablet or TV. Open this page on a computer with a keyboard and mouse.',
};
if (!tr) {
  document.documentElement.lang = 'en';
  document.title = 'Elaria · Play in browser';
  for (const el of document.querySelectorAll('[data-t]')) if (EN[el.dataset.t]) el.textContent = EN[el.dataset.t];
}
const canvas = $('canvas');
canvas.addEventListener('contextmenu', e => e.preventDefault());   // sağ tık oyunda kullanılıyor

// Telefon, tablet, televizyon: oyun bilgisayar için; uyarı gösterilir, hiçbir şey indirilmez.
// Aynı denetim sitede: ElariaSite/index.html (<head>).
const noPlay = matchMedia('(hover: none) and (pointer: coarse)').matches
  || /SmartTV|SMART-TV|Tizen|Web0S|webOS|HbbTV|NetCast|BRAVIA|AFT[A-Z]|CrKey|Android TV|GoogleTV|AppleTV|Roku|PlayStation|Xbox/i.test(navigator.userAgent);

// İlerleme çubuğuyla indir (çubuk yalnız oyun dosyalarını sayar: en büyük parça o).
async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const parts = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    if (total) {
      const pct = Math.min(100, Math.round(got / total * 100));
      $('bar').style.width = `${pct}%`;
      $('track').setAttribute('aria-valuenow', pct);
      say(`Oyun dosyaları: ${(got / 1e6).toFixed(1)} / ${(total / 1e6).toFixed(1)} MB`, `Game files: ${(got / 1e6).toFixed(1)} / ${(total / 1e6).toFixed(1)} MB`);
    }
  }
  const all = new Uint8Array(got);
  let at = 0;
  for (const p of parts) { all.set(p, at); at += p.length; }
  return all;
}

// Kayıtlar: /save tarayıcının veritabanına (IndexedDB) bağlı. Açılışta oradan okunur; oyun bir dosya yazınca (kayıt,
// otomatik kayıt, ayar) saniyesinde geri yazılır, sekme gizlenince ya da kapanırken de hemen.
async function mountSaves(FS) {
  FS.mkdir('/save');
  FS.mount(FS.filesystems.IDBFS, {}, '/save');
  await new Promise((ok, fail) => FS.syncfs(true, e => (e ? fail(e) : ok())));
  const stamp = () => {
    const out = [];
    const walk = dir => {
      for (const n of FS.readdir(dir)) {
        if (n === '.' || n === '..') continue;
        const p = `${dir}/${n}`, s = FS.stat(p);
        if (FS.isDir(s.mode)) walk(p); else out.push(`${p}:${+s.mtime}:${s.size}`);
      }
    };
    walk('/save');
    return out.join('|');
  };
  let last = stamp(), busy = false;
  const persist = () => {
    if (busy) return;
    const now = stamp();
    if (now === last) return;
    busy = true;
    FS.syncfs(false, e => { busy = false; if (e) console.error('Kayıt yazılamadı', e); else last = now; });
  };
  setInterval(persist, 1000);
  addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
  addEventListener('pagehide', persist);
}

async function boot() {
  const t0 = performance.now();
  say('Yükleniyor…', 'Loading…');
  const { dotnet } = await import('./_framework/dotnet.js');
  const [zip, runtime] = await Promise.all([download('assets.zip'), dotnet.withModuleConfig({ canvas }).create()]);
  runtime.Module.FS_createDataFile('/', 'assets.zip', zip, true, true, true);   // WebMain.Main açar
  await mountSaves(runtime.Module.FS);
  runtime.setModuleImports('elaria-net', net.forGame);   // C#: ElariaWeb/WebNet.cs
  const name = runtime.getConfig().mainAssemblyName;
  const exports = await runtime.getAssemblyExports(name);
  const loaded = Math.round(performance.now() - t0);

  say('Hazır.', 'Ready.');
  document.body.classList.add('ready');
  $('start').focus();
  await new Promise(go => $('start').addEventListener('click', go, { once: true }));
  document.body.classList.remove('ready');
  say('Dünya kuruluyor…', 'Building the world…');
  await new Promise(r => setTimeout(r, 50));   // yazı ekrana çıksın: Game.Start birkaç saniye sayfayı tutar

  const s0 = performance.now();
  await runtime.runMain(name, [lang]);   // Game.Start: pencere, ses, veriler, açılış sahnesi
  net.connect();
  document.body.classList.add('playing');
  canvas.focus();

  // Sınama ve ölçüm (sayfadan): frameMs() Frame çağrısının ortalaması (C# + raylib, GPU hariç); step(n) n kareyi art arda
  // çalıştırır (sayfa görünmezken de) ve kare başına ms döner; scene() üstteki sahne; mouse() oyunun gördüğü fare.
  // İki kişilik oyun: testWorld(ad) yeni karakterle dünyaya girer, net() oturum durumu, netJoin(id) katılma isteği,
  // netLeave() ayrıl, players() lobideki oyuncular.
  const W = exports.WebMain;
  let cost = 0, count = 0;
  window.elaria = { loaded, started: Math.round(performance.now() - s0), fps: () => W.Fps(), scene: () => W.Scene(), mouse: () => W.Mouse(),
    frameMs: () => (count ? cost / count : 0), reset() { cost = count = 0; },
    step(n) { const s = performance.now(); for (let i = 0; i < n; i++) { W.Frame(); net.flush(); } return (performance.now() - s) / n; },
    saves: () => runtime.Module.FS.readdir('/save').filter(n => n[0] !== '.'),
    testWorld: n => W.TestWorld(n), net: () => W.NetState(), netJoin: id => W.NetJoin(id), netLeave: () => W.NetLeave(),
    players: () => net.forGame.players() };
  const frame = () => {
    const s = performance.now();
    let alive;
    try { alive = W.Frame(); net.flush(); } catch (e) { fail(e, 'Oyun durdu', 'The game stopped'); return; }
    cost += performance.now() - s;
    count++;
    if (alive) requestAnimationFrame(frame);
    else { document.body.className = 'ended'; say('Oyun kapandı. Kayıtların bu tarayıcıda duruyor.', 'The game has closed. Your saves stay in this browser.'); }
  };
  requestAnimationFrame(frame);
}

if (noPlay) document.body.classList.add('no-play');
else boot().catch(e => fail(e, 'Oyun açılamadı', 'The game failed to start'));

function fail(e, t, en) {
  document.body.className = 'failed';
  say(`${t}: ${e}`, `${en}: ${e}`);
  window.elaria = { ...window.elaria, error: String((e && e.stack) || e) };
  console.error(e);
}
