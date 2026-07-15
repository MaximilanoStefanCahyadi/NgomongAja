import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  getOrCreateChat,
  listMessages,
  sendMessage,
  subscribeToMessages,
  type Message,
} from '@/lib/chat';

// One chat per order, shared by buyer and seller screens.
// Message types: text (bubbles), payment_request (amber card), system (grey note).
export function OrderChat({ orderId, myId }: { orderId: string; myId: string }) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const id = await getOrCreateChat(orderId);
      if (cancelled) return;
      setChatId(id);
      setMessages(await listMessages(id));
      unsubscribe = subscribeToMessages(id, async () => {
        setMessages(await listMessages(id));
      });
    })().catch((e) => console.warn('chat init:', e.message));

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [orderId]);

  const submit = async () => {
    if (!chatId || !draft.trim()) return;
    setSending(true);
    try {
      await sendMessage(chatId, myId, draft.trim());
      setDraft('');
      setMessages(await listMessages(chatId)); // realtime also fires; this is instant
    } catch (e: any) {
      console.warn('sendMessage:', e.message);
    } finally {
      setSending(false);
    }
  };

  if (!chatId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item: m }) => {
          if (m.type === 'system') {
            return <Text style={styles.system}>ℹ️ {m.body}</Text>;
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
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Tulis pesan…"
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <Pressable style={styles.send} onPress={submit} disabled={sending || !draft.trim()}>
          <Text style={styles.sendText}>{sending ? '…' : 'Kirim'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 8 },
  bubble: { maxWidth: '80%', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#16a34a' },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#f3f4f6' },
  mineText: { color: '#fff', fontSize: 15 },
  theirsText: { color: '#222', fontSize: 15 },
  system: { alignSelf: 'center', color: '#777', fontSize: 12, fontStyle: 'italic' },
  paymentRequest: {
    alignSelf: 'stretch',
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  paymentRequestTitle: { fontWeight: '700', color: '#92400e', fontSize: 13 },
  paymentRequestBody: { color: '#92400e', fontSize: 14, marginTop: 2 },
  composer: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    maxHeight: 100,
  },
  send: {
    backgroundColor: '#16a34a',
    borderRadius: 20,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  sendText: { color: '#fff', fontWeight: '600' },
});
