/** Mixes a `#rrggbb` color toward black by `amount` (0-1). Used to derive a
 * shadow/base shade from a game's accent color without hand-picking one. */
export function darken(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const channel = (start: number) => {
    const value = parseInt(clean.slice(start, start + 2), 16);
    return Math.round(value * (1 - amount))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}
