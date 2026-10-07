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
    weekday: 'long',
    day:     'numeric',
    month:   'long',
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

export async function GET(req: NextRequest) {
  // ── Authentification Vercel ────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const admin = adminClient()

  // ── Fenêtre de dates ───────────────────────────────────────────────────────
  // Vendredi (UTC day = 5) : couvre J+1 (sam), J+2 (dim), J+3 (lun)
  // Autres jours : couvre J+1 seulement
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

  // ── RDV confirmés, rappel non encore envoyé ────────────────────────────────
  const { data: rdvsRaw, error: rdvErr } = await admin
    .from('rendez_vous')
    .select('id, candidat_id, recruteur_id, type, duree_minutes, contact_info, creneaux_rdv(debut_utc, selectionne)')
    .eq('statut', 'acceptee')
    .eq('rappel_envoye', false)

  if (rdvErr) {
    console.error('[cron rappels-rdv] requête', rdvErr.message, rdvErr.code)
    return NextResponse.json({ error: rdvErr.message }, { status: 500 })
  }

  // Filtrer côté JS : ne garder que les RDV dont le créneau confirmé tombe dans la fenêtre
  const rdvs: RdvAvecDate[] = ((rdvsRaw ?? []) as RdvRecord[]).flatMap(rdv => {
    const cr = rdv.creneaux_rdv.find(c => c.selectionne)
    if (!cr) return []
    const d = new Date(cr.debut_utc)
    if (d < debutFenetre || d > finFenetre) return []
    return [{ ...rdv, debutUtc: cr.debut_utc }]
  })

  console.info(`[cron rappels-rdv] ${rdvs.length} RDV à rappeler`, {
    fenetre: `${debutFenetre.toISOString()} → ${finFenetre.toISOString()}`,
  })

  let envoyes = 0
  let erreurs = 0

  for (const rdv of rdvs) {
    const dateLongue = formatDateLongue(rdv.debutUtc)
    const heure      = formatHeure(rdv.debutUtc)
    const datePleine = `${dateLongue} à ${heure}`
    const typeLabel  = rdv.type === 'telephonique' ? 'Appel téléphonique' : 'Entretien'

    // ── Données des deux participants ──────────────────────────────────────
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

    // ── Rappel candidat ────────────────────────────────────────────────────
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
        console.error('[cron rappels-rdv] candidat', res.error, { rdvId: rdv.id })
        erreurs++
      }
    }

    // ── Rappel recruteur ───────────────────────────────────────────────────
    if (emailRec && notifRec) {
      const nomCand = prenomCand || 'votre candidat'

      const res = await sendEmail({
        to:      { email: emailRec },
        subject: `Rappel — Rendez-vous ${dateLongue} avec ${prenomCand || 'votre candidat'}`,
        html:    `<p>Bonjour,</p><p>Vous avez un ${typeLabel} de ${rdv.duree_minutes} minutes prévu ${datePleine} avec ${nomCand}.</p><p><a href="${SITE}/recruteur/calendrier">Voir le calendrier →</a></p>${pied()}`,
        text:    `Bonjour,\n\nVous avez un ${typeLabel} de ${rdv.duree_minutes} minutes prévu ${datePleine} avec ${nomCand}.\n\n${SITE}/recruteur/calendrier\n\nPour ne plus recevoir ces e-mails : ${SITE}/parametres`,
      })
      if (res.ok) { envoyes++ } else {
        console.error('[cron rappels-rdv] recruteur', res.error, { rdvId: rdv.id })
        erreurs++
      }
    }

    // ── Marquer après envoi (send-then-mark, par RDV) ──────────────────────
    const { error: markErr } = await admin
      .from('rendez_vous')
      .update({ rappel_envoye: true })
      .eq('id', rdv.id)
    if (markErr) {
      console.error('[cron rappels-rdv] marquage', markErr.message, { rdvId: rdv.id })
    }
  }

  console.info('[cron rappels-rdv] terminé', { envoyes, erreurs, total: rdvs.length })
  return NextResponse.json({ ok: true, envoyes, erreurs, total: rdvs.length })
}
