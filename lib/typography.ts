/**
 * Constantes typographiques Kapolia.
 *
 * Utilisation dans les styles inline React :
 *   import { FONT_SANS, FONT_LOGO, FS, LH } from '@/lib/typography'
 *
 *   fontFamily: FONT_SANS
 *   fontSize:   FS.h1
 *   lineHeight: LH.relaxed
 */

/** Police sans-serif — tous les textes interface, titres, formulaires (variable 400–700) */
export const FONT_SANS = "'Source Sans 3', system-ui, sans-serif" as const

/** Lora 600 uniquement, réservée au nom « Kapolia » du logo */
export const FONT_LOGO = "'Lora', Georgia, serif" as const

/**
 * Échelle de tailles en px.
 * `h1` est une valeur fluide (string) — les autres sont des nombres.
 */
export const FS = {
  /** Micro-labels dans les blocs de grille calendrier */
  xxs:   9,
  /** Badges, légendes, labels capitalisés */
  xs:   11,
  /** Métadonnées, boutons secondaires, textes de formulaire */
  sm:   13,
  /** Corps de texte courant */
  base: 14,
  /** Corps large, paragraphes de présentation */
  md:   16,
  /** Titres de cartes, libellés d'items importants */
  card: 19,
  /** Titres de sections (h3) */
  h3:   22,
  /** Titres de panneaux et modales (h2) */
  h2:   24,
  /** Titres de page (h1) — valeur fluide */
  h1:  'clamp(27px, 3.85vw, 35px)',
} as const

/** Hauteurs de ligne */
export const LH = {
  tight:   1.2,
  snug:    1.4,
  normal:  1.5,
  relaxed: 1.65,
  loose:   1.75,
} as const
