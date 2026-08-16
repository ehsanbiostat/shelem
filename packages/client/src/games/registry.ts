/**
 * The games on the platform, as the front end needs to know them: the room name to
 * ask Colyseus for, what to call it, and where its create-table screen lives.
 *
 * Everything else about a game — its rules, its board, its settings form — is
 * behind its own folder under games/. This is only the shelf they sit on.
 */
export interface GameEntry {
  /** Matches the name the server registered in app.config.ts. */
  id: 'shelem' | 'hokm';
  name: string;
  /** One line on the tile: what playing it is actually like. */
  blurb: string;
  /** The suits drawn on the tile. Placeholder art until there is real artwork. */
  glyphs: string;
  path: string;
  /** localStorage key holding the last rules a table of this game was created with. */
  configKey: string;
  /** Whether this game can actually play a bot's turn. The server refuses a bot at
   * a game without one (see BaseTableRoom.botsSupported); this keeps the button
   * from being offered in the first place. */
  supportsBots: boolean;
}

export const GAMES: GameEntry[] = [
  {
    id: 'shelem',
    name: 'Shelem',
    blurb: 'Bid for the widow, then take the points',
    glyphs: '♠ ♥',
    path: '/shelem/new',
    configKey: 'shelem:tableConfig',
    supportsBots: false,
  },
  {
    id: 'hokm',
    name: 'Hokm',
    blurb: 'The Hâkem names trump from five cards',
    glyphs: '♦ ♣',
    path: '/hokm/new',
    configKey: 'hokm:tableConfig',
    supportsBots: true,
  },
];

export function gameById(id: string): GameEntry | undefined {
  return GAMES.find((g) => g.id === id);
}
