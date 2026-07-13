import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://twglalraitxmauyltmfp.supabase.co'
const supabaseKey = 'sb_publishable_HMQlUq0szDNQzgqDxH-s8A_51DLlTtq'

export const supabase = createClient(supabaseUrl, supabaseKey)
