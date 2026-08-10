import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { darkPalette, lightPalette, type Palette } from './palettes';
import { getStoredThemeMode, setStoredThemeMode, type ThemeMode } from './themePreference';

type ThemeContextValue = {
  colors: Palette;
  scheme: 'light' | 'dark';
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    getStoredThemeMode().then((stored) => {
      if (stored) setModeState(stored);
    });
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    setStoredThemeMode(next);
  };

  const scheme: 'light' | 'dark' = mode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : mode;
  const colors = scheme === 'light' ? lightPalette : darkPalette;

  const value = useMemo(() => ({ colors, scheme, mode, setMode }), [colors, scheme, mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used within a ThemeProvider');
  return value;
}
