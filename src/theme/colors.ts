// Design tokens ported 1:1 from the relay-app-prototype_1.html CSS custom properties,
// so any game built under src/games/** can share one consistent look.
export const colors = {
  bg: '#0b0d12',
  bgDeep: '#05060a',
  surface: '#141822',
  surface2: '#1b202c',
  surface3: '#232a38',
  border: '#262c3a',
  borderSoft: '#1d2230',
  text: '#eef0f6',
  textDim: '#9aa3b5',
  textFaint: '#5c6478',
  accent: '#3563e9',
  accentBright: '#5b82f5',
  signalBlue: '#4da3ff',
  signalRed: '#ff5c5c',
  signalBlueMuted: '#a6d1ff',
  signalRedMuted: '#ffadad',
  success: '#27b877',
  warn: '#ffb020',
  gold: '#ffd35c',
  purple: '#a855f7',
  cyan: '#22d3ee',
  pink: '#f472b6',
};

export const fonts = {
  display: 'System', // swap for Space Grotesk via expo-font later if desired
  body: 'System',
  mono: 'Menlo', // closest built-in monospace stand-in for JetBrains Mono
};

export const radii = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 22,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 26,
};
