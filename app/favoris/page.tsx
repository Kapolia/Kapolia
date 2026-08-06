'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useFavoris } from '@/lib/favoris-context'
import { OffreCard, type OffreCardData } from '@/components/OffreCard'

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

type FavOffre = OffreCardData & {
  fav_created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ajoutLabel(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d === 0) return "Ajouté aujourd'hui"
  if (d === 1) return 'Ajouté il y a 1 jour'
  return `Ajouté il y a ${d} jours`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      backgroundColor: C.white, borderRadius: 14, padding: '20px 24px',
      border: `1px solid #EDE7DB`, borderLeft: `3px solid transparent`,
    }}>
      {([['68%', 18], ['42%', 13], ['88%', 12], ['55%', 12]] as [string, number][]).map(([w, h], i) => (
        <div key={i} style={{
          height: h, width: w, borderRadius: 6, backgroundColor: C.sable,
          marginBottom: i === 1 ? 14 : 8,
          animation: `kavio-pulse 1.6s ease-in-out ${i * 0.14}s infinite`,
        }} />
      ))}
    </div>
  )
}

function EmptyFavoris({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '80px 24px', textAlign: 'center',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        backgroundColor: C.white, border: `2px solid ${C.sable}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, marginBottom: 20, color: C.lightGrey,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      }}>
        ☆
      </div>
      <h2 style={{
        fontFamily: 'Georgia, serif', fontSize: 22, color: C.dark,
        margin: '0 0 10px', fontWeight: 600,
      }}>
        Aucune offre sauvegardée
      </h2>
      <p style={{
        fontSize: 14, color: C.grey, margin: '0 0 28px',
        maxWidth: 340, lineHeight: 1.65,
      }}>
        Cliquez sur ☆ sur n&apos;importe quelle offre pour la retrouver ici.
      </p>
      <button
        onClick={onBrowse}
        style={{
          padding: '12px 28px', borderRadius: 10, border: 'none',
          backgroundColor: C.terracotta, color: C.white,
          fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          transition: 'opacity 0.12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        Parcourir les offres
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FavorisPage() {
  const router = useRouter()
  const { toggleFav } = useFavoris()

  const [offres, setOffres]         = useState<FavOffre[]>([])
  const [applied, setApplied]       = useState<Set<string>>(new Set())
  const [isConnected, setIsConnected] = useState(false)
  const [userId, setUserId]         = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/connexion'); return }
      setIsConnected(true)
      setUserId(user.id)

      const [favsRes, candidaturesRes] = await Promise.all([
        supabase
          .from('offres_favorites')
          .select(`
            created_at,
            offres (
              id, titre, entreprise_nom, type_contrat, ville,
              mode_travail, salaire_min, salaire_max, periode_salaire,
              active, statut_publication
            )
          `)
          .eq('candidat_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('candidatures')
          .select('offre_id')
          .eq('candidat_id', user.id),
      ])

      if (favsRes.error) { console.error(favsRes.error.message); setLoading(false); return }

      type RawRow = {
        created_at: string
        offres: {
          id: string; titre: string; entreprise_nom: string | null
          type_contrat: string | null; ville: string | null
          mode_travail: string | null; salaire_min: string | null
          salaire_max: string | null; periode_salaire: string | null
          active: boolean; statut_publication: string
        } | null
      }

      const list: FavOffre[] = ((favsRes.data as unknown as RawRow[]) ?? [])
        .filter(row => row.offres?.active === true && row.offres.statut_publication === 'publiée')
        .map(row => {
          const o = row.offres!
          return {
            id:              o.id,
            titre:           o.titre,
            entreprise_nom:  o.entreprise_nom  ?? undefined,
            type_contrat:    o.type_contrat    ?? undefined,
            ville:           o.ville           ?? undefined,
            mode_travail:    o.mode_travail    ?? undefined,
            salaire_min:     o.salaire_min  != null ? parseFloat(o.salaire_min)  : undefined,
            salaire_max:     o.salaire_max  != null ? parseFloat(o.salaire_max)  : undefined,
            periode_salaire: o.periode_salaire ?? undefined,
            fav_created_at:  row.created_at,
          }
        })

      setOffres(list)
      setApplied(new Set(
        ((candidaturesRes.data ?? []) as { offre_id: string }[]).map(c => c.offre_id)
      ))
      setLoading(false)
    }
    load()
  }, [router])

  async function handleApply(offreId: string) {
    if (!userId) return
    const { error } = await supabase.from('candidatures').insert({
      candidat_id: userId,
      offre_id:    offreId,
      statut:      'envoyée',
    })
    if (!error) setApplied(prev => new Set([...prev, offreId]))
  }

  function handleToggleSave(offreId: string) {
    setOffres(prev => prev.filter(o => o.id !== offreId))
    toggleFav(offreId)  // context: optimistic update + DB + rollback si erreur
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ backgroundColor: C.creme, minHeight: '100vh', marginLeft: 64 }}>
      <style suppressHydrationWarning>{`
        @keyframes kavio-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.42; } }
        @keyframes kavio-spin  { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>

      {/* En-tête vert */}
      <div style={{ backgroundColor: C.vert }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 24px 0' }}>
          <p style={{
            fontFamily: 'Georgia, serif', fontStyle: 'italic',
            fontSize: 21, color: C.creme, fontWeight: 400,
            margin: '0 0 4px',
          }}>
            Mes favoris
          </p>
          <p style={{ fontSize: 13, color: 'rgba(247,242,235,0.65)', margin: 0, minHeight: 18 }}>
            {!loading && `${offres.length} offre${offres.length !== 1 ? 's' : ''} sauvegardée${offres.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <svg
          viewBox="0 0 1440 28"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ display: 'block', width: '100%', height: 28, marginBottom: -1, marginTop: 16 }}
        >
          <path d="M0,14 C320,28 640,0 960,14 C1120,21 1300,6 1440,14 L1440,28 L0,28 Z" fill={C.creme} />
        </svg>
      </div>

      {/* Contenu */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 24px 80px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : offres.length === 0 ? (
          <EmptyFavoris onBrowse={() => router.push('/offres')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {offres.map(offre => (
              <OffreCard
                key={offre.id}
                offre={offre}
                applied={applied.has(offre.id)}
                saved={true}
                onApply={handleApply}
                onToggleSave={handleToggleSave}
                isConnected={isConnected}
                dateLabel={ajoutLabel(offre.fav_created_at)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
