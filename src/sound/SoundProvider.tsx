import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setSoundsEnabled, soundsAvailable } from './soundEngine';
import { getStoredSoundEnabled, setStoredSoundEnabled } from './soundPreference';

interface SoundContextValue {
  /** False on a binary without expo-audio (reachable via OTA) -- hide the Settings toggle. */
  available: boolean;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

const SoundContext = createContext<SoundContextValue | null>(null);

const DEFAULT_ENABLED = true;

/**
 * Owns the sound on/off preference and mirrors it into the module-level
 * engine, so game state hooks can call `playSound` directly without
 * threading a context through every handler.
 */
export function SoundProvider({ children }: { children: React.ReactNode }) {
  const available = soundsAvailable();
  const [enabled, setEnabledState] = useState(DEFAULT_ENABLED);

  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    getStoredSoundEnabled()
      .catch(() => null)
      .then((stored) => {
        if (cancelled) return;
        const value = stored ?? DEFAULT_ENABLED;
        setEnabledState(value);
        setSoundsEnabled(value);
      });
    return () => {
      cancelled = true;
    };
  }, [available]);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    setSoundsEnabled(value);
    setStoredSoundEnabled(value);
  }, []);

  const value = useMemo(() => ({ available, enabled, setEnabled }), [available, enabled, setEnabled]);
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound(): SoundContextValue {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error('useSound must be used within SoundProvider');
  return ctx;
}
