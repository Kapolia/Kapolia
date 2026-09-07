'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { OffreDetail, type OffreData } from '@/components/OffreDetail'
import { useFavoris } from '@/lib/favoris-context'
import { getStatut } from '@/lib/statuts'
import { fetchProfilsEntreprise } from '@/lib/enrichir-entreprise'

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  terracotta: '#C4673A',
  sable:      '#E8D5B7',
  creme:      '#F7F2EB',
  vert:       '#2C4A3E',
  dark:       '#1A1A1A',
  grey:       '#6B6B6B',
  lightGrey:  '#D0D0D0',
  white:      '#FFFFFF',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = 'cand_desc' | 'cand_asc' | 'offre_desc' | 'statut' | 'entreprise'

type OffreResume = {
  id: string
  titre: string
  type_contrat: string | null
  ville: string | null
  entreprise_nom: string | null
  created_at: string | null
  recruteur_id: string | null
}

type Candidature = {
  id: string
  created_at: string
  candidat_id: string
  offre_id: string
  statut: string
  offres: OffreResume | null
}

type ModalAction = { candId: string } | null

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  C.terracotta, '#4A7C6E', '#8B6E4E', '#5C6BC0', '#2C6E49', '#B06000', '#7B5EA7',
]

function avatarColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function initiales(nom: string | null | undefined) {
  if (!nom) return '?'
  const parts = nom.trim().split(/\s+/)
  return parts.length === 1
    ? nom.slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[1][0]).toUpperCase()
}

function dateLabel(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Hier'
  if (days < 7)  return `Il y a ${days} jours`
  if (days < 30) return `Il y a ${Math.floor(days / 7)} sem.`
  return `Il y a ${Math.floor(days / 30)} mois`
}

