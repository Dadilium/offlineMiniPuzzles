import type { RelayStackParamList } from '../games/relay/navigation';
import type { KingsStackParamList } from '../games/kings/navigation';
import type { MatchingNumbersStackParamList } from '../games/matching-numbers/navigation';
import type { BlockFillStackParamList } from '../games/block-fill/navigation';
import type { CrossSumsStackParamList } from '../games/cross-sums/navigation';
import type { ColorSortStackParamList } from '../games/color-sort/navigation';
import type { TentsAndTreesStackParamList } from '../games/tents-and-trees/navigation';

// Root stack = Library + every game's screens merged in. Each game module
// declares its own param list (see games/relay/navigation.ts) which gets
// unioned in here so navigation stays type-safe app-wide.
export type RootStackParamList = {
  Library: undefined;
} & RelayStackParamList &
  KingsStackParamList &
  MatchingNumbersStackParamList &
  BlockFillStackParamList &
  CrossSumsStackParamList &
  ColorSortStackParamList &
  TentsAndTreesStackParamList;
