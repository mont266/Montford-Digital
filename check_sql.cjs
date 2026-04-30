require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.rpc('query', { query: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'support_tickets'` });
  if (error) console.log(error);
  else console.log(data);
}
run();
