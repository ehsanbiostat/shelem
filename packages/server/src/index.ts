import { createServer } from 'http';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { ShelemRoom } from './rooms/ShelemRoom.js';

const port = Number(process.env.PORT ?? 2567);
const httpServer = createServer();

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define('shelem', ShelemRoom);

gameServer.listen(port);
console.log(`Shelem server listening on ws://localhost:${port}`);
