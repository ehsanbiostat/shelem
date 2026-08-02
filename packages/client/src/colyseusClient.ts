import { Client } from 'colyseus.js';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'ws://localhost:2567';

export const colyseusClient = new Client(SERVER_URL);
