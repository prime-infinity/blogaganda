import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Service role client (bypasses RLS, for server operations)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Anon client (respects RLS, for user operations)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
