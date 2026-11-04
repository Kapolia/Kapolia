export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { preparerEntretien, ContexteEntretien } from '@/lib/ia'

const QUESTION_KEY = 'prep_entretien'
const QUOTA_JOUR   = 5

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function adminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

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

// ── GET : retourne la dernière analyse pour ce rendez-vous ────────────────────

export async function GET(req: NextRequest) {
  const { user, error } = await verifierAuth(req)
  if (!user) {
    console.error('[prep-entretien] GET auth error', error)
    return new NextResponse('Non autorisé', { status: 401 })
  }

  const rdvId = req.nextUrl.searchParams.get('rdv_id')
  if (!rdvId) return new NextResponse('rdv_id requis', { status: 400 })

  const { data } = await adminClient()
    .from('ia_resultats')
    .select('reponse, analysed_at')
    .eq('user_id', user.id)
    .eq('question', QUESTION_KEY)
    .eq('entity_id', rdvId)
    .maybeSingle()

  return NextResponse.json(
    data ? { reponse: data.reponse, analysed_at: data.analysed_at }
         : { reponse: null, analysed_at: null }
  )
}

// ── POST : vérifie, lance l'analyse, sauvegarde ───────────────────────────────

export async function POST(req: NextRequest) {
  const { user, error } = await verifierAuth(req)
  if (!user) {
    console.error('[prep-entretien] POST auth error', error)
    return new NextResponse('Non autorisé', { status: 401 })
  }

  let rdvId: string
  try {
    const body = await req.json()
    if (!body?.rdv_id || typeof body.rdv_id !== 'string') {
      return new NextResponse('rdv_id requis', { status: 400 })
    }
    rdvId = body.rdv_id
  } catch {
    return new NextResponse('Corps JSON invalide', { status: 400 })
  }

  const admin = adminClient()

  // ── Vérifications : ownership + statut confirmé + date future ─────────────
  const { data: rdv, error: rdvErr } = await admin
    .from('rendez_vous')
    .select('candidat_id, type, duree_minutes, statut, conversation_id, creneaux_rdv(debut_utc, selectionne)')
    .eq('id', rdvId)
    .single()

  if (rdvErr || !rdv) {
    return new NextResponse('Rendez-vous introuvable', { status: 404 })
  }
  if (rdv.candidat_id !== user.id) {
    return new NextResponse('Non autorisé', { status: 403 })
  }
  if (rdv.statut !== 'acceptee') {
    return NextResponse.json({ error: 'rdv_non_confirme' }, { status: 403 })
  }

  type Creneau = { debut_utc: string; selectionne: boolean }
  const choisi = (rdv.creneaux_rdv as Creneau[]).find(c => c.selectionne)
  if (!choisi || new Date(choisi.debut_utc) <= new Date()) {
    return NextResponse.json({ error: 'rdv_passe' }, { status: 403 })
  }

  const today = new Date().toISOString().slice(0, 10)

  // ── Quota ─────────────────────────────────────────────────────────────────
  const { data: quotaRow, error: quotaErr } = await admin
    .from('ia_quota')
    .select('appels_jour')
    .eq('user_id', user.id)
    .eq('question', QUESTION_KEY)
    .eq('date_jour', today)
    .maybeSingle()

  if (quotaErr) console.error('[prep-entretien] quota read', quotaErr)
  if ((quotaRow?.appels_jour ?? 0) >= QUOTA_JOUR) {
    return NextResponse.json({ error: 'quota_atteint' }, { status: 429 })
  }

  // ── Données contextuelles ─────────────────────────────────────────────────
  const { data: conv, error: convErr } = await admin
    .from('conversations')
    .select('offre_id, recruteur_id')
    .eq('id', rdv.conversation_id)
    .single()

  if (convErr || !conv) {
    return new NextResponse('Conversation introuvable', { status: 404 })
  }

  const [
    { data: offre },
    { data: profilRec },
    { data: profilCand },
  ] = await Promise.all([
    admin.from('offres')
      .select('titre, missions, profil_recherche')
      .eq('id', conv.offre_id)
      .single(),
    admin.from('profils')
      .select('entreprise_nom, entreprise_mission, entreprise_description')
      .eq('user_id', conv.recruteur_id)
      .maybeSingle(),
    admin.from('profils')
      .select('experiences, competences_acquises, qualites, projet_titre, projet_phare')
      .eq('user_id', user.id)
      .single(),
  ])

  if (!offre || !profilCand) {
    return new NextResponse('Données introuvables', { status: 404 })
  }

  const contexte: ContexteEntretien = {
    type_rdv:                rdv.type as 'telephonique' | 'entretien',
    duree_minutes:           rdv.duree_minutes,
    date_rdv:                choisi.debut_utc,
    offre_titre:             offre.titre ?? '',
    offre_missions:          Array.isArray(offre.missions) ? offre.missions : [],
    offre_profil_recherche:  offre.profil_recherche ?? null,
    entreprise_nom:          profilRec?.entreprise_nom ?? null,
    entreprise_mission:      profilRec?.entreprise_mission ?? null,
    entreprise_description:  profilRec?.entreprise_description ?? null,
    candidat_nb_experiences: Array.isArray(profilCand.experiences) ? profilCand.experiences.length : 0,
    candidat_competences:    Array.isArray(profilCand.competences_acquises) ? profilCand.competences_acquises : [],
    candidat_qualites:       Array.isArray(profilCand.qualites) ? profilCand.qualites : [],
    candidat_projet_titre:   profilCand.projet_titre ?? null,
    candidat_projet_phare:   profilCand.projet_phare ?? null,
  }

  // ── Appel IA ──────────────────────────────────────────────────────────────
  const result = await preparerEntretien(contexte)

  if (!result.ok) {
    console.error('[prep-entretien] ia error', result.error)
    return NextResponse.json({ error: result.error }, { status: 502 })
  }

  // ── Sauvegarde + quota (après succès uniquement) ───────────────────────────
  const analysed_at = new Date().toISOString()

  const [{ error: resultErr }, { error: quotaUpsertErr }] = await Promise.all([
    admin.from('ia_resultats').upsert({
      user_id:     user.id,
      question:    QUESTION_KEY,
      entity_id:   rdvId,
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

  if (resultErr)      console.error('[prep-entretien] resultat upsert', resultErr)
  if (quotaUpsertErr) console.error('[prep-entretien] quota upsert', quotaUpsertErr)

  return NextResponse.json({ reponse: result.reponse, analysed_at })
}
