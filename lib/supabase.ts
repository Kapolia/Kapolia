import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Variables d\'environnement Supabase manquantes.\n' +
    'Vérifiez que .env.local contient :\n' +
    '  NEXT_PUBLIC_SUPABASE_URL=...\n' +
    '  NEXT_PUBLIC_SUPABASE_ANON_KEY=...\n' +
    'Puis redémarrez le serveur (npm run dev).'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey)
