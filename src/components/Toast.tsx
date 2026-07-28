import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../theme/colors';

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
  const [message, setMessage] = useState('');
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setMessage(msg);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    hideTimer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }, 1800);
  }, [opacity]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Animated.View pointerEvents="none" style={[styles.toast, { opacity }]}>
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 56,
    backgroundColor: '#20242f',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    zIndex: 999,
  },
  text: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 12,
  },
});
