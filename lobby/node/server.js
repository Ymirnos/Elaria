// Elaria lobisi, Node sürümü (Render'ın ücretsiz sunucusu): Cloudflare'deki src/room.js'in yaptığını yapar. Her WebSocket
// bir oyuncu; kurallar aynı src/lobby.js'te. Durum bellekte (tek süreç). Bazı Türk ev bağlantıları *.workers.dev'i
// engellediği için lobi burada (onrender.com açılıyor). Yerel: node node/server.js → ws://127.0.0.1:8787/ws
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { Lobby } from "../src/lobby.js";

const PORT = Number(process.env.PORT) || 8787;   // Render kapıyı PORT ile verir
const lobby = new Lobby();

// Düz istek: Render'ın sağlık denetimi ve meraklılar için kısa yazı
const server = createServer((req, res) => {
  res.writeHead(req.url === "/" ? 200 : 404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Elaria lobi sunucusu. Bağlantı: /ws (WebSocket)");
});

// 1 MB'tan büyük çerçeve bağlantıyı kapatır (ws maxPayload); oyun büyük iletileri net.js'te 32 KB'lık parçalara böler
const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 1 << 20 });
wss.on("connection", ws => {
  ws.alive = true;
  ws.on("pong", () => { ws.alive = true; });
  const id = lobby.join(m => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m)); });
  ws.on("message", (data, binary) => {
    if (binary) return;
    let m;
    try { m = JSON.parse(data.toString()); } catch { return; }
    lobby.message(id, m);
  });
  ws.on("close", () => lobby.leave(id));
  ws.on("error", () => lobby.leave(id));
});

// Cevapsız istekler 30 sn'de düşer; 30 sn'de bir yoklama: ölü bağlantılar kapanır, aradaki vekil sunucular boşta
// diye bağlantıyı kesmez
setInterval(() => lobby.tick(), 5000);
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false;
    ws.ping();
  }
}, 30000);

server.listen(PORT, () => console.log(`Elaria lobi: ${PORT}`));
