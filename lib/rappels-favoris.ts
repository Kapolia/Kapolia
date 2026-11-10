import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'
import { scoreCandidat, type ProfilMatch, type OffreMatch } from '@/lib/matching'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any

// ── Types publics ─────────────────────────────────────────────────────────────

export type OffreRappelItem = {
  favori_id:      string
  offre_id:       string
  offre_titre:    string
  offre_ville:    string | null
  type_contrat:   string | null
  entreprise_nom: string | null
  score:          number | null
}

export type CandidatRappel = {
  candidat_id:     string
  email:           string
  prenom:          string
  hier:            OffreRappelItem[]   // favoris de J-1 et J-2 (fenêtre 24h), score desc, null en dernier
  il_y_a_3_jours:  OffreRappelItem[]  // favoris de J-3 à J-5 (fenêtre 3j), score desc, null en dernier
}

export type Exclusion = {
  favori_id:   string
  offre_id:    string
  candidat_id: string
  rappel:      '24h' | '3j'
  raison:      'postulee' | 'fermee' | 'notifications_coupees' | 'sans_email' | 'introuvable'
}

export type ResultatSelectionFavoris = {
  candidats:  CandidatRappel[]
  exclusions: Exclusion[]
}

// ── Helpers Paris timezone ────────────────────────────────────────────────────

function minuitParis(d: Date): Date {
  const tz      = 'Europe/Paris'
  const isoDate = d.toLocaleDateString('sv-SE', { timeZone: tz }) // "YYYY-MM-DD"
  const [y, m, j] = isoDate.split('-').map(Number)
  // Paris = UTC+2 (été) ou UTC+1 (hiver) : on essaie -2h d'abord (été), puis -1h (hiver)
  for (const dec of [-2, -1]) {
    const c         = new Date(Date.UTC(y, m - 1, j, dec, 0, 0))
    const parisDate = c.toLocaleDateString('sv-SE', { timeZone: tz })
    const parisTime = c.toLocaleTimeString('sv-SE', { timeZone: tz }) // "HH:MM:SS"
    if (parisDate === isoDate && parisTime === '00:00:00') return c
  }
  return new Date(Date.UTC(y, m - 1, j, -1, 0, 0)) // fallback UTC+1
}

function minuitIlYAJours(maintenant: Date, n: number): Date {
  return minuitParis(new Date(maintenant.getTime() - n * 24 * 3600_000))
}

// ── Types internes ────────────────────────────────────────────────────────────

type FavRow = { id: string; candidat_id: string; offre_id: string; created_at: string }

type OffreRow = {
  id: string; titre: string; ville: string | null; recruteur_id: string
  active: boolean; statut_publication: string; expire_at: string | null
  domaine: string | null; experience: string | null; type_contrat: string | null
  valeurs: string[] | null; mode_travail: string | null; langues: string[] | null
  competences: string[] | null; competences_bonus: string[] | null
}

type ProfilRow = {
  user_id: string; prenom: string | null
  email_notifications: boolean; rappels_favoris: boolean
  domaine: string | null; experience: string | null
  type_poste: string[] | null; valeur: string | null; ville: string | null
  mode_travail: string | null; langues: string[] | null
  competences_acquises: string[] | null
}

// ── Tri : score desc, null en dernier ────────────────────────────────────────

function trierParScore(items: OffreRappelItem[]): OffreRappelItem[] {
  return [...items].sort((a, b) => {
    if (a.score === null && b.score === null) return 0
    if (a.score === null) return 1
    if (b.score === null) return -1
    return b.score - a.score
  })
}

// ── Sélection ─────────────────────────────────────────────────────────────────

