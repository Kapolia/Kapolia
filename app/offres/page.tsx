'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { calculerScore, type ProfilMatch } from '@/lib/matching'

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
  type_poste?: string
  valeur?: string
  disponibilite?: string | string[]
  ville?: string
}

type Offre = {
  id: string
  titre: string
  entreprise_nom?: string
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
}

type SortKey = 'match' | 'recent' | 'salaire_asc' | 'salaire_desc' | 'alpha'

type Filters = {
  search: string
  domaine: string
  contrat: string
  lieu: string
  mode: string
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
}

const EMPTY_FILTERS: Filters = {
  search: '', domaine: '', contrat: '', lieu: '', mode: '', exp: '', salaire: '',
  taille: '', secteur: '', avantages: [], date_pub: '',
  langue: '', type_ent: '', prise_de_poste: '', duree_contrat: '', tri: 'match',
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
const MODE_OPTS    = ['100% présentiel', 'Hybride', '100% remote']
const EXP_OPTS     = ['Sans expérience', '1-2 ans', '3-5 ans', '5-10 ans', '+10 ans']
const SALAIRE_SEUILS = [20000, 25000, 30000, 35000, 40000, 45000, 50000, 60000, 70000, 80000, 100000]
const TAILLE_OPTS  = ['Startup (<50)', 'PME (50–250)', 'ETI (250–5000)', 'Grand groupe (+5000)']
const SECTEUR_OPTS = [
  'SaaS / Logiciel', 'E-commerce', 'Fintech', 'Santé / MedTech', 'Industrie',
  'Retail', 'Média / Édition', 'Consulting', 'Énergie', 'BTP / Immobilier',
  'Agroalimentaire', 'Transport / Logistique', 'Tourisme', 'Sport', 'Education / EdTech', 'Luxe',
]
const AVANTAGES_OPTS = [
  'Mutuelle', 'RTT', 'Tickets restaurant', 'Intéressement',
  'Stock options', 'Formation', 'Véhicule de fonction',
  'Remboursement transport', 'Télétravail', 'Salle de sport',
]
const DATE_PUB_OPTS    = ["Aujourd'hui", 'Cette semaine', 'Ce mois-ci']
const LANGUE_OPTS      = ['Français uniquement', 'Anglais requis', 'Bilingue', 'Autre']
const TYPE_ENT_OPTS    = ['Startup', 'ESN / SSII', 'Agence', 'PME', 'ETI', 'Grand groupe', 'Association / ONG']
const PRISE_POSTE_OPTS = ['Immédiat', 'Dans le mois', 'Dans 3 mois', 'Flexible']
const DUREE_OPTS       = ['< 3 mois', '3–6 mois', '6–12 mois', '> 12 mois']
const VILLES = ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Toulouse', 'Nantes', 'Lille', 'Strasbourg', 'Nice', 'Rennes', 'Montpellier', 'Grenoble']

const TRI_LABELS: Record<SortKey, string> = {
  match:        'Meilleur match',
  recent:       'Plus récent',
  salaire_asc:  'Salaire croissant',
  salaire_desc: 'Salaire décroissant',
  alpha:        'Alphabétique',
}

// URL param mapping
const URL_MAP: Partial<Record<keyof Filters, string>> = {
  search: 'q', domaine: 'd', contrat: 'c', lieu: 'l', mode: 'm',
  exp: 'e', salaire: 's', taille: 'tai', secteur: 'sec', avantages: 'av',
  date_pub: 'dp', langue: 'lang', type_ent: 'te',
  prise_de_poste: 'pp', duree_contrat: 'dc', tri: 'tri',
}

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

function labelSalaire(n: number): string {
  return `${n / 1000}k €/an`
}

function getEntrepriseNom(offre: Offre): string {
  return offre.entreprise_nom || 'Entreprise'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style suppressHydrationWarning>{`@keyframes kavio-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: `3px solid ${C.sable}`, borderTopColor: C.terracotta,
        animation: 'kavio-spin 0.8s linear infinite',
      }} />
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
      style={{
        width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 10, border: `1px solid ${saved ? '#F59E0B40' : C.sable}`,
        backgroundColor: saved ? '#FEF3C720' : hov ? C.creme : 'transparent',
        cursor: 'pointer', fontSize: 17, transition: 'all 0.15s', flexShrink: 0,
      }}
    >
      {saved ? '★' : '☆'}
    </button>
  )
}

function FilterSelect({
  label, value, onChange, options, placeholder = 'Tous',
}: {
  label: string; value: string; onChange: (v: string) => void
  options: string[]; placeholder?: string
}) {
  const active = !!value
  return (
    <div>
      <label style={{
        fontSize: 11, fontWeight: 700, color: C.grey, textTransform: 'uppercase' as const,
        letterSpacing: '0.07em', display: 'block', marginBottom: 5,
      }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%', padding: '9px 30px 9px 12px',
            fontSize: 13, borderRadius: 10,
            border: `1.5px solid ${active ? C.terracotta : C.sable}`,
            backgroundColor: active ? `${C.terracotta}08` : C.white,
            color: active ? C.dark : C.grey,
            appearance: 'none', cursor: 'pointer', outline: 'none',
            fontFamily: 'inherit',
          }}
        >
          <option value="">{placeholder}</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <div style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          pointerEvents: 'none',
        }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 3.5l3 3 3-3" stroke={C.grey} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  )
}

function LieuInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{
        fontSize: 11, fontWeight: 700, color: C.grey, textTransform: 'uppercase' as const,
        letterSpacing: '0.07em', display: 'block', marginBottom: 5,
      }}>
        Localisation
      </label>
      <div style={{ position: 'relative' }}>
        <input
          list="kavio-villes"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Paris, Lyon…"
          style={{
            width: '100%', padding: '9px 30px 9px 12px',
            fontSize: 13, borderRadius: 10,
            border: `1.5px solid ${value ? C.terracotta : C.sable}`,
            backgroundColor: value ? `${C.terracotta}08` : C.white,
            color: value ? C.dark : C.grey,
            outline: 'none', fontFamily: 'inherit',
          }}
        />
        {value && (
          <button
            onClick={() => onChange('')}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.grey, fontSize: 16, padding: 0, lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
        <datalist id="kavio-villes">
          {VILLES.map(v => <option key={v} value={v} />)}
        </datalist>
      </div>
    </div>
  )
}

function AvantagesDropdown({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  function toggle(av: string) {
    onChange(value.includes(av) ? value.filter(v => v !== av) : [...value, av])
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label style={{
        fontSize: 11, fontWeight: 700, color: C.grey, textTransform: 'uppercase' as const,
        letterSpacing: '0.07em', display: 'block', marginBottom: 5,
      }}>
        Avantages
      </label>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '9px 30px 9px 12px',
          fontSize: 13, borderRadius: 10, cursor: 'pointer',
          border: `1.5px solid ${value.length ? C.terracotta : C.sable}`,
          backgroundColor: value.length ? `${C.terracotta}08` : C.white,
          color: value.length ? C.dark : C.grey,
          fontFamily: 'inherit', textAlign: 'left' as const,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <span>{value.length ? `${value.length} sélectionné${value.length > 1 ? 's' : ''}` : 'Tous'}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d={open ? 'M2 6.5l3-3 3 3' : 'M2 3.5l3 3 3-3'} stroke={C.grey} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0,
          backgroundColor: C.white, border: `1px solid ${C.sable}`,
          borderRadius: 12, padding: '6px 4px',
          minWidth: 220, zIndex: 200,
          boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
          maxHeight: 260, overflowY: 'auto' as const,
          animation: 'kavio-fadein 0.12s ease',
        }}>
          {AVANTAGES_OPTS.map(av => (
            <label key={av} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 12px', cursor: 'pointer', borderRadius: 8,
              fontSize: 13, color: C.dark,
              backgroundColor: value.includes(av) ? C.creme : 'transparent',
            }}>
              <input
                type="checkbox"
                checked={value.includes(av)}
                onChange={() => toggle(av)}
                style={{ accentColor: C.terracotta, width: 14, height: 14, cursor: 'pointer' }}
              />
              {av}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      backgroundColor: `${C.terracotta}12`,
      border: `1px solid ${C.terracotta}30`,
      color: C.terracotta, padding: '4px 10px', borderRadius: 20,
      fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' as const,
    }}>
      {label}
      <button
        onClick={onRemove}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: C.terracotta, fontSize: 15, lineHeight: 1,
          padding: 0, display: 'flex', alignItems: 'center',
        }}
      >
        ×
      </button>
    </div>
  )
}

function OffreCard({
  offre, applied, saved, onApply, onToggleSave, isConnected,
}: {
  offre: Offre; applied: boolean; saved: boolean
  onApply: (id: string) => void; onToggleSave: (id: string) => void; isConnected: boolean
}) {
  const [hov, setHov]           = useState(false)
  const [applying, setApplying] = useState(false)
  const router = useRouter()

  const entreprise = getEntrepriseNom(offre)
  const salaire    = formatSalaire(offre.salaire_min, offre.salaire_max, offre.periode_salaire)
  const skills     = (offre.competences ?? []).slice(0, 3)

  async function handleApply() {
    if (!isConnected) { router.push('/connexion'); return }
    if (applied || applying) return
    setApplying(true)
    await onApply(offre.id)
    setApplying(false)
  }

  return (
    <div
      onClick={() => router.push(`/offres/${offre.id}`)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        backgroundColor: C.white,
        border: `1px solid ${hov ? C.sable : '#EDE7DB'}`,
        borderRadius: 20, padding: 24,
        display: 'flex', flexDirection: 'column', gap: 16,
        boxShadow: hov ? '0 6px 24px rgba(44,74,62,0.08)' : '0 1px 4px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        position: 'relative' as const,
        cursor: 'pointer',
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700,
            color: C.dark, margin: '0 0 4px', lineHeight: 1.3,
          }}>
            {offre.titre}
          </h3>
          <div style={{ fontSize: 13, color: C.grey }}>
            <span style={{ fontWeight: 500, color: C.dark }}>{entreprise}</span>
            {offre.ville && <> · {offre.ville}</>}
          </div>
        </div>
        <StarButton saved={saved} onClick={e => { e.stopPropagation(); onToggleSave(offre.id) }} />
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {offre.type_contrat && (
          <span style={{ fontSize: 11, fontWeight: 600, backgroundColor: `${C.terracotta}14`, color: C.terracotta, padding: '3px 10px', borderRadius: 20 }}>
            {offre.type_contrat}
          </span>
        )}
        {offre.mode_travail && (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
            backgroundColor: offre.mode_travail === '100% remote' ? `${C.vert}14` : offre.mode_travail === 'Hybride' ? '#7B5EA714' : `${C.dark}0A`,
            color: offre.mode_travail === '100% remote' ? C.vert : offre.mode_travail === 'Hybride' ? '#7B5EA7' : C.grey,
          }}>
            {offre.mode_travail}
          </span>
        )}
        {offre.experience && (
          <span style={{ fontSize: 11, fontWeight: 500, backgroundColor: C.creme, color: C.grey, padding: '3px 10px', borderRadius: 20, border: `1px solid ${C.sable}` }}>
            {offre.experience}
          </span>
        )}
        {salaire && (
          <span style={{ fontSize: 11, fontWeight: 600, backgroundColor: '#F0FDF4', color: '#16A34A', padding: '3px 10px', borderRadius: 20 }}>
            💰 {salaire}
          </span>
        )}
      </div>

      {/* Description */}
      {offre.description && (
        <p style={{
          fontSize: 13, color: C.grey, margin: 0, lineHeight: 1.55,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {offre.description}
        </p>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {skills.map(s => (
            <span key={s} style={{ fontSize: 11, backgroundColor: C.creme, border: `1px solid ${C.sable}`, color: C.dark, padding: '3px 10px', borderRadius: 8, fontWeight: 500 }}>
              {s}
            </span>
          ))}
          {(offre.competences?.length ?? 0) > 3 && (
            <span style={{ fontSize: 11, color: C.grey, padding: '3px 10px', borderRadius: 8, border: `1px dashed ${C.sable}` }}>
              +{(offre.competences?.length ?? 0) - 3}
            </span>
          )}
        </div>
      )}

      {/* Bottom row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        paddingTop: 12, borderTop: `1px solid ${C.sable}`, marginTop: 'auto',
      }}>
        <span style={{ fontSize: 11, color: C.lightGrey }}>Publié {daysSince(offre.created_at)}</span>
        {applied ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            backgroundColor: `${C.vert}10`, color: C.vert,
            border: `1px solid ${C.vert}30`, padding: '8px 16px',
            borderRadius: 10, fontSize: 12, fontWeight: 600,
          }}>
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
              <path d="M1 5L4 8L11 1" stroke={C.vert} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Candidature envoyée
          </div>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); handleApply() }}
            disabled={applying}
            style={{
              backgroundColor: applying ? C.sable : C.terracotta, color: C.white, border: 'none',
              borderRadius: 10, padding: '8px 18px', fontSize: 12, fontWeight: 700,
              cursor: applying ? 'default' : 'pointer', fontFamily: 'inherit',
              transition: 'background-color 0.15s', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {applying ? (
              <>
                <style suppressHydrationWarning>{`@keyframes kavio-spin{to{transform:rotate(360deg)}}`}</style>
                <div style={{ width: 11, height: 11, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: C.white, animation: 'kavio-spin 0.7s linear infinite' }} />
                Envoi…
              </>
            ) : 'Postuler en 1 clic'}
          </button>
        )}
      </div>
    </div>
  )
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div style={{
      gridColumn: '1 / -1', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        backgroundColor: C.creme, border: `2px solid ${C.sable}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32, marginBottom: 24,
      }}>
        {hasFilters ? '🔍' : '📭'}
      </div>
      <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: C.dark, margin: '0 0 10px' }}>
        {hasFilters ? 'Aucune offre ne correspond' : 'Aucune offre pour le moment'}
      </h3>
      <p style={{ fontSize: 14, color: C.grey, margin: 0, maxWidth: 380, lineHeight: 1.65 }}>
        {hasFilters
          ? "Essayez de réinitialiser vos filtres ou d'élargir votre recherche."
          : 'Revenez bientôt — de nouvelles offres sont publiées régulièrement.'}
      </p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OffresPage() {
  const router = useRouter()

  const [profil, setProfil]       = useState<Profil | null>(null)
  const [offres, setOffres]       = useState<Offre[]>([])
  const [applied, setApplied]     = useState<Set<string>>(new Set())
  const [saved, setSaved]         = useState<Set<string>>(new Set())
  const [loading, setLoading]     = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [userId, setUserId]       = useState<string | null>(null)

  const [loadError, setLoadError] = useState<string | null>(null)
  const [filters, setFilters]     = useState<Filters>(EMPTY_FILTERS)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [triOpen, setTriOpen]     = useState(false)

  function update(partial: Partial<Filters>) {
    setFilters(prev => ({ ...prev, ...partial }))
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS)
  }

  // ── Init filters from URL ──────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    const p = new URLSearchParams(window.location.search)
    const patch: Partial<Filters> = {}
    if (p.get('q'))     patch.search        = p.get('q')!
    if (p.get('d'))     patch.domaine       = p.get('d')!
    if (p.get('c'))     patch.contrat       = p.get('c')!
    if (p.get('l'))     patch.lieu          = p.get('l')!
    if (p.get('m'))     patch.mode          = p.get('m')!
    if (p.get('e'))     patch.exp           = p.get('e')!
    if (p.get('s'))     patch.salaire       = p.get('s')!
    if (p.get('tai'))   patch.taille        = p.get('tai')!
    if (p.get('sec'))   patch.secteur       = p.get('sec')!
    if (p.get('av'))    patch.avantages     = p.get('av')!.split(',').filter(Boolean)
    if (p.get('dp'))    patch.date_pub      = p.get('dp')!
    if (p.get('lang'))  patch.langue        = p.get('lang')!
    if (p.get('te'))    patch.type_ent      = p.get('te')!
    if (p.get('pp'))    patch.prise_de_poste = p.get('pp')!
    if (p.get('dc'))    patch.duree_contrat = p.get('dc')!
    if (p.get('tri'))   patch.tri           = p.get('tri') as SortKey
    if (Object.keys(patch).length > 0) setFilters(prev => ({ ...prev, ...patch }))
  }, [])

  // ── Sync filters to URL ───────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    const p = new URLSearchParams()
    if (filters.search)         p.set('q',      filters.search)
    if (filters.domaine)        p.set('d',      filters.domaine)
    if (filters.contrat)        p.set('c',      filters.contrat)
    if (filters.lieu)           p.set('l',      filters.lieu)
    if (filters.mode)           p.set('m',      filters.mode)
    if (filters.exp)            p.set('e',      filters.exp)
    if (filters.salaire)        p.set('s',      filters.salaire)
    if (filters.taille)         p.set('tai',    filters.taille)
    if (filters.secteur)        p.set('sec',    filters.secteur)
    if (filters.avantages.length) p.set('av',   filters.avantages.join(','))
    if (filters.date_pub)       p.set('dp',     filters.date_pub)
    if (filters.langue)         p.set('lang',   filters.langue)
    if (filters.type_ent)       p.set('te',     filters.type_ent)
    if (filters.prise_de_poste) p.set('pp',     filters.prise_de_poste)
    if (filters.duree_contrat)  p.set('dc',     filters.duree_contrat)
    if (filters.tri !== 'match') p.set('tri',   filters.tri)
    const qs = p.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [filters])

  // ── localStorage ──────────────────────────────────────────────────────────
  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('kavio_saved_offers') : null
    if (raw) setSaved(new Set(JSON.parse(raw)))
  }, [])

  // ── Data load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setIsConnected(!!user)
      setUserId(user?.id ?? null)

      const [offresRes, profilRes, candidaturesRes] = await Promise.all([
        supabase
          .from('offres')
          .select('*')
          .eq('active', true)
          .eq('statut_publication', 'publiée')
          .order('created_at', { ascending: false }),

        user
          ? supabase.from('profils').select('domaine, experience, type_poste, valeur, disponibilite, ville').eq('user_id', user.id).single()
          : Promise.resolve({ data: null }),

        user
          ? supabase.from('candidatures').select('offre_id').eq('candidat_id', user.id)
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

      const appliedIds = new Set<string>(
        (candidaturesRes.data ?? []).map((c: { offre_id: string }) => c.offre_id)
      )
      setApplied(appliedIds)

      const scored: Offre[] = (offresRes.data ?? []).map((o: Omit<Offre, 'score'>) => ({
        ...o,
        score: p ? calculerScore(p as ProfilMatch, o as Parameters<typeof calculerScore>[1]) : 0,
      }))

      setOffres(scored)
      setLoading(false)
    }
    load()
  }, [])

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
    setSaved(prev => {
      const next = new Set(prev)
      if (next.has(offreId)) next.delete(offreId)
      else next.add(offreId)
      localStorage.setItem('kavio_saved_offers', JSON.stringify([...next]))
      return next
    })
  }

  // ── Active filter tags ────────────────────────────────────────────────────
  const activeTags = useMemo(() => {
    type Tag = { label: string; onRemove: () => void }
    const tags: Tag[] = []
    if (filters.domaine)        tags.push({ label: `Domaine : ${filters.domaine}`,             onRemove: () => update({ domaine: '' }) })
    if (filters.contrat)        tags.push({ label: filters.contrat,                             onRemove: () => update({ contrat: '' }) })
    if (filters.lieu)           tags.push({ label: `◎ ${filters.lieu}`,                        onRemove: () => update({ lieu: '' }) })
    if (filters.mode)           tags.push({ label: filters.mode,                                onRemove: () => update({ mode: '' }) })
    if (filters.exp)            tags.push({ label: filters.exp,                                 onRemove: () => update({ exp: '' }) })
    if (filters.salaire)        tags.push({ label: `Salaire ≥ ${filters.salaire}`,             onRemove: () => update({ salaire: '' }) })
    if (filters.taille)         tags.push({ label: filters.taille,                              onRemove: () => update({ taille: '' }) })
    if (filters.secteur)        tags.push({ label: filters.secteur,                             onRemove: () => update({ secteur: '' }) })
    filters.avantages.forEach(av => tags.push({
      label: av,
      onRemove: () => update({ avantages: filters.avantages.filter(a => a !== av) }),
    }))
    if (filters.date_pub)       tags.push({ label: filters.date_pub,                            onRemove: () => update({ date_pub: '' }) })
    if (filters.langue)         tags.push({ label: filters.langue,                              onRemove: () => update({ langue: '' }) })
    if (filters.type_ent)       tags.push({ label: filters.type_ent,                            onRemove: () => update({ type_ent: '' }) })
    if (filters.prise_de_poste) tags.push({ label: `Poste : ${filters.prise_de_poste}`,        onRemove: () => update({ prise_de_poste: '' }) })
    if (filters.duree_contrat)  tags.push({ label: `Durée : ${filters.duree_contrat}`,         onRemove: () => update({ duree_contrat: '' }) })
    return tags
  }, [filters])  // eslint-disable-line react-hooks/exhaustive-deps

  const advancedActiveCount = [
    filters.taille, filters.secteur, filters.date_pub,
    filters.langue, filters.type_ent, filters.prise_de_poste, filters.duree_contrat,
  ].filter(Boolean).length + filters.avantages.length

  const hasActiveFilters = !!(
    filters.search || filters.domaine || filters.contrat || filters.lieu ||
    filters.mode || filters.exp || filters.salaire || advancedActiveCount > 0
  )

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

    if (filters.domaine) {
      list = list.filter(o => (o.domaine ?? '').toLowerCase().includes(filters.domaine.toLowerCase()))
    }

    if (filters.contrat) {
      list = list.filter(o => o.type_contrat === filters.contrat)
    }

    if (filters.lieu) {
      list = list.filter(o => (o.ville ?? '').toLowerCase().includes(filters.lieu.toLowerCase()))
    }

    if (filters.mode) {
      list = list.filter(o => o.mode_travail === filters.mode)
    }

    if (filters.exp) {
      list = list.filter(o => o.experience === filters.exp)
    }

    if (filters.salaire) {
      const m = filters.salaire.match(/^(\d+)k/)
      const minSalaire = m ? parseInt(m[1]) * 1000 : 0
      if (minSalaire > 0) {
        list = list.filter(o => (o.salaire_min ?? 0) >= minSalaire || (o.salaire_max ?? 0) >= minSalaire)
      }
    }

    if (filters.date_pub) {
      const MAX_DAYS: Record<string, number> = { "Aujourd'hui": 1, 'Cette semaine': 7, 'Ce mois-ci': 30 }
      const maxDays = MAX_DAYS[filters.date_pub]
      if (maxDays !== undefined) {
        list = list.filter(o => (Date.now() - new Date(o.created_at).getTime()) / 86400000 <= maxDays)
      }
    }

    if (filters.avantages.length > 0) {
      list = list.filter(o => filters.avantages.every(av => (o.avantages ?? []).includes(av)))
    }

    switch (filters.tri) {
      case 'match':
        list.sort((a, b) => b.score - a.score)
        break
      case 'recent':
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      case 'salaire_asc':
        list.sort((a, b) => (a.salaire_min ?? 0) - (b.salaire_min ?? 0))
        break
      case 'salaire_desc':
        list.sort((a, b) => (b.salaire_max ?? b.salaire_min ?? 0) - (a.salaire_max ?? a.salaire_min ?? 0))
        break
      case 'alpha':
        list.sort((a, b) => a.titre.localeCompare(b.titre, 'fr'))
        break
    }

    return list
  }, [offres, filters])

  const matchCount = offres.filter(o => o.score >= 60).length

  return (
    <div style={{ backgroundColor: C.creme, minHeight: '100vh', marginLeft: 64 }}>
      <style suppressHydrationWarning>{`
        @keyframes kavio-spin    { to { transform: rotate(360deg); } }
        @keyframes kavio-fadein  { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        select { appearance: none; -webkit-appearance: none; }
      `}</style>

      {/* ── HEADER ────────────────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: C.white, borderBottom: `1px solid ${C.sable}`, padding: '36px 40px 28px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(26px, 4vw, 38px)', color: C.dark, margin: '0 0 8px', lineHeight: 1.2 }}>
            Offres d'emploi
          </h1>
          <p style={{ fontSize: 14, color: C.grey, margin: '0 0 24px' }}>
            {loading
              ? 'Chargement des offres…'
              : isConnected
              ? `${matchCount} offre${matchCount !== 1 ? 's correspondent' : ' correspond'} à votre profil`
              : `${offres.length} offre${offres.length !== 1 ? 's disponibles' : ' disponible'}`}
          </p>

          {/* Search bar */}
          <div style={{ position: 'relative', maxWidth: 600 }}>
            <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.lightGrey} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              value={filters.search}
              onChange={e => update({ search: e.target.value })}
              placeholder="Rechercher un poste, une entreprise, une ville…"
              style={{
                width: '100%', padding: '12px 14px 12px 42px',
                fontSize: 14, borderRadius: 14,
                border: `1.5px solid ${filters.search ? C.terracotta : C.sable}`,
                backgroundColor: C.white, color: C.dark,
                outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s',
              }}
            />
            {filters.search && (
              <button
                onClick={() => update({ search: '' })}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.grey, fontSize: 18, lineHeight: 1, padding: 0 }}
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── FILTER PANEL ─────────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: C.white, borderBottom: `1px solid ${C.sable}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 40px' }}>

          {/* Main 6 filters: 3-column grid × 2 rows */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '14px 20px',
          }}>
            <FilterSelect label="Domaine" value={filters.domaine} onChange={v => update({ domaine: v })} options={DOMAINE_OPTS} />
            <FilterSelect label="Type de contrat" value={filters.contrat} onChange={v => update({ contrat: v })} options={CONTRAT_OPTS} />
            <LieuInput value={filters.lieu} onChange={v => update({ lieu: v })} />
            <FilterSelect label="Mode de travail" value={filters.mode} onChange={v => update({ mode: v })} options={MODE_OPTS} />
            <FilterSelect label="Expérience" value={filters.exp} onChange={v => update({ exp: v })} options={EXP_OPTS} />
            <FilterSelect
              label="Salaire minimum"
              value={filters.salaire}
              onChange={v => update({ salaire: v })}
              options={SALAIRE_SEUILS.map(labelSalaire)}
              placeholder="Indifférent"
            />
          </div>

          {/* Filtres avancés toggle */}
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setAdvancedOpen(o => !o)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 600, color: C.dark,
                background: 'none', border: `1px solid ${C.sable}`,
                borderRadius: 8, padding: '6px 14px',
                cursor: 'pointer', fontFamily: 'inherit',
                backgroundColor: advancedOpen ? C.creme : 'transparent',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
              </svg>
              Filtres avancés
              {advancedActiveCount > 0 && (
                <span style={{
                  backgroundColor: C.terracotta, color: C.white,
                  borderRadius: '50%', width: 18, height: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                }}>
                  {advancedActiveCount}
                </span>
              )}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d={advancedOpen ? 'M2 6.5l3-3 3 3' : 'M2 3.5l3 3 3-3'} stroke={C.grey} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                style={{
                  fontSize: 12, color: C.terracotta,
                  background: 'none', border: `1px solid ${C.terracotta}40`,
                  borderRadius: 8, padding: '6px 12px',
                  cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                }}
              >
                ↺ Tout effacer
              </button>
            )}
          </div>

          {/* Advanced 9 filters */}
          {advancedOpen && (
            <div style={{
              marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.sable}`,
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 20px',
              animation: 'kavio-fadein 0.15s ease',
            }}>
              <FilterSelect label="Taille entreprise" value={filters.taille} onChange={v => update({ taille: v })} options={TAILLE_OPTS} />
              <FilterSelect label="Secteur" value={filters.secteur} onChange={v => update({ secteur: v })} options={SECTEUR_OPTS} />
              <AvantagesDropdown value={filters.avantages} onChange={v => update({ avantages: v })} />
              <FilterSelect label="Date de publication" value={filters.date_pub} onChange={v => update({ date_pub: v })} options={DATE_PUB_OPTS} placeholder="Toutes" />
              <FilterSelect label="Langue" value={filters.langue} onChange={v => update({ langue: v })} options={LANGUE_OPTS} />
              <FilterSelect label="Type d'entreprise" value={filters.type_ent} onChange={v => update({ type_ent: v })} options={TYPE_ENT_OPTS} />
              <FilterSelect label="Prise de poste" value={filters.prise_de_poste} onChange={v => update({ prise_de_poste: v })} options={PRISE_POSTE_OPTS} />
              <FilterSelect label="Durée de contrat" value={filters.duree_contrat} onChange={v => update({ duree_contrat: v })} options={DUREE_OPTS} />
            </div>
          )}

          {/* Active filter tags */}
          {activeTags.length > 0 && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 6,
              marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.sable}`,
            }}>
              {activeTags.map((tag, i) => (
                <FilterTag key={`${tag.label}-${i}`} label={tag.label} onRemove={tag.onRemove} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── CONTENT ───────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 40px 60px' }}>

        {/* Toolbar: count + sort */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20, flexWrap: 'wrap', gap: 12,
        }}>
          <div style={{ fontSize: 13, color: C.grey }}>
            {!loading && (
              <>
                <span style={{ fontWeight: 700, color: C.dark }}>{filtered.length}</span>
                {' '}offre{filtered.length !== 1 ? 's' : ''}
                {hasActiveFilters && (filtered.length !== 1 ? ' filtrées' : ' filtrée')}
              </>
            )}
          </div>

          {/* Sort dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setTriOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 10,
                border: `1px solid ${C.sable}`,
                backgroundColor: C.white, color: C.dark,
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.grey} strokeWidth="2" strokeLinecap="round">
                <path d="M3 6h18M7 12h10M11 18h2" />
              </svg>
              {TRI_LABELS[filters.tri]}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5l3 3 3-3" stroke={C.grey} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>

            {triOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                backgroundColor: C.white, border: `1px solid ${C.sable}`,
                borderRadius: 12, padding: 6, minWidth: 200, zIndex: 50,
                boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                animation: 'kavio-fadein 0.12s ease',
              }}>
                {(Object.entries(TRI_LABELS) as [SortKey, string][]).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => { update({ tri: k }); setTriOpen(false) }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '9px 12px', border: 'none', borderRadius: 8,
                      backgroundColor: filters.tri === k ? C.creme : 'transparent',
                      color: filters.tri === k ? C.dark : C.grey,
                      fontSize: 13, fontWeight: filters.tri === k ? 600 : 400,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {filters.tri === k && <span style={{ color: C.terracotta, marginRight: 6 }}>✓</span>}
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <Spinner />
        ) : loadError ? (
          <div style={{
            gridColumn: '1 / -1', padding: '48px 24px', textAlign: 'center',
            color: C.terracotta, fontSize: 14, fontWeight: 500,
          }}>
            {loadError}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 20 }}>
            {filtered.length === 0 ? (
              <EmptyState hasFilters={hasActiveFilters} />
            ) : (
              filtered.map(offre => (
                <OffreCard
                  key={offre.id}
                  offre={offre}
                  applied={applied.has(offre.id)}
                  saved={saved.has(offre.id)}
                  onApply={handleApply}
                  onToggleSave={handleToggleSave}
                  isConnected={isConnected}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Click-outside overlay for sort dropdown */}
      {triOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setTriOpen(false)} />
      )}
    </div>
  )
}
