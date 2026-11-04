import { supabase } from '@/lib/supabase'

type RdvRow = { creneaux_rdv: { debut_utc: string }[] }

export function countRdvEnAttente(rows: RdvRow[]): number {
  return rows.filter(r =>
    r.creneaux_rdv.some(c => new Date(c.debut_utc).getTime() > Date.now())
  ).length
}

export async function fetchRdvEnAttenteCount(userId: string): Promise<number> {
  const { data } = await supabase
    .from('rendez_vous')
    .select('id, creneaux_rdv(id, debut_utc)')
    .eq('candidat_id', userId)
    .eq('statut', 'proposee')
  return countRdvEnAttente((data ?? []) as RdvRow[])
}
