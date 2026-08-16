# Hokm — Game Rules

The authoritative ruleset for Hokm (حکم), as clarified with the domain owner — the same way [Shelem's rules](game-rules.md) were. It was drafted from the sources listed at the bottom, which disagree with each other in places; where they did, the owner's ruling settled it (see [Settled by the domain owner](#settled-by-the-domain-owner)).

## Setup

- 4 players, 2 partnerships — partners sit opposite each other.
- Standard 52-card deck, no jokers.
- Card ranking A-K-Q-J-10-9-8-7-6-5-4-3-2 (high to low), the same in every suit including trump. Identical to Shelem's.
- Each player is dealt 13 cards, in packets of **5, then 4, then 4**.

### Play direction

Hokm is played counter-clockwise. This needs nothing from the engine: seat indices are abstract, and the client maps them to screen positions (`screenSlotFor`), so `(seat + 1) % 4` simply *is* the direction of play. It's a rendering convention, not a rule the server enforces.

## The Hâkem

One player is the **Hâkem** (حاکم, "ruler") and holds three privileges:

1. They are dealt to first.
2. They **declare trump**.
3. They lead to the first trick.

### Finding the first Hâkem

Traditionally, cards are dealt **face up** around the table until an **Ace** appears; whoever receives it is Hâkem. How far that goes — and whether it also decides the partnerships — is a [table setting](#table-configuration):

| Setting | Hâkem | Partnerships |
| --- | --- | --- |
| `aceDealTeams` | first Ace | the second Ace finds their partner, who then **moves to sit opposite the Hâkem** — the cards decide the teams |
| `aceDealSeats` *(default)* | first Ace | fixed by seat, opposite players |
| `random` | drawn silently, no ceremony | fixed by seat |

The cards turned face up are **not** removed from play. At a real table they go straight back in, and the deck is shuffled again before the hand is dealt.

Once the Hâkem's Ace lands they are **out of the draw** — the search for the partner deals only to the other three, exactly as it does at a table.

Partners sit opposite each other, so on `aceDealTeams` the partner and whoever was sitting opposite the Hâkem trade places once both Aces are out. The Hâkem keeps their chair. This is why the mode is not the default: it overrides the seating players deliberately arranged in the lobby.

### Declaring trump

All four players are dealt their opening five, and *then* the Hâkem names trump — **on those five cards alone**, before the remaining eight go out to anyone. This is the game's central decision and the whole reason the deal is split in two: the other eight cards do not exist yet, for the Hâkem or for anyone else. The other three sit holding five cards of their own while it happens.

The Hâkem may name any of the four suits. There is no no-trump option (see [Deliberately not implemented](#deliberately-not-implemented)).

### Succession

If the Hâkem's team **wins** the hand, they keep the role for the next one. If they lose, it passes to the next seat. This is the only thing in Hokm that carries between hands, and it's what makes a strong hand worth more than the point it scores.

## Play

- Standard follow-suit obligation: a player must follow the suit led if able.
- If void in the led suit, any card is legal — trump included, but not mandatory.
- The highest trump wins the trick; if no trump was played, the highest card of the led suit wins.
- The winner of a trick leads to the next.

These are exactly Shelem's rules of play, and share the same implementation (`determineTrickWinner` and `legalCards` in `packages/shared/src/core/trick.ts`).

## Scoring

A hand is decided on **tricks**, not card points. There are no card values in Hokm at all.

The first team to take **7 tricks** wins the hand. The remaining six are never played — the hand is already decided and nothing in the scoring depends on them. A Kot is the **first seven** tricks, not all thirteen.

| Outcome | Points |
| --- | --- |
| Hand won, losers took at least one trick | **1** |
| **Kot** (کت) — the Hâkem's team took the first 7, opponents none | **2** |
| **Hâkem Koti** (حاکم کتی) — the *opponents* swept the Hâkem 7–0 | **3** |

Only the winning side scores; there is nothing to collect for coming second. This is the sharpest difference from Shelem, where defenders always bank whatever they collected.

A single trick to the losers turns the dearest result on the table into the cheapest — which is why the test is the losers' count and nothing else. Note also that reaching 7 with the opponents on 0 can *only* mean taking the first 7 in a row, so "shut out" and "the first seven tricks" are the same event; the engine doesn't need to track when each trick fell.

**Match**: the first team to reach the target score — **7 points** by default — wins.

## Table configuration

Everything above describes the default ruleset. As with Shelem, the person creating the table chooses these on the create-table screen before the room exists; they are then **fixed for the whole match** and shown read-only to everyone at the table.

| Option | Default | Allowed |
| --- | --- | --- |
| Target score | 7 | Whole number, 1–100 |
| A won hand scores | 1 | Whole number, 1–100 |
| Kot scores | 2 | Whole number, 1–100, and never below a won hand |
| Hâkem Koti scores | 3 | Whole number, 1–100, and never below a Kot |
| Choosing the Hâkem | Ace (`aceDealSeats`) | `aceDealTeams` / `aceDealSeats` / `random` |
| Shuffle | Random | Random (fresh deck every hand) or Table (light shuffle carrying the previous hand forward) |
| Turn limit | 30s | Off, or 5–120 seconds |

**Turn limit** — a player who doesn't act in time has the turn played for them by the bot, so the table keeps moving. Naming trump gets twice the limit, plus an allowance for the deal animation. The clock runs for a disconnected player too, which is the main reason it exists. Bots are exempt: they answer on their own schedule, so a clock over their seat would measure nothing.

Two of these are worth explaining:

- **The ladder must climb.** A Kot is a won hand with the opponents shut out, and a Hâkem Koti is that same sweep against the player who chose trump — each strictly harder than the last. A table that priced them the other way round would be paying more for the lesser result, so the validator refuses it. Pricing them all *equal* is allowed: that's a table that simply doesn't reward sweeps.
- **Shuffle defaults to Random here, unlike Shelem.** Shelem's light shuffle exists to keep suits grouped so a trump-length bid stays reachable — see [the reasoning there](game-rules.md#shuffling--deliberately-light). Hokm has no auction, so that justification doesn't carry over. It stays available because a long suit still helps a Hâkem choose.

## Settled by the domain owner

Two points the sources genuinely disagreed on. Both are now decided, and both confirmed what was already implemented:

1. **All four players receive their opening five before the Hâkem declares.** Some descriptions read as though only the Hâkem is dealt to first, with the other three still empty-handed at the moment trump is called. They are not: everyone is looking at five cards while the Hâkem chooses. This is also what the 5-4-4 packet deal implies, and what shipping Hokm apps do.
2. **A Kot is the first seven tricks, not all thirteen.** Some groups require sweeping all thirteen for the bonus. This table does not — seven to nil is a Kot, and the remaining six tricks are never played. Not offered as a table option either, since it isn't a rule this group varies.

## Deliberately not implemented

Discussed and left out of this version, not overlooked:

- **Saras / Naras / Tak-Naras** (سرس / ناراس / تک‌ناراس) — no-trump modes the Hâkem may declare instead of a suit. Saras is no-trump with normal ranking and no Kot; Naras reverses the ranking so the 2 is highest; Tak-Naras is Naras with the Ace restored to the top. Genuinely played, and cheap to add — they're a comparator swap on the existing trick engine.
- **Bâm** (بام) — a team that has already secured 7 tricks electing to play on for all 13, for a top scoring tier.
- **Trump must be broken** before it can be led. Traditional; most modern tables drop it.
- **2-, 3-, 5- and 6-player Hokm.** All exist; all break the fixed four-seat partnership model the platform is built on.

## Sources

- [Pagat — Hokm](https://www.pagat.com/whist/hokm.html)
- [Ali Jahanshiri — How to Play Hokm](https://www.jahanshiri.ir/cardgames/en/hokm)
- [gamerules.com — Hokm](https://gamerules.com/rules/hokm/)
- [ویکی‌پدیا — حکم (بازی)](https://fa.wikipedia.org/wiki/%D8%AD%DA%A9%D9%85_\(%D8%A8%D8%A7%D8%B2%DB%8C\))
- [Boresh — قوانین بازی حکم](https://www.boresh.ca/hokmrules/)
- [بازیکوش — سرس و نرس در حکم](https://bazikoosh.com/sarasnaras/)
