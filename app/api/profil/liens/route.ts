export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ── Raccourcisseurs connus ────────────────────────────────────────────────────
// Ces domaines masquent la destination finale. Le recruteur ne sait pas où il
// va et le candidat peut y cacher n'importe quelle URL.
const URL_SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd',
  'buff.ly', 'adf.ly', 'fb.me', 'ift.tt', 'tiny.cc', 'rb.gy',
  'cutt.ly', 'shorturl.at', 'snip.ly', 'bl.ink', 'short.io',
  't.ly', 'lnkd.in', 'clck.ru',
])

// ── Plages d'adresses privées RFC 1918 et loopback ───────────────────────────
function isPrivateHost(hostname: string): boolean {
  if (hostname === 'localhost') return true
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname)
  if (!m) return false
  const [, a, b] = m.map(Number)
  return (
    a === 127 ||
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  )
}

function validateUrl(url: string): string | null {
  const raw = url?.trim() ?? ''
  if (!raw) return 'Adresse manquante.'
  if (raw.length > 2048) return 'Adresse trop longue (max 2 048 caractères).'

  let parsed: URL
  try { parsed = new URL(raw) } catch { return 'Adresse invalide.' }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'Seuls les protocoles http et https sont acceptés.'
  }

  const host = parsed.hostname.toLowerCase()
  if (isPrivateHost(host)) return 'Adresse non autorisée.'
  if (URL_SHORTENERS.has(host)) {
    return 'Les liens raccourcis ne sont pas acceptés. Indiquez l\'adresse complète.'
  }

  return null
}

// ── POST /api/profil/liens ────────────────────────────────────────────────────
// Valide la liste de liens fournie et la sauvegarde dans profils.liens.
// Requiert un token JWT valide dans Authorization: Bearer <token>.
// Le client Supabase est créé avec ce token : RLS s'applique.
export async function POST(req: NextRequest) {
  // Auth
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/, '').trim()
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user }, error: authErr } = await sb.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Token invalide' }, { status: 401 })

  // Parse
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  const liens = (body as Record<string, unknown>)?.liens
  if (!Array.isArray(liens)) return NextResponse.json({ error: 'Format invalide' }, { status: 400 })
  if (liens.length > 6) return NextResponse.json({ error: 'Maximum 6 liens autorisés' }, { status: 400 })

  // Validation
  const errors: Record<number, string> = {}
  for (let i = 0; i < liens.length; i++) {
    const l = liens[i] as Record<string, unknown>
    if (!l || typeof l !== 'object') { errors[i] = 'Format invalide.'; continue }
    const intitule = String(l.intitule ?? '').trim()
    if (!intitule) { errors[i] = 'Intitulé manquant.'; continue }
    if (intitule.length > 50) { errors[i] = 'Intitulé trop long (max 50 caractères).'; continue }
    const urlErr = validateUrl(String(l.url ?? ''))
    if (urlErr) { errors[i] = urlErr; continue }
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 422 })
  }

  // Sauvegarde — client utilisateur, RLS s'applique (user_id = auth.uid())
  const clean = liens.map((l: Record<string, unknown>) => ({
    intitule: String(l.intitule).trim(),
    url:      String(l.url).trim(),
  }))

  const { error: saveErr } = await sb
    .from('profils')
    .update({ liens: clean })
    .eq('user_id', user.id)

  if (saveErr) {
    console.error('[profil/liens] save', { code: saveErr.code, message: saveErr.message })
    return NextResponse.json({ error: 'Erreur de sauvegarde.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
