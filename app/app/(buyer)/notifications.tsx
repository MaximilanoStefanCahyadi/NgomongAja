import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { ListState, Row, Screen, ScreenHeader } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import {
  listNotifications,
  markAllRead,
  type AppNotification,
} from '@/lib/notifications';
import { colors, radius } from '@/lib/theme';

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Kemarin';
  return `${days} hari lalu`;
}

export default function Notifications() {
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await listNotifications();
      setItems(rows);
      setError(null);
      // Mark read AFTER rendering, so the unread dots are visible on this
      // pass and only gone next time — otherwise opening the inbox erases
      // the very thing the buyer came to look at.
      if (rows.some((r) => !r.read_at)) {
        markAllRead().catch((e) => console.warn('markAllRead:', e.message));
      }
    } catch (e) {
      setError(friendlyError(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <Screen>
      <ScreenHeader title="Pemberitahuan" backLabel="Beranda" />

      {error ? (
        <ListState state="error" message={error} action={{ label: 'Coba Lagi', onPress: load }} />
      ) : !items ? (
        <ListState state="loading" message="Memuat…" />
      ) : items.length === 0 ? (
        <ListState
          state="empty"
          icon="bell"
          title="Belum ada kabar"
          message="Nanti kalau ada pesanan masuk atau berubah, kami kabari di sini."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryInk} />
          }
          renderItem={({ item }) => (
            <Row
              title={item.title}
              meta={`${item.body ? `${item.body} · ` : ''}${timeAgo(item.created_at)}`}
              accessibilityLabel={`${item.read_at ? '' : 'Belum dibaca. '}${item.title}. ${item.body ?? ''} ${timeAgo(item.created_at)}`}
              onPress={
                item.order_id
                  ? () =>
                      router.push({
                        pathname: '/(buyer)/order/[orderId]',
                        params: { orderId: item.order_id! },
                      })
                  : undefined
              }
              leading={
                <View style={[styles.tile, !item.read_at && styles.tileUnread]}>
                  <Feather
                    name={item.kind === 'order_new' ? 'shopping-bag' : 'bell'}
                    size={18}
                    color={item.read_at ? colors.secondary : colors.primaryInk}
                  />
                </View>
              }
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.neutralBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Unread is carried by the fill AND the icon colour, never colour alone —
  // the accessibilityLabel says "Belum dibaca" too.
  tileUnread: { backgroundColor: colors.primarySoft },
});
