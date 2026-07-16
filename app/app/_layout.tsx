import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AuthProvider } from '@/lib/auth-context';
import { colors } from '@/lib/theme';

// The app is designed light-only (warm off-white surfaces, dark text).
// Pinning DefaultTheme prevents unreadable dark-mode defaults.
const lightTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg },
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider value={lightTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
        <StatusBar style="dark" />
      </ThemeProvider>
    </AuthProvider>
  );
}
