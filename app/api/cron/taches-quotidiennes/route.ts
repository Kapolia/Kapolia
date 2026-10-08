export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'

const SITE = 'https://kapolia.com'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

function formatDateLongue(utc: string): string {
  return new Date(utc).toLocaleDateString('fr-FR', {
    weekday:  'long',
    day:      'numeric',
    month:    'long',
    timeZone: 'Europe/Paris',
  })
}

function formatHeure(utc: string): string {
  return new Date(utc).toLocaleTimeString('fr-FR', {
    hour:     '2-digit',
    minute:   '2-digit',
    timeZone: 'Europe/Paris',
  })
}

function pied() {
  return `<p style="margin-top:32px;font-size:12px;color:#888;">Pour ne plus recevoir ces e-mails : <a href="${SITE}/parametres" style="color:#888;">${SITE}/parametres</a></p>`
}

// ── Types ─────────────────────────────────────────────────────────────────────

type RdvCreneau = { debut_utc: string; selectionne: boolean }
type RdvRecord = {
  id:            string
  candidat_id:   string
  recruteur_id:  string
  type:          'telephonique' | 'entretien'
  duree_minutes: number
  contact_info:  string | null
  creneaux_rdv:  RdvCreneau[]
}
type RdvAvecDate = RdvRecord & { debutUtc: string }

type OffreRecord = {
  id:           string
  titre:        string
  expire_at:    string
  recruteur_id: string
}

// ── Tâche 1 : rappels RDV ─────────────────────────────────────────────────────

async function traiterRappelsRdv(admin: ReturnType<typeof adminClient>) {
  const now        = new Date()
  const joursExtra = now.getUTCDay() === 5 ? 2 : 0

  const debutFenetre = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1,
    0, 0, 0, 0,
  ))
  const finFenetre = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1 + joursExtra,
    23, 59, 59, 999,
  ))

  const { data: rdvsRaw, error: rdvErr } = await admin
    .from('rendez_vous')
    .select('id, candidat_id, recruteur_id, type, duree_minutes, contact_info, creneaux_rdv(debut_utc, selectionne)')
    .eq('statut', 'acceptee')
    .eq('rappel_envoye', false)

  if (rdvErr) {
    console.error('[cron rdv] requête', rdvErr.message, rdvErr.code)
    return { envoyes: 0, erreurs: 0, total: 0 }
  }

  const rdvs: RdvAvecDate[] = ((rdvsRaw ?? []) as RdvRecord[]).flatMap(rdv => {
    const cr = rdv.creneaux_rdv.find(c => c.selectionne)
    if (!cr) return []
    const d = new Date(cr.debut_utc)
    if (d < debutFenetre || d > finFenetre) return []
    return [{ ...rdv, debutUtc: cr.debut_utc }]
  })

  console.info(`[cron rdv] ${rdvs.length} RDV à rappeler`, {
    fenetre: `${debutFenetre.toISOString()} → ${finFenetre.toISOString()}`,
  })

  let envoyes = 0
  let erreurs = 0

  for (const rdv of rdvs) {
    const dateLongue = formatDateLongue(rdv.debutUtc)
    const heure      = formatHeure(rdv.debutUtc)
    const datePleine = `${dateLongue} à ${heure}`
    const typeLabel  = rdv.type === 'telephonique' ? 'Appel téléphonique' : 'Entretien'

    const [
      { data: authCand  }, { data: authRec   },
      { data: profilCand }, { data: profilRec },
    ] = await Promise.all([
      admin.auth.admin.getUserById(rdv.candidat_id),
      admin.auth.admin.getUserById(rdv.recruteur_id),
      admin.from('profils').select('prenom, email_notifications').eq('user_id', rdv.candidat_id).single(),
      admin.from('profils').select('prenom, entreprise_nom, email_notifications').eq('user_id', rdv.recruteur_id).single(),
    ])

    const emailCand  = authCand?.user?.email
    const emailRec   = authRec?.user?.email
    const prenomCand = (profilCand as { prenom?: string } | null)?.prenom ?? ''
    const entreprise = (profilRec  as { entreprise_nom?: string } | null)?.entreprise_nom ?? 'un recruteur'
    const notifCand  = (profilCand as { email_notifications?: boolean } | null)?.email_notifications ?? true
    const notifRec   = (profilRec  as { email_notifications?: boolean } | null)?.email_notifications ?? true

    if (emailCand && notifCand) {
      const salutation = prenomCand ? `Bonjour ${prenomCand},` : 'Bonjour,'
      const htmlCoord  = rdv.contact_info
        ? `<p><strong>Coordonnées :</strong> ${rdv.contact_info}</p>`
        : ''
      const textCoord  = rdv.contact_info ? `\nCoordonnées : ${rdv.contact_info}` : ''

      const res = await sendEmail({
        to:      { email: emailCand },
        subject: `Rappel — Rendez-vous ${dateLongue} avec ${entreprise}`,
        html:    `<p>${salutation}</p><p>Vous avez un ${typeLabel} de ${rdv.duree_minutes} minutes prévu ${datePleine} avec ${entreprise}.</p>${htmlCoord}<p><a href="${SITE}/dashboard/rendez-vous">Voir le rendez-vous →</a></p>${pied()}`,
        text:    `${salutation}\n\nVous avez un ${typeLabel} de ${rdv.duree_minutes} minutes prévu ${datePleine} avec ${entreprise}.${textCoord}\n\n${SITE}/dashboard/rendez-vous\n\nPour ne plus recevoir ces e-mails : ${SITE}/parametres`,
      })
      if (res.ok) { envoyes++ } else {
        console.error('[cron rdv] candidat', res.error, { rdvId: rdv.id })
        erreurs++
      }
    }

    if (emailRec && notifRec) {
      const nomCand = prenomCand || 'votre candidat'
      const res = await sendEmail({
        to:      { email: emailRec },
        subject: `Rappel — Rendez-vous ${dateLongue} avec ${prenomCand || 'votre candidat'}`,
        html:    `<p>Bonjour,</p><p>Vous avez un ${typeLabel} de ${rdv.duree_minutes} minutes prévu ${datePleine} avec ${nomCand}.</p><p><a href="${SITE}/recruteur/calendrier">Voir le calendrier →</a></p>${pied()}`,
        text:    `Bonjour,\n\nVous avez un ${typeLabel} de ${rdv.duree_minutes} minutes prévu ${datePleine} avec ${nomCand}.\n\n${SITE}/recruteur/calendrier\n\nPour ne plus recevoir ces e-mails : ${SITE}/parametres`,
      })
      if (res.ok) { envoyes++ } else {
        console.error('[cron rdv] recruteur', res.error, { rdvId: rdv.id })
        erreurs++
      }
    }

    const { error: markErr } = await admin
      .from('rendez_vous')
      .update({ rappel_envoye: true })
      .eq('id', rdv.id)
    if (markErr) {
      console.error('[cron rdv] marquage', markErr.message, { rdvId: rdv.id })
    }
  }

  return { envoyes, erreurs, total: rdvs.length }
}

