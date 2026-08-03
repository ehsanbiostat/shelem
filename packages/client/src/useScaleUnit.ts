import { useEffect, useState } from 'react';

const FALLBACK_U = 7;

function readScaleUnit(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--u');
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : FALLBACK_U;
}

/** The shared `--u` scale unit (see theme.css) as a live pixel number, for the rare
 * spot that needs it in JS rather than a CSS `calc()` — Framer Motion overwrites a
 * plain CSS `transform-origin` from its own `originX`/`originY` style props on every
 * render (see Hand.tsx), so that pivot has to be computed here instead. `--u` is
 * viewport-based, so a `resize` listener is enough to keep it current; no
 * ResizeObserver needed. */
export function useScaleUnit(): number {
  const [u, setU] = useState(readScaleUnit);

  useEffect(() => {
    const onResize = () => setU(readScaleUnit());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return u;
}
