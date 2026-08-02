# Shelem — Game Rules

The authoritative ruleset for this platform's game engine, as clarified with the domain owner (differs in places from generic web summaries of "Shelem," which turned out to be imprecise).

## Setup

- 4 players, 2 fixed partnerships — partners sit opposite each other.
- Standard 52-card deck.
- Each player is dealt 12 cards, in batches of 4.
- The remaining 4 cards form a face-down **widow**.
- Dealer rotates clockwise each hand. The first bidder each hand is whoever receives cards first in that deal (same seat-relative-to-dealer every time).

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
- If void in the led suit, a player must play trump if holding one; otherwise, any card.

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
