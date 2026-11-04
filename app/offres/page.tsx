'use client'

import { useState, useEffect, useLayoutEffect, useMemo, useRef, useId } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FONT_SERIF } from '@/lib/typography'
import { scoreBreakdownCandidat, profilSuffisantPourScoreCandidat, type ProfilMatch, type ScoreBreakdown } from '@/lib/matching'
import { DOMAINES, EXPERIENCES, TYPES_CONTRAT, TELETRAVAIL, DUREES_CONTRAT, normaliserDebut } from '@/lib/referentiels'
import { OffreDetail, type OffreSimilaire } from '@/components/OffreDetail'
import { type GeoCoords } from '@/components/GeoVilleInput'
import { LieuRadiusPopover } from '@/components/LieuRadiusPopover'
import { haversineKm } from '@/lib/geo'
import { LANGUES } from '@/lib/langues'
import { useFavoris } from '@/lib/favoris-context'
import { OffreCard } from '@/components/OffreCard'
import { C as _C, CARD_SHADOW, CARD_RADIUS } from '@/lib/colors'
import LogoKapolia from '@/components/LogoKapolia'
import { normalizeText } from '@/lib/storage-utils'
import { largeurUtile } from '@/lib/largeur-utile'

const C = { ..._C, lightGrey: '#D0D0D0' as const }

// ─── Palette ──────────────────────────────────────────────────────────────────

// ─── Types ────────────────────────────────────────────────────────────────────

type Profil = {
  domaine?: string
  experience?: string
  type_poste?: string[]
  valeur?: string
  disponibilite?: string | string[]
  ville?: string
  mode_travail?: string[] | null
  langues?: string[] | null
}

type Offre = {
  id: string
  titre: string
  recruteur_id?: string
  entreprise_nom?: string
  entreprise_logo_url?: string
  type_contrat?: string
  domaine?: string
  experience?: string
  salaire_min?: number
  salaire_max?: number
  periode_salaire?: string
  mode_travail?: string
  ville?: string
  description?: string
  competences?: string[]
  valeurs?: string[]
  avantages?: string[]
  langues?: string[]
  duree_contrat?: string
  date_debut?: string
  created_at: string
  score: number | null
  breakdown?: ScoreBreakdown | null
  latitude?: number
  longitude?: number
}

type SortKey = 'match' | 'recent' | 'salaire_asc' | 'salaire_desc' | 'alpha' | 'distance'

type Filters = {
  search: string
  domaine: string[]
  contrat: string[]
  lieu: string
  mode: string[]
  exp: string
  salaire: string
  date_pub: string
  langue: string[]
  prise_de_poste: string
  duree_contrat: string
  score_min: string
  tri: SortKey
  rayon: string
}

const EMPTY_FILTERS: Filters = {
  search: '', domaine: [], contrat: [], lieu: '', mode: [], exp: '', salaire: '',
  date_pub: '', langue: [], prise_de_poste: '', duree_contrat: '', score_min: '', tri: 'match',
  rayon: '25',
}

// ─── Filter config ────────────────────────────────────────────────────────────

const DOMAINE_OPTS     = DOMAINES
const EXP_OPTS         = EXPERIENCES
const SALAIRE_PILL_OPTS = ['20 000 €+', '25 000 €+', '35 000 €+', '45 000 €+', '55 000 €+', '70 000 €+']
const DATE_PUB_OPTS    = ["Aujourd'hui", '3 derniers jours', 'Cette semaine', 'Ce mois-ci']
const PRISE_POSTE_OPTS = ['Immédiate', 'Dans le mois', 'Dans 3 mois']

const TRI_LABELS: Record<SortKey, string> = {
  match:        'Meilleure correspondance',
  recent:       'Plus récentes',
  salaire_asc:  'Salaire croissant',
  salaire_desc: 'Salaire décroissant',
  alpha:        'Alphabétique',
  distance:     'Distance',
}

// URL param mapping
const URL_MAP: Partial<Record<keyof Filters, string>> = {
  search: 'q', domaine: 'd', contrat: 'c', lieu: 'l', mode: 'm',
  exp: 'e', salaire: 's', date_pub: 'dp',
  prise_de_poste: 'pp', duree_contrat: 'dc', tri: 'tri', rayon: 'r',
}
void URL_MAP // used via spread in URL sync effects

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEntrepriseNom(offre: Offre): string {
  return offre.entreprise_nom || 'Entreprise'
}

// ─── Recherche textuelle pondérée ─────────────────────────────────────────────

const STOP_FR = new Set([
  'de', 'du', 'le', 'la', 'les', 'l', 'un', 'une', 'des',
  'en', 'et', 'ou', 'a', 'au', 'aux',
  'par', 'pour', 'avec', 'dans', 'sur',
  'ce', 'qui', 'que', 'se', 'sa', 'son', 'ses',
])

const FUZZY_MIN_LEN   = 4    // tokens plus courts → pas de fuzzy (rh, cdi, seo…)
const FUZZY_THRESHOLD = 0.6  // similarité trigramme minimale

function makeTrigrams(s: string): Set<string> {
  const tris = new Set<string>()
  const p = ` ${s} `
  for (let i = 0; i <= p.length - 3; i++) tris.add(p.slice(i, i + 3))
  return tris
}

function trigramSim(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return 0
  const ta = makeTrigrams(a), tb = makeTrigrams(b)
  let common = 0
  for (const t of ta) if (tb.has(t)) common++
  return (2 * common) / (ta.size + tb.size)
}

// Vérifie si au moins un mot du champ a une similarité >= seuil avec le token.
function fieldFuzzy(field: string, token: string): boolean {
  return normalizeText(field).split(/\s+/).some(w => trigramSim(w, token) >= FUZZY_THRESHOLD)
}

function getTokens(raw: string): string[] {
  return normalizeText(raw)
    .split(/\s+/)
    .filter(t => t.length >= 2 && !STOP_FR.has(t))
}

// Poids exacts : titre=4, entreprise=4, ville=3, domaine=3, competences=3, description=1
// Poids fuzzy  : titre=2, entreprise=2, ville=1, domaine=1, competences=1, description=ignoré
// AND sur les tokens : un token sans correspondance (exacte ni fuzzy) = exclusion.
// Résultat description-only exact (total === descPts, sans fuzzy) : exclusion.
// Retourne { score, fuzzy } — fuzzy=true si au moins un token a résolu par approximation.
function searchScore(offre: Offre, tokens: string[]): { score: number; fuzzy: boolean } {
  const n = normalizeText
  let total = 0
  let descPts = 0
  let anyFuzzy = false

  for (const t of tokens) {
    let pts = 0
    let dp  = 0

    // ── Correspondance exacte ──────────────────────────────────────────────
    if (n(offre.titre).includes(t))                                    pts += 4
    if (n(getEntrepriseNom(offre)).includes(t))                        pts += 4
    if (n(offre.ville   ?? '').includes(t))                            pts += 3
    if (n(offre.domaine ?? '').includes(t))                            pts += 3
    if ((offre.competences ?? []).some(c => n(c).includes(t)))         pts += 3
    if (n(offre.description ?? '').includes(t))                        { dp = 1; pts += 1 }

    // ── Correspondance approximative (uniquement si exacte échoue) ────────
    if (pts === 0 && t.length >= FUZZY_MIN_LEN) {
      if (fieldFuzzy(offre.titre, t))                                  pts += 2
      if (fieldFuzzy(getEntrepriseNom(offre), t))                      pts += 2
      if (fieldFuzzy(offre.ville   ?? '', t))                          pts += 1
      if (fieldFuzzy(offre.domaine ?? '', t))                          pts += 1
      if ((offre.competences ?? []).some(c => fieldFuzzy(c, t)))       pts += 1
      if (pts > 0) anyFuzzy = true
    }

    if (pts === 0) return { score: 0, fuzzy: false }
    total   += pts
    descPts += dp
  }

  if (total === descPts && !anyFuzzy) return { score: 0, fuzzy: false }
  return { score: total, fuzzy: anyFuzzy }
}

// ─── Sub-components (page-local) ─────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      backgroundColor: C.white, borderRadius: CARD_RADIUS, padding: '20px 24px',
      borderLeft: `3px solid transparent`, boxShadow: CARD_SHADOW,
    }}>
      {([['68%', 18], ['42%', 13], ['28%', 11], ['88%', 12], ['55%', 12]] as [string, number][]).map(([w, h], i) => (
        <div key={i} style={{
          height: h, width: w, borderRadius: 6, backgroundColor: C.sable,
          marginBottom: i === 1 ? 14 : 8,
          animation: `kapolia-pulse 1.6s ease-in-out ${i * 0.14}s infinite`,
        }} />
      ))}
    </div>
  )
}

