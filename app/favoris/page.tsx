'use client'

import { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FONT_SERIF } from '@/lib/typography'
import { useFavoris } from '@/lib/favoris-context'
import { OffreCard, type OffreCardData } from '@/components/OffreCard'
import { OffreDetail, type OffreData, type OffreSimilaire } from '@/components/OffreDetail'
import { Bandeau, type BandeauHandle } from '@/components/Bandeau'
import { fetchProfilsEntreprise } from '@/lib/enrichir-entreprise'
import { scoreBreakdownCandidat, competencesManquantesCandidat, scoreSiCompetencesAjoutees, type ProfilMatch, type OffreMatch } from '@/lib/matching'
import { C as _C, CARD_SHADOW, CARD_RADIUS } from '@/lib/colors'
import { largeurUtile } from '@/lib/largeur-utile'
import { EASE, reduitMouvement, fondurPanneau, entrerPanneau, animerCartes } from '@/lib/motion'
import { useRoulette } from '@/hooks/useRoulette'
import { useNavigationClavier } from '@/hooks/useNavigationClavier'
import { TriSelect } from '@/components/TriSelect'

const C = { ..._C, lightGrey: '#D0D0D0' as const }

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = 'match' | 'fav_desc' | 'salaire_desc' | 'offre_desc'

type FavOffre = OffreCardData & {
  expire_at:        string | null
  fav_created_at:   string
  offre_created_at: string
  ouvert:           boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ajoutLabel(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d === 0) return "Ajouté aujourd'hui"
  if (d === 1) return 'Ajouté il y a 1 jour'
  return `Ajouté il y a ${d} jours`
}

function computeExpirePastille(expireAt: string | null): string | null {
  if (!expireAt) return null
  const d = Math.floor((new Date(expireAt).getTime() - Date.now()) / 86400000)
  if (d < 0) return null
  if (d === 0) return "Expire aujourd'hui"
  if (d === 1) return 'Expire demain'
  return `Expire dans ${d} jours`
}

function computeExpireLabel(expireAt: string | null): string | null {
  if (!expireAt) return null
  const d = new Date(expireAt)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  const opts: Intl.DateTimeFormatOptions = d.getFullYear() === now.getFullYear()
    ? { day: 'numeric', month: 'long' }
    : { day: 'numeric', month: 'long', year: 'numeric' }
  return 'Expire le ' + d.toLocaleDateString('fr-FR', opts)
}

function expiresThisWeek(o: FavOffre): boolean {
  if (!o.expire_at) return false
  const ms = new Date(o.expire_at).getTime() - Date.now()
  return ms > 0 && ms <= 7 * 86400000
}

type RawO = {
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
}

function isOuvert(o: RawO): boolean {
  return o.active === true &&
    o.statut_publication === 'publiée' &&
    !!o.expire_at &&
    new Date(o.expire_at) > new Date()
}

