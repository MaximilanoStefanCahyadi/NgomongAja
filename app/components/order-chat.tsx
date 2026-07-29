import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';

import { Button, Card, Field, ListState, Text } from '@/components/ui';
import {
  getOrCreateChat,
  listMessages,
  sendMessage,
  subscribeToMessages,
  type Message,
} from '@/lib/chat';
import { colors, elevation, radius, spacing } from '@/lib/theme';

// One chat per order, shared by buyer and seller screens.
// Message types: text (bubbles), payment_request (warn card), system (note).
export function OrderChat({ orderId, myId }: { orderId: string; myId: string }) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [initFailed, setInitFailed] = useState(false);
  const listRef = useRef<FlatList>(null);

  const initChat = () => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const id = await getOrCreateChat(orderId);
      if (cancelled) return;
      setInitFailed(false);
      setChatId(id);
      setMessages(await listMessages(id));
      unsubscribe = subscribeToMessages(id, async () => {
        setMessages(await listMessages(id));
      });
    })().catch((e) => {
      console.warn('chat init:', e.message);
      if (!cancelled) setInitFailed(true);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  };

  useEffect(initChat, [orderId]);

  const submit = async () => {
    if (!chatId || !draft.trim()) return;
    const text = draft.trim();
    setSending(true);
    try {
      await sendMessage(chatId, myId, text);
      setDraft('');
      setMessages(await listMessages(chatId)); // realtime also fires; this is instant
    } catch (e: any) {
      console.warn('sendMessage:', e.message);
      // Never fail silently — the buyer must not think the seller ignored them.
      // Keep the draft so they can just tap Kirim again.
      Alert.alert('Pesan belum terkirim', 'Periksa internetmu, lalu tekan Kirim lagi.');
    } finally {
      setSending(false);
    }
  };

  if (initFailed) {
    return (
      <View style={styles.stateWrap}>
        <ListState
          state="error"
          title="Gagal memuat obrolan"
          message="Periksa internetmu, lalu coba lagi."
          action={{ label: 'Coba Lagi', onPress: initChat }}
        />
      </View>
    );
  }

  if (!chatId) {
    return (
      <View style={styles.stateWrap}>
        <ListState state="loading" message="Memuat obrolan…" />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <ListState
            state="empty"
            icon="message-circle"
            title="Belum ada pesan"
            message="Sapa dulu yuk."
          />
        }
        renderItem={({ item: m }) => {
          if (m.type === 'system') {
            return (
              <View style={styles.systemNote}>
                <Text variant="meta" color="secondary" align="center">
                  {m.body}
                </Text>
              </View>
            );
          }
          if (m.type === 'payment_request') {
            // One signal, not four: the warn tint + its left rule say
            // "needs attention" on their own — no border, no uppercase
            // tracking, no amber body copy on top of it.
            return (
              <Card tone="warn" gap={spacing.xs} style={styles.paymentRequest}>
                <Text variant="bodyStrong" color="warn">
                  Permintaan pembayaran
                </Text>
                <Text variant="body" color="warn">
                  {m.body}
                </Text>
              </Card>
            );
          }
          const mine = m.sender_id === myId;
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <Text variant="body" color={mine ? 'onPrimary' : 'text'}>
                {m.body}
              </Text>
            </View>
          );
        }}
      />

      <View style={styles.composer}>
        <Field
          multiline
          placeholder="Tulis pesan…"
          value={draft}
          onChangeText={setDraft}
          accessibilityLabel="Tulis pesan"
          containerStyle={styles.composerField}
          style={styles.composerInput}
        />
        <Button
          label="Kirim"
          icon="send"
          onPress={submit}
          size="md"
          fullWidth={false}
          loading={sending}
          disabled={!draft.trim()}
          accessibilityLabel="Kirim pesan"
        />
      </View>
    </View>
  );
}

// Chat bubbles are genuinely screen-specific geometry, so they keep a small
// local stylesheet. Everything else on this screen comes from the kit.
const styles = StyleSheet.create({
  flex: { flex: 1 },
  stateWrap: { flex: 1, justifyContent: 'center' },
  list: { paddingVertical: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: radius.xs,
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderBottomLeftRadius: radius.xs,
  },
  systemNote: {
    alignSelf: 'center',
    maxWidth: '90%',
    backgroundColor: colors.neutralBg,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  paymentRequest: { alignSelf: 'stretch' },
  composer: {
    ...elevation.bar,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  composerField: { flex: 1 },
  composerInput: { minHeight: 32, maxHeight: 100 },
});
