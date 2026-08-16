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
}

export const GAMES: GameEntry[] = [
  {
    id: 'shelem',
    name: 'Shelem',
    blurb: 'Bid for the widow, then take the points',
    glyphs: '♠ ♥',
    path: '/shelem/new',
    configKey: 'shelem:tableConfig',
  },
  {
    id: 'hokm',
    name: 'Hokm',
    blurb: 'The Hâkem names trump from five cards',
    glyphs: '♦ ♣',
    path: '/hokm/new',
    configKey: 'hokm:tableConfig',
  },
];

export function gameById(id: string): GameEntry | undefined {
  return GAMES.find((g) => g.id === id);
}
