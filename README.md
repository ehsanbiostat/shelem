# Shelem

A web platform for playing Shelem — the four-player, partnership trick-taking card game popular in Iran — built with the visual polish and UX structure of [Trickster Cards](https://www.trickstercards.com/game/) as a reference, using original art and branding.

Shelem is the first game on the platform. The long-term plan is a multi-game portal (Trickster-style), but v1 is scoped to Shelem only.

## Status

Early build. The game engine (bidding, widow/trump, trick-taking, scoring) is implemented and tested end-to-end against a real Colyseus server. The frontend is a bare-bones connectivity scaffold only — final visual design is still undecided. See [docs/](docs/) for the full product scope, game rules, and architecture decisions.

## Docs

- [Game Rules](docs/game-rules.md) — the exact Shelem ruleset this platform implements
- [Product Scope](docs/product-scope.md) — what's in and out of v1
- [Architecture](docs/architecture.md) — tech stack and technical decisions
- [Roadmap](docs/roadmap.md) — deferred features planned for later versions

## Development

Monorepo with npm workspaces: `packages/shared` (game types + pure rules logic), `packages/server` (Colyseus room), `packages/client` (React scaffold).

```
npm install              # install everything
npm test                 # run the shared package's unit tests
npm run dev:server        # start the Colyseus server (ws://localhost:2567)
npm run dev:client        # start the Vite dev server (http://localhost:5173)
```
