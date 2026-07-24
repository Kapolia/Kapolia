'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { OffreDetail, type OffreData } from '@/components/OffreDetail'
import { useFavoris } from '@/lib/favoris-context'

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

type Statut = 'envoyée' | 'vue' | 'en_cours' | 'acceptée' | 'refusée'

type OffreResume = {
  id: string
  titre: string
  type_contrat: string | null
  ville: string | null
  entreprise_nom: string | null
}

type Candidature = {
  id: string
  created_at: string
  candidat_id: string
  offre_id: string
  statut: Statut
  offres: OffreResume | null
}

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

// ─── Statut config ────────────────────────────────────────────────────────────

type StatutConfig = { label: string; bg: string; color: string; dot: string }

const STATUT: Record<Statut, StatutConfig> = {
  envoyée:  { label: 'Envoyée',   bg: '#F0F0F0',           color: C.grey,       dot: C.lightGrey },
  vue:      { label: 'Vue',       bg: '#EBF0FF',           color: '#3B5BDB',    dot: '#3B5BDB' },
  en_cours: { label: 'En cours',  bg: `${C.terracotta}15`, color: C.terracotta, dot: C.terracotta },
  acceptée: { label: 'Acceptée',  bg: `${C.vert}15`,       color: C.vert,       dot: C.vert },
  refusée:  { label: 'Refusée',   bg: '#FDECEA',           color: '#C0392B',    dot: '#C0392B' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner({ fullPage = false }: { fullPage?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      ...(fullPage ? { minHeight: '100vh', backgroundColor: C.creme } : { flex: 1 }),
    }}>
      <style suppressHydrationWarning>{`@keyframes kavio-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: `3px solid ${C.sable}`, borderTopColor: C.terracotta,
        animation: 'kavio-spin 0.8s linear infinite',
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

function BadgeStatut({ statut }: { statut: Statut }) {
  const s = STATUT[statut] ?? STATUT.envoyée
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

// Carte complète (vue liste sans panneau ouvert)
function CandidatureCardFull({ cand, onViewOffre }: {
  cand: Candidature
  onViewOffre: () => void
}) {
  const offre = cand.offres
  const nom   = offre?.entreprise_nom ?? null
  const bg    = avatarColor(cand.offre_id)

  return (
    <div style={{
      backgroundColor: C.white, border: `1px solid ${C.sable}`,
      borderRadius: 16, padding: '20px 24px',
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        backgroundColor: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: C.white, fontWeight: 700, fontSize: 14,
      }}>
        {initiales(nom)}
      </div>

      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{
          fontFamily: 'Georgia, serif', fontSize: 15,
          color: C.dark, fontWeight: 600, marginBottom: 4, lineHeight: 1.2,
        }}>
          {offre?.titre ?? 'Offre supprimée'}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {nom && <span style={{ fontSize: 13, color: C.grey }}>{nom}</span>}
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

      <div style={{ fontSize: 12, color: C.lightGrey, flexShrink: 0, minWidth: 80, textAlign: 'right' }}>
        {dateLabel(cand.created_at)}
      </div>

      <BadgeStatut statut={cand.statut} />

      <button
        onClick={onViewOffre}
        disabled={!offre}
        style={{
          backgroundColor: 'transparent', border: `1px solid ${C.sable}`,
          borderRadius: 10, padding: '8px 14px', fontSize: 13,
          color: offre ? C.dark : C.lightGrey,
          cursor: offre ? 'pointer' : 'default',
          fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap', fontFamily: 'inherit',
        }}
      >
        Voir l'offre →
      </button>
    </div>
  )
}

// Carte compacte (colonne gauche du split view)
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
  const [selectedCandId, setSelectedCandId]     = useState<string | null>(null)
  const [selectedOffre, setSelectedOffre]       = useState<OffreData | null>(null)
  const [offreLoading, setOffreLoading]         = useState(false)
  const [isMobile, setIsMobile]                 = useState(false)

  // Detect mobile
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

      const { data } = await supabase
        .from('candidatures')
        .select('*, offres(id, titre, type_contrat, ville, entreprise_nom)')
        .eq('candidat_id', user.id)
        .order('created_at', { ascending: false })

      setCandidatures((data as Candidature[]) ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  const handleViewOffre = useCallback(async (cand: Candidature) => {
    if (!cand.offres) return

    // Mobile : navigation classique
    if (isMobile) { router.push(`/offres/${cand.offre_id}`); return }

    // Toggle : cliquer la même ligne ferme le panneau
    if (selectedCandId === cand.id) {
      setSelectedCandId(null)
      setSelectedOffre(null)
      return
    }

    setSelectedCandId(cand.id)
    setSelectedOffre(null)
    setOffreLoading(true)
    const { data } = await supabase.from('offres').select('*').eq('id', cand.offre_id).single()
    setSelectedOffre((data as OffreData) ?? null)
    setOffreLoading(false)
  }, [isMobile, selectedCandId, router])

  function closePanel() {
    setSelectedCandId(null)
    setSelectedOffre(null)
  }

  if (loading) return <Spinner fullPage />

  const total      = candidatures.length
  const enAttente  = candidatures.filter(c => c.statut === 'envoyée').length
  const enCours    = candidatures.filter(c => c.statut === 'en_cours' || c.statut === 'vue').length
  const acceptees  = candidatures.filter(c => c.statut === 'acceptée').length
  const selectedCand = candidatures.find(c => c.id === selectedCandId) ?? null

  // ── Split view ─────────────────────────────────────────────────────────────

  if (selectedCandId) {
    return (
      <main style={{
        backgroundColor: C.creme,
        marginLeft: 64,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <style suppressHydrationWarning>{`@keyframes kavio-spin { to { transform: rotate(360deg); } }`}</style>

        {/* Barre de titre compacte */}
        <div style={{
          padding: '12px 20px',
          borderBottom: `1px solid ${C.sable}`,
          backgroundColor: C.white,
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <h1 style={{
            fontFamily: 'Georgia, serif', fontSize: 17,
            color: C.dark, margin: 0, fontWeight: 400,
          }}>
            Mes candidatures
          </h1>
          <span style={{ fontSize: 13, color: C.grey }}>· {total}</span>
        </div>

        {/* Colonnes */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Gauche — liste compacte */}
          <div style={{
            width: 340, flexShrink: 0,
            overflowY: 'auto',
            padding: '12px 10px',
            borderRight: `1px solid ${C.sable}`,
            backgroundColor: C.creme,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {candidatures.map(cand => (
              <CandidatureCardCompact
                key={cand.id}
                cand={cand}
                isSelected={cand.id === selectedCandId}
                onViewOffre={() => handleViewOffre(cand)}
              />
            ))}
          </div>

          {/* Droite — détail de l'offre */}
          <div style={{ flex: 1, overflowY: 'auto', backgroundColor: C.creme }}>
            {offreLoading ? (
              <Spinner />
            ) : selectedOffre ? (
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
              />
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

  // ── Vue liste pleine largeur ────────────────────────────────────────────────

  return (
    <main style={{ backgroundColor: C.creme, minHeight: '100vh', marginLeft: 64 }}>
      <style suppressHydrationWarning>{`@keyframes kavio-spin { to { transform: rotate(360deg); } }`}</style>

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
            Suivez l'avancement de vos candidatures
            {total > 0 && (
              <> · <strong style={{ color: C.dark }}>{total}</strong> envoyée{total > 1 ? 's' : ''}</>
            )}
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 36 }}>
          <StatCard icon="◎" value={total}     label="Total envoyées"  accent={C.dark} />
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
              Vous n'avez pas encore postulé.
            </h2>
            <p style={{ fontSize: 14, color: C.grey, margin: '0 0 28px', lineHeight: 1.6 }}>
              Explorez les offres disponibles et postulez en un clic grâce à votre profil Kavio.
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {candidatures.map(cand => (
              <CandidatureCardFull
                key={cand.id}
                cand={cand}
                onViewOffre={() => handleViewOffre(cand)}
              />
            ))}
          </div>
        )}

      </div>
    </main>
  )
}
