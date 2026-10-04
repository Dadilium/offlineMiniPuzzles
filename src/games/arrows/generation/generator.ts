import { analyzeClearing, inBounds, toCellIndex, toRowCol, type ClearAnalysis } from '../engine';
import type { Arrow, ArrowsLevel, CellIndex, Vec } from '../types';
import type { GenerationParams } from './difficulty';
import { fingerprintArrows } from './fingerprint';
import type { RNG } from './rng';

// Construction runs in *removal* order: arrow 0 is the first one a player
// can launch, arrow N-1 the last. Arrow k may only leave once every arrow on
// its exit ray is gone -- i.e. its ray may only cross arrows < k. So when
// arrow k is placed, every cell on its ray must already be filled. The board
// therefore fills from the edges inward, and it has two properties the
// whole file leans on:
//   - While building forward, an empty cell is never on anyone's ray (rays
//     only cross filled cells), so stretching a tail into one is safe.
//   - On the finished, completely full board, an arrow is free at the start
//     exactly when its head sits on the edge pointing out.
// Hole repair (see `repairHoles`) can re-empty cells that *are* on rays, so
// every claim is checked against `rayMin`: a cell crossed by arrow k's ray
// may only ever belong to an arrow < k.

const EMPTY = -1;
/** Marks the cells of a body still being grown. */
const GROWING = -2;
const NO_RAY = Number.MAX_SAFE_INTEGER;
const DIRS: readonly Vec[] = [
  { dr: -1, dc: 0 },
  { dr: 1, dc: 0 },
  { dr: 0, dc: -1 },
  { dr: 0, dc: 1 },
];

/**
 * Board construction is written as generators that `yield` after each unit
 * of work (one arrow placed, one repair move tried). The same code then runs
 * to completion synchronously (`runToEnd`, for scripts) or time-sliced
 * (`runSliced`, in the app) so building a big board never blocks the JS
 * thread for more than a few ms at a time.
 */
type Steps<T> = Generator<void, T, void>;

function runToEnd<T>(steps: Steps<T>): T {
  let next = steps.next();
  while (!next.done) next = steps.next();
  return next.value;
}

/** Lets the JS thread handle taps/frames before work resumes. */
const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Longest stretch of generation work between yields to the event loop. */
const SLICE_MS = 8;

async function runSliced<T>(steps: Steps<T>): Promise<T> {
  let sliceStart = Date.now();
  let next = steps.next();
  while (!next.done) {
    if (Date.now() - sliceStart >= SLICE_MS) {
      await yieldToEventLoop();
      sliceStart = Date.now();
    }
    next = steps.next();
  }
  return next.value;
}

