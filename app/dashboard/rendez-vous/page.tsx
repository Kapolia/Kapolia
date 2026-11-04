'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { FONT_SERIF } from '@/lib/typography'
import RdvBubble from '@/components/RdvBubble'
import AssistantPrepEntretien from '@/components/AssistantPrepEntretien'

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
  offreId:         string
  entrepriseNom:   string
  recruteurNom:    string
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

function urgence(utc: string): string | null {
  const now    = new Date()
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const rdvDay = new Date(new Date(utc).getFullYear(), new Date(utc).getMonth(), new Date(utc).getDate())
  const jours  = Math.round((rdvDay.getTime() - nowDay.getTime()) / 86400000)
  if (jours <= 0) return null
  if (jours === 1) return 'demain'
  if (jours < 7)  return `dans ${jours} jours`
  const sem = Math.round(jours / 7)
  return `dans ${sem} semaine${sem > 1 ? 's' : ''}`
}

function urgenceBadge(u: string): { bg: string; color: string } {
  if (u === 'demain')                  return { bg: `${C.terracotta}18`, color: C.terracotta }
  if (u.startsWith('dans') && u.includes('jour')) return { bg: `${C.vert}12`, color: C.vert }
  return { bg: `${C.grey}12`, color: C.grey }
}

// ─── Section title ────────────────────────────────────────────────────────────

function SectionTitle({ label, count }: { label: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
      <span style={{ fontFamily: FONT_SERIF, fontSize: 16, color: C.dark }}>{label}</span>
      <span style={{ fontSize: 11, color: C.grey, fontWeight: 400 }}>{count}</span>
    </div>
  )
}

// ─── Carte "À venir" / "Passé" ────────────────────────────────────────────────

