import { supabase } from './supabase'
import { notifCreneauConfirme, notifRdvRefuse } from './actions/email-notifs'
import type { PostgrestError } from '@supabase/supabase-js'

export type RdvPlusPropose = { code: 'RDV_PLUS_PROPOSE'; statut: string }

export function isRdvPlusPropose(err: unknown): err is RdvPlusPropose {
  return typeof err === 'object' && err !== null && (err as RdvPlusPropose).code === 'RDV_PLUS_PROPOSE'
}

export async function accepterCreneau(
  rdvId:    string,
  creneauId: string,
): Promise<{ error: PostgrestError | RdvPlusPropose | null }> {
  // 1. Pre-check — refuser sans écrire si le rdv n'est plus proposé
  const { data: rdvCheck, error: checkErr } = await supabase
    .from('rendez_vous')
    .select('statut')
    .eq('id', rdvId)
    .single()
  if (checkErr) {
    console.error('[accepterCreneau check]', checkErr.message, checkErr.code, checkErr.details, checkErr.hint)
    return { error: checkErr }
  }
  if (rdvCheck.statut !== 'proposee') {
    return { error: { code: 'RDV_PLUS_PROPOSE', statut: rdvCheck.statut } }
  }

  // 2. Update creneaux_rdv.selectionne = true
  const { error: crErr } = await supabase
    .from('creneaux_rdv')
    .update({ selectionne: true })
    .eq('id', creneauId)
  if (crErr) {
    console.error('[accepterCreneau créneau]', crErr.message, crErr.code, crErr.details, crErr.hint)
    return { error: crErr }
  }

  // 3. Update rendez_vous avec guard sur statut + vérification du nombre de lignes
  const { data: updated, error: rdvErr } = await supabase
    .from('rendez_vous')
    .update({ statut: 'acceptee' })
    .eq('id', rdvId)
    .eq('statut', 'proposee')
    .select('id')
  if (rdvErr) {
    console.error('[accepterCreneau rdv]', rdvErr.message, rdvErr.code, rdvErr.details, rdvErr.hint)
    const { error: rbErr } = await supabase.from('creneaux_rdv').update({ selectionne: false }).eq('id', creneauId)
    if (rbErr) console.error('[accepterCreneau rollback]', rbErr.message, rbErr.code, rbErr.details, rbErr.hint)
    return { error: rdvErr }
  }
  if (!updated || updated.length === 0) {
    // Statut changé entre le pre-check et l'update — race condition
    console.error('[accepterCreneau rdv] 0 lignes — statut changé entre le check et l\'update')
    const { error: rbErr } = await supabase.from('creneaux_rdv').update({ selectionne: false }).eq('id', creneauId)
    if (rbErr) console.error('[accepterCreneau rollback]', rbErr.message, rbErr.code, rbErr.details, rbErr.hint)
    return { error: { code: 'RDV_PLUS_PROPOSE', statut: 'inconnu' } }
  }

  notifCreneauConfirme(rdvId, creneauId).catch(e => console.error('[notif creneau-confirme]', e))
  return { error: null }
}

export async function refuserCreneaux(
  rdvId:   string,
  message: string | null,
): Promise<{ error: PostgrestError | RdvPlusPropose | null; messageNonEnvoye?: true }> {
  const { data: updated, error: rdvErr } = await supabase
    .from('rendez_vous')
    .update({ statut: 'refusee' })
    .eq('id', rdvId)
    .eq('statut', 'proposee')
    .select('id, conversation_id')
  if (rdvErr) {
    console.error('[refuserCreneaux rdv]', rdvErr.message, rdvErr.code, rdvErr.details, rdvErr.hint)
    return { error: rdvErr }
  }
  if (!updated || updated.length === 0) {
    return { error: { code: 'RDV_PLUS_PROPOSE', statut: 'inconnu' } }
  }

  const conversationId = (updated[0] as { conversation_id: string }).conversation_id

  if (message?.trim()) {
    const { data: authData } = await supabase.auth.getUser()
    const user = authData?.user
    if (user) {
      const { error: msgErr } = await supabase
        .from('messages')
        .insert({ expediteur_id: user.id, conversation_id: conversationId, contenu: message.trim() })
      if (msgErr) {
        console.error('[refuserCreneaux message]', msgErr.message, msgErr.code, msgErr.details, msgErr.hint)
        notifRdvRefuse(rdvId, false).catch(e => console.error('[notif rdv-refuse]', e))
        return { error: null, messageNonEnvoye: true }
      }
    }
  }

  notifRdvRefuse(rdvId, !!(message?.trim())).catch(e => console.error('[notif rdv-refuse]', e))
  return { error: null }
}
