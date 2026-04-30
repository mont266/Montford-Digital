const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('clients').select('*').limit(1);
  if (error) { console.error('Error:', error); }
  else { console.log('Clients columns:', data.length > 0 ? Object.keys(data[0]) : 'no data'); }
}
run();
