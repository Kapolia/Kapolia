'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { accepterCreneau, isRdvPlusPropose } from '@/lib/rdv'
import { C as _C } from '@/lib/colors'
const C = { ..._C, lightGrey: '#C8C8C8' as const }

export type RdvRole = 'candidat' | 'recruteur'

type Creneau = { id: string; debut_utc: string; selectionne: boolean }
type Rdv = {
  id:            string
  type:          'telephonique' | 'entretien'
  duree_minutes: number
  contact_info:  string | null
  statut:        string
  creneaux_rdv:  Creneau[]
}
type StatutEffectif = 'proposee' | 'acceptee' | 'refusee' | 'annulee' | 'expiree'

function computeStatut(statut: string, creneaux: Creneau[]): StatutEffectif {
  if (statut !== 'proposee') return statut as StatutEffectif
  const now = Date.now()
  return creneaux.length > 0 && creneaux.every(c => new Date(c.debut_utc).getTime() < now)
    ? 'expiree'
    : 'proposee'
}

function formatCreneau(utc: string): string {
  const d = new Date(utc)
  return (
    d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) +
    ' à ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  )
}

const STATUT_CFG: Record<StatutEffectif, { label: string; bg: string; color: string }> = {
  proposee: { label: 'En attente', bg: `${C.terracotta}1A`, color: C.terracotta },
  acceptee: { label: 'Confirmé',   bg: `${C.vert}1A`,       color: C.vert       },
  refusee:  { label: 'Refusé',     bg: `${C.grey}22`,       color: C.grey       },
  annulee:  { label: 'Annulé',     bg: `${C.grey}22`,       color: C.grey       },
  expiree:  { label: 'Expiré',     bg: `${C.lightGrey}44`,  color: C.lightGrey  },
}

