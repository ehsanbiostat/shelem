import { createServer } from 'http';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { gameRooms } from './app.config.js';

const port = Number(process.env.PORT ?? 2567);
// Explicit — Node's default (no host passed) doesn't reliably bind an IPv4
// listener on Render's containers, so its port-scanner never sees the app come
// up on 0.0.0.0 even though the process itself is running.
const host = '0.0.0.0';
// @colyseus/ws-transport only ever attaches an `upgrade` listener to this server
// (for the WebSocket handshake) — it never adds a plain `request` handler. With
// none registered, Node just leaves ordinary HTTP requests hanging with no
// response at all, which is indistinguishable from "closed" to Render's port
// scanner even though the socket is genuinely listening. This has to answer
// those requests for the scanner (and any uptime/health checks) to see the
// service as up; it doesn't affect WS traffic, which is a separate event.
const httpServer = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Shelem server is running.');
});

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameRooms.initializeGameServer(gameServer);

gameServer.listen(port, host);
console.log(`Shelem server listening on ws://${host}:${port}`);
