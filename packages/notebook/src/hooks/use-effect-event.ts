import { useRef, useCallback } from 'react';

/** Polyfill for the proposed React useEffectEvent hook. */
export function useEffectEvent<Args extends unknown[], R>(fn: (...args: Args) => R): (...args: Args) => R {
  const ref = useRef(fn);
  ref.current = fn;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((...args: Args) => ref.current(...args), []);
}
