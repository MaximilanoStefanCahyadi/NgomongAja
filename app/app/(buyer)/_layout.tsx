import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/lib/auth-context';

// Guard: only logged-in BUYERS may be here.
export default function BuyerLayout() {
  const { session, profile, loading } = useAuth();

  if (loading) return null;
  if (!session || !profile) return <Redirect href="/(auth)/login" />;
  if (profile.role !== 'buyer') return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
