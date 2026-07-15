import { supabase } from './supabase';

export type MessageType = 'text' | 'payment_request' | 'system';

export type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  body: string;
  type: MessageType;
  sent_at: string;
};

// One chat per order (UNIQUE constraint). Get it, or create it on first open.
export async function getOrCreateChat(orderId: string): Promise<string> {
  const { data: existing, error: selErr } = await supabase
    .from('chats')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing.id;

  const { data: created, error: insErr } = await supabase
    .from('chats')
    .insert({ order_id: orderId })
    .select('id')
    .single();
  if (insErr) {
    // Race: the other party created it between our select and insert.
    const { data: retry } = await supabase
      .from('chats')
      .select('id')
      .eq('order_id', orderId)
      .maybeSingle();
    if (retry) return retry.id;
    throw insErr;
  }
  return created.id;
}

export async function listMessages(chatId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('sent_at', { ascending: true });
  if (error) throw error;
  return data as Message[];
}

export async function sendMessage(
  chatId: string,
  senderId: string,
  body: string,
  type: MessageType = 'text'
): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .insert({ chat_id: chatId, sender_id: senderId, body, type });
  if (error) throw error;
}

// Seller's "Minta pembayaran" (PRD §7.2): a typed chat message, in-app only.
export async function sendPaymentRequest(
  orderId: string,
  senderId: string,
  totalLabel: string
): Promise<void> {
  const chatId = await getOrCreateChat(orderId);
  await sendMessage(
    chatId,
    senderId,
    `Mohon selesaikan pembayaran pesananmu (${totalLabel}) ya 🙏`,
    'payment_request'
  );
}

// Post a system note (seller cancel/reject reason — PRD AS-11, PA-7).
export async function postSystemMessage(
  orderId: string,
  senderId: string,
  body: string
): Promise<void> {
  const chatId = await getOrCreateChat(orderId);
  await sendMessage(chatId, senderId, body, 'system');
}

export function subscribeToMessages(chatId: string, onNew: () => void): () => void {
  const channel = supabase
    .channel(`chat-${chatId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
      onNew
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
