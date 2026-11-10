'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FONT_SERIF } from '@/lib/typography'
import { OffreDetail, type OffreData, type OffreSimilaire } from '@/components/OffreDetail'
import { haversineKm } from '@/lib/geo'
import { useFavoris } from '@/lib/favoris-context'
import { scoreBreakdownCandidat, type ProfilMatch, type OffreMatch, type ScoreBreakdown } from '@/lib/matching'
import { C } from '@/lib/colors'
// ─── Palette ──────────────────────────────────────────────────────────────────

// ─── Types ────────────────────────────────────────────────────────────────────

type Offre = OffreData & {
  active?: boolean
  statut_publication?: string
  expire_at?: string | null
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: `3px solid ${C.sable}`, borderTopColor: C.terracotta,
        animation: 'kapolia-spin 0.8s linear infinite',
      }} />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OffreDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id     = params.id as string

  function retour() {
    if (window.history.length > 1) router.back()
    else router.replace('/offres')
  }

  const { favIds, toggleFav } = useFavoris()

  const [offre, setOffre]             = useState<Offre | null>(null)
  const [loading, setLoading]         = useState(true)
  const [notFound, setNotFound]       = useState(false)
  const [applied, setApplied]         = useState(false)
  const [appliedDate, setAppliedDate] = useState<string | null>(null)
  const [applying, setApplying]       = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [userId, setUserId]           = useState<string | null>(null)
  const [similaires, setSimilaires]       = useState<OffreSimilaire[]>([])
  const [similairesTitle, setSimilairesTitle] = useState('Offres similaires')
  const [score, setScore]                 = useState<number | null>(null)
  const [breakdown, setBreakdown]         = useState<ScoreBreakdown | null>(null)

  // Data load
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setIsConnected(!!user)
      setUserId(user?.id ?? null)

      const [offreRes, candRes] = await Promise.all([
        supabase.from('offres').select('*').eq('id', id).single(),
        user
          ? supabase.from('candidatures').select('id, created_at').eq('candidat_id', user.id).eq('offre_id', id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])

      const o = offreRes.data as Offre | null
      if (offreRes.error || !o || !o.active || o.statut_publication !== 'publiée' || !o.expire_at || new Date(o.expire_at) <= new Date()) {
        setNotFound(true)
        setLoading(false)
        return
      }

      // ── Deux fetches parallèles : profil entreprise + profil candidat ────────
      const [epRes, profilRes] = await Promise.all([
        o.recruteur_id
          ? supabase.from('profils_vue_publique').select('entreprise_nom, entreprise_logo_url').eq('user_id', o.recruteur_id).single()
          : Promise.resolve({ data: null }),
        user
          ? supabase.from('profils').select('domaine, experience, type_poste, valeur, ville, mode_travail, langues, competences_acquises').eq('user_id', user.id).single()
          : Promise.resolve({ data: null }),
      ])
      if (epRes.data) {
        o.entreprise_nom = epRes.data.entreprise_nom
        if (epRes.data.entreprise_logo_url) o.entreprise_logo_url = epRes.data.entreprise_logo_url
      }
      if (profilRes.data) {
        const offreMatch: OffreMatch = {
          domaine: o.domaine, experience: o.experience, type_contrat: o.type_contrat,
          valeurs: o.valeurs, ville: o.ville,
          mode_travail: o.mode_travail,
          langues: (o as { langues?: string[] }).langues,
          competences: (o as { competences?: string[] }).competences,
          competences_bonus: (o as { competences_bonus?: string[] }).competences_bonus,
        }
        const bd = scoreBreakdownCandidat(profilRes.data as ProfilMatch, offreMatch)
        setScore(bd.total)
        setBreakdown(bd)
      }

      setOffre(o)
      setApplied(!!candRes.data)
      setAppliedDate((candRes.data as { created_at?: string } | null)?.created_at ?? null)
      setLoading(false)

      // Fetch similaires (non-blocking, after main render)
      type SimRaw = { id: string; titre: string; type_contrat?: string; domaine?: string; experience?: string; ville?: string; salaire_min?: number; salaire_max?: number; periode_salaire?: string; mode_travail?: string; latitude?: number; longitude?: number; created_at: string }
      const SIM_FIELDS = 'id,titre,type_contrat,domaine,experience,ville,salaire_min,salaire_max,periode_salaire,mode_travail,latitude,longitude,created_at'

      function simMid(min?: number, max?: number) {
        if (min && max) return (min + max) / 2
        return min ?? max ?? 0
      }

      function scoreSecondary(ref: Offre, cand: SimRaw): number {
        let s = 0
        if (ref.experience && cand.experience) {
          const EXP = ['Sans expérience', '1-2 ans', '3-5 ans', '5-10 ans', '+10 ans']
          const ri = EXP.indexOf(ref.experience), ci = EXP.indexOf(cand.experience)
          if (ri !== -1 && ci !== -1) {
            const d = Math.abs(ri - ci)
            if (d === 0) s += 2
            else if (d === 1) s += 1
          }
        }
        if (ref.type_contrat && cand.type_contrat === ref.type_contrat) s += 2
        const refMid = simMid(ref.salaire_min, ref.salaire_max)
        const candMid = simMid(cand.salaire_min, cand.salaire_max)
        if (refMid > 0 && candMid > 0 && Math.abs(refMid - candMid) / refMid <= 0.3) s += 1
        return s
      }

      function toSim(s: SimRaw): OffreSimilaire {
        return { id: s.id, titre: s.titre, type_contrat: s.type_contrat, domaine: s.domaine, ville: s.ville, salaire_min: s.salaire_min, salaire_max: s.salaire_max, periode_salaire: s.periode_salaire, mode_travail: s.mode_travail }
      }

      // Phase 1: same domain
      if (o.domaine) {
        const { data: domainRaw } = await supabase
          .from('offres').select(SIM_FIELDS)
          .eq('active', true).eq('statut_publication', 'publiée').gt('expire_at', new Date().toISOString())
          .neq('id', id).eq('domaine', o.domaine).limit(20)

        const pool = (domainRaw ?? []) as SimRaw[]
        if (pool.length >= 2) {
          const scored = pool.map(s => ({ s, score: scoreSecondary(o, s) }))
            .sort((a, b) => b.score - a.score || new Date(b.s.created_at).getTime() - new Date(a.s.created_at).getTime())
          const withExtra = scored.filter(({ score }) => score >= 1)
          if (withExtra.length >= 2) {
            setSimilaires(withExtra.slice(0, 4).map(({ s }) => toSim(s)))
            setSimilairesTitle('Offres similaires')
          } else {
            setSimilaires(scored.slice(0, 4).map(({ s }) => toSim(s)))
            setSimilairesTitle(`Autres offres en ${o.domaine}`)
          }
          return
        }
      }

      // Phase 2: zone fallback
      const oLat = o.latitude, oLng = o.longitude
      if (oLat != null && oLng != null) {
        const { data: zoneRaw } = await supabase
          .from('offres').select(SIM_FIELDS)
          .eq('active', true).eq('statut_publication', 'publiée').gt('expire_at', new Date().toISOString())
          .neq('id', id).limit(30)

        const nearby = ((zoneRaw ?? []) as SimRaw[]).filter(s =>
          s.latitude != null && s.longitude != null &&
          haversineKm({ lat: oLat, lng: oLng }, { lat: s.latitude, lng: s.longitude }) < 50
        )
        if (nearby.length >= 2) {
          setSimilaires(nearby.slice(0, 4).map(toSim))
          setSimilairesTitle(o.ville ? `Autres offres près de ${o.ville}` : 'Autres offres à proximité')
        }
      }
    }
    load()
  }, [id])

  async function handleApply() {
    if (!isConnected) {
      const existingNext = new URLSearchParams(window.location.search).get('next')
      const next = existingNext ?? `/offres/${id}`
      router.push(`/connexion?next=${encodeURIComponent(next)}`)
      return
    }
    if (applied || applying || !userId) return
    setApplying(true)
    const { error } = await supabase.from('candidatures').insert({
      candidat_id: userId,
      offre_id:    id,
      statut:      'envoyée',
    })
    if (!error) { setApplied(true); setAppliedDate(new Date().toISOString()) }
    setApplying(false)
  }


  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ backgroundColor: C.bg, minHeight: '100vh' }}>
        <style suppressHydrationWarning>{`@keyframes kapolia-spin { to { transform: rotate(360deg); } }`}</style>
        <Spinner />
      </div>
    )
  }

  // ── Not found ────────────────────────────────────────────────────────────

  if (notFound || !offre) {
    return (
      <div style={{
        backgroundColor: C.bg, minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <h1 style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 26, color: C.dark, margin: '0 0 10px', fontWeight: 600 }}>
            Offre indisponible
          </h1>
          <p style={{ fontSize: 14, color: C.grey, margin: '0 0 28px', lineHeight: 1.65 }}>
            Cette offre n'existe plus ou a été retirée.
          </p>
          <button
            onClick={() => router.push('/offres')}
            style={{
              backgroundColor: C.terracotta, color: C.white, border: 'none',
              borderRadius: 12, padding: '12px 28px', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Voir toutes les offres
          </button>
        </div>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ backgroundColor: C.bg, minHeight: '100vh' }}>
      <style suppressHydrationWarning>{`
        @keyframes kapolia-spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>
      <OffreDetail
        offre={offre}
        applied={applied}
        appliedDate={appliedDate}
        applying={applying}
        saved={favIds.has(id)}
        isConnected={isConnected}
        similaires={similaires}
        similairesTitle={similairesTitle}
        onApply={handleApply}
        onToggleSave={() => toggleFav(id)}
        onSelectSimilaire={simId => router.push(`/offres/${simId}`)}
        mode="page"
        score={score}
        breakdown={breakdown}
        onBack={retour}
      />
    </div>
  )
}
