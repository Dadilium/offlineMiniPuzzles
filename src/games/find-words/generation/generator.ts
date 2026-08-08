import { placementCells } from '../engine';
import type { Direction, FindWordsLevel, Placement } from '../types';
import type { GenerationParams } from './difficulty';
import { PLACEMENT_ATTEMPTS_PER_WORD } from './difficulty';
import { fingerprintFindWords } from './fingerprint';
import type { RNG } from './rng';
import { wordBankFor, type WordBankLanguage } from './wordbanks';

export interface GenerateSuccess {
  level: FindWordsLevel;
  attempts: number;
  fingerprint: string;
}

export interface GenerateFailure {
  attempts: number;
}

function randInt(rng: RNG, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function shuffled<T>(rng: RNG, items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function fits(grid: (string | null)[][], word: string, row: number, col: number, direction: Direction, rows: number, cols: number): boolean {
  const cells = placementCells({ word, row, col, direction });
  for (let i = 0; i < cells.length; i++) {
    const { r, c } = cells[i];
    if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
    const existing = grid[r][c];
    // Overlap is fine as long as the shared cell already holds the same
    // letter -- classic word-search packing, and harder to spot than
    // non-overlapping words laid out with visible gaps.
    if (existing !== null && existing !== word[i]) return false;
  }
  return true;
}

function place(grid: (string | null)[][], word: string, row: number, col: number, direction: Direction): void {
  placementCells({ word, row, col, direction }).forEach((cell, i) => {
    grid[cell.r][cell.c] = word[i];
  });
}

/**
 * Tries every word (longest-first -- the hardest to place, so failing on it
 * early wastes less work than placing several short words and only then
 * discovering the long one doesn't fit anywhere) at random positions and
 * directions within `PLACEMENT_ATTEMPTS_PER_WORD` each. Any single word
 * failing abandons this whole grid attempt rather than backtracking earlier
 * placements -- a fresh random grid is cheap to try again, and genuine
 * backtracking would buy little (see generation/__scripts__/sweep.ts for
 * measured attempts-to-success).
 */
function tryPlaceAll(rng: RNG, words: string[], rows: number, cols: number, directions: Direction[]): Placement[] | null {
  const grid: (string | null)[][] = Array.from({ length: rows }, () => new Array<string | null>(cols).fill(null));
  const ordered = words.slice().sort((a, b) => b.length - a.length);
  const placements: Placement[] = [];

  for (const word of ordered) {
    let placed = false;
    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS_PER_WORD; attempt++) {
      const direction = directions[Math.floor(rng() * directions.length)];
      const row = randInt(rng, 0, rows - 1);
      const col = randInt(rng, 0, cols - 1);
      if (!fits(grid, word, row, col, direction, rows, cols)) continue;
      place(grid, word, row, col, direction);
      placements.push({ word, row, col, direction });
      placed = true;
      break;
    }
    if (!placed) return null;
  }

  return placements;
}

/** Plain A-Z filler regardless of language -- only placed-word cells carry French accents, so the grid stays simple to scan for either alphabet. */
const FILLER_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function fillGrid(rng: RNG, placements: Placement[], rows: number, cols: number): string[][] {
  const grid: string[][] = Array.from({ length: rows }, () => new Array<string>(cols).fill(''));
  for (const placement of placements) {
    placementCells(placement).forEach((cell, i) => {
      grid[cell.r][cell.c] = placement.word[i];
    });
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) grid[r][c] = FILLER_ALPHABET[Math.floor(rng() * FILLER_ALPHABET.length)];
    }
  }
  return grid;
}

/**
 * Unlike Shikaku, there's no uniqueness concept to certify here -- a word
 * search has no "unique solution". Each placement's exact cell path is
 * stored and that's what a drag is checked against (see engine.ts's
 * matchPlacement), so an incidental extra occurrence of a word among filler
 * letters is harmless, not a correctness bug.
 */
export function generateFindWordsLevel(
  rng: RNG,
  params: GenerationParams,
  language: WordBankLanguage,
  recentFingerprints: string[] = [],
  maxAttempts = 200,
  recentWords: string[] = []
): GenerateSuccess | GenerateFailure {
  const recent = new Set(recentFingerprints);
  const fullPool = wordBankFor(language).filter((w) => w.length >= params.wordLengthRange[0] && w.length <= params.wordLengthRange[1]);
  if (fullPool.length < params.wordCount) return { attempts: 0 };

  // Prefer words the player hasn't seen in recent levels -- falls back to the
  // full pool only if avoiding them would leave too few words to fill a level.
  const recentSet = new Set(recentWords);
  const freshPool = fullPool.filter((w) => !recentSet.has(w));
  const pool = freshPool.length >= params.wordCount ? freshPool : fullPool;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const rows = randInt(rng, params.sizeRange[0], params.sizeRange[1]);
    const cols = randInt(rng, params.sizeRange[0], params.sizeRange[1]);

    const words = shuffled(rng, pool).slice(0, params.wordCount);
    const placements = tryPlaceAll(rng, words, rows, cols, params.directions);
    if (!placements) continue;

    const fingerprint = fingerprintFindWords(rows, cols, placements);
    if (recent.has(fingerprint)) continue;

    const grid = fillGrid(rng, placements, rows, cols);
    return { level: { rows, cols, grid, placements }, attempts: attempt, fingerprint };
  }

  return { attempts: maxAttempts };
}