function randInt(rng: RNG, [min, max]: [number, number]): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function shuffled<T>(rng: RNG, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function range(from: number, toExclusive: number): number[] {
  const out: number[] = [];
  const step = from <= toExclusive ? 1 : -1;
  for (let i = from; i !== toExclusive; i += step) out.push(i);
  return out;
}

interface HeadCandidate {
  head: CellIndex;
  dir: Vec;
  /** Cells between the head and the edge -- all already filled. */
  rayLength: number;
}

interface BoardState {
  rows: number;
  cols: number;
  /** Arrow id per cell, or EMPTY. */
  owner: Int32Array;
  /** Lowest arrow id whose exit ray crosses each cell (NO_RAY if none). */
  rayMin: Float64Array;
}

/** Whether arrow `id` may claim `cell` without blocking an earlier-placed arrow's ray. */
function claimable(state: BoardState, cell: CellIndex, id: number): boolean {
  return state.owner[cell] === EMPTY && state.rayMin[cell] > id;
}

function recordRay(state: BoardState, head: CellIndex, dir: Vec, id: number): void {
  const { rows, cols, rayMin } = state;
  const { r, c } = toRowCol(head, cols);
  for (let rr = r + dir.dr, cc = c + dir.dc; inBounds(rows, cols, rr, cc); rr += dir.dr, cc += dir.dc) {
    const cell = toCellIndex(rr, cc, cols);
    rayMin[cell] = Math.min(rayMin[cell], id);
  }
}

function cloneState(state: BoardState, paths: CellIndex[][]): { state: BoardState; paths: CellIndex[][] } {
  return {
    state: { rows: state.rows, cols: state.cols, owner: state.owner.slice(), rayMin: state.rayMin.slice() },
    paths: paths.map((path) => path.slice()),
  };
}

function emptyNeighbors(state: BoardState, cell: CellIndex): number {
  const { rows, cols, owner } = state;
  const { r, c } = toRowCol(cell, cols);
  let count = 0;
  for (const dir of DIRS) {
    const nr = r + dir.dr;
    const nc = c + dir.dc;
    if (inBounds(rows, cols, nr, nc) && owner[toCellIndex(nr, nc, cols)] === EMPTY) count++;
  }
  return count;
}

/**
 * Per direction, whether every cell from here to the edge (this one
 * included) is filled -- O(rows*cols) per direction, so enumerating every
 * legal head stays cheap on the biggest boards.
 */
function filledToEdgeMaps(state: BoardState): Uint8Array[] {
  const { rows, cols, owner } = state;
  return DIRS.map((dir) => {
    const filled = new Uint8Array(rows * cols);
    // Walk from the edge the direction points at back inward, so each
    // cell's answer only depends on its already-computed downstream cell.
    const rOrder = dir.dr > 0 ? range(rows - 1, -1) : range(0, rows);
    const cOrder = dir.dc > 0 ? range(cols - 1, -1) : range(0, cols);
    for (const r of rOrder) {
      for (const c of cOrder) {
        const cell = toCellIndex(r, c, cols);
        if (owner[cell] === EMPTY) continue;
        const nr = r + dir.dr;
        const nc = c + dir.dc;
        filled[cell] = !inBounds(rows, cols, nr, nc) || filled[toCellIndex(nr, nc, cols)] === 1 ? 1 : 0;
      }
    }
    return filled;
  });
}

function rayLengthFrom(rows: number, cols: number, r: number, c: number, dir: Vec): number {
  if (dir.dr < 0) return r;
  if (dir.dr > 0) return rows - 1 - r;
  if (dir.dc < 0) return c;
  return cols - 1 - c;
}

/** Every empty cell that can host a new head: an empty neck behind it and nothing but filled cells out to the edge. */
function headCandidates(state: BoardState, nextId: number): HeadCandidate[] {
  const { rows, cols } = state;
  const filledMaps = filledToEdgeMaps(state);
  const candidates: HeadCandidate[] = [];
  for (let cell = 0; cell < rows * cols; cell++) {
    if (!claimable(state, cell, nextId)) continue;
    const { r, c } = toRowCol(cell, cols);
    DIRS.forEach((dir, d) => {
      const neckR = r - dir.dr;
      const neckC = c - dir.dc;
      if (!inBounds(rows, cols, neckR, neckC) || !claimable(state, toCellIndex(neckR, neckC, cols), nextId)) return;
      const nr = r + dir.dr;
      const nc = c + dir.dc;
      if (inBounds(rows, cols, nr, nc) && filledMaps[d][toCellIndex(nr, nc, cols)] !== 1) return;
      candidates.push({ head: cell, dir, rayLength: rayLengthFrom(rows, cols, r, c, dir) });
    });
  }
  return candidates;
}

function weightedPick<T>(rng: RNG, items: readonly T[], weight: (item: T) => number): T {
  const weights = items.map(weight);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * Grows a body backward from the head (head, neck, ...) through empty cells.
 * One rule keeps the board fillable: if a cell next to the growing end has
 * no other empty neighbor, the body *must* step into it -- walking past
 * would strand it as a hole only this body could ever have reached.
 * Returns head-first.
 */
function growBody(rng: RNG, state: BoardState, candidate: HeadCandidate, id: number, targetLength: number, turnChance: number): CellIndex[] {
  const { rows, cols, owner } = state;
  const head = toRowCol(candidate.head, cols);
  const neck = toCellIndex(head.r - candidate.dir.dr, head.c - candidate.dir.dc, cols);
  const body: CellIndex[] = [candidate.head, neck];
  // Mark as we go so `emptyNeighbors` sees the body as filled.
  owner[candidate.head] = GROWING;
  owner[neck] = GROWING;
  let heading: Vec = { dr: -candidate.dir.dr, dc: -candidate.dir.dc };

  const open = (r: number, c: number): boolean => inBounds(rows, cols, r, c) && claimable(state, toCellIndex(r, c, cols), id);

  for (;;) {
    const cur = toRowCol(body[body.length - 1], cols);
    const options = [heading, { dr: heading.dc, dc: heading.dr }, { dr: -heading.dc, dc: -heading.dr }].filter((dir) =>
      open(cur.r + dir.dr, cur.c + dir.dc)
    );
    if (options.length === 0) break;

    const stranded = options.find((dir) => emptyNeighbors(state, toCellIndex(cur.r + dir.dr, cur.c + dir.dc, cols)) === 0);
    let next: Vec;
    if (stranded) next = stranded;
    else if (body.length >= targetLength) break;
    else {
      const turns = shuffled(rng, options.filter((dir) => dir !== heading));
      const straightOk = options.includes(heading);
      next = straightOk && (turns.length === 0 || rng() >= turnChance) ? heading : turns[0];
    }

    const cell = toCellIndex(cur.r + next.dr, cur.c + next.dc, cols);
    owner[cell] = GROWING;
    body.push(cell);
    heading = next;
  }

  for (const cell of body) owner[cell] = EMPTY;
  return body;
}

/**
 * Places new arrows (in removal order) until no empty cell can host a head
 * with a body of at least `minLength`. Mutates `state` and `paths`.
 */
function* placeArrows(rng: RNG, state: BoardState, paths: CellIndex[][], params: GenerationParams, minLength: number): Steps<boolean> {
  // Heads whose body couldn't reach `minLength`. The board only ever fills
  // up, so one that's too cramped now stays cramped.
  const rejected = new Set<number>();
  const keyOf = (cand: HeadCandidate) => cand.head * 4 + DIRS.indexOf(cand.dir);
  let placedAny = false;

  for (;;) {
    // Candidates only change when an arrow is actually placed, so a rejected
    // pick just drops out of this list rather than forcing a full recompute.
    let candidates = headCandidates(state, paths.length).filter((cand) => !rejected.has(keyOf(cand)));
    let placed = false;
    while (!placed && candidates.length > 0) {
      // Long rays = the arrow waits on many others = deep chains. A ray of 0
      // (head on the edge, pointing out) is a free opener -- keep those rare.
      const candidate = weightedPick(rng, candidates, (cand) => Math.pow(cand.rayLength + 1, params.rayBias));
      const body = growBody(rng, state, candidate, paths.length, randInt(rng, params.lengthRange), params.turnChance);
      if (body.length < minLength) {
        rejected.add(keyOf(candidate));
        candidates = candidates.filter((cand) => cand !== candidate);
        continue;
      }

      const id = paths.length;
      for (const cell of body) state.owner[cell] = id;
      recordRay(state, candidate.head, candidate.dir, id);
      paths.push(body.reverse());
      placed = true;
      placedAny = true;
      yield;
    }
    if (!placed) return placedAny;
  }
}

/** Stretches tails into adjacent claimable cells. Returns whether anything grew. */
function extendTails(rng: RNG, state: BoardState, paths: CellIndex[][], maxLength: number): boolean {
  const { rows, cols, owner } = state;
  let grewAny = false;
  let grew = true;
  while (grew) {
    grew = false;
    for (const id of shuffled(rng, range(0, paths.length))) {
      const path = paths[id];
      if (path.length >= maxLength) continue;
      const tail = toRowCol(path[0], cols);
      for (const dir of shuffled(rng, DIRS)) {
        const r = tail.r + dir.dr;
        const c = tail.c + dir.dc;
        if (!inBounds(rows, cols, r, c) || !claimable(state, toCellIndex(r, c, cols), id)) continue;
        const cell = toCellIndex(r, c, cols);
        path.unshift(cell);
        owner[cell] = id;
        grew = grewAny = true;
        break;
      }
    }
  }
  return grewAny;
}

/**
 * Pushes a head forward into an adjacent hole. The arrow's new ray must
 * still cross only filled cells owned by *earlier* arrows (and never
 * itself) -- otherwise it would wait on something it's meant to precede.
 */
function extendHeadInto(state: BoardState, paths: CellIndex[][], hole: CellIndex): boolean {
  const { rows, cols, owner } = state;
  const { r, c } = toRowCol(hole, cols);
  for (const dir of DIRS) {
    const hr = r - dir.dr;
    const hc = c - dir.dc;
    if (!inBounds(rows, cols, hr, hc)) continue;
    const id = owner[toCellIndex(hr, hc, cols)];
    if (id === EMPTY) continue;
    const path = paths[id];
    if (path[path.length - 1] !== toCellIndex(hr, hc, cols) || !claimable(state, hole, id)) continue;

    let ok = true;
    for (let rr = r + dir.dr, cc = c + dir.dc; inBounds(rows, cols, rr, cc); rr += dir.dr, cc += dir.dc) {
      const blocker = owner[toCellIndex(rr, cc, cols)];
      if (blocker === EMPTY || blocker >= id) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    path.push(hole);
    owner[hole] = id;
    recordRay(state, hole, dir, id);
    return true;
  }
  return false;
}

/**
 * Threads a detour through two adjacent holes: a body step a->b running
 * alongside them becomes a->x->y->b. The head doesn't move, so the arrow's
 * own ray is unchanged.
 */
function detourThroughPair(state: BoardState, paths: CellIndex[][], hole: CellIndex): boolean {
  const { rows, cols, owner } = state;
  const { r, c } = toRowCol(hole, cols);
  for (const toPair of DIRS) {
    const pr = r + toPair.dr;
    const pc = c + toPair.dc;
    if (!inBounds(rows, cols, pr, pc) || owner[toCellIndex(pr, pc, cols)] !== EMPTY) continue;
    const pair = toCellIndex(pr, pc, cols);
    // The body step runs parallel to hole->pair, one row/column over.
    for (const side of [
      { dr: toPair.dc, dc: toPair.dr },
      { dr: -toPair.dc, dc: -toPair.dr },
    ]) {
      const ar = r + side.dr;
      const ac = c + side.dc;
      const br = pr + side.dr;
      const bc = pc + side.dc;
      if (!inBounds(rows, cols, ar, ac) || !inBounds(rows, cols, br, bc)) continue;
      const a = toCellIndex(ar, ac, cols);
      const b = toCellIndex(br, bc, cols);
      const id = owner[a];
      if (id === EMPTY || owner[b] !== id || !claimable(state, hole, id) || !claimable(state, pair, id)) continue;
      const path = paths[id];
      const ia = path.indexOf(a);
      const ib = path.indexOf(b);
      if (Math.abs(ia - ib) !== 1) continue;
      const [first, second] = ia < ib ? [hole, pair] : [pair, hole];
      path.splice(Math.max(ia, ib), 0, first, second);
      owner[hole] = id;
      owner[pair] = id;
      return true;
    }
  }
  return false;
}

function holesOf(state: BoardState): CellIndex[] {
  const holes: CellIndex[] = [];
  for (let cell = 0; cell < state.owner.length; cell++) if (state.owner[cell] === EMPTY) holes.push(cell);
  return holes;
}

/** Shortest arrow a gap-filling pass may add. */
const FILL_MIN_LENGTH = 2;

/**
 * Fills whatever it can: short gap-filler arrows, tails stretched without
 * the length cap, heads pushed into holes they face, and detours threaded
 * through pairs of holes -- repeated until a full round changes nothing.
 */
function* fillGaps(rng: RNG, state: BoardState, paths: CellIndex[][], params: GenerationParams): Steps<void> {
  let progressed = true;
  while (progressed) {
    progressed = yield* placeArrows(rng, state, paths, params, FILL_MIN_LENGTH);
    progressed = extendTails(rng, state, paths, Number.POSITIVE_INFINITY) || progressed;
    for (const hole of holesOf(state)) {
      if (state.owner[hole] !== EMPTY) continue;
      progressed = extendHeadInto(state, paths, hole) || detourThroughPair(state, paths, hole) || progressed;
    }
  }
}

/**
 * On a full board the only free arrows are heads on the edge pointing out.
 * Each one gets flipped end-for-end when its old tail would make a valid
 * head: the new ray must cross only arrows that leave earlier (never
 * itself). It keeps its place in the removal order, so the board stays
 * solvable, but it no longer opens for free. Arrow 0 can never flip (no
 * arrow leaves before it), so at least one opener always remains.
 */
function reaimOpeners(state: BoardState, paths: CellIndex[][]): void {
  const { rows, cols, owner } = state;
  paths.forEach((path, id) => {
    const head = toRowCol(path[path.length - 1], cols);
    const neck = toRowCol(path[path.length - 2], cols);
    if (rayLengthFrom(rows, cols, head.r, head.c, { dr: head.r - neck.r, dc: head.c - neck.c }) > 0) return;

    const tail = toRowCol(path[0], cols);
    const afterTail = toRowCol(path[1], cols);
    const dir: Vec = { dr: tail.r - afterTail.r, dc: tail.c - afterTail.c };
    if (rayLengthFrom(rows, cols, tail.r, tail.c, dir) === 0) return;
    for (let r = tail.r + dir.dr, c = tail.c + dir.dc; inBounds(rows, cols, r, c); r += dir.dr, c += dir.dc) {
      const blocker = owner[toCellIndex(r, c, cols)];
      if (blocker < 0 || blocker >= id) return;
    }
    path.reverse();
    recordRay(state, path[path.length - 1], dir, id);
  });
}

/**
 * Cheaper refill for the handful of cells a repair move frees: stretch
 * tails, push heads, thread detours -- and only scan the whole board for
 * new heads (the costly part) if that still leaves holes.
 */
function* patchGaps(rng: RNG, state: BoardState, paths: CellIndex[][], params: GenerationParams): Steps<void> {
  let progressed = true;
  while (progressed) {
    progressed = extendTails(rng, state, paths, Number.POSITIVE_INFINITY);
    for (const hole of holesOf(state)) {
      if (state.owner[hole] !== EMPTY) continue;
      progressed = extendHeadInto(state, paths, hole) || detourThroughPair(state, paths, hole) || progressed;
    }
  }
  if (holesOf(state).length > 0) yield* fillGaps(rng, state, paths, params);
}

/** Repair moves tried per hole left after the main fill, before giving up on the board. */
const REPAIR_STEPS_PER_HOLE = 60;

/**
 * Isolated single holes are usually touched only by some arrow's mid-body,
 * which none of `fillGaps`' moves can use. Repair re-routes that arrow: its
 * tail now starts in the hole and runs straight into the body at that
 * point, freeing the stretch of tail behind it. The freed cells then go
 * through `patchGaps`. A move is kept only if it doesn't add holes, so
 * holes wander around the board until they merge into a pair or reach a
 * spot that can be filled. Mutates `state`/`paths`; returns holes left.
 */
function* repairHoles(rng: RNG, state: BoardState, paths: CellIndex[][], params: GenerationParams): Steps<number> {
  let holes = holesOf(state);
  const budget = holes.length * REPAIR_STEPS_PER_HOLE;
  const { rows, cols } = state;

  for (let step = 0; step < budget && holes.length > 0; step++) {
    yield;
    const hole = holes[Math.floor(rng() * holes.length)];
    const { r, c } = toRowCol(hole, cols);

    // Every body cell next to the hole (never the head, so the arrow keeps
    // its head and ray) where the arrow could be re-routed to start here.
    const cuts: Array<{ id: number; at: number }> = [];
    for (const dir of DIRS) {
      const nr = r + dir.dr;
      const nc = c + dir.dc;
      if (!inBounds(rows, cols, nr, nc)) continue;
      const id = state.owner[toCellIndex(nr, nc, cols)];
      if (id < 0 || !claimable(state, hole, id)) continue;
      const at = paths[id].indexOf(toCellIndex(nr, nc, cols));
      if (at >= 1 && at <= paths[id].length - 2) cuts.push({ id, at });
    }
    if (cuts.length === 0) continue;

    // Prefer short cuts -- they free fewer cells, so the board changes less.
    const cut = weightedPick(rng, cuts, (option) => 1 / option.at);
    const trial = cloneState(state, paths);
    const path = trial.paths[cut.id];
    for (const freed of path.slice(0, cut.at)) trial.state.owner[freed] = EMPTY;
    trial.paths[cut.id] = [hole, ...path.slice(cut.at)];
    trial.state.owner[hole] = cut.id;
    yield* patchGaps(rng, trial.state, trial.paths, params);

    const trialHoles = holesOf(trial.state);
    if (trialHoles.length > holes.length) continue;
    state.owner = trial.state.owner;
    state.rayMin = trial.state.rayMin;
    paths.splice(0, paths.length, ...trial.paths);
    holes = trialHoles;
  }
  return holes.length;
}

/**
 * Builds a solvable board in removal order (see top of file), then works to
 * leave no cell empty:
 * 1. Place arrows at the tier's lengths, stretching tails between rounds --
 *    longer tails turn previously cramped gaps into room for new heads.
 * 2. `fillGaps` plugs what's left, then `repairHoles` re-routes arrows
 *    around any isolated holes that remain.
 * Returns the arrows plus how many cells are still empty -- callers reject
 * any board with holes left.
 */
function* buildArrows(rng: RNG, rows: number, cols: number, params: GenerationParams): Steps<{ arrows: Arrow[]; holes: number }> {
  const state: BoardState = { rows, cols, owner: new Int32Array(rows * cols).fill(EMPTY), rayMin: new Float64Array(rows * cols).fill(NO_RAY) };
  const paths: CellIndex[][] = [];

  let progressed = true;
  while (progressed) {
    const placed = yield* placeArrows(rng, state, paths, params, params.lengthRange[0]);
    const grew = extendTails(rng, state, paths, params.maxStretch);
    progressed = placed || grew;
  }

  yield* fillGaps(rng, state, paths, params);
  const holes = yield* repairHoles(rng, state, paths, params);
  if (holes === 0) reaimOpeners(state, paths);
  return { arrows: paths.map((path, id) => ({ id, path })), holes };
}

export function constructArrows(rng: RNG, rows: number, cols: number, params: GenerationParams): { arrows: Arrow[]; holes: number } {
  return runToEnd(buildArrows(rng, rows, cols, params));
}

export interface Candidate {
  level: ArrowsLevel;
  analysis: ClearAnalysis;
}

export interface GenerateSuccess extends Candidate {
  attempts: number;
}

export interface GenerateFailure {
  error: 'gates-not-met';
  attempts: number;
  /** Strongest full board seen (same tier/size), for the robust wrapper's last resort. */
  best: Candidate | null;
}

/** Higher = harder; used only to rank full boards that missed a depth gate. */
function scoreOf(candidate: Candidate): number {
  const freeRatio = candidate.analysis.initiallyFree / candidate.level.arrows.length;
  return candidate.analysis.rounds - freeRatio * 10;
}

export function passesGates(candidate: Candidate, params: GenerationParams): boolean {
  const { analysis, level } = candidate;
  return analysis.solvable && analysis.rounds >= params.minRounds && analysis.initiallyFree / level.arrows.length <= params.maxFreeRatio;
}

type AttemptResult = { kind: 'pass' | 'miss'; candidate: Candidate } | { kind: 'skip' };

/** One generation attempt: build a board, then check it against the tier's gates. */
function* runAttempt(rng: RNG, params: GenerationParams, recent: ReadonlySet<string>): Steps<AttemptResult> {
  const rows = randInt(rng, params.rowsRange);
  const cols = randInt(rng, params.colsRange);
  const { arrows, holes } = yield* buildArrows(rng, rows, cols, params);
  if (holes > 0) return { kind: 'skip' }; // every cell filled is a hard requirement
  const level: ArrowsLevel = { rows, cols, arrows, tier: params.tier };
  const candidate: Candidate = { level, analysis: analyzeClearing(level) };
  if (!candidate.analysis.solvable) return { kind: 'skip' }; // impossible by construction -- defensive
  if (recent.has(fingerprintArrows(level))) return { kind: 'skip' };
  return { kind: passesGates(candidate, params) ? 'pass' : 'miss', candidate };
}

function betterOf(best: Candidate | null, candidate: Candidate): Candidate {
  return !best || scoreOf(candidate) > scoreOf(best) ? candidate : best;
}

export function generateArrowsLevel(
  rng: RNG,
  params: GenerationParams,
  recentFingerprints: readonly string[],
  maxAttempts: number
): GenerateSuccess | GenerateFailure {
  const recent = new Set(recentFingerprints);
  let best: Candidate | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = runToEnd(runAttempt(rng, params, recent));
    if (result.kind === 'pass') return { ...result.candidate, attempts: attempt };
    if (result.kind === 'miss') best = betterOf(best, result.candidate);
  }
  return { error: 'gates-not-met', attempts: maxAttempts, best };
}

/**
 * Same search as `generateArrowsLevel` (same seed -> same board), but
 * time-sliced. Big boards take tens of ms per attempt (more on a phone than
 * in Node), and the next level is generated in the background while the
 * player is mid-level -- so no stretch of work may freeze the board's taps.
 */
export async function generateArrowsLevelAsync(
  rng: RNG,
  params: GenerationParams,
  recentFingerprints: readonly string[],
  maxAttempts: number
): Promise<GenerateSuccess | GenerateFailure> {
  const recent = new Set(recentFingerprints);
  let best: Candidate | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await runSliced(runAttempt(rng, params, recent));
    if (result.kind === 'pass') return { ...result.candidate, attempts: attempt };
    if (result.kind === 'miss') best = betterOf(best, result.candidate);
  }
  return { error: 'gates-not-met', attempts: maxAttempts, best };
}
