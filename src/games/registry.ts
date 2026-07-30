import { relayGame } from './relay';
import { kingsGame } from './kings';
import { matchingNumbersGame } from './matching-numbers';
import { blockFillGame } from './block-fill';
import { crossSumsGame } from './cross-sums';
import { colorSortGame } from './color-sort';
import { tentsAndTreesGame } from './tents-and-trees';
import { shikakuGame } from './shikaku';
import type { ComingSoonEntry, GameModule } from './types';

// Add new games here as they're built, e.g.:
//   import { newGame } from './new-game';
//   export const games: GameModule[] = [relayGame, kingsGame, newGame];
export const games: GameModule[] = [
  relayGame,
  kingsGame,
  matchingNumbersGame,
  blockFillGame,
  crossSumsGame,
  colorSortGame,
  tentsAndTreesGame,
  shikakuGame,
];

export const comingSoon: ComingSoonEntry[] = [];
