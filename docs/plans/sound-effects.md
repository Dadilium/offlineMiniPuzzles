# Sound Effects

**Status:** proposed
**Priority:** 3

## Why
Haptics exist but there is no audio. Soft click / place / error / win sounds make a big difference to perceived polish.

## Idea
- Use `expo-audio`.
- Small shared sound service (`play('place' | 'error' | 'win' | ...)`) used by all games.
- Settings toggle (and respect the device's silent mode).

## Notes
- New native dependency → needs an EAS build (capped at 10/month). Bundle it with the next build that's needed anyway.
- Import behind the native-module guard pattern (`require` + `try/catch`) so an OTA update running on an older binary doesn't crash.
