import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LibraryScreen from '../screens/LibraryScreen';
import { games } from '../games/registry';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Wraps `children` with every game's state Provider, innermost-last. */
function GameProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {games.reduce<React.ReactNode>((acc, game) => {
        const Provider = game.Provider;
        return Provider ? <Provider>{acc}</Provider> : acc;
      }, children)}
    </>
  );
}

export default function RootNavigator() {
  return (
    <GameProviders>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Library" component={LibraryScreen} />
        {games.flatMap((game) =>
          game.screens.map((screen) => (
            <Stack.Screen key={screen.name} name={screen.name as any} component={screen.component} />
          ))
        )}
      </Stack.Navigator>
    </GameProviders>
  );
}
