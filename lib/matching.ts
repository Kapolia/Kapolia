import { EXPERIENCES, DOMAINES, COMP_REF, offreAvecTeletravail } from '@/lib/referentiels'
import { LANGUES } from '@/lib/langues'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProfilMatch = {
  domaine?:             string | null
  experience?:          string | null
  type_poste?:          string[] | null
  valeur?:              string | null
  ville?:               string | null
  mode_travail?:        string | null    // clé : 'remote' | 'hybride' | 'occasionnel' | 'presentiel' | 'flexible'
  type_entreprise?:     string[] | null  // clés : 'startup' | 'scaleup' | 'corporate' | 'indep' | 'sans_pref'
  langues?:             string[] | null  // format : 'Français — Natif', 'Anglais — Courant'
  competences_acquises?: string[] | null
}

export type OffreMatch = {
  domaine?:           string | null
  experience?:        string | null
  type_contrat?:      string | null
  valeurs?:           string[] | null
  ville?:             string | null
  teletravail?:       boolean | null   // scoreRecruteur uniquement
  mode_travail?:      string | null    // scoreCandidat : '100% remote' | 'Hybride' | 'Occasionnel' | '100% présentiel'
  langues?:           string[] | null  // codes ISO : ['fr', 'en']
  competences?:       string[] | null
  competences_bonus?: string[] | null
}

type Criterion = { earned: number; weight: number }

export type CriterionResult = { earned: number; weight: number } | null

export type ScoreBreakdown = {
  domaine:      CriterionResult
  experience:   CriterionResult
  contrat:      CriterionResult
  localisation: CriterionResult
  competences:  CriterionResult
  total:        number | null
}

// ─── Domain normalization ─────────────────────────────────────────────────────

const DOMAINE_NORM: Record<string, string> = {
  'Tech':       'Tech & Ingénierie',
  'Design':     'Design & Créativité',
  'Marketing':  'Marketing & Com',
  'Finance':    'Finance & Compta',
  'Commerce':   'Commerce & Vente',
  'RH':         'RH & Recrutement',
  'Logistique': 'Opérations & Logistique',
  'Communication':          'Marketing & Com',
  'Hôtellerie-restauration': 'Hôtellerie & Restauration',
  'Production':             'Industrie & Production',
}

function normDomaine(raw: string): string {
  return DOMAINE_NORM[raw] ?? raw
}

// ─── Domain proximity ─────────────────────────────────────────────────────────

