/** Original ornate motif built from layered Persian/Islamic geometric forms — an
 * 8-pointed star (two overlapping squares) inside a ring, a double-line frame, and
 * a small rosette at each corner — evoking the look of a classic ornate card back
 * (a bordered frame around a repeating central emblem) without reproducing any
 * particular deck's actual artwork. Used only on the card back, never the face, so
 * faces stay internationally legible. Pure SVG, no external assets. */
export function CardBackMotif() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="92" height="92" rx="8" stroke="currentColor" strokeWidth="2" opacity="0.9" />
      <rect x="9" y="9" width="82" height="82" rx="6" stroke="currentColor" strokeWidth="1" opacity="0.5" />

      {[
        [14, 14],
        [86, 14],
        [14, 86],
        [86, 86],
      ].map(([cx, cy]) => (
        <g key={`${cx}-${cy}`} transform={`translate(${cx} ${cy})`}>
          <circle r="4.5" stroke="currentColor" strokeWidth="1.3" opacity="0.75" />
          <circle r="1.4" fill="currentColor" opacity="0.75" />
        </g>
      ))}

      <g transform="translate(50 50)">
        <circle r="32" stroke="currentColor" strokeWidth="1" opacity="0.35" />
        <rect x="-24" y="-24" width="48" height="48" stroke="currentColor" strokeWidth="2" opacity="0.9" />
        <rect x="-24" y="-24" width="48" height="48" stroke="currentColor" strokeWidth="2" opacity="0.9" transform="rotate(45)" />
        <circle r="11" stroke="currentColor" strokeWidth="2" opacity="0.95" />
        <circle r="3.5" fill="currentColor" opacity="0.9" />
      </g>
    </svg>
  );
}
