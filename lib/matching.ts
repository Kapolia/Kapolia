// Scoring weights — must sum to 100
const W = {
  domaine:  30,
  experience: 20,
  contrat:  20,
  valeurs:  15,
  localisation: 15,
} as const

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProfilMatch = {
  domaine?: string | null
  experience?: string | null
  type_poste?: string | null
  valeur?: string | null
  disponibilite?: string | string[] | null
  ville?: string | null
}

export type OffreMatch = {
  domaine?: string | null
  experience?: string | null
  type_contrat?: string | null
  valeurs?: string[] | null
  ville?: string | null
  teletravail?: boolean | null
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
  ].flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`])
)

function scoreDomaine(p: ProfilMatch, o: OffreMatch): number {
  const pd = p.domaine?.trim()
  const od = o.domaine?.trim()
  if (!pd || !od) return 0
  if (pd === od) return W.domaine
  if (DOMAINES_PROCHES.has(`${pd}|${od}`)) return Math.round(W.domaine / 2)
  return 0
}

// ─── Experience ───────────────────────────────────────────────────────────────

const EXP_LEVELS = ['< 2 ans', '2–5 ans', '5–10 ans', '10+ ans']

function scoreExperience(p: ProfilMatch, o: OffreMatch): number {
  const pi = EXP_LEVELS.indexOf(p.experience ?? '')
  const oi = EXP_LEVELS.indexOf(o.experience ?? '')
  if (pi === -1 || oi === -1) return 0
  const diff = Math.abs(pi - oi)
  if (diff === 0) return W.experience
  if (diff === 1) return Math.round(W.experience / 2)
  return 0
}

// ─── Type de contrat ──────────────────────────────────────────────────────────

// profil stores lowercase keys ('cdi', 'freelance', 'ouvert')
// offre stores display labels ('CDI', 'Freelance', 'Stage')
const CONTRAT_MAP: Record<string, string> = {
  cdi:        'CDI',
  cdd:        'CDD',
  freelance:  'Freelance',
  alternance: 'Alternance',
  stage:      'Stage',
}

function scoreContrat(p: ProfilMatch, o: OffreMatch): number {
  const pk = p.type_poste?.toLowerCase().trim()
  const ok = o.type_contrat?.toLowerCase().trim()
  if (!pk || !ok) return 0
  if (pk === 'ouvert') return W.contrat  // open to any contract
  const mapped = CONTRAT_MAP[pk]?.toLowerCase()
  return mapped === ok ? W.contrat : 0
}

// ─── Valeurs ──────────────────────────────────────────────────────────────────

// profil.disponibilite stores the candidat's priorities (same vocabulary as offre.valeurs)
// e.g. ['Impact réel', 'Autonomie', 'Équipe soudée']
function scoreValeurs(p: ProfilMatch, o: OffreMatch): number {
  const ov = o.valeurs
  if (!ov || ov.length === 0) return 0

  const pv: string[] = Array.isArray(p.disponibilite)
    ? p.disponibilite
    : typeof p.disponibilite === 'string' && p.disponibilite
      ? [p.disponibilite]
      : []

  if (pv.length === 0) return 0

  const match = pv.some(v => ov.includes(v))
  return match ? W.valeurs : 0
}

// ─── Localisation ─────────────────────────────────────────────────────────────

function scoreLocalisation(p: ProfilMatch, o: OffreMatch): number {
  const pv = p.ville?.toLowerCase().trim()
  const ov = o.ville?.toLowerCase().trim()

  if (pv && ov && pv === ov) return W.localisation
  if (o.teletravail) return Math.round(W.localisation * 2 / 3)
  return 0
}

// ─── Main function ────────────────────────────────────────────────────────────

export function calculerScore(profil: ProfilMatch, offre: OffreMatch): number {
  const total =
    scoreDomaine(profil, offre) +
    scoreExperience(profil, offre) +
    scoreContrat(profil, offre) +
    scoreValeurs(profil, offre) +
    scoreLocalisation(profil, offre)

  return Math.min(100, Math.max(0, total))
}

// ─── Score breakdown (for debugging / UI tooltips) ───────────────────────────

export function scoreBreakdown(profil: ProfilMatch, offre: OffreMatch) {
  return {
    domaine:      scoreDomaine(profil, offre),
    experience:   scoreExperience(profil, offre),
    contrat:      scoreContrat(profil, offre),
    valeurs:      scoreValeurs(profil, offre),
    localisation: scoreLocalisation(profil, offre),
    total:        calculerScore(profil, offre),
  }
}
