import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Overlay.module.css';

export interface OverlayProps {
  title: string;
  /** Omitted when the overlay is not the player's to close — see `dismissible`. */
  onClose?: () => void;
  /** False to drop the visible heading. `title` is still used as the dialog's
   * accessible name — a dialog with no name is a dialog a screen reader announces
   * as nothing, so the two are deliberately separate. */
  showTitle?: boolean;
  /** False for an overlay the game is holding open, like the end-of-hand scores.
   * Removes the close button and both escape routes, so it can't be dismissed
   * into a table that isn't ready to be played yet. */
  dismissible?: boolean;
  children: ReactNode;
}

/** A centred panel over the table, shared by the score and last-trick views.
 *
 * Both of these used to open in place in the corner they're triggered from,
 * which meant sizing them to survive in a corner: small type, a capped and
 * scrolled history, and a constant fight with the top seat's cards. Centred,
 * they can be read rather than squinted at.
 *
 * It is a modal, so it takes the responsibilities of one: escape closes it, a
 * click on the scrim closes it, focus moves in on open and returns to whatever
 * opened it on close. Without that last part a keyboard user can tab out of the
 * dialog into a table they can't see, which is worse than the corner popover
 * this replaces.
 *
 * Rendered through a portal to <body>, which is not decoration. Its triggers live
 * inside the table's corner slots, and those set a z-index, which makes each one a
 * stacking context — so the scrim's own z-index only ever competed *within* that
 * corner, and lost to the table's centre content (z-index 5 while bidding). The
 * dialog rendered under the "Waiting on X" text. A portal takes it out of the
 * table's stacking contexts altogether, which is the only way to be sure a modal
 * is on top of everything rather than on top of its own corner. */
export function Overlay({ title, onClose, showTitle = true, dismissible = true, children }: OverlayProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cardRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose, dismissible]);

  return createPortal(
    <div className={styles.scrim} onClick={dismissible ? onClose : undefined}>
      <div
        ref={cardRef}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        // The scrim closes on click; a click that lands on the panel itself is
        // not a click on the scrim, so it must not bubble up and close it.
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`${styles.head} ${showTitle ? '' : styles.headBare}`}>
          {showTitle && <span className={styles.title}>{title}</span>}
          {dismissible && (
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
              ×
            </button>
          )}
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
