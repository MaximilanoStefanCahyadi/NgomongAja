import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// PA-3 + PA-9. Two layers:
//  - LOCAL notifications (works everywhere incl. Expo Go): fired by the app
//    itself when a realtime event arrives while the app is open.
//  - REMOTE push (needs a development build): the app saves its Expo push
//    token to profiles.push_token; database triggers send the actual pushes.

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let channelReady = false;
async function ensureChannel() {
  if (channelReady || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Pesanan',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
  channelReady = true;
}

// Best-effort: in Expo Go getExpoPushTokenAsync throws (no remote push
// support) — that's fine, the DB trigger just skips null tokens.
export async function registerPushToken(profileId: string): Promise<void> {
  try {
    await ensureChannel();
    const perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return;
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await supabase.from('profiles').update({ push_token: token }).eq('id', profileId);
  } catch {
    // Expo Go or missing project config — local notifications still work.
  }
}

// ── The inbox ───────────────────────────────────────────────────────────
// Rows are written by the `notify_order_change` trigger, never by the client
// (there is deliberately no insert policy). RLS scopes every query below to
// the signed-in user, so none of these take a user id.

export type AppNotification = {
  id: string;
  kind: 'order_status' | 'order_new';
  title: string;
  body: string | null;
  order_id: string | null;
  read_at: string | null;
  created_at: string;
};

export async function listNotifications(limit = 50): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, kind, title, body, order_id, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as AppNotification[];
}

export async function unreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

/** Mark everything currently unread as read — called when the inbox opens. */
export async function markAllRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw error;
}

export async function showLocalNotification(title: string, body: string): Promise<void> {
  try {
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: null, // null = show immediately
    });
  } catch (e: any) {
    console.warn('showLocalNotification:', e.message);
  }
}
