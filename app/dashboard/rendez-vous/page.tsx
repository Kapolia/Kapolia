'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { FONT_SERIF } from '@/lib/typography'
import RdvBubble from '@/components/RdvBubble'

const C = {
  terracotta: '#C4673A',
  sable:      '#E8D5B7',
  creme:      '#F7F2EB',
  vert:       '#2C4A3E',
  dark:       '#1A1A1A',
  grey:       '#6B6B6B',
  lightGrey:  '#C8C8C8',
  white:      '#FFFFFF',
}

type Creneau = { id: string; debut_utc: string; selectionne: boolean }
type RdvRow  = {
  id:              string
  conversation_id: string
  type:            'telephonique' | 'entretien'
  duree_minutes:   number
  contact_info:    string | null
  statut:          string
  creneaux_rdv:    Creneau[]
  offreTitre:      string
  entrepriseNom:   string
}
type Section = 'attente' | 'avenir' | 'passes'

function classify(rdv: RdvRow): Section {
  const now = Date.now()
  if (rdv.statut === 'proposee') {
    return rdv.creneaux_rdv.some(c => new Date(c.debut_utc).getTime() > now) ? 'attente' : 'passes'
  }
  if (rdv.statut === 'acceptee') {
    const choisi = rdv.creneaux_rdv.find(c => c.selectionne)
    if (!choisi) return 'avenir'
    return new Date(choisi.debut_utc).getTime() > now ? 'avenir' : 'passes'
  }
  return 'passes'
}

function formatDate(utc: string): string {
  const d = new Date(utc)
  return (
    d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) +
    ' à ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  )
}

// ─── Section title ────────────────────────────────────────────────────────────

function SectionTitle({ label, count }: { label: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: C.dark, letterSpacing: '0.01em' }}>{label}</span>
      <span style={{ fontSize: 11, color: C.grey, fontWeight: 400 }}>{count}</span>
    </div>
  )
}

// ─── Carte "À venir" / "Passé" ────────────────────────────────────────────────

