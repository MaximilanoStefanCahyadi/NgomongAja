import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/lib/auth-context';

// Guard: a logged-in user has no business on login/register screens —
// send them straight to their home. "/" re-routes by role.
export default function AuthLayout() {
  const { session, profile, loading } = useAuth();

  if (!loading && session && profile) return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
