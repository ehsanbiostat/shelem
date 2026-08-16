# Shelem — Game Rules

The authoritative ruleset for Shelem, as clarified with the domain owner (differs in places from generic web summaries of "Shelem," which turned out to be imprecise). The platform's other game has its own ruleset — see [Hokm](game-rules-hokm.md).

## Setup

- 4 players, 2 fixed partnerships — partners sit opposite each other.
- Standard 52-card deck.
- Each player is dealt 12 cards as **one unbroken block**, not one card at a time: the dealer gives 12 straight off the top to the player on their left, then 12 to the next, then 12 to the next, then deals 4 for the widow, and takes the last 12 themselves.
- Those 4 cards form a face-down **widow**.
- Dealer rotates clockwise each hand. The first bidder each hand is whoever receives cards first in that deal (same seat-relative-to-dealer every time).

## Shuffling — deliberately light

The deck is **not** fully randomised between hands, and this is a rule, not an oversight. It reproduces how the game is actually played in person, and the game is balanced around it.

- The cards carry over from the previous hand. Each team stacks the tricks it wins in the order it won them, cards in the order they were played; the declarer's 4 buried cards sit under their team's pile. At the end of the hand the two piles are squared together into one deck.
- That deck gets **2 riffle shuffles and one cut** — a normal table shuffle, not a thorough randomisation.
- The first hand of a match has no previous hand to inherit, so it starts from a fully randomised deck.
- On a redeal (three consecutive passes — see [Bidding](#bidding)), the hands and widow are gathered back up and dealt again, rather than a fresh deck being introduced.

**Why it matters.** A trick is mostly cards of one suit, so a played-out deck comes back with the suits grouped. A light shuffle leaves that grouping partly intact, and because the deal hands out contiguous 12-card blocks, a run of same-suit cards lands in one player's hand instead of being split one card per seat. The result is longer suits, which is what makes a trump-length bid reachable — the whole point of bidding a suit you're long in. Shuffling thoroughly, or dealing one card at a time, erases the effect completely and flattens every hand toward 4-3-3-2.

Measured over 40,000 chained hands, against a fully randomised deal:

| | light shuffle (2 riffles) | full shuffle |
|---|---|---|
| average longest suit | 5.0 | 4.6 |
| hands with a 6+ card suit | 27% | 13% |
| hands with a void | 18% | 8% |
| declarer's trump length | 6.0 | 5.4 |

**Fairness.** The cut point is uniform across the whole deck rather than near the middle, the way a person cuts. This matters: the deal hands out fixed contiguous blocks, so a middle-ish cut shifts the deck by roughly two seats and merely moves any advantage to a different player instead of removing it. Simulation showed a persistent ~6.5 point-per-hand gap between seats surviving any number of human-style cuts; one uniform cut flattens it to ~0.1, and further cuts change nothing. No seat gains an edge from the light shuffle.

## Bidding

- Bidding starts with the first-to-receive-cards player (see above) and proceeds around the table.
- A bid must be a **multiple of 5**, and must exceed the current highest bid by **at least 5** — but a player may raise by more than the minimum in one go (e.g. jump from 100 straight to 130).
- The minimum possible bid is **100**. The opening bidder is not required to open at exactly 100 — they may open at 100, 105, 110, ... up to 160, or jump straight to Shelem/Sar-Shelem.
- Plain numeric bidding **caps at 160**. There is no numeric bid of 165 — claiming all 165 points can only be done via the Shelem/Sar-Shelem tiers below.
- A player who passes is out of the bidding for that hand and cannot re-enter.
- Bidding continues in rounds until either one bidder remains (all others have passed) or the current highest bidder is the only one left.
- If **three players pass in a row without any bid being made**, the hand is **redealt** — the fourth seat does not get a turn. Note the consequence: when the other three pass, the dealer never gets to declare.
- Three passes only kill the hand while the auction is still unopened. Once someone has bid, the other three passing simply settles the auction in the bidder's favour (see above).

### Bid ladder

| Tier | Requirement | Success | Failure |
|---|---|---|---|
| Numeric (100–160, multiples of 5) | Collect ≥ bid points | Score exactly the bid amount (excess doesn't matter) | Lose exactly the bid amount |
| Shelem | Collect **all 165 points** | +330 | −330 |
| Sar-Shelem | Collect **all 165 points**, without the widow exchange | +330 | −330 |

### Double negative

A declaring team that fails **and collects fewer than 85 points** loses **double** the failure amount above. 85 is just over half the 165 points in a hand, so the rule bites on a hand badly misjudged rather than one narrowly missed: fall short of the bid and it costs the bid; fail to take even half the points on the table and it costs twice.

- Applies at **every tier** — a failed Shelem under 85 is −330, a failed Sar-Shelem −660.
- The 85 is the declaring team's **total** for the hand, which includes the four cards they buried at the widow (those are their first trick, points included — see [Widow and trump](#widow-and-trump)).
- **Defenders are unaffected.** The extra penalty is a penalty, not a transfer; nobody receives it.
- It can never apply to a made contract: making a numeric bid needs at least 100 points and a Shelem needs all 165, both above the threshold.

Shelem and Sar-Shelem outrank all numeric bids and each other (Sar-Shelem > Shelem), and either can be called at any point in the bidding, skipping over numeric bids entirely.

By default the two are worth **the same**. Sar-Shelem outranks Shelem by being the harder way to claim every point — it is played without the widow exchange — not by paying more. A table can price them apart, and can turn the widow exchange on for Sar-Shelem, in which case it plays exactly like a Shelem; see [Table configuration](#table-configuration).

### Sar-Shelem and the widow

A Sar-Shelem declarer does not take up the widow or choose a discard. The four cards are **shown to them alone**, and then buried as their discard exactly as a chosen one would be — so their points still count for the declaring team, which is what keeps the contract reachable at all. A widow holding an ace would otherwise put all 165 out of reach before a card was played.

The reveal is dismissed by the declarer, not on a timer: it is the only time those cards are ever seen, and the defenders never see them.

## Widow and trump

- The highest bidder (the **declarer**) picks up the 4-card widow (hand becomes 16 cards).
- Declarer discards 4 cards face-down, back down to 12. These 4 discarded cards become the declarer's team's **first trick**, points included.
- Declarer leads to the next trick. **The suit of that opening lead becomes trump** — there is no separate trump declaration.

## Card ranking

A-K-Q-J-10-9-8-7-6-5-4-3-2 (high to low), standard in every suit including trump. No reordering.

## Play

- Standard follow-suit obligation: a player must follow the suit led if able.
- If void in the led suit, any card is legal — trump included, but not mandatory.

## Scoring

- Card points: **Ace = 10, Ten = 10, Five = 5**, all other ranks = 0.
- Plus **5 points per trick** won.
- There are **13 total tricks** per hand: 12 actually played + the 1 buried (widow-discard) trick.
- Total points available per hand: (4×10 + 4×10 + 4×5) + (13×5) = 100 + 65 = **165**.

### Hand outcome

- **Declarer's team**, numeric bid: if they collect ≥ bid points, they score exactly the bid amount; if not, they lose exactly the bid amount — doubled if they collected fewer than 85 (see [Double negative](#double-negative)).
- **Declarer's team**, Shelem/Sar-Shelem: must collect all 165 points to succeed, scoring ±330 (see bid ladder table above) — or −660 where the double-negative rule applies.
- **Defending team**: always scores whatever points they actually collect in tricks, regardless of whether the declarer's team made or failed their bid.

## Match structure

- A match is played as a repeating series of hands (dealer rotates each hand) until one team's cumulative score reaches a **target score**.
- The target score is set by whoever creates the table, on the create-table screen, and is then fixed for the whole match. **Default: 1165.** Any whole number from 165 up is allowed — deliberately not restricted to multiples of 5, since a team simply crosses the target rather than landing on it. The 165 floor is one hand's worth of points, below which a match would be decided by a single deal. Three match lengths are offered as shortcuts: **Quick 330** (a single Shelem), **Mid 660**, and **Standard 1165**.

## Table configuration

Everything above describes the default ruleset. Groups genuinely disagree about a handful of these rules, so the person creating a table chooses them on the create-table screen, before the room exists. They are then **fixed for the whole match** and shown read-only to everyone at the table, so all four players know what they've joined before the first deal.

The one moment they can change is between matches: when all four agree to a rematch, a new host is drawn at random and goes back through the same screen while the other three wait.

| Option | Default | Allowed |
| --- | --- | --- |
| Target score | 1165 | Whole number, 165–100000 |
| Shelem value | 330 | Multiple of 5, 165–10000 |
| Sar-Shelem value | 330 | Multiple of 5, 165–10000, and never below the Shelem value |
| Sar-Shelem exchanges the widow | Off | On/off |
| Double negative | On | On/off |
| Double-negative threshold | 85 | Whole number, 0–100 |
| Shuffle | Table | Table (light shuffle carrying the previous hand forward) or Random (fresh deck every hand) |
| Turn limit | 30s | Off, or 5–120 seconds |

Two bounds are load-bearing rather than arbitrary:

- **Both slam values must exceed the highest numeric bid (160).** Shelem and Sar-Shelem outrank every numeric bid, and Sar-Shelem outranks Shelem — a slam worth less than a bid it outranks would make the ladder incoherent.
- **The double-negative threshold is capped at 100**, the bid floor. That is what guarantees the penalty can never land on a made contract, since the smallest makeable numeric bid is 100 points.

### The turn clock

A player who doesn't act within the limit has the turn played for them, and the table moves on. Bidding and the widow discard are judgements rather than reflexes, so they get **twice** the limit; the opening bid also gets an allowance for the deal animation, which it would otherwise be timed through.

Shelem has no bot, so a timed-out turn gets the most defensible *legal* action rather than a good one: **pass** when bidding, the **lowest legal card** in play, and the **four lowest cards** buried at the widow. That is honestly weaker than a real player and can misplay a contract — the alternative was waiting indefinitely. See [Bots](bots.md) for why Hokm does better here.

The clock runs for a disconnected player too, which is the main reason it exists: before it, one dropped player could freeze a table for a day.

The bidding limits themselves — floor 100, cap 160, increments of 5 — are **not** configurable. They are pinned to the 165 points in a hand, which is in turn fixed by the card values and the flat 5-point trick bonus; moving one without the others produces a bid ladder that doesn't fit the hand.