function PillDropdown({
  label, value, options, onChange, dark = false,
}: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; dark?: boolean
}) {
  const uid = useId()
  const [open, setOpen]       = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, minWidth: 190 })
  const btnRef  = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const active  = !!value

  function startClose() {
    if (!open) return
    const pref = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!pref && dropRef.current) {
      dropRef.current.getAnimations().forEach(a => a.cancel())
      setOpen(false); setIsClosing(true)
      dropRef.current.animate(
        [{ opacity: '1', transform: 'translateY(0) scale(1)' }, { opacity: '0', transform: 'translateY(-4px) scale(0.98)' }],
        { duration: 110, easing: 'ease-in', fill: 'forwards' }
      ).onfinish = () => setIsClosing(false)
    } else { setOpen(false) }
  }

  function handleToggle() {
    if (open) { startClose(); return }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const minWidth190 = Math.max(r.width, 190)
      const left190 = Math.min(r.left, largeurUtile() - minWidth190 - 8)
      setDropPos({ top: r.bottom + 6, left: Math.max(8, left190), minWidth: minWidth190 })
      document.dispatchEvent(new CustomEvent('kapolia-filter-open', { detail: uid }))
    }
    setOpen(true)
  }

  useEffect(() => {
    function onOtherOpen(e: Event) {
      if ((e as CustomEvent).detail !== uid) setOpen(false)
    }
    document.addEventListener('kapolia-filter-open', onOtherOpen)
    return () => document.removeEventListener('kapolia-filter-open', onOtherOpen)
  }, [uid])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || dropRef.current?.contains(t)) return
      startClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const short        = value.length > 13 ? value.slice(0, 13) + '…' : value
  const displayLabel = active ? short : label

  const pillBg        = dark ? (active ? 'rgba(246,247,246,0.12)' : 'transparent')           : (active ? C.vert  : C.white)
  const pillBorder    = dark ? (active ? 'rgba(246,247,246,0.65)' : 'rgba(255,255,255,0.28)') : (active ? C.vert  : C.sable)
  const pillColor     = dark ? C.bg                                                         : (active ? C.white : C.dark)
  const chevronStroke = dark ? 'rgba(246,247,246,0.75)'                                        : (active ? C.white : C.grey)

  return (
    <div style={{ flexShrink: 0 }}>
      <button
        ref={btnRef}
        onClick={handleToggle}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '7px 12px', borderRadius: 20, fontSize: 14,
          fontWeight: active ? 600 : 400,
          border: `1.5px solid ${pillBorder}`,
          backgroundColor: pillBg, color: pillColor,
          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          transition: 'all 0.12s',
        }}
      >
        {displayLabel}
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
          <path d={open ? 'M2 6.5l3-3 3 3' : 'M2 3.5l3 3 3-3'} stroke={chevronStroke} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {(open || isClosing) && createPortal(
        <div
          ref={dropRef}
          data-kapolia-filter-portal="1"
          style={{
            position: 'fixed',
            top: dropPos.top,
            left: dropPos.left,
            minWidth: dropPos.minWidth,
            backgroundColor: C.white, border: `1px solid ${C.sable}`,
            borderRadius: 12, padding: '6px 4px', zIndex: 400,
            boxShadow: '0 8px 24px rgba(0,0,0,0.13)',
            animation: isClosing ? 'none' : 'kapolia-motion-menu-open 160ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
            transformOrigin: 'top left',
            maxHeight: '60vh', overflowY: 'auto',
          }}
        >
          <button
            onClick={() => { onChange(''); setOpen(false) }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '8px 12px', border: 'none', borderRadius: 8,
              backgroundColor: !value ? `${C.vert}12` : 'transparent',
              color: !value ? C.vert : C.grey,
              fontSize: 13, fontWeight: !value ? 600 : 400,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Tous
          </button>
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => { onChange(opt === value ? '' : opt); setOpen(false) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 12px', border: 'none', borderRadius: 8,
                backgroundColor: value === opt ? `${C.vert}12` : 'transparent',
                color: value === opt ? C.vert : C.dark,
                fontSize: 13, fontWeight: value === opt ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {value === opt && <svg width="11" height="9" viewBox="0 0 12 10" fill="none" style={{ marginRight: 5, verticalAlign: 'middle', flexShrink: 0 }}><path d="M1 5L4 8L11 1" stroke={C.vert} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              {opt}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

function MultiPillDropdown({
  label, value, options, onChange, dark = false,
}: {
  label: string; value: string[]; options: string[]; onChange: (v: string[]) => void; dark?: boolean
}) {
  const uid = useId()
  const [open, setOpen]       = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, minWidth: 190 })
  const btnRef  = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const active  = value.length > 0

  function startClose() {
    if (!open) return
    const pref = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!pref && dropRef.current) {
      dropRef.current.getAnimations().forEach(a => a.cancel())
      setOpen(false); setIsClosing(true)
      dropRef.current.animate(
        [{ opacity: '1', transform: 'translateY(0) scale(1)' }, { opacity: '0', transform: 'translateY(-4px) scale(0.98)' }],
        { duration: 110, easing: 'ease-in', fill: 'forwards' }
      ).onfinish = () => setIsClosing(false)
    } else { setOpen(false) }
  }

  function handleToggle() {
    if (open) { startClose(); return }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const minWidth190 = Math.max(r.width, 190)
      const left190 = Math.min(r.left, largeurUtile() - minWidth190 - 8)
      setDropPos({ top: r.bottom + 6, left: Math.max(8, left190), minWidth: minWidth190 })
      document.dispatchEvent(new CustomEvent('kapolia-filter-open', { detail: uid }))
    }
    setOpen(true)
  }

  useEffect(() => {
    function onOtherOpen(e: Event) {
      if ((e as CustomEvent).detail !== uid) setOpen(false)
    }
    document.addEventListener('kapolia-filter-open', onOtherOpen)
    return () => document.removeEventListener('kapolia-filter-open', onOtherOpen)
  }, [uid])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || dropRef.current?.contains(t)) return
      startClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])
  }

  const short1 = value.length === 1 ? (value[0].length > 13 ? value[0].slice(0, 13) + '…' : value[0]) : ''
  const displayLabel = value.length === 0
    ? label
    : value.length === 1
      ? short1
      : `${label} (${value.length})`

  const isMultiActive = dark && value.length > 1
  const pillBg        = isMultiActive ? C.white : dark ? (active ? 'rgba(246,247,246,0.12)' : 'transparent')           : (active ? C.vert  : C.white)
  const pillBorder    = isMultiActive ? C.vert  : dark ? (active ? 'rgba(246,247,246,0.65)' : 'rgba(255,255,255,0.28)') : (active ? C.vert  : C.sable)
  const pillColor     = isMultiActive ? C.vert  : dark ? C.bg                                                          : (active ? C.white : C.dark)
  const chevronStroke = isMultiActive ? C.vert  : dark ? 'rgba(246,247,246,0.75)'                                       : (active ? C.white : C.grey)

  return (
    <div style={{ flexShrink: 0 }}>
      <button
        ref={btnRef}
        onClick={handleToggle}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '7px 12px', borderRadius: 20, fontSize: 14,
          fontWeight: active ? 600 : 400,
          border: `1.5px solid ${pillBorder}`,
          backgroundColor: pillBg, color: pillColor,
          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          transition: 'all 0.12s',
        }}
      >
        {displayLabel}
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
          <path d={open ? 'M2 6.5l3-3 3 3' : 'M2 3.5l3 3 3-3'} stroke={chevronStroke} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {(open || isClosing) && createPortal(
        <div
          ref={dropRef}
          data-kapolia-filter-portal="1"
          style={{
            position: 'fixed',
            top: dropPos.top,
            left: dropPos.left,
            minWidth: dropPos.minWidth,
            backgroundColor: C.white, border: `1px solid ${C.sable}`,
            borderRadius: 12, padding: '6px 4px', zIndex: 400,
            boxShadow: '0 8px 24px rgba(0,0,0,0.13)',
            animation: isClosing ? 'none' : 'kapolia-motion-menu-open 160ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
            transformOrigin: 'top left',
            maxHeight: '60vh', overflowY: 'auto',
          }}
        >
          {active && (
            <button
              onClick={() => onChange([])}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 12px', border: 'none', borderRadius: 8,
                backgroundColor: 'transparent', color: C.terracotta,
                fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', marginBottom: 2,
              }}
            >
              Tout décocher
            </button>
          )}
          {options.map(opt => {
            const sel = value.includes(opt)
            return (
              <button
                key={opt}
                onClick={() => toggle(opt)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                  padding: '8px 12px', border: 'none', borderRadius: 8,
                  backgroundColor: sel ? `${C.vert}12` : 'transparent',
                  color: sel ? C.vert : C.dark,
                  fontSize: 13, fontWeight: sel ? 600 : 400,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <span style={{
                  width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                  border: `1.5px solid ${sel ? C.vert : C.sable}`,
                  backgroundColor: sel ? C.vert : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {sel && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5l2.5 2.5L8 1" stroke={C.white} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </span>
                {opt}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}

function SalairePillDropdown({
  value, onChange,
}: {
  value: string; onChange: (v: string) => void
}) {
  const uid = useId()
  const [open, setOpen]           = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [customInput, setCustomInput] = useState('')
  const [dropPos, setDropPos]     = useState({ top: 0, left: 0, minWidth: 230 })
  const btnRef  = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const active  = !!value

  useEffect(() => {
    if (value && !SALAIRE_PILL_OPTS.includes(value)) {
      setCustomInput(value.replace(/[^\d]/g, ''))
    } else {
      setCustomInput('')
    }
  }, [value])

  function startClose() {
    if (!open) return
    const pref = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!pref && dropRef.current) {
      dropRef.current.getAnimations().forEach(a => a.cancel())
      setOpen(false); setIsClosing(true)
      dropRef.current.animate(
        [{ opacity: '1', transform: 'translateY(0) scale(1)' }, { opacity: '0', transform: 'translateY(-4px) scale(0.98)' }],
        { duration: 110, easing: 'ease-in', fill: 'forwards' }
      ).onfinish = () => setIsClosing(false)
    } else { setOpen(false) }
  }

  function handleToggle() {
    if (open) { startClose(); return }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const minWidth230 = Math.max(r.width, 230)
      const left230 = Math.min(r.left, largeurUtile() - minWidth230 - 8)
      setDropPos({ top: r.bottom + 6, left: Math.max(8, left230), minWidth: minWidth230 })
      document.dispatchEvent(new CustomEvent('kapolia-filter-open', { detail: uid }))
    }
    setOpen(true)
  }

  useEffect(() => {
    function onOtherOpen(e: Event) {
      if ((e as CustomEvent).detail !== uid) setOpen(false)
    }
    document.addEventListener('kapolia-filter-open', onOtherOpen)
    return () => document.removeEventListener('kapolia-filter-open', onOtherOpen)
  }, [uid])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || dropRef.current?.contains(t)) return
      startClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function selectPreset(opt: string) {
    onChange(opt === value ? '' : opt)
    setCustomInput('')
    setOpen(false)
  }

  function applyCustom() {
    const n = parseInt(customInput, 10)
    if (n > 0 && n < 1_000_000) {
      onChange(String(n))
      setOpen(false)
    }
  }

  // Format pill display label
  const isPreset   = SALAIRE_PILL_OPTS.includes(value)
  const displayLabel = !active
    ? 'Salaire min.'
    : isPreset
      ? `Salaire · ${value}`
      : `Salaire · ${parseInt(value, 10).toLocaleString('fr-FR')} €+`

  const short          = displayLabel.length > 26 ? displayLabel.slice(0, 26) + '…' : displayLabel
  const pillBg         = active ? 'rgba(246,247,246,0.12)' : 'transparent'
  const pillBorder     = active ? 'rgba(246,247,246,0.65)' : 'rgba(255,255,255,0.28)'
  const pillColor      = C.bg
  const chevronStroke  = 'rgba(246,247,246,0.75)'

  return (
    <div style={{ flexShrink: 0 }}>
      <button
        ref={btnRef}
        onClick={handleToggle}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '7px 12px', borderRadius: 20, fontSize: 14,
          fontWeight: active ? 600 : 400,
          border: `1.5px solid ${pillBorder}`,
          backgroundColor: pillBg, color: pillColor,
          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          transition: 'all 0.12s',
        }}
      >
        {short}
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
          <path d={open ? 'M2 6.5l3-3 3 3' : 'M2 3.5l3 3 3-3'} stroke={chevronStroke} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {(open || isClosing) && createPortal(
        <div
          ref={dropRef}
          data-kapolia-filter-portal="1"
          style={{
            position: 'fixed', top: dropPos.top, left: dropPos.left,
            minWidth: dropPos.minWidth,
            backgroundColor: C.white, border: `1px solid ${C.sable}`,
            borderRadius: 12, padding: '6px 4px 8px', zIndex: 400,
            boxShadow: '0 8px 24px rgba(0,0,0,0.13)',
            animation: isClosing ? 'none' : 'kapolia-motion-menu-open 160ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
            transformOrigin: 'top left',
          }}
        >
          {/* Effacer */}
          <button
            onClick={() => { onChange(''); setCustomInput(''); setOpen(false) }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '8px 12px', border: 'none', borderRadius: 8,
              backgroundColor: !value ? `${C.vert}12` : 'transparent',
              color: !value ? C.vert : C.grey,
              fontSize: 13, fontWeight: !value ? 600 : 400,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Tous les salaires
          </button>

          {/* Paliers */}
          {SALAIRE_PILL_OPTS.map(opt => (
            <button
              key={opt}
              onClick={() => selectPreset(opt)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 12px', border: 'none', borderRadius: 8,
                backgroundColor: value === opt ? `${C.vert}12` : 'transparent',
                color: value === opt ? C.vert : C.dark,
                fontSize: 13, fontWeight: value === opt ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {value === opt && <svg width="11" height="9" viewBox="0 0 12 10" fill="none" style={{ marginRight: 5, verticalAlign: 'middle', flexShrink: 0 }}><path d="M1 5L4 8L11 1" stroke={C.vert} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              {opt}
            </button>
          ))}

          {/* Séparateur + saisie libre */}
          <div style={{ borderTop: `1px solid ${C.sable}`, margin: '6px 8px 8px', paddingTop: 8 }}>
            <div style={{ fontSize: 12, color: C.grey, paddingLeft: 4, marginBottom: 6 }}>
              Montant minimum annuel
            </div>
            <div style={{ display: 'flex', gap: 6, padding: '0 4px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="number"
                  min="0"
                  max="999999"
                  value={customInput}
                  onChange={e => {
                    setCustomInput(e.target.value)
                    if (isPreset) onChange('')
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') applyCustom() }}
                  placeholder="Ex : 40 000 €"
                  style={{
                    width: '100%', padding: '7px 8px',
                    fontSize: 13, borderRadius: 8,
                    border: `1.5px solid ${customInput && !isPreset ? C.vert : C.sable}`,
                    backgroundColor: C.white, color: C.dark,
                    outline: 'none', fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <button
                onClick={applyCustom}
                style={{
                  padding: '7px 12px', borderRadius: 8, border: 'none',
                  backgroundColor: C.terracotta, color: C.white,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  flexShrink: 0,
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function LangPillDropdown({
  value, onChange, dark = false,
}: {
  value: string[]; onChange: (v: string[]) => void; dark?: boolean
}) {
  const uid = useId()
  const [open, setOpen]           = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [search, setSearch]       = useState('')
  const [dropPos, setDropPos]     = useState({ top: 0, left: 0, minWidth: 220 })
  const btnRef    = useRef<HTMLButtonElement>(null)
  const dropRef   = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const active = value.length > 0

  function startClose() {
    if (!open) return
    const pref = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!pref && dropRef.current) {
      dropRef.current.getAnimations().forEach(a => a.cancel())
      setOpen(false); setIsClosing(true)
      dropRef.current.animate(
        [{ opacity: '1', transform: 'translateY(0) scale(1)' }, { opacity: '0', transform: 'translateY(-4px) scale(0.98)' }],
        { duration: 110, easing: 'ease-in', fill: 'forwards' }
      ).onfinish = () => setIsClosing(false)
    } else { setOpen(false) }
  }

  function handleToggle() {
    if (open) { startClose(); return }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const minWidth220 = Math.max(r.width, 220)
      const left220 = Math.min(r.left, largeurUtile() - minWidth220 - 8)
      setDropPos({ top: r.bottom + 6, left: Math.max(8, left220), minWidth: minWidth220 })
      document.dispatchEvent(new CustomEvent('kapolia-filter-open', { detail: uid }))
    }
    setSearch('')
    setOpen(true)
  }

  useEffect(() => {
    function onOtherOpen(e: Event) {
      if ((e as CustomEvent).detail !== uid) setOpen(false)
    }
    document.addEventListener('kapolia-filter-open', onOtherOpen)
    return () => document.removeEventListener('kapolia-filter-open', onOtherOpen)
  }, [uid])

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || dropRef.current?.contains(t)) return
      startClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function toggle(code: string) {
    onChange(value.includes(code) ? value.filter(c => c !== code) : [...value, code])
  }

  const visibleLangs = search.trim()
    ? LANGUES.filter(l => l.nom.toLowerCase().includes(search.toLowerCase().trim()))
    : LANGUES

  const displayLabel = value.length === 0
    ? 'Langues'
    : value.length === 1
      ? (() => { const l = LANGUES.find(l => l.code === value[0]); return l ? l.nom : 'Langues' })()
      : `Langues (${value.length})`

  const isMultiActive = dark && value.length > 1
  const pillBg        = isMultiActive ? C.white : dark ? (active ? 'rgba(246,247,246,0.12)' : 'transparent')           : (active ? C.vert  : C.white)
  const pillBorder    = isMultiActive ? C.vert  : dark ? (active ? 'rgba(246,247,246,0.65)' : 'rgba(255,255,255,0.28)') : (active ? C.vert  : C.sable)
  const pillColor     = isMultiActive ? C.vert  : dark ? C.bg                                                          : (active ? C.white : C.dark)
  const chevronStroke = isMultiActive ? C.vert  : dark ? 'rgba(246,247,246,0.75)'                                       : (active ? C.white : C.grey)

  return (
    <div style={{ flexShrink: 0 }}>
      <button
        ref={btnRef}
        onClick={handleToggle}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '7px 12px', borderRadius: 20, fontSize: 14,
          fontWeight: active ? 600 : 400,
          border: `1.5px solid ${pillBorder}`,
          backgroundColor: pillBg, color: pillColor,
          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          transition: 'all 0.12s',
        }}
      >
        {displayLabel}
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
          <path d={open ? 'M2 6.5l3-3 3 3' : 'M2 3.5l3 3 3-3'} stroke={chevronStroke} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {(open || isClosing) && createPortal(
        <div
          ref={dropRef}
          data-kapolia-filter-portal="1"
          style={{
            position: 'fixed', top: dropPos.top, left: dropPos.left, minWidth: dropPos.minWidth,
            backgroundColor: C.white, border: `1px solid ${C.sable}`,
            borderRadius: 12, zIndex: 400,
            boxShadow: '0 8px 24px rgba(0,0,0,0.13)',
            animation: isClosing ? 'none' : 'kapolia-motion-menu-open 160ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
            transformOrigin: 'top left',
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{ padding: '8px 8px 4px' }}>
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher une langue…"
              style={{
                width: '100%', padding: '6px 10px', borderRadius: 8, fontSize: 13,
                border: `1.5px solid ${C.sable}`, outline: 'none', fontFamily: 'inherit',
                backgroundColor: C.bg, color: C.dark, boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ maxHeight: '42vh', overflowY: 'auto', padding: '2px 4px 6px' }}>
            {active && !search && (
              <button
                onClick={() => onChange([])}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '7px 12px', border: 'none', borderRadius: 8,
                  backgroundColor: 'transparent', color: C.terracotta,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 2,
                }}
              >
                Tout décocher
              </button>
            )}
            {visibleLangs.map(l => {
              const sel = value.includes(l.code)
              return (
                <button
                  key={l.code}
                  onClick={() => toggle(l.code)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                    padding: '7px 12px', border: 'none', borderRadius: 8,
                    backgroundColor: sel ? `${C.vert}12` : 'transparent',
                    color: sel ? C.vert : C.dark,
                    fontSize: 13, fontWeight: sel ? 600 : 400,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <span style={{
                    width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                    border: `1.5px solid ${sel ? C.vert : C.sable}`,
                    backgroundColor: sel ? C.vert : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {sel && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5l2.5 2.5L8 1" stroke={C.white} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </span>
                  <span>{l.nom}</span>
                </button>
              )
            })}
            {visibleLangs.length === 0 && (
              <div style={{ padding: '12px', fontSize: 13, color: C.grey, textAlign: 'center' }}>
                Aucune langue trouvée
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

const SCORE_OPTS = [
  { label: '75 % et plus', value: '75' },
  { label: '50 % et plus', value: '50' },
]

function CorrespondancePill({ value, onChange, profil, isConnected }: {
  value: string; onChange: (v: string) => void; profil: Profil | null; isConnected: boolean
}) {
  const uid = useId()
  const [open, setOpen]             = useState(false)
  const [isClosing, setIsClosing]   = useState(false)
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [dropPos, setDropPos]       = useState({ top: 0, left: 0 })
  const btnRef  = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const canFilter = isConnected && profil != null && profilSuffisantPourScoreCandidat(profil as ProfilMatch)
  const disabled  = !canFilter
  const active    = !!value

  function startClose() {
    if (!open) return
    const pref = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!pref && dropRef.current) {
      dropRef.current.getAnimations().forEach(a => a.cancel())
      setOpen(false); setIsClosing(true)
      dropRef.current.animate(
        [{ opacity: '1', transform: 'translateY(0) scale(1)' }, { opacity: '0', transform: 'translateY(-4px) scale(0.98)' }],
        { duration: 110, easing: 'ease-in', fill: 'forwards' }
      ).onfinish = () => setIsClosing(false)
    } else { setOpen(false) }
  }

  function handleToggle() {
    if (disabled) return
    if (open) { startClose(); return }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const left180 = Math.min(r.left, largeurUtile() - 180 - 8)
      setDropPos({ top: r.bottom + 6, left: Math.max(8, left180) })
      document.dispatchEvent(new CustomEvent('kapolia-filter-open', { detail: uid }))
    }
    setOpen(true)
  }

  useEffect(() => {
    function onOtherOpen(e: Event) {
      if ((e as CustomEvent).detail !== uid) setOpen(false)
    }
    document.addEventListener('kapolia-filter-open', onOtherOpen)
    return () => document.removeEventListener('kapolia-filter-open', onOtherOpen)
  }, [uid])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || dropRef.current?.contains(t)) return
      startClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const displayLabel  = active ? SCORE_OPTS.find(o => o.value === value)?.label ?? 'Correspondance' : 'Correspondance'
  const pillBg        = disabled ? 'transparent' : (active ? 'rgba(246,247,246,0.12)' : 'transparent')
  const pillBorder    = disabled ? 'rgba(255,255,255,0.15)' : (active ? 'rgba(246,247,246,0.65)' : 'rgba(255,255,255,0.28)')
  const pillColor     = disabled ? 'rgba(246,247,246,0.35)' : C.bg

  return (
    <div style={{ flexShrink: 0, position: 'relative' }}>
      <button
        ref={btnRef}
        onClick={handleToggle}
        onMouseEnter={() => { if (disabled) setTooltipVisible(true) }}
        onMouseLeave={() => setTooltipVisible(false)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '7px 12px', borderRadius: 20, fontSize: 14,
          fontWeight: active ? 600 : 400,
          border: `1.5px solid ${pillBorder}`,
          backgroundColor: pillBg, color: pillColor,
          cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          transition: 'all 0.12s',
        }}
      >
        {displayLabel}
        {!disabled && (
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
            <path d={open ? 'M2 6.5l3-3 3 3' : 'M2 3.5l3 3 3-3'} stroke="rgba(246,247,246,0.75)" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {tooltipVisible && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 6,
          backgroundColor: C.dark, color: C.white, fontSize: 12,
          padding: '6px 10px', borderRadius: 8, whiteSpace: 'nowrap',
          zIndex: 500, pointerEvents: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        }}>
          Complétez votre profil pour filtrer par correspondance
        </div>
      )}

      {(open || isClosing) && createPortal(
        <div ref={dropRef} data-kapolia-filter-portal="1" style={{
          position: 'fixed', top: dropPos.top, left: dropPos.left, minWidth: 180,
          backgroundColor: C.white, border: `1px solid ${C.sable}`,
          borderRadius: 12, padding: '6px 4px', zIndex: 400,
          boxShadow: '0 8px 24px rgba(0,0,0,0.13)',
          animation: isClosing ? 'none' : 'kapolia-motion-menu-open 160ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
          transformOrigin: 'top left',
        }}>
          {active && (
            <button
              onClick={() => { onChange(''); setOpen(false) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 12px', border: 'none', borderRadius: 8,
                backgroundColor: 'transparent', color: C.terracotta,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Toutes les offres
            </button>
          )}
          {SCORE_OPTS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value === value ? '' : opt.value); setOpen(false) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 12px', border: 'none', borderRadius: 8,
                backgroundColor: opt.value === value ? `${C.vert}12` : 'transparent',
                color: C.dark, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {opt.value === value && <svg width="11" height="9" viewBox="0 0 12 10" fill="none" style={{ marginRight: 5, verticalAlign: 'middle', flexShrink: 0 }}><path d="M1 5L4 8L11 1" stroke={C.vert} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

function ContratPillDropdown({
  value, dureeContrat, onChange, onDureeChange,
}: {
  value: string[]; dureeContrat: string
  onChange: (v: string[]) => void; onDureeChange: (v: string) => void
}) {
  const uid = useId()
  const [open, setOpen]       = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, minWidth: 190 })
  const btnRef  = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const active  = value.length > 0
  const showDuree = value.includes('CDD')

  function startClose() {
    if (!open) return
    const pref = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!pref && dropRef.current) {
      dropRef.current.getAnimations().forEach(a => a.cancel())
      setOpen(false); setIsClosing(true)
      dropRef.current.animate(
        [{ opacity: '1', transform: 'translateY(0) scale(1)' }, { opacity: '0', transform: 'translateY(-4px) scale(0.98)' }],
        { duration: 110, easing: 'ease-in', fill: 'forwards' }
      ).onfinish = () => setIsClosing(false)
    } else { setOpen(false) }
  }

  function handleToggle() {
    if (open) { startClose(); return }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const minW = Math.max(r.width, 190)
      const left = Math.min(r.left, largeurUtile() - minW - 8)
      setDropPos({ top: r.bottom + 6, left: Math.max(8, left), minWidth: minW })
      document.dispatchEvent(new CustomEvent('kapolia-filter-open', { detail: uid }))
    }
    setOpen(true)
  }

  useEffect(() => {
    function onOtherOpen(e: Event) {
      if ((e as CustomEvent).detail !== uid) setOpen(false)
    }
    document.addEventListener('kapolia-filter-open', onOtherOpen)
    return () => document.removeEventListener('kapolia-filter-open', onOtherOpen)
  }, [uid])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || dropRef.current?.contains(t)) return
      startClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])
  }

  const short1       = value.length === 1 ? value[0] : ''
  const displayLabel = value.length === 0 ? 'Contrat' : value.length === 1 ? short1 : `Contrat (${value.length})`
  const isMultiActive = value.length > 1
  const pillBg     = isMultiActive ? C.white : (active ? 'rgba(246,247,246,0.12)' : 'transparent')
  const pillBorder = isMultiActive ? C.vert  : (active ? 'rgba(246,247,246,0.65)' : 'rgba(255,255,255,0.28)')
  const pillColor  = isMultiActive ? C.vert  : C.bg
  const chevronSt  = isMultiActive ? C.vert  : 'rgba(246,247,246,0.75)'

  return (
    <div style={{ flexShrink: 0 }}>
      <button ref={btnRef} onClick={handleToggle} style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '7px 12px', borderRadius: 20, fontSize: 14,
        fontWeight: active ? 600 : 400,
        border: `1.5px solid ${pillBorder}`,
        backgroundColor: pillBg, color: pillColor,
        cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
        transition: 'all 0.12s',
      }}>
        {displayLabel}
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
          <path d={open ? 'M2 6.5l3-3 3 3' : 'M2 3.5l3 3 3-3'} stroke={chevronSt} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {(open || isClosing) && createPortal(
        <div ref={dropRef} data-kapolia-filter-portal="1" style={{
          position: 'fixed', top: dropPos.top, left: dropPos.left, minWidth: dropPos.minWidth,
          backgroundColor: C.white, border: `1px solid ${C.sable}`,
          borderRadius: 12, padding: '6px 4px', zIndex: 400,
          boxShadow: '0 8px 24px rgba(0,0,0,0.13)',
          animation: isClosing ? 'none' : 'kapolia-motion-menu-open 160ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
          transformOrigin: 'top left',
          maxHeight: '70vh', overflowY: 'auto',
        }}>
          {active && (
            <button
              onClick={() => { onChange([]); onDureeChange('') }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 12px', border: 'none', borderRadius: 8,
                backgroundColor: 'transparent', color: C.terracotta,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 2,
              }}
            >
              Tout décocher
            </button>
          )}
          {TYPES_CONTRAT.map(opt => {
            const sel = value.includes(opt)
            return (
              <button key={opt} onClick={() => toggle(opt)} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                padding: '8px 12px', border: 'none', borderRadius: 8,
                backgroundColor: sel ? `${C.vert}12` : 'transparent',
                color: sel ? C.vert : C.dark,
                fontSize: 13, fontWeight: sel ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <span style={{
                  width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                  border: `1.5px solid ${sel ? C.vert : C.sable}`,
                  backgroundColor: sel ? C.vert : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {sel && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5l2.5 2.5L8 1" stroke={C.white} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </span>
                {opt}
              </button>
            )
          })}

          {showDuree && (
            <div style={{
              marginTop: 4, paddingTop: 8,
              borderTop: `1px solid ${C.sable}`,
              animation: 'kapolia-contrat-duree 0.22s ease',
            }}>
              <div style={{
                fontSize: 11, color: C.grey, padding: '0 12px 6px',
                textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
              }}>
                Durée CDD
              </div>
              <button
                onClick={() => onDureeChange('')}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '7px 12px', border: 'none', borderRadius: 8,
                  backgroundColor: !dureeContrat ? `${C.vert}12` : 'transparent',
                  color: !dureeContrat ? C.vert : C.grey,
                  fontSize: 13, fontWeight: !dureeContrat ? 600 : 400,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Toutes durées
              </button>
              {DUREES_CONTRAT.map(d => (
                <button
                  key={d.value}
                  onClick={() => onDureeChange(d.value === dureeContrat ? '' : d.value)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '7px 12px', border: 'none', borderRadius: 8,
                    backgroundColor: dureeContrat === d.value ? `${C.vert}12` : 'transparent',
                    color: dureeContrat === d.value ? C.vert : C.dark,
                    fontSize: 13, fontWeight: dureeContrat === d.value ? 600 : 400,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {dureeContrat === d.value && (
                    <svg width="11" height="9" viewBox="0 0 12 10" fill="none" style={{ marginRight: 5, verticalAlign: 'middle', flexShrink: 0 }}>
                      <path d="M1 5L4 8L11 1" stroke={C.vert} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {d.label}
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

function AutresPillButton({
  mode, onModeChange,
  priseDePoste, onPriseDePosteChange,
}: {
  mode: string[]; onModeChange: (v: string[]) => void
  priseDePoste: string; onPriseDePosteChange: (v: string) => void
}) {
  const uid = useId()
  const [open, setOpen]           = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [panelPos, setPanelPos]   = useState({ top: 0, left: 0 })
  const btnRef   = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const count  = mode.length + (priseDePoste ? 1 : 0)
  const hasAny = count > 0

  function startClose() {
    if (!open) return
    const pref = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!pref && panelRef.current) {
      panelRef.current.getAnimations().forEach(a => a.cancel())
      setOpen(false); setIsClosing(true)
      panelRef.current.animate(
        [{ opacity: '1', transform: 'translateY(0) scale(1)' }, { opacity: '0', transform: 'translateY(-4px) scale(0.98)' }],
        { duration: 110, easing: 'ease-in', fill: 'forwards' }
      ).onfinish = () => setIsClosing(false)
    } else { setOpen(false) }
  }

  function handleToggle() {
    if (open) { startClose(); return }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const panelW = 520
      const leftRaw = r.right - panelW
      const left = Math.max(8, Math.min(leftRaw, largeurUtile() - panelW - 8))
      setPanelPos({ top: r.bottom + 6, left })
      document.dispatchEvent(new CustomEvent('kapolia-filter-open', { detail: uid }))
    }
    setOpen(true)
  }

  useEffect(() => {
    function onOtherOpen(e: Event) {
      if ((e as CustomEvent).detail !== uid) setOpen(false)
    }
    document.addEventListener('kapolia-filter-open', onOtherOpen)
    return () => document.removeEventListener('kapolia-filter-open', onOtherOpen)
  }, [uid])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return
      startClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const pillBg     = hasAny ? 'rgba(246,247,246,0.12)' : 'transparent'
  const pillBorder = hasAny ? 'rgba(246,247,246,0.65)' : 'rgba(255,255,255,0.28)'

  return (
    <div style={{ flexShrink: 0, position: 'relative' }}>
      <button ref={btnRef} onClick={handleToggle} style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '7px 12px', borderRadius: 20, fontSize: 14,
        fontWeight: hasAny ? 600 : 400,
        border: `1.5px solid ${pillBorder}`,
        backgroundColor: pillBg, color: C.bg,
        cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
        transition: 'all 0.12s',
      }}>
        Autres
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
          <path d={open ? 'M2 6.5l3-3 3 3' : 'M2 3.5l3 3 3-3'} stroke="rgba(246,247,246,0.75)" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {hasAny && (
        <div
          key={count}
          style={{
            position: 'absolute', top: -5, right: -5,
            width: 16, height: 16, borderRadius: '50%',
            backgroundColor: C.orange, color: C.white,
            fontSize: 10, fontWeight: 700, lineHeight: '16px', textAlign: 'center',
            pointerEvents: 'none',
            animation: 'kapolia-motion-badge-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {count}
        </div>
      )}

      {(open || isClosing) && createPortal(
        <div ref={panelRef} data-kapolia-filter-portal="1" style={{
          position: 'fixed', top: panelPos.top, left: panelPos.left, width: 520,
          backgroundColor: C.white, border: `1px solid ${C.sable}`,
          borderRadius: 14, zIndex: 400, overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.13)',
          animation: isClosing ? 'none' : 'kapolia-motion-menu-open 160ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
          transformOrigin: 'top right',
        }}>
          <div style={{ padding: '16px 20px' }}>

            {/* Télétravail */}
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 12, fontWeight: 600, color: C.grey,
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
              }}>
                Télétravail
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {Object.entries(TELETRAVAIL).map(([dbVal, label]) => {
                  const sel = mode.includes(dbVal)
                  return (
                    <button
                      key={dbVal}
                      onClick={() => onModeChange(sel ? mode.filter(v => v !== dbVal) : [...mode, dbVal])}
                      style={{
                        fontSize: 13, padding: '6px 11px', borderRadius: 999,
                        border: `1.5px solid ${sel ? 'rgba(194,97,31,0.45)' : C.sable}`,
                        backgroundColor: sel ? 'rgba(194,97,31,0.10)' : 'transparent',
                        color: sel ? C.orangeTexte : C.dark,
                        fontWeight: sel ? 600 : 400,
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Prise de poste */}
            <div>
              <div style={{
                fontSize: 12, fontWeight: 600, color: C.grey,
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
              }}>
                Prise de poste
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {PRISE_POSTE_OPTS.map(opt => {
                  const sel = priseDePoste === opt
                  return (
                    <button
                      key={opt}
                      onClick={() => onPriseDePosteChange(sel ? '' : opt)}
                      style={{
                        fontSize: 13, padding: '6px 11px', borderRadius: 999,
                        border: `1.5px solid ${sel ? 'rgba(194,97,31,0.45)' : C.sable}`,
                        backgroundColor: sel ? 'rgba(194,97,31,0.10)' : 'transparent',
                        color: sel ? C.orangeTexte : C.dark,
                        fontWeight: sel ? 600 : 400,
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                      }}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {hasAny && (
            <div style={{
              borderTop: `1px solid ${C.sable}`,
              padding: '12px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <button
                onClick={() => { onModeChange([]); onPriseDePosteChange('') }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, color: C.orangeTexte,
                  fontFamily: 'inherit', padding: 0,
                }}
              >
                Effacer
              </button>
              <span style={{ fontSize: 13, color: C.grey }}>
                {count} filtre{count > 1 ? 's' : ''} actif{count > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

function EmptyState({ hasFilters, onReset }: { hasFilters: boolean; onReset: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '72px 24px', textAlign: 'center' }}>
      <h3 style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 20, color: C.dark, margin: '0 0 8px' }}>
        {hasFilters ? 'Aucune offre ne correspond' : 'Aucune offre pour le moment'}
      </h3>
      <p style={{ fontSize: 14, color: C.grey, margin: '0 0 20px', maxWidth: 360, lineHeight: 1.65 }}>
        {hasFilters
          ? "Essayez d'élargir votre recherche ou de réinitialiser vos filtres."
          : 'Revenez bientôt : de nouvelles offres sont publiées régulièrement.'}
      </p>
      {hasFilters && (
        <button
          onClick={onReset}
          style={{
            padding: '10px 22px', borderRadius: 10, border: 'none',
            backgroundColor: C.terracotta, color: C.white,
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Réinitialiser les filtres
        </button>
      )}
    </div>
  )
}

// ─── Similaires scoring ───────────────────────────────────────────────────────

const SIM_EXP_ORDER = ['Sans expérience', '1-2 ans', '3-5 ans', '5-10 ans', '+10 ans']

function simSalMid(min?: number, max?: number) {
  if (min && max) return (min + max) / 2
  return min ?? max ?? 0
}

function scoreForSim(ref: Offre, cand: Offre): number {
  let s = 0
  if (ref.experience && cand.experience) {
    const ri = SIM_EXP_ORDER.indexOf(ref.experience)
    const ci = SIM_EXP_ORDER.indexOf(cand.experience)
    if (ri !== -1 && ci !== -1) {
      const d = Math.abs(ri - ci)
      if (d === 0) s += 2
      else if (d === 1) s += 1
    }
  }
  if (ref.type_contrat && cand.type_contrat === ref.type_contrat) s += 2
  const refMid = simSalMid(ref.salaire_min, ref.salaire_max)
  const candMid = simSalMid(cand.salaire_min, cand.salaire_max)
  if (refMid > 0 && candMid > 0 && Math.abs(refMid - candMid) / refMid <= 0.3) s += 1
  return s
}

function offreToSimilaire(o: Offre): OffreSimilaire {
  return { id: o.id, titre: o.titre, entreprise_nom: o.entreprise_nom, type_contrat: o.type_contrat, domaine: o.domaine, ville: o.ville, salaire_min: o.salaire_min, salaire_max: o.salaire_max, periode_salaire: o.periode_salaire, mode_travail: o.mode_travail }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OffresPage() {
  const router = useRouter()

  const { favIds, toggleFav } = useFavoris()

  const [profil, setProfil]           = useState<Profil | null>(null)
  const [offres, setOffres]           = useState<Offre[]>([])
  const [applied, setApplied]         = useState<Map<string, string>>(new Map())
  const [loading, setLoading]         = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [userId, setUserId]           = useState<string | null>(null)
  const [loadError, setLoadError]     = useState<string | null>(null)
  const [devMultiplier, setDevMultiplier] = useState(1)
  const [filters, setFilters]         = useState<Filters>(EMPTY_FILTERS)
  const [lieuCoords, setLieuCoords]   = useState<GeoCoords | null>(null)

  // Split view state
  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const [isSplit, setIsSplit]           = useState(false)
  const [panelApplying, setPanelApplying] = useState(false)

  // Ref to read selectedId in effects without adding it as a dependency
  const selectedIdRef = useRef<string | null>(null)
  selectedIdRef.current = selectedId

  const leftColRef       = useRef<HTMLDivElement>(null)
  const cardWrapperRef   = useRef<HTMLDivElement>(null)
  const scrollPosRef        = useRef(0)
  const scrollLockRef       = useRef(false)
  const devRenderStartRef   = useRef(0)

  // ── Animation state & refs ──────────────────────────────────────────────
  const [displayedOffres, setDisplayedOffresState] = useState<typeof offres>([])
  const displayedOffresRef  = useRef<typeof offres>([])
  const animInitializedRef  = useRef(false)
  const listContainerRef    = useRef<HTMLDivElement>(null)
  const detailPanelRef      = useRef<HTMLDivElement>(null)
  const cardRefsMap         = useRef<Map<string, HTMLElement>>(new Map())
  const prevPositionsRef    = useRef<Map<string, DOMRect>>(new Map())
  const filterTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const filteredRef         = useRef<typeof offres>([])
  const rouletteRafRef      = useRef<number | null>(null)

  function setDisplayedOffres(list: typeof offres) {
    displayedOffresRef.current = list
    setDisplayedOffresState(list)
  }

  function applyRoulette() {
    const col = leftColRef.current
    if (!col) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cardRefsMap.current.forEach(el => { el.style.transform = ''; el.style.opacity = ''; el.style.transformOrigin = '' })
      return
    }
    if (col.scrollHeight <= col.clientHeight + 1) {
      cardRefsMap.current.forEach(el => { el.style.transform = ''; el.style.opacity = ''; el.style.transformOrigin = '' })
      return
    }
    cardRefsMap.current.forEach(el => {
      if (!el.isConnected) return
      if (el.offsetParent !== col) return
      // Annule les animations terminées (fill:both/forwards) avant d'écrire les styles inline
      el.getAnimations().forEach(a => { if (a.playState === 'finished') a.cancel() })
      const h   = el.offsetHeight
      const top = el.offsetTop - col.scrollTop
      const bot = (col.scrollTop + col.clientHeight) - (el.offsetTop + el.offsetHeight)
      let t = 0, sens = 0, origin = '50% 50%'
      if      (top < 0) { t = Math.min(1, -top / h); sens =  1; origin = '50% 100%' }
      else if (bot < 0) { t = Math.min(1, -bot / h); sens = -1; origin = '50% 0%'   }
      if (t === 0) {
        el.style.transform = ''; el.style.opacity = ''; el.style.transformOrigin = ''
      } else {
        el.style.transformOrigin = origin
        el.style.transform       = `perspective(900px) rotateX(${sens * t * 38}deg) scale(${1 - 0.08 * t})`
        el.style.opacity         = String(1 - 0.55 * t)
      }
    })
  }

  function scheduleRoulette() {
    if (rouletteRafRef.current !== null) return
    rouletteRafRef.current = requestAnimationFrame(() => {
      rouletteRafRef.current = null
      applyRoulette()
    })
  }

  // ── Animation carte ↔ pastille ─────────────────────────────────────────
  const [cardHidden, setCardHidden] = useState(false)
  const [cardHeight, setCardHeight] = useState(0)

  // Mesure synchrone avant la première peinture, puis suivi par ResizeObserver
  useLayoutEffect(() => {
    const el = cardWrapperRef.current
    if (el) setCardHeight(el.getBoundingClientRect().height)
  }, [])

  useEffect(() => {
    const el = cardWrapperRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setCardHeight(el.getBoundingClientRect().height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Réinitialise lors du changement de mode
  useEffect(() => { setCardHidden(false); scrollPosRef.current = 0 }, [isSplit])

  // Écouteur scroll — mode split : colonne gauche
  useEffect(() => {
    if (!isSplit) return
    const el = leftColRef.current
    if (!el) return
    const node = el
    scrollPosRef.current = node.scrollTop
    function onScroll() {
      scheduleRoulette()
      // Correction 1 — ignorer les événements pendant et juste après une transition
      if (scrollLockRef.current) return

      // Correction 2 — ignorer quand on est en bout de liste (le navigateur
      // peut bumper scrollTop automatiquement lors d'un redimensionnement)
      if (node.scrollTop + node.clientHeight >= node.scrollHeight - 8) return

      const pos   = node.scrollTop
      const prev  = scrollPosRef.current
      const delta = pos - prev
      if (Math.abs(delta) < 8) return
      scrollPosRef.current = pos
      if (delta > 0 && pos > 120) {
        scrollLockRef.current = true
        setCardHidden(true)
        setTimeout(() => { scrollLockRef.current = false }, 320)
        setTimeout(scheduleRoulette, 270)
      } else if (delta < 0) {
        scrollLockRef.current = true
        setCardHidden(false)
        setTimeout(() => {
          scrollLockRef.current = false
          scrollPosRef.current = node.scrollTop
        }, 320)
        setTimeout(scheduleRoulette, 270)
      }
    }
    node.addEventListener('scroll', onScroll, { passive: true })
    return () => node.removeEventListener('scroll', onScroll)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSplit])

  void profil // used indirectly via scoring

  function update(partial: Partial<Filters>) {
    setFilters(prev => {
      const next = { ...prev, ...partial }
      if ('contrat' in partial && !next.contrat.includes('CDD')) next.duree_contrat = ''
      return next
    })
  }

  function resetFilters() { setFilters(EMPTY_FILTERS); setLieuCoords(null) }

  // ── Window resize → isSplit ────────────────────────────────────────────────
  useEffect(() => {
    const check = () => { setIsSplit(largeurUtile() >= 900); requestAnimationFrame(scheduleRoulette) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Roulette : init quand le mode split s'active ───────────────────────────
  useEffect(() => {
    if (isSplit) requestAnimationFrame(scheduleRoulette)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSplit])

  // ── Roulette : recalcul quand la colonne gauche change de hauteur ──────────
  // (bandeau vert qui se replie/déplie au défilement, resize fenêtre)
  useEffect(() => {
    if (!isSplit) return
    const col = leftColRef.current
    if (!col) return
    const ro = new ResizeObserver(scheduleRoulette)
    ro.observe(col)
    return () => ro.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSplit])


  // ── Init filters + selectedId from URL ────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    const p = new URLSearchParams(window.location.search)
    const patch: Partial<Filters> = {}
    if (p.get('q'))     patch.search         = p.get('q')!
    if (p.get('d'))     patch.domaine        = p.get('d')!.split(',').filter(Boolean)
    if (p.get('c'))     patch.contrat        = p.get('c')!.split(',').filter(Boolean)
    if (p.get('l'))     patch.lieu           = p.get('l')!
    if (p.get('m'))     patch.mode           = p.get('m')!.split(',').filter(Boolean)
    if (p.get('e'))     patch.exp            = p.get('e')!
    if (p.get('s'))     patch.salaire        = p.get('s')!
    if (p.get('dp'))    patch.date_pub       = p.get('dp')!
    if (p.get('lang'))  patch.langue         = p.get('lang')!.split(',').filter(Boolean)
    if (p.get('pp'))    patch.prise_de_poste = p.get('pp')!
    if (p.get('dc'))    patch.duree_contrat  = p.get('dc')!
    if (p.get('sm'))    patch.score_min      = p.get('sm')!
    if (p.get('tri'))   patch.tri            = p.get('tri') as SortKey
    if (p.get('r'))     patch.rayon          = p.get('r')!
    if (Object.keys(patch).length > 0) setFilters(prev => ({ ...prev, ...patch }))
    if (process.env.NODE_ENV === 'development') {
      const x = parseInt(p.get('x') ?? '1', 10)
      if (x > 1) setDevMultiplier(x)
    }
    const lat = p.get('lat'), lng = p.get('lng')
    if (lat && lng) setLieuCoords({ lat: parseFloat(lat), lng: parseFloat(lng) })
    if (p.get('offre')) setSelectedId(p.get('offre')!)
  }, [])

  // ── Sync filters + selectedId to URL ─────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    const p = new URLSearchParams()
    if (filters.search)              p.set('q',   filters.search)
    if (filters.domaine.length)      p.set('d',   filters.domaine.join(','))
    if (filters.contrat.length)      p.set('c',   filters.contrat.join(','))
    if (filters.lieu)                p.set('l',   filters.lieu)
    if (lieuCoords) { p.set('lat', lieuCoords.lat.toFixed(6)); p.set('lng', lieuCoords.lng.toFixed(6)) }
    if (filters.mode.length)         p.set('m',   filters.mode.join(','))
    if (filters.exp)             p.set('e',   filters.exp)
    if (filters.salaire)         p.set('s',   filters.salaire)
    if (filters.date_pub)        p.set('dp',  filters.date_pub)
    if (filters.langue.length)   p.set('lang', filters.langue.join(','))
    if (filters.prise_de_poste)  p.set('pp',  filters.prise_de_poste)
    if (filters.duree_contrat)   p.set('dc',  filters.duree_contrat)
    if (filters.score_min)       p.set('sm',  filters.score_min)
    if (filters.tri !== 'match') p.set('tri', filters.tri)
    if (filters.rayon !== '25')  p.set('r',   filters.rayon)
    if (selectedId)              p.set('offre', selectedId)
    const qs = p.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [filters, selectedId, lieuCoords])

  // ── Data load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setIsConnected(!!user)
      setUserId(user?.id ?? null)

      const [offresRes, profilRes, candidaturesRes] = await Promise.all([
        supabase.from('offres').select('*').eq('active', true).eq('statut_publication', 'publiée').gt('expire_at', new Date().toISOString()).order('created_at', { ascending: false }),
        user
          ? supabase.from('profils').select('domaine, experience, type_poste, valeur, disponibilite, ville, mode_travail, langues, competences_acquises').eq('user_id', user.id).single()
          : Promise.resolve({ data: null }),
        user
          ? supabase.from('candidatures').select('offre_id, created_at').eq('candidat_id', user.id)
          : Promise.resolve({ data: [] }),
      ])

      if (offresRes.error) {
        console.error('offres:', offresRes.error.message, offresRes.error.code)
        setLoadError('Impossible de charger les offres. Veuillez réessayer.')
        setLoading(false)
        return
      }

      const p: Profil | null = profilRes.data ?? null
      setProfil(p)

      const appliedMap = new Map<string, string>(
        (candidaturesRes.data ?? []).map((c: { offre_id: string; created_at: string }) => [c.offre_id, c.created_at])
      )
      setApplied(appliedMap)

      // ── Two-step : enrichir avec le profil entreprise du recruteur ──────────
      type RawOffre = Omit<Offre, 'score' | 'breakdown'>
      const offresRaw = (offresRes.data ?? []) as RawOffre[]
      const recruteurIds = [...new Set(offresRaw.map(o => o.recruteur_id).filter(Boolean))] as string[]
      const { data: profilsData } = recruteurIds.length > 0
        ? await supabase.from('profils_vue_publique').select('user_id, entreprise_nom, entreprise_logo_url').in('user_id', recruteurIds)
        : { data: [] as { user_id: string; entreprise_nom: string | null; entreprise_logo_url: string | null }[] }
      const profilMap = Object.fromEntries((profilsData ?? []).map(p => [p.user_id, p]))

      const scored: Offre[] = offresRaw.map((o) => {
        const ep = o.recruteur_id ? profilMap[o.recruteur_id] : undefined
        return {
          ...o,
          entreprise_nom:      ep?.entreprise_nom      ?? undefined,
          entreprise_logo_url: ep?.entreprise_logo_url ?? undefined,
          latitude:  o.latitude  != null ? parseFloat(o.latitude  as unknown as string) : undefined,
          longitude: o.longitude != null ? parseFloat(o.longitude as unknown as string) : undefined,
          ...(p ? (() => {
            const om = { ...o }
            const bd = scoreBreakdownCandidat(p as ProfilMatch, om)
            return { score: bd.total, breakdown: bd }
          })() : { score: null, breakdown: null }),
        }
      })

      setOffres(scored)
      setLoading(false)
    }
    load()
  }, [])

  async function handleApply(offreId: string) {
    if (!userId) return
    const { error } = await supabase.from('candidatures').insert({ candidat_id: userId, offre_id: offreId, statut: 'envoyée' })
    if (!error) setApplied(prev => new Map([...prev, [offreId, new Date().toISOString()]]))
  }


  async function handlePanelApply() {
    if (!isConnected) { router.push('/connexion'); return }
    if (!selectedId || applied.has(selectedId) || panelApplying) return
    setPanelApplying(true)
    await handleApply(selectedId)
    setPanelApplying(false)
  }

  const hasActiveFilters = !!(
    filters.search || filters.domaine.length > 0 || filters.contrat.length > 0 || filters.lieu ||
    filters.mode.length > 0 || filters.date_pub || filters.exp || filters.prise_de_poste ||
    filters.duree_contrat || filters.score_min || filters.langue.length > 0 || filters.salaire
  )

  // ── [DEV] duplication du tableau d'offres via ?x=N ───────────────────────
  const offresEffective = useMemo(() => {
    if (process.env.NODE_ENV !== 'development' || devMultiplier <= 1) return offres
    const result: Offre[] = []
    for (let i = 0; i < devMultiplier; i++) {
      offres.forEach(o => result.push(i === 0 ? o : { ...o, id: `${o.id}-x${i}` }))
    }
    return result
  }, [offres, devMultiplier])

  // ── Filter + sort pipeline ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (process.env.NODE_ENV === 'development') console.time('[DEV] pipeline')
    let list = [...offresEffective]
    let textScores: Map<string, number> | null = null
    let fuzzySearch: Set<string> | null = null
    let geoFallback: Set<string> | null = null

    if (filters.search.trim()) {
      const tokens = getTokens(filters.search)
      if (tokens.length > 0) {
        textScores  = new Map()
        fuzzySearch = new Set()
        list = list.flatMap(o => {
          const { score, fuzzy } = searchScore(o, tokens)
          if (score === 0) return []
          textScores!.set(o.id, score)
          if (fuzzy) fuzzySearch!.add(o.id)
          return [o]
        })
      }
    }

    if (filters.domaine.length > 0) {
      list = list.filter(o => filters.domaine.some(d => (o.domaine ?? '').toLowerCase().includes(d.toLowerCase())))
    }

    if (filters.contrat.length > 0) {
      list = list.filter(o => filters.contrat.includes(o.type_contrat ?? ''))
    }

    if (filters.lieu) {
      if (lieuCoords) {
        const maxKm    = filters.rayon === '0' ? 0 : parseInt(filters.rayon, 10) || 25
        const normLieu = normalizeText(filters.lieu)
        geoFallback    = new Set()
        list = list.filter(o => {
          if (o.latitude == null || o.longitude == null) {
            if (normalizeText(o.ville ?? '').includes(normLieu)) {
              geoFallback!.add(o.id)
              return true
            }
            return false
          }
          return haversineKm(lieuCoords, { lat: o.latitude, lng: o.longitude }) <= maxKm
        })
      } else {
        list = list.filter(o => (o.ville ?? '').toLowerCase().includes(filters.lieu.toLowerCase()))
      }
    }

    if (filters.mode.length > 0) {
      list = list.filter(o => filters.mode.includes(o.mode_travail ?? ''))
    }

    if (filters.exp) {
      list = list.filter(o => o.experience === filters.exp)
    }

    if (filters.salaire) {
      const minSalaire = parseInt(filters.salaire.replace(/[^\d]/g, ''))
      if (minSalaire > 0) {
        list = list.filter(o => (o.salaire_min ?? 0) >= minSalaire || (o.salaire_max ?? 0) >= minSalaire)
      }
    }

    if (filters.date_pub) {
      const MAX_DAYS: Record<string, number> = { "Aujourd'hui": 1, '3 derniers jours': 3, 'Cette semaine': 7, 'Ce mois-ci': 30 }
      const maxDays = MAX_DAYS[filters.date_pub]
      if (maxDays !== undefined) {
        list = list.filter(o => (Date.now() - new Date(o.created_at).getTime()) / 86400000 <= maxDays)
      }
    }

    if (filters.langue.length > 0) {
      list = list.filter(o => filters.langue.some(l => (o.langues ?? []).includes(l)))
    }

    if (filters.duree_contrat) {
      list = list.filter(o => o.type_contrat === 'CDD' && o.duree_contrat === filters.duree_contrat)
    }

    if (filters.prise_de_poste) {
      const POSTE_ALLOWED: Record<string, string[]> = {
        'Immédiate':    ['immediat'],
        'Dans le mois': ['immediat', 'mois'],
        'Dans 3 mois':  ['immediat', 'mois', 'trois_mois'],
      }
      const allowed = POSTE_ALLOWED[filters.prise_de_poste] ?? []
      if (allowed.length > 0) {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        list = list.filter(o => {
          const n = normaliserDebut(o.date_debut, today)
          return n !== null && allowed.includes(n)
        })
      }
    }

    if (filters.score_min) {
      const threshold = parseInt(filters.score_min, 10) / 100
      list = list.filter(o => o.score != null && o.score >= threshold)
    }

    switch (filters.tri) {
      case 'match':
        list.sort((a, b) => {
          if (a.score == null && b.score == null) return 0
          if (a.score == null) return 1
          if (b.score == null) return -1
          return b.score - a.score
        })
        break
      case 'recent':       list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break
      case 'salaire_asc':  list.sort((a, b) => (a.salaire_min ?? 0) - (b.salaire_min ?? 0)); break
      case 'salaire_desc': list.sort((a, b) => {
        const va = b.salaire_max ?? b.salaire_min ?? -1
        const vb = a.salaire_max ?? a.salaire_min ?? -1
        return va - vb
      }); break
      case 'alpha':        list.sort((a, b) => a.titre.localeCompare(b.titre, 'fr')); break
      case 'distance':
        if (lieuCoords) list.sort((a, b) => {
          const da = a.latitude != null && a.longitude != null ? haversineKm(lieuCoords, { lat: a.latitude, lng: a.longitude }) : Infinity
          const db = b.latitude != null && b.longitude != null ? haversineKm(lieuCoords, { lat: b.latitude, lng: b.longitude }) : Infinity
          return da - db
        })
        break
    }

    if (textScores) {
      list.sort((a, b) => (textScores!.get(b.id) ?? 0) - (textScores!.get(a.id) ?? 0))
    }

    if (fuzzySearch && fuzzySearch.size > 0 && fuzzySearch.size < list.length) {
      list.sort((a, b) => {
        const af = fuzzySearch!.has(a.id) ? 1 : 0
        const bf = fuzzySearch!.has(b.id) ? 1 : 0
        return af - bf
      })
    }

    if (geoFallback && geoFallback.size > 0) {
      list.sort((a, b) => {
        const af = geoFallback!.has(a.id) ? 1 : 0
        const bf = geoFallback!.has(b.id) ? 1 : 0
        return af - bf
      })
    }

    if (process.env.NODE_ENV === 'development') {
      console.timeEnd('[DEV] pipeline')
      console.time('[DEV] render-liste')
    }
    return list
  }, [offresEffective, filters, lieuCoords])

  filteredRef.current = filtered

  // ── Initialisation synchrone displayedOffres avant le premier paint ──────
  useLayoutEffect(() => {
    if (loading || animInitializedRef.current) return
    animInitializedRef.current = true
    setDisplayedOffres(filteredRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  // ── Transitions filtre : sortie + mise à jour différée ───────────────────
  useEffect(() => {
    if (loading || !animInitializedRef.current) return
    const prevIds = displayedOffresRef.current.map(o => o.id).join(',')
    const newIds  = filtered.map(o => o.id).join(',')
    if (prevIds === newIds) return
    const pref = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const posSnapshot = new Map<string, DOMRect>()
    cardRefsMap.current.forEach((el, id) => { if (el.isConnected) posSnapshot.set(id, el.getBoundingClientRect()) })
    prevPositionsRef.current = posSnapshot
    const prevIdSet  = new Set(displayedOffresRef.current.map(o => o.id))
    const newIdSet   = new Set(filtered.map(o => o.id))
    const leavingIds = filtered.length < displayedOffresRef.current.length
      ? [...prevIdSet].filter(id => !newIdSet.has(id))
      : []
    if (filterTimerRef.current) clearTimeout(filterTimerRef.current)
    if (leavingIds.length > 0 && !pref) {
      leavingIds.forEach(id => {
        const el = cardRefsMap.current.get(id)
        if (el?.isConnected) el.animate(
          [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.97)' }],
          { duration: 160, easing: 'ease-in', fill: 'forwards' }
        )
      })
      filterTimerRef.current = setTimeout(() => {
        filterTimerRef.current = null
        setDisplayedOffres(filteredRef.current)
        setTimeout(scheduleRoulette, 340)
      }, 165)
    } else {
      setDisplayedOffres(filtered)
      setTimeout(scheduleRoulette, 340)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, loading])

  // ── FLIP + entrée après mise à jour de displayedOffres ───────────────────
  useLayoutEffect(() => {
    if (!animInitializedRef.current || !isSplit) return
    const container = listContainerRef.current
    if (!container) return
    const pref = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cards = container.querySelectorAll<HTMLElement>('[data-card-id]')
    const newPositions = new Map<string, DOMRect>()
    cards.forEach(card => { newPositions.set(card.dataset.cardId!, card.getBoundingClientRect()) })
    if (!pref) {
      const prevPositions = prevPositionsRef.current
      const isEntrance    = prevPositions.size === 0
      if (isEntrance) {
        cards.forEach((card, i) => card.animate(
          [{ opacity: '0', transform: 'translateY(8px)' }, { opacity: '1', transform: 'translateY(0)' }],
          { duration: 420, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', delay: i * 45, fill: 'both' }
        ))
      } else {
        let enterIdx = 0
        cards.forEach(card => {
          const id   = card.dataset.cardId!
          const prev = prevPositions.get(id)
          const next = newPositions.get(id)!
          if (prev) {
            const dy = prev.top - next.top
            if (Math.abs(dy) > 1) card.animate(
              [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }],
              { duration: 320, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
            )
          } else {
            card.animate(
              [{ opacity: '0', transform: 'translateY(8px)' }, { opacity: '1', transform: 'translateY(0)' }],
              { duration: 360, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', delay: 120 + enterIdx * 30, fill: 'both' }
            )
            enterIdx++
          }
        })
      }
    }
    prevPositionsRef.current = newPositions
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedOffres])

  // ── Auto-select : first offre, or re-select after filter change ───────────
  useEffect(() => {
    if (loading) return
    if (filtered.length === 0) { setSelectedId(null); return }
    if (!selectedIdRef.current || !filtered.some(o => o.id === selectedIdRef.current)) {
      setSelectedId(filtered[0].id)
    }
  }, [filtered, loading])

  // ── Restore scroll position after returning from /offres/[id] ───────────────
  useEffect(() => {
    if (loading) return
    const offreId = sessionStorage.getItem('kapolia-offre-return')
    if (!offreId) return
    sessionStorage.removeItem('kapolia-offre-return')
    requestAnimationFrame(() => {
      document.getElementById(`offre-card-${offreId}`)?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
    })
  }, [loading])

  // Selected offre for the panel
  const selectedOffre = selectedId ? filtered.find(o => o.id === selectedId) ?? null : null

  // ── Offres similaires (computed from already-loaded list) ─────────────────
  const { similaires, similairesTitle } = useMemo<{ similaires: OffreSimilaire[]; similairesTitle: string }>(() => {
    if (!selectedOffre) return { similaires: [], similairesTitle: '' }
    const candidates = offresEffective.filter(o => o.id !== selectedOffre.id && !applied.has(o.id))

    // Phase 1: same domain
    const domainPool = selectedOffre.domaine ? candidates.filter(o => o.domaine === selectedOffre.domaine) : []
    if (domainPool.length >= 2) {
      const scored = domainPool
        .map(o => ({ o, score: scoreForSim(selectedOffre, o) }))
        .sort((a, b) => b.score - a.score || new Date(b.o.created_at).getTime() - new Date(a.o.created_at).getTime())
      const withExtra = scored.filter(({ score }) => score >= 1)
      if (withExtra.length >= 2) {
        return { similaires: withExtra.slice(0, 4).map(({ o }) => offreToSimilaire(o)), similairesTitle: 'Offres similaires' }
      }
      return {
        similaires: scored.slice(0, 4).map(({ o }) => offreToSimilaire(o)),
        similairesTitle: selectedOffre.domaine ? `Autres offres en ${selectedOffre.domaine}` : 'Autres offres',
      }
    }

    // Phase 2: zone fallback
    if (selectedOffre.latitude != null && selectedOffre.longitude != null) {
      const nearby = candidates.filter(o =>
        o.latitude != null && o.longitude != null &&
        haversineKm({ lat: selectedOffre.latitude!, lng: selectedOffre.longitude! }, { lat: o.latitude, lng: o.longitude }) < 50
      )
      if (nearby.length >= 2) {
        return {
          similaires: nearby.slice(0, 4).map(offreToSimilaire),
          similairesTitle: selectedOffre.ville ? `Autres offres près de ${selectedOffre.ville}` : 'Autres offres à proximité',
        }
      }
    }

    return { similaires: [], similairesTitle: '' }
  }, [selectedOffre, offresEffective, applied])

  // ── [DEV] fin du timer render-liste après commit DOM ─────────────────────
  useLayoutEffect(() => {
    if (process.env.NODE_ENV === 'development') console.timeEnd('[DEV] render-liste')
  }, [filtered])

  // ── Sélection carte + transition panneau droit ───────────────────────────
  function handleCardSelect(id: string) {
    if (id === selectedId) return
    const pref = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!pref && detailPanelRef.current) {
      detailPanelRef.current.getAnimations().forEach(a => a.cancel())
      const anim = detailPanelRef.current.animate(
        [{ opacity: '1' }, { opacity: '0' }],
        { duration: 100, easing: 'ease-out' }
      )
      anim.onfinish = () => {
        if (detailPanelRef.current) detailPanelRef.current.style.opacity = '0'
        setSelectedId(id)
      }
    } else {
      setSelectedId(id)
    }
  }

  useLayoutEffect(() => {
    const el = detailPanelRef.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.style.opacity = ''
    el.animate(
      [{ opacity: '0', transform: 'translateY(6px)' }, { opacity: '1', transform: 'translateY(0)' }],
      { duration: 240, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
    )
  }, [selectedId])

  // ── Navigation clavier : flèches haut/bas ────────────────────────────────
  useEffect(() => {
    if (!isSplit) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const tag = (document.activeElement as HTMLElement | null)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return
      if (document.querySelector('[data-kapolia-filter-portal]')) return
      const list = displayedOffresRef.current
      if (list.length === 0) return
      const curIdx = list.findIndex(o => o.id === selectedIdRef.current)
      let nextIdx  = curIdx
      if (e.key === 'ArrowDown') nextIdx = Math.min(list.length - 1, curIdx + 1)
      if (e.key === 'ArrowUp')   nextIdx = Math.max(0, curIdx - 1)
      if (nextIdx === curIdx) return
      e.preventDefault()
      const nextId = list[nextIdx].id
      handleCardSelect(nextId)
      requestAnimationFrame(() => {
        const el  = cardRefsMap.current.get(nextId)
        const col = leftColRef.current
        if (!el || !col) return
        el.focus({ preventScroll: true })
        const r    = el.getBoundingClientRect()
        const colR = col.getBoundingClientRect()
        if (r.top < colR.top || r.bottom > colR.bottom) {
          const pref = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          el.scrollIntoView({ block: 'nearest', behavior: pref ? 'instant' : 'smooth' })
        }
      })
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSplit])

  // ── Reusable list content (counter + sort + cards) ────────────────────────
  const listContent = (
    <>
      {/* Compteur + tri */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {(!loading && animInitializedRef.current) && (
          <>
            <span style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: C.dark }}>{filtered.length}</span>
              <span style={{ color: C.grey }}> offre{filtered.length !== 1 ? 's' : ''}</span>
            </span>
            <span style={{ color: C.lightGrey, fontSize: 13 }}>·</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 13, color: C.grey }}>
              Trier par
              <select
                className="kapolia-tri"
                value={filters.tri}
                onChange={e => update({ tri: e.target.value as SortKey })}
                style={{
                  border: 'none', background: 'none', fontFamily: 'inherit',
                  fontSize: 13, color: C.dark, fontWeight: 600,
                  cursor: 'pointer', outline: 'none', padding: '0 2px',
                }}
              >
                <option value="match">Meilleure correspondance</option>
                <option value="recent">Plus récentes</option>
                <option value="salaire_desc">Salaire décroissant</option>
                {lieuCoords && <option value="distance">Distance</option>}
              </select>
            </label>
          </>
        )}
      </div>

      {/* Contenu */}
      {(loading || !animInitializedRef.current) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : loadError ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: C.terracotta, fontSize: 14, fontWeight: 500 }}>
          {loadError}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasFilters={hasActiveFilters} onReset={resetFilters} />
      ) : (
        <div ref={listContainerRef} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {displayedOffres.map(offre => (
            <div
              key={offre.id}
              id={`offre-card-${offre.id}`}
              data-card-id={offre.id}
              tabIndex={-1}
              className="kapolia-card-wrapper"
              ref={el => {
                if (el) cardRefsMap.current.set(offre.id, el)
                else cardRefsMap.current.delete(offre.id)
              }}
            >
              <OffreCard
                offre={offre}
                applied={applied.has(offre.id)}
                saved={favIds.has(offre.id)}
                onApply={handleApply}
                onToggleSave={toggleFav}
                isConnected={isConnected}
                isSelected={isSplit && offre.id === selectedId}
                onSelect={isSplit ? handleCardSelect : undefined}
                searchCoords={lieuCoords}
              />
            </div>
          ))}
        </div>
      )}
    </>
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      backgroundColor: C.bg,
      ...(isSplit
        ? { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }
        : { minHeight: '100vh' }),
    }}>
      <style suppressHydrationWarning>{`
        @keyframes kapolia-spin   { to { transform: rotate(360deg); } }
        @keyframes kapolia-fadein { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes kapolia-contrat-duree { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes kapolia-pulse  { 0%, 100% { opacity: 1; } 50% { opacity: 0.42; } }
        @keyframes kapolia-slidein { from { transform: translateX(100%); } to { transform: translateX(0); } }
        * { box-sizing: border-box; }
        select { appearance: none; -webkit-appearance: none; }
        select.kapolia-tri { appearance: auto; -webkit-appearance: auto; }
        ::-webkit-scrollbar { display: none; }
        .kap-container-anim { transition: height 260ms ease; }
        .kap-layer-anim { transition: opacity 260ms ease, transform 260ms ease; }
        .kap-pill-btn { transition: transform 260ms ease; }
        @media (prefers-reduced-motion: reduce) { .kap-container-anim, .kap-layer-anim, .kap-pill-btn { transition: none !important; } }
        .kapolia-card-wrapper:focus, .kapolia-card-wrapper:focus-visible { outline: none; }
      `}</style>

      {/* ── CONTENEUR ANIMÉ — carte verte + pastille ─────────────────────────── */}
      <div
        className="kap-container-anim"
        style={{
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          ...(isSplit && cardHeight > 0 ? { height: cardHidden ? 44 : cardHeight } : {}),
        }}
      >

        {/* Couche 1 — carte verte */}
        <div
          ref={cardWrapperRef}
          className={isSplit ? 'kap-layer-anim' : undefined}
          style={isSplit ? {
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: '20px 24px 16px',
            opacity: cardHidden ? 0 : 1,
            transform: `scale(${cardHidden ? 0.82 : 1})`,
            transformOrigin: 'center 50%',
            pointerEvents: cardHidden ? 'none' : 'auto',
          } : {
            padding: '20px 24px 16px',
          }}
        >
          <div style={{
            backgroundColor: C.vert,
            borderRadius: CARD_RADIUS,
            boxShadow: '0 1px 2px rgba(27, 48, 38, .10), 0 6px 16px rgba(27, 48, 38, .14)',
            padding: '20px 24px 18px',
          }}>

            {/* Titre */}
            <h1 style={{
              fontFamily: FONT_SERIF, letterSpacing: '-0.005em',
              fontSize: 21, color: C.bg, fontWeight: 600,
              margin: '0 0 12px', lineHeight: 1.2,
            }}>
              Offres d&apos;emploi
            </h1>

            {/* Ligne 1 — recherche + lieu */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <div style={{ position: 'relative', flex: 2, minWidth: 180 }}>
                <div style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.lightGrey} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={filters.search}
                  onChange={e => update({ search: e.target.value })}
                  placeholder="Poste, compétence, entreprise…"
                  style={{
                    width: '100%', padding: '13px 36px 13px 36px', fontSize: 15, borderRadius: 10,
                    border: `1.5px solid ${filters.search ? C.terracotta : C.sable}`,
                    backgroundColor: C.white, color: C.dark,
                    outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s',
                  }}
                />
                {filters.search && (
                  <button onClick={() => update({ search: '' })} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.grey, fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
                )}
              </div>
              <LieuRadiusPopover
                lieu={filters.lieu}
                rayon={parseInt(filters.rayon, 10) || 25}
                coords={lieuCoords}
                onConfirm={(v, r, c) => {
                  update({ lieu: v, rayon: String(r), ...(c && filters.tri === 'match' ? { tri: 'distance' } : {}) })
                  setLieuCoords(c)
                }}
                dark
                compact
              />
            </div>

            {/* Ligne 2 — pills */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2,
            }}>
              <CorrespondancePill value={filters.score_min} onChange={v => update({ score_min: v })} profil={profil} isConnected={isConnected} />
              <ContratPillDropdown
                value={filters.contrat} dureeContrat={filters.duree_contrat}
                onChange={v => update({ contrat: v })} onDureeChange={v => update({ duree_contrat: v })}
              />
              <MultiPillDropdown dark label="Domaine"           value={filters.domaine}  options={DOMAINE_OPTS}  onChange={v => update({ domaine: v })} />
              <SalairePillDropdown value={filters.salaire} onChange={v => update({ salaire: v })} />
              <PillDropdown      dark label="Expérience"        value={filters.exp}      options={EXP_OPTS}      onChange={v => update({ exp: v })} />
              <LangPillDropdown  dark value={filters.langue} onChange={v => update({ langue: v })} />
              <PillDropdown      dark label="Date de publication" value={filters.date_pub} options={DATE_PUB_OPTS} onChange={v => update({ date_pub: v })} />
              <AutresPillButton
                mode={filters.mode} onModeChange={v => update({ mode: v })}
                priseDePoste={filters.prise_de_poste} onPriseDePosteChange={v => update({ prise_de_poste: v })}
              />

              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  style={{
                    fontSize: 13, color: 'rgba(246,247,246,0.75)', background: 'none', border: 'none',
                    cursor: 'pointer', fontFamily: 'inherit', fontWeight: 400,
                    flexShrink: 0, padding: '4px 4px',
                    textDecoration: 'underline', textDecorationColor: 'rgba(246,247,246,0.40)',
                  }}
                >
                  Tout effacer
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Couche 2 — pastille (split uniquement) */}
        {isSplit && (
          <div
            className="kap-layer-anim"
            aria-hidden={!cardHidden}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: cardHidden ? 1 : 0,
              transform: `scale(${cardHidden ? 1 : 0.1})`,
              transformOrigin: 'center center',
              pointerEvents: cardHidden ? 'auto' : 'none',
            }}
          >
            <button
              className="kap-pill-btn"
              style={{
                width: 36, height: 36,
                borderRadius: '50%', border: 'none', padding: 0,
                backgroundColor: C.vert, lineHeight: 0, cursor: 'pointer',
                outline: 'none',
                boxShadow: '0 2px 8px rgba(36, 69, 58, 0.32)',
                transform: cardHidden ? 'rotate(0deg)' : 'rotate(180deg)',
              }}
              onClick={() => setCardHidden(false)}
              title="Afficher la recherche et les filtres"
              aria-label="Afficher la recherche et les filtres"
            >
              <LogoKapolia
                avecTexte={false}
                taille={36}
                variante="sombre"
              />
            </button>
          </div>
        )}

      </div>


      {/* ── SPLIT VIEW (desktop ≥ 900px) ─────────────────────────────────────── */}
      {isSplit ? (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', justifyContent: 'center' }}>
          <div style={{ display: 'flex', width: '100%', maxWidth: 1500, overflow: 'hidden' }}>

            {/* Colonne gauche — liste scrollable ~32% */}
            <div ref={leftColRef} style={{
              width: '32%', minWidth: 280,
              overflowY: 'auto',
              borderRight: `1px solid ${C.sable}`,
              padding: '24px 24px 60px 20px',
              backgroundColor: C.bg,
              position: 'relative',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black 28px)',
              maskImage: 'linear-gradient(to bottom, transparent 0, black 28px)',
            }}>
              {listContent}
            </div>

            {/* Colonne droite */}
            <div style={{ flex: 1, overflowY: 'auto', backgroundColor: C.bg, padding: '0 20px 24px 16px', display: 'flex', flexDirection: 'column' }}>
              <div ref={detailPanelRef} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {selectedOffre ? (
                <OffreDetail
                  offre={selectedOffre}
                  applied={applied.has(selectedOffre.id)}
                  appliedDate={applied.get(selectedOffre.id) ?? null}
                  applying={panelApplying}
                  saved={favIds.has(selectedOffre.id)}
                  isConnected={isConnected}
                  similaires={similaires}
                  similairesTitle={similairesTitle}
                  onApply={handlePanelApply}
                  onToggleSave={() => toggleFav(selectedOffre.id)}
                  onSelectSimilaire={handleCardSelect}
                  mode="panel"
                  score={selectedOffre.score ?? null}
                  breakdown={selectedOffre.breakdown ?? null}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.grey, fontSize: 14 }}>
                  Sélectionnez une offre
                </div>
              )}
              </div>
            </div>
          </div>
        </div>

      ) : (
        /* ── LAYOUT MOBILE — liste normale ─────────────────────────────────── */
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 24px 80px' }}>
          {listContent}
        </div>
      )}

    </div>
  )
}