const STATUT_RANK: Record<string, number> = {
  'acceptée': 0, 'en cours': 1, 'vue': 2, 'envoyée': 3, 'refusée': 4,
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner({ fullPage = false }: { fullPage?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      ...(fullPage ? { minHeight: '100vh', backgroundColor: C.creme } : { flex: 1 }),
    }}>
      <style suppressHydrationWarning>{`@keyframes kapolia-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: `3px solid ${C.sable}`, borderTopColor: C.terracotta,
        animation: 'kapolia-spin 0.8s linear infinite',
      }} />
    </div>
  )
}

function StatCard({ icon, value, label, accent }: {
  icon: string; value: number; label: string; accent: string
}) {
  return (
    <div style={{
      flex: '1 1 140px', backgroundColor: C.white,
      border: `1px solid ${C.sable}`, borderRadius: 16, padding: 20,
    }}>
      <div style={{ fontSize: 20, marginBottom: 10 }}>{icon}</div>
      <div style={{
        fontFamily: 'Georgia, serif', fontSize: 32,
        color: accent, fontWeight: 700, lineHeight: 1, marginBottom: 6,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: C.grey, fontWeight: 500 }}>{label}</div>
    </div>
  )
}

function BadgeStatut({ statut }: { statut: string }) {
  const s = getStatut(statut)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 12, fontWeight: 600,
      color: s.color, backgroundColor: s.bg,
      padding: '4px 10px', borderRadius: 20, flexShrink: 0,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        backgroundColor: s.dot, display: 'inline-block', flexShrink: 0,
      }} />
      {s.label}
    </span>
  )
}

function ConfirmModal({ title, body, confirmLabel, onConfirm, onDismiss }: {
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onDismiss: () => void
}) {
  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(26,26,26,0.45)',
        zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: C.white, borderRadius: 16,
          padding: '28px 28px 24px', maxWidth: 400, width: '100%',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        }}
      >
        <h3 style={{
          fontFamily: 'Georgia, serif', fontSize: 18,
          color: C.dark, margin: '0 0 10px', fontWeight: 400,
        }}>
          {title}
        </h3>
        <p style={{ fontSize: 13, color: C.grey, lineHeight: 1.65, margin: '0 0 24px' }}>
          {body}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onDismiss}
            style={{
              padding: '9px 18px', borderRadius: 10,
              border: `1px solid ${C.sable}`, backgroundColor: 'transparent',
              color: C.grey, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '9px 18px', borderRadius: 10, border: 'none',
              backgroundColor: C.grey,
              color: C.white, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function SortSelector({ value, onChange, labelColor }: { value: SortKey; onChange: (k: SortKey) => void; labelColor?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: labelColor ?? C.grey, flexShrink: 0 }}>Trier par</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value as SortKey)}
        style={{
          fontSize: 12, color: C.dark,
          border: `1px solid ${C.sable}`, borderRadius: 8,
          padding: '5px 10px', backgroundColor: C.white,
          cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
        }}
      >
        <option value="cand_desc">Date de candidature (récentes)</option>
        <option value="cand_asc">Date de candidature (anciennes)</option>
        <option value="offre_desc">Date de publication (récentes)</option>
        <option value="statut">Par statut</option>
        <option value="entreprise">Par entreprise</option>
      </select>
    </div>
  )
}

// Carte complète — vue liste sans panneau ouvert
function CandidatureCardFull({ cand, onViewOffre, onSupprimer }: {
  cand: Candidature
  onViewOffre: () => void
  onSupprimer: () => void
}) {
  const [hov, setHov] = useState(false)
  const offre = cand.offres
  const nom   = offre?.entreprise_nom ?? null
  const bg    = avatarColor(cand.offre_id)

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        backgroundColor: C.white, border: `1px solid ${C.sable}`,
        borderRadius: 16, padding: '16px 22px',
      }}
    >
      {/* Ligne principale — avatar + info seulement, nowrap */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          backgroundColor: bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: C.white, fontWeight: 700, fontSize: 14,
        }}>
          {initiales(nom)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'Georgia, serif', fontSize: 15,
            color: C.dark, fontWeight: 600, marginBottom: 4, lineHeight: 1.2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {offre?.titre ?? 'Offre supprimée'}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {nom && (
              offre?.recruteur_id ? (
                <Link
                  href={`/entreprise/${offre.recruteur_id}`}
                  style={{ fontSize: 13, color: C.terracotta, textDecoration: 'none', fontWeight: 500 }}
                >
                  {nom}
                </Link>
              ) : (
                <span style={{ fontSize: 13, color: C.grey }}>{nom}</span>
              )
            )}
            {offre?.ville && (
              <>
                <span style={{ fontSize: 12, color: C.lightGrey }}>·</span>
                <span style={{ fontSize: 12, color: C.grey }}>◎ {offre.ville}</span>
              </>
            )}
            {offre?.type_contrat && (
              <>
                <span style={{ fontSize: 12, color: C.lightGrey }}>·</span>
                <span style={{ fontSize: 12, color: C.grey }}>{offre.type_contrat}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Ligne basse unique — date · badge ── Voir l'offre → 🗑 */}
      <div style={{
        marginTop: 10,
        display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 8,
      }}>
        <span style={{ fontSize: 12, color: C.lightGrey, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {dateLabel(cand.created_at)}
        </span>
        <div style={{ flexShrink: 0 }}>
          <BadgeStatut statut={cand.statut} />
        </div>

        {/* Spacer */}
        <div style={{ flex: 1, minWidth: 0 }} />

        <button
          onClick={onViewOffre}
          disabled={!offre}
          style={{
            backgroundColor: 'transparent', border: `1px solid ${C.sable}`,
            borderRadius: 10, padding: '6px 12px', fontSize: 12,
            color: offre ? C.dark : C.lightGrey,
            cursor: offre ? 'pointer' : 'default',
            fontWeight: 500, whiteSpace: 'nowrap', fontFamily: 'inherit', flexShrink: 0,
          }}
        >
          Voir l&apos;offre →
        </button>

        <button
          onClick={e => { e.stopPropagation(); onSupprimer() }}
          title="Supprimer de mon suivi"
          style={{
            background: 'none', border: 'none', padding: '4px 4px',
            fontSize: 13, cursor: 'pointer', lineHeight: 1,
            color: hov ? C.grey : C.lightGrey,
            flexShrink: 0, transition: 'color 0.15s',
          }}
        >
          🗑
        </button>
      </div>
    </div>
  )
}

// Carte compacte — colonne gauche du split view
function CandidatureCardCompact({ cand, isSelected, onViewOffre }: {
  cand: Candidature
  isSelected: boolean
  onViewOffre: () => void
}) {
  const [hov, setHov] = useState(false)
  const offre = cand.offres
  const nom   = offre?.entreprise_nom ?? null
  const bg    = avatarColor(cand.offre_id)

  return (
    <button
      onClick={onViewOffre}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', textAlign: 'left', fontFamily: 'inherit',
        backgroundColor: isSelected ? `${C.terracotta}08` : hov ? `${C.dark}04` : C.white,
        border: `1px solid ${isSelected ? C.terracotta : C.sable}`,
        borderLeft: `3px solid ${isSelected ? C.terracotta : 'transparent'}`,
        borderRadius: 12, padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        cursor: 'pointer', transition: 'all 0.12s',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
        backgroundColor: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: C.white, fontWeight: 700, fontSize: 12,
      }}>
        {initiales(nom)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: C.dark,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2,
        }}>
          {offre?.titre ?? 'Offre supprimée'}
        </div>
        <div style={{
          fontSize: 11, color: C.grey,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {[nom, offre?.ville].filter(Boolean).join(' · ') || dateLabel(cand.created_at)}
        </div>
      </div>

      <BadgeStatut statut={cand.statut} />
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CandidaturesPage() {
  const router = useRouter()
  const { favIds, toggleFav } = useFavoris()

  const [candidatures, setCandidatures] = useState<Candidature[]>([])
  const [loading, setLoading]           = useState(true)
  const [selectedCandId, setSelectedCandId] = useState<string | null>(null)
  const [selectedOffre, setSelectedOffre]   = useState<OffreData | null>(null)
  const [offreLoading, setOffreLoading]     = useState(false)
  const [isMobile, setIsMobile]             = useState(false)
  const [sortKey, setSortKey]               = useState<SortKey>('cand_desc')
  const [modal, setModal]                   = useState<ModalAction>(null)

  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 900) }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/connexion'); return }

      const { data, error: candErr } = await supabase
        .from('candidatures')
        .select('*, offres(id, titre, type_contrat, ville, entreprise_nom, created_at, recruteur_id)')
        .eq('candidat_id', user.id)
        .eq('masquee_candidat', false)
        .order('created_at', { ascending: false })

      if (candErr) { console.error('[candidatures]', candErr); setLoading(false); return }

      const candidaturesRaw = (data as Candidature[]) ?? []

      // Two-step : nom actuel depuis profils recruteur
      const recruteurIds = [...new Set(
        candidaturesRaw.map(c => c.offres?.recruteur_id).filter(Boolean)
      )] as string[]
      const { map, error: profErr } = await fetchProfilsEntreprise(recruteurIds)
      if (profErr) console.error('[candidatures profils]', profErr)

      const enriched = candidaturesRaw.map(cand => {
        const rid = cand.offres?.recruteur_id
        const ep  = rid ? map[rid] : undefined
        if (!ep || !cand.offres) return cand
        return {
          ...cand,
          offres: {
            ...cand.offres,
            entreprise_nom: ep.entreprise_nom ?? cand.offres.entreprise_nom,
          },
        }
      })

      setCandidatures(enriched)
      setLoading(false)
    }
    load()
  }, [router])

  // ── Tri côté client ───────────────────────────────────────────────────────

  const sorted = useMemo(() => {
    const arr = [...candidatures]
    switch (sortKey) {
      case 'cand_asc':
        return arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      case 'offre_desc':
        return arr.sort((a, b) => {
          const da = a.offres?.created_at ? new Date(a.offres.created_at).getTime() : 0
          const db = b.offres?.created_at ? new Date(b.offres.created_at).getTime() : 0
          return db - da
        })
      case 'statut':
        return arr.sort((a, b) => (STATUT_RANK[a.statut] ?? 99) - (STATUT_RANK[b.statut] ?? 99))
      case 'entreprise':
        return arr.sort((a, b) =>
          (a.offres?.entreprise_nom ?? '').localeCompare(b.offres?.entreprise_nom ?? '', 'fr')
        )
      default: // cand_desc
        return arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
  }, [candidatures, sortKey])

  // ── Actions candidature ───────────────────────────────────────────────────

  async function handleSupprimer(candId: string) {
    setCandidatures(prev => prev.filter(c => c.id !== candId))
    setModal(null)
    if (selectedCandId === candId) {
      setSelectedCandId(null)
      setSelectedOffre(null)
    }
    await supabase.from('candidatures').update({ masquee_candidat: true }).eq('id', candId)
  }

  const handleViewOffre = useCallback(async (cand: Candidature) => {
    if (!cand.offres) return
    if (isMobile) { router.push(`/offres/${cand.offre_id}`); return }
    if (selectedCandId === cand.id) {
      setSelectedCandId(null)
      setSelectedOffre(null)
      return
    }
    setSelectedCandId(cand.id)
    setSelectedOffre(null)
    setOffreLoading(true)

    const { data: offreData, error: offreErr } = await supabase
      .from('offres').select('*').eq('id', cand.offre_id).single()
    if (offreErr) { console.error('[candidatures handleViewOffre offre]', offreErr); setOffreLoading(false); return }

    let offre = offreData ? { ...(offreData as OffreData) } : null
    if (offre?.recruteur_id) {
      const { data: ep, error: epErr } = await supabase
        .from('profils')
        .select('entreprise_nom, entreprise_logo_url')
        .eq('user_id', offre.recruteur_id)
        .single()
      if (epErr) console.error('[candidatures handleViewOffre profils]', epErr)
      if (ep) {
        if (ep.entreprise_nom)      offre = { ...offre, entreprise_nom:      ep.entreprise_nom }
        if (ep.entreprise_logo_url) offre = { ...offre, entreprise_logo_url: ep.entreprise_logo_url }
      }
    }

    setSelectedOffre(offre)
    setOffreLoading(false)
  }, [isMobile, selectedCandId, router])

  function closePanel() {
    setSelectedCandId(null)
    setSelectedOffre(null)
  }

  if (loading) return <Spinner fullPage />

  // ── Compteurs ─────────────────────────────────────────────────────────────

  const total     = candidatures.length
  const enAttente = candidatures.filter(c => c.statut === 'envoyée').length
  const enCours   = candidatures.filter(c => c.statut === 'en cours' || c.statut === 'vue').length
  const acceptees = candidatures.filter(c => c.statut === 'acceptée').length

  const selectedCand = candidatures.find(c => c.id === selectedCandId) ?? null

  // Libellé de l'offre pour les modals
  const modalOffre = modal
    ? (candidatures.find(c => c.id === modal.candId)?.offres?.titre ?? 'cette offre')
    : ''

  // ── Rendu modal ───────────────────────────────────────────────────────────

  function renderModal() {
    if (!modal) return null
    return (
      <ConfirmModal
        title="Supprimer de mon suivi"
        body={`« ${modalOffre} » n'apparaîtra plus dans votre liste. Le recruteur conserve votre candidature et peut toujours la consulter.`}
        confirmLabel="Supprimer de mon suivi"
        onConfirm={() => handleSupprimer(modal.candId)}
        onDismiss={() => setModal(null)}
      />
    )
  }

  // ── Split view ────────────────────────────────────────────────────────────

  if (selectedCandId) {
    return (
      <main style={{
        backgroundColor: C.creme, marginLeft: 64,
        height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <style suppressHydrationWarning>{`@keyframes kapolia-spin { to { transform: rotate(360deg); } }`}</style>

        {renderModal()}

        {/* Barre de titre */}
        <div style={{
          height: 64, padding: '0 20px', flexShrink: 0,
          backgroundColor: C.vert,
          borderBottom: `1px solid rgba(0,0,0,0.12)`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <h1 style={{
            fontFamily: 'Georgia, serif', fontSize: 17,
            color: C.creme, margin: 0, fontWeight: 400,
          }}>
            Mes candidatures
          </h1>
          <span style={{ fontSize: 13, color: 'rgba(247,242,235,0.60)' }}>· {total}</span>
          <div style={{ marginLeft: 'auto' }}>
            <SortSelector value={sortKey} onChange={setSortKey} labelColor="rgba(247,242,235,0.75)" />
          </div>
        </div>

        {/* Colonnes */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Gauche — liste compacte */}
          <div style={{
            width: 340, flexShrink: 0, overflowY: 'auto',
            padding: '12px 10px', borderRight: `1px solid ${C.sable}`,
            backgroundColor: C.creme,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {sorted.map(cand => (
              <CandidatureCardCompact
                key={cand.id}
                cand={cand}
                isSelected={cand.id === selectedCandId}
                onViewOffre={() => handleViewOffre(cand)}
              />
            ))}
          </div>

          {/* Droite — détail offre */}
          <div style={{
            flex: 1, overflow: 'hidden', backgroundColor: C.creme,
            display: 'flex', flexDirection: 'column',
          }}>
            {offreLoading ? (
              <Spinner />
            ) : selectedOffre ? (
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <OffreDetail
                  offre={selectedOffre}
                  applied={true}
                  appliedDate={selectedCand?.created_at ?? null}
                  applying={false}
                  saved={favIds.has(selectedCand?.offre_id ?? '')}
                  isConnected={true}
                  similaires={[]}
                  onApply={() => {}}
                  onToggleSave={() => selectedCand && toggleFav(selectedCand.offre_id)}
                  onSelectSimilaire={simId => router.push(`/offres/${simId}`)}
                  mode="panel"
                  onBack={closePanel}
                  removeAction={selectedCand ? () => setModal({ candId: selectedCand.id }) : undefined}
                />
              </div>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100%', color: C.grey, fontSize: 14,
              }}>
                Cette offre n&apos;est plus disponible.
              </div>
            )}
          </div>

        </div>
      </main>
    )
  }

  // ── Vue liste pleine largeur ──────────────────────────────────────────────

  return (
    <main style={{ backgroundColor: C.creme, minHeight: '100vh', marginLeft: 64 }}>
      <style suppressHydrationWarning>{`@keyframes kapolia-spin { to { transform: rotate(360deg); } }`}</style>

      {renderModal()}

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(26px, 4vw, 36px)',
            color: C.dark, margin: '0 0 6px', lineHeight: 1.15,
          }}>
            Mes candidatures
          </h1>
          <p style={{ fontSize: 14, color: C.grey, margin: 0 }}>
            Suivez l&apos;avancement de vos candidatures
            {total > 0 && (
              <> · <strong style={{ color: C.dark }}>{total}</strong> active{total > 1 ? 's' : ''}</>
            )}
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 36 }}>
          <StatCard icon="◎" value={total}     label="Total"           accent={C.dark} />
          <StatCard icon="◷" value={enAttente}  label="En attente"      accent={C.grey} />
          <StatCard icon="⬡" value={enCours}    label="En cours / Vues" accent={C.terracotta} />
          <StatCard icon="✦" value={acceptees}  label="Acceptées"       accent={C.vert} />
        </div>

        {/* Liste */}
        {candidatures.length === 0 ? (
          <div style={{
            backgroundColor: C.white, border: `1px solid ${C.sable}`,
            borderRadius: 20, padding: '72px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>◎</div>
            <h2 style={{
              fontFamily: 'Georgia, serif', fontSize: 22, color: C.dark,
              margin: '0 0 8px', fontWeight: 400,
            }}>
              Vous n&apos;avez pas encore postulé.
            </h2>
            <p style={{ fontSize: 14, color: C.grey, margin: '0 0 28px', lineHeight: 1.6 }}>
              Explorez les offres disponibles et postulez en un clic grâce à votre profil Kapolia.
            </p>
            <button
              onClick={() => router.push('/offres')}
              style={{
                backgroundColor: C.terracotta, color: C.white,
                border: 'none', borderRadius: 12,
                padding: '13px 28px', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Voir les offres
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
              <SortSelector value={sortKey} onChange={setSortKey} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sorted.map(cand => (
                <CandidatureCardFull
                  key={cand.id}
                  cand={cand}
                  onViewOffre={() => handleViewOffre(cand)}
                  onSupprimer={() => setModal({ candId: cand.id })}
                />
              ))}
            </div>
          </>
        )}

      </div>
    </main>
  )
}
