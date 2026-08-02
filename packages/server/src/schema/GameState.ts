import { ArraySchema, Schema, type } from '@colyseus/schema';

/** Public per-player info. Actual hand contents are never put in synced state —
 * see ShelemRoom's private hand tracking — only the count is public. */
export class PlayerInfo extends Schema {
  @type('string') sessionId = '';
  @type('string') name = '';
  @type('number') seat = -1;
  @type('boolean') connected = true;
  @type('number') handSize = 0;
}

export class BidRecord extends Schema {
  @type('number') seat = -1;
  @type('string') bidType: 'numeric' | 'shelem' | 'sarShelem' | 'pass' = 'pass';
  @type('number') amount = 0;
}

export class TrickPlay extends Schema {
  @type('number') seat = -1;
  @type('string') suit = '';
  @type('string') rank = '';
}

export class SeatSwapRequest extends Schema {
  @type('number') fromSeat = -1;
  @type('number') toSeat = -1;
}

export class GameState extends Schema {
  @type([PlayerInfo]) players = new ArraySchema<PlayerInfo>();

  @type('string') phase = 'lobby';
  @type('number') dealerSeat = 0;
  @type('number') currentTurnSeat = -1;
  @type('number') declarerSeat = -1;

  @type([BidRecord]) bidHistory = new ArraySchema<BidRecord>();
  @type('string') winningBidType = '';
  @type('number') winningBidAmount = 0;

  @type('string') trumpSuit = '';
  @type([TrickPlay]) currentTrick = new ArraySchema<TrickPlay>();
  @type('number') tricksPlayedThisHand = 0;

  @type('number') team0Score = 0;
  @type('number') team1Score = 0;
  @type('number') matchTargetScore = 1650;

  @type(SeatSwapRequest) pendingSeatSwap: SeatSwapRequest | undefined = undefined;

  @type('number') handNumber = 0;
}
