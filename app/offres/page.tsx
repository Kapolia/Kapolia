'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { calculerScore, type ProfilMatch } from '@/lib/matching'
import { OffreDetail } from '@/components/OffreDetail'
import { type GeoCoords } from '@/components/GeoVilleInput'
import { LieuRadiusPopover } from '@/components/LieuRadiusPopover'
import { haversineKm } from '@/lib/geo'

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

type Profil = {
  domaine?: string
  experience?: string
  type_poste?: string[]
  valeur?: string
  disponibilite?: string | string[]
  ville?: string
}

type Offre = {
  id: string
  titre: string
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
  date_debut?: string
  created_at: string
  score: number
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
  taille: string
  secteur: string
  avantages: string[]
  date_pub: string
  langue: string
  type_ent: string
  prise_de_poste: string
  duree_contrat: string
  tri: SortKey
  rayon: string
}

const EMPTY_FILTERS: Filters = {
  search: '', domaine: [], contrat: [], lieu: '', mode: [], exp: '', salaire: '',
  taille: '', secteur: '', avantages: [], date_pub: '',
  langue: '', type_ent: '', prise_de_poste: '', duree_contrat: '', tri: 'match',
  rayon: '25',
}

// ─── Filter config ────────────────────────────────────────────────────────────

const DOMAINE_OPTS = [
  'Tech', 'Design', 'Marketing', 'Finance', 'Commerce', 'RH',
  'Santé', 'Juridique', 'Logistique', 'Communication',
  'Achats', 'Audit', 'Immobilier', 'Production', 'R&D',
]
const CONTRAT_OPTS = [
  'CDI', 'CDD', 'Freelance', 'Alternance', 'Stage',
  'Intérim', 'VIE', 'Portage salarial', 'Mission',
]
const MODE_OPTS       = ['100% présentiel', 'Hybride', '100% remote']
const EXP_OPTS        = ['Sans expérience', '1-2 ans', '3-5 ans', '5-10 ans', '+10 ans']
const SALAIRE_PILL_OPTS = ['25 000 €+', '35 000 €+', '45 000 €+', '55 000 €+', '70 000 €+']
const TAILLE_OPTS     = ['Startup (<50)', 'PME (50–250)', 'ETI (250–5000)', 'Grand groupe (+5000)']
const SECTEUR_OPTS    = [
  'SaaS / Logiciel', 'E-commerce', 'Fintech', 'Santé / MedTech', 'Industrie',
  'Retail', 'Média / Édition', 'Consulting', 'Énergie', 'BTP / Immobilier',
  'Agroalimentaire', 'Transport / Logistique', 'Tourisme', 'Sport', 'Education / EdTech', 'Luxe',
]
const AVANTAGES_OPTS  = [
  'Mutuelle', 'RTT', 'Tickets restaurant', 'Intéressement',
  'Stock options', 'Formation', 'Véhicule de fonction',
  'Remboursement transport', 'Télétravail', 'Salle de sport',
]
const DATE_PUB_OPTS   = ["Aujourd'hui", '3 derniers jours', '5 derniers jours', 'Cette semaine', 'Ce mois-ci']
const LANGUE_OPTS     = ['Français uniquement', 'Anglais requis', 'Bilingue', 'Autre']
const TYPE_ENT_OPTS   = ['Startup', 'ESN / SSII', 'Agence', 'PME', 'ETI', 'Grand groupe', 'Association / ONG']
const PRISE_POSTE_OPTS = ['Immédiat', 'Dans le mois', 'Dans 3 mois', 'Flexible']
const DUREE_OPTS      = ['< 3 mois', '3–6 mois', '6–12 mois', '> 12 mois']

const TRI_LABELS: Record<SortKey, string> = {
  match:        'Pertinence',
  recent:       'Plus récentes',
  salaire_asc:  'Salaire croissant',
  salaire_desc: 'Salaire décroissant',
  alpha:        'Alphabétique',
  distance:     'Distance',
}

// URL param mapping
const URL_MAP: Partial<Record<keyof Filters, string>> = {
  search: 'q', domaine: 'd', contrat: 'c', lieu: 'l', mode: 'm',
  exp: 'e', salaire: 's', taille: 'tai', secteur: 'sec', avantages: 'av',
  date_pub: 'dp', langue: 'lang', type_ent: 'te',
  prise_de_poste: 'pp', duree_contrat: 'dc', tri: 'tri', rayon: 'r',
}
void URL_MAP // used via spread in URL sync effects

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d === 0) return "aujourd'hui"
  if (d === 1) return 'il y a 1 jour'
  return `il y a ${d} jours`
}

function formatSalaire(min?: number, max?: number, periode?: string): string | null {
  if (!min && !max) return null
  const fmt = (n: number) => n.toLocaleString('fr-FR')
  const range = min && max ? `${fmt(min)} – ${fmt(max)} €` : `${fmt(min || max!)} €`
  const per = periode === 'mensuel' ? '/mois' : '/an'
  return range + per
}

