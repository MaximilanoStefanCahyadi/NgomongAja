import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OrderChat } from '@/components/order-chat';
import { useAuth } from '@/lib/auth-context';
import { colors } from '@/lib/theme';

export default function BuyerOrderChat() {
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { profile } = useAuth();

  if (!orderId || !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backWrap}>
          <Text style={styles.back}>‹ Pesanan</Text>
        </Pressable>
        <Text style={styles.title}>Chat Penjual</Text>
      </View>
      <OrderChat orderId={orderId} myId={profile.id} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
    gap: 4,
  },
  backWrap: { alignSelf: 'flex-start', paddingVertical: 6 },
  back: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: 'bold', color: colors.text },
});
