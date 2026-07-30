// Shared bits for both functions.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/**
 * Errors are logged in full server-side but returned to the app as a short
 * message. Upstream provider errors can echo back request details, and this
 * function holds three API keys — there is no reason to forward any of that
 * to a phone. The app shows its own Indonesian copy via friendlyError anyway.
 */
export const fail = (logLabel: string, e: unknown, status = 502) => {
  console.error(`${logLabel}:`, e instanceof Error ? e.message : e);
  return json({ error: 'upstream_failed' }, status);
};

export const fetchWithTimeout = async (url: string, options: RequestInit, ms: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};