export async function selectionnerRappelsFavoris(
  admin: AdminClient,
  maintenant: Date
): Promise<ResultatSelectionFavoris> {

  // Fenêtres en heure de Paris (gestion heure d'été / heure d'hiver incluse)
  // 24h : J-2 inclus → J exclu  (hier + avant-hier)
  // 3j  : J-5 inclus → J-2 exclu (J-3, J-4, J-5)
  const minuit_j  = minuitParis(maintenant)
  const minuit_j2 = minuitIlYAJours(maintenant, 2)
  const minuit_j5 = minuitIlYAJours(maintenant, 5)

  const [res24h, res3j] = await Promise.all([
    admin.from('offres_favorites')
      .select('id, candidat_id, offre_id, created_at')
      .is('rappel_24h_at', null)
      .gte('created_at', minuit_j2.toISOString())
      .lt('created_at', minuit_j.toISOString()),
    admin.from('offres_favorites')
      .select('id, candidat_id, offre_id, created_at')
      .is('rappel_3j_at', null)
      .gte('created_at', minuit_j5.toISOString())
      .lt('created_at', minuit_j2.toISOString()),
  ])

  if (res24h.error) throw new Error(`[rappels-favoris] 24h: ${res24h.error.message}`)
  if (res3j.error)  throw new Error(`[rappels-favoris] 3j: ${res3j.error.message}`)

  const favs24h = (res24h.data ?? []) as FavRow[]
  const favs3j  = (res3j.data ?? []) as FavRow[]
  const tous     = [...favs24h, ...favs3j]

  if (tous.length === 0) {
    return { candidats: [], exclusions: [] }
  }

  const offreIds    = [...new Set(tous.map(f => f.offre_id))]
  const candidatIds = [...new Set(tous.map(f => f.candidat_id))]

  // Chargements par lots (pas de N+1)
  const [resOffres, resCand, resProfils] = await Promise.all([
    admin.from('offres')
      .select('id, titre, ville, recruteur_id, active, statut_publication, expire_at, domaine, experience, type_contrat, valeurs, mode_travail, langues, competences, competences_bonus')
      .in('id', offreIds),
    admin.from('candidatures')
      .select('candidat_id, offre_id')
      .in('offre_id', offreIds)
      .in('candidat_id', candidatIds),
    admin.from('profils')
      .select('user_id, prenom, email_notifications, rappels_favoris, domaine, experience, type_poste, valeur, ville, mode_travail, langues, competences_acquises')
      .in('user_id', candidatIds),
  ])

  if (resOffres.error)  throw new Error(`[rappels-favoris] offres: ${resOffres.error.message}`)
  if (resCand.error)    throw new Error(`[rappels-favoris] candidatures: ${resCand.error.message}`)
  if (resProfils.error) throw new Error(`[rappels-favoris] profils: ${resProfils.error.message}`)

  // entreprise_nom : source = profils des recruteurs (même source que OffreCard l.146 / OffreDetail l.424)
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const recruteurIds = [...new Set((resOffres.data ?? []).map((o: any) => o.recruteur_id as string))]
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const { data: recruteursData } = await admin
    .from('profils')
    .select('user_id, entreprise_nom')
    .in('user_id', recruteurIds)

  // Emails auth (O(candidatIds.length), en parallèle)
  const authResults = await Promise.all(
    candidatIds.map((id: string) => admin.auth.admin.getUserById(id))
  )

  // Index
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const offresById = new Map<string, OffreRow>(
    (resOffres.data ?? []).map((o: any) => [o.id as string, o as OffreRow])
  )
  const postulees = new Set(
    (resCand.data ?? []).map((c: any) => `${c.candidat_id}:${c.offre_id}`)
  )
  const profilsById = new Map<string, ProfilRow>(
    (resProfils.data ?? []).map((p: any) => [p.user_id as string, p as ProfilRow])
  )
  const entrepriseById = new Map<string, string | null>(
    (recruteursData ?? []).map((r: any) => [r.user_id as string, (r.entreprise_nom as string | null) ?? null])
  )
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const emailById = new Map<string, string>(
    candidatIds
      .map((id: string, i: number) => [id, authResults[i].data?.user?.email] as [string, string | undefined])
      .filter((e: [string, string | undefined]): e is [string, string] => e[1] !== undefined)
  )

  // Accumulation par candidat
  const parCandidat = new Map<string, { hier: OffreRappelItem[]; il_y_a_3_jours: OffreRappelItem[] }>()
  const exclusions: Exclusion[] = []

  function traiter(favs: FavRow[], rappel: '24h' | '3j'): void {
    for (const fav of favs) {
      const offre = offresById.get(fav.offre_id)
      if (!offre) {
        exclusions.push({ favori_id: fav.id, offre_id: fav.offre_id, candidat_id: fav.candidat_id, rappel, raison: 'introuvable' })
        continue
      }

      if (
        !offre.active ||
        offre.statut_publication !== 'publiée' ||
        (offre.expire_at !== null && new Date(offre.expire_at) <= maintenant)
      ) {
        exclusions.push({ favori_id: fav.id, offre_id: fav.offre_id, candidat_id: fav.candidat_id, rappel, raison: 'fermee' })
        continue
      }

      if (postulees.has(`${fav.candidat_id}:${fav.offre_id}`)) {
        exclusions.push({ favori_id: fav.id, offre_id: fav.offre_id, candidat_id: fav.candidat_id, rappel, raison: 'postulee' })
        continue
      }

      const profil = profilsById.get(fav.candidat_id)
      if (!profil) {
        exclusions.push({ favori_id: fav.id, offre_id: fav.offre_id, candidat_id: fav.candidat_id, rappel, raison: 'introuvable' })
        continue
      }

      if (!profil.email_notifications || !profil.rappels_favoris) {
        exclusions.push({ favori_id: fav.id, offre_id: fav.offre_id, candidat_id: fav.candidat_id, rappel, raison: 'notifications_coupees' })
        continue
      }

      const email = emailById.get(fav.candidat_id)
      if (!email) {
        exclusions.push({ favori_id: fav.id, offre_id: fav.offre_id, candidat_id: fav.candidat_id, rappel, raison: 'sans_email' })
        continue
      }

      const profilMatch: ProfilMatch = {
        domaine:              profil.domaine,
        experience:           profil.experience,
        type_poste:           profil.type_poste,
        valeur:               profil.valeur,
        ville:                profil.ville,
        mode_travail:         profil.mode_travail,
        langues:              profil.langues,
        competences_acquises: profil.competences_acquises,
      }
      const offreMatch: OffreMatch = {
        domaine:           offre.domaine,
        experience:        offre.experience,
        type_contrat:      offre.type_contrat,
        valeurs:           offre.valeurs,
        ville:             offre.ville,
        mode_travail:      offre.mode_travail,
        langues:           offre.langues,
        competences:       offre.competences,
        competences_bonus: offre.competences_bonus,
      }

      const item: OffreRappelItem = {
        favori_id:      fav.id,
        offre_id:       fav.offre_id,
        offre_titre:    offre.titre,
        offre_ville:    offre.ville,
        type_contrat:   offre.type_contrat,
        entreprise_nom: entrepriseById.get(offre.recruteur_id) ?? null,
        score:          scoreCandidat(profilMatch, offreMatch),
      }

      let bucket = parCandidat.get(fav.candidat_id)
      if (!bucket) {
        bucket = { hier: [], il_y_a_3_jours: [] }
        parCandidat.set(fav.candidat_id, bucket)
      }
      if (rappel === '24h') bucket.hier.push(item)
      else                  bucket.il_y_a_3_jours.push(item)
    }
  }

  traiter(favs24h, '24h')
  traiter(favs3j, '3j')

  const candidats: CandidatRappel[] = []
  for (const [candidat_id, bucket] of parCandidat) {
    const hier           = trierParScore(bucket.hier)
    const il_y_a_3_jours = trierParScore(bucket.il_y_a_3_jours)
    if (hier.length === 0 && il_y_a_3_jours.length === 0) continue
    const profil = profilsById.get(candidat_id)
    candidats.push({
      candidat_id,
      email:  emailById.get(candidat_id) ?? '',
      prenom: profil?.prenom ?? '',
      hier,
      il_y_a_3_jours,
    })
  }

  return { candidats, exclusions }
}

