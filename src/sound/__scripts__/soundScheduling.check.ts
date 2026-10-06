/**
 * Assertion checks for sound-effect scheduling: round-robin voice pick and
 * the per-sound minimum gap that keeps fast drags from buzzing.
 * Rerun whenever soundScheduling.ts changes.
 *
 * Run with: npx tsx src/sound/__scripts__/soundScheduling.check.ts
 */
import { decidePlay, INITIAL_VOICE_STATE } from '../soundScheduling';

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// First play always goes through on voice 0.
const first = decidePlay(INITIAL_VOICE_STATE, 1000, 3, 40);
check(first.play && first.voice === 0, 'first play uses voice 0');
if (!first.play) throw new Error('unreachable');

// Inside the gap: dropped.
check(!decidePlay(first.next, 1020, 3, 40).play, 'repeat inside minGap is dropped');

// At the gap boundary: plays on the next voice.
const second = decidePlay(first.next, 1040, 3, 40);
check(second.play && second.voice === 1, 'repeat at minGap uses next voice');
if (!second.play) throw new Error('unreachable');

// Round-robin wraps.
const third = decidePlay(second.next, 2000, 3, 40);
if (!third.play) throw new Error('third should play');
const fourth = decidePlay(third.next, 3000, 3, 40);
check(third.voice === 2 && fourth.play && fourth.voice === 0, 'voices wrap round-robin');

// Single-voice sounds always reuse voice 0.
const solo = decidePlay(INITIAL_VOICE_STATE, 0, 1, 0);
if (!solo.play) throw new Error('solo should play');
const soloAgain = decidePlay(solo.next, 10, 1, 0);
check(soloAgain.play && soloAgain.voice === 0, 'single voice reuses 0');

// No players loaded: never plays.
check(!decidePlay(INITIAL_VOICE_STATE, 0, 0, 0).play, 'zero voices never plays');

console.log('soundScheduling: all checks passed');
