import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_URL = rawUrl.startsWith('http') ? rawUrl : 'https://placeholder.supabase.co'
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component 中 set 无效，忽略
          }
        },
      },
    }
  )
}
