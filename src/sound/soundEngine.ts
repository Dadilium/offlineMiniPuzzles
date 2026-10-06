import { Platform } from 'react-native';
import { SOUNDS, SOUND_IDS, type SoundId } from './soundCatalog';
import { decidePlay, INITIAL_VOICE_STATE, type VoiceState } from './soundScheduling';

// A static `import` throws at bundle-evaluation time if the native module
// isn't linked into the running binary -- and an OTA update can reach an
// older binary that predates expo-audio. Same guard as
// reminders/notifications.ts: degrade to "no sound" instead of crashing.
let Audio: typeof import('expo-audio') | null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Audio = require('expo-audio');
} catch {
  Audio = null;
}

type Player = import('expo-audio').AudioPlayer;

let enabled = false;
let players: Partial<Record<SoundId, Player[]>> = {};
const voiceStates: Partial<Record<SoundId, VoiceState>> = {};
let initPromise: Promise<void> | null = null;

export function soundsAvailable(): boolean {
  return Audio !== null && Platform.OS !== 'web';
}

/**
 * Configures the audio session once and preloads every sound, so the first
 * tap of a session isn't delayed by decoding. Sound effects:
 * - respect the iOS silent switch (`playsInSilentMode: false`),
 * - mix with the player's own music/podcast instead of pausing it.
 */
function init(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!Audio || !soundsAvailable()) return;
    try {
      await Audio.setAudioModeAsync({
        playsInSilentMode: false,
        interruptionMode: 'mixWithOthers',
        shouldPlayInBackground: false,
        allowsRecording: false,
      });
      const audio = Audio;
      players = Object.fromEntries(
        SOUND_IDS.map((id) => [id, Array.from({ length: SOUNDS[id].voices }, () => audio.createAudioPlayer(SOUNDS[id].source))])
      );
    } catch {
      players = {};
    }
  })();
  return initPromise;
}

/** Driven by `SoundProvider` from the player's Settings choice. */
export function setSoundsEnabled(value: boolean): void {
  enabled = value;
  if (value) void init();
}

/** Fire-and-forget: safe to call from any handler, never throws. */
export function playSound(id: SoundId): void {
  if (!enabled) return;
  const pool = players[id];
  if (!pool || pool.length === 0) return;

  const decision = decidePlay(voiceStates[id] ?? INITIAL_VOICE_STATE, Date.now(), pool.length, SOUNDS[id].minGapMs);
  if (!decision.play) return;
  voiceStates[id] = decision.next;

  const player = pool[decision.voice];
  try {
    // Rewind first: a player that already finished stays parked at its end.
    void player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    // A failed effect must never interrupt gameplay.
  }
}
