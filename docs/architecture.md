# Architecture

Technical decisions for v1, made against the constraints in [Product Scope](product-scope.md) — most importantly: authoritative server (hidden information), no accounts, single game for now but a future multi-game roadmap.

## Backend: Colyseus

[Colyseus](https://colyseus.io/) — an open-source Node.js/TypeScript multiplayer game-server framework — over a bespoke WebSocket server.

Why: it's built around exactly this domain — authoritative "rooms" holding server-side game state, per-client filtered state (so hidden cards never reach the wrong client), and built-in reconnection support (matches the "auto-rejoin same seat" product decision). Each future game becomes a new Room class, which fits the multi-game roadmap without requiring a bespoke framework to be built in-house.

## Frontend: React + TypeScript + Framer Motion

React + TypeScript, using Colyseus's official JS client SDK (integrates cleanly with React state, and shares types with the backend in the monorepo). Framer Motion (or an equivalent animation library) for the card dealing/trick-taking animations needed to hit Trickster-level polish.

## Persistence: in-memory for v1

Colyseus rooms hold game state in server memory. No database in v1 — simplest possible setup, nothing to provision or maintain. Tradeoff: an in-progress match is lost if the server restarts (e.g. during a deploy). Acceptable at v1 scale (private tables, no accounts, no stats to lose). **Explicitly planned to move to a real persistence layer (e.g. Redis or Postgres) in v2** so matches survive restarts.

## Repo structure: monorepo

Single repository containing both the frontend and backend as workspaces/packages, sharing TypeScript types for game state and protocol messages between client and server. Chosen to avoid type drift between the two halves of the same game protocol.

## Hosting

No hard hosting requirement was identified for reaching players in Iran specifically — network accessibility from Iran shifts over time by provider, and the product owner doesn't have a fixed constraint here. Default assumption: pick a solid mainstream host suited to a Node/Colyseus (persistent WebSocket connections) + React app, and assume players will use a VPN if needed, same as they already do for other services. Specific provider to be chosen at implementation time.

## Anti-cheat

Server is the single source of truth for game state. Each client only ever receives the subset of state it's allowed to see (own hand, public trick state, revealed trump) — never other players' hands or the buried widow/discard cards before they're legitimately revealed. This is the primary reason a purely client-side or peer-to-peer architecture was ruled out.
