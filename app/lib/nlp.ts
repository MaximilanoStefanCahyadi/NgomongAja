// NLP: turns a raw Indonesian transcript into structured order items.
//
// The three-provider fallback chain (Gemini → Groq Llama → Nemotron) and the
// parsing prompt now live in the `parse-order` Edge Function. They used to sit
// in this file, which meant three API keys and ~25 lines of tuned prompt
// shipped inside the app bundle, extractable from any APK.
//
// The types below are unchanged, so matching.ts and the voice-order screen
// carry on exactly as before — only the transport moved.

import { supabase } from './supabase';

export type ParsedItem = {
  name: string;
  quantity: number;
  unit: 'kg' | 'liter' | 'pcs' | 'pack' | 'default';
};

export type ParsedOrder = {
  items: ParsedItem[];
  confidence: 'HIGH' | 'NEEDS_REVIEW';
};

export async function parseTranscript(transcript: string): Promise<ParsedOrder> {
  // invoke() attaches the user's session token automatically; the function
  // rejects anonymous callers before any provider is contacted.
  const { data, error } = await supabase.functions.invoke<ParsedOrder>('parse-order', {
    body: { transcript },
  });

  // Either the call failed, or every provider in the chain did. Both surface
  // the same way on screen: "Coba lagi".
  if (error) throw error;
  if (!data || !Array.isArray(data.items)) {
    throw new Error('parse-order returned no items');
  }
  return data;
}
