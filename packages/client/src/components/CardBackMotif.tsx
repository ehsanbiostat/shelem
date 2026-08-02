/** Original, simple 8-pointed star (a common Persian/Islamic geometric motif) built
 * from two overlapping squares — used only on the card back, never the face, so faces
 * stay internationally legible. Pure SVG, no external assets. */
export function CardBackMotif() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="6" width="88" height="88" rx="6" stroke="currentColor" strokeWidth="2" opacity="0.55" />
      <g transform="translate(50 50)">
        <rect x="-26" y="-26" width="52" height="52" stroke="currentColor" strokeWidth="2" opacity="0.9" />
        <rect x="-26" y="-26" width="52" height="52" stroke="currentColor" strokeWidth="2" opacity="0.9" transform="rotate(45)" />
        <circle r="8" stroke="currentColor" strokeWidth="2" opacity="0.9" />
      </g>
    </svg>
  );
}