function RdvListCard({ rdv, past, onPreparer }: { rdv: RdvRow; past: boolean; onPreparer?: () => void }) {
  const choisi       = rdv.creneaux_rdv.find(c => c.selectionne)
  const dateStr      = choisi ? formatDate(choisi.debut_utc) : null
  const urgenceStr   = !past && choisi ? urgence(choisi.debut_utc) : null
  const typeLabel    = rdv.type === 'telephonique' ? 'Appel téléphonique' : 'Entretien'
  const prepLabel    = rdv.type === 'telephonique' ? 'Préparer cet appel' : 'Préparer cet entretien'
  const contextLine  = [rdv.entrepriseNom, rdv.recruteurNom].filter(Boolean).join(' · ')
  const badge        = urgenceStr ? urgenceBadge(urgenceStr) : null

  return (
    <div style={{
      backgroundColor: past ? C.creme : C.white,
      border:          `1.5px solid ${C.sable}`,
      borderRadius:    12,
      opacity:         past ? 0.75 : 1,
      overflow:        'hidden',
    }}>
      {/* Corps */}
      <div style={{ padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* Icône */}
        <div style={{
          width:           38, height: 38, borderRadius: 9, flexShrink: 0, marginTop: 2,
          backgroundColor: past ? `${C.grey}14` : `${C.vert}12`,
          display:         'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
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

          {/* Poste — lecture prioritaire */}
          <div style={{ fontSize: 14, fontWeight: 600, color: past ? C.grey : C.dark, marginBottom: 2 }}>
            {rdv.offreTitre || 'Poste non précisé'}
          </div>

          {/* Entreprise + recruteur */}
          {contextLine && (
            <div style={{ fontSize: 12, color: C.grey, marginBottom: 7 }}>
              {contextLine}
            </div>
          )}

          {/* Date + badge urgence */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 10px', marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: past ? C.grey : C.dark }}>
              {dateStr ?? 'Date à confirmer'}
            </span>
            {urgenceStr && badge && (
              <span style={{
                fontSize:        11,
                fontWeight:      600,
                padding:         '2px 8px',
                borderRadius:    20,
                backgroundColor: badge.bg,
                color:           badge.color,
                whiteSpace:      'nowrap',
              }}>
                {urgenceStr}
              </span>
            )}
          </div>

          {/* Type + durée */}
          <div style={{ fontSize: 12, color: C.grey }}>
            {typeLabel} · {rdv.duree_minutes} min
          </div>

          {/* Numéro ou lieu */}
          {rdv.contact_info && (
            <div style={{ fontSize: 12, color: C.grey, marginTop: 4 }}>
              {rdv.contact_info}
            </div>
          )}
        </div>
      </div>

      {/* Pied de carte */}
      <div style={{
        borderTop:      `1px solid ${C.sable}`,
        padding:        '10px 20px',
        display:        'flex',
        justifyContent: 'flex-end',
        alignItems:     'center',
        gap:            20,
      }}>
        {rdv.offreId && (
          <Link
            href={`/offres/${rdv.offreId}`}
            style={{ fontSize: 12, color: C.grey, textDecoration: 'none' }}
          >
            Voir l&apos;offre
          </Link>
        )}
        <Link
          href={`/dashboard/messages?conv=${rdv.conversation_id}`}
          style={{ fontSize: 12, color: C.grey, textDecoration: 'none' }}
        >
          Ouvrir la conversation
        </Link>
        {!past && onPreparer && (
          <button
            onClick={onPreparer}
            style={{
              background:  'none',
              border:      'none',
              padding:     0,
              fontSize:    12,
              fontWeight:  600,
              color:       C.terracotta,
              cursor:      'pointer',
              fontFamily:  'inherit',
            }}
          >
            {prepLabel}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Carte "En attente" ───────────────────────────────────────────────────────

function AttenteCard({ rdv }: { rdv: RdvRow }) {
  const titreStr    = rdv.offreTitre || ''
  const contextLine = [rdv.entrepriseNom, rdv.recruteurNom].filter(Boolean).join(' · ')

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
      {/* En-tête */}
      {(titreStr || contextLine) && (
        <div>
          {titreStr && (
            <div style={{ fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 2 }}>{titreStr}</div>
          )}
          {contextLine && (
            <div style={{ fontSize: 12, color: C.grey }}>{contextLine}</div>
          )}
        </div>
      )}

      {/* Bulle interactive */}
      <RdvBubble rdvId={rdv.id} role="candidat" />

      {/* Lien conversation */}
      <Link
        href={`/dashboard/messages?conv=${rdv.conversation_id}`}
        style={{ fontSize: 12, color: C.terracotta, textDecoration: 'none', fontWeight: 600, alignSelf: 'flex-start' }}
      >
        Ouvrir la conversation
      </Link>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ padding: '80px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 19, fontFamily: FONT_SERIF, color: C.dark, marginBottom: 8 }}>
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
  const [activeRdv, setActiveRdv] = useState<{
    id: string; dateRdv: string; typeRdv: 'telephonique' | 'entretien'
  } | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // ── Rendez-vous
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

      // ── Conversations : titre, id offre, recruteur_id
      const convIds = [...new Set(rdvData.map(r => r.conversation_id).filter(Boolean))]
      const { data: convData, error: convErr } = await supabase
        .from('conversations')
        .select('id, recruteur_id, offres(id, titre, entreprise_nom)')
        .in('id', convIds)

      if (convErr) {
        console.error('[rendez-vous load convs]', convErr.message, convErr.code, convErr.details, convErr.hint)
      }

      // ── Noms + nom d'entreprise des recruteurs (priorité sur offres.entreprise_nom)
      const recruteurIds = [...new Set((convData ?? []).map(c => c.recruteur_id).filter(Boolean))]
      const recruteurNomMap:    Record<string, string> = {}
      const entrepriseNomMap:   Record<string, string> = {}
      if (recruteurIds.length > 0) {
        const { data: profilData } = await supabase
          .from('profils_vue_publique')
          .select('user_id, prenom, nom, entreprise_nom')
          .in('user_id', recruteurIds)
        for (const p of profilData ?? []) {
          const nom = [p.prenom, p.nom].filter(Boolean).join(' ')
          if (nom)              recruteurNomMap[p.user_id]  = nom
          if (p.entreprise_nom) entrepriseNomMap[p.user_id] = p.entreprise_nom
        }
      }

      type ConvEntry = {
        offreTitre:   string
        offreId:      string
        entrepriseNom: string
        recruteurNom: string
      }
      const convMap: Record<string, ConvEntry> = {}
      for (const c of convData ?? []) {
        const offre = c.offres as { id?: string; titre?: string; entreprise_nom?: string } | null
        convMap[c.id] = {
          offreTitre:    offre?.titre           ?? '',
          offreId:       offre?.id              ?? '',
          entrepriseNom: entrepriseNomMap[c.recruteur_id] || offre?.entreprise_nom || '',
          recruteurNom:  recruteurNomMap[c.recruteur_id]  ?? '',
        }
      }

      const fallback: ConvEntry = { offreTitre: '', offreId: '', entrepriseNom: '', recruteurNom: '' }
      setRows(
        (rdvData as unknown as Omit<RdvRow, 'offreTitre' | 'offreId' | 'entrepriseNom' | 'recruteurNom'>[])
          .map(r => ({ ...r, ...(convMap[r.conversation_id] ?? fallback) }))
      )
      setLoading(false)
    }
    load()
  }, [])

  const attente = rows.filter(r => classify(r) === 'attente')
  const avenir  = rows.filter(r => classify(r) === 'avenir')
  const passes  = rows.filter(r => classify(r) === 'passes')
  const isEmpty = !loading && attente.length === 0 && avenir.length === 0 && passes.length === 0

  return (
    <main style={{ backgroundColor: C.creme, minHeight: '100vh' }}>
      <style suppressHydrationWarning>{`
        @keyframes rdv-sp { to { transform: rotate(360deg) } }
      `}</style>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '36px 28px 80px' }}>

        {/* ── En-tête ──────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: FONT_SERIF, fontSize: 'clamp(26px, 4vw, 36px)', color: C.dark, margin: '0 0 6px', lineHeight: 1.15 }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {avenir.map(rdv => {
                const choisi = rdv.creneaux_rdv.find(c => c.selectionne)
                return (
                  <RdvListCard
                    key={rdv.id}
                    rdv={rdv}
                    past={false}
                    onPreparer={() => setActiveRdv({
                      id:      rdv.id,
                      dateRdv: choisi?.debut_utc ?? '',
                      typeRdv: rdv.type,
                    })}
                  />
                )
              })}
            </div>
          </section>
        )}

        {/* ── Section 3 : Passés ──────────────────────────────────────── */}
        {!loading && passes.length > 0 && (
          <section>
            <SectionTitle label="Passés" count={passes.length} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {passes.map(rdv => <RdvListCard key={rdv.id} rdv={rdv} past={true} />)}
            </div>
          </section>
        )}
      </div>

      {activeRdv && (
        <AssistantPrepEntretien
          key={activeRdv.id}
          rdvId={activeRdv.id}
          dateRdv={activeRdv.dateRdv}
          typeRdv={activeRdv.typeRdv}
          onClose={() => setActiveRdv(null)}
        />
      )}
    </main>
  )
}
