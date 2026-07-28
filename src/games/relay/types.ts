export type SignalColor = 'blue' | 'red';

export interface Point {
  x: number;
  y: number;
}

export interface RelaySource extends Point {
  color: SignalColor;
  range: number;
}

export interface RelayReceiver extends Point {
  color: SignalColor;
}

/**
 * "circle" reaches omnidirectionally (range + line-of-sight, no bounce).
 * "beam" reaches only along the 4 cardinal directions, bending 90 degrees
 * for free off any mirror it lands on -- see `canReach` in engine.ts.
 * Undefined (on a relay placed before this mechanic shipped, or on the
 * fixed source node, which isn't player-typed) means "try both", matching
 * the game's original dual-mode behavior exactly.
 */
export type RelayKind = 'circle' | 'beam';

export interface PlacedRelay extends Point {
  color: SignalColor;
  /** Revealed via hint -- locked, can't be tapped away like a normal relay. */
  locked?: boolean;
  kind?: RelayKind;
}

/**
 * "/" bounces N<->E and S<->W. "\" bounces N<->W and S<->E. A mirror tile
 * blocks the plain omnidirectional range/LOS check like a wall would (it's a
 * physical panel), but a cardinal (N/E/S/W) beam that lands on it exactly
 * bends 90 degrees and keeps travelling instead of stopping -- see
 * traceCardinalBeam in engine.ts.
 */
export type MirrorOrientation = 'fwd' | 'back';

export interface RelayMirror extends Point {
  orientation: MirrorOrientation;
}

export interface RelayLevel {
  title?: string;
  instructions?: string;
  walls: Point[];
  /** Fixed terrain, not player-placeable. Defaults to none for levels that predate this mechanic. */
  mirrors?: RelayMirror[];
  sources: RelaySource[];
  receivers: RelayReceiver[];
  budgets: Partial<Record<SignalColor, number>>;
  relayRange: number;
  interferenceDistance: number;
}

export interface ConnectivityNode extends Point {
  range: number;
  relayIdx: number; // -1 for the source itself
  kind?: RelayKind;
}

export interface ConnectivityResult {
  nodes: ConnectivityNode[];
  connected: boolean[];
  parent: number[];
  /** Node index -> bent polyline (source/parent through any mirror bounces to that node), only set when the connection to that node was via a cardinal bounce rather than a straight hop. */
  bouncePaths: Record<number, Point[]>;
  receiverReached: boolean;
  receiverParent: number;
  receiverBouncePath?: Point[];
  receiver: RelayReceiver;
}
