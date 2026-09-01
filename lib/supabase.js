import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vuqizkxqnjcyewmoeipg.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1cWl6a3hxbmpjeWV3bW9laXBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNTAwMTMsImV4cCI6MjEwMTkyNjAxM30.uW69lruMly-ad-JpKUmAM5dleaH1CgNSp31rFbyAI78';

// Client-side browser Supabase client (used in React Client Components)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side administrative Supabase client using Secret Service Role Key
export const getAdminSupabase = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is not defined in .env.local');
    return supabase;
  }
  return createClient(supabaseUrl, serviceRoleKey);
};
