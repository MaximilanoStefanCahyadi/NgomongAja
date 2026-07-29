import { useLocalSearchParams } from 'expo-router';

import { OrderChat } from '@/components/order-chat';
import { ListState, Screen, ScreenHeader } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

// Thin wrapper: the shared OrderChat component does all the work.
export default function SellerOrderChat() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { profile } = useAuth();

  if (!orderId || !profile) {
    return (
      <Screen centered>
        <ListState state="loading" message="Memuat obrolan…" />
      </Screen>
    );
  }

  return (
    <Screen keyboard edges={{ top: true, bottom: true }}>
      <ScreenHeader title="Chat Pembeli" backLabel="Pesanan" />
      <OrderChat orderId={orderId} myId={profile.id} />
    </Screen>
  );
}