// ── Jeton de désinscription ───────────────────────────────────────────────────

function base64url(buf: Buffer): string {
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

export function jetonDesinscription(userId: string): string {
  const secret = process.env.EMAIL_DESINSCRIPTION_SECRET
  if (!secret) throw new Error('EMAIL_DESINSCRIPTION_SECRET manquante')
  const mac = createHmac('sha256', secret).update(userId).digest()
  return `${userId}.${base64url(mac)}`
}

export function verifierJeton(jeton: string): string | null {
  const dot = jeton.lastIndexOf('.')
  if (dot < 0) return null
  const userId = jeton.slice(0, dot)
  if (!userId) return null
  let attendu: string
  try {
    attendu = jetonDesinscription(userId)
  } catch {
    return null
  }
  const a = Buffer.from(jeton)
  const b = Buffer.from(attendu)
  if (a.length !== b.length) return null
  if (!timingSafeEqual(a, b)) return null
  return userId
}

// ── Construction de l'e-mail ──────────────────────────────────────────────────

function echapperHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function initiales(nom: string | null): string {
  if (!nom) return '?'
  const mots = nom.trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return '?'
  if (mots.length === 1) return mots[0]![0]!.toUpperCase()
  return (mots[0]![0]! + mots[1]![0]!).toUpperCase()
}

function carteHtml(item: OffreRappelItem): string {
  const titre     = echapperHtml(item.offre_titre)
  const nomEnt    = item.entreprise_nom ?? 'Entreprise'
  const ent       = echapperHtml(nomEnt)
  const sousTitre = item.offre_ville ? `${ent} · ${echapperHtml(item.offre_ville)}` : ent
  const ini       = initiales(item.entreprise_nom)
  const lien      = `https://kapolia.com/offres/${item.offre_id}`

  const pillsArr: string[] = []
  if (item.type_contrat) {
    pillsArr.push(
      `<span style="display:inline-block;padding:3px 10px;background:#EEF0EF;color:#3E4F46;` +
      `font-size:12px;font-weight:500;border-radius:20px;margin-right:5px;">` +
      `${echapperHtml(item.type_contrat)}</span>`
    )
  }
  if (item.score !== null) {
    pillsArr.push(
      `<span style="display:inline-block;padding:3px 10px;background:#EAF1EC;color:#24453A;` +
      `font-size:12px;font-weight:600;border-radius:20px;">` +
      `Correspondance ${item.score} %</span>`
    )
  }
  const pillsHtml = pillsArr.length > 0
    ? `<div style="margin-bottom:14px;">${pillsArr.join('')}</div>`
    : ''

  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"` +
    ` style="border-collapse:separate;border-spacing:0;margin-bottom:10px;">` +
    `<tr><td style="background:#FFFFFF;border:1px solid #E0E5E2;border-radius:12px;padding:16px 20px;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">` +
    `<tr>` +
    `<td width="36" valign="top" style="width:36px;padding-right:12px;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>` +
    `<td style="width:36px;height:36px;background:#24453A;border-radius:8px;` +
    `text-align:center;vertical-align:middle;line-height:36px;">` +
    `<span style="color:#FFFFFF;font-size:13px;font-weight:700;line-height:36px;">${ini}</span>` +
    `</td></tr></table>` +
    `</td>` +
    `<td valign="top">` +
    `<div style="font-size:15px;font-weight:700;color:#1B2026;line-height:1.3;margin-bottom:3px;">${titre}</div>` +
    `<div style="font-size:13px;color:#646D67;margin-bottom:8px;">${sousTitre}</div>` +
    pillsHtml +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>` +
    `<td style="background:#24453A;border-radius:8px;">` +
    `<a href="${lien}" style="display:inline-block;padding:9px 18px;color:#FFFFFF;font-weight:600;` +
    `font-size:13px;text-decoration:none;font-family:'Source Sans 3',Arial,sans-serif;">` +
    `Voir l'offre et postuler</a>` +
    `</td></tr></table>` +
    `</td>` +
    `</tr></table>` +
    `</td></tr></table>`
  )
}

