// Transcript in, structured order items out.
//
// The whole three-provider fallback chain moved here from app/lib/nlp.ts:
//   1. Gemini 2.5 Flash Lite (free tier can hit daily quota / demand spikes)
//   2. Groq Llama 3.3 70B    (fast + reliable; same key as Whisper STT)
//   3. Nemotron 3 Super free via OpenRouter (rate-limited per minute upstream)
//
// The app no longer knows which model answered, and no longer carries three
// API keys or the prompt in its bundle.

import { corsHeaders, fail, fetchWithTimeout, json } from '../_shared/http.ts';
import { SYSTEM_INSTRUCTIONS } from '../_shared/prompt.ts';

const GEMINI_TIMEOUT_MS = 20000;
const GROQ_TIMEOUT_MS = 20000;
const OPENROUTER_TIMEOUT_MS = 30000;

type ParsedItem = {
  name: string;
  quantity: number;
  unit: 'kg' | 'liter' | 'pcs' | 'pack' | 'default';
};

type ParsedOrder = {
  items: ParsedItem[];
  confidence: 'HIGH' | 'NEEDS_REVIEW';
};

// Models sometimes wrap JSON in markdown fences or stray text — cut them off.
const extractJSON = (raw: string): ParsedOrder => {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object in LLM response');
  const parsed = JSON.parse(raw.slice(start, end + 1));
  if (!Array.isArray(parsed.items)) throw new Error('LLM response missing items[]');
  return {
    items: parsed.items.filter(
      (i: ParsedItem) => typeof i?.name === 'string' && i.name.trim() !== ''
    ),
    confidence: parsed.confidence === 'HIGH' ? 'HIGH' : 'NEEDS_REVIEW',
  };
};

const callGemini = async (transcript: string): Promise<string> => {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_INSTRUCTIONS }] },
        contents: [{ parts: [{ text: transcript }] }],
        generationConfig: { response_mime_type: 'application/json', temperature: 0.1 },
      }),
    },
    GEMINI_TIMEOUT_MS
  );
  if (!res.ok) throw new Error(`Gemini error: ${await res.text()}`);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
};

const callGroqLlama = async (transcript: string): Promise<string> => {
  const key = Deno.env.get('GROQ_API_KEY');
  if (!key) throw new Error('GROQ_API_KEY not set');
  const res = await fetchWithTimeout(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTIONS },
          { role: 'user', content: transcript },
        ],
        temperature: 0.1,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      }),
    },
    GROQ_TIMEOUT_MS
  );
  if (!res.ok) throw new Error(`Groq LLM error: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
};

const callNemotron = async (transcript: string): Promise<string> => {
  const key = Deno.env.get('OPENROUTER_API_KEY');
  if (!key) throw new Error('OPENROUTER_API_KEY not set');
  const res = await fetchWithTimeout(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'nvidia/nemotron-3-super-120b-a12b:free',
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTIONS },
          { role: 'user', content: transcript },
        ],
        temperature: 0.1,
        max_tokens: 1024,
        reasoning: { enabled: false }, // reasoning off = fast answers
      }),
    },
    OPENROUTER_TIMEOUT_MS
  );
  if (!res.ok) throw new Error(`Nemotron error: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let transcript = '';
  try {
    const body = await req.json();
    transcript = typeof body?.transcript === 'string' ? body.transcript.trim() : '';
  } catch (e) {
    return fail('parse-order/body', e, 400);
  }
  if (!transcript) return json({ error: 'no_transcript' }, 400);

  const chain = [
    { name: 'Gemini', call: callGemini },
    { name: 'Groq Llama', call: callGroqLlama },
    { name: 'Nemotron', call: callNemotron },
  ];

  let lastError: unknown;
  for (const provider of chain) {
    try {
      return json(extractJSON(await provider.call(transcript)));
    } catch (e) {
      console.warn(`${provider.name} failed, trying next provider:`, e);
      lastError = e;
    }
  }
  // All three down — the app shows "Coba lagi".
  return fail('parse-order/all-providers', lastError);
});
