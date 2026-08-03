import { useEffect, useRef, useState } from 'react';

const MIN_U = 3;
const MAX_U = 8;

function clampU(raw: number): number {
  return Math.min(MAX_U, Math.max(MIN_U, raw));
}

function initialGuess(): number {
  if (typeof window === 'undefined') return MIN_U;
  return clampU(Math.min(window.innerWidth, window.innerHeight) * 0.01);
}

/** The shared `--u` scale unit (see theme.css) every card/fan/clearance on the
 * table is a multiple of — measured directly off the table's own rendered box
 * with ResizeObserver instead of left to CSS container query units (`cqmin`).
 *
 * That CSS-only approach (tried first) sits on a known WebKit fault line: the
 * table's height comes from `flex: 1` inside a `100dvh` flex column
 * (App.module.css), and "100% height doesn't resolve inside a flex item" is a
 * long-standing class of Safari bug (see flexbugs #197) that `container-type:
 * size` containment depends on being correct — on desktop Chrome it happened
 * to work, on mobile Safari it silently fell back to treating the container as
 * the full (chrome-inclusive) viewport, reintroducing the exact clipping this
 * was meant to fix. ResizeObserver reads the element's actual laid-out pixel
 * size instead, which sidesteps that class of bug entirely rather than relying
 * on a specific CSS containment code path resolving correctly. */
export function useTableScaleUnit<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [u, setU] = useState(initialGuess);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setU(clampU(Math.min(width, height) * 0.01));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, u };
}