const DOMAINES_PROCHES = new Set<string>(
  [
    ['Tech & Ingénierie',        'Conseil & Stratégie'],
    ['Tech & Ingénierie',        'Opérations & Logistique'],
    ['Design & Créativité',      'Marketing & Com'],
    ['Marketing & Com',          'Commerce & Vente'],
    ['Finance & Compta',         'Conseil & Stratégie'],
    ['Finance & Compta',         'Commerce & Vente'],
    ['RH & Recrutement',         'Commerce & Vente'],
    ['RH & Recrutement',         'Opérations & Logistique'],
    ['Conseil & Stratégie',      'Commerce & Vente'],
    ['Hôtellerie & Restauration', 'Commerce & Vente'],
    ['Industrie & Production',    'Opérations & Logistique'],
    ['Industrie & Production',    'Tech & Ingénierie'],
  ].flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`])
)

void DOMAINES // consumed by referentiels consumers; here to catch unused-import lint

// Flat set of all ref competences — O(1) membership test used in evalCompetencesC
const COMP_REF_SET: Set<string> = new Set(Object.values(COMP_REF).flat())

// ─── Contrat map (partagé) ────────────────────────────────────────────────────

const CONTRAT_MAP: Record<string, string[]> = {
  cdi:        ['CDI'],
  cdd:        ['CDD'],
  interim:    ['Intérim'],
  saisonnier: ['Saisonnier'],
  freelance:  ['Freelance'],
  alternance: ['Alternance'],
  stage:      ['Stage'],
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCORE RECRUTEUR — candidathèque, statistiques recruteur (critères inchangés)
// ═══════════════════════════════════════════════════════════════════════════════

const W = {
  domaine:      30,
  experience:   20,
  contrat:      20,
  valeurs:      15,
  localisation: 15,
} as const

function evalDomaine(p: ProfilMatch, o: OffreMatch): Criterion | null {
  const pd = normDomaine(p.domaine?.trim() ?? '')
  const od = normDomaine(o.domaine?.trim() ?? '')
  if (!pd || !od) return null
  if (pd === od) return { earned: W.domaine, weight: W.domaine }
  if (DOMAINES_PROCHES.has(`${pd}|${od}`)) return { earned: Math.round(W.domaine / 2), weight: W.domaine }
  return { earned: 0, weight: W.domaine }
}

function evalExperience(p: ProfilMatch, o: OffreMatch): Criterion | null {
  const pi = EXPERIENCES.indexOf(p.experience?.trim() ?? '')
  const oi = EXPERIENCES.indexOf(o.experience?.trim() ?? '')
  if (pi === -1 || oi === -1) return null
  const diff = Math.abs(pi - oi)
  if (diff === 0) return { earned: W.experience, weight: W.experience }
  if (diff === 1) return { earned: Math.round(W.experience / 2), weight: W.experience }
  return { earned: 0, weight: W.experience }
}

function evalContrat(p: ProfilMatch, o: OffreMatch): Criterion | null {
  const types = p.type_poste ?? []
  const ok    = o.type_contrat?.toLowerCase().trim()
  if (types.length === 0 || !ok) return null
  if (types.includes('ouvert')) return { earned: W.contrat, weight: W.contrat }
  const matches = types.some(pk => CONTRAT_MAP[pk]?.some(label => label.toLowerCase() === ok))
  return { earned: matches ? W.contrat : 0, weight: W.contrat }
}

function evalValeurs(_p: ProfilMatch, _o: OffreMatch): Criterion | null {
  return null
}

function evalLocalisation(p: ProfilMatch, o: OffreMatch): Criterion | null {
  if (offreAvecTeletravail(o.mode_travail)) return { earned: Math.round(W.localisation * 2 / 3), weight: W.localisation }
  const pv = p.ville?.toLowerCase().trim()
  const ov = o.ville?.toLowerCase().trim()
  if (!pv || !ov) return null
  return { earned: pv === ov ? W.localisation : 0, weight: W.localisation }
}

export function scoreRecruteur(profil: ProfilMatch, offre: OffreMatch): number | null {
  const criteria = [
    evalDomaine(profil, offre),
    evalExperience(profil, offre),
    evalContrat(profil, offre),
    evalValeurs(profil, offre),
    evalLocalisation(profil, offre),
  ].filter((c): c is Criterion => c !== null)

  if (criteria.length < 3) return null

  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0)
  const totalEarned = criteria.reduce((s, c) => s + c.earned, 0)
  return Math.round(totalEarned / totalWeight * 100)
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCORE CANDIDAT — tableau de bord, liste offres, détail offre, vitrine entreprise
// ═══════════════════════════════════════════════════════════════════════════════

const WC = {
  domaine:      22,
  experience:   16,
  localisation: 12,
  contrat:       7,
  competences:  15,
} as const

// Seuil d'affichage : domaine + expérience + (ville ou mode_travail) requis.
export function profilSuffisantPourScoreCandidat(p: ProfilMatch): boolean {
  if (!p.domaine || !p.experience) return false
  return !!p.mode_travail || !!p.ville
}

function isDomainMismatchC(p: ProfilMatch, o: OffreMatch): boolean {
  const pd = normDomaine(p.domaine?.trim() ?? '')
  const od = normDomaine(o.domaine?.trim() ?? '')
  if (!pd || !od) return false
  return pd !== od && !DOMAINES_PROCHES.has(`${pd}|${od}`)
}

function evalDomaineC(p: ProfilMatch, o: OffreMatch): Criterion | null {
  const pd = normDomaine(p.domaine?.trim() ?? '')
  const od = normDomaine(o.domaine?.trim() ?? '')
  if (!pd || !od) return null
  if (pd === od) return { earned: WC.domaine, weight: WC.domaine }
  if (DOMAINES_PROCHES.has(`${pd}|${od}`)) return { earned: Math.round(WC.domaine / 2), weight: WC.domaine }
  return { earned: 0, weight: WC.domaine }
}

function evalExperienceC(p: ProfilMatch, o: OffreMatch): Criterion | null {
  const pi = EXPERIENCES.indexOf(p.experience?.trim() ?? '')
  const oi = EXPERIENCES.indexOf(o.experience?.trim() ?? '')
  if (pi === -1 || oi === -1) return null
  const diff = Math.abs(pi - oi)
  if (diff === 0) return { earned: WC.experience, weight: WC.experience }
  if (diff === 1) return { earned: Math.round(WC.experience / 2), weight: WC.experience }
  return { earned: 0, weight: WC.experience }
}

function evalContratC(p: ProfilMatch, o: OffreMatch): Criterion | null {
  const types = p.type_poste ?? []
  const ok    = o.type_contrat?.toLowerCase().trim()
  if (types.length === 0 || !ok) return null
  // 'ouvert' = 60 % du maximum (disponibilité, pas une correspondance)
  if (types.includes('ouvert')) return { earned: Math.round(WC.contrat * 0.6), weight: WC.contrat }
  const matches = types.some(pk => CONTRAT_MAP[pk]?.some(label => label.toLowerCase() === ok))
  return { earned: matches ? WC.contrat : 0, weight: WC.contrat }
}

function normOffreModeC(mode: string | null | undefined): 'remote' | 'hybride' | 'occasionnel' | 'presentiel' | null {
  if (mode === '100% remote')     return 'remote'
  if (mode === 'Hybride')         return 'hybride'
  if (mode === 'Occasionnel')     return 'occasionnel'
  if (mode === '100% présentiel') return 'presentiel'
  return null
}

function evalLocalisationC(p: ProfilMatch, o: OffreMatch): Criterion | null {
  const offreMode  = normOffreModeC(o.mode_travail)
  const profilMode = p.mode_travail ?? null

  if (offreMode === 'remote' || offreMode === 'hybride') {
    if (!profilMode) return null

    // 'flexible' = sans préférence sur le lieu → crédit partiel quel que soit le mode offre
    if (profilMode === 'flexible')
      return { earned: Math.round(WC.localisation * 0.7), weight: WC.localisation }

    if (offreMode === 'remote') {
      if (profilMode === 'remote')       return { earned: WC.localisation,                 weight: WC.localisation }
      if (profilMode === 'hybride')      return { earned: Math.round(WC.localisation / 2), weight: WC.localisation }
      if (profilMode === 'occasionnel')  return { earned: 4,                               weight: WC.localisation }
      if (profilMode === 'presentiel')   return { earned: 0,                               weight: WC.localisation }
    }
    if (offreMode === 'hybride') {
      if (profilMode === 'hybride')      return { earned: WC.localisation,                 weight: WC.localisation }
      if (profilMode === 'remote')       return { earned: Math.round(WC.localisation / 2), weight: WC.localisation }
      if (profilMode === 'occasionnel')  return { earned: 8,                               weight: WC.localisation }
      if (profilMode === 'presentiel')   return { earned: Math.round(WC.localisation / 2), weight: WC.localisation }
    }
    return null
  }

  if (offreMode === 'presentiel' || offreMode === 'occasionnel') {
    const pv = p.ville?.toLowerCase().trim()
    const ov = o.ville?.toLowerCase().trim()
    if (!pv || !ov) return null

    if (pv !== ov) return { earned: 0, weight: WC.localisation }

    // Ville correspond
    if (offreMode === 'presentiel') {
      if (profilMode === 'presentiel')   return { earned: WC.localisation, weight: WC.localisation }
      if (profilMode === 'flexible')     return { earned: WC.localisation, weight: WC.localisation }
      if (profilMode === 'hybride')      return { earned: 10,              weight: WC.localisation }
      if (profilMode === 'occasionnel')  return { earned: 10,              weight: WC.localisation }
      if (profilMode === 'remote')       return { earned: 4,               weight: WC.localisation }
      return null
    }
    // offreMode === 'occasionnel'
    if (profilMode === 'occasionnel')  return { earned: WC.localisation, weight: WC.localisation }
    if (profilMode === 'presentiel')   return { earned: 10,              weight: WC.localisation }
    if (profilMode === 'flexible')     return { earned: 10,              weight: WC.localisation }
    if (profilMode === 'hybride')      return { earned: 11,              weight: WC.localisation }
    if (profilMode === 'remote')       return { earned: 5,               weight: WC.localisation }
    return null
  }

  // offreMode null : mode_travail absent ou non reconnu → repli sur la ville
  const pv = p.ville?.toLowerCase().trim()
  const ov = o.ville?.toLowerCase().trim()
  if (!pv || !ov) return null
  return { earned: pv === ov ? WC.localisation : 0, weight: WC.localisation }
}

function evalCompetencesC(p: ProfilMatch, o: OffreMatch): Criterion | null {
  const reqRef = (o.competences ?? []).filter(c => COMP_REF_SET.has(c))
  if (reqRef.length === 0) return null
  const pRef   = (p.competences_acquises ?? []).filter(c => COMP_REF_SET.has(c))
  const matches = pRef.filter(c => reqRef.includes(c)).length
  return { earned: Math.round(matches / reqRef.length * WC.competences), weight: WC.competences }
}

function evalLanguesBonusC(p: ProfilMatch, o: OffreMatch): number {
  const offreLangues = o.langues ?? []
  if (offreLangues.length === 0) return 0
  const profilLangNoms = new Set(
    (p.langues ?? []).map(l => l.split(' — ')[0].toLowerCase().trim())
  )
  const matches = offreLangues.filter(code => {
    const lang = LANGUES.find(l => l.code === code)
    return lang != null && profilLangNoms.has(lang.nom.toLowerCase())
  }).length
  return Math.min(matches, 3)
}

export function scoreCandidat(profil: ProfilMatch, offre: OffreMatch): number | null {
  if (!profilSuffisantPourScoreCandidat(profil)) return null

  // Domaine et expérience sont les critères structurants : tous deux doivent être évaluables.
  const domaineResult    = evalDomaineC(profil, offre)
  const experienceResult = evalExperienceC(profil, offre)
  if (domaineResult === null || experienceResult === null) return null

  const criteria = [
    domaineResult,
    experienceResult,
    evalContratC(profil, offre),
    evalLocalisationC(profil, offre),
    evalCompetencesC(profil, offre),
  ].filter((c): c is Criterion => c !== null)

  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0)
  const totalEarned = criteria.reduce((s, c) => s + c.earned, 0)
  let score = Math.round(totalEarned / totalWeight * 100)

  // Plafond de domaine : mismatch complet (pas d'adjacence) → 45 max
  if (isDomainMismatchC(profil, offre)) score = Math.min(score, 45)

  // Bonus langues ajouté après le plafond, total limité à 100
  return Math.min(score + evalLanguesBonusC(profil, offre), 100)
}

export function scoreBreakdownCandidat(profil: ProfilMatch, offre: OffreMatch): ScoreBreakdown {
  return {
    domaine:      evalDomaineC(profil, offre),
    experience:   evalExperienceC(profil, offre),
    contrat:      evalContratC(profil, offre),
    localisation: evalLocalisationC(profil, offre),
    competences:  evalCompetencesC(profil, offre),
    total:        scoreCandidat(profil, offre),
  }
}

/** Compétences de l'offre présentes dans COMP_REF_SET et absentes du profil, dans l'ordre de l'offre. */
export function competencesManquantesCandidat(profil: ProfilMatch, offre: OffreMatch): string[] {
  const reqRef = (offre.competences ?? []).filter(c => COMP_REF_SET.has(c))
  const pRef   = new Set((profil.competences_acquises ?? []).filter(c => COMP_REF_SET.has(c)))
  return reqRef.filter(c => !pRef.has(c))
}

/** Score hypothétique si le candidat ajoutait toutes les compétences manquantes de l'offre. */
export function scoreSiCompetencesAjoutees(profil: ProfilMatch, offre: OffreMatch): number | null {
  const manquantes = competencesManquantesCandidat(profil, offre)
  if (manquantes.length === 0) return scoreCandidat(profil, offre)
  return scoreCandidat({
    ...profil,
    competences_acquises: [...(profil.competences_acquises ?? []), ...manquantes],
  }, offre)
}
