'use server'

import { after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { escapeHtml } from '@/lib/escape-html'

const SITE = 'https://kapolia.com'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

type ProfilNotif = {
  email_notifications: boolean | null
  notif_rdv:           boolean | null
  notif_candidature:   boolean | null
}

async function fetchEmailSiActif(
  userId: string,
  admin: ReturnType<typeof adminClient>,
  extraCol?: 'notif_rdv' | 'notif_candidature',
): Promise<string | null> {
  const [{ data: authUser, error: authErr }, { data: profil }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from('profils')
      .select('email_notifications, notif_rdv, notif_candidature')
      .eq('user_id', userId)
      .single<ProfilNotif>(),
  ])
  if (authErr || !authUser?.user?.email) {
    console.error('[email-notifs] getUserById', authErr?.message, { userId })
    return null
  }
  if (!profil?.email_notifications) return null
  if (extraCol && profil[extraCol] === false) return null
  return authUser.user.email
}

function pied() {
  return `<p style="margin-top:32px;font-size:12px;color:#888;">Pour ne plus recevoir ces e-mails : <a href="${SITE}/parametres#notifications" style="color:#888;">${SITE}/parametres#notifications</a></p>`
}

// ── Email 2 : RDV proposé → candidat ─────────────────────────────────────────

export async function notifRdvPropose(rdvId: string) {
  after(async () => {
    const admin = adminClient()
    const { data: rdv } = await admin
      .from('rendez_vous')
      .select('candidat_id, recruteur_id, conversation_id')
      .eq('id', rdvId)
      .single()
    if (!rdv?.candidat_id) { console.error('[email-notifs] rdv-propose: rdv introuvable', { rdvId }); return }

    const email = await fetchEmailSiActif(rdv.candidat_id, admin, 'notif_rdv')
    if (!email) return

    const [{ data: conv }, { data: profil }] = await Promise.all([
      admin.from('conversations').select('offre_id').eq('id', rdv.conversation_id).single(),
      admin.from('profils').select('entreprise_nom').eq('user_id', rdv.recruteur_id).single(),
    ])
    const offreId    = (conv as { offre_id?: string } | null)?.offre_id
    const entreprise = (profil as { entreprise_nom?: string } | null)?.entreprise_nom ?? 'Un recruteur'
    let offreTitre   = ''
    if (offreId) {
      const { data: offre } = await admin.from('offres').select('titre').eq('id', offreId).single()
      offreTitre = (offre as { titre?: string } | null)?.titre ?? ''
    }
    const contexte = offreTitre ? ` pour le poste ${offreTitre}` : ''

    const result = await sendEmail({
      to:      { email },
      subject: `${entreprise} vous propose un rendez-vous`,
      html:    `<p>Bonjour,</p><p>${entreprise} souhaite vous rencontrer${contexte}.</p><p>Des créneaux vous attendent dans la messagerie Kapolia. Choisissez celui qui vous convient.</p><p><a href="${SITE}/dashboard/rendez-vous">Voir la proposition →</a></p>${pied()}`,
      text:    `${entreprise} souhaite vous rencontrer${contexte}.\n\nDes créneaux vous attendent dans la messagerie Kapolia.\n\n${SITE}/dashboard/rendez-vous\n\nPour ne plus recevoir ces e-mails : ${SITE}/parametres#notifications`,
    })
    if (!result.ok) console.error('[email-notifs] rdv-propose', result.error, { rdvId })
  })
}

// ── Email 3 : statut candidature → candidat ───────────────────────────────────

