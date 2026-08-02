# Roadmap — deferred to later versions

Everything below was explicitly discussed and deliberately deferred, not overlooked. Captured here so it doesn't get lost or re-litigated from scratch later.

## v2 candidates

- **In-app communication** — text chat, emoji reactions, and especially **video chat** (the single most-requested deferred feature; Trickster's video chat was called out specifically as something to add next).
- **Persistence layer** — move game/match state off in-memory-only storage (e.g. Redis or Postgres) so matches survive server restarts/deploys.
- **User accounts** — signup/login, persistent profiles, stats history. Needed as a prerequisite for ranked play, friends lists, or clubs.
- **Bots** — AI players to fill empty seats. Requires real Shelem-playing logic (bidding strategy, widow/discard strategy, trick-taking play) — a substantial standalone project, not a small add-on.
- **Matchmaking / quick match** — public queue for random opponents, likely paired with bot fill-in for partially-full tables. Depends on bots and/or a larger userbase existing first.
- **Ranked play / ELO / leaderboards** — depends on accounts.
- **Native mobile apps** — likely as a wrapper around the web app (e.g. Capacitor) rather than a rewrite, once the web product is proven.

## Longer-term

- **Multi-game portal** — additional games beyond Shelem, Trickster-style. The v1 architecture (Colyseus rooms, monorepo, shared types) is deliberately structured so this doesn't require a rewrite, but no generic multi-game framework is being built ahead of need.
- **Monetization** — deliberately unsolved for now given the Iran-sanctions payment-processor problem. Revisit once there's an actual userbase and a clearer picture of who's playing (diaspora vs. Iran-based) and what payment rails are viable.
- **Localization (Persian/RTL)** — v1 is English-only by explicit choice, not oversight. Revisit if/when it matters for the actual userbase.