function getEntrepriseNom(offre: Offre): string {
  return offre.entreprise_nom || 'Entreprise'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      backgroundColor: C.white, borderRadius: 14, padding: '20px 24px',
      border: `1px solid #EDE7DB`, borderLeft: `3px solid transparent`,
    }}>
      {([['68%', 18], ['42%', 13], ['28%', 11], ['88%', 12], ['55%', 12]] as [string, number][]).map(([w, h], i) => (
        <div key={i} style={{
          height: h, width: w, borderRadius: 6, backgroundColor: C.sable,
          marginBottom: i === 1 ? 14 : 8,
          animation: `kavio-pulse 1.6s ease-in-out ${i * 0.14}s infinite`,
        }} />
      ))}
    </div>
  )
}

function StarButton({ saved, onClick }: { saved: boolean; onClick: (e: React.MouseEvent) => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={saved ? 'Retirer des favoris' : 'Sauvegarder'}
      style={{
        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 8, border: `1px solid ${saved ? '#F59E0B50' : C.sable}`,
        backgroundColor: saved ? '#FEF3C730' : hov ? C.creme : 'transparent',
        cursor: 'pointer', fontSize: 16, transition: 'all 0.15s', flexShrink: 0,
      }}
    >
      {saved ? '★' : '☆'}
    </button>
  )
}

function PillDropdown({
  label, value, options, onChange, dark = false,
}: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; dark?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, minWidth: 190 })
  const btnRef  = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const active  = !!value

  function handleToggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 6, left: r.left, minWidth: Math.max(r.width, 190) })
    }
    setOpen(o => !o)
  }

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || dropRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const short        = value.length > 13 ? value.slice(0, 13) + '…' : value
  const displayLabel = active ? `${label} · ${short}` : label

  const pillBg        = dark ? (active ? C.creme   : 'transparent')            : (active ? C.vert  : C.white)
  const pillBorder    = dark ? (active ? C.creme   : 'rgba(255,255,255,0.30)') : (active ? C.vert  : C.sable)
  const pillColor     = dark ? (active ? C.vert    : 'rgba(255,255,255,0.90)') : (active ? C.white : C.dark)
  const chevronStroke = dark ? (active ? C.vert    : 'rgba(255,255,255,0.7)')  : (active ? C.white : C.grey)

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

      {open && (
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            top: dropPos.top,
            left: dropPos.left,
            minWidth: dropPos.minWidth,
            backgroundColor: C.white, border: `1px solid ${C.sable}`,
            borderRadius: 12, padding: '6px 4px', zIndex: 400,
            boxShadow: '0 8px 24px rgba(0,0,0,0.13)', animation: 'kavio-fadein 0.12s ease',
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
              {value === opt && <span style={{ color: C.vert, marginRight: 5, fontSize: 11 }}>✓</span>}
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MultiPillDropdown({
  label, value, options, onChange, dark = false,
}: {
  label: string; value: string[]; options: string[]; onChange: (v: string[]) => void; dark?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, minWidth: 190 })
  const btnRef  = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const active  = value.length > 0

  function handleToggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 6, left: r.left, minWidth: Math.max(r.width, 190) })
    }
    setOpen(o => !o)
  }

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || dropRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])
  }

  const displayLabel = value.length === 0
    ? label
    : value.length === 1
      ? `${label} · ${value[0].length > 13 ? value[0].slice(0, 13) + '…' : value[0]}`
      : `${label} (${value.length})`

  const pillBg        = dark ? (active ? C.creme   : 'transparent')            : (active ? C.vert  : C.white)
  const pillBorder    = dark ? (active ? C.creme   : 'rgba(255,255,255,0.30)') : (active ? C.vert  : C.sable)
  const pillColor     = dark ? (active ? C.vert    : 'rgba(255,255,255,0.90)') : (active ? C.white : C.dark)
  const chevronStroke = dark ? (active ? C.vert    : 'rgba(255,255,255,0.7)')  : (active ? C.white : C.grey)

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

      {open && (
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            top: dropPos.top,
            left: dropPos.left,
            minWidth: dropPos.minWidth,
            backgroundColor: C.white, border: `1px solid ${C.sable}`,
            borderRadius: 12, padding: '6px 4px', zIndex: 400,
            boxShadow: '0 8px 24px rgba(0,0,0,0.13)', animation: 'kavio-fadein 0.12s ease',
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
        </div>
      )}
    </div>
  )
}

function DrawerSelect({ label, value, onChange, options, placeholder = 'Tous' }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string
}) {
  const active = !!value
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: C.grey, textTransform: 'uppercase' as const, letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%', padding: '9px 30px 9px 12px', fontSize: 13, borderRadius: 10,
            border: `1.5px solid ${active ? C.vert : C.sable}`,
            backgroundColor: active ? `${C.vert}08` : C.white,
            color: active ? C.dark : C.grey,
            appearance: 'none', cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
          }}
        >
          <option value="">{placeholder}</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 3.5l3 3 3-3" stroke={C.grey} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  )
}

