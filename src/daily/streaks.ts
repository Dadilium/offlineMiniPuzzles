// Pure streak math over the set of day numbers a player solved -- shared by
// the per-game streak and the overall "any daily that day" streak.

export interface Streak {
  /** Unbroken run ending today -- or yesterday, since today's daily may
   * simply not be solved *yet*; a streak only breaks once a whole day passes. */
  current: number;
  best: number;
}

export function computeStreak(solvedDays: Iterable<number>, today: number): Streak {
  const days = Array.from(new Set(solvedDays))
    .filter((d) => d <= today)
    .sort((a, b) => a - b);

  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const day of days) {
    run = prev !== null && day === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }

  const last = days[days.length - 1];
  const current = last === today || last === today - 1 ? run : 0;
  return { current, best };
}

/** Union of several games' solved days -- the overall streak counts a day if any daily was solved on it. */
export function unionDays(perGame: Iterable<Iterable<number>>): Set<number> {
  const out = new Set<number>();
  for (const days of perGame) for (const d of days) out.add(d);
  return out;
}