function RdvListCard({ rdv, past }: { rdv: RdvRow; past: boolean }) {
  const choisi     = rdv.creneaux_rdv.find(c => c.selectionne)
  const dateStr    = choisi ? formatDate(choisi.debut_utc) : null
  const typeLabel  = rdv.type === 'telephonique' ? 'Appel téléphonique' : 'Entretien'
  const contextStr = [rdv.entrepriseNom, rdv.offreTitre].filter(Boolean).join(' · ')

  return (
    <Link
      href={`/dashboard/messages?conv=${rdv.conversation_id}`}
      style={{ display: 'block', textDecoration: 'none' }}
    >
      <div style={{
        backgroundColor: past ? C.creme : C.white,
        border:          `1.5px solid ${past ? C.sable : C.sable}`,
        borderRadius:    12,
        padding:         '14px 18px',
        display:         'flex',
        alignItems:      'center',
        gap:             16,
        opacity:         past ? 0.75 : 1,
        transition:      'box-shadow 0.15s',
        cursor:          'pointer',
      }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)')}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
      >
        {/* Icône */}
        <div style={{
          width:           40, height: 40, borderRadius: 10, flexShrink: 0,
          backgroundColor: past ? `${C.grey}14` : `${C.vert}12`,
          display:         'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke={past ? C.lightGrey : C.vert}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8"  y1="2" x2="8"  y2="6" />
            <line x1="3"  y1="10" x2="21" y2="10" />
          </svg>
        </div>

        {/* Infos */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: past ? C.grey : C.dark, marginBottom: 2 }}>
            {dateStr ?? 'Date à confirmer'}
          </div>
          <div style={{ fontSize: 12, color: C.grey }}>
            {typeLabel} · {rdv.duree_minutes} min
            {contextStr ? ` · ${contextStr}` : ''}
          </div>
          {rdv.contact_info && !past && (
            <div style={{ fontSize: 11, color: C.grey, marginTop: 3 }}>{rdv.contact_info}</div>
          )}
        </div>

        {/* Flèche */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={C.lightGrey} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0 }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </Link>
  )
}

// ─── Carte "En attente" ───────────────────────────────────────────────────────

function AttenteCard({ rdv }: { rdv: RdvRow }) {
  const contextStr = [rdv.entrepriseNom, rdv.offreTitre].filter(Boolean).join(' · ')

  return (
    <div style={{
      backgroundColor: C.white,
      border:          `2px solid ${C.terracotta}40`,
      borderRadius:    14,
      padding:         '14px 16px',
      display:         'flex',
      flexDirection:   'column',
      gap:             12,
    }}>
      {/* Contexte */}
      {contextStr && (
        <div style={{ fontSize: 12, fontWeight: 600, color: C.dark }}>{contextStr}</div>
      )}

      {/* Bulle interactive */}
      <RdvBubble rdvId={rdv.id} role="candidat" />

      {/* Lien conversation */}
      <Link
        href={`/dashboard/messages?conv=${rdv.conversation_id}`}
        style={{ fontSize: 12, color: C.terracotta, textDecoration: 'none', fontWeight: 600, alignSelf: 'flex-start' }}
      >
        Voir la conversation →
      </Link>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ padding: '80px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 17, fontFamily: FONT_SERIF, color: C.dark, marginBottom: 8 }}>
        Aucun rendez-vous pour le moment
      </div>
      <div style={{ fontSize: 14, color: C.grey, lineHeight: 1.65 }}>
        Les recruteurs qui souhaitent vous rencontrer vous proposeront des créneaux depuis la messagerie.
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RendezVousPage() {
  const [rows,    setRows]    = useState<RdvRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // ── Rendez-vous actifs
      const { data: rdvData, error: rdvErr } = await supabase
        .from('rendez_vous')
        .select('id, conversation_id, type, duree_minutes, contact_info, statut, creneaux_rdv(id, debut_utc, selectionne)')
        .eq('candidat_id', user.id)
        .in('statut', ['proposee', 'acceptee'])
        .order('created_at', { ascending: false })

      if (rdvErr) {
        console.error('[rendez-vous load rdv]', rdvErr.message, rdvErr.code, rdvErr.details, rdvErr.hint)
        setLoading(false)
        return
      }
      if (!rdvData?.length) { setLoading(false); return }

      // ── Enrichissement : offre + entreprise via conversations
      const convIds = [...new Set(rdvData.map(r => r.conversation_id).filter(Boolean))]
      const { data: convData, error: convErr } = await supabase
        .from('conversations')
        .select('id, offres(titre, entreprise_nom)')
        .in('id', convIds)

      if (convErr) {
        console.error('[rendez-vous load convs]', convErr.message, convErr.code, convErr.details, convErr.hint)
      }

      const convMap: Record<string, { offreTitre: string; entrepriseNom: string }> = {}
      for (const c of convData ?? []) {
        const offre = c.offres as { titre?: string; entreprise_nom?: string } | null
        convMap[c.id] = {
          offreTitre:   offre?.titre          ?? '',
          entrepriseNom: offre?.entreprise_nom ?? '',
        }
      }

      setRows((rdvData as unknown as Omit<RdvRow, 'offreTitre' | 'entrepriseNom'>[]).map(r => ({
        ...r,
        ...(convMap[r.conversation_id] ?? { offreTitre: '', entrepriseNom: '' }),
      })))
      setLoading(false)
    }
    load()
  }, [])

  const attente = rows.filter(r => classify(r) === 'attente')
  const avenir  = rows.filter(r => classify(r) === 'avenir')
  const passes  = rows.filter(r => classify(r) === 'passes')
  const isEmpty = !loading && attente.length === 0 && avenir.length === 0 && passes.length === 0

  return (
    <main style={{ backgroundColor: C.creme, minHeight: '100vh', marginLeft: 64 }}>
      <style suppressHydrationWarning>{`
        @keyframes rdv-sp { to { transform: rotate(360deg) } }
      `}</style>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '36px 28px 80px' }}>

        {/* ── En-tête ──────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: FONT_SERIF, fontSize: 22, fontWeight: 600, color: C.dark, margin: 0, lineHeight: 1.2 }}>
            Mes rendez-vous
          </h1>
        </div>

        {/* ── Chargement ───────────────────────────────────────────────── */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2.5px solid ${C.sable}`, borderTopColor: C.terracotta, animation: 'rdv-sp 0.7s linear infinite' }} />
          </div>
        )}

        {/* ── État vide ────────────────────────────────────────────────── */}
        {isEmpty && <EmptyState />}

        {/* ── Section 1 : En attente ───────────────────────────────────── */}
        {!loading && attente.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <SectionTitle label="En attente de votre réponse" count={attente.length} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {attente.map(rdv => <AttenteCard key={rdv.id} rdv={rdv} />)}
            </div>
          </section>
        )}

        {/* ── Section 2 : Confirmés à venir ───────────────────────────── */}
        {!loading && avenir.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <SectionTitle label="Confirmés à venir" count={avenir.length} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {avenir.map(rdv => <RdvListCard key={rdv.id} rdv={rdv} past={false} />)}
            </div>
          </section>
        )}

        {/* ── Section 3 : Passés ──────────────────────────────────────── */}
        {!loading && passes.length > 0 && (
          <section>
            <SectionTitle label="Passés" count={passes.length} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {passes.map(rdv => <RdvListCard key={rdv.id} rdv={rdv} past={true} />)}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
