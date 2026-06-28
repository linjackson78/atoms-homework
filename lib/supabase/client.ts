import { createBrowserClient } from '@supabase/ssr'

const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_URL = raw.startsWith('http') ? raw : 'https://placeholder.supabase.co'
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key'

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY)
}
