import type { DifficultyTier } from './difficultyTiers';

// App-wide "a level was just solved for the first time" signal, so features
// that care about wins across every game (the store-rating ask) can listen
// in one place instead of being wired into each game's screen. Emitted by
// createProgressStore for regular levels and by the daily session for
// dailies; never for skips or replays.

export interface LevelCompletedEvent {
  tier: DifficultyTier;
  hintsUsed: number;
}

type Listener = (event: LevelCompletedEvent) => void;

const listeners = new Set<Listener>();

export function onLevelCompleted(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitLevelCompleted(event: LevelCompletedEvent): void {
  for (const listener of listeners) listener(event);
}