function titreSectionHtml(texte: string): string {
  return (
    `<div style="font-size:12px;font-weight:700;color:#8A928C;text-transform:uppercase;` +
    `letter-spacing:0.08em;margin:16px 0 8px 0;">${echapperHtml(texte)}</div>`
  )
}

function carteTxt(item: OffreRappelItem): string {
  const lines: string[] = [item.offre_titre]
  const sousTitre = [item.entreprise_nom, item.offre_ville].filter(Boolean).join(' · ')
  if (sousTitre) lines.push(sousTitre)
  if (item.type_contrat) lines.push(item.type_contrat)
  if (item.score !== null) lines.push(`Correspondance ${item.score} %`)
  lines.push(`https://kapolia.com/offres/${item.offre_id}`)
  return lines.join('\n')
}

export function construireEmailRappel(
  candidat: CandidatRappel
): { subject: string; html: string; text: string } {
  const lienDesinscription = `https://kapolia.com/desinscription/rappels-favoris?t=${jetonDesinscription(candidat.candidat_id)}`
  const { prenom, hier, il_y_a_3_jours } = candidat
  const nHier  = hier.length
  const n3j    = il_y_a_3_jours.length
  const nTotal = nHier + n3j
  const aHier  = nHier > 0
  const a3j    = n3j > 0

  // Objet (texte brut, pas d'échappement HTML)
  let subject: string
  if (aHier && !a3j) {
    subject = nHier === 1
      ? `Votre favori « ${hier[0]!.offre_titre} » est toujours ouvert`
      : `Vos ${nHier} offres en favori d'hier sont toujours ouvertes`
  } else if (!aHier && a3j) {
    subject = n3j === 1
      ? `Votre favori « ${il_y_a_3_jours[0]!.offre_titre} » vous attend encore`
      : `Ces ${n3j} offres en favori vous attendent encore`
  } else {
    subject = `Vos offres en favori sont toujours ouvertes`
  }

  // Salutation et introduction
  const salutation = prenom ? `Bonjour ${prenom},` : 'Bonjour,'

  let introTxt: string
  if (aHier && !a3j) {
    introTxt = nHier === 1
      ? `Hier, vous avez mis cette offre en favori. Si elle vous correspond, n'hésitez pas à postuler : votre profil est déjà prêt, il suffit d'un clic.`
      : `Hier, vous avez mis ces ${nHier} offres en favori. Si l'une d'elles vous correspond, n'hésitez pas à postuler : votre profil est déjà prêt, il suffit d'un clic.`
  } else if (!aHier && a3j) {
    introTxt = n3j === 1
      ? `Il y a 3 jours, vous avez mis cette offre en favori. Elle est toujours ouverte, et les recruteurs lisent les candidatures au fil de l'eau.`
      : `Il y a 3 jours, vous avez mis ces ${n3j} offres en favori. Elles sont toujours ouvertes, et les recruteurs lisent les candidatures au fil de l'eau.`
  } else {
    introTxt = `Ces offres que vous avez mises en favori sont toujours ouvertes. Si l'une d'elles vous correspond, n'hésitez pas à postuler : votre profil est déjà prêt.`
  }

  // Cartes HTML et titres de section
  let corpsCartes = ''
  if (aHier && a3j) {
    corpsCartes += titreSectionHtml('Mises en favori hier')
    corpsCartes += hier.map(carteHtml).join('')
    corpsCartes += titreSectionHtml('Mises en favori il y a 3 jours')
    corpsCartes += il_y_a_3_jours.map(carteHtml).join('')
  } else {
    corpsCartes += (aHier ? hier : il_y_a_3_jours).map(carteHtml).join('')
  }

  // Bouton secondaire si plusieurs offres au total
  const ctaSecondaire = nTotal > 1
    ? `<table role="presentation" cellpadding="0" cellspacing="0"` +
      ` style="border-collapse:collapse;margin-top:12px;"><tr>` +
      `<td style="border:1.5px solid #24453A;border-radius:8px;">` +
      `<a href="https://kapolia.com/favoris"` +
      ` style="display:inline-block;padding:9px 18px;color:#24453A;font-weight:600;` +
      `font-size:13px;text-decoration:none;font-family:'Source Sans 3',Arial,sans-serif;">` +
      `Voir tous mes favoris</a>` +
      `</td></tr></table>`
    : ''

  // HTML
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kapolia</title>
</head>
<body style="margin:0;padding:0;background:#F6F7F5;font-family:'Source Sans 3',Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F6F7F5;border-collapse:collapse;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;border-collapse:separate;border-spacing:0;">
<tr><td style="padding-bottom:20px;">
<span style="font-family:'Lora',Georgia,serif;font-size:22px;font-weight:600;color:#24453A;">Kapolia</span>
</td></tr>
<tr><td style="background:#FFFFFF;border:1px solid #E8EDEA;border-radius:12px;padding:28px 32px;">
<p style="margin:0 0 6px;font-size:16px;font-weight:600;color:#1B2026;">${echapperHtml(salutation)}</p>
<p style="margin:0 0 24px;font-size:15px;color:#3E4F46;line-height:1.65;">${echapperHtml(introTxt)}</p>
${corpsCartes}${ctaSecondaire}
</td></tr>
<tr><td style="padding-top:24px;">
<div style="height:1px;background:#DDE2DF;margin-bottom:16px;"></div>
<p style="margin:0;font-size:12px;color:#8A928C;line-height:1.65;">
Vous recevez cet e-mail parce que vous avez mis des offres en favori sur Kapolia.<br>
<a href="${lienDesinscription}" style="color:#8A928C;text-decoration:underline;">Ne plus recevoir les rappels de favoris</a>
&nbsp;&middot;&nbsp;
<a href="https://kapolia.com/parametres" style="color:#8A928C;text-decoration:underline;">Gérer mes e-mails</a>
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  // Texte brut
  const txtBlocs: string[] = ['Kapolia', '', salutation, '', introTxt, '']

  if (aHier && a3j) {
    txtBlocs.push('Mises en favori hier', '')
    for (const item of hier)           txtBlocs.push(carteTxt(item), '')
    txtBlocs.push('Mises en favori il y a 3 jours', '')
    for (const item of il_y_a_3_jours) txtBlocs.push(carteTxt(item), '')
  } else {
    for (const item of (aHier ? hier : il_y_a_3_jours)) txtBlocs.push(carteTxt(item), '')
  }

  if (nTotal > 1) txtBlocs.push('Voir tous mes favoris : https://kapolia.com/favoris', '')

  txtBlocs.push(
    '---',
    'Vous recevez cet e-mail parce que vous avez mis des offres en favori sur Kapolia.',
    `Ne plus recevoir les rappels de favoris : ${lienDesinscription}`,
    `Gérer mes e-mails : https://kapolia.com/parametres`,
  )

  return { subject, html, text: txtBlocs.join('\n') }
}
