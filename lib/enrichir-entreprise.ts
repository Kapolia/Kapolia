import { supabase } from './supabase'

export type ProfilEntrepriseMap = Record<string, {
  entreprise_nom:      string | null
  entreprise_logo_url: string | null
}>

export async function fetchProfilsEntreprise(
  recruteurIds: string[]
): Promise<{ map: ProfilEntrepriseMap; error: unknown }> {
  if (!recruteurIds.length) return { map: {}, error: null }

  const { data, error } = await supabase
    .from('profils')
    .select('user_id, entreprise_nom, entreprise_logo_url')
    .in('user_id', recruteurIds)

  if (error) {
    console.error('[fetchProfilsEntreprise]', error)
    return { map: {}, error }
  }

  const map: ProfilEntrepriseMap = Object.fromEntries(
    (data ?? []).map(p => [
      p.user_id,
      { entreprise_nom: p.entreprise_nom, entreprise_logo_url: p.entreprise_logo_url },
    ])
  )
  return { map, error: null }
}