// ── Tâche 2 : relances offres expirées ────────────────────────────────────────
// Fenêtre de 48 h : couvre les offres expirées depuis hier ou aujourd'hui.
// Si le cron saute un jour, la relance part quand même au run suivant.
// relance_email_envoyee = true empêche tout doublon quelle que soit la fenêtre.

async function traiterRelancesOffres(admin: ReturnType<typeof adminClient>) {
  const maintenant    = new Date()
  const fenêtreDebut  = new Date(maintenant.getTime() - 48 * 60 * 60 * 1000)

  const { data: offres, error: offresErr } = await admin
    .from('offres')
    .select('id, titre, expire_at, recruteur_id')
    .eq('statut', 'publiée')
    .eq('relance_email_envoyee', false)
    .not('expire_at', 'is', null)
    .lte('expire_at', maintenant.toISOString())
    .gte('expire_at', fenêtreDebut.toISOString())

  if (offresErr) {
    console.error('[cron offres] requête', offresErr.message, offresErr.code)
    return { envoyes: 0, erreurs: 0, total: 0 }
  }

  const liste = (offres ?? []) as OffreRecord[]
  console.info(`[cron offres] ${liste.length} offre(s) expirée(s) à relancer`)

  let envoyes = 0
  let erreurs = 0

  for (const offre of liste) {
    const [{ data: authRec }, { data: profilRec }] = await Promise.all([
      admin.auth.admin.getUserById(offre.recruteur_id),
      admin.from('profils').select('email_notifications').eq('user_id', offre.recruteur_id).single(),
    ])

    const emailRec = authRec?.user?.email
    const notifRec = (profilRec as { email_notifications?: boolean } | null)?.email_notifications ?? true

    if (emailRec && notifRec) {
      const dateExp = formatDateLongue(offre.expire_at)

      const res = await sendEmail({
        to:      { email: emailRec },
        subject: `Votre offre « ${offre.titre} » a expiré, republiez-la en un clic`,
        html:    `<p>Bonjour,</p><p>Votre offre <strong>${offre.titre}</strong> a expiré le ${dateExp}. Elle n'est plus visible des candidats.</p><p>Vous pouvez la republier en un clic depuis votre espace recruteur.</p><p><a href="${SITE}/recruteur/offres">Voir mes offres →</a></p>${pied()}`,
        text:    `Bonjour,\n\nVotre offre « ${offre.titre} » a expiré le ${dateExp}. Elle n'est plus visible des candidats.\n\nVous pouvez la republier en un clic depuis votre espace recruteur.\n\n${SITE}/recruteur/offres\n\nPour ne plus recevoir ces e-mails : ${SITE}/parametres`,
      })
      if (res.ok) { envoyes++ } else {
        console.error('[cron offres] envoi', res.error, { offreId: offre.id })
        erreurs++
      }
    }

    const { error: markErr } = await admin
      .from('offres')
      .update({ relance_email_envoyee: true })
      .eq('id', offre.id)
    if (markErr) {
      console.error('[cron offres] marquage', markErr.message, { offreId: offre.id })
    }
  }

  return { envoyes, erreurs, total: liste.length }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const admin = adminClient()

  let rdv    = { envoyes: 0, erreurs: 0, total: 0 }
  let offres = { envoyes: 0, erreurs: 0, total: 0 }

  try {
    rdv = await traiterRappelsRdv(admin)
  } catch (err) {
    console.error('[cron rdv] exception', err)
  }

  try {
    offres = await traiterRelancesOffres(admin)
  } catch (err) {
    console.error('[cron offres] exception', err)
  }

  console.info('[cron] terminé', { rdv, offres })
  return NextResponse.json({ ok: true, rdv, offres })
}
