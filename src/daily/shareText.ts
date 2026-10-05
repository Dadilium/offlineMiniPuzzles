// Pure formatting for the daily result share card.

/** `m:ss`, or `h:mm:ss` past an hour. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export interface ShareInput {
  gameName: string;
  /** Already-localized short date, e.g. "Oct 5" / "5 oct." (see dailyDate.ts). */
  dateLabel: string;
  /** Already-localized tier name, e.g. "Hard". */
  tierLabel: string;
  elapsedMs: number;
  hintsUsed: number;
  streak: number;
}

/** e.g. `Kings · Oct 5 · Hard ✅ 2:31 💡1 🔥7` -- hints/streak only shown when non-trivial. */
export function formatShareLine({ gameName, dateLabel, tierLabel, elapsedMs, hintsUsed, streak }: ShareInput): string {
  const parts = [`${gameName} · ${dateLabel} · ${tierLabel}`, `✅ ${formatDuration(elapsedMs)}`];
  if (hintsUsed > 0) parts.push(`💡${hintsUsed}`);
  if (streak > 1) parts.push(`🔥${streak}`);
  return parts.join(' ');
}
