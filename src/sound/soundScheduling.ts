/**
 * Pure decisions behind `playSound` -- kept free of expo-audio so they can be
 * checked by `__scripts__/soundScheduling.check.ts`.
 */

export interface VoiceState {
  /** Next player index to use, round-robin. */
  nextVoice: number;
  /** When this sound last started (ms epoch), or null if never. */
  lastPlayedAt: number | null;
}

export const INITIAL_VOICE_STATE: VoiceState = { nextVoice: 0, lastPlayedAt: null };

export type PlayDecision = { play: false } | { play: true; voice: number; next: VoiceState };

export function decidePlay(state: VoiceState, now: number, voices: number, minGapMs: number): PlayDecision {
  if (voices <= 0) return { play: false };
  if (state.lastPlayedAt !== null && now - state.lastPlayedAt < minGapMs) return { play: false };
  const voice = state.nextVoice % voices;
  return { play: true, voice, next: { nextVoice: (voice + 1) % voices, lastPlayedAt: now } };
}
