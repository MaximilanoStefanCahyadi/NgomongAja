import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { OrderChat } from '@/components/order-chat';
import { useAuth } from '@/lib/auth-context';

export default function BuyerOrderChat() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { profile } = useAuth();

  if (!orderId || !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ Kembali</Text>
        </Pressable>
        <Text style={styles.title}>Chat Pesanan</Text>
      </View>
      <OrderChat orderId={orderId} myId={profile.id} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
    gap: 4,
  },
  back: { color: '#16a34a', fontSize: 16 },
  title: { fontSize: 20, fontWeight: 'bold' },
});
