# Shelem — Game Rules

The authoritative ruleset for this platform's game engine, as clarified with the domain owner (differs in places from generic web summaries of "Shelem," which turned out to be imprecise).

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
- On a redeal (everyone passes), the hands and widow are gathered back up and dealt again, rather than a fresh deck being introduced.

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
- If every player passes without any bid being made, the hand is **redealt**.

### Bid ladder

| Tier | Requirement | Success | Failure |
|---|---|---|---|
| Numeric (100–160, multiples of 5) | Collect ≥ bid points | Score exactly the bid amount (excess doesn't matter) | Lose exactly the bid amount |
| Shelem | Collect **all 165 points** | +165 | −165 |
| Sar-Shelem | Collect **all 165 points** | +330 | −330 |

Shelem and Sar-Shelem outrank all numeric bids and each other (Sar-Shelem > Shelem), and either can be called at any point in the bidding, skipping over numeric bids entirely.

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

- **Declarer's team**, numeric bid: if they collect ≥ bid points, they score exactly the bid amount; if not, they lose exactly the bid amount.
- **Declarer's team**, Shelem/Sar-Shelem: must collect all 165 points to succeed (see bid ladder table above for the score).
- **Defending team**: always scores whatever points they actually collect in tricks, regardless of whether the declarer's team made or failed their bid.

## Match structure

- A match is played as a repeating series of hands (dealer rotates each hand) until one team's cumulative score reaches a **target score**.
- The target score is configurable per table by the host at table-creation time. **Default: 1650** (10× the max single-hand score of 165).
