// Speech-to-text: sends the recorded audio to our own Edge Function, which
// holds the Groq key and forwards to Whisper.
//
// The key used to be read from EXPO_PUBLIC_GROQ_API here. Expo inlines every
// EXPO_PUBLIC_* value into the JS bundle at build time, so that key shipped
// inside the APK and could be lifted out of it. It now lives only in Supabase
// secrets; the phone sends the user's own login token instead.

import { supabase } from './supabase';

const STT_TIMEOUT_MS = 30000;

const FUNCTIONS_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/transcribe`;

export async function transcribeAudio(fileUri: string): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');

  const form = new FormData();
  // React Native FormData accepts { uri, name, type } for file uploads.
  // Deliberately unchanged — this is the fiddly part that already works, and
  // the Edge Function accepts the same multipart shape Groq did.
  form.append('file', {
    uri: fileUri,
    name: 'order.m4a',
    type: 'audio/m4a',
  } as unknown as Blob);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STT_TIMEOUT_MS);
  try {
    const response = await fetch(FUNCTIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        // NOTE: no Content-Type here — fetch sets the multipart boundary itself.
      },
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`STT error (${response.status}): ${errText}`);
    }
    const data = await response.json();
    return (data.text ?? '').trim();
  } finally {
    clearTimeout(timer);
  }
}
