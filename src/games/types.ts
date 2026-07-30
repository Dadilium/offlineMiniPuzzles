import type { ComponentType } from 'react';

// Every game the app ships lives in its own folder under src/games/<id> and
// exports one of these. The root navigator merges each game's screens into a
// single stack and mounts each game's Provider (state/persistence) around
// the whole app, so games stay fully self-contained but still share one
// native navigation stack (best perf + one codebase, per the "single game
// binary" requirement).
export interface GameModule {
  id: string;
  status: 'ready' | 'locked';
  /** Tint for this game's Library/hub pulse icon. Defaults to signal blue. */
  accentColor?: string;
  /** Optional context provider for the game's own persisted state. */
  Provider?: ComponentType<{ children: React.ReactNode }>;
  /** Screens this game contributes to the root stack navigator. */
  screens: Array<{ name: string; component: ComponentType<any> }>;
  /** Screen name to open when the player taps this game's card in the Library. */
  entryScreen: string;
}

export interface ComingSoonEntry {
  name: string;
  tag: string;
}
