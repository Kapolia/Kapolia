import { supabase } from './supabase'

export async function ouvrirConversation(
  candidatId: string,
  offreId?: string,
): Promise<string | null> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    console.error('ouvrirConversation: non authentifié', authError)
    return null
  }

  const { data: existing, error: findError } = await supabase
    .from('conversations')
    .select('id')
    .eq('recruteur_id', user.id)
    .eq('candidat_id', candidatId)
    .maybeSingle()

  if (findError) {
    console.error('ouvrirConversation: erreur recherche', findError.message, findError.code, findError.details, findError.hint)
    return null
  }

  if (existing) return existing.id

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