function DrawerAvantages({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: C.grey, textTransform: 'uppercase' as const, letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>
        Avantages
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {AVANTAGES_OPTS.map(av => {
          const sel = value.includes(av)
          return (
            <button
              key={av}
              type="button"
              onClick={() => onChange(sel ? value.filter(v => v !== av) : [...value, av])}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12,
                fontWeight: sel ? 600 : 400,
                border: `1.5px solid ${sel ? C.vert : C.sable}`,
                backgroundColor: sel ? `${C.vert}12` : C.white,
                color: sel ? C.vert : C.dark,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.1s',
              }}
            >
              {av}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function OffreCard({
  offre, applied, saved, onApply, onToggleSave, isConnected,
  isSelected = false, onSelect, searchCoords,
}: {
  offre: Offre; applied: boolean; saved: boolean
  onApply: (id: string) => void; onToggleSave: (id: string) => void; isConnected: boolean
  isSelected?: boolean; onSelect?: (id: string) => void
  searchCoords?: GeoCoords | null
}) {
  const [hov, setHov]           = useState(false)
  const [applying, setApplying] = useState(false)
  const router = useRouter()
  const compact = !!onSelect  // split view → compact card (Indeed-style)

  const entreprise = getEntrepriseNom(offre)
  const salaire    = formatSalaire(offre.salaire_min, offre.salaire_max, offre.periode_salaire)

  const distanceKm = searchCoords && offre.latitude != null && offre.longitude != null
    ? Math.round(haversineKm(searchCoords, { lat: offre.latitude, lng: offre.longitude }))
    : null

  async function handleApply() {
    if (!isConnected) { router.push('/connexion'); return }
    if (applied || applying) return
    setApplying(true)
    await onApply(offre.id)
    setApplying(false)
  }

  // ── Compact card (split view) — Indeed density ────────────────────────────
  if (compact) {
    return (
      <div
        onClick={() => onSelect!(offre.id)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          backgroundColor: isSelected ? `${C.terracotta}07` : C.white,
          border: `1px solid ${isSelected ? `${C.terracotta}55` : hov ? '#D4C4B0' : '#EDE7DB'}`,
          borderLeft: `3px solid ${isSelected ? C.terracotta : hov ? `${C.terracotta}70` : 'transparent'}`,
          borderRadius: 10,
          padding: '14px 16px 12px 13px',
          cursor: 'pointer',
          transition: 'border-color 0.15s, background-color 0.15s',
        }}
      >
        {/* Title + Star */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 5 }}>
          <span style={{
            flex: 1, fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700, lineHeight: 1.35,
            color: isSelected ? C.terracotta : hov ? C.terracotta : C.dark,
            transition: 'color 0.15s',
          }}>
            {offre.titre}
          </span>
          <StarButton saved={saved} onClick={e => { e.stopPropagation(); onToggleSave(offre.id) }} />
        </div>

        {/* Company · City */}
        <div style={{ fontSize: 13, color: C.grey, marginBottom: 10 }}>
          <span style={{ fontWeight: 600, color: '#444' }}>{entreprise}</span>
          {offre.ville && <span style={{ color: C.lightGrey }}> · {offre.ville}</span>}
        </div>

        {/* Badges: salaire, contrat, mode */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {salaire && (
            <span style={{ fontSize: 12, fontWeight: 700, backgroundColor: '#F0FDF4', color: '#16A34A', padding: '3px 10px', borderRadius: 20 }}>
              {salaire}
            </span>
          )}
          {offre.type_contrat && (
            <span style={{ fontSize: 12, fontWeight: 600, backgroundColor: `${C.terracotta}14`, color: C.terracotta, padding: '3px 10px', borderRadius: 20 }}>
              {offre.type_contrat}
            </span>
          )}
          {offre.mode_travail && (
            <span style={{
              fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
              backgroundColor: offre.mode_travail === '100% remote' ? `${C.vert}14` : offre.mode_travail === 'Hybride' ? '#7B5EA714' : `${C.dark}0A`,
              color: offre.mode_travail === '100% remote' ? C.vert : offre.mode_travail === 'Hybride' ? '#7B5EA7' : C.grey,
            }}>
              {offre.mode_travail}
            </span>
          )}
          {applied && (
            <span style={{ fontSize: 12, fontWeight: 600, backgroundColor: `${C.vert}15`, color: C.vert, padding: '3px 10px', borderRadius: 20 }}>
              ✓ Candidature envoyée
            </span>
          )}
          {distanceKm != null && (
            <span style={{ fontSize: 12, fontWeight: 500, backgroundColor: '#EEF2FF', color: '#4338CA', padding: '3px 10px', borderRadius: 20 }}>
              à {distanceKm} km
            </span>
          )}
        </div>
      </div>
    )
  }

  // ── Full card (mobile) ────────────────────────────────────────────────────
  return (
    <div
      onClick={() => router.push(`/offres/${offre.id}`)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        backgroundColor: C.white,
        border: `1px solid ${hov ? '#D4C4B0' : '#EDE7DB'}`,
        borderLeft: `3px solid ${hov ? C.terracotta : 'transparent'}`,
        borderRadius: 14,
        padding: '18px 22px 16px 21px',
        display: 'flex', flexDirection: 'column', gap: 11,
        boxShadow: hov ? '0 4px 18px rgba(44,74,62,0.09)' : '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.18s, border-color 0.18s, border-left-color 0.18s',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700,
            color: hov ? C.terracotta : C.dark,
            margin: '0 0 4px', lineHeight: 1.3, transition: 'color 0.15s',
          }}>
            {offre.titre}
          </h3>
          <div style={{ fontSize: 13, color: C.grey, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            <span style={{ fontWeight: 600, color: C.dark }}>{entreprise}</span>
            {offre.ville && <><span style={{ color: C.lightGrey }}>·</span><span>{offre.ville}</span></>}
            <span style={{ color: C.lightGrey }}>·</span>
            <span style={{ fontSize: 11, color: C.lightGrey }}>{daysSince(offre.created_at)}</span>
          </div>
        </div>
        <StarButton saved={saved} onClick={e => { e.stopPropagation(); onToggleSave(offre.id) }} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {offre.type_contrat && (
          <span style={{ fontSize: 11, fontWeight: 600, backgroundColor: `${C.terracotta}14`, color: C.terracotta, padding: '3px 9px', borderRadius: 20 }}>
            {offre.type_contrat}
          </span>
        )}
        {offre.mode_travail && (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
            backgroundColor: offre.mode_travail === '100% remote' ? `${C.vert}14` : offre.mode_travail === 'Hybride' ? '#7B5EA714' : `${C.dark}0A`,
            color: offre.mode_travail === '100% remote' ? C.vert : offre.mode_travail === 'Hybride' ? '#7B5EA7' : C.grey,
          }}>
            {offre.mode_travail}
          </span>
        )}
        {offre.experience && (
          <span style={{ fontSize: 11, fontWeight: 500, backgroundColor: C.creme, color: C.grey, padding: '3px 9px', borderRadius: 20, border: `1px solid ${C.sable}` }}>
            {offre.experience}
          </span>
        )}
        {salaire && (
          <span style={{ fontSize: 11, fontWeight: 600, backgroundColor: '#F0FDF4', color: '#16A34A', padding: '3px 9px', borderRadius: 20 }}>
            {salaire}
          </span>
        )}
        {distanceKm != null && (
          <span style={{ fontSize: 11, fontWeight: 500, backgroundColor: '#EEF2FF', color: '#4338CA', padding: '3px 9px', borderRadius: 20 }}>
            à {distanceKm} km
          </span>
        )}
      </div>

      {offre.description && (
        <p style={{
          fontSize: 13, color: C.grey, margin: 0, lineHeight: 1.6,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {offre.description}
        </p>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        paddingTop: 10, borderTop: `1px solid ${C.sable}`,
      }}>
        {applied ? (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            backgroundColor: `${C.vert}10`, color: C.vert,
            border: `1px solid ${C.vert}30`, padding: '6px 14px',
            borderRadius: 8, fontSize: 12, fontWeight: 600,
          }}>
            <svg width="11" height="9" viewBox="0 0 12 10" fill="none">
              <path d="M1 5L4 8L11 1" stroke={C.vert} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Candidature envoyée
          </div>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); handleApply() }}
            disabled={applying}
            style={{
              color: applying ? C.grey : C.terracotta,
              backgroundColor: 'transparent',
              border: `1.5px solid ${applying ? C.sable : `${C.terracotta}40`}`,
              borderRadius: 8, padding: '6px 16px', fontSize: 12, fontWeight: 600,
              cursor: applying ? 'default' : 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            {applying ? (
              <>
                <div style={{ width: 11, height: 11, borderRadius: '50%', border: `2px solid ${C.sable}`, borderTopColor: C.terracotta, animation: 'kavio-spin 0.7s linear infinite' }} />
                Envoi…
              </>
            ) : 'Postuler en 1 clic'}
          </button>
        )}
      </div>
    </div>
  )
}

function EmptyState({ hasFilters, onReset }: { hasFilters: boolean; onReset: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '72px 24px', textAlign: 'center' }}>
      <div style={{
        width: 68, height: 68, borderRadius: '50%',
        backgroundColor: C.creme, border: `2px solid ${C.sable}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, marginBottom: 18,
      }}>
        {hasFilters ? '🔍' : '📭'}
      </div>
      <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: C.dark, margin: '0 0 8px' }}>
        {hasFilters ? 'Aucune offre ne correspond' : 'Aucune offre pour le moment'}
      </h3>
      <p style={{ fontSize: 14, color: C.grey, margin: '0 0 20px', maxWidth: 360, lineHeight: 1.65 }}>
        {hasFilters
          ? "Essayez d'élargir votre recherche ou de réinitialiser vos filtres."
          : 'Revenez bientôt — de nouvelles offres sont publiées régulièrement.'}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OffresPage() {
  const router = useRouter()

  const [profil, setProfil]           = useState<Profil | null>(null)
  const [offres, setOffres]           = useState<Offre[]>([])
  const [applied, setApplied]         = useState<Map<string, string>>(new Map())
  const [saved, setSaved]             = useState<Set<string>>(new Set())
  const [loading, setLoading]         = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [userId, setUserId]           = useState<string | null>(null)
  const [loadError, setLoadError]     = useState<string | null>(null)
  const [filters, setFilters]         = useState<Filters>(EMPTY_FILTERS)
  const [lieuCoords, setLieuCoords]   = useState<GeoCoords | null>(null)
  const [drawerOpen, setDrawerOpen]   = useState(false)

  // Split view state
  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const [isSplit, setIsSplit]           = useState(false)
  const [panelApplying, setPanelApplying] = useState(false)

  // Ref to read selectedId in effects without adding it as a dependency
  const selectedIdRef = useRef<string | null>(null)
  selectedIdRef.current = selectedId

  const [bandeauCollapsed, setBandeauCollapsed] = useState(false)
  const leftColRef = useRef<HTMLDivElement>(null)

  void profil // used indirectly via scoring

  function update(partial: Partial<Filters>) {
    setFilters(prev => ({ ...prev, ...partial }))
  }

  function resetFilters() { setFilters(EMPTY_FILTERS); setLieuCoords(null) }

  // ── Window resize → isSplit ────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsSplit(window.innerWidth >= 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── Bandeau scroll retraction ─────────────────────────────────────────────
  useEffect(() => {
    setBandeauCollapsed(false)
    if (!isSplit) return
    const el = leftColRef.current
    if (!el) return
    const fn = () => setBandeauCollapsed(el.scrollTop > 80)
    el.addEventListener('scroll', fn, { passive: true })
    return () => el.removeEventListener('scroll', fn)
  }, [isSplit])

  useEffect(() => {
    if (isSplit) return
    const fn = () => setBandeauCollapsed(window.scrollY > 80)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
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
    if (p.get('tai'))   patch.taille         = p.get('tai')!
    if (p.get('sec'))   patch.secteur        = p.get('sec')!
    if (p.get('av'))    patch.avantages      = p.get('av')!.split(',').filter(Boolean)
    if (p.get('dp'))    patch.date_pub       = p.get('dp')!
    if (p.get('lang'))  patch.langue         = p.get('lang')!
    if (p.get('te'))    patch.type_ent       = p.get('te')!
    if (p.get('pp'))    patch.prise_de_poste = p.get('pp')!
    if (p.get('dc'))    patch.duree_contrat  = p.get('dc')!
    if (p.get('tri'))   patch.tri            = p.get('tri') as SortKey
    if (p.get('r'))     patch.rayon          = p.get('r')!
    if (Object.keys(patch).length > 0) setFilters(prev => ({ ...prev, ...patch }))
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
    if (filters.taille)          p.set('tai', filters.taille)
    if (filters.secteur)         p.set('sec', filters.secteur)
    if (filters.avantages.length) p.set('av', filters.avantages.join(','))
    if (filters.date_pub)        p.set('dp',  filters.date_pub)
    if (filters.langue)          p.set('lang',filters.langue)
    if (filters.type_ent)        p.set('te',  filters.type_ent)
    if (filters.prise_de_poste)  p.set('pp',  filters.prise_de_poste)
    if (filters.duree_contrat)   p.set('dc',  filters.duree_contrat)
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

      const [offresRes, profilRes, candidaturesRes, favoritesRes] = await Promise.all([
        supabase.from('offres').select('*').eq('active', true).eq('statut_publication', 'publiée').order('created_at', { ascending: false }),
        user
          ? supabase.from('profils').select('domaine, experience, type_poste, valeur, disponibilite, ville').eq('user_id', user.id).single()
          : Promise.resolve({ data: null }),
        user
          ? supabase.from('candidatures').select('offre_id, created_at').eq('candidat_id', user.id)
          : Promise.resolve({ data: [] }),
        user
          ? supabase.from('offres_favorites').select('offre_id').eq('candidat_id', user.id)
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
      setSaved(new Set((favoritesRes.data ?? []).map((f: { offre_id: string }) => f.offre_id)))

      const scored: Offre[] = (offresRes.data ?? []).map((o: Omit<Offre, 'score'>) => ({
        ...o,
        latitude:  o.latitude  != null ? parseFloat(o.latitude  as unknown as string) : undefined,
        longitude: o.longitude != null ? parseFloat(o.longitude as unknown as string) : undefined,
        score: p ? calculerScore(p as ProfilMatch, o as Parameters<typeof calculerScore>[1]) : 0,
      }))

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

  async function handleToggleSave(offreId: string) {
    if (!isConnected) { router.push('/connexion'); return }
    if (!userId) return
    const isSaved = saved.has(offreId)
    setSaved(prev => {
      const next = new Set(prev)
      if (isSaved) next.delete(offreId)
      else next.add(offreId)
      return next
    })
    if (isSaved) {
      const { error } = await supabase.from('offres_favorites')
        .delete().eq('candidat_id', userId).eq('offre_id', offreId)
      if (error) {
        console.error('Erreur retrait favori:', error.message)
        setSaved(prev => { const next = new Set(prev); next.add(offreId); return next })
      }
    } else {
      const { error } = await supabase.from('offres_favorites')
        .insert({ candidat_id: userId, offre_id: offreId })
      if (error) {
        console.error('Erreur ajout favori:', error.message)
        setSaved(prev => { const next = new Set(prev); next.delete(offreId); return next })
      }
    }
  }

  async function handlePanelApply() {
    if (!isConnected) { router.push('/connexion'); return }
    if (!selectedId || applied.has(selectedId) || panelApplying) return
    setPanelApplying(true)
    await handleApply(selectedId)
    setPanelApplying(false)
  }

  // ── Drawer filter count ───────────────────────────────────────────────────
  const drawerActiveCount = [
    filters.exp, filters.taille, filters.secteur,
    filters.langue, filters.type_ent, filters.prise_de_poste, filters.duree_contrat,
  ].filter(Boolean).length + filters.avantages.length

  const hasActiveFilters = !!(
    filters.search || filters.domaine.length > 0 || filters.contrat.length > 0 || filters.lieu ||
    filters.mode.length > 0 || filters.date_pub || drawerActiveCount > 0
  )

  const searchSummary = [
    filters.search,
    filters.lieu
      ? (parseInt(filters.rayon, 10) > 0
          ? `${filters.lieu} + ${filters.rayon} km`
          : filters.lieu)
      : '',
  ].filter(Boolean).join(' · ')

  const activeFilterCount = [
    !!filters.search, !!filters.lieu,
    filters.contrat.length > 0, filters.domaine.length > 0,
    filters.mode.length > 0, !!filters.exp, !!filters.salaire,
    filters.avantages.length > 0, !!filters.date_pub, !!filters.taille,
    !!filters.secteur, !!filters.langue, !!filters.type_ent,
    !!filters.prise_de_poste, !!filters.duree_contrat,
  ].filter(Boolean).length

  // ── Filter + sort pipeline ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...offres]

    if (filters.search.trim()) {
      const q = filters.search.toLowerCase()
      list = list.filter(o =>
        o.titre.toLowerCase().includes(q) ||
        getEntrepriseNom(o).toLowerCase().includes(q) ||
        (o.ville ?? '').toLowerCase().includes(q) ||
        (o.description ?? '').toLowerCase().includes(q) ||
        (o.domaine ?? '').toLowerCase().includes(q)
      )
    }

    if (filters.domaine.length > 0) {
      list = list.filter(o => filters.domaine.some(d => (o.domaine ?? '').toLowerCase().includes(d.toLowerCase())))
    }

    if (filters.contrat.length > 0) {
      list = list.filter(o => filters.contrat.includes(o.type_contrat ?? ''))
    }

    if (filters.lieu) {
      if (lieuCoords) {
        const maxKm = filters.rayon === '0' ? 0 : parseInt(filters.rayon, 10) || 25
        list = list.filter(o => {
          if (o.latitude == null || o.longitude == null) return false
          const km = haversineKm(lieuCoords, { lat: o.latitude, lng: o.longitude })
          return km <= maxKm
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
      const MAX_DAYS: Record<string, number> = { "Aujourd'hui": 1, '3 derniers jours': 3, '5 derniers jours': 5, 'Cette semaine': 7, 'Ce mois-ci': 30 }
      const maxDays = MAX_DAYS[filters.date_pub]
      if (maxDays !== undefined) {
        list = list.filter(o => (Date.now() - new Date(o.created_at).getTime()) / 86400000 <= maxDays)
      }
    }

    if (filters.avantages.length > 0) {
      list = list.filter(o => filters.avantages.every(av => (o.avantages ?? []).includes(av)))
    }

    switch (filters.tri) {
      case 'match':        list.sort((a, b) => b.score - a.score); break
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

    return list
  }, [offres, filters, lieuCoords])

  // ── Auto-select : first offre, or re-select after filter change ───────────
  useEffect(() => {
    if (loading) return
    if (filtered.length === 0) { setSelectedId(null); return }
    if (!selectedIdRef.current || !filtered.some(o => o.id === selectedIdRef.current)) {
      setSelectedId(filtered[0].id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, loading])

  // Selected offre for the panel
  const selectedOffre = selectedId ? filtered.find(o => o.id === selectedId) ?? null : null

  // ── Reusable list content (counter + sort + cards) ────────────────────────
  const listContent = (
    <>
      {/* Compteur + tri */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {!loading && (
          <>
            <span style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: C.dark }}>{filtered.length}</span>
              <span style={{ color: C.grey }}> offre{filtered.length !== 1 ? 's' : ''}</span>
            </span>
            <span style={{ color: C.lightGrey, fontSize: 13 }}>·</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 13, color: C.grey }}>
              Trier par
              <select
                className="kavio-tri"
                value={filters.tri}
                onChange={e => update({ tri: e.target.value as SortKey })}
                style={{
                  border: 'none', background: 'none', fontFamily: 'inherit',
                  fontSize: 13, color: C.dark, fontWeight: 600,
                  cursor: 'pointer', outline: 'none', padding: '0 2px',
                }}
              >
                <option value="match">Pertinence</option>
                <option value="recent">Plus récentes</option>
                <option value="salaire_desc">Salaire décroissant</option>
                {lieuCoords && <option value="distance">Distance</option>}
              </select>
            </label>
          </>
        )}
      </div>

      {/* Contenu */}
      {loading ? (
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map(offre => (
            <OffreCard
              key={offre.id}
              offre={offre}
              applied={applied.has(offre.id)}
              saved={saved.has(offre.id)}
              onApply={handleApply}
              onToggleSave={handleToggleSave}
              isConnected={isConnected}
              isSelected={isSplit && offre.id === selectedId}
              onSelect={isSplit ? setSelectedId : undefined}
              searchCoords={lieuCoords}
            />
          ))}
        </div>
      )}
    </>
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      backgroundColor: C.creme,
      marginLeft: 64,
      ...(isSplit
        ? { height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }
        : { minHeight: '100vh' }),
    }}>
      <style suppressHydrationWarning>{`
        @keyframes kavio-spin   { to { transform: rotate(360deg); } }
        @keyframes kavio-fadein { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes kavio-pulse  { 0%, 100% { opacity: 1; } 50% { opacity: 0.42; } }
        @keyframes kavio-slidein { from { transform: translateX(100%); } to { transform: translateX(0); } }
        * { box-sizing: border-box; }
        select { appearance: none; -webkit-appearance: none; }
        select.kavio-tri { appearance: auto; -webkit-appearance: auto; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── BANDEAU VERT ────────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: C.vert,
        position: isSplit ? 'relative' : 'sticky',
        top: 0,
        zIndex: isSplit ? undefined : 100,
        flexShrink: 0,
      }}>

        {/* Contenu complet — se rétracte via grid-template-rows */}
        <div style={{
          display: 'grid',
          gridTemplateRows: bandeauCollapsed ? '0fr' : '1fr',
          transition: 'grid-template-rows 220ms cubic-bezier(.4,0,.2,1)',
        }}>
          <div style={{ overflow: 'hidden' }}>
            <div style={{
              maxWidth: 800, margin: '0 auto', padding: '14px 20px 12px',
              opacity: bandeauCollapsed ? 0 : 1,
              transition: 'opacity 120ms ease',
            }}>

              {/* Titre */}
              <p style={{
                fontFamily: 'Georgia, serif', fontStyle: 'italic',
                fontSize: 21, color: C.creme, fontWeight: 400,
                margin: '0 0 12px', lineHeight: 1.2,
              }}>
                Offres d&apos;emploi
              </p>

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
                      border: `1.5px solid ${filters.search ? C.terracotta : 'rgba(255,255,255,0.18)'}`,
                      backgroundColor: 'rgba(255,255,255,0.97)', color: C.dark,
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
                <button
                  style={{
                    padding: '13px 22px', borderRadius: 10, border: 'none',
                    backgroundColor: C.terracotta, color: C.white,
                    fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                  }}
                >
                  Rechercher
                </button>
              </div>

              {/* Ligne 2 — pills */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2,
              }}>
                <MultiPillDropdown dark label="Contrat"  value={filters.contrat}  options={CONTRAT_OPTS}  onChange={v => update({ contrat: v })} />
                <MultiPillDropdown dark label="Domaine"  value={filters.domaine}  options={DOMAINE_OPTS}  onChange={v => update({ domaine: v })} />
                <MultiPillDropdown dark label="Mode"     value={filters.mode}     options={MODE_OPTS}          onChange={v => update({ mode: v })} />
                <PillDropdown      dark label="Salaire"  value={filters.salaire}  options={SALAIRE_PILL_OPTS}  onChange={v => update({ salaire: v })} />
                <PillDropdown      dark label="Date"     value={filters.date_pub} options={DATE_PUB_OPTS}      onChange={v => update({ date_pub: v })} />

                <button
                  onClick={() => setDrawerOpen(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '7px 12px', borderRadius: 20, fontSize: 14,
                    fontWeight: drawerActiveCount > 0 ? 600 : 400,
                    border: `1.5px solid ${drawerActiveCount > 0 ? C.creme : 'rgba(255,255,255,0.30)'}`,
                    backgroundColor: drawerActiveCount > 0 ? C.creme : 'transparent',
                    color: drawerActiveCount > 0 ? C.vert : C.creme,
                    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, transition: 'all 0.12s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
                  </svg>
                  Filtres
                  {drawerActiveCount > 0 && (
                    <span style={{
                      backgroundColor: C.vert, color: C.creme, borderRadius: '50%',
                      width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, flexShrink: 0,
                    }}>
                      {drawerActiveCount}
                    </span>
                  )}
                </button>

                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    style={{
                      fontSize: 13, color: C.creme, background: 'none', border: 'none',
                      cursor: 'pointer', fontFamily: 'inherit', fontWeight: 400,
                      flexShrink: 0, padding: '4px 4px',
                      textDecoration: 'underline', textDecorationColor: `${C.creme}70`,
                    }}
                  >
                    Tout effacer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Barre compacte — s'affiche au scroll */}
        <div style={{
          display: 'grid',
          gridTemplateRows: bandeauCollapsed ? '1fr' : '0fr',
          transition: 'grid-template-rows 220ms cubic-bezier(.4,0,.2,1)',
        }}>
          <div style={{ overflow: 'hidden' }}>
            <button
              onClick={() => setBandeauCollapsed(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '0 20px', height: 54,
                background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                opacity: bandeauCollapsed ? 1 : 0,
                transition: 'opacity 160ms ease 60ms',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.70)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span style={{
                flex: 1, textAlign: 'left', fontSize: 15, fontWeight: 600,
                color: C.creme, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {searchSummary || 'Toutes les offres'}
              </span>
              {activeFilterCount > 0 && (
                <span style={{
                  fontSize: 12, color: C.creme,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {activeFilterCount} filtre{activeFilterCount > 1 ? 's' : ''}
                </span>
              )}
              <svg width="13" height="13" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5l3 3 3-3" stroke="rgba(255,255,255,0.70)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Vague maritime */}
        <svg
          viewBox="0 0 1440 28"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ display: 'block', width: '100%', height: 28, marginBottom: -1 }}
        >
          <path d="M0,14 C320,28 640,0 960,14 C1120,21 1300,6 1440,14 L1440,28 L0,28 Z" fill={C.creme} />
        </svg>
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
              padding: '20px 20px 60px 16px',
              backgroundColor: C.creme,
            }}>
              {listContent}
            </div>

            {/* Colonne droite — carte flottante sur fond sable */}
            <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#F0EBE3', padding: '20px 20px 24px 16px', display: 'flex', flexDirection: 'column' }}>
              {selectedOffre ? (
                <OffreDetail
                  offre={selectedOffre}
                  applied={applied.has(selectedOffre.id)}
                  appliedDate={applied.get(selectedOffre.id) ?? null}
                  applying={panelApplying}
                  saved={saved.has(selectedOffre.id)}
                  isConnected={isConnected}
                  onApply={handlePanelApply}
                  onToggleSave={() => handleToggleSave(selectedOffre.id)}
                  mode="panel"
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.grey, fontSize: 14 }}>
                  Sélectionnez une offre
                </div>
              )}
            </div>
          </div>
        </div>

      ) : (
        /* ── LAYOUT MOBILE — liste normale ─────────────────────────────────── */
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 24px 80px' }}>
          {listContent}
        </div>
      )}

      {/* ── DRAWER FILTRES AVANCÉS ──────────────────────────────────────────── */}
      {drawerOpen && (
        <>
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(26,26,26,0.48)', zIndex: 299, backdropFilter: 'blur(1px)' }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, height: '100dvh',
            width: 'min(420px, 100vw)', backgroundColor: C.white,
            zIndex: 300, display: 'flex', flexDirection: 'column',
            boxShadow: '-6px 0 32px rgba(0,0,0,0.13)',
            animation: 'kavio-slidein 0.22s ease',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 24px', borderBottom: `1px solid ${C.sable}`,
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: C.dark }}>Filtres avancés</span>
              <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grey, fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              <DrawerSelect label="Expérience"       value={filters.exp}            onChange={v => update({ exp: v })}            options={EXP_OPTS} />
              <DrawerAvantages value={filters.avantages} onChange={v => update({ avantages: v })} />
              <DrawerSelect label="Taille entreprise" value={filters.taille}        onChange={v => update({ taille: v })}         options={TAILLE_OPTS} />
              <DrawerSelect label="Secteur"           value={filters.secteur}       onChange={v => update({ secteur: v })}        options={SECTEUR_OPTS} />
              <DrawerSelect label="Langue"            value={filters.langue}        onChange={v => update({ langue: v })}         options={LANGUE_OPTS} />
              <DrawerSelect label="Type d'entreprise" value={filters.type_ent}      onChange={v => update({ type_ent: v })}       options={TYPE_ENT_OPTS} />
              <DrawerSelect label="Prise de poste"    value={filters.prise_de_poste} onChange={v => update({ prise_de_poste: v })} options={PRISE_POSTE_OPTS} />
              <DrawerSelect label="Durée de contrat"  value={filters.duree_contrat} onChange={v => update({ duree_contrat: v })}  options={DUREE_OPTS} />
            </div>

            <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.sable}`, display: 'flex', gap: 10, flexShrink: 0 }}>
              <button
                onClick={() => update({ exp: '', avantages: [], taille: '', secteur: '', langue: '', type_ent: '', prise_de_poste: '', duree_contrat: '' })}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${C.sable}`, backgroundColor: C.white, color: C.dark, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Réinitialiser
              </button>
              <button
                onClick={() => setDrawerOpen(false)}
                style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', backgroundColor: C.terracotta, color: C.white, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Voir {filtered.length} offre{filtered.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
