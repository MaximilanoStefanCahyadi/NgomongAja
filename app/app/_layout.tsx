import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
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
  // Brand fonts: Plus Jakarta Sans for headings and buttons, Inter for the rest.
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    Inter_400Regular,
    Inter_600SemiBold,
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
        <ActivityIndicator size="large" color={colors.primaryInk} />
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
