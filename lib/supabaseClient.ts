import { createClient } from '@supabase/supabase-js';

// Use environment variables provided by Netlify
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
    console.error("Supabase URL is not configured. Please add VITE_SUPABASE_URL to your Netlify environment variables.");
    throw new Error("Supabase URL is not configured.");
}
if (!supabaseAnonKey) {
    console.error("Supabase Anon Key is not configured. Please add VITE_SUPABASE_ANON_KEY to your Netlify environment variables.");
    throw new Error("Supabase Anon Key is not configured.");
}


export const supabase = createClient(supabaseUrl, supabaseAnonKey);