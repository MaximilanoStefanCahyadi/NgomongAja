// NLP: turns a raw Indonesian transcript into structured order items.
// Three-layer chain, all behind timeouts so a hung API falls through:
//   1. Gemini 2.5 Flash Lite (free tier can hit daily quota / demand spikes)
//   2. Groq Llama 3.3 70B    (fast + reliable; same key as Whisper STT)
//   3. Nemotron 3 Super free via OpenRouter (rate-limited per minute upstream)

export type ParsedItem = {
  name: string;
  quantity: number;
  unit: 'kg' | 'liter' | 'pcs' | 'pack' | 'default';
};

export type ParsedOrder = {
  items: ParsedItem[];
  confidence: 'HIGH' | 'NEEDS_REVIEW';
};

const GEMINI_TIMEOUT_MS = 20000;
const GROQ_TIMEOUT_MS = 20000;
const OPENROUTER_TIMEOUT_MS = 30000;

const SYSTEM_INSTRUCTIONS = `
You are the order-parsing engine for NgomongAja, an Indonesian voice-ordering app for local minimarkets (warung). You receive one raw speech transcript of a buyer speaking casual Indonesian (often mixed with Javanese or other regional dialects) and must extract the items they want to buy.

OUTPUT: Return ONLY a valid minified JSON object, no markdown fences, matching:
{"items":[{"name":string,"quantity":number,"unit":"kg"|"liter"|"pcs"|"pack"|"default"}],"confidence":"HIGH"|"NEEDS_REVIEW"}

PARSING RULES:
1. Casual phrasing: "mau pesen", "beli", "ambil", "tuku" (Javanese) all mean ordering.
2. Quantity slang: "sekilo" = 1 kg, "setengah kilo" = 0.5 kg, "selusin" = 12 pcs, "setengah lusin" = 6 pcs, "sebiji"/"siji" = 1 pcs, "loro" = 2, "telu" = 3, "papat" = 4, "limo" = 5 (Javanese numbers), "sediter"/"seliter" = 1 liter, "sebungkus" = 1 pack.
3. CORRECTIONS — the last statement wins:
   - "eh gajadi" / "gak jadi" / "batal" after an item = REMOVE that item entirely.
   - A corrected quantity replaces the earlier one: "indomie loro... eh telu wae" = 3 indomie (NOT 2 and 3).
4. If no unit is spoken, use "pcs" for countable goods and "default" when truly unclear.
5. Do not invent items, do not add prices. If the transcript contains no order at all, return {"items":[],"confidence":"NEEDS_REVIEW"}.
6. Set confidence "NEEDS_REVIEW" when you had to guess (mumbled words, unclear quantities); otherwise "HIGH".

EXAMPLES:
Transcript: "halo bang mau pesen minyak goreng bimoli dua liter sama telur setengah lusin"
Output: {"items":[{"name":"minyak goreng bimoli","quantity":2,"unit":"liter"},{"name":"telur","quantity":6,"unit":"pcs"}],"confidence":"HIGH"}

Transcript: "tuku beras mentik limo kilo karo gula sekilo... eh gulane gajadi wis"
Output: {"items":[{"name":"beras mentik","quantity":5,"unit":"kg"}],"confidence":"HIGH"}

Transcript: "indomie goreng loro bungkus eh telu wae ding sama kecap manis sebotol"
Output: {"items":[{"name":"indomie goreng","quantity":3,"unit":"pack"},{"name":"kecap manis","quantity":1,"unit":"pcs"}],"confidence":"HIGH"}
`;

const fetchWithTimeout = async (url: string, options: RequestInit, ms: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
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
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.EXPO_PUBLIC_GEMINI_API}`,
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
  if (!response.ok) throw new Error(`Gemini error: ${await response.text()}`);
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
};

const callGroqLlama = async (transcript: string): Promise<string> => {
  const response = await fetchWithTimeout(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_GROQ_API}`,
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
  if (!response.ok) throw new Error(`Groq LLM error: ${await response.text()}`);
  const data = await response.json();
  return data.choices[0].message.content;
};

const callNemotron = async (transcript: string): Promise<string> => {
  const response = await fetchWithTimeout(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENROUTER_API}`,
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
  if (!response.ok) throw new Error(`Nemotron error: ${await response.text()}`);
  const data = await response.json();
  return data.choices[0].message.content;
};

export async function parseTranscript(transcript: string): Promise<ParsedOrder> {
  const chain = [
    { name: 'Gemini', call: callGemini },
    { name: 'Groq Llama', call: callGroqLlama },
    { name: 'Nemotron', call: callNemotron },
  ];
  let lastError: unknown;
  for (const provider of chain) {
    try {
      return extractJSON(await provider.call(transcript));
    } catch (e) {
      console.warn(`${provider.name} failed, trying next provider:`, e);
      lastError = e;
    }
  }
  throw lastError; // all three failed — the screen shows "Coba lagi"
}
