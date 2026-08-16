# Bots

A table needs four players. Bots let it start with as few as one, and let a single person practise alone. The host seats **1–3** of them in the lobby; a person arriving late takes a bot's chair.

Currently **Hokm only**. Shelem is deliberately deferred — see [Roadmap](roadmap.md).

Bots do **not** take over for a player who disconnects. That was considered and declined: a dropped player is still waited for, and their seat is held.

## Why they are rule-based, not a search

The strong method for trick-taking games is **Perfect Information Monte Carlo** — sample the opponents' hands, solve each sampled world with perfect information, and vote. It is state-of-the-art for Skat, Bridge and Hearts, and there is theory ([Long & Sturtevant, AAAI 2010](https://webdocs.cs.ualberta.ca/~nathanst/papers/pimc.pdf)) explaining why trick-taking games in particular suit it.

It is also far more than this server can afford. An optimised **C++** double-dummy solve of a single deal takes ~50ms, and PIMC needs ~20 sampled worlds before the returns flatten — so one early-hand move is around a second of C++ CPU, and several times that in JavaScript.

The constraint that settles it: **every Colyseus room shares one Node event loop**, and the server runs on Render's `starter` plan — half a vCPU. A bot thinking synchronously for 200ms would not slow its own table; it would freeze *every* table on the process, multiplied by up to three bots each. Worker threads would move the work off the loop but still contend for the same half-core.

So the bots are about twenty hand-written rules. That is less of a compromise than it sounds: in a published Hearts comparison, a hand-coded agent of roughly that size beat its alternatives outright, taking over half its games. At the strength people actually want to play against, rules are the right tool.

**Measured cost: ~3 microseconds per decision, ~0.14ms for a whole 13-trick hand.** A test in `packages/shared/src/hokm/bot.test.ts` asserts this stays true, so reaching for a search later fails loudly rather than quietly degrading every live table.

## What a bot knows

Exactly what its seat is entitled to: its own cards, the trick in progress, trump, who is partnered with whom, and every card already played. It never sees another hand. The one piece of memory it keeps is **void inference** — a player who failed to follow a suit has none of it, permanently — which costs nothing and sharpens both leading and ruffing.

## How it plays

**Trump** (from the Hâkem's opening five): the best suit by `length × 2 + honours`, so length beats a scattered honour. On five cards there is very little a search could add.

**Leading**: draw trumps while long in them and opponents still hold some; otherwise cash a side suit it holds the top card of, but never into a known void; otherwise lead low from its longest side suit.

**Following**: duck when its partner is already winning; otherwise win with the *cheapest* card that does; when void, ruff only if an opponent is taking the trick, and otherwise discard from its weakest suit.

## How it is wired in

- `packages/shared/src/hokm/bot.ts` — pure functions, no I/O, no clock, no state. Deterministic and unit-tested like the rest of the rules.
- `BaseTableRoom` owns the seating (`isOccupied`, `addBot`/`removeBot`) and the driver (`scheduleBotTurn`), because none of that is game-specific.
- `HokmRoom.takeBotTurn` dispatches by phase and feeds the result through **the same handlers a person's message reaches**. A bot cannot make a move a person could not, because the validation is the same code rather than a copy of it.

A bot is never on the clock — the turn timer covers people, and a bot answers on its own schedule anyway. When a *person's* clock runs out in Hokm, the bot plays that turn for them properly; Shelem, having no bot, falls back to safe legal defaults instead (see its [rules](game-rules.md#the-turn-clock)).

Bots pause 500–1400ms before acting. That is pacing, not computation — a bot that answered instantly would read as wrong, and the room already holds a finished trick for 1500ms.

They are named `Bot 1`–`Bot 3` and flagged as bots in synced state. Nobody should ever be unsure whether they are playing a person.
