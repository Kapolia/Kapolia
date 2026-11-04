// Palette Kapolia — source unique partagée entre tous les composants.
// Exception intentionnelle : app/page.tsx (landing liste d'attente) conserve
// sa propre palette plus chaude (sable #E8D5B7, creme #F7F2EB comme fond de section).
// C'est une page éditoriale, pas une interface — ne pas l'uniformiser.
export const C = {
  // Marque
  vert:          '#24453A',
  orange:        '#C2611F',              // bouton principal, entrée active, badges
  orangeTexte:   '#A9541A',              // orange utilisé en texte (liens, « Voir tout »)
  orangeDoux:    'rgba(194, 97, 31, 0.2)', // fond de l'entrée active
  terracotta:    '#C2611F',              // alias historique de orange

  // Fonds
  bg:            '#F6F7F5',
  creme:         '#F7F2EB',              // landing uniquement
  white:         '#FFFFFF',
  chip:          '#F0F2F0',
  salaire:       '#E6EFE9',

  // Bordures
  sable:         '#E5E8E5',              // nom historique : c'est la couleur des bordures

  // Texte
  dark:          '#15201B',
  grey:          '#646D67',
  chipTexte:     '#3B4A42',
  surVert:       'rgba(255, 255, 255, 0.72)',

  // États (inchangés)
  succes:        '#3E8E5E',
  attente:       '#C88A2A',
  erreur:        '#C0392B',
} as const

export const CARD_SHADOW = '0 1px 2px rgba(27, 48, 38, .06), 0 6px 16px rgba(27, 48, 38, .07)' as const
export const CARD_RADIUS = 12 as const
