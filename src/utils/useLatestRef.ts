import { useEffect, useRef, type MutableRefObject } from 'react';

/**
 * Ref that always holds the latest committed `value`. Lets an effect or a
 * deferred callback read current state without listing it as a dependency
 * -- for effects where a re-run would cancel in-flight timers or replay a
 * one-shot action. Synced in an effect declared before the caller's own
 * effects, so it is already current by the time they run in the same commit.
 */
export function useLatestRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
