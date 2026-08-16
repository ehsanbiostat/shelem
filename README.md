# Pasoor

A web platform for playing Persian card games — built with the visual polish and UX structure of [Trickster Cards](https://www.trickstercards.com/game/) as a reference, using original art and branding.

*Pasoor* (پاسور) is the Persian word for a deck of playing cards.

Two games so far:

- **[Shelem](docs/game-rules.md)** — four players in partnerships, bidding for the widow and playing for card points.
- **[Hokm](docs/game-rules-hokm.md)** — four players in partnerships, where the Hâkem names trump on their first five cards and the hand is won on seven tricks.

## Status

Early build. Both game engines (Shelem's bidding/widow/scoring, Hokm's Hâkem draw/trump/trick counting) are implemented and tested against a real Colyseus server. The frontend is functional but its final visual design is still undecided. See [docs/](docs/) for the full product scope, game rules, and architecture decisions.

## Docs

- [Shelem Rules](docs/game-rules.md) — the exact Shelem ruleset this platform implements
- [Hokm Rules](docs/game-rules-hokm.md) — the same for Hokm
- [Product Scope](docs/product-scope.md) — what's in and out
- [Architecture](docs/architecture.md) — tech stack, technical decisions, and the game/table boundary
- [Roadmap](docs/roadmap.md) — deferred features planned for later versions

## Development

Monorepo with npm workspaces: `packages/shared` (game types + pure rules logic, split into `core/` and one namespace per game), `packages/server` (Colyseus rooms), `packages/client` (React).

```
npm install              # install everything
npm test                 # shared rules unit tests + server room tests
npm run dev:server       # start the Colyseus server (ws://localhost:2567)
npm run dev:client       # start the Vite dev server (http://localhost:5173)
```

Adding a game means a rules folder under `packages/shared/src/`, a room extending `BaseTableRoom`, a board under `packages/client/src/games/`, and one line in `packages/server/src/app.config.ts`.
