import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://erozoxpkxevizzsilazx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyb3pveHBreGV2aXp6c2lsYXp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzODMzMzUsImV4cCI6MjA3ODk1OTMzNX0.E6iZBm27I-HyS93obVvGO302KG3Wpf8I4n1_QeRE0yQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
