import { createContext, useContext, useEffect, useRef, useState } from 'react';

const MIN_U = 3;
const MAX_U = 8;

export interface TableMetrics {
  /** The table's own rendered box, in px — not the browser viewport, which is
   * usually bigger (see useMeasureTableMetrics for why that distinction matters). */
  width: number;
  height: number;
  /** The shared `--u` scale unit (see theme.css), as a live number for the rare
   * spot that needs it in JS (fan pivot-distance math; Framer Motion's
   * transform-origin quirk in Hand.tsx) rather than a CSS `calc()`. */
  u: number;
}

function clampU(raw: number): number {
  return Math.min(MAX_U, Math.max(MIN_U, raw));
}

function metricsFrom(width: number, height: number): TableMetrics {
  return { width, height, u: clampU(Math.min(width, height) * 0.01) };
}

function initialGuess(): TableMetrics {
  if (typeof window === 'undefined') return metricsFrom(800, 600);
  return metricsFrom(window.innerWidth, window.innerHeight);
}

/** Producer: measures the table's actual rendered box with ResizeObserver.
 * Used only by Table.tsx, which provides the result to everything else on the
 * table via TableMetricsContext — see that component for why measuring
 * directly (rather than a CSS-only container-query approach) is what actually
 * works across browsers. */
export function useMeasureTableMetrics<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [metrics, setMetrics] = useState<TableMetrics>(initialGuess);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setMetrics(metricsFrom(width, height));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, metrics };
}

export const TableMetricsContext = createContext<TableMetrics>(initialGuess());

/** Consumer: everything under Table.tsx's provider (every seat's fan, and the
 * local hand — see Table.tsx's JSX for how the latter, passed in as a prop
 * from App.tsx, still ends up inside the provider once actually rendered)
 * reads the table's real measured size this way. */
export function useTableMetrics(): TableMetrics {
  return useContext(TableMetricsContext);
}
