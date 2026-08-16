import type { CSSProperties, ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { Card as CardModel, Seat as SeatIndex, Suit } from '@shelem/shared';
import styles from './Table.module.css';
import { Seat } from './Seat.js';
import { TableMetricsContext, useMeasureTableMetrics } from '../tableMetrics.js';
import { screenSlotFor } from '../screenSlot.js';
import { DealingOverlay, type DealBlock } from './DealingOverlay.js';
import { WidowPile } from '../games/shelem/WidowPile.js';

export interface TablePlayer {
  seat: SeatIndex;
  name: string;
  connected: boolean;
  handSize: number;
  /** Short badge beside the name — Shelem puts each player's bid here. */
  badgeLabel?: string;
  badgeMuted?: boolean;
}

export interface TableProps {
  mySeat: SeatIndex;
  players: TablePlayer[];
  currentTurnSeat: SeatIndex;
  /** The seat holding this hand's special role — Shelem's declarer, Hokm's Hâkem.
   * -1 before one exists. Where the trump glyph goes. */
  roleSeat: SeatIndex | -1;
  /** The table is waiting on someone for a decision that isn't a card: a Shelem
   * bid, a Hokm trump call. Puts a "thinking" badge on whoever's turn it is. */
  awaitingChoice: boolean;
  /** The most cards any hand holds in this game — caps the opponents' fans. */
  maxFanCards: number;
  center: ReactNode;
  /** How much of the felt `center` gets. `'trick'` (the default) keeps clear of
   * the opponents' fans, which is what the played-card pile needs. `'wide'`
   * spans nearly the whole table and sits over them — for content that needs
   * the width more than the clearance (the bid grid, lobby, table settings).
   * See `.centerWide` in Table.module.css. */
  centerVariant?: 'trick' | 'wide';
  /** The local player's own hand (or widow-discard picker), anchored flush to the
   * felt's bottom edge — on Trickster's table this is the same surface as the rest
   * of the game, not a separate panel below it. */
  bottomOverlay?: ReactNode;
  /** Small overlay pinned to the felt's bottom-left corner — the score panel. Kept
   * out of the bottom-center hand's way rather than occupying its own row above
   * the table. */
  cornerPanel?: ReactNode;
  /** Mirror of `cornerPanel` on the felt's top-right — the last-trick review.
   * Both overlays sit along the top edge, leaving the bottom corners clear for
   * the hand fan, which runs off the bottom of the display. */
  cornerPanelRight?: ReactNode;
  /** Drops the local player's own name label. The widow-discard bar renders in
   * the same band (it sits above the hand, inside `bottomOverlay`) and lands on
   * top of it — and during a discard the label is the one piece of information on
   * the table you definitely already have. */
  /** Plays the deal when set, then calls `onDealDone`. Lives here rather than in
   * the game screen because the animation is expressed in table coordinates.
   * `blocks` is the shape of this game's deal — see DealingOverlay. */
  dealing?: { dealerSeat: SeatIndex; blocks: DealBlock[] } | null;
  onDealDone?: () => void;
  /** The four widow cards, parked in front of the dealer for the auction and flown
   * to the winning bidder. Null outside bidding and the widow phase. Expressed in
   * table coordinates, so like `dealing` it belongs here rather than in App. */
  widow?: {
    dealerSeat: SeatIndex;
    declarerSeat: SeatIndex | null;
    faces?: CardModel[];
    flip: boolean;
  } | null;
  hideOwnLabel?: boolean;
  /** Once set, shown as a suit glyph on the declarer's seat. */
  trumpSuit?: Suit | null;
}

export function Table({
  mySeat,
  players,
  currentTurnSeat,
  roleSeat,
  awaitingChoice,
  maxFanCards,
  center,
  centerVariant = 'trick',
  bottomOverlay,
  cornerPanel,
  cornerPanelRight,
  hideOwnLabel = false,
  trumpSuit,
  dealing,
  onDealDone,
  widow,
}: TableProps) {
  const bySeat = new Map(players.map((p) => [p.seat, p]));
  const { ref: tableRef, metrics } = useMeasureTableMetrics<HTMLDivElement>();

  // Hands stay hidden for the duration of the deal, so the cards fly out to empty
  // seats rather than towards hands already sitting there full.
  //
  // Revealed all at once at the end, not per block as each one lands. Per block is
  // the obvious design and measurably the worse one: every card face is an SVG, so
  // un-hiding a twelve-card fan repaints twelve of them, and doing that five times
  // during the animation put ~60-175ms frames right in the middle of it — p95 frame
  // time went from 10ms to 33ms on a 4x-throttled CPU. Memoising the seats and
  // pre-rasterising at opacity 0.001 both failed to shift it; the repaint is the
  // cost, not the mount or the reconciliation. One reveal at the end puts that cost
  // in a single frame, after the motion has finished, where it doesn't show.

  return (
    <div ref={tableRef} className={styles.tableWrap} style={{ '--u': `${metrics.u}px` } as CSSProperties}>
      <TableMetricsContext.Provider value={metrics}>
        <div className={styles.felt} />

        {([0, 1, 2, 3] as SeatIndex[]).map((seat) => {
          const player = bySeat.get(seat);
          const slot = screenSlotFor(seat, mySeat);
          if (slot === 'bottom' && hideOwnLabel) return null;
          const isTurn = seat === currentTurnSeat;
          return (
            <div key={seat} className={`${styles.seatSlot} ${styles[slot]}`}>
              <Seat
                name={player?.name ?? ''}
                connected={player?.connected ?? false}
                handSize={slot === 'bottom' ? 0 : (player?.handSize ?? 0)}
                maxFanCards={maxFanCards}
                isTurn={isTurn}
                isChoosing={awaitingChoice && isTurn}
                hasRole={seat === roleSeat}
                badgeLabel={player?.badgeLabel}
                badgeMuted={player?.badgeMuted}
                trumpSuit={trumpSuit}
                empty={!player}
                slot={slot}
                hideFan={!!dealing}
              />
            </div>
          );
        })}

        <div className={`${styles.center} ${centerVariant === 'wide' ? styles.centerWide : ''} ${dealing ? styles.undealt : ''}`}>
          {center}
        </div>

        {cornerPanel && <div className={styles.cornerPanel}>{cornerPanel}</div>}

        {cornerPanelRight && <div className={styles.cornerPanelRight}>{cornerPanelRight}</div>}

        {bottomOverlay && (
          <div className={`${styles.bottomOverlay} ${dealing ? styles.undealt : ''}`}>{bottomOverlay}</div>
        )}

        {/* AnimatePresence so the pile's exit actually runs — on a redeal it has to
            fly back to the deck rather than blink out from under the new deal. */}
        <AnimatePresence>
          {widow && (
            <WidowPile
              mySeat={mySeat}
              dealerSeat={widow.dealerSeat}
              declarerSeat={widow.declarerSeat}
              faces={widow.faces}
              flip={widow.flip}
            />
          )}
        </AnimatePresence>

        {dealing && (
          <DealingOverlay
            mySeat={mySeat}
            dealerSeat={dealing.dealerSeat}
            blocks={dealing.blocks}
            onDone={onDealDone ?? (() => {})}
          />
        )}
      </TableMetricsContext.Provider>
    </div>
  );
}
