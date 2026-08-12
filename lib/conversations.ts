import { supabase } from './supabase'

export async function trouverConversation(
  candidatId: string,
  offreId?: string,
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const baseQuery = supabase
    .from('conversations')
    .select('id')
    .eq('recruteur_id', user.id)
    .eq('candidat_id', candidatId)

  const { data } = await (
    offreId ? baseQuery.eq('offre_id', offreId) : baseQuery.is('offre_id', null)
  ).maybeSingle()

  return data?.id ?? null
}

export async function ouvrirConversation(
  candidatId: string,
  offreId?: string,
): Promise<string | null> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    console.error('ouvrirConversation: non authentifié', authError)
    return null
  }

  const baseQuery = supabase
    .from('conversations')
    .select('id, masquee_recruteur, masquee_candidat')
    .eq('recruteur_id', user.id)
    .eq('candidat_id', candidatId)

  const { data: existing, error: findError } = await (
    offreId ? baseQuery.eq('offre_id', offreId) : baseQuery.is('offre_id', null)
  ).maybeSingle()

  if (findError) {
    console.error('ouvrirConversation: erreur recherche', findError.message, findError.code, findError.details, findError.hint)
    return null
  }

  if (existing) {
    const e = existing as { id: string; masquee_recruteur?: boolean; masquee_candidat?: boolean }
    if (e.masquee_recruteur || e.masquee_candidat) {
      await supabase.from('conversations')
        .update({ masquee_recruteur: false, masquee_candidat: false })
        .eq('id', e.id)
    }
    return e.id
  }

  const { data: created, error: insertError } = await supabase
    .from('conversations')
    .insert({
      recruteur_id:      user.id,
      candidat_id:       candidatId,
      offre_id:          offreId ?? null,
      derniere_activite: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('ouvrirConversation: erreur création', insertError.message, insertError.code, insertError.details, insertError.hint)
    return null
  }

  return created.id
}
