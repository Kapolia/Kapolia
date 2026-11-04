export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { analyserProfilManquant, buildContexteProfil } from '@/lib/ia'

const QUESTION_KEY = 'profil_manquant'
const QUOTA_JOUR   = 5

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function adminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const PROFIL_COLUMNS = [
  'domaine', 'ville', 'type_poste', 'mode_travail', 'type_entreprise',
  'disponibilite', 'langues', 'signature', 'projet_titre', 'projet_phare',
  'projet_impact', 'passions', 'linkedin_url', 'portfolio_url',
  'video_presentation_url', 'avatar_url', 'experiences', 'diplomes',
  'competences_acquises', 'qualites',
].join(', ')

async function verifierAuth(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/, '').trim()
  if (!token) return { user: null, error: 'missing_token' as const }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user }, error } = await userClient.auth.getUser(token)
  if (error || !user) return { user: null, error: 'invalid_token' as const }
  return { user, error: null }
}

// ── GET : retourne la dernière analyse sauvegardée ────────────────────────────

export async function GET(req: NextRequest) {
  const { user, error } = await verifierAuth(req)
  if (!user) {
    console.error('[assistant-profil] GET auth error', error)
    return new NextResponse('Non autorisé', { status: 401 })
  }

  const { data } = await adminClient()
    .from('ia_resultats')
    .select('reponse, analysed_at')
    .eq('user_id', user.id)
    .eq('question', QUESTION_KEY)
    .eq('entity_id', '')
    .maybeSingle()

  return NextResponse.json(
    data ? { reponse: data.reponse, analysed_at: data.analysed_at }
         : { reponse: null, analysed_at: null }
  )
}

// ── POST : lance une nouvelle analyse, consomme le quota ─────────────────────

export async function POST(req: NextRequest) {
  const { user, error } = await verifierAuth(req)
  if (!user) {
    console.error('[assistant-profil] POST auth error', error)
    return new NextResponse('Non autorisé', { status: 401 })
  }

  const admin = adminClient()
  const today = new Date().toISOString().slice(0, 10)

  // ── Quota ──────────────────────────────────────────────────────────────────
  const { data: quotaRow, error: quotaErr } = await admin
    .from('ia_quota')
    .select('appels_jour')
    .eq('user_id', user.id)
    .eq('question', QUESTION_KEY)
    .eq('date_jour', today)
    .maybeSingle()

  if (quotaErr) console.error('[assistant-profil] quota read', quotaErr)

  if ((quotaRow?.appels_jour ?? 0) >= QUOTA_JOUR) {
    return NextResponse.json({ error: 'quota_atteint' }, { status: 429 })
  }

  // ── Profil + qualités proches ──────────────────────────────────────────────
  const [
    { data: profil, error: profilErr },
    { count: nbQualitesProches },
  ] = await Promise.all([
    admin.from('profils')
      .select(PROFIL_COLUMNS)
      .eq('user_id', user.id)
      .single(),
    admin.from('qualites_proches_selectionnees')
      .select('qualite', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ])

  if (profilErr || !profil) {
    console.error('[assistant-profil] profil error', profilErr)
    return new NextResponse('Profil introuvable', { status: 404 })
  }

  // ── Appel IA ───────────────────────────────────────────────────────────────
  const contexte = buildContexteProfil(
    profil as Parameters<typeof buildContexteProfil>[0],
    nbQualitesProches ?? 0,
  )
  const result = await analyserProfilManquant(contexte)

  if (!result.ok) {
    console.error('[assistant-profil] ia error', result.error)
    return NextResponse.json({ error: result.error }, { status: 502 })
  }

  // ── Sauvegarde + incrément quota (après succès uniquement) ─────────────────
  const analysed_at = new Date().toISOString()

  const [{ error: resultErr }, { error: quotaUpsertErr }] = await Promise.all([
    admin.from('ia_resultats').upsert({
      user_id:     user.id,
      question:    QUESTION_KEY,
      entity_id:   '',
      reponse:     result.reponse,
      analysed_at,
    }, { onConflict: 'user_id,question,entity_id' }),
    admin.from('ia_quota').upsert({
      user_id:     user.id,
      question:    QUESTION_KEY,
      date_jour:   today,
      appels_jour: (quotaRow?.appels_jour ?? 0) + 1,
    }, { onConflict: 'user_id,question,date_jour' }),
  ])

  if (resultErr)      console.error('[assistant-profil] resultat upsert', resultErr)
  if (quotaUpsertErr) console.error('[assistant-profil] quota upsert', quotaUpsertErr)

  return NextResponse.json({ reponse: result.reponse, analysed_at })
}
