export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifierJeton } from '@/lib/rappels-favoris'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  const jeton = url.searchParams.get('t') ?? ''
  const userId = verifierJeton(jeton)
  if (!userId) {
    return NextResponse.json({ error: 'Jeton invalide' }, { status: 400 })
  }
  const admin = adminClient()
  const { error } = await admin
    .from('profils')
    .update({ rappels_favoris: false })
    .eq('user_id', userId)
  if (error) {
    console.error('[desinscription] update failed', error)
    return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
