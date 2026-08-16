# Product Scope — v1

Decisions made during initial project grilling. Anything not listed here as in-scope is explicitly deferred — see [Roadmap](roadmap.md).

## Vision

Replicate the setup, feel, and front-end quality of [Trickster Cards](https://www.trickstercards.com/game/) for Persian card games. This means matching their **UX structure and polish** (oval table, fanned hand, bidding UI, smooth deal/trick animations, responsive layout) — not copying their actual visual assets, branding, or card designs, which would be a copyright/trademark risk. Original art and branding.

## Platform

- **Two games**: Shelem and [Hokm](game-rules-hokm.md), under one portal named **Pasoor** (پاسور — the Persian word for a deck of playing cards). The landing page is a game picker; a table code is enough to join either, since the room itself says which game is being played.
- v1 shipped Shelem alone, and the `Game`/room boundary the roadmap called for was drawn when Hokm was added rather than ahead of need — see [Architecture](architecture.md#the-game-boundary). A third game is a `define` and a folder, not a rewrite.
- **Web-only**, responsive for both desktop/laptop and mobile browsers. No native iOS/Android apps in v1 (can wrap the web app later, e.g. with Capacitor, once the core product is proven).

## Identity & accounts

- **Guest-only**. No signup, no login, no password/email/OAuth. A player enters a display name when joining a table.
- Identity persists via a browser-stored session token (e.g. localStorage) so a page refresh doesn't drop them from their seat.
- No user accounts, profiles, or stats history in v1.

## Matchmaking & tables

- **Private tables only**. No public matchmaking queue, no ranked/ELO play, no clubs.
- Host creates a table and receives a shareable link/code; the host also takes one of the 4 seats.
- Players self-select their seat on joining (first-come, first-seated). Before the game starts, a player can send another player a request to swap seats; the swap happens if accepted.
- **Bots may fill empty seats**, 1–3 of them, so a table can start with as few as one person — and so one person can practise alone. The host seats them in the lobby, and a person arriving late takes a bot's chair. Hokm only for now; see [Bots](bots.md). A dropped player is still *waited for* rather than replaced by a bot.
- The table's rules are chosen by the creator on a create-table screen before the room exists, then fixed for the whole match. Each game has its own set — see [Shelem's](game-rules.md#table-configuration) and [Hokm's](game-rules-hokm.md#table-configuration) for the full lists and bounds. They're shown read-only to everyone at the table, not just the host, so all four players know what they've joined before the first deal. A rematch draws a new host and returns them to the same screen.

## Disconnect handling

- If a player disconnects or refreshes, they auto-rejoin their same seat via their stored session token.
- If it's their turn and they're disconnected, the game simply waits — no turn timer, no auto-play/auto-pass, no auto-kick in v1.

## Localization

- **English-only** UI, left-to-right layout. No Persian/RTL support in v1 (deliberately — this was a specific choice despite the target audience, not an oversight).

## Monetization

- **None.** Free to play, no payment integration, no subscriptions, no ads. This also sidesteps the fact that standard payment processors (Stripe, PayPal, App/Play Store IAP) don't operate in Iran due to sanctions — not a problem worth solving until there's an actual userbase to monetize.

## In-app communication

- **None in v1** — no text chat, no emoji reactions, no video chat. Players are assumed to already have their own communication channel (phone call, Discord, in person) when playing with friends via a private table link.
- This is the clearest v2 candidate — see [Roadmap](roadmap.md).

## Anti-cheat / hidden information

- The server must be authoritative: no player's client should ever receive another player's hand, or the buried widow/discard cards, before they're legitimately revealed. This is a hard requirement driving the backend architecture choice (see [Architecture](architecture.md)).
