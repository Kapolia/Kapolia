// Utilitaires purs de l'onboarding — extraits ici pour être testables indépendamment.

import { DOMAINES as _DOMAINES, EXPERIENCES as _EXP_KEYS, TYPES_POSTE as _TYPES_POSTE } from '@/lib/referentiels'
import { preparerExperiencePourEnregistrement, experienceVide, formationVide } from '@/lib/parcours'

// ─── Constantes ───────────────────────────────────────────────────────────────

export const ONBOARDING_TOTAL = 9                               // nombre d'écrans affichés
export const STEP_OFFSET      = 100                             // décalage DB : écran n → valeur 100+n
export const LAST_STEP        = STEP_OFFSET + ONBOARDING_TOTAL  // 109, valeur stockée en fin de parcours
export const MAX_MISSIONS     = 5

// Convertit un numéro d'écran (1–9) en valeur stockée en base (101–109).
export function screenToStep(screen: number): number {
  return screen + STEP_OFFSET
}

// Convertit une valeur base (101–109) en numéro d'écran (1–9).
export function stepToScreen(step: number): number {
  return step - STEP_OFFSET
}

export { _DOMAINES as DOMAINES, _TYPES_POSTE as TYPES_POSTE }

// Descriptions affichées dans l'UI onboarding — données de présentation uniquement.
const EXPERIENCE_DESCS: Record<string, string> = {
  'Sans expérience': 'Vous faites vos premiers pas',
  '1-2 ans':         'Vous avez débuté récemment',
  '3-5 ans':         'Vous avez pris vos marques',
  '5-10 ans':        'Vous avancez avec assurance',
  '+10 ans':         'Vous avez une longue expérience du métier',
}

export const EXPERIENCES: { key: string; desc: string }[] = _EXP_KEYS.map(key => ({
  key,
  desc: EXPERIENCE_DESCS[key] ?? key,
}))

export type Experience = {
  poste: string
  entreprise: string
  en_poste: boolean
  missions: string
  debut_annee: number | null
  debut_mois:  number | null
  fin_annee:   number | null
  fin_mois:    number | null
  date_debut?: string
  date_fin?:   string
  date_a_verifier?: boolean | null
}

export type Diplome = {
  intitule:  string
  ecole:     string
  annee:     string
  en_cours?: boolean
}

export type OnboardingFormData = {
  prenom: string
  nom: string
  domaine: string
  experience: string
  parcours: string        // colonne signature — chargée depuis la base, plus modifiée par l'onboarding
  projet: string
  projet_titre: string
  passions: string[]
  disponibilite: string
  dispo_date: string
  typePoste: string[]
  lieu: string
  ville: string
  permis: string[]
  priorite: string[]
  experiences: Experience[]
  diplomes: Diplome[]
  competences_acquises: string[]
  langues: string[]
}

export const EMPTY_FORM: OnboardingFormData = {
  prenom: '', nom: '', domaine: '', experience: '', parcours: '',
  projet: '', projet_titre: '', passions: [],
  disponibilite: '', dispo_date: '',
  typePoste: [], lieu: '', ville: '', permis: [], priorite: [],
  experiences: [], diplomes: [], competences_acquises: [], langues: [],
}

// Retourne le premier écran OBLIGATOIRE non encore rempli (numéro 1–9).
// step3Done doit être passé depuis la page (résolu via test_qualites en base).
export function firstIncompleteStep(d: OnboardingFormData, step3Done = false): number {
  if (!d.prenom.trim() || !d.nom.trim()) return 1
  if (!d.domaine || !d.experience)       return 2
  if (!step3Done)                        return 3
  // écran 4 facultatif (projet, passions)
  const dispoOk = !!d.disponibilite && (d.disponibilite !== 'a_partir_de' || !!d.dispo_date)
  if (!d.typePoste.length || !d.lieu || !dispoOk) return 5
  // écrans 6, 7, 8 facultatifs
  return 9  // dernier écran
}

// Convertit une valeur onboarding_step (base) en numéro d'écran (1–9).
// Gère les nouvelles valeurs 101–109 et les anciennes 1–15.
// Table de correspondance anciens → nouveaux :
//   1 → 1 ; 2–3 → 2 ; 4–6 → 3 ; 7–8 → 4 ; 9/10/12 → 5 ; 11 → 6 ; 13 → 7 ; 14 → 8 ; 15+ → 9
export function convertSavedStep(savedStep: number): number {
  if (savedStep >= 101 && savedStep <= 109) return stepToScreen(savedStep)
  if (savedStep <= 1)   return 1
  if (savedStep <= 3)   return 2
  if (savedStep <= 6)   return 3
  if (savedStep <= 8)   return 4
  if (savedStep === 11) return 6
  if (savedStep <= 12)  return 5   // 9, 10, 12 (11 déjà traité)
  if (savedStep === 13) return 7
  if (savedStep === 14) return 8
  return 9                          // 15 et au-delà
}

// Construit le payload partiel pour l'écran courant (numéros 1–9).
// N'inclut QUE les champs effectivement renseignés pour ne jamais écraser
// une valeur déjà enregistrée lors d'une session précédente.
// Ne contient jamais onboarding_completed.
export function buildStepPayload(
  screen: number,
  d: OnboardingFormData,
  maxStep: number,
): Record<string, unknown> | null {
  const base: Record<string, unknown> = { onboarding_step: maxStep }
  switch (screen) {
    case 1:
      if (!d.prenom.trim() && !d.nom.trim()) return null
      return { ...base, prenom: d.prenom, nom: d.nom }
    case 2: {
      const p: Record<string, unknown> = { ...base }
      if (d.domaine)    p.domaine    = d.domaine
      if (d.experience) p.experience = d.experience
      return Object.keys(p).length > 1 ? p : null
    }
    case 3:
      return null  // persisté par QualitesCarousel via test_qualites
    case 4: {
      const p: Record<string, unknown> = { ...base }
      if (d.projet.trim()) {
        p.projet_phare = d.projet
        p.projet_titre = d.projet_titre.trim() || null
      }
      if (d.passions.length) p.passions = d.passions
      return Object.keys(p).length > 1 ? p : null
    }
    case 5: {
      const p: Record<string, unknown> = { ...base }
      if (d.typePoste.length) p.type_poste   = d.typePoste
      if (d.lieu)             p.mode_travail = d.lieu
      if (d.ville.trim())     p.ville        = d.ville
      if (d.permis.length)    p.permis       = d.permis
      if (d.disponibilite) {
        p.disponibilite = d.disponibilite
        p.dispo_date    = d.disponibilite === 'a_partir_de' ? (d.dispo_date || null) : null
      }
      return Object.keys(p).length > 1 ? p : null
    }
    case 6:
      return d.priorite.length ? { ...base, priorites: d.priorite } : null
    case 7: {
      const exps = d.experiences.filter(e => !experienceVide(e)).map(preparerExperiencePourEnregistrement)
      return exps.length ? { ...base, experiences: exps } : null
    }
    case 8: {
      const diplos = d.diplomes.filter(f => !formationVide(f))
      return diplos.length ? { ...base, diplomes: diplos } : null
    }
    case 9: {
      const p: Record<string, unknown> = { ...base }
      if (d.competences_acquises.length) p.competences_acquises = d.competences_acquises
      if (d.langues.length)              p.langues              = d.langues
      return Object.keys(p).length > 1 ? p : null
    }
    default:
      return null
  }
}
