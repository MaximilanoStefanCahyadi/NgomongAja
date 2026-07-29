import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { colors } from '@/lib/theme';

// Entry point: decides where the user lands when the app opens.
export default function Index() {
  const { session, profile, loading } = useAuth();

  if (loading) {
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

  if (!session || !profile) return <Redirect href="/(auth)/login" />;
  if (profile.role === 'seller') return <Redirect href="/(seller)" />;
  return <Redirect href="/(buyer)" />;
}