export default function RdvBubble({ rdvId, role }: { rdvId: string; role: RdvRole }) {
  const [rdv,       setRdv]       = useState<Rdv | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [acting,    setActing]    = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [errMsg,    setErrMsg]    = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('rendez_vous')
      .select('id, type, duree_minutes, contact_info, statut, creneaux_rdv(id, debut_utc, selectionne)')
      .eq('id', rdvId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('[RdvBubble fetch]', error.message, error.code, error.details, error.hint)
        } else {
          setRdv(data as unknown as Rdv)
          setErrMsg(null)
        }
        setLoading(false)
      })
  }, [rdvId, reloadKey])

  async function accepter(creneauId: string) {
    if (!rdv || acting) return
    setActing(true)
    const { error } = await accepterCreneau(rdvId, creneauId)
    if (error) {
      if (isRdvPlusPropose(error)) {
        setErrMsg('Ce rendez-vous n\'est plus disponible.')
        setReloadKey(k => k + 1)
      } else {
        setErrMsg('Le créneau n\'a pas pu être confirmé. Réessayez dans un instant.')
      }
      setActing(false)
      return
    }
    setRdv(prev => prev
      ? { ...prev, statut: 'acceptee', creneaux_rdv: prev.creneaux_rdv.map(c => ({ ...c, selectionne: c.id === creneauId })) }
      : prev
    )
    setActing(false)
  }

  async function refuser() {
    if (!rdv || acting) return
    setActing(true)
    const { error } = await supabase
      .from('rendez_vous')
      .update({ statut: 'refusee' })
      .eq('id', rdvId)
    if (error) {
      console.error('[RdvBubble refuser]', error.message, error.code, error.details, error.hint)
      setActing(false)
      return
    }
    setRdv(prev => prev ? { ...prev, statut: 'refusee' } : prev)
    setActing(false)
  }

  async function annuler() {
    if (!rdv || acting) return
    if (!confirm('Annuler cette proposition de rendez-vous ?')) return
    setActing(true)
    const { error } = await supabase
      .from('rendez_vous')
      .update({ statut: 'annulee' })
      .eq('id', rdvId)
    if (error) {
      console.error('[RdvBubble annuler]', error.message, error.code, error.details, error.hint)
      setActing(false)
      return
    }
    setRdv(prev => prev ? { ...prev, statut: 'annulee' } : prev)
    setActing(false)
  }

  if (loading) {
    return (
      <div style={{ width: 260, height: 82, border: `1.5px solid ${C.sable}`, borderRadius: 14, backgroundColor: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style suppressHydrationWarning>{`@keyframes rdv-sp{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${C.sable}`, borderTopColor: C.terracotta, animation: 'rdv-sp 0.7s linear infinite' }} />
      </div>
    )
  }

  if (!rdv) {
    return (
      <div style={{ maxWidth: 260, padding: '10px 14px', border: `1.5px solid ${C.sable}`, borderRadius: 14, fontSize: 12, color: C.grey }}>
        Proposition introuvable
      </div>
    )
  }

  const statut        = computeStatut(rdv.statut, rdv.creneaux_rdv)
  const cfg           = STATUT_CFG[statut]
  const interactif    = statut === 'proposee' && !acting
  const creneauChoisi = rdv.creneaux_rdv.find(c => c.selectionne)
  const sorted        = [...rdv.creneaux_rdv].sort((a, b) => new Date(a.debut_utc).getTime() - new Date(b.debut_utc).getTime())

  return (
    <div style={{ width: 260, border: `1.5px solid ${C.sable}`, borderRadius: 14, overflow: 'hidden', backgroundColor: C.white }}>

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <div style={{ padding: '9px 12px', borderBottom: `1px solid ${C.sable}`, backgroundColor: C.bg, display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.terracotta} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8"  y1="2" x2="8"  y2="6" />
          <line x1="3"  y1="10" x2="21" y2="10" />
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.dark, lineHeight: 1.2 }}>
            {rdv.type === 'telephonique' ? 'Appel téléphonique' : 'Entretien'}
          </div>
          <div style={{ fontSize: 11, color: C.grey, marginTop: 1 }}>{rdv.duree_minutes} min</div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, backgroundColor: cfg.bg, color: cfg.color, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {cfg.label}
        </span>
      </div>

      {/* ── Corps ────────────────────────────────────────────────────────── */}
      <div style={{ padding: '10px 12px' }}>

        {/* Confirmé — créneau choisi + info contact */}
        {statut === 'acceptee' && (
          <div>
            {creneauChoisi
              ? <div style={{ fontSize: 12, fontWeight: 600, color: C.vert, lineHeight: 1.45 }}>{formatCreneau(creneauChoisi.debut_utc)}</div>
              : <div style={{ fontSize: 12, color: C.grey }}>Créneau confirmé</div>
            }
            {rdv.contact_info && (
              <div style={{ fontSize: 11, color: C.grey, marginTop: 5 }}>{rdv.contact_info}</div>
            )}
          </div>
        )}

        {/* En attente ou expiré — liste des créneaux */}
        {(statut === 'proposee' || statut === 'expiree') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {sorted.map(c => {
              const past = new Date(c.debut_utc).getTime() < Date.now()
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, fontSize: 12, color: past ? C.lightGrey : C.dark, lineHeight: 1.35, textDecoration: past ? 'line-through' : 'none' }}>
                    {formatCreneau(c.debut_utc)}
                  </div>
                  {role === 'candidat' && interactif && !past && (
                    <button
                      onClick={() => accepter(c.id)}
                      style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 8, border: `1.5px solid ${C.vert}`, backgroundColor: 'transparent', color: C.vert, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                      Choisir
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Refusé */}
        {statut === 'refusee' && (
          <div style={{ fontSize: 12, color: C.grey, fontStyle: 'italic' }}>Proposition refusée</div>
        )}

        {/* Annulé */}
        {statut === 'annulee' && (
          <div style={{ fontSize: 12, color: C.grey, fontStyle: 'italic' }}>
            {role === 'candidat' ? 'Proposition annulée par le recruteur' : 'Proposition annulée'}
          </div>
        )}

        {errMsg && (
          <p style={{ fontSize: 11, color: C.erreur, margin: '8px 0 0', lineHeight: 1.5 }}>
            {errMsg}
          </p>
        )}
      </div>

      {/* ── Pied — actions ───────────────────────────────────────────────── */}
      {role === 'candidat' && interactif && (
        <div style={{ borderTop: `1px solid ${C.sable}`, padding: '7px 12px', textAlign: 'center' }}>
          <button
            onClick={refuser}
            style={{ fontSize: 11, color: C.grey, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', padding: 0 }}>
            Aucun créneau ne me convient
          </button>
        </div>
      )}

      {role === 'recruteur' && statut === 'proposee' && (
        <div style={{ borderTop: `1px solid ${C.sable}`, padding: '7px 12px', textAlign: 'center' }}>
          <button
            onClick={annuler}
            disabled={acting}
            style={{ fontSize: 11, color: C.erreur, background: 'none', border: 'none', cursor: acting ? 'default' : 'pointer', fontFamily: 'inherit', opacity: acting ? 0.5 : 1, padding: 0 }}>
            Annuler la proposition
          </button>
        </div>
      )}
    </div>
  )
}
