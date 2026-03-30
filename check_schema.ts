import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: projectsData, error: projectsError } = await supabase.from('projects').select('*').limit(1);
  if (projectsError) {
    console.error('Projects Error:', projectsError);
  } else if (projectsData && projectsData.length > 0) {
    console.log('Projects columns:', Object.keys(projectsData[0]));
  } else {
    console.log('Projects table is empty.');
  }

  const { data: invoicesData, error: invoicesError } = await supabase.from('invoices').select('*').limit(1);
  if (invoicesError) {
    console.error('Invoices Error:', invoicesError);
  } else if (invoicesData && invoicesData.length > 0) {
    console.log('Invoices columns:', Object.keys(invoicesData[0]));
  } else {
    console.log('Invoices table is empty.');
  }
}

check();
