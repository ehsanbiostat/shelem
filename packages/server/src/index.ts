import { createServer } from 'http';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { ShelemRoom } from './rooms/ShelemRoom.js';

const port = Number(process.env.PORT ?? 2567);
// Explicit — Node's default (no host passed) doesn't reliably bind an IPv4
// listener on Render's containers, so its port-scanner never sees the app come
// up on 0.0.0.0 even though the process itself is running.
const host = '0.0.0.0';
const httpServer = createServer();

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define('shelem', ShelemRoom);

gameServer.listen(port, host);
console.log(`Shelem server listening on ws://${host}:${port}`);
