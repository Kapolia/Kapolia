// Palette Kapolia — source unique partagée entre tous les composants.
// Exception intentionnelle : app/page.tsx (landing liste d'attente) conserve
// sa propre palette plus chaude (sable #E8D5B7, creme #F7F2EB comme fond de section).
// C'est une page éditoriale, pas une interface — ne pas l'uniformiser.
export const C = {
  // Marque
  terracotta: '#C4673A',
  vert:       '#2C4A3E',

  // Fonds de page
  bg:         '#F6F7F6',   // fond général (gris-vert froid)
  creme:      '#F7F2EB',   // accent chaud — zones mises en avant uniquement

  // Surfaces
  white:      '#FFFFFF',   // fond de carte
  chip:       '#F1F3F2',   // pastilles neutres

  // Bordures
  sable:      '#E7EAE8',

  // Texte
  dark:       '#15201B',
  grey:       '#687069',
} as const

// Cartes de premier niveau — ombre teintée vert, deux couches
export const CARD_SHADOW = '0 1px 2px rgba(27, 48, 38, .06), 0 6px 16px rgba(27, 48, 38, .07)' as const
export const CARD_RADIUS = 12 as const
