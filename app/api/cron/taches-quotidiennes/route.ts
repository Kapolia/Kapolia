export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { writeFileSync } from 'fs'
import { join } from 'path'
import {
  selectionnerRappelsFavoris,
  construireEmailRappel,
  jetonDesinscription,
  type ResultatSelectionFavoris,
} from '@/lib/rappels-favoris'

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
  return `<p style="margin-top:32px;font-size:12px;color:#888;">Pour ne plus recevoir ces e-mails : <a href="${SITE}/parametres#notifications" style="color:#888;">${SITE}/parametres#notifications</a></p>`
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
      admin.from('profils').select('prenom, email_notifications, notif_rappel_rdv').eq('user_id', rdv.candidat_id).single(),
      admin.from('profils').select('prenom, entreprise_nom, email_notifications').eq('user_id', rdv.recruteur_id).single(),
    ])

    const emailCand  = authCand?.user?.email
    const emailRec   = authRec?.user?.email
    const prenomCand = (profilCand as { prenom?: string } | null)?.prenom ?? ''
    const entreprise = (profilRec  as { entreprise_nom?: string } | null)?.entreprise_nom ?? 'un recruteur'
    const notifCand      = (profilCand as { email_notifications?: boolean } | null)?.email_notifications ?? true
    const notifRappelRdv = (profilCand as { notif_rappel_rdv?: boolean } | null)?.notif_rappel_rdv ?? true
    const notifRec       = (profilRec  as { email_notifications?: boolean } | null)?.email_notifications ?? true

    if (emailCand && notifCand && notifRappelRdv) {
      const salutation = prenomCand ? `Bonjour ${prenomCand},` : 'Bonjour,'
      const htmlCoord  = rdv.contact_info && rdv.type !== 'telephonique'
        ? `<p><strong>Coordonnées :</strong> ${rdv.contact_info}</p>`
        : ''
      const textCoord  = rdv.contact_info && rdv.type !== 'telephonique' ? `\nCoordonnées : ${rdv.contact_info}` : ''

      const res = await sendEmail({
        to:      { email: emailCand },
        subject: `Rappel — Rendez-vous ${dateLongue} avec ${entreprise}`,
        html:    `<p>${salutation}</p><p>Vous avez un ${typeLabel} de ${rdv.duree_minutes} minutes prévu ${datePleine} avec ${entreprise}.</p>${htmlCoord}<p><a href="${SITE}/dashboard/rendez-vous">Voir le rendez-vous →</a></p>${pied()}`,
        text:    `${salutation}\n\nVous avez un ${typeLabel} de ${rdv.duree_minutes} minutes prévu ${datePleine} avec ${entreprise}.${textCoord}\n\n${SITE}/dashboard/rendez-vous\n\nPour ne plus recevoir ces e-mails : ${SITE}/parametres#notifications`,
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
        text:    `Bonjour,\n\nVous avez un ${typeLabel} de ${rdv.duree_minutes} minutes prévu ${datePleine} avec ${nomCand}.\n\n${SITE}/recruteur/calendrier\n\nPour ne plus recevoir ces e-mails : ${SITE}/parametres#notifications`,
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
        text:    `Bonjour,\n\nVotre offre « ${offre.titre} » a expiré le ${dateExp}. Elle n'est plus visible des candidats.\n\nVous pouvez la republier en un clic depuis votre espace recruteur.\n\n${SITE}/recruteur/offres\n\nPour ne plus recevoir ces e-mails : ${SITE}/parametres#notifications`,
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

// ── Tâche 3 : rappels favoris ─────────────────────────────────────────────────

const RAISONS_MARQUABLES = new Set(['postulee', 'fermee', 'introuvable'])

async function traiterRappelsFavoris(
  admin: ReturnType<typeof adminClient>,
  maintenant: Date,
): Promise<{ envoyes: number; erreurs: number; total: number }> {
  let resultat: ResultatSelectionFavoris
  try {
    resultat = await selectionnerRappelsFavoris(admin, maintenant)
  } catch (err) {
    console.error('[cron favoris] sélection', err)
    return { envoyes: 0, erreurs: 0, total: 0 }
  }

  // Filtre local : RAPPELS_FAVORIS_SEUL_USER (jamais en production)
  const seulUser = process.env.RAPPELS_FAVORIS_SEUL_USER
  if (seulUser) {
    resultat = {
      candidats:  resultat.candidats.filter(c => c.candidat_id === seulUser),
      exclusions: resultat.exclusions.filter(e => e.candidat_id === seulUser),
    }
  }

  const maintenant_iso = maintenant.toISOString()

  // Marquer les exclusions définitives (postulee / fermee / introuvable)
  // pour ne pas les réexaminer au prochain passage
  const excl24h = resultat.exclusions
    .filter(e => e.rappel === '24h' && RAISONS_MARQUABLES.has(e.raison))
    .map(e => e.favori_id)
  const excl3j = resultat.exclusions
    .filter(e => e.rappel === '3j' && RAISONS_MARQUABLES.has(e.raison))
    .map(e => e.favori_id)

  if (excl24h.length > 0) {
    const { error } = await admin.from('offres_favorites')
      .update({ rappel_24h_at: maintenant_iso }).in('id', excl24h)
    if (error) console.error('[cron favoris] marquage exclusions 24h', error.message)
  }
  if (excl3j.length > 0) {
    const { error } = await admin.from('offres_favorites')
      .update({ rappel_3j_at: maintenant_iso }).in('id', excl3j)
    if (error) console.error('[cron favoris] marquage exclusions 3j', error.message)
  }

  console.info(
    `[cron favoris] ${resultat.candidats.length} candidat(s) à rappeler,` +
    ` ${excl24h.length + excl3j.length} exclusion(s) marquées`,
  )

  let envoyes = 0
  let erreurs = 0

  for (const candidat of resultat.candidats) {
    // Construction de l'e-mail
    let emailContent: ReturnType<typeof construireEmailRappel>
    try {
      emailContent = construireEmailRappel(candidat)
    } catch (err) {
      console.error('[cron favoris] construction email', { candidatId: candidat.candidat_id, err })
      erreurs++
      continue
    }

    // En-têtes de désinscription
    const lienDesinscription =
      `${SITE}/api/desinscription/rappels-favoris?t=${jetonDesinscription(candidat.candidat_id)}`

    const res = await sendEmail({
      to:      { email: candidat.email },
      subject: emailContent.subject,
      html:    emailContent.html,
      text:    emailContent.text,
      headers: {
        'List-Unsubscribe':      `<${lienDesinscription}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })

    if (!res.ok) {
      console.error('[cron favoris] envoi', { candidatId: candidat.candidat_id, error: res.error })
      erreurs++
      continue
    }

    envoyes++

    // Marquer les favoris après envoi réussi
    const ids24h = candidat.hier.map(o => o.favori_id)
    const ids3j  = candidat.il_y_a_3_jours.map(o => o.favori_id)

    if (ids24h.length > 0) {
      const { error } = await admin.from('offres_favorites')
        .update({ rappel_24h_at: maintenant_iso }).in('id', ids24h)
      if (error) console.error('[cron favoris] marquage 24h', { candidatId: candidat.candidat_id, msg: error.message })
    }
    if (ids3j.length > 0) {
      const { error } = await admin.from('offres_favorites')
        .update({ rappel_3j_at: maintenant_iso }).in('id', ids3j)
      if (error) console.error('[cron favoris] marquage 3j', { candidatId: candidat.candidat_id, msg: error.message })
    }
  }

  return { envoyes, erreurs, total: resultat.candidats.length }
}

// ── Helpers test ──────────────────────────────────────────────────────────────

function masquerCandidats(candidats: import('@/lib/rappels-favoris').CandidatRappel[]) {
  return candidats.map(c => ({
    ...c,
    email: c.email.replace(/^[^@]+/, s => s.slice(0, 2) + '***'),
  }))
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const admin = adminClient()

  const url      = new URL(req.url)
  const testMode = url.searchParams.get('test') === '1'
  const tache    = url.searchParams.get('tache')

  if (testMode) {
    const maintenantParam = url.searchParams.get('maintenant')
    let maintenant: Date
    if (maintenantParam) {
      maintenant = new Date(maintenantParam)
      if (isNaN(maintenant.getTime())) {
        return NextResponse.json({ error: 'maintenant invalide' }, { status: 400 })
      }
    } else {
      maintenant = new Date()
    }
    const resultat = await selectionnerRappelsFavoris(admin, maintenant)

    const candidatsAvecEmail = resultat.candidats.map(c => {
      const { subject, text } = construireEmailRappel(c)
      return { ...masquerCandidats([c])[0]!, subject, text }
    })

    if (resultat.candidats.length > 0 && process.env.NODE_ENV !== 'production') {
      try {
        const { html: htmlPremier } = construireEmailRappel(resultat.candidats[0]!)
        writeFileSync(join(process.cwd(), 'tmp-rappel.html'), htmlPremier, 'utf-8')
      } catch (err) {
        console.warn('[cron test] écriture tmp-rappel.html impossible', err)
      }
    }

    return NextResponse.json({
      test:       true,
      maintenant: maintenant.toISOString(),
      candidats:  candidatsAvecEmail,
      exclusions: resultat.exclusions,
    })
  }

  // ?tache=favoris : n'exécute que la tâche 3 (sûr pour tester sur la base de prod)
  if (tache === 'favoris') {
    const maintenantParam = url.searchParams.get('maintenant')
    let maintenant = new Date()
    if (maintenantParam) {
      if (process.env.NODE_ENV !== 'production') {
        const d = new Date(maintenantParam)
        if (isNaN(d.getTime())) {
          return NextResponse.json({ error: 'maintenant invalide' }, { status: 400 })
        }
        maintenant = d
      }
      // en production : ignoré, on utilise new Date()
    }
    let favoris = { envoyes: 0, erreurs: 0, total: 0 }
    try {
      favoris = await traiterRappelsFavoris(admin, maintenant)
    } catch (err) {
      console.error('[cron favoris] exception', err)
    }
    console.info('[cron] tâche favoris terminée', { favoris })
    return NextResponse.json({ ok: true, favoris })
  }

  let rdv     = { envoyes: 0, erreurs: 0, total: 0 }
  let offres  = { envoyes: 0, erreurs: 0, total: 0 }
  let favoris = { envoyes: 0, erreurs: 0, total: 0 }

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

  try {
    favoris = await traiterRappelsFavoris(admin, new Date())
  } catch (err) {
    console.error('[cron favoris] exception', err)
  }

  console.info('[cron] terminé', { rdv, offres, favoris })
  return NextResponse.json({ ok: true, rdv, offres, favoris })
}
