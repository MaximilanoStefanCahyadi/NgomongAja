// Speech-to-text: sends the recorded audio file to Groq's Whisper API and
// returns the Indonesian transcript.

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const STT_TIMEOUT_MS = 30000;

export async function transcribeAudio(fileUri: string): Promise<string> {
  const form = new FormData();
  // React Native FormData accepts { uri, name, type } for file uploads.
  form.append('file', {
    uri: fileUri,
    name: 'order.m4a',
    type: 'audio/m4a',
  } as unknown as Blob);
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', 'id');
  form.append('response_format', 'json');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STT_TIMEOUT_MS);
  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_GROQ_API}`,
        // NOTE: no Content-Type here — fetch sets the multipart boundary itself.
      },
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq STT error: ${errText}`);
    }
    const data = await response.json();
    return (data.text ?? '').trim();
  } finally {
    clearTimeout(timer);
  }
}
