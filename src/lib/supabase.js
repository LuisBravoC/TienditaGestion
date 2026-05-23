import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || supabaseUrl.includes('TU_PROJECT_URL')) {
  console.warn(
    '[Supabase] Falta configurar VITE_SUPABASE_URL en .env.local\n' +
    'Encuentra tu Project URL en: supabase.com → tu proyecto → Settings → API'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey)
