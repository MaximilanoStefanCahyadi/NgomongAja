import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getOrCreateChat,
  listMessages,
  sendMessage,
  subscribeToMessages,
  type Message,
} from '@/lib/chat';
import { colors, radius } from '@/lib/theme';

// One chat per order, shared by buyer and seller screens.
// Message types: text (bubbles), payment_request (amber card), system (grey note).
export function OrderChat({ orderId, myId }: { orderId: string; myId: string }) {
  const insets = useSafeAreaInsets();
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
      <View style={styles.center}>
        <Text style={styles.errorText}>Gagal memuat obrolan. Periksa internetmu.</Text>
        <Pressable style={styles.retry} onPress={initChat} accessibilityRole="button">
          <Text style={styles.retryText}>Coba Lagi</Text>
        </Pressable>
      </View>
    );
  }

  if (!chatId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + 44}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <Text style={styles.emptyHint}>
            Belum ada pesan. Sapa dulu yuk 👋
          </Text>
        }
        renderItem={({ item: m }) => {
          if (m.type === 'system') {
            return <Text style={styles.system}>ℹ️ {m.body}</Text>;
          }
          if (m.type === 'payment_request') {
            return (
              <View style={styles.paymentRequest}>
                <Text style={styles.paymentRequestTitle}>💰 Permintaan pembayaran</Text>
                <Text style={styles.paymentRequestBody}>{m.body}</Text>
              </View>
            );
          }
          const mine = m.sender_id === myId;
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <Text style={mine ? styles.mineText : styles.theirsText}>{m.body}</Text>
            </View>
          );
        }}
      />
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TextInput
          style={styles.input}
          placeholder="Tulis pesan…"
          placeholderTextColor={colors.secondary}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <Pressable
          style={[styles.send, (sending || !draft.trim()) && styles.sendDisabled]}
          onPress={submit}
          disabled={sending || !draft.trim()}
          accessibilityRole="button"
          accessibilityLabel="Kirim pesan">
          <Text style={styles.sendText}>{sending ? '…' : 'Kirim'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 24,
    backgroundColor: colors.bg,
  },
  errorText: { color: colors.body, fontSize: 15, textAlign: 'center' },
  retry: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  retryText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  list: { padding: 16, gap: 8, flexGrow: 1 },
  emptyHint: { textAlign: 'center', color: colors.secondary, marginTop: 40, fontSize: 14 },
  bubble: { maxWidth: '80%', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.neutralBg },
  mineText: { color: colors.white, fontSize: 15 },
  theirsText: { color: colors.text, fontSize: 15 },
  system: { alignSelf: 'center', color: colors.secondary, fontSize: 12, fontStyle: 'italic' },
  paymentRequest: {
    alignSelf: 'stretch',
    backgroundColor: colors.amberBg,
    borderRadius: radius.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.amberBorder,
  },
  paymentRequestTitle: { fontWeight: '700', color: colors.amberText, fontSize: 13 },
  paymentRequestBody: { color: colors.amberText, fontSize: 14, marginTop: 2 },
  composer: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: colors.text,
  },
  send: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  sendDisabled: { backgroundColor: colors.disabled },
  sendText: { color: colors.white, fontWeight: '600' },
});
