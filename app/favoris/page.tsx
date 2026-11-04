'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FONT_SERIF } from '@/lib/typography'
import { useFavoris } from '@/lib/favoris-context'
import { OffreCard, type OffreCardData } from '@/components/OffreCard'
import { fetchProfilsEntreprise } from '@/lib/enrichir-entreprise'
import { scoreBreakdownCandidat, type ProfilMatch, type OffreMatch } from '@/lib/matching'
import { CARD_SHADOW, CARD_RADIUS } from '@/lib/colors'

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  terracotta: '#C4673A',
  sable:      '#E7EAE8',
  creme:      '#F6F7F6',
  vert:       '#2C4A3E',
  dark:       '#15201B',
  grey:       '#687069',
  lightGrey:  '#D0D0D0',
  white:      '#FFFFFF',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = 'fav_desc' | 'fav_asc' | 'salaire_desc' | 'offre_desc' | 'entreprise'

type FavOffre = OffreCardData & {
  fav_created_at:  string
  offre_created_at: string
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
      backgroundColor: C.white, borderRadius: CARD_RADIUS, padding: '20px 24px',
      borderLeft: `3px solid transparent`, boxShadow: CARD_SHADOW,
    }}>
      {([['68%', 18], ['42%', 13], ['88%', 12], ['55%', 12]] as [string, number][]).map(([w, h], i) => (
        <div key={i} style={{
          height: h, width: w, borderRadius: 6, backgroundColor: C.sable,
          marginBottom: i === 1 ? 14 : 8,
          animation: `kapolia-pulse 1.6s ease-in-out ${i * 0.14}s infinite`,
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
        fontFamily: FONT_SERIF, fontSize: 22, color: C.dark,
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
  const [sortKey, setSortKey]       = useState<SortKey>('fav_desc')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/connexion'); return }
      setIsConnected(true)
      setUserId(user.id)

      const [favsRes, profilRes, candidaturesRes] = await Promise.all([
        supabase
          .from('offres_favorites')
          .select(`
            created_at,
            offres (
              id, titre, type_contrat, ville, domaine, experience,
              mode_travail, valeurs, langues, competences, competences_bonus,
              salaire_min, salaire_max, periode_salaire,
              active, statut_publication, created_at, recruteur_id, expire_at
            )
          `)
          .eq('candidat_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('profils')
          .select('domaine, experience, type_poste, valeur, ville, mode_travail, langues, competences_acquises')
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('candidatures')
          .select('offre_id')
          .eq('candidat_id', user.id),
      ])

      if (favsRes.error) { console.error('[favoris]', favsRes.error); setLoading(false); return }

      type RawRow = {
        created_at: string
        offres: {
          id: string; titre: string
          type_contrat: string | null; ville: string | null
          domaine: string | null; experience: string | null
          mode_travail: string | null; valeurs: string[] | null
          langues: string[] | null; competences: string[] | null
          competences_bonus: string[] | null
          salaire_min: string | null; salaire_max: string | null
          periode_salaire: string | null
          active: boolean; statut_publication: string; created_at: string
          recruteur_id: string | null; expire_at: string | null
        } | null
      }

      const list: FavOffre[] = ((favsRes.data as unknown as RawRow[]) ?? [])
        .filter(row => row.offres?.active === true && row.offres.statut_publication === 'publiée' && !!row.offres.expire_at && new Date(row.offres.expire_at) > new Date())
        .map(row => {
          const o = row.offres!
          return {
            id:              o.id,
            titre:           o.titre,
            recruteur_id:    o.recruteur_id    ?? undefined,
            type_contrat:    o.type_contrat    ?? undefined,
            ville:           o.ville           ?? undefined,
            mode_travail:    o.mode_travail    ?? undefined,
            salaire_min:     o.salaire_min  != null ? parseFloat(o.salaire_min)  : undefined,
            salaire_max:     o.salaire_max  != null ? parseFloat(o.salaire_max)  : undefined,
            periode_salaire: o.periode_salaire ?? undefined,
            fav_created_at:   row.created_at,
            offre_created_at: o.created_at,
          }
        })

      // Two-step : nom actuel depuis profils recruteur
      const recruteurIds = [...new Set(list.map(o => o.recruteur_id).filter(Boolean))] as string[]
      const { map, error: profErr } = await fetchProfilsEntreprise(recruteurIds)
      if (profErr) console.error('[favoris profils]', profErr)

      // Table de lookup pour les données de scoring (champs non portés par FavOffre)
      const scoringData = new Map<string, OffreMatch>()
      for (const row of (favsRes.data as unknown as RawRow[] ?? [])) {
        const o = row.offres
        if (!o) continue
        scoringData.set(o.id, {
          domaine:           o.domaine          ?? undefined,
          experience:        o.experience       ?? undefined,
          type_contrat:      o.type_contrat     ?? undefined,
          valeurs:           o.valeurs          ?? undefined,
          ville:             o.ville            ?? undefined,
          mode_travail:      o.mode_travail     ?? undefined,
          langues:           o.langues          ?? undefined,
          competences:       o.competences      ?? undefined,
          competences_bonus: o.competences_bonus ?? undefined,
        })
      }

      const profil = (profilRes.data as ProfilMatch | null) ?? null

      const enriched = list.map(o => {
        const ep = o.recruteur_id ? map[o.recruteur_id] : undefined
        const base = { ...o, entreprise_nom: ep?.entreprise_nom ?? undefined }
        if (!profil) return base
        const om = scoringData.get(o.id)
        if (!om) return base
        const bd = scoreBreakdownCandidat(profil, om)
        return { ...base, score: bd.total, breakdown: bd }
      })

      setOffres(enriched)
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

  const sorted = useMemo(() => {
    const arr = [...offres]
    switch (sortKey) {
      case 'fav_asc':
        return arr.sort((a, b) => new Date(a.fav_created_at).getTime() - new Date(b.fav_created_at).getTime())
      case 'salaire_desc':
        return arr.sort((a, b) => {
          const sa = a.salaire_max ?? a.salaire_min ?? null
          const sb = b.salaire_max ?? b.salaire_min ?? null
          if (sa === null && sb === null) return 0
          if (sa === null) return 1
          if (sb === null) return -1
          return sb - sa
        })
      case 'offre_desc':
        return arr.sort((a, b) =>
          new Date(b.offre_created_at).getTime() - new Date(a.offre_created_at).getTime()
        )
      case 'entreprise':
        return arr.sort((a, b) =>
          (a.entreprise_nom ?? '').localeCompare(b.entreprise_nom ?? '', 'fr')
        )
      default: // fav_desc
        return arr.sort((a, b) => new Date(b.fav_created_at).getTime() - new Date(a.fav_created_at).getTime())
    }
  }, [offres, sortKey])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ backgroundColor: C.creme, minHeight: '100vh' }}>
      <style suppressHydrationWarning>{`
        @keyframes kapolia-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.42; } }
        @keyframes kapolia-spin  { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>

      {/* Contenu */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* En-tête */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{
            fontFamily: FONT_SERIF,
            fontSize: 'clamp(26px, 4vw, 36px)',
            color: C.dark, margin: '0 0 6px', lineHeight: 1.15,
          }}>
            Mes favoris
          </h1>
          <p style={{ fontSize: 14, color: C.grey, margin: 0, minHeight: 20 }}>
            {!loading && offres.length > 0 && `${offres.length} offre${offres.length !== 1 ? 's' : ''} sauvegardée${offres.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : offres.length === 0 ? (
          <EmptyFavoris onBrowse={() => router.push('/offres')} />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: C.grey, flexShrink: 0 }}>Trier par</span>
                <select
                  value={sortKey}
                  onChange={e => setSortKey(e.target.value as SortKey)}
                  style={{
                    fontSize: 12, color: C.dark,
                    border: `1px solid ${C.sable}`, borderRadius: 8,
                    padding: '5px 10px', backgroundColor: C.white,
                    cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
                  }}
                >
                  <option value="fav_desc">Ajout récent</option>
                  <option value="fav_asc">Ajout ancien</option>
                  <option value="salaire_desc">Salaire décroissant</option>
                  <option value="offre_desc">Publication récente</option>
                  <option value="entreprise">Par entreprise</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sorted.map(offre => (
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
          </>
        )}
      </div>
    </div>
  )
}
