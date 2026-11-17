// lib/parcours.ts — fonctions pures, sans React ni Supabase

export type DateMois = { annee: number; mois: number | null }

export type PosteParcours = {
  id: string
  poste: string
  entreprise: string
  debut: DateMois
  fin: DateMois | null
  enPoste: boolean
}

export type FormationParcours = {
  id: string
  intitule: string
  debut: DateMois | null
  fin: DateMois
  enCours: boolean
}

// ── 0. Lecture / écriture ─────────────────────────────────────────────────────

const MOIS_NOMS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

function normaliserChaine(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const MOIS_NORMALISES = MOIS_NOMS.map(normaliserChaine)

export function lireMoisAnnee(texte: string): DateMois | null {
  const s = texte.trim()
  if (!s) return null

  const anneeMax = new Date().getFullYear() + 1

  if (/^\d{4}$/.test(s)) {
    const annee = parseInt(s, 10)
    if (annee < 1950 || annee > anneeMax) return null
    return { annee, mois: null }
  }

  const m = /^([A-Za-zÀ-ÿ]+)\s+(\d{4})$/.exec(s)
  if (m) {
    const idx = MOIS_NORMALISES.indexOf(normaliserChaine(m[1]))
    if (idx < 0) return null
    const annee = parseInt(m[2], 10)
    if (annee < 1950 || annee > anneeMax) return null
    return { annee, mois: idx + 1 }
  }

  return null
}

export function ecrireMoisAnnee(d: DateMois): string {
  if (d.mois === null) return String(d.annee)
  return `${MOIS_NOMS[d.mois - 1]} ${d.annee}`
}

// Champs minimaux requis par preparerExperiencePourEnregistrement.
type ExpBase = {
  en_poste: boolean
  debut_annee?: number | null
  debut_mois?:  number | null
  fin_annee?:   number | null
  fin_mois?:    number | null
  date_debut?:  string
  date_fin?:    string
  date_a_verifier?: boolean | null
}

// Calcule date_debut / date_fin / date_a_verifier depuis les sélecteurs numériques,
// en conservant l'ancien texte si aucune année n'est saisie.
export function preparerExperiencePourEnregistrement<T extends ExpBase>(
  exp: T,
): T & { date_debut: string; date_fin: string; date_a_verifier: false } {
  const debut = exp.debut_annee ? { annee: exp.debut_annee, mois: exp.debut_mois ?? null } : null
  const fin   = !exp.en_poste && exp.fin_annee ? { annee: exp.fin_annee, mois: exp.fin_mois ?? null } : null
  return {
    ...exp,
    date_debut:      debut ? ecrireMoisAnnee(debut) : (exp.date_debut ?? ''),
    date_fin:        exp.en_poste ? '' : fin ? ecrireMoisAnnee(fin) : (exp.date_fin ?? ''),
    date_a_verifier: false,
  }
}

// ── 1. Conversion décimale ────────────────────────────────────────────────────

export function versDecimal(d: DateMois, borne: 'debut' | 'fin'): number {
  if (d.mois === null) return borne === 'debut' ? d.annee : d.annee + 11 / 12
  return d.annee + (d.mois - 1) / 12
}

// Début de formation sans mois = septembre (rentrée scolaire)
function fdDebutDec(debut: DateMois): number {
  return debut.mois === null ? debut.annee + 8 / 12 : debut.annee + (debut.mois - 1) / 12
}

// ── 2. Durée en texte ─────────────────────────────────────────────────────────

export function dureeTexte(
  debut: DateMois,
  fin: DateMois | null,
  enPoste: boolean,
): string {
  const now = new Date()
  const finDate: DateMois =
    enPoste || fin === null
      ? { annee: now.getFullYear(), mois: now.getMonth() + 1 }
      : fin

  if (debut.mois === null || finDate.mois === null) {
    const years = finDate.annee - debut.annee
    if (years <= 0) return '1 an'
    return years === 1 ? '1 an' : `${years} ans`
  }

  const totalMois = (finDate.annee - debut.annee) * 12 + (finDate.mois - debut.mois)
  if (totalMois < 1) return '1 mois'
  if (totalMois < 12) return `${totalMois} mois`

  const years  = Math.floor(totalMois / 12)
  const months = totalMois % 12
  const yearsStr = years === 1 ? '1 an' : `${years} ans`
  if (months === 0) return yearsStr
  return `${yearsStr} ${months} mois`
}

// ── 3. Années d'expérience ────────────────────────────────────────────────────

export function anneesExperience(postes: PosteParcours[]): number {
  if (postes.length === 0) return 0

  const now = new Date()
  const nowDate: DateMois = { annee: now.getFullYear(), mois: now.getMonth() + 1 }

  const intervalles = postes
    .map(p => {
      const d = versDecimal(p.debut, 'debut')
      const finDate = p.enPoste ? nowDate : (p.fin ?? nowDate)
      const f = versDecimal(finDate, 'fin')
      return [d, f] as [number, number]
    })
    .filter(([d, f]) => f > d)

  if (intervalles.length === 0) return 0

  intervalles.sort((a, b) => a[0] - b[0])

  let [curD, curF] = intervalles[0]
  const merged: [number, number][] = []

  for (let i = 1; i < intervalles.length; i++) {
    const [d, f] = intervalles[i]
    if (d <= curF) {
      curF = Math.max(curF, f)
    } else {
      merged.push([curD, curF])
      curD = d
      curF = f
    }
  }
  merged.push([curD, curF])

  return Math.floor(merged.reduce((sum, [d, f]) => sum + f - d, 0))
}

// ── 4. Frise ──────────────────────────────────────────────────────────────────

export type FriseSegment = {
  id: string
  gauche: number
  largeur: number
  ligne: number
  depuis: number | null
  libelle: 'complet' | 'initiales' | 'aucun'
}

export type ResultatFrise = {
  visible: boolean
  resserre: boolean
  seuil: number | null
  nbAnciens: number
  segments: FriseSegment[]
  formations: FriseSegment[]
  graduations: { annee: number; gauche: number; tick?: number }[]
}

export function calculerFrise(
  postes: PosteParcours[],
  formations: FormationParcours[],
  maintenant: Date = new Date(),
): ResultatFrise {
  const visible = postes.length >= 2
  if (!visible) {
    return { visible: false, resserre: false, seuil: null, nbAnciens: 0, segments: [], formations: [], graduations: [] }
  }

  const anneeActuelle = maintenant.getFullYear()
  const nowDate: DateMois = { annee: anneeActuelle, mois: maintenant.getMonth() + 1 }
  const finCarriere = versDecimal(nowDate, 'fin')

  // b. débutCarrière = plus petit début postes + formations
  const tousDebuts = [
    ...postes.map(p => versDecimal(p.debut, 'debut')),
    ...formations.filter(f => f.debut !== null).map(f => fdDebutDec(f.debut!)),
  ]
  const debutCarriere = Math.min(...tousDebuts)

  // c. resserre
  const resserre = finCarriere - debutCarriere > 20

  // helpers
  const fpDec  = (p: PosteParcours) => p.enPoste || !p.fin ? finCarriere : versDecimal(p.fin, 'fin')
  const fpAnnee = (p: PosteParcours) => p.enPoste || !p.fin ? anneeActuelle : p.fin.annee
  const ffDec = (f: FormationParcours) => {
    if (f.enCours) return finCarriere
    const { annee, mois } = f.fin
    return mois === null ? annee + 5 / 12 : annee + (mois - 1) / 12
  }

  // d. seuil
  let seuil: number | null = null
  const depuisMap = new Map<string, number>()

  if (resserre) {
    seuil = anneeActuelle - 15

    // postes qui commencent avant le seuil et finissent STRICTEMENT après (year > seuil)
    const crossants = postes.filter(p =>
      versDecimal(p.debut, 'debut') < seuil! && fpAnnee(p) > seuil!
    )

    if (crossants.length > 0) {
      const oldest = crossants.reduce((m, p) =>
        versDecimal(p.debut, 'debut') < versDecimal(m.debut, 'debut') ? p : m
      )
      const candidat = oldest.debut.annee
      if (anneeActuelle + 1 - candidat <= 20) {
        seuil = candidat
      } else {
        for (const p of crossants) depuisMap.set(p.id, p.debut.annee)
      }
    }
  }

  // e. nbAnciens : finissent dans l'année du seuil ou avant (fin_annee <= seuil)
  const nbAnciens = resserre && seuil !== null
    ? postes.filter(p => fpAnnee(p) <= seuil!).length
    : 0

  // échelle
  const vs    = resserre && seuil !== null ? seuil : debutCarriere   // visibleStart
  const ve    = resserre ? anneeActuelle + 1 : finCarriere            // visibleEnd
  const vspan = ve - vs

  const toG = (d: number) =>
    resserre ? 12 + (d - vs) / vspan * 88 : (d - vs) / vspan * 100
  const toW = (d1: number, d2: number) =>
    resserre ? (d2 - d1) / vspan * 88 : (d2 - d1) / vspan * 100
  const lbl = (w: number): 'complet' | 'initiales' | 'aucun' =>
    w > 16 ? 'complet' : w > 5 ? 'initiales' : 'aucun'

  // postes visibles (fin_annee > seuil)
  const pvis = resserre && seuil !== null
    ? postes.filter(p => fpAnnee(p) > seuil!)
    : [...postes]

  // g. répartition en lignes — tri par début effectif
  const pSorted = [...pvis].sort((a, b) => {
    const dA = depuisMap.has(a.id) ? (seuil ?? versDecimal(a.debut, 'debut')) : versDecimal(a.debut, 'debut')
    const dB = depuisMap.has(b.id) ? (seuil ?? versDecimal(b.debut, 'debut')) : versDecimal(b.debut, 'debut')
    return dA - dB
  })

  const lineEnds: number[] = []
  const ligneMap = new Map<string, number>()

  for (const p of pSorted) {
    const deb = depuisMap.has(p.id) ? (seuil ?? versDecimal(p.debut, 'debut')) : versDecimal(p.debut, 'debut')
    const fin = fpDec(p)
    let l = lineEnds.findIndex(e => e <= deb)
    if (l < 0) { l = lineEnds.length; lineEnds.push(fin) } else { lineEnds[l] = fin }
    ligneMap.set(p.id, l)
  }

  // segments postes
  const segments: FriseSegment[] = pvis.map(p => {
    const deb    = versDecimal(p.debut, 'debut')
    const fin    = fpDec(p)
    const depuis = depuisMap.get(p.id) ?? null
    const ligne  = ligneMap.get(p.id) ?? 0

    if (depuis !== null && resserre && seuil !== null) {
      const largeur = (fin - seuil) / (anneeActuelle + 1 - seuil) * 88
      return { id: p.id, gauche: 12, largeur, ligne, depuis, libelle: lbl(largeur) }
    }
    const effDeb = resserre && seuil !== null ? Math.max(deb, seuil) : deb
    const gauche = toG(effDeb)
    const largeur = toW(effDeb, fin)
    return { id: p.id, gauche, largeur, ligne, depuis: null, libelle: lbl(largeur) }
  })

  // f. formations visibles
  const fvis = resserre && seuil !== null
    ? formations.filter(f => f.enCours || f.fin.annee > seuil!)
    : [...formations]

  const formationLineEnds: number[] = []
  const formationLigneMap = new Map<string, number>()
  const fSorted = [...fvis].sort((a, b) => {
    const dA = a.debut !== null ? fdDebutDec(a.debut) : vs
    const dB = b.debut !== null ? fdDebutDec(b.debut) : vs
    return dA - dB
  })
  for (const fm of fSorted) {
    const deb = fm.debut !== null ? fdDebutDec(fm.debut) : vs
    const effDeb = resserre && seuil !== null ? Math.max(deb, seuil) : deb
    const fin = ffDec(fm)
    let l = formationLineEnds.findIndex(e => e <= effDeb)
    if (l < 0) { l = formationLineEnds.length; formationLineEnds.push(fin) } else { formationLineEnds[l] = fin }
    formationLigneMap.set(fm.id, l)
  }

  const formationSegs: FriseSegment[] = fvis.map(f => {
    const deb    = f.debut !== null ? fdDebutDec(f.debut) : vs
    const fin    = ffDec(f)
    const effDeb = resserre && seuil !== null ? Math.max(deb, seuil) : deb
    const gauche = toG(effDeb)
    const largeur = toW(effDeb, fin)
    const ligne  = formationLigneMap.get(f.id) ?? 0
    return { id: f.id, gauche, largeur, ligne, depuis: null, libelle: lbl(largeur) }
  })

  // j. graduations
  const years    = resserre && seuil !== null
    ? anneeActuelle + 1 - seuil
    : anneeActuelle + 1 - Math.floor(debutCarriere)
  const step     = years <= 12 ? 2 : years <= 25 ? 3 : 5
  const gradBase = resserre && seuil !== null ? seuil : Math.ceil(debutCarriere)
  const firstGrad = Math.ceil(gradBase / step) * step

  const grads: { annee: number; gauche: number; tick?: number }[] = []
  if (resserre && seuil !== null) grads.push({ annee: seuil, gauche: 6 })
  for (let yr = firstGrad; yr <= anneeActuelle; yr += step) {
    grads.push({ annee: yr, gauche: toG(yr + 0.5), tick: toG(yr) })
  }

  return { visible, resserre, seuil, nbAnciens, segments, formations: formationSegs, graduations: grads }
}

// ── 5. Tri ───────────────────────────────────────────────────────────────────

// En poste d'abord, puis debut_annee desc, puis debut_mois desc.
// Sans date de début → après celles qui en ont une (sort stable préserve l'ordre relatif).
export function trierExperiences<T extends {
  en_poste: boolean
  debut_annee?: number | null
  debut_mois?: number | null
}>(exps: T[]): T[] {
  return [...exps].sort((a, b) => {
    if (a.en_poste && !b.en_poste) return -1
    if (!a.en_poste && b.en_poste) return 1
    const diff = (b.debut_annee ?? 0) - (a.debut_annee ?? 0)
    if (diff !== 0) return diff
    return (b.debut_mois ?? 0) - (a.debut_mois ?? 0)
  })
}

// En cours d'abord, puis annee desc, puis annee_debut desc.
// Sans année → à la fin (ordre relatif conservé).
export function trierFormations<T extends {
  en_cours?: boolean
  annee?: string
  annee_debut?: string | null
}>(diplomes: T[]): T[] {
  return [...diplomes].sort((a, b) => {
    if (a.en_cours && !b.en_cours) return -1
    if (!a.en_cours && b.en_cours) return 1
    const aAnnee = Number(a.annee) || 0
    const bAnnee = Number(b.annee) || 0
    if (bAnnee !== aAnnee) return bAnnee - aAnnee
    return (Number(b.annee_debut) || 0) - (Number(a.annee_debut) || 0)
  })
}

// ── 6. Validation des dates ───────────────────────────────────────────────────

export function finAvantDebut(exp: {
  en_poste: boolean
  debut_annee?: number | null
  fin_annee?: number | null
  debut_mois?: number | null
  fin_mois?: number | null
}): boolean {
  if (exp.en_poste || !exp.debut_annee || !exp.fin_annee) return false
  if (exp.fin_annee < exp.debut_annee) return true
  return exp.fin_annee === exp.debut_annee && !!exp.debut_mois && !!exp.fin_mois && exp.fin_mois < exp.debut_mois
}

export function debutDansFutur(
  exp: { debut_annee?: number | null; debut_mois?: number | null },
  maintenant: Date = new Date(),
): boolean {
  if (!exp.debut_annee) return false
  const annee = maintenant.getFullYear()
  const mois  = maintenant.getMonth() + 1
  if (exp.debut_annee > annee) return true
  return exp.debut_annee === annee && !!exp.debut_mois && exp.debut_mois > mois
}

// ── 7. Entrées vides ──────────────────────────────────────────────────────────

export function experienceVide(exp: {
  poste: string; entreprise: string; missions: string;
  debut_annee?: number | null; fin_annee?: number | null
}): boolean {
  return (
    exp.poste.trim() === '' &&
    exp.entreprise.trim() === '' &&
    exp.missions.trim() === '' &&
    !exp.debut_annee &&
    !exp.fin_annee
  )
}

export function formationVide(f: {
  intitule: string; ecole: string; annee: string; annee_debut?: string | null
}): boolean {
  return f.intitule.trim() === '' && f.ecole.trim() === '' && !f.annee && !f.annee_debut
}

export function formationDebutManquant(f: {
  intitule: string; ecole: string; annee_debut?: string | null
}): boolean {
  return (f.intitule.trim() !== '' || f.ecole.trim() !== '') && !f.annee_debut
}

export function formationDatesIncoherentes(
  f: { annee_debut?: string | null; annee?: string; en_cours?: boolean },
  maintenant: Date = new Date(),
): 'debut_apres_obtention' | 'debut_futur' | null {
  if (!f.annee_debut) return null
  const debut = Number(f.annee_debut)
  if (!debut) return null
  if (debut > maintenant.getFullYear()) return 'debut_futur'
  if (!f.en_cours && f.annee) {
    const obtention = Number(f.annee)
    if (obtention && debut > obtention) return 'debut_apres_obtention'
  }
  return null
}