function computeBandeauText(favOffre: FavOffre | null): string {
  if (favOffre?.expire_at && new Date(favOffre.expire_at) < new Date()) {
    const dateStr = new Date(favOffre.expire_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
    return `Cette offre a expiré le ${dateStr}. Il n\'est plus possible d\'y postuler.`
  }
  return "Cette offre n'est plus publiée. Il n'est plus possible d'y postuler."
}

const SORT_LABELS_GROUP: Record<SortKey, string> = {
  match:        'par correspondance',
  fav_desc:     'par ajout récent',
  salaire_desc: 'par salaire décroissant',
  offre_desc:   'par date de publication',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      backgroundColor: C.white, borderRadius: CARD_RADIUS,
      padding: '14px 16px 12px 13px',
      borderLeft: `3px solid transparent`, boxShadow: CARD_SHADOW,
    }}>
      {([['72%', 16], ['48%', 12], ['90%', 11], ['40%', 11]] as [string, number][]).map(([w, h], i) => (
        <div key={i} style={{
          height: h, width: w, borderRadius: 6, backgroundColor: C.sable,
          marginBottom: i === 1 ? 10 : 7,
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
        width: 64, height: 64, borderRadius: '50%',
        backgroundColor: C.white, boxShadow: CARD_SHADOW,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
          stroke={C.orange} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </div>
      <h2 style={{
        fontFamily: FONT_SERIF, letterSpacing: '-0.005em',
        fontSize: 22, fontWeight: 600, color: C.dark,
        margin: '0 0 8px',
      }}>
        Aucune offre sauvegardée pour l&apos;instant
      </h2>
      <p style={{
        fontSize: 14.5, color: C.grey, margin: '0 0 24px',
        maxWidth: 380, lineHeight: 1.6,
      }}>
        Ajoutez une offre à vos favoris avec l&apos;étoile pour la comparer et y revenir plus tard.
      </p>
      <button
        onClick={onBrowse}
        style={{
          padding: '12px 28px', borderRadius: 10, border: 'none',
          backgroundColor: C.orange, color: C.white,
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
  const router                              = useRouter()
  const { removeFav, reinsertFav }          = useFavoris()
  const [offres, setOffres]                 = useState<FavOffre[]>([])
  const [applied, setApplied]              = useState<Map<string, string>>(new Map())
  const [isConnected, setIsConnected]      = useState(false)
  const [userId, setUserId]                = useState<string | null>(null)
  const [loading, setLoading]              = useState(true)
  const [isSplit, setIsSplit]              = useState(false)
  const [sortKey, setSortKey]              = useState<SortKey>('match')
  const [selectedId, setSelectedId]        = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<OffreData | null>(null)
  const [panelApplying, setPanelApplying]  = useState(false)
  const [offresProches, setOffresProches]  = useState<OffreSimilaire[]>([])
  const [profilState, setProfilState]      = useState<ProfilMatch | null>(null)
  const [bandeauMsg, setBandeauMsg]        = useState<string | null>(null)
  const [bandeauType, setBandeauType]      = useState<'undo' | 'apply' | 'info'>('info')
  const [bandeauUndo, setBandeauUndo]      = useState<FavOffre | null>(null)
  const [applyingCardId, setApplyingCardId]     = useState<string | null>(null)
  const [appliedOverlayId, setAppliedOverlayId] = useState<string | null>(null)
  const [pendingApply, setPendingApply]         = useState<Set<string>>(new Set())
  const [removingIds, setRemovingIds]           = useState<Set<string>>(new Set())

  const detailPanelRef        = useRef<HTMLDivElement>(null)
  const offresRef             = useRef<FavOffre[]>([])
  const profilRef             = useRef<ProfilMatch | null>(null)
  const bandeauTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const removeFavPromiseRef   = useRef<Promise<void> | null>(null)
  const bandeauUndoIndexRef   = useRef<number>(-1)
  const leftColRef            = useRef<HTMLDivElement>(null)
  const cardRefsMap           = useRef<Map<string, HTMLElement>>(new Map())
  const prevPositionsRef      = useRef<Map<string, DOMRect>>(new Map())
  const displayedRef          = useRef<{ id: string }[]>([])
  const selectedIdRef         = useRef<string | null>(null)
  const skipNextFlipRef       = useRef(false)
  const restoreCardIdRef      = useRef<string | null>(null)
  const skeletonTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const groupTitleExpiringRef = useRef<HTMLDivElement | null>(null)
  const groupTitleOthersRef   = useRef<HTMLDivElement | null>(null)
  const groupTitleExpireesRef = useRef<HTMLDivElement | null>(null)
  const bandeauRef            = useRef<BandeauHandle>(null)

  // ── isSplit ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsSplit(largeurUtile() >= 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => () => {
    if (bandeauTimerRef.current)  clearTimeout(bandeauTimerRef.current)
    if (skeletonTimerRef.current) clearTimeout(skeletonTimerRef.current)
  }, [])

  // ── Data load ────────────────────────────────────────────────────────────
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
          .select('domaine, experience, type_poste, valeur, disponibilite, ville, mode_travail, langues, competences_acquises')
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('candidatures')
          .select('offre_id, created_at')
          .eq('candidat_id', user.id),
      ])

      if (favsRes.error) { console.error('[favoris]', favsRes.error); setLoading(false); return }

      type RawRow = { created_at: string; offres: RawO | null }
      const rows = (favsRes.data as unknown as RawRow[]) ?? []

      const list: FavOffre[] = rows
        .filter(r => r.offres !== null)
        .map(r => {
          const o = r.offres!
          return {
            id:               o.id,
            titre:            o.titre,
            recruteur_id:     o.recruteur_id    ?? undefined,
            type_contrat:     o.type_contrat    ?? undefined,
            ville:            o.ville           ?? undefined,
            mode_travail:     o.mode_travail    ?? undefined,
            salaire_min:      o.salaire_min  != null ? parseFloat(o.salaire_min)  : undefined,
            salaire_max:      o.salaire_max  != null ? parseFloat(o.salaire_max)  : undefined,
            periode_salaire:  o.periode_salaire ?? undefined,
            created_at:       o.created_at,
            expire_at:        o.expire_at,
            fav_created_at:   r.created_at,
            offre_created_at: o.created_at,
            ouvert:           isOuvert(o),
          }
        })

      const recruteurIds = [...new Set(list.map(o => o.recruteur_id).filter(Boolean))] as string[]
      const { map, error: profErr } = await fetchProfilsEntreprise(recruteurIds)
      if (profErr) console.error('[favoris profils]', profErr)

      const scoringData = new Map<string, OffreMatch>()
      for (const r of rows) {
        const o = r.offres
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
      profilRef.current = profil
      setProfilState(profil)

      const enriched = list.map(o => {
        const ep   = o.recruteur_id ? map[o.recruteur_id] : undefined
        const base = {
          ...o,
          entreprise_nom:      ep?.entreprise_nom      ?? undefined,
          entreprise_logo_url: ep?.entreprise_logo_url ?? undefined,
        }
        if (!profil) return base
        const om = scoringData.get(o.id)
        if (!om) return base
        const bd = scoreBreakdownCandidat(profil, om)
        return { ...base, score: bd.total, breakdown: bd }
      })

      offresRef.current = enriched
      setOffres(enriched)
      setApplied(new Map(
        ((candidaturesRes.data ?? []) as { offre_id: string; created_at: string }[])
          .map(c => [c.offre_id, c.created_at])
      ))
      setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => { offresRef.current = offres }, [offres])

  // ── Lazy-fetch detail ────────────────────────────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!selectedId) { setSelectedDetail(null); return }
    let cancelled = false
    supabase.from('offres').select('*').eq('id', selectedId).single().then(({ data }) => {
      if (cancelled || !data) return
      if (skeletonTimerRef.current) { clearTimeout(skeletonTimerRef.current); skeletonTimerRef.current = null }
      const existing = offresRef.current.find(o => o.id === selectedId)
      setSelectedDetail({
        ...data,
        salaire_min:         data.salaire_min  != null ? parseFloat(String(data.salaire_min))  : undefined,
        salaire_max:         data.salaire_max  != null ? parseFloat(String(data.salaire_max))  : undefined,
        entreprise_nom:      existing?.entreprise_nom,
        entreprise_logo_url: existing?.entreprise_logo_url,
      } as OffreData)
    })
    return () => { cancelled = true }
  }, [selectedId])

  // ── Offres proches (offre fermée seulement) ──────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!selectedDetail) { setOffresProches([]); return }
    const selFavOffre = offresRef.current.find(o => o.id === selectedDetail.id)
    if (!selFavOffre || selFavOffre.ouvert) {
      setOffresProches([]); return
    }

    let cancelled = false

    type RawOffreProche = {
      id: string; titre: string
      type_contrat: string | null; domaine: string | null; ville: string | null
      salaire_min: string | null; salaire_max: string | null; periode_salaire: string | null
      mode_travail: string | null; recruteur_id: string | null
      competences: string[] | null; competences_bonus: string[] | null
      valeurs: string[] | null; langues: string[] | null; experience: string | null
    }

    async function fetchProches() {
      const domaine = selectedDetail!.domaine
      const ville   = selectedDetail!.ville

      const orParts: string[] = []
      if (domaine) orParts.push(`domaine.eq."${domaine.replace(/"/g, '\\"')}"`)
      if (ville)   orParts.push(`ville.eq."${ville.replace(/"/g, '\\"')}"`)
      if (orParts.length === 0) return

      const { data } = await supabase
        .from('offres')
        .select('id, titre, type_contrat, domaine, ville, salaire_min, salaire_max, periode_salaire, mode_travail, recruteur_id, competences, competences_bonus, valeurs, langues, experience')
        .eq('active', true)
        .eq('statut_publication', 'publiée')
        .gt('expire_at', new Date().toISOString())
        .neq('id', selectedDetail!.id)
        .or(orParts.join(','))
        .limit(20)

      if (cancelled || !data) return

      const favIdSet = new Set(offresRef.current.map(o => o.id))
      const candidates = (data as unknown as RawOffreProche[]).filter(o => !favIdSet.has(o.id))

      const profil = profilRef.current
      const scored = candidates.map(o => {
        if (!profil) return { o, score: 0 }
        const bd = scoreBreakdownCandidat(profil, {
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
        return { o, score: bd.total }
      })

      const domaineGroup = domaine ? scored.filter(x => x.o.domaine === domaine) : []
      const villeGroup   = ville   ? scored.filter(x => x.o.domaine !== domaine && x.o.ville === ville) : []
      domaineGroup.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      villeGroup.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

      const result = [...domaineGroup, ...villeGroup].slice(0, 2)
      if (!cancelled) {
        setOffresProches(result.map(x => ({
          id:              x.o.id,
          titre:           x.o.titre,
          type_contrat:    x.o.type_contrat    ?? undefined,
          domaine:         x.o.domaine         ?? undefined,
          ville:           x.o.ville           ?? undefined,
          salaire_min:     x.o.salaire_min  != null ? parseFloat(String(x.o.salaire_min))  : undefined,
          salaire_max:     x.o.salaire_max  != null ? parseFloat(String(x.o.salaire_max))  : undefined,
          periode_salaire: x.o.periode_salaire ?? undefined,
          mode_travail:    x.o.mode_travail    ?? undefined,
        })))
      }
    }

    fetchProches()
    return () => { cancelled = true }
  }, [selectedDetail])

  // ── Derived lists ─────────────────────────────────────────────────────────
  const ouvertes = useMemo(() => offres.filter(o => o.ouvert),  [offres])
  const fermees  = useMemo(() => offres.filter(o => !o.ouvert), [offres])

  // Offres ouvertes sans candidature envoyée (sauf si encore en animation)
  const visibleOuverts = useMemo(
    () => ouvertes.filter(o => !applied.has(o.id) || pendingApply.has(o.id)),
    [ouvertes, applied, pendingApply]
  )
  // Offres fermées sans candidature envoyée
  const expirees = useMemo(
    () => fermees.filter(o => !applied.has(o.id)),
    [fermees, applied]
  )

  const etudierSorted = useMemo(() => {
    const arr = [...visibleOuverts]
    switch (sortKey) {
      case 'match':
        return arr.sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
      case 'fav_desc':
        return arr.sort((a, b) => new Date(b.fav_created_at).getTime() - new Date(a.fav_created_at).getTime())
      case 'salaire_desc':
        return arr.sort((a, b) => {
          const sa = a.salaire_max ?? a.salaire_min ?? null
          const sb = b.salaire_max ?? b.salaire_min ?? null
          if (sa === null && sb === null) return 0
          return sa === null ? 1 : sb === null ? -1 : sb - sa
        })
      case 'offre_desc':
        return arr.sort((a, b) => new Date(b.offre_created_at).getTime() - new Date(a.offre_created_at).getTime())
    }
  }, [visibleOuverts, sortKey])

  const { currentList, etudierExpiring, etudierOthers, expireesSorted } = useMemo(() => {
    const expiring = [...etudierSorted.filter(expiresThisWeek)].sort(
      (a, b) => new Date(a.expire_at!).getTime() - new Date(b.expire_at!).getTime()
    )
    const others = etudierSorted.filter(o => !expiresThisWeek(o))
    const expSorted = [...expirees].sort(
      (a, b) => new Date(b.fav_created_at).getTime() - new Date(a.fav_created_at).getTime()
    )
    return {
      currentList:      [...expiring, ...others, ...expSorted],
      etudierExpiring:  expiring,
      etudierOthers:    others,
      expireesSorted:   expSorted,
    }
  }, [etudierSorted, expirees])

  const subtitle = useMemo(() => {
    if (loading) return ''
    const nOuverts = etudierSorted.length
    const nExpires = expirees.length
    if (nOuverts === 0 && nExpires === 0) return ''
    if (nOuverts === 0) {
      return `${nExpires} offre${nExpires !== 1 ? 's' : ''} expirée${nExpires !== 1 ? 's' : ''}`
    }
    const nExpiring = etudierSorted.filter(expiresThisWeek).length
    const base = `${nOuverts} offre${nOuverts !== 1 ? 's' : ''} à étudier`
    const withExpiring = nExpiring > 0
      ? `${base}, dont ${nExpiring} qui expire${nExpiring !== 1 ? 'nt' : ''} cette semaine`
      : base
    if (nExpires === 0) return withExpiring
    return `${withExpiring}, ${nExpires} offre${nExpires !== 1 ? 's' : ''} expirée${nExpires !== 1 ? 's' : ''}`
  }, [loading, etudierSorted, expirees])

  // ── Auto-select première offre ────────────────────────────────────────────
  useEffect(() => {
    if (loading || !isSplit || selectedId !== null) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (currentList.length > 0) setSelectedId(currentList[0].id)
  }, [loading, isSplit, selectedId, currentList])

  // ── Scroll selected into view ────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId || !isSplit) return
    const el = document.getElementById(`fav-card-${selectedId}`)
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId, isSplit])

  // ── Sync refs pour hooks de navigation ───────────────────────────────────
  useEffect(() => { displayedRef.current  = currentList }, [currentList])
  useEffect(() => { selectedIdRef.current = selectedId  }, [selectedId])

  // ── Cascade + FLIP quand la liste change ─────────────────────────────────
  useLayoutEffect(() => {
    if (!isSplit || !leftColRef.current) return
    const cards = leftColRef.current.querySelectorAll<HTMLElement>('[data-card-id]')

    if (skipNextFlipRef.current) {
      skipNextFlipRef.current = false
      const id = restoreCardIdRef.current
      if (id) {
        restoreCardIdRef.current = null
        const newPos = new Map<string, DOMRect>()
        Array.from(cards).forEach(c => { newPos.set(c.dataset.cardId!, c.getBoundingClientRect()) })
        prevPositionsRef.current = newPos

        const el = cardRefsMap.current.get(id)
        if (el && !reduitMouvement()) {
          const h = el.scrollHeight
          el.style.overflow = 'hidden'
          el.style.height = '0px'
          requestAnimationFrame(() => {
            el.animate(
              [{ height: '0px', opacity: '0' }, { height: h + 'px', opacity: '0' }],
              { duration: 260, easing: EASE }
            ).onfinish = () => {
              el.style.height = ''
              el.style.overflow = ''
              el.animate(
                [{ opacity: '0', transform: 'scale(0.97)' }, { opacity: '1', transform: 'scale(1)' }],
                { duration: 220, easing: EASE }
              )
            }
          })
        }
      }
      return
    }

    prevPositionsRef.current = animerCartes(cards, prevPositionsRef.current)
  }, [currentList, isSplit])

  // ── Animation d'entrée du panneau ────────────────────────────────────────
  useLayoutEffect(() => {
    const el = detailPanelRef.current
    if (!el || !selectedDetail || selectedDetail.id !== selectedId) return
    if (!reduitMouvement()) entrerPanneau(el)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDetail])

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleCardSelect(id: string) {
    if (id === selectedId) return
    if (skeletonTimerRef.current) { clearTimeout(skeletonTimerRef.current); skeletonTimerRef.current = null }
    if (!reduitMouvement() && detailPanelRef.current) {
      fondurPanneau(detailPanelRef.current, () => {
        setSelectedId(id)
        skeletonTimerRef.current = setTimeout(() => { skeletonTimerRef.current = null; setSelectedDetail(null) }, 300)
      })
    } else {
      setSelectedDetail(null)
      setSelectedId(id)
    }
  }

  function showApplyBandeau() {
    if (bandeauTimerRef.current) clearTimeout(bandeauTimerRef.current)
    setBandeauUndo(null)
    setBandeauType('apply')
    setBandeauMsg('Candidature envoyée')
    bandeauTimerRef.current = setTimeout(() => {
      if (bandeauRef.current) {
        bandeauRef.current.animateOut(() => setBandeauMsg(null))
      } else {
        setBandeauMsg(null)
      }
    }, 5000)
  }

  function handleToggleSave(offreId: string) {
    const removedIndex = offres.findIndex(o => o.id === offreId)
    const removedOffre = removedIndex >= 0 ? offres[removedIndex] : null

    if (isSplit && selectedId === offreId) {
      const idx = currentList.findIndex(o => o.id === offreId)
      setSelectedId(currentList[idx + 1]?.id ?? currentList[idx - 1]?.id ?? null)
    }

    if (bandeauTimerRef.current) clearTimeout(bandeauTimerRef.current)

    function commitRemoval() {
      setOffres(prev => prev.filter(o => o.id !== offreId))
      removeFavPromiseRef.current = removeFav(offreId)
      bandeauUndoIndexRef.current = removedIndex
      setBandeauType('undo')
      setBandeauMsg('Offre retirée de vos favoris')
      setBandeauUndo(removedOffre)
      bandeauTimerRef.current = setTimeout(() => {
        if (bandeauRef.current) {
          bandeauRef.current.animateOut(() => { setBandeauMsg(null); setBandeauUndo(null) })
        } else {
          setBandeauMsg(null); setBandeauUndo(null)
        }
      }, 5000)
    }

    if (isSplit && !reduitMouvement()) {
      const wrapper = cardRefsMap.current.get(offreId)
      if (wrapper) {
        const inExpiring = etudierExpiring.some(o => o.id === offreId)
        const inOthers   = !inExpiring && etudierOthers.some(o => o.id === offreId)
        const inExpirees = !inExpiring && !inOthers && expireesSorted.some(o => o.id === offreId)
        const showOthersTitle = etudierOthers.length > 0 && (etudierExpiring.length > 0 || expireesSorted.length > 0)
        const groupTitleEl =
          inExpiring && etudierExpiring.length === 1 ? groupTitleExpiringRef.current :
          inOthers   && etudierOthers.length   === 1 && showOthersTitle ? groupTitleOthersRef.current :
          inExpirees && expireesSorted.length  === 1 ? groupTitleExpireesRef.current :
          null

        setRemovingIds(prev => new Set([...prev, offreId]))
        setTimeout(() => {
          if (groupTitleEl) {
            groupTitleEl.animate([{ opacity: '1' }, { opacity: '0' }], { duration: 160, easing: 'ease-in', fill: 'forwards' })
            setTimeout(() => {
              const th = groupTitleEl.offsetHeight
              groupTitleEl.animate([{ height: th + 'px' }, { height: '0px' }], { duration: 260, easing: EASE, fill: 'forwards' })
            }, 160)
          }
          const h = wrapper.getBoundingClientRect().height
          wrapper.animate(
            [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.97)' }],
            { duration: 160, easing: 'ease-in', fill: 'forwards' }
          )
          const collapseAnim = wrapper.animate(
            [{ height: h + 'px', marginBottom: '0px' }, { height: '0px', marginBottom: '-8px' }],
            { duration: 260, easing: EASE, delay: 80, fill: 'forwards' }
          )
          collapseAnim.onfinish = () => {
            const snap = new Map<string, DOMRect>()
            cardRefsMap.current.forEach((el, id) => { if (el.isConnected && id !== offreId) snap.set(id, el.getBoundingClientRect()) })
            prevPositionsRef.current = snap
            setRemovingIds(prev => { const s = new Set(prev); s.delete(offreId); return s })
            if (groupTitleEl) setTimeout(commitRemoval, 80)
            else commitRemoval()
          }
        }, 260)
        return
      }
    }
    commitRemoval()
  }

  async function handleAnnuler() {
    if (bandeauTimerRef.current) clearTimeout(bandeauTimerRef.current)
    const toRestore = bandeauUndo
    const idx = bandeauUndoIndexRef.current

    await new Promise<void>(resolve => {
      if (bandeauRef.current) bandeauRef.current.animateOut(resolve)
      else resolve()
    })

    setBandeauMsg(null)
    setBandeauUndo(null)
    if (!toRestore) return

    if (removeFavPromiseRef.current) await removeFavPromiseRef.current
    removeFavPromiseRef.current = null

    if (isSplit && !reduitMouvement()) {
      skipNextFlipRef.current = true
      restoreCardIdRef.current = toRestore.id
    }
    setOffres(prev => {
      const next = [...prev]
      next.splice(Math.min(Math.max(0, idx), next.length), 0, toRestore)
      return next
    })
    const ok = await reinsertFav(toRestore.id, toRestore.fav_created_at, toRestore.ouvert)
    if (!ok) {
      setOffres(prev => prev.filter(o => o.id !== toRestore.id))
      setBandeauType('info')
      setBandeauMsg("Impossible d'annuler. Ajoutez de nouveau l'offre depuis la page Offres.")
      bandeauTimerRef.current = setTimeout(() => setBandeauMsg(null), 5000)
    }
  }

  async function doApply(offreId: string): Promise<boolean> {
    if (!userId) return false
    const { error } = await supabase.from('candidatures').insert({
      candidat_id: userId, offre_id: offreId, statut: 'envoyée',
    })
    if (error) return false
    setApplied(prev => new Map([...prev, [offreId, new Date().toISOString()]]))
    return true
  }

  function collapseCardThenSelect(offreId: string, nextId: string | null, groupTitleEl?: HTMLElement | null, onDone?: () => void) {
    const wrapper = cardRefsMap.current.get(offreId)
    if (wrapper) {
      if (groupTitleEl) {
        groupTitleEl.animate([{ opacity: '1' }, { opacity: '0' }], { duration: 160, easing: 'ease-in', fill: 'forwards' })
        setTimeout(() => {
          const th = groupTitleEl.offsetHeight
          groupTitleEl.animate([{ height: th + 'px' }, { height: '0px' }], { duration: 260, easing: EASE, fill: 'forwards' })
        }, 160)
      }
      const h = wrapper.getBoundingClientRect().height
      wrapper.animate(
        [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.97)' }],
        { duration: 160, easing: 'ease-in', fill: 'forwards' }
      )
      const collapseAnim = wrapper.animate(
        [{ height: h + 'px', marginBottom: '0px' }, { height: '0px', marginBottom: '-8px' }],
        { duration: 260, easing: EASE, delay: 80, fill: 'forwards' }
      )
      collapseAnim.onfinish = () => {
        const snap = new Map<string, DOMRect>()
        cardRefsMap.current.forEach((el, id) => { if (el.isConnected && id !== offreId) snap.set(id, el.getBoundingClientRect()) })
        prevPositionsRef.current = snap
        const doCommit = () => {
          setPendingApply(prev => { const s = new Set(prev); s.delete(offreId); return s })
          setSelectedDetail(null)
          if (detailPanelRef.current) {
            fondurPanneau(detailPanelRef.current, () => { setSelectedId(nextId); onDone?.() })
          } else {
            setSelectedId(nextId)
            onDone?.()
          }
        }
        if (groupTitleEl) setTimeout(doCommit, 80)
        else doCommit()
      }
    } else {
      setPendingApply(prev => { const s = new Set(prev); s.delete(offreId); return s })
      setSelectedDetail(null)
      setSelectedId(nextId)
      onDone?.()
    }
  }

  async function handleCardApply(offreId: string) {
    const idx    = currentList.findIndex(o => o.id === offreId)
    const nextId = currentList[idx + 1]?.id ?? currentList[idx - 1]?.id ?? null
    setPendingApply(prev => new Set([...prev, offreId]))
    setApplyingCardId(offreId)
    const ok = await doApply(offreId)
    setApplyingCardId(null)
    if (!ok) {
      setPendingApply(prev => { const s = new Set(prev); s.delete(offreId); return s })
      return
    }
    if (isSplit && !reduitMouvement()) {
      setAppliedOverlayId(offreId)
      const inExpiring = etudierExpiring.some(o => o.id === offreId)
      const inOthers   = !inExpiring && etudierOthers.some(o => o.id === offreId)
      const showOthersTitle = etudierOthers.length > 0 && (etudierExpiring.length > 0 || expireesSorted.length > 0)
      const groupTitleEl = inExpiring && etudierExpiring.length === 1 ? groupTitleExpiringRef.current :
                           inOthers   && etudierOthers.length   === 1 && showOthersTitle ? groupTitleOthersRef.current :
                           null
      setTimeout(() => {
        setAppliedOverlayId(null)
        collapseCardThenSelect(offreId, nextId, groupTitleEl, showApplyBandeau)
      }, 1100)
    } else {
      setPendingApply(prev => { const s = new Set(prev); s.delete(offreId); return s })
      setSelectedId(nextId)
      showApplyBandeau()
    }
  }

  async function handlePanelApply() {
    if (!selectedId) return
    const offreId = selectedId
    const idx    = currentList.findIndex(o => o.id === offreId)
    const nextId = currentList[idx + 1]?.id ?? currentList[idx - 1]?.id ?? null
    setPendingApply(prev => new Set([...prev, offreId]))
    setPanelApplying(true)
    const ok = await doApply(offreId)
    setPanelApplying(false)
    if (!ok) {
      setPendingApply(prev => { const s = new Set(prev); s.delete(offreId); return s })
      return
    }
    if (isSplit && !reduitMouvement()) {
      setAppliedOverlayId(offreId)
      const inExpiring = etudierExpiring.some(o => o.id === offreId)
      const inOthers   = !inExpiring && etudierOthers.some(o => o.id === offreId)
      const showOthersTitle = etudierOthers.length > 0 && (etudierExpiring.length > 0 || expireesSorted.length > 0)
      const groupTitleEl = inExpiring && etudierExpiring.length === 1 ? groupTitleExpiringRef.current :
                           inOthers   && etudierOthers.length   === 1 && showOthersTitle ? groupTitleOthersRef.current :
                           null
      setTimeout(() => {
        setAppliedOverlayId(null)
        collapseCardThenSelect(offreId, nextId, groupTitleEl, showApplyBandeau)
      }, 1100)
    } else {
      setPendingApply(prev => { const s = new Set(prev); s.delete(offreId); return s })
      setSelectedId(nextId)
      showApplyBandeau()
    }
  }

  // ── Motion hooks ──────────────────────────────────────────────────────────
  const scheduleRoulette = useRoulette(leftColRef, cardRefsMap, isSplit)
  useNavigationClavier(displayedRef, selectedIdRef, handleCardSelect, cardRefsMap, leftColRef, isSplit)

  // ── List renderer ─────────────────────────────────────────────────────────
  function renderList(compact: boolean) {
    if (!loading && currentList.length === 0) return null

    function card(offre: FavOffre) {
      return (
        <div
          key={offre.id}
          id={`fav-card-${offre.id}`}
          data-card-id={offre.id}
          tabIndex={-1}
          className="kapolia-card-wrapper"
          ref={el => { if (el) cardRefsMap.current.set(offre.id, el); else cardRefsMap.current.delete(offre.id) }}
          style={{ position: 'relative' }}
        >
          {applyingCardId === offre.id && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: CARD_RADIUS,
            }}>
              <div style={{
                width: 20, height: 20, border: `2px solid ${C.sable}`,
                borderTopColor: C.vert, borderRadius: '50%',
                animation: 'kapolia-spin 0.7s linear infinite',
              }} />
            </div>
          )}
          {appliedOverlayId === offre.id && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: CARD_RADIUS,
            }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                backgroundColor: C.vert, color: C.white,
                padding: '8px 14px', borderRadius: 20,
                fontSize: 13, fontWeight: 600,
                animation: 'kapolia-motion-pill-enter 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) both',
              }}>
                <span>&#10003;</span>
                <span>Candidature envoyée</span>
              </div>
            </div>
          )}
          <OffreCard
            offre={offre}
            applied={applied.has(offre.id)}
            saved={!removingIds.has(offre.id)}
            onApply={handleCardApply}
            onToggleSave={handleToggleSave}
            isConnected={isConnected}
            isSelected={selectedId === offre.id}
            onSelect={compact ? handleCardSelect : undefined}
            expirePastille={compact && offre.ouvert ? computeExpirePastille(offre.expire_at) : undefined}
            ferme={!offre.ouvert}
            showDescription={!compact}
            showApply={!compact}
            dateLabel={!compact && offre.ouvert ? ajoutLabel(offre.fav_created_at) : undefined}
          />
        </div>
      )
    }

    const hasExpiring = etudierExpiring.length > 0
    const hasOthers   = etudierOthers.length > 0
    const hasExpirees = expireesSorted.length > 0
    const showOthersTitle = hasOthers && (hasExpiring || hasExpirees)

    const triSelect = etudierSorted.length > 0 ? (
      <div style={{ marginBottom: 18 }}>
        <TriSelect
          value={sortKey}
          onChange={v => setSortKey(v as SortKey)}
          options={[
            { value: 'match',        label: 'Meilleure correspondance' },
            { value: 'fav_desc',     label: 'Ajout récent' },
            { value: 'salaire_desc', label: 'Salaire décroissant' },
            { value: 'offre_desc',   label: 'Publication récente' },
          ]}
        />
      </div>
    ) : null

    return (
      <>
        {triSelect}

        {/* Groupe "Expire cette semaine" */}
        {hasExpiring && (
          <>
            <div ref={groupTitleExpiringRef} style={{ overflow: 'hidden' }}>
              <div style={{
                fontFamily: FONT_SERIF, letterSpacing: '-0.005em',
                fontSize: 15, fontWeight: 600, color: C.dark, paddingBottom: 8,
              }}>
                Expire cette semaine
              </div>
            </div>
            {etudierExpiring.map(card)}
          </>
        )}

        {/* Groupe "Les autres" */}
        {hasOthers && (
          <>
            {showOthersTitle && (
              <div ref={groupTitleOthersRef} style={{ overflow: 'hidden' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  fontFamily: FONT_SERIF, letterSpacing: '-0.005em',
                  fontSize: 15, fontWeight: 600, color: C.dark,
                  paddingTop: hasExpiring ? 20 : 0, paddingBottom: 8,
                }}>
                  <span>Les autres</span>
                  <span style={{ fontSize: 13, fontWeight: 400, fontFamily: 'inherit', color: C.grey }}>
                    {SORT_LABELS_GROUP[sortKey]}
                  </span>
                </div>
              </div>
            )}
            {etudierOthers.map(card)}
          </>
        )}

        {/* Groupe "Expirées" */}
        {hasExpirees && (
          <>
            <div ref={groupTitleExpireesRef} style={{ overflow: 'hidden' }}>
              <div style={{
                fontFamily: FONT_SERIF, letterSpacing: '-0.005em',
                fontSize: 15, fontWeight: 600, color: C.dark,
                paddingTop: (hasExpiring || hasOthers) ? 20 : 0, paddingBottom: 8,
              }}>
                Expirées
              </div>
            </div>
            {expireesSorted.map(card)}
          </>
        )}
      </>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const selectedFavOffre = selectedDetail ? offres.find(o => o.id === selectedDetail.id) : null

  const panelCompManquantes: string[] = (() => {
    if (!selectedDetail || !selectedFavOffre?.ouvert) return []
    if (applied.has(selectedDetail.id)) return []
    if (!profilState) return []
    return competencesManquantesCandidat(profilState, { competences: selectedDetail.competences })
  })()

  const panelScoreSiCompetences: number | null = (() => {
    if (panelCompManquantes.length === 0 || !selectedDetail || !profilState) return null
    return scoreSiCompetencesAjoutees(profilState, {
      domaine:           selectedDetail.domaine,
      experience:        selectedDetail.experience,
      type_contrat:      selectedDetail.type_contrat,
      valeurs:           selectedDetail.valeurs,
      ville:             selectedDetail.ville,
      mode_travail:      selectedDetail.mode_travail,
      langues:           selectedDetail.langues,
      competences:       selectedDetail.competences,
      competences_bonus: selectedDetail.competences_bonus,
    })
  })()

  const isEmpty = !loading && visibleOuverts.length === 0 && expirees.length === 0

  return (
    <div style={{
      position: 'relative',
      backgroundColor: C.bg,
      ...(isSplit
        ? { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }
        : { minHeight: '100vh' }),
    }}>
      <style suppressHydrationWarning>{`
        @keyframes kapolia-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.42; } }
        @keyframes kapolia-spin  { to { transform: rotate(360deg); } }
        @keyframes kapolia-motion-pill-enter { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
        * { box-sizing: border-box; }
        .kapolia-card-wrapper:focus, .kapolia-card-wrapper:focus-visible { outline: none; }
      `}</style>

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <div style={{ padding: isSplit ? '28px 28px 0' : '32px 24px 0', flexShrink: 0 }}>
        <div style={{ marginBottom: 12 }}>
          <h1 style={{
            fontFamily: FONT_SERIF, letterSpacing: '-0.005em',
            fontSize: 30, fontWeight: 600, color: C.dark,
            margin: 0, lineHeight: 1.15,
          }}>
            Mes favoris
          </h1>
          <p style={{ fontSize: 14, color: C.grey, margin: '6px 0 0', minHeight: 20 }}>
            {subtitle}
          </p>
        </div>

        {/* Séparateur */}
        <div style={{ height: 1, backgroundColor: C.sable }} />
      </div>

      {/* ── Corps ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : isEmpty ? (
        <EmptyFavoris onBrowse={() => router.push('/offres')} />
      ) : isSplit ? (
        /* ── Split view ─────────────────────────────────────────────────── */
        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>

          {/* Colonne gauche */}
          <div
            ref={leftColRef}
            onScroll={scheduleRoulette}
            style={{
              width: 400, flexShrink: 0, overflowY: 'auto',
              padding: '16px 16px 40px',
              borderRight: `1px solid ${C.sable}`,
              display: 'flex', flexDirection: 'column', gap: 8,
            }}
          >
            {renderList(true)}
          </div>

          {/* Panneau droit */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', backgroundColor: C.bg }}>
            <div ref={detailPanelRef} style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
              {selectedDetail ? (
                <OffreDetail
                  offre={selectedDetail}
                  applied={applied.has(selectedDetail.id)}
                  appliedDate={applied.get(selectedDetail.id) ?? null}
                  applying={panelApplying}
                  saved={true}
                  isConnected={isConnected}
                  similaires={[]}
                  onApply={handlePanelApply}
                  onToggleSave={() => handleToggleSave(selectedDetail.id)}
                  mode="panel"
                  score={selectedFavOffre?.score ?? null}
                  breakdown={selectedFavOffre?.breakdown ?? null}
                  expireLabel={selectedFavOffre?.ouvert ? computeExpireLabel(selectedFavOffre.expire_at ?? null) : null}
                  ferme={selectedFavOffre ? !selectedFavOffre.ouvert : false}
                  bandeauText={computeBandeauText(selectedFavOffre ?? null)}
                  onRetirer={() => handleToggleSave(selectedDetail.id)}
                  offresProches={offresProches}
                  competencesManquantes={panelCompManquantes}
                  scoreSiCompetences={panelScoreSiCompetences}
                />
              ) : selectedId ? (
                /* Skeleton detail */
                <div style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(['45%', '30%', '80%', '65%', '55%'] as string[]).map((w, i) => (
                    <div key={i} style={{
                      height: i === 0 ? 24 : 13, width: w, borderRadius: 6, backgroundColor: C.sable,
                      animation: `kapolia-pulse 1.6s ease-in-out ${i * 0.12}s infinite`,
                    }} />
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                  <span style={{ fontSize: 14, color: C.grey }}>
                    Sélectionnez une offre pour voir les détails.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ── Mobile ─────────────────────────────────────────────────────── */
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '16px 24px 80px', width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {renderList(false)}
        </div>
      )}

      {bandeauMsg && (
        <Bandeau
          ref={bandeauRef}
          message={bandeauMsg}
          action={
            bandeauType === 'undo' && bandeauUndo ? { libelle: 'Annuler', onClick: handleAnnuler } :
            bandeauType === 'apply' ? { libelle: 'Voir mes candidatures', href: '/candidatures' } :
            undefined
          }
          fixe={!isSplit}
        />
      )}
    </div>
  )
}
