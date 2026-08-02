/** Subtle repeating geometric tiling (girih-style lattice) across the table felt.
 * Original, simple, and low-opacity so it never competes with the cards. */
export function TableFeltMotif() {
  return (
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="shelem-felt-lattice" width="60" height="60" patternUnits="userSpaceOnUse">
          <path
            d="M30 4 L56 30 L30 56 L4 30 Z"
            fill="none"
            stroke="var(--color-gold-300)"
            strokeWidth="1"
          />
          <circle cx="30" cy="30" r="6" fill="none" stroke="var(--color-gold-300)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#shelem-felt-lattice)" />
    </svg>
  );
}
