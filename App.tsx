import './src/i18n';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { ToastProvider } from './src/components/Toast';
import { colors } from './src/theme/colors';

export default function App() {
  const navTheme = {
    dark: true,
    colors: {
      primary: colors.accent,
      background: colors.bgDeep,
      card: colors.bg,
      text: colors.text,
      border: colors.border,
      notification: colors.accentBright,
    },
  };

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
