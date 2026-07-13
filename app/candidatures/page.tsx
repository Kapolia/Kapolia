'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  terracotta: '#C4673A',
  sable: '#E8D5B7',
  creme: '#F7F2EB',
  vert: '#2C4A3E',
  dark: '#1A1A1A',
  grey: '#6B6B6B',
  lightGrey: '#D0D0D0',
  white: '#FFFFFF',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Statut = 'envoyée' | 'vue' | 'en_cours' | 'acceptée' | 'refusée'

type Offre = {
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
  offres: Offre | null
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
  if (days < 7) return `Il y a ${days} jours`
  if (days < 30) return `Il y a ${Math.floor(days / 7)} sem.`
  return `Il y a ${Math.floor(days / 30)} mois`
}

// ─── Statut config ────────────────────────────────────────────────────────────

type StatutConfig = { label: string; bg: string; color: string; dot: string }

const STATUT: Record<Statut, StatutConfig> = {
  envoyée:  { label: 'Envoyée',   bg: '#F0F0F0',            color: C.grey,        dot: C.lightGrey },
  vue:      { label: 'Vue',       bg: '#EBF0FF',            color: '#3B5BDB',     dot: '#3B5BDB' },
  en_cours: { label: 'En cours',  bg: `${C.terracotta}15`,  color: C.terracotta,  dot: C.terracotta },
  acceptée: { label: 'Acceptée',  bg: `${C.vert}15`,        color: C.vert,        dot: C.vert },
  refusée:  { label: 'Refusée',   bg: '#FDECEA',            color: '#C0392B',     dot: '#C0392B' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <main style={{
      minHeight: '100vh', backgroundColor: C.creme,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <style suppressHydrationWarning>{`@keyframes kavio-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        width: '36px', height: '36px', borderRadius: '50%',
        border: `3px solid ${C.sable}`, borderTopColor: C.terracotta,
        animation: 'kavio-spin 0.8s linear infinite',
      }} />
    </main>
  )
}

function StatCard({ icon, value, label, accent }: {
  icon: string
  value: number
  label: string
  accent: string
}) {
  return (
    <div style={{
      flex: '1 1 140px',
      backgroundColor: C.white,
      border: `1px solid ${C.sable}`,
      borderRadius: '16px',
      padding: '20px',
    }}>
      <div style={{ fontSize: '20px', marginBottom: '10px' }}>{icon}</div>
      <div style={{
        fontFamily: 'Georgia, serif',
        fontSize: '32px',
        color: accent,
        fontWeight: '700',
        lineHeight: 1,
        marginBottom: '6px',
      }}>
        {value}
      </div>
      <div style={{ fontSize: '12px', color: C.grey, fontWeight: '500' }}>
        {label}
      </div>
    </div>
  )
}

function BadgeStatut({ statut }: { statut: Statut }) {
  const s = STATUT[statut] ?? STATUT.envoyée
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      fontSize: '12px', fontWeight: '600',
      color: s.color,
      backgroundColor: s.bg,
      padding: '4px 10px', borderRadius: '20px',
      flexShrink: 0,
    }}>
      <span style={{
        width: '6px', height: '6px', borderRadius: '50%',
        backgroundColor: s.dot, display: 'inline-block', flexShrink: 0,
      }} />
      {s.label}
    </span>
  )
}

function CandidatureRow({ cand }: { cand: Candidature }) {
  const router = useRouter()
  const offre = cand.offres
  const nom = offre?.entreprise_nom ?? null
  const bg = avatarColor(cand.offre_id)

  return (
    <div style={{
      backgroundColor: C.white,
      border: `1px solid ${C.sable}`,
      borderRadius: '16px',
      padding: '20px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      flexWrap: 'wrap',
    }}>

      {/* Avatar */}
      <div style={{
        width: 44, height: 44, borderRadius: '12px', flexShrink: 0,
        backgroundColor: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: C.white, fontWeight: '700', fontSize: '14px',
      }}>
        {initiales(nom)}
      </div>

      {/* Infos poste */}
      <div style={{ flex: 1, minWidth: '180px' }}>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: '15px',
          color: C.dark,
          fontWeight: '600',
          marginBottom: '4px',
          lineHeight: 1.2,
        }}>
          {offre?.titre ?? 'Offre supprimée'}
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {nom && (
            <span style={{ fontSize: '13px', color: C.grey }}>{nom}</span>
          )}
          {offre?.ville && (
            <>
              <span style={{ fontSize: '12px', color: C.lightGrey }}>·</span>
              <span style={{ fontSize: '12px', color: C.grey }}>◎ {offre.ville}</span>
            </>
          )}
          {offre?.type_contrat && (
            <>
              <span style={{ fontSize: '12px', color: C.lightGrey }}>·</span>
              <span style={{ fontSize: '12px', color: C.grey }}>{offre.type_contrat}</span>
            </>
          )}
        </div>
      </div>

      {/* Date */}
      <div style={{
        fontSize: '12px', color: C.lightGrey,
        flexShrink: 0, minWidth: '80px', textAlign: 'right',
      }}>
        {dateLabel(cand.created_at)}
      </div>

      {/* Badge */}
      <BadgeStatut statut={cand.statut} />

      {/* Bouton */}
      <button
        onClick={() => router.push('/offres')}
        disabled={!offre}
        style={{
          backgroundColor: 'transparent',
          border: `1px solid ${C.sable}`,
          borderRadius: '10px',
          padding: '8px 14px',
          fontSize: '13px',
          color: offre ? C.dark : C.lightGrey,
          cursor: offre ? 'pointer' : 'default',
          fontWeight: '500',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        Voir l'offre →
      </button>

    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CandidaturesPage() {
  const router = useRouter()
  const [candidatures, setCandidatures] = useState<Candidature[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/connexion')
        return
      }

      const { data } = await supabase
        .from('candidatures')
        .select('*, offres(*)')
        .eq('candidat_id', user.id)
        .order('created_at', { ascending: false })

      setCandidatures((data as Candidature[]) ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <Spinner />

  const total     = candidatures.length
  const enAttente = candidatures.filter(c => c.statut === 'envoyée').length
  const enCours   = candidatures.filter(c => c.statut === 'en_cours' || c.statut === 'vue').length
  const acceptees = candidatures.filter(c => c.statut === 'acceptée').length

  return (
    <main style={{ backgroundColor: C.creme, minHeight: '100vh', marginLeft: 64 }}>
      <style suppressHydrationWarning>{`@keyframes kavio-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: '36px' }}>
          <h1 style={{
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(26px, 4vw, 36px)',
            color: C.dark, margin: '0 0 6px', lineHeight: 1.15,
          }}>
            Mes candidatures
          </h1>
          <p style={{ fontSize: '14px', color: C.grey, margin: 0 }}>
            Suivez l'avancement de vos candidatures
            {total > 0 && (
              <> · <strong style={{ color: C.dark }}>{total}</strong> envoyée{total > 1 ? 's' : ''}</>
            )}
          </p>
        </div>

        {/* ── STATS ───────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '36px' }}>
          <StatCard icon="◎"  value={total}     label="Total envoyées"  accent={C.dark} />
          <StatCard icon="◷"  value={enAttente}  label="En attente"      accent={C.grey} />
          <StatCard icon="⬡"  value={enCours}    label="En cours / Vues" accent={C.terracotta} />
          <StatCard icon="✦"  value={acceptees}  label="Acceptées"       accent={C.vert} />
        </div>

        {/* ── LISTE ───────────────────────────────────────────────────────── */}
        {candidatures.length === 0 ? (
          <div style={{
            backgroundColor: C.white,
            border: `1px solid ${C.sable}`,
            borderRadius: '20px',
            padding: '72px 24px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>◎</div>
            <h2 style={{
              fontFamily: 'Georgia, serif',
              fontSize: '22px', color: C.dark,
              margin: '0 0 8px', fontWeight: '400',
            }}>
              Vous n'avez pas encore postulé.
            </h2>
            <p style={{ fontSize: '14px', color: C.grey, margin: '0 0 28px', lineHeight: 1.6 }}>
              Explorez les offres disponibles et postulez en un clic grâce à votre profil Kavio.
            </p>
            <button
              onClick={() => router.push('/offres')}
              style={{
                backgroundColor: C.terracotta, color: C.white,
                border: 'none', borderRadius: '12px',
                padding: '13px 28px', fontSize: '14px', fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Voir les offres
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {candidatures.map(cand => (
              <CandidatureRow key={cand.id} cand={cand} />
            ))}
          </div>
        )}

      </div>
    </main>
  )
}
