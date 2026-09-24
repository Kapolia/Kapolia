// Utilitaires purs de l'onboarding — extraits ici pour être testables indépendamment.

export const ONBOARDING_TOTAL = 15
export const MAX_MISSIONS     = 4

export const DOMAINES = [
  'Tech & Ingénierie', 'Design & Créativité', 'Marketing & Com',
  'Finance & Compta', 'RH & Recrutement', 'Commerce & Vente',
  'Opérations & Logistique', 'Conseil & Stratégie', 'Autre',
]

export const EXPERIENCES: { key: string; desc: string }[] = [
  { key: '< 2 ans',  desc: 'Débuts prometteurs' },
  { key: '2–5 ans',  desc: 'Vous avez vos marques' },
  { key: '5–10 ans', desc: 'Confirmé(e), vous avancez avec confiance' },
  { key: '10+ ans',  desc: 'Expert(e) reconnu(e)' },
]

export const TYPES_POSTE: { key: string; label: string }[] = [
  { key: 'cdi',        label: 'CDI' },
  { key: 'cdd',        label: 'CDD' },
  { key: 'freelance',  label: 'Freelance / Mission' },
  { key: 'alternance', label: 'Alternance / Stage' },
  { key: 'ouvert',     label: 'Ouvert(e) à tout' },
]

export type Experience = {
  poste: string
  entreprise: string
  date_debut: string
  date_fin: string
  en_poste: boolean
  missions: string
}

export type Diplome = {
  intitule: string
  ecole: string
  annee: string
  mention: string
}

export type OnboardingFormData = {
  prenom: string
  nom: string
  domaine: string
  experience: string
  parcours: string
  environnement: string[]
  projet: string
  projet_titre: string
  passions: string[]
  disponibilite: string
  dispo_date: string
  typePoste: string[]
  lieu: string
  ville: string
  priorite: string[]
  experiences: Experience[]
  diplomes: Diplome[]
  competences_acquises: string[]
  langues: string[]
}

export const EMPTY_FORM: OnboardingFormData = {
  prenom: '', nom: '', domaine: '', experience: '', parcours: '',
  environnement: [], projet: '', projet_titre: '', passions: [],
  disponibilite: '', dispo_date: '',
  typePoste: [], lieu: '', ville: '', priorite: [],
  experiences: [], diplomes: [], competences_acquises: [], langues: [],
}

// Retourne la première étape OBLIGATOIRE non encore remplie.
// Utilisé en fallback quand onboarding_step n'est pas encore enregistré en base.
// step5Done doit être passé depuis la page (résolu via test_qualites en base).
export function firstIncompleteStep(d: OnboardingFormData, step5Done = false): number {
  if (!d.prenom.trim() || !d.nom.trim()) return 1
  if (!d.domaine)                         return 2
  if (!d.experience)                      return 3
  if (!step5Done)                         return 5
  if (!d.environnement.length)            return 6
  if (!d.typePoste.length)                return 10
  if (!d.lieu)                            return 11
  if (!d.disponibilite)                   return 13
  return ONBOARDING_TOTAL
}

// Construit le payload partiel pour l'étape courante.
// N'inclut QUE les champs effectivement renseignés pour ne jamais écraser
// une valeur déjà enregistrée lors d'une session précédente.
// Ne contient jamais onboarding_completed.
export function buildStepPayload(
  step: number,
  d: OnboardingFormData,
  maxStep: number,
): Record<string, unknown> | null {
  const base: Record<string, unknown> = { onboarding_step: maxStep }
  switch (step) {
    case 1:
      if (!d.prenom.trim() && !d.nom.trim()) return null
      return { ...base, prenom: d.prenom, nom: d.nom }
    case 2:
      return d.domaine ? { ...base, domaine: d.domaine } : null
    case 3:
      return d.experience ? { ...base, experience: d.experience } : null
    case 4:
      return d.parcours.trim() ? { ...base, signature: d.parcours } : null
    case 5:
      return null  // Step 5 saves via test_qualites (QualitesCarousel handles its own persistence)
    case 6:
      return d.environnement.length ? { ...base, mode_travail: d.environnement } : null
    case 7:
      return d.projet.trim() ? { ...base, projet_phare: d.projet, projet_titre: d.projet_titre.trim() || null } : null
    case 8:
      return d.passions.length ? { ...base, passions: d.passions } : null
    case 9:
      return d.typePoste.length ? { ...base, type_poste: d.typePoste } : null
    case 10: {
      const p: Record<string, unknown> = { ...base }
      if (d.lieu)         p.structure = d.lieu
      if (d.ville.trim()) p.ville     = d.ville
      return Object.keys(p).length > 1 ? p : null
    }
    case 11:
      return d.priorite.length ? { ...base, priorites: d.priorite } : null
    case 12: {
      if (!d.disponibilite) return null
      return {
        ...base,
        disponibilite: d.disponibilite,
        dispo_date: d.disponibilite === 'a_partir_de' ? (d.dispo_date || null) : null,
      }
    }
    case 13:
      return d.experiences.length ? { ...base, experiences: d.experiences } : null
    case 14:
      return d.diplomes.length ? { ...base, diplomes: d.diplomes } : null
    default:
      return null
  }
}
