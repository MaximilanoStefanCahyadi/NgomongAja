import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/lib/auth-context';

// Guard: only logged-in SELLERS may be here.
export default function SellerLayout() {
  const { session, profile, loading } = useAuth();

  if (loading) return null;
  if (!session || !profile) return <Redirect href="/(auth)/login" />;
  if (profile.role !== 'seller') return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