export async function notifStatutCandidature(candId: string, statut: 'acceptée' | 'refusée') {
  after(async () => {
    const admin = adminClient()
    const { data: cand } = await admin
      .from('candidatures')
      .select('candidat_id, offre_id')
      .eq('id', candId)
      .single()
    if (!cand?.candidat_id) { console.error('[email-notifs] statut: candidature introuvable', { candId }); return }

    const email = await fetchEmailSiActif(cand.candidat_id, admin, 'notif_candidature')
    if (!email) return

    const { data: offre } = await admin
      .from('offres')
      .select('titre, recruteur_id')
      .eq('id', cand.offre_id)
      .single()
    const offreTitre  = (offre as { titre?: string } | null)?.titre ?? 'ce poste'
    const recruteurId = (offre as { recruteur_id?: string } | null)?.recruteur_id

    let entreprise = 'Un recruteur'
    if (recruteurId) {
      const { data: profil } = await admin.from('profils').select('entreprise_nom').eq('user_id', recruteurId).single()
      entreprise = (profil as { entreprise_nom?: string } | null)?.entreprise_nom ?? entreprise
    }

    const acceptee = statut === 'acceptée'
    const result = await sendEmail({
      to:      { email },
      subject: acceptee
        ? `Votre candidature chez ${entreprise} est retenue`
        : `Candidature chez ${entreprise} — réponse reçue`,
      html: acceptee
        ? `<p>Bonjour,</p><p>Votre candidature pour le poste ${offreTitre} chez ${entreprise} a été retenue.</p><p><a href="${SITE}/candidatures?offre=${cand.offre_id}">Voir mes candidatures →</a></p>${pied()}`
        : `<p>Bonjour,</p><p>${entreprise} n'a pas retenu votre candidature pour le poste ${offreTitre}.</p><p><a href="${SITE}/candidatures?offre=${cand.offre_id}">Voir mes candidatures →</a></p>${pied()}`,
      text: acceptee
        ? `Votre candidature pour le poste ${offreTitre} chez ${entreprise} a été retenue.\n\n${SITE}/candidatures?offre=${cand.offre_id}\n\nPour ne plus recevoir ces e-mails : ${SITE}/parametres#notifications`
        : `${entreprise} n'a pas retenu votre candidature pour le poste ${offreTitre}.\n\n${SITE}/candidatures?offre=${cand.offre_id}\n\nPour ne plus recevoir ces e-mails : ${SITE}/parametres#notifications`,
    })
    if (!result.ok) console.error('[email-notifs] statut-candidature', result.error, { candId, statut })
  })
}

// ── Email 4 : créneau confirmé → recruteur ────────────────────────────────────

export async function notifCreneauConfirme(rdvId: string, creneauId: string) {
  after(async () => {
    const admin = adminClient()
    const [{ data: rdv }, { data: creneau }] = await Promise.all([
      admin.from('rendez_vous').select('recruteur_id, candidat_id, type, duree_minutes').eq('id', rdvId).single(),
      admin.from('creneaux_rdv').select('debut_utc').eq('id', creneauId).single(),
    ])
    if (!rdv?.recruteur_id || !creneau?.debut_utc) {
      console.error('[email-notifs] creneau-confirme: données manquantes', { rdvId, creneauId }); return
    }

    const email = await fetchEmailSiActif(rdv.recruteur_id, admin)
    if (!email) return

    const { data: profil } = await admin.from('profils').select('prenom, nom').eq('user_id', rdv.candidat_id).single()
    const prenom    = (profil as { prenom?: string } | null)?.prenom ?? 'Le candidat'
    const typeLabel = rdv.type === 'telephonique' ? 'Appel téléphonique' : 'Entretien'
    const debut     = new Date(creneau.debut_utc as string)
    const dateFr    = debut.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    const heureFr   = debut.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

    const result = await sendEmail({
      to:      { email },
      subject: `${prenom} a confirmé un créneau`,
      html:    `<p>Bonjour,</p><p>${prenom} a sélectionné le ${dateFr} à ${heureFr} pour votre ${typeLabel} de ${rdv.duree_minutes} minutes.</p><p><a href="${SITE}/recruteur/calendrier">Voir le calendrier →</a></p>${pied()}`,
      text:    `${prenom} a sélectionné le ${dateFr} à ${heureFr} pour votre ${typeLabel} de ${rdv.duree_minutes} minutes.\n\n${SITE}/recruteur/calendrier\n\nPour ne plus recevoir ces e-mails : ${SITE}/parametres#notifications`,
    })
    if (!result.ok) console.error('[email-notifs] creneau-confirme', result.error, { rdvId, creneauId })
  })
}

// ── Email 5 : RDV annulé par recruteur → candidat ────────────────────────────

