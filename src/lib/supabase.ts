import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && key && !url.includes('YOUR-PROJECT'))

export const supabase = createClient(
  isConfigured ? url! : 'http://localhost:54321',
  isConfigured ? key! : 'missing-key',
)

export type ClassRow = {
  id: string
  name: string
  school: string | null
  invite_code: string
}

export type MessageRow = {
  id: string
  class_id: string
  user_id: string
  channel: string
  body: string
  created_at: string
  profiles: { display_name: string } | null
}

export type SynthesisRow = {
  id: string
  class_id: string
  user_id: string
  subject: string
  chapter: string | null
  title: string
  file_path: string
  created_at: string
  profiles: { display_name: string } | null
  ratings: { user_id: string; stars: number; comment: string | null }[]
}
