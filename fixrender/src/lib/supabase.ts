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
  const canonicalUrl = envUrl || DEFAULT_SUPABASE_URL;
  const url = storedUrl || canonicalUrl;
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
        }
      });
    } catch (e) {
      console.error("Error inicializando cliente de Supabase:", e);
      return null;
    }
  }

  return cachedClient;
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
