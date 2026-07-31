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
  /** Small vector motif representing this game on its Library grid card. */
  CardArt?: ComponentType<{ size: number; color: string }>;
  /** Optional context provider for the game's own persisted state. */
  Provider?: ComponentType<{ children: React.ReactNode }>;
  /** Screens this game contributes to the root stack navigator. */
  screens: Array<{ name: string; component: ComponentType<any> }>;
  /** Screen name to open when the player taps this game's card in the Library. */
  entryScreen: string;
  /** Hook exposing this game's persisted-progress summary + a wipe action,
   * for the generic Settings > Game Progress screen. Reads from the same
   * Provider mounted above the whole app, so it's safe to call from any
   * screen. Omitted for a game with nothing worth resetting. */
  useProgress?: () => { completed: number; reset: () => void };
}

export interface ComingSoonEntry {
  name: string;
  tag: string;
}
