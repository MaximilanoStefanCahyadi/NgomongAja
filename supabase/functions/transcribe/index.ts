// Speech-to-text proxy: audio in, Indonesian transcript out.
//
// The Groq key used to live in the app bundle (EXPO_PUBLIC_GROQ_API), which
// meant anyone with the APK could extract it and spend Maxi's quota. It now
// lives only here, in Supabase secrets.
//
// verify_jwt defaults to on, so Supabase rejects unauthenticated callers
// before this code runs — the proxy is not an open relay to a paid API.

import { corsHeaders, fail, fetchWithTimeout, json } from '../_shared/http.ts';

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const STT_TIMEOUT_MS = 30000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const key = Deno.env.get('GROQ_API_KEY');
  if (!key) return fail('transcribe', new Error('GROQ_API_KEY not set'), 500);

  let file: File | null = null;
  try {
    // The app sends the same multipart body it always did — only the URL and
    // the Authorization header changed on the client.
    const form = await req.formData();
    const f = form.get('file');
    if (f instanceof File) file = f;
  } catch (e) {
    return fail('transcribe/formData', e, 400);
  }
  if (!file) return json({ error: 'no_audio' }, 400);

  const upstream = new FormData();
  upstream.append('file', file, file.name || 'order.m4a');
  upstream.append('model', 'whisper-large-v3-turbo');
  upstream.append('language', 'id');
  upstream.append('response_format', 'json');

  try {
    const res = await fetchWithTimeout(
      GROQ_URL,
      {
        method: 'POST',
        // No Content-Type — fetch sets the multipart boundary itself.
        headers: { Authorization: `Bearer ${key}` },
        body: upstream,
      },
      STT_TIMEOUT_MS
    );
    if (!res.ok) return fail('transcribe/groq', new Error(await res.text()));

    const data = await res.json();
    return json({ text: (data.text ?? '').trim() });
  } catch (e) {
    return fail('transcribe/fetch', e);
  }
});
