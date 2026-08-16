import type { Server } from 'colyseus';
import { ShelemRoom } from './rooms/ShelemRoom.js';
import { HokmRoom } from './rooms/HokmRoom.js';

/**
 * Which games this server hosts. Colyseus's room registry is the game registry —
 * a new game is a `define` here and nothing else, which is what keeps the
 * multi-game boundary from needing a framework of its own.
 *
 * Split out of index.ts so the tests can boot the same set of rooms the real
 * server runs, rather than a hand-maintained copy that drifts from it.
 */
export const gameRooms = {
  initializeGameServer(gameServer: Server) {
    gameServer.define('shelem', ShelemRoom);
    gameServer.define('hokm', HokmRoom);
  },
};

export default gameRooms;
