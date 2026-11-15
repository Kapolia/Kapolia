import { normalizeText } from '@/lib/storage-utils'

export type EntrepriseKapolia = { nom: string; logoUrl: string | null }

export function normaliserNomEntreprise(nom: string): string {
  return normalizeText(nom).replace(/\s+/g, ' ').trim()
}

let cache: EntrepriseKapolia[] | null = null

export async function chargerEntreprisesKapolia(): Promise<EntrepriseKapolia[]> {
  if (cache !== null) return cache

  const { supabase } = await import('@/lib/supabase')
  const { data, error } = await supabase
    .from('profils_vue_publique')
    .select('entreprise_nom, entreprise_logo_url')
    .not('entreprise_nom', 'is', null)

  if (error) {
    console.error('chargerEntreprisesKapolia:', error)
    return []
  }

  const map = new Map<string, EntrepriseKapolia>()
  for (const row of (data ?? [])) {
    const nom = (row.entreprise_nom as string | null)?.trim()
    if (!nom) continue
    const logoUrl = (row.entreprise_logo_url as string | null) || null
    const key = normaliserNomEntreprise(nom)
    const existing = map.get(key)
    if (!existing || (!existing.logoUrl && logoUrl)) {
      map.set(key, { nom, logoUrl })
    }
  }

  cache = Array.from(map.values())
  return cache
}
