import { Caprasimo_400Regular } from '@expo-google-fonts/caprasimo';
import {
  Figtree_400Regular,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from '@expo-google-fonts/figtree';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { AuthProvider } from '@/lib/auth-context';
import { colors } from '@/lib/theme';

// The app is designed light-only (warm paper surfaces, dark ink text).
// Pinning DefaultTheme prevents unreadable dark-mode defaults.
const lightTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg },
};

export default function RootLayout() {
  // Design fonts (Hijau Rupiah): Caprasimo for display, Figtree for body.
  const [fontsLoaded] = useFonts({
    Caprasimo_400Regular,
    Figtree_400Regular,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.bg,
        }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

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
