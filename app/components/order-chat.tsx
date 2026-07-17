import { Feather } from '@expo/vector-icons';
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
import { colors, fonts, radius } from '@/lib/theme';

// One chat per order, shared by buyer and seller screens.
// Message types: text (bubbles), payment_request (orange card), system (pill note).
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
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + 44}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <Text style={styles.emptyHint}>Belum ada pesan. Sapa dulu yuk 👋</Text>
        }
        renderItem={({ item: m }) => {
          if (m.type === 'system') {
            return (
              <View style={styles.systemPill}>
                <Text style={styles.systemText}>{m.body}</Text>
              </View>
            );
          }
          if (m.type === 'payment_request') {
            return (
              <View style={styles.paymentRequest}>
                <Text style={styles.paymentRequestTitle}>Permintaan pembayaran</Text>
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
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
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
          {sending ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Feather name="send" size={21} color={colors.onPrimary} />
          )}
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
  errorText: { fontFamily: fonts.body, color: colors.body, fontSize: 15, textAlign: 'center' },
  retry: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 13,
    paddingHorizontal: 26,
  },
  retryText: { color: colors.onPrimary, fontSize: 15, fontFamily: fonts.heading },
  list: { padding: 20, gap: 10, flexGrow: 1 },
  emptyHint: {
    fontFamily: fonts.body,
    textAlign: 'center',
    color: colors.secondary,
    marginTop: 40,
    fontSize: 14,
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 6,
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 22,
  },
  mineText: {
    fontFamily: fonts.body,
    color: colors.onPrimary,
    fontSize: 14.5,
    lineHeight: 21,
  },
  theirsText: { fontFamily: fonts.body, color: colors.text, fontSize: 14.5, lineHeight: 21 },
  systemPill: {
    alignSelf: 'center',
    backgroundColor: colors.neutralBg,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  systemText: { fontFamily: fonts.body, color: colors.secondary, fontSize: 12 },
  paymentRequest: {
    alignSelf: 'stretch',
    backgroundColor: colors.amberBg,
    borderRadius: radius.lg,
    padding: 15,
    borderWidth: 1.5,
    borderColor: colors.amberBorder,
    marginTop: 6,
  },
  paymentRequestTitle: {
    fontFamily: fonts.bodyBold,
    color: colors.sunnyText,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  paymentRequestBody: {
    fontFamily: fonts.body,
    color: '#4c2900',
    fontSize: 14,
    marginTop: 4,
    lineHeight: 21,
  },
  composer: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingTop: 14,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: fonts.body,
    maxHeight: 100,
    color: colors.text,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { backgroundColor: colors.disabled },
});
