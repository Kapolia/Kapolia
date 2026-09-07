import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function POST(req: NextRequest) {
  let body: { email?: string; type_compte?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  const email = (body.email ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
  }

  const type_compte = body.type_compte === 'recruteur' ? 'recruteur' : 'candidat'

  const { error } = await supabase
    .from('liste_attente')
    .insert({ email, type_compte, source: 'page-attente', consentement_le: new Date().toISOString() })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ ok: true }, { status: 200 })
    }
    console.error('[liste-attente]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
