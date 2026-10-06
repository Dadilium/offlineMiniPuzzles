# Sound Effects

**Status:** implemented 2026-10-06 (needs the next EAS build)
**Priority:** 3

## Why
Haptics exist but there is no audio. Soft click / place / error / win sounds make a big difference to perceived polish.

## What shipped
- `expo-audio`, configured with no mic permission and no background playback (`app.json` plugin options).
- Sounds are synthesized, not sampled: `tools/sound-synth/recipes.ts` -> `npm run sounds` -> `assets/sounds/*.wav`.
  Ids: `tap`, `place`, `match`, `error`, `win`, `fail`.
- `src/sound/soundEngine.ts`: module-level `playSound(id)`, native-module guard, preloaded player pool per sound,
  per-sound min gap so fast drags don't buzz (pure logic in `soundScheduling.ts`, checked by `__scripts__/soundScheduling.check.ts`).
- Respects the iOS silent switch and mixes with the player's own music.
- `SoundProvider` + Settings toggle ("Sound effects", on by default).
- Wired next to existing haptics in every game's move handlers, plus win/fail overlays, difficulty selector and daily cards.
