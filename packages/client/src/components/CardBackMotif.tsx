import { useId } from 'react';

/** A dense field of tiny dots — simpler than the bordered/emblem motifs tried
 * before, on a plain white back (see Card.module.css) with black dots. The
 * pattern's id has to be unique per instance (`useId`, sanitized to strip the
 * colons React wraps it in — plain enough for an SVG id/`url()` reference):
 * dozens of these render at once (every opponent card plus the local hand),
 * and SVG `id`s share one namespace across the whole document, so a literal
 * id would only resolve correctly for the first instance and leave every
 * other card's dots invisible. */
export function CardBackMotif() {
  const patternId = `card-back-dots-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id={patternId} width="4.5" height="4.5" patternUnits="userSpaceOnUse">
          <circle cx="2.25" cy="2.25" r="0.85" fill="black" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="100" height="100" fill={`url(#${patternId})`} />
    </svg>
  );
}
