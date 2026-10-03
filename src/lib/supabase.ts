import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'mare_supabase_url';
const STORAGE_ANON_KEY = 'mare_supabase_anon_key';

export const DEFAULT_SUPABASE_URL = 'https://mszojsqwilfqqcaycxch.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_QKwC2wFFvTe7eEky9T5p_Q_JVUqdHv9';
const LEGACY_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zem9qc3F3aWxmcXFjYXljeGNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzkzODksImV4cCI6MjA5ODQxNTM4OX0.BSdhqmNwEMT5exDnu7H_gY_TSLSgzy1Cs4V2V2gSnvc';

export function getSupabaseCredentials() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const storedUrl = localStorage.getItem(STORAGE_URL_KEY) || '';
  const storedKey = localStorage.getItem(STORAGE_ANON_KEY) || '';

  // The app uses a fixed production Supabase project. Older builds could leave
  // an obsolete API key in localStorage; that key then causes PostgREST 401s
  // even though the bundled project credentials are valid. Keep custom
  // credentials for a different URL, but never let a stale key override the
  // current production key for the canonical project.
  // Production builds must prefer the deployed environment over stale
  // browser settings. Older tablets can retain a wrong project URL in
  // localStorage; letting it override VITE_SUPABASE_URL silently sends Realtime
  // and REST to another/nonexistent project and makes the local POS appear empty.
  // If no environment URL exists (local/custom deployment), keep the saved URL.
  const canonicalUrl = envUrl || DEFAULT_SUPABASE_URL;
  const url = envUrl ? canonicalUrl : (storedUrl || canonicalUrl);
  const canonicalProject = url === DEFAULT_SUPABASE_URL;
  const knownCanonicalKeys = new Set([DEFAULT_SUPABASE_ANON_KEY, LEGACY_SUPABASE_ANON_KEY]);
  const anonKey = envKey || (canonicalProject && storedKey && knownCanonicalKeys.has(storedKey) ? storedKey : '') ||
    (!canonicalProject ? storedKey : '') || DEFAULT_SUPABASE_ANON_KEY;

  return { url, anonKey, isConfigured: Boolean(url && anonKey) };
}

export function saveSupabaseCredentials(url: string, anonKey: string) {
  if (url) localStorage.setItem(STORAGE_URL_KEY, url.trim());
  else localStorage.removeItem(STORAGE_URL_KEY);

  if (anonKey) localStorage.setItem(STORAGE_ANON_KEY, anonKey.trim());
  else localStorage.removeItem(STORAGE_ANON_KEY);

  cachedClient = null; // Reset cache so new client is instantiated
}

let cachedClient: SupabaseClient | null = null;

/**
 * Supabase REST must never be satisfied by a browser/service-worker cache.
 * The POS queue needs the response from the live PostgREST endpoint so a
 * reconnect cannot mistake a stale 404/401 for a successful synchronization.
 */
const supabaseFetch: typeof fetch = (input, init) => {
  const requestInit: RequestInit = { ...(init || {}) };
  const headers = new Headers(requestInit.headers || {});
  headers.set('Cache-Control', 'no-cache, no-store, max-age=0');
  headers.set('Pragma', 'no-cache');
  requestInit.headers = headers;
  requestInit.cache = 'no-store';
  return fetch(input, requestInit);
};

export function getSupabase(): SupabaseClient | null {
  const { url, anonKey, isConfigured } = getSupabaseCredentials();

  if (!isConfigured) {
    return null;
  }

  if (!cachedClient) {
    try {
      cachedClient = createClient(url, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          fetch: supabaseFetch,
        },
        db: {
          timeout: 15000,
        },
      });
    } catch (e) {
      console.error("Error inicializando cliente de Supabase:", e);
      return null;
    }
  }

  return cachedClient;
}

export async function checkSupabaseReachability(timeoutMs = 10000): Promise<{ ok: boolean; message?: string }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: false, message: 'El dispositivo está offline.' };
  }
  const client = getSupabase();
  if (!client) return { ok: false, message: 'Supabase no está configurado.' };

  try {
    // A tiny read proves the REST/Data API is actually reachable. We do not
    // use this as an authorization check: any HTTP response means the network
    // path is alive; the actual operation will still validate its own result.
    const probe = client.from('settings').select('id').limit(1);
    const timeout = new Promise<{ data: any; error: any }>(resolve =>
      setTimeout(() => resolve({ data: null, error: { message: 'Tiempo de espera agotado al contactar Supabase.', code: 'NETWORK_TIMEOUT' } }), timeoutMs)
    );
    const { error } = await Promise.race([probe, timeout]);
    if (error) {
      const code = String((error as any).code || '');
      const status = Number((error as any).status || 0);
      if (code === 'NETWORK_TIMEOUT' || status >= 500 || code.startsWith('PGRST') || /network|fetch|failed|timeout/i.test(error.message || '')) {
        return { ok: false, message: error.message || 'La API de Supabase no respondió correctamente.' };
      }
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e?.name === 'AbortError' ? 'Tiempo de espera agotado al contactar Supabase.' : (e?.message || 'No se pudo contactar Supabase.') };
  }
}

export async function testSupabaseConnection(url?: string, anonKey?: string): Promise<{ success: boolean; message: string; tableCount?: number }> {
  try {
    const targetUrl = url || getSupabaseCredentials().url;
    const targetKey = anonKey || getSupabaseCredentials().anonKey;

    if (!targetUrl || !targetKey) {
      return { success: false, message: "URL o Clave Anon de Supabase no configuradas." };
    }

    const client = createClient(targetUrl, targetKey);
    // Test query on products table or branches
    const { data: prodData, error: prodErr } = await client.from('products').select('id').limit(1);

    if (prodErr) {
      // Check if branches table works
      const { data: branchData, error: branchErr } = await client.from('branches').select('id').limit(1);
      if (branchErr) {
        return { success: false, message: `Error de conexión: ${prodErr.message || branchErr.message}` };
      }
    }

    return { success: true, message: "¡Conexión con Supabase establecida exitosamente!" };
  } catch (err: any) {
    return { success: false, message: err?.message || "No se pudo conectar con Supabase." };
  }
}
