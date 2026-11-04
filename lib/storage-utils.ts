/**
 * Supprime les diacritiques et passe en minuscules.
 * "chargé de formation" → "charge de formation"
 * Utilisable pour la comparaison de texte (recherche, matching).
 */
export function normalizeText(s: string): string {
  return s
    .normalize('NFC')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/**
 * Convertit un nom de fichier fourni par l'utilisateur en cle de stockage sure.
 *
 * Etapes :
 *  1. Normalise l'encodage NFD (produit par macOS) vers NFC, puis supprime
 *     les diacritiques combinants (U+0300-U+036F).
 *  2. Passe en minuscules.
 *  3. Remplace tout caractere hors [a-z0-9] par un tiret.
 *  4. Reduit les sequences de tirets, retire les tirets en debut/fin.
 *  5. Limite a 80 caracteres en conservant l'extension.
 *
 * Le nom d'origine (pour affichage) n'est jamais modifie cote appelant :
 * seul le chemin passe a Supabase Storage utilise la valeur retournee.
 */
export function sanitizeFilename(name: string): string {
  const lastDot = name.lastIndexOf('.')
  const hasExt  = lastDot > 0 && lastDot < name.length - 1

  const rawStem = hasExt ? name.slice(0, lastDot) : name
  const rawExt  = hasExt ? name.slice(lastDot + 1) : ''

  const clean = (s: string): string =>
    normalizeText(s)
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')

  const cleanStem = clean(rawStem) || 'fichier'
  const cleanExt  = clean(rawExt)
  const suffix    = cleanExt ? `.${cleanExt}` : ''
  const maxStem   = 80 - suffix.length

  return cleanStem.slice(0, Math.max(1, maxStem)) + suffix
}
