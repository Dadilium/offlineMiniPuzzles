// Static design tokens shared by both themes -- font families, radii, and
// spacing don't vary between light and dark, so they stay plain constants.
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
