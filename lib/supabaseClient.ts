import { createClient } from '@supabase/supabase-js';

// Use import.meta.env for client-side environment variables provided by Vite/Netlify
// FIX: Cast `import.meta` to `any` to address TypeScript error when Vite types are not available.
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
    console.error("Supabase URL is not configured. Please add VITE_SUPABASE_URL to your Netlify environment variables.");
    throw new Error("Supabase URL is not configured.");
}
if (!supabaseAnonKey) {
    console.error("Supabase Anon Key is not configured. Please add VITE_SUPABASE_ANON_KEY to your Netlify environment variables.");
    throw new Error("Supabase Anon Key is not configured.");
}


export const supabase = createClient(supabaseUrl, supabaseAnonKey);