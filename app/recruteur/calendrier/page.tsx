'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import PanneauRdv from '@/components/PanneauRdv'
import { FONT_SERIF } from '@/lib/typography'

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  terracotta: '#C4673A',
  sable:      '#E7EAE8',
  creme:      '#F6F7F6',
  vert:       '#2C4A3E',
  dark:       '#15201B',
  grey:       '#687069',
  lightGrey:  '#C8C8C8',
  white:      '#FFFFFF',
}

// ─── Constantes grille ────────────────────────────────────────────────────────

const HOUR_H     = 40   // pixels par heure — vue consultation, 12h dans l'ecran
const START_H    = 8
const END_H      = 20
const N_HOURS    = END_H - START_H
const TOTAL_H    = N_HOURS * HOUR_H
const HOUR_COL_W = 48
const N_JOURS    = 7

const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

// ─── Types ────────────────────────────────────────────────────────────────────

type Creneau = { id: string; debut_utc: string; selectionne: boolean }
type RdvRaw  = {
  id:              string
  conversation_id: string
  candidat_id:     string
  type:            'telephonique' | 'entretien'
  duree_minutes:   number
  statut:          'proposee' | 'acceptee'
  creneaux_rdv:    Creneau[]
}
type GridEvent = {
  key:            string
  rdvId:          string
  conversationId: string
  type:           'telephonique' | 'entretien'
  statut:         'proposee' | 'acceptee'
  dureeMinutes:   number
  candidatNom:    string
  dayIndex:       number
  topPx:          number
  heightPx:       number
  debutUtc:       string
}
type PlacedEvent = GridEvent & { col: number; totalCols: number }

// ─── Placement (chevauchements) ───────────────────────────────────────────────

function placerEvenements(evs: GridEvent[]): PlacedEvent[] {
  if (!evs.length) return []

  const tries  = [...evs].sort((a, b) => a.topPx - b.topPx)
  const pistes: number[] = []

  const avec: (GridEvent & { col: number; endPx: number })[] = tries.map(ev => {
    const endPx = ev.topPx + ev.heightPx
    const libre = pistes.findIndex(f => f <= ev.topPx)
    const col   = libre >= 0 ? libre : pistes.length
    if (libre >= 0) pistes[libre] = endPx
    else pistes.push(endPx)
    return { ...ev, col, endPx }
  })

  return avec.map(ev => {
    let maxCol = 0
    for (const autre of avec) {
      if (autre.topPx < ev.endPx && autre.endPx > ev.topPx) {
        maxCol = Math.max(maxCol, autre.col)
      }
    }
    return { ...ev, totalCols: maxCol + 1 }
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lundiDe(offset: number): Date {
  const now   = new Date()
  const dow   = now.getDay()
  const toLun = dow === 0 ? -6 : 1 - dow
  const d     = new Date(now)
  d.setDate(d.getDate() + toLun + offset * 7)
  d.setHours(0, 0, 0, 0)
  return d
}

function joursDeSession(lundi: Date): Date[] {
  return Array.from({ length: N_JOURS }, (_, i) => {
    const d = new Date(lundi)
    d.setDate(d.getDate() + i)
    return d
  })
}

function formatPlageHebdo(lundi: Date): string {
  const dimanche = new Date(lundi)
  dimanche.setDate(dimanche.getDate() + 6)
  const memeMois = lundi.getMonth() === dimanche.getMonth()
    && lundi.getFullYear() === dimanche.getFullYear()
  const debut = lundi.toLocaleDateString('fr-FR', {
    day: 'numeric',
    ...(memeMois ? {} : { month: 'long' }),
  })
  const fin = dimanche.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  return `${debut} - ${fin}`
}

function memeJourLocal(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth()      === b.getMonth()
    && a.getDate()       === b.getDate()
}

function parseLundi(str: string): Date {
  const parts = str.split('-').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return lundiDe(0)
  const [y, m, d] = parts
  const date = new Date(y, m - 1, d)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatLundi(d: Date): string {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function topPxOf(utc: string): number {
  const d = new Date(utc)
  return (d.getHours() - START_H) * HOUR_H + (d.getMinutes() / 60) * HOUR_H
}

function hauteurPxOf(duree: number): number {
  return Math.max((duree / 60) * HOUR_H, 16)
}

function nomCandidat(prenom?: string | null, nom?: string | null): string {
  return [prenom, nom].filter(Boolean).join(' ') || 'Candidat'
}

function formatHeure(utc: string): string {
  return new Date(utc).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// ─── Bouton navigation ────────────────────────────────────────────────────────

function BoutonNav({ onClick, sens, label }: {
  onClick: () => void; sens: 'gauche' | 'droite'; label: string
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      title={label}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 32, height: 32, borderRadius: 8,
        border: `1.5px solid ${C.sable}`,
        backgroundColor: hov ? C.sable : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'background-color 0.1s', flexShrink: 0,
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke={C.dark} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {sens === 'gauche'
          ? <polyline points="15 18 9 12 15 6" />
          : <polyline points="9 18 15 12 9 6" />}
      </svg>
    </button>
  )
}

// ─── Legende ──────────────────────────────────────────────────────────────────

function ItemLegende({ couleur, label, plein }: { couleur: string; label: string; plein: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 12, height: 12, borderRadius: 3, flexShrink: 0,
        backgroundColor: plein ? couleur : `${couleur}1A`,
        border: plein ? 'none' : `1.5px dashed ${couleur}`,
      }} />
      <span style={{ fontSize: 11, color: C.grey }}>{label}</span>
    </div>
  )
}

// ─── Bande de résumé ──────────────────────────────────────────────────────────

function BandeResume({
  events,
  onClickEvent,
}: {
  events: GridEvent[]
  onClickEvent: (rdvId: string) => void
}) {
  if (!events.length) return null

  const tries = [...events].sort((a, b) =>
    a.dayIndex !== b.dayIndex ? a.dayIndex - b.dayIndex : a.topPx - b.topPx
  )

  return (
    <div style={{
      borderBottom: `1px solid ${C.sable}`,
      backgroundColor: C.white,
      flexShrink: 0,
      maxHeight: 152,
      overflowY: 'auto',
    }}>
      {tries.map((ev, i) => {
        const confirme = ev.statut === 'acceptee'
        return (
          <button
            key={ev.key}
            onClick={() => onClickEvent(ev.rdvId)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '7px 24px',
              background: 'none', border: 'none',
              borderTop: i === 0 ? 'none' : `1px solid ${C.sable}`,
              cursor: 'pointer', textAlign: 'left' as const,
              transition: 'background-color 0.12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = C.creme }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}
          >
            {/* Point de couleur */}
            <div style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              backgroundColor: confirme ? C.terracotta : 'transparent',
              border: confirme ? 'none' : `1.5px dashed ${C.terracotta}`,
            }} />

            {/* Jour */}
            <span style={{
              fontSize: 11, color: C.grey, width: 26, flexShrink: 0,
            }}>
              {JOURS_COURTS[ev.dayIndex]}
            </span>

            {/* Heure */}
            <span style={{
              fontSize: 11, fontWeight: 700, color: C.dark,
              width: 38, flexShrink: 0,
            }}>
              {formatHeure(ev.debutUtc)}
            </span>

            {/* Nom */}
            <span style={{
              fontSize: 11, color: C.dark, flex: 1, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
            }}>
              {ev.candidatNom}
            </span>

            {/* Type */}
            <span style={{ fontSize: 11, color: C.grey, flexShrink: 0 }}>
              {ev.type === 'telephonique' ? 'Appel' : 'Entretien'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Bloc evenement ───────────────────────────────────────────────────────────

function BlocEvenement({ ev, onSelect }: { ev: PlacedEvent; onSelect: (rdvId: string) => void }) {
  const [hov, setHov]  = useState(false)
  const confirme       = ev.statut === 'acceptee'
  const petit          = ev.heightPx < 32

  const bg     = confirme
    ? (hov ? '#B35830' : C.terracotta)
    : (hov ? `${C.terracotta}2A` : `${C.terracotta}1A`)
  const border = confirme ? 'none' : `1.5px dashed ${C.terracotta}`
  const color  = confirme ? C.white : C.terracotta

  const leftPct  = ev.col / ev.totalCols * 100
  const widthPct = 1      / ev.totalCols * 100

  return (
    <button
      onClick={() => onSelect(ev.rdvId)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={`${ev.candidatNom} - ${ev.type === 'telephonique' ? 'Appel' : 'Entretien'} ${ev.dureeMinutes} min`}
      style={{
        position:        'absolute',
        top:             ev.topPx,
        height:          ev.heightPx,
        left:            `calc(${leftPct}% + 2px)`,
        width:           `calc(${widthPct}% - 4px)`,
        backgroundColor: bg,
        border,
        borderRadius:    5,
        padding:         petit ? '2px 5px' : '4px 6px',
        overflow:        'hidden',
        cursor:          'pointer',
        transition:      'background-color 0.1s',
        boxSizing:       'border-box' as const,
        fontFamily:      'inherit',
        textAlign:       'left' as const,
      }}
    >
      <div style={{
        fontSize: 10, fontWeight: 700, color, lineHeight: 1.25,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {ev.candidatNom}
      </div>
      {!petit && (
        <div style={{
          fontSize: 9, lineHeight: 1.2, marginTop: 1,
          color: confirme ? `${C.white}BB` : `${C.terracotta}99`,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {ev.type === 'telephonique' ? 'Appel' : 'Entretien'} {ev.dureeMinutes} min
        </div>
      )}
    </button>
  )
}

// ─── Colonne jour ─────────────────────────────────────────────────────────────

function ColonneJour({ evenements, weekend, onSelect }: {
  evenements: GridEvent[]
  weekend: boolean
  onSelect: (rdvId: string) => void
}) {
  const places = placerEvenements(evenements)
  return (
    <div style={{
      flex: 1, minWidth: 0,
      position: 'relative',
      height: TOTAL_H,
      borderLeft: `1px solid ${C.sable}`,
      backgroundColor: weekend ? `${C.sable}22` : 'transparent',
    }}>
      {Array.from({ length: N_HOURS }, (_, i) => (
        <div key={i} style={{
          position: 'absolute', left: 0, right: 0,
          top: i * HOUR_H, height: 1,
          backgroundColor: C.sable, pointerEvents: 'none',
        }} />
      ))}
      {places.map(ev => <BlocEvenement key={ev.key} ev={ev} onSelect={onSelect} />)}
    </div>
  )
}

// ─── Etat vide ────────────────────────────────────────────────────────────────

function SemaineVide() {
  return (
    <div style={{ padding: '64px 0', textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontFamily: FONT_SERIF, color: C.dark, marginBottom: 8 }}>
        Aucun rendez-vous cette semaine
      </div>
      <div style={{ fontSize: 13, color: C.grey, lineHeight: 1.65 }}>
        Les propositions envoyees et les rendez-vous confirmes apparaissent ici.
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendrierPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const semaineParam   = searchParams.get('semaine')
  const rdvSelectionne = searchParams.get('rdv')

  const [events,  setEvents]  = useState<GridEvent[]>([])
  const [loading, setLoading] = useState(true)
  const gridRef = useRef<HTMLDivElement>(null)

  const lundi      = semaineParam ? parseLundi(semaineParam) : lundiDe(0)
  const lundiStr   = formatLundi(lundi)
  const semCourant = lundiStr === formatLundi(lundiDe(0))

  // Charge les rendez-vous de la semaine affichee
  useEffect(() => {
    let annule = false

    async function charger() {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user || annule) { setLoading(false); return }

      const lundi = parseLundi(lundiStr)
      const jours = joursDeSession(lundi)

      const { data: rdvData, error: rdvErr } = await supabase
        .from('rendez_vous')
        .select('id, conversation_id, candidat_id, type, duree_minutes, statut, creneaux_rdv(id, debut_utc, selectionne)')
        .eq('recruteur_id', user.id)
        .in('statut', ['proposee', 'acceptee'])

      if (rdvErr) {
        console.error('[calendrier rdv]', rdvErr.message, rdvErr.code, rdvErr.details, rdvErr.hint)
        if (!annule) setLoading(false)
        return
      }

      const rdvList = (rdvData ?? []) as unknown as RdvRaw[]

      if (!rdvList.length) {
        if (!annule) { setEvents([]); setLoading(false) }
        return
      }

      const candidatIds = [...new Set(rdvList.map(r => r.candidat_id).filter(Boolean))]
      const { data: profilsData, error: profilsErr } = candidatIds.length
        ? await supabase
            .from('profils')
            .select('user_id, prenom, nom')
            .in('user_id', candidatIds)
        : { data: [] as { user_id: string; prenom?: string | null; nom?: string | null }[], error: null }

      if (profilsErr) {
        console.error('[calendrier profils]', profilsErr.message, profilsErr.code, profilsErr.details, profilsErr.hint)
      }

      const nomMap: Record<string, string> = {}
      for (const p of profilsData ?? []) {
        nomMap[p.user_id] = nomCandidat(p.prenom, p.nom)
      }

      const resultat: GridEvent[] = []

      for (const rdv of rdvList) {
        const creneaux = rdv.statut === 'acceptee'
          ? rdv.creneaux_rdv.filter(c => c.selectionne)
          : rdv.creneaux_rdv

        for (const c of creneaux) {
          const debut    = new Date(c.debut_utc)
          const dayIndex = jours.findIndex(d => memeJourLocal(d, debut))
          if (dayIndex < 0) continue

          const top    = topPxOf(c.debut_utc)
          const height = hauteurPxOf(rdv.duree_minutes)
          if (top >= TOTAL_H || top + height <= 0) continue

          resultat.push({
            key:            `${rdv.id}-${c.id}`,
            rdvId:          rdv.id,
            conversationId: rdv.conversation_id,
            type:           rdv.type,
            statut:         rdv.statut,
            dureeMinutes:   rdv.duree_minutes,
            candidatNom:    nomMap[rdv.candidat_id] ?? 'Candidat',
            dayIndex,
            topPx:    Math.max(0, top),
            heightPx: Math.min(height, TOTAL_H - Math.max(0, top)),
            debutUtc: c.debut_utc,
          })
        }
      }

      if (!annule) {
        setEvents(resultat)
        setLoading(false)
      }
    }

    charger()
    return () => { annule = true }
  }, [lundiStr])

  // Positionne le defilement sur la premiere heure occupee (ou 9h si vide)
  useEffect(() => {
    if (loading || !gridRef.current) return
    const defaultTop = (9 - START_H) * HOUR_H
    const targetTop  = events.length > 0
      ? Math.min(...events.map(e => e.topPx))
      : defaultTop
    gridRef.current.scrollTop = Math.max(0, targetTop - HOUR_H)
  }, [loading, events])

  const jours       = joursDeSession(lundi)
  const aujourd     = new Date()
  const eventsByDay = Array.from({ length: N_JOURS }, (_, i) =>
    events.filter(e => e.dayIndex === i)
  )
  const semVide = !loading && events.length === 0

  function changerSemaine(delta: number) {
    const nouvLundi = new Date(lundi)
    nouvLundi.setDate(nouvLundi.getDate() + delta * 7)
    const params  = new URLSearchParams(searchParams.toString())
    const nouvStr = formatLundi(nouvLundi)
    if (nouvStr === formatLundi(lundiDe(0))) {
      params.delete('semaine')
    } else {
      params.set('semaine', nouvStr)
    }
    const qs = params.toString()
    router.replace(`/recruteur/calendrier${qs ? '?' + qs : ''}`)
  }

  function allerAujourdhui() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('semaine')
    const qs = params.toString()
    router.replace(`/recruteur/calendrier${qs ? '?' + qs : ''}`)
  }

  function ouvrirPanneau(rdvId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('rdv', rdvId)
    const qs = params.toString()
    router.push(`/recruteur/calendrier${qs ? '?' + qs : ''}`)
  }

  function fermerPanneau() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('rdv')
    const qs = params.toString()
    router.replace(`/recruteur/calendrier${qs ? '?' + qs : ''}`)
  }

  function retirerRdv(rdvId: string) {
    setEvents(prev => prev.filter(e => e.rdvId !== rdvId))
  }

  return (
    <>
    <div style={{
      backgroundColor: C.creme,
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <style suppressHydrationWarning>{`@keyframes cal-sp { to { transform: rotate(360deg) } }`}</style>

      {/* ── En-tete ──────────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: C.white,
        borderBottom:    `1px solid ${C.sable}`,
        padding:         '14px 24px',
        display:         'flex',
        alignItems:      'center',
        gap:             12,
        flexShrink:      0,
      }}>
        <h1 style={{
          fontFamily: FONT_SERIF, fontSize: 20, fontWeight: 600,
          color: C.dark, margin: 0,
        }}>
          Calendrier
        </h1>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BoutonNav onClick={() => changerSemaine(-1)} sens="gauche" label="Semaine precedente" />

          {!semCourant && (
            <button
              onClick={allerAujourdhui}
              style={{
                padding: '6px 14px', borderRadius: 8,
                border: `1.5px solid ${C.sable}`,
                backgroundColor: 'transparent', color: C.dark,
                fontSize: 13, cursor: 'pointer',
                fontFamily: 'inherit', whiteSpace: 'nowrap',
                transition: 'background-color 0.1s',
              }}
            >
              Aujourd'hui
            </button>
          )}

          <span style={{
            fontSize: 13, fontWeight: 600, color: C.dark,
            minWidth: 200, textAlign: 'center', whiteSpace: 'nowrap',
          }}>
            {formatPlageHebdo(lundi)}
          </span>

          <BoutonNav onClick={() => changerSemaine(1)} sens="droite" label="Semaine suivante" />
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <ItemLegende couleur={C.terracotta} label="Confirme"   plein />
          <ItemLegende couleur={C.terracotta} label="En attente" plein={false} />
        </div>
      </div>

      {/* ── En-tetes des jours ───────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        borderBottom: `1px solid ${C.sable}`,
        backgroundColor: C.white,
        flexShrink: 0,
      }}>
        <div style={{ width: HOUR_COL_W, flexShrink: 0 }} />
        {jours.map((d, i) => {
          const estAujourd = memeJourLocal(d, aujourd)
          const weekend    = i >= 5
          return (
            <div key={i} style={{
              flex: 1, padding: '10px 0', textAlign: 'center',
              borderLeft: `1px solid ${C.sable}`,
              backgroundColor: weekend ? `${C.sable}22` : 'transparent',
            }}>
              <div style={{
                fontSize: 11, color: C.grey,
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3,
              }}>
                {JOURS_COURTS[i]}
              </div>
              <div style={{ fontSize: 17, fontWeight: 600, color: estAujourd ? C.terracotta : C.dark }}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Bande de résumé ──────────────────────────────────────────────── */}
      {!loading && <BandeResume events={events} onClickEvent={ouvrirPanneau} />}

      {/* ── Corps ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            border: `2.5px solid ${C.sable}`,
            borderTopColor: C.terracotta,
            animation: 'cal-sp 0.7s linear infinite',
          }} />
        </div>
      ) : semVide ? (
        <SemaineVide />
      ) : (
        <div ref={gridRef} style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexShrink: 0 }}>

            {/* Colonne heures */}
            <div style={{ width: HOUR_COL_W, flexShrink: 0, position: 'relative', height: TOTAL_H }}>
              {Array.from({ length: N_HOURS }, (_, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  top: i * HOUR_H - 7, right: 8,
                  fontSize: 11, color: C.lightGrey,
                  lineHeight: 1, userSelect: 'none' as const,
                }}>
                  {START_H + i}h
                </div>
              ))}
            </div>

            {/* Colonnes des jours */}
            {eventsByDay.map((evs, i) => (
              <ColonneJour key={i} evenements={evs} weekend={i >= 5} onSelect={ouvrirPanneau} />
            ))}
          </div>
        </div>
      )}
    </div>
    <PanneauRdv
      rdvId={rdvSelectionne}
      onClose={fermerPanneau}
      onAnnulee={retirerRdv}
    />
    </>
  )
}
