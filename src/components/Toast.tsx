import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { fonts } from '../theme/tokens';
import { createThemedStyles } from '../theme/createThemedStyles';

type ToastContextValue = {
  showToast: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  const [message, setMessage] = useState('');
  const opacity = useSharedValue(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setMessage(msg);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    opacity.value = withTiming(1, { duration: 160 });
    hideTimer.current = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 220 });
    }, 1800);
  }, [opacity]);

  const toastStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Animated.View pointerEvents="none" style={[styles.toast, toastStyle]}>
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </ToastContext.Provider>
  );
}

// This chip always uses a fixed dark background (rather than the active
// theme's surface color) so its light text stays legible as a floating
// snackbar regardless of whether the app is in light or dark mode.
const useStyles = createThemedStyles(() => ({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 56,
    backgroundColor: '#20242f',
    borderWidth: 1,
    borderColor: '#262c3a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    zIndex: 999,
  },
  text: {
    color: '#eef0f6',
    fontFamily: fonts.body,
    fontSize: 12,
  },
}));
