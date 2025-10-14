import { createBrowserClient } from '@supabase/ssr'

let supabase: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (supabase) {
    return supabase;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase URL or Anon Key is missing:', { supabaseUrl: supabaseUrl, supabaseAnonKey: supabaseAnonKey });
    throw new Error('Supabase URL and Anon Key are required for createBrowserClient');
  }

  supabase = createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  );

  return supabase;
}