import type { MatchingNumbersLevel } from './types';

// Not wired into gameplay -- levels are generated at runtime on demand (see
// state/useMatchingNumbersProgress.ts + generation/), the same as Kings.
// Kept as a placeholder for future CLI/dev fixtures once the
// tools/level-creator support for this game is added (deferred for now --
// see the project plan).
export const levels: MatchingNumbersLevel[] = [];

export const levelTutorialKey: Array<string | null> = [];
