import { useMemo } from 'react';
import { Stack } from 'expo-router';
import { getLandscapeStackScreenOptions } from '@/lib/navigation/landscapeStack';
import { useThemeStore } from '@/store/theme';
import { HOME_SOFT_UI } from '@/themes';

export default function AppLayout() {
  useThemeStore((state) => state.paletteId);
  const canvas = HOME_SOFT_UI.colors.canvas;
  const stackScreenOptions = useMemo(
    () => getLandscapeStackScreenOptions(canvas),
    [canvas]
  );

  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="store" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="play" />
      <Stack.Screen name="game" />
      <Stack.Screen name="create-game" />
      <Stack.Screen name="rules" />
      <Stack.Screen name="theme-picker" />
      <Stack.Screen name="lobby-settings" />
      <Stack.Screen name="game-recap" />
      <Stack.Screen name="language-picker" />
      <Stack.Screen name="content-languages-picker" />
    </Stack>
  );
}