export async function notifRdvAnnule(rdvId: string, statutAvant: 'proposee' | 'acceptee') {
  after(async () => {
    const admin = adminClient()
    const { data: rdv } = await admin
      .from('rendez_vous')
      .select('candidat_id, recruteur_id, conversation_id')
      .eq('id', rdvId)
      .single()
    if (!rdv?.candidat_id) { console.error('[email-notifs] rdv-annule: rdv introuvable', { rdvId }); return }

    const email = await fetchEmailSiActif(rdv.candidat_id, admin, 'notif_rdv')
    if (!email) return

    const [{ data: conv }, { data: profil }] = await Promise.all([
      admin.from('conversations').select('offre_id').eq('id', rdv.conversation_id).single(),
      admin.from('profils').select('entreprise_nom').eq('user_id', rdv.recruteur_id).single(),
    ])
    const entreprise = (profil as { entreprise_nom?: string } | null)?.entreprise_nom ?? 'Un recruteur'
    const offreId    = (conv as { offre_id?: string } | null)?.offre_id
    let offreTitre   = ''
    if (offreId) {
      const { data: offre } = await admin.from('offres').select('titre').eq('id', offreId).single()
      offreTitre = (offre as { titre?: string } | null)?.titre ?? ''
    }
    const contexte = offreTitre ? ` pour le poste ${offreTitre}` : ''

    let corps: string
    if (statutAvant === 'acceptee') {
      const { data: cr } = await admin
        .from('creneaux_rdv')
        .select('debut_utc')
        .eq('rendez_vous_id', rdvId)
        .eq('selectionne', true)
        .single()
      const debut  = cr ? new Date(cr.debut_utc as string) : null
      const quand  = debut
        ? ` prévu le ${debut.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${debut.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
        : ''
      corps = `${entreprise} a annulé le rendez-vous${quand}${contexte}.`
    } else {
      corps = `${entreprise} a retiré sa proposition de rendez-vous${contexte}.`
    }

    const convLink = `${SITE}/dashboard/messages?conv=${rdv.conversation_id}`
    const result = await sendEmail({
      to:      { email },
      subject: `Rendez-vous annulé — ${entreprise}`,
      html:    `<p>Bonjour,</p><p>${corps}</p><p><a href="${convLink}">Voir la conversation →</a></p>${pied()}`,
      text:    `${corps}\n\n${convLink}\n\nPour ne plus recevoir ces e-mails : ${SITE}/parametres#notifications`,
    })
    if (!result.ok) console.error('[email-notifs] rdv-annule', result.error, { rdvId })
  })
}

// ── Email 6 : aucun créneau retenu → recruteur ────────────────────────────────

export async function notifRdvRefuse(rdvId: string, avecMessage: boolean) {
  after(async () => {
    const admin = adminClient()
    const { data: rdv } = await admin
      .from('rendez_vous')
      .select('recruteur_id, candidat_id, conversation_id')
      .eq('id', rdvId)
      .single()
    if (!rdv?.recruteur_id) { console.error('[email-notifs] rdv-refuse: rdv introuvable', { rdvId }); return }

    const email = await fetchEmailSiActif(rdv.recruteur_id, admin)
    if (!email) return

    const [{ data: profil }, { data: conv }] = await Promise.all([
      admin.from('profils').select('prenom').eq('user_id', rdv.candidat_id).single(),
      admin.from('conversations').select('offre_id').eq('id', rdv.conversation_id).single(),
    ])
    const prenomRaw   = (profil as { prenom?: string } | null)?.prenom ?? 'Le candidat'
    const offreId     = (conv as { offre_id?: string } | null)?.offre_id
    let offreTitreRaw = ''
    if (offreId) {
      const { data: offre } = await admin.from('offres').select('titre').eq('id', offreId).single()
      offreTitreRaw = (offre as { titre?: string } | null)?.titre ?? ''
    }

    const prenomH        = escapeHtml(prenomRaw)
    const titreH         = escapeHtml(offreTitreRaw)
    const titreClauseH   = titreH          ? ` pour le poste ${titreH}`        : ''
    const titreClauseTxt = offreTitreRaw   ? ` pour le poste ${offreTitreRaw}` : ''
    const msgClause      = avecMessage     ? ' Un message vous attend dans la conversation.' : ''
    const convLink       = `${SITE}/recruteur/messages?conv=${rdv.conversation_id}`

    const result = await sendEmail({
      to:      { email },
      subject: `${prenomRaw} n'a retenu aucun créneau`,
      html:    `<p>Bonjour,</p><p>${prenomH} n'a retenu aucun des créneaux proposés${titreClauseH}.${msgClause}</p><p><a href="${convLink}">Voir la conversation</a></p>${pied()}`,
      text:    `${prenomRaw} n'a retenu aucun des créneaux proposés${titreClauseTxt}.${msgClause}\n\n${convLink}\n\nPour ne plus recevoir ces e-mails : ${SITE}/parametres#notifications`,
    })
    if (!result.ok) console.error('[email-notifs] rdv-refuse', result.error, { rdvId })
  })
}
