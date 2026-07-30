import { Redirect, Tabs } from 'expo-router';
import { useState } from 'react';

import { BuyerTabBar } from '@/components/ui';
import { WarungPicker } from '@/components/warung-picker';
import { useAuth } from '@/lib/auth-context';

// Guard: only logged-in BUYERS may be here.
export default function BuyerLayout() {
  const { session, profile, loading } = useAuth();
  const [picking, setPicking] = useState(false);

  if (loading) return null;
  if (!session || !profile) return <Redirect href="/(auth)/login" />;
  if (profile.role !== 'buyer') return <Redirect href="/" />;

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <BuyerTabBar {...props} onMicPress={() => setPicking(true)} />}>
        <Tabs.Screen name="index" options={{ title: 'Beranda' }} />
        <Tabs.Screen name="orders" options={{ title: 'Riwayat' }} />
        <Tabs.Screen name="search" options={{ title: 'Cari' }} />
        <Tabs.Screen name="profile" options={{ title: 'Saya' }} />

        {/* Pushed on top of the tabs, not tabs themselves — they need a
            store/order id and must not appear in the bar. */}
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="store/[id]/index" options={{ href: null }} />
        <Tabs.Screen name="store/[id]/order" options={{ href: null }} />
        <Tabs.Screen name="store/[id]/review" options={{ href: null }} />
        <Tabs.Screen name="order/[orderId]/index" options={{ href: null }} />
        <Tabs.Screen name="order/[orderId]/chat" options={{ href: null }} />
      </Tabs>

      {/* Lives at the layout so the mic works from any tab. */}
      <WarungPicker visible={picking} onClose={() => setPicking(false)} />
    </>
  );
}
