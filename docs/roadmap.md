# Roadmap — deferred to later versions

Everything below was explicitly discussed and deliberately deferred, not overlooked. Captured here so it doesn't get lost or re-litigated from scratch later.

## v2 candidates

- **In-app communication** — text chat, emoji reactions, and especially **video chat** (the single most-requested deferred feature; Trickster's video chat was called out specifically as something to add next).
- **Persistence layer** — move game/match state off in-memory-only storage (e.g. Redis or Postgres) so matches survive server restarts/deploys.
- **User accounts** — signup/login, persistent profiles, stats history. Needed as a prerequisite for ranked play, friends lists, or clubs.
- **Shelem bots** — Hokm has them (see [Bots](bots.md)); Shelem does not. Roughly 4–5× the work, and the risk is bidding rather than card play: a bot that bids 160 and collapses ruins the hand for its *human partner*. It also needs the widow discard, where buried cards still score for the declaring team, and the opening lead that sets trump.
- **Matchmaking / quick match** — public queue for random opponents, likely paired with bot fill-in for partially-full tables. Depends on bots and/or a larger userbase existing first.
- **Ranked play / ELO / leaderboards** — depends on accounts.
- **Native mobile apps** — likely as a wrapper around the web app (e.g. Capacitor) rather than a rewrite, once the web product is proven.

## Done since v1

- **Multi-game portal** — the platform is now Pasoor, with Shelem and [Hokm](game-rules-hokm.md). The boundary was drawn when the second game arrived rather than ahead of need, exactly as planned: `BaseTableRoom` owns the table, each game owns its rules. See [Architecture](architecture.md#the-game-boundary).

## Longer-term

- **More games** — a third is a `gameServer.define`, a rules folder under `packages/shared/src/`, a room, and a board. No framework work.
- **Hokm's no-trump modes** — Saras / Naras / Tak-Naras, deliberately deferred; they're a comparator swap on the existing trick engine. See [Deliberately not implemented](game-rules-hokm.md#deliberately-not-implemented).
- **Monetization** — deliberately unsolved for now given the Iran-sanctions payment-processor problem. Revisit once there's an actual userbase and a clearer picture of who's playing (diaspora vs. Iran-based) and what payment rails are viable.
- **Localization (Persian/RTL)** — v1 is English-only by explicit choice, not oversight. Revisit if/when it matters for the actual userbase.
