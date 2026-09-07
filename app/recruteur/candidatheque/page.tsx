'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Avatar from '@/components/Avatar'
import { DOMAINES, EXPERIENCES, TYPES_POSTE } from '@/lib/onboarding-utils'

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  terracotta: '#C4673A',
  sable:      '#E8D5B7',
  creme:      '#F7F2EB',
  vert:       '#2C4A3E',
  dark:       '#1A1A1A',
  grey:       '#6B6B6B',
  white:      '#FFFFFF',
  amber:      '#C88A2A',
  red:        '#C0392B',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Profil = {
  user_id:              string
  prenom:               string | null
  nom:                  string | null
  domaine:              string | null
  experience:           string | null
  ville:                string | null
  signature:            string | null
  qualites:             string[] | null
  competences_acquises: string[] | null
  type_poste:           string[] | null
  valeur:               string | null
  disponibilite:        string | null
  avatar_url:           string | null
  avatar_type:          string | null
}

type Filters = {
  domaine:      string
  experience:   string
  localisation: string
  typePoste:    string
  valeur:       string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dispoInfo(dispo: string | null): { dot: string; label: string } {
  switch (dispo) {
    case 'maintenant':  return { dot: '#4CAF50', label: 'Disponible' }
    case 'a_partir_de': return { dot: '#3A7AC4', label: 'Bientôt disponible' }
    case 'en_poste':    return { dot: '#E8973A', label: "En poste, à l'écoute" }
    default:            return { dot: '#9E9E9E', label: '' }
  }
}

function labelTypePoste(keys: string[] | null): string {
  if (!keys || keys.length === 0) return ''
  return keys.map(k => TYPES_POSTE.find(t => t.key === k)?.label ?? k).join(', ')
}

function nomComplet(p: Pick<Profil, 'prenom' | 'nom'>): string {
  return `${p.prenom ?? ''} ${p.nom ?? ''}`.trim() || 'Profil sans nom'
}

// ─── Score ring (conservé, non rendu dans cette étape) ────────────────────────

function ScoreRing({
  score, size = 56, delay = 0, sw = 6,
}: {
  score: number; size?: number; delay?: number; sw?: number
}) {
  const r = (size - sw * 2) / 2
  const circ = 2 * Math.PI * r
  const [go, setGo] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setGo(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  const offset = go ? circ * (1 - score / 100) : circ
  const color = score >= 80 ? C.terracotta : score >= 65 ? C.amber : C.grey
  const fs = size < 64 ? '12px' : '19px'

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.sable} strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: fs, fontWeight: '700', color, lineHeight: 1 }}>{score}%</span>
      </div>
    </div>
  )
}

// ─── Filter label ─────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: '8px', fontSize: '13px',
  border: `1.5px solid ${C.sable}`, backgroundColor: C.white, color: C.dark,
  outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
}

function FLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      fontSize: '11px', fontWeight: '600', color: C.grey,
      textTransform: 'uppercase', letterSpacing: '0.07em',
      display: 'block', marginBottom: '5px',
    }}>
      {children}
    </label>
  )
}

// ─── Panel subtitle ───────────────────────────────────────────────────────────

const panelSub: React.CSSProperties = {
  fontSize: '11px', fontWeight: '600', color: C.grey,
  textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px',
}

// ─── Candidate row ────────────────────────────────────────────────────────────

function CandidateRow({
  profil, index, selectedId, onSelect, saved, onSave,
}: {
  profil: Profil; index: number; selectedId: string | null
  onSelect: (id: string) => void; saved: boolean; onSave: () => void
}) {
  const [hover, setHover] = useState(false)
  const isSelected = selectedId === profil.user_id
  const dp = dispoInfo(profil.disponibilite)
  const nom = nomComplet(profil)
  const poste = labelTypePoste(profil.type_poste)
  const comps = profil.competences_acquises ?? []
  const meta = [poste, profil.experience].filter(Boolean).join(' · ')

  // suppress unused warning — ScoreRing intentionally unused this step
  void ScoreRing

  return (
    <div
      onClick={() => onSelect(profil.user_id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        padding: '14px 18px', borderBottom: `1px solid ${C.sable}`,
        borderLeft: `3px solid ${isSelected ? C.terracotta : 'transparent'}`,
        backgroundColor: isSelected ? 'rgba(196,103,58,0.03)' : hover ? 'rgba(26,26,26,0.015)' : 'transparent',
        cursor: 'pointer', transition: 'background-color 0.12s',
      }}
    >
      {/* Avatar + dispo dot */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Avatar profil={profil} size="sm" />
        <span style={{
          position: 'absolute', bottom: 0, right: 0,
          width: '9px', height: '9px', borderRadius: '50%',
          backgroundColor: dp.dot, border: `2px solid ${C.white}`,
        }} />
      </div>

      {/* Nom / meta */}
      <div style={{ width: 148, flexShrink: 0 }}>
        <div style={{ fontSize: '13.5px', fontWeight: '600', color: C.dark, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {nom}
        </div>
        {meta && (
          <div style={{ fontSize: '12px', color: C.grey, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {meta}
          </div>
        )}
        {profil.ville && (
          <div style={{ fontSize: '11px', color: C.grey, marginTop: '1px' }}>📍 {profil.ville}</div>
        )}
      </div>

      {/* Signature + compétences */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {profil.signature && (
          <p style={{
            fontFamily: 'Georgia, serif', fontStyle: 'italic',
            fontSize: '12.5px', color: C.grey, lineHeight: '1.5',
            margin: '0 0 7px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            « {profil.signature} »
          </p>
        )}
        {comps.length > 0 && (
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {comps.slice(0, 3).map((skill, i) => (
              <span key={skill} style={{
                padding: '2px 8px', borderRadius: '10px', fontSize: '11px',
                backgroundColor: i === 0 ? C.vert : 'rgba(26,26,26,0.06)',
                color: i === 0 ? C.white : C.grey,
                fontWeight: i === 0 ? '600' : '400',
              }}>
                {i === 0 ? '✓ ' : ''}{skill}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button
          onClick={e => { e.stopPropagation(); onSave() }}
          title={saved ? 'Retirer' : 'Sauvegarder'}
          style={{
            width: '32px', height: '32px', borderRadius: '50%', border: 'none',
            backgroundColor: saved ? 'rgba(196,103,58,0.1)' : 'rgba(26,26,26,0.05)',
            color: saved ? C.terracotta : C.grey,
            cursor: 'pointer', fontSize: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.12s',
          }}
        >
          {saved ? '★' : '☆'}
        </button>
        <button
          onClick={e => e.stopPropagation()}
          title="Envoyer un message"
          style={{
            width: '32px', height: '32px', borderRadius: '50%', border: 'none',
            backgroundColor: 'rgba(26,26,26,0.05)', color: C.grey,
            cursor: 'pointer', fontSize: '13px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ✉
        </button>
      </div>
    </div>
  )
}

// ─── Right panel ──────────────────────────────────────────────────────────────

function RightPanel({
  profil, onClose, saved, onSave,
}: {
  profil: Profil; onClose: () => void; saved: boolean; onSave: () => void
}) {
  const dp = dispoInfo(profil.disponibilite)
  const nom = nomComplet(profil)
  const poste = labelTypePoste(profil.type_poste)
  const comps = profil.competences_acquises ?? []
  const quals = profil.qualites ?? []
  const dispoParts = [dp.label, profil.ville].filter(Boolean).join(' · ')

  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ backgroundColor: C.vert, padding: '18px 22px 22px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.5)', fontSize: '18px', padding: '2px 4px', lineHeight: 1,
          }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '16px' }}>
          <Avatar profil={profil} size="md" />
          <div>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '19px', color: C.white, fontWeight: '400', margin: '0 0 4px' }}>
              {nom}
            </h3>
            {dispoParts && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: dp.dot, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)' }}>{dispoParts}</span>
              </div>
            )}
            {poste && (
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>{poste}</div>
            )}
          </div>
        </div>
        {profil.signature && (
          <p style={{
            fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '13px',
            color: 'rgba(255,255,255,0.78)', lineHeight: '1.7', margin: 0,
            borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '14px',
          }}>
            « {profil.signature} »
          </p>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '20px 22px', flex: 1 }}>

        {/* Domaine + expérience */}
        {(profil.domaine || profil.experience) && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '22px' }}>
            {profil.domaine && (
              <span style={{ padding: '4px 10px', borderRadius: '16px', backgroundColor: C.vert, color: C.white, fontSize: '11px' }}>
                {profil.domaine}
              </span>
            )}
            {profil.experience && (
              <span style={{ padding: '4px 10px', borderRadius: '16px', border: `1.5px solid ${C.sable}`, color: C.dark, fontSize: '11px' }}>
                {profil.experience}
              </span>
            )}
          </div>
        )}

        {/* Qualités */}
        {quals.length > 0 && (
          <div style={{ marginBottom: '18px' }}>
            <div style={panelSub}>Qualités naturelles</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {quals.map(q => (
                <span key={q} style={{ padding: '4px 11px', borderRadius: '16px', backgroundColor: 'rgba(44,74,62,0.09)', color: C.vert, fontSize: '12px', fontWeight: '500' }}>
                  {q}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Compétences */}
        {comps.length > 0 && (
          <div style={{ marginBottom: '18px' }}>
            <div style={panelSub}>Compétences</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {comps.map((s, i) => (
                <span key={s} style={{
                  padding: '4px 11px', borderRadius: '16px', fontSize: '12px',
                  backgroundColor: i === 0 ? C.terracotta : C.creme,
                  color: i === 0 ? C.white : C.dark,
                  fontWeight: i === 0 ? '600' : '400',
                  border: i === 0 ? 'none' : `1.5px solid ${C.sable}`,
                }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Valeur non négociable */}
        {profil.valeur && (
          <div style={{ padding: '13px 15px', borderRadius: '12px', backgroundColor: C.creme, border: `1px solid ${C.sable}`, marginBottom: '22px' }}>
            <div style={panelSub}>Valeur non négociable</div>
            <div style={{ fontSize: '13.5px', color: C.dark, fontWeight: '500' }}>🤝 {profil.valeur}</div>
          </div>
        )}

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button style={{
            width: '100%', padding: '12px', borderRadius: '11px', border: 'none',
            backgroundColor: C.vert, color: C.white, fontSize: '14px', fontWeight: '500', cursor: 'pointer',
          }}>
            ✉ Écrire à {profil.prenom ?? nom.split(' ')[0]}
          </button>
          <button onClick={onSave} style={{
            width: '100%', padding: '10px', borderRadius: '11px',
            border: `1.5px solid ${saved ? C.terracotta : C.sable}`,
            backgroundColor: saved ? 'rgba(196,103,58,0.08)' : C.white,
            color: saved ? C.terracotta : C.dark, fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s',
          }}>
            {saved ? '★ Sauvegardé' : '☆ Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Pagination button ────────────────────────────────────────────────────────

function PagBtn({ label, active = false, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: '30px', height: '30px', borderRadius: '7px', fontSize: '13px',
      border: `1.5px solid ${active ? C.terracotta : C.sable}`,
      backgroundColor: active ? C.terracotta : C.white,
      color: active ? C.white : C.grey,
      fontWeight: active ? '700' : '400',
      cursor: 'pointer', transition: 'all 0.12s',
    }}>
      {label}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

export default function RecruteurPage() {
  const [profils, setProfils]     = useState<Profil[]>([])
  const [loading, setLoading]     = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch]       = useState('')
  const [filters, setFilters]     = useState<Filters>({
    domaine: '', experience: '', localisation: '', typePoste: '', valeur: '',
  })
  const [savedIds, setSavedIds]     = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [page, setPage]             = useState(1)

  useEffect(() => {
    async function fetchProfils() {
      const { data, error } = await supabase
        .from('profils')
        .select('user_id, prenom, nom, domaine, experience, ville, signature, qualites, competences_acquises, type_poste, valeur, disponibilite, avatar_url, avatar_type')
        .eq('visible_candidatheque', true)
        .eq('type_compte', 'candidat')
      if (error) {
        console.error('[candidatheque] fetch error', error)
        setLoadError(true)
      } else {
        setProfils(data ?? [])
      }
      setLoading(false)
    }
    fetchProfils()
  }, [])

  // Réinitialise la page quand les filtres ou la recherche changent
  useEffect(() => { setPage(1) }, [search, filters])

  // Options dérivées des données réelles
  const villeOptions = useMemo(() =>
    [...new Set(profils.map(p => p.ville).filter((v): v is string => !!v))].sort()
  , [profils])

  const valeurOptions = useMemo(() =>
    [...new Set(profils.map(p => p.valeur).filter((v): v is string => !!v))].sort()
  , [profils])

  // Filtrage client
  const filtered = useMemo(() => profils.filter(p => {
    if (filters.domaine      && p.domaine !== filters.domaine) return false
    if (filters.experience   && p.experience !== filters.experience) return false
    if (filters.localisation && !p.ville?.toLowerCase().includes(filters.localisation.toLowerCase())) return false
    if (filters.typePoste    && !(p.type_poste ?? []).includes(filters.typePoste)) return false
    if (filters.valeur       && p.valeur !== filters.valeur) return false
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      const name   = nomComplet(p).toLowerCase()
      const sig    = (p.signature ?? '').toLowerCase()
      const skills = (p.competences_acquises ?? []).join(' ').toLowerCase()
      if (!name.includes(q) && !sig.includes(q) && !skills.includes(q)) return false
    }
    return true
  }), [profils, filters, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageData   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const activeTags = useMemo(() => [
    ...(filters.domaine      ? [{ key: 'domaine',      label: 'Domaine',        value: filters.domaine }] : []),
    ...(filters.experience   ? [{ key: 'experience',   label: 'Expérience',     value: filters.experience }] : []),
    ...(filters.localisation ? [{ key: 'localisation', label: 'Ville',          value: filters.localisation }] : []),
    ...(filters.typePoste    ? [{ key: 'typePoste',    label: 'Type de poste',  value: TYPES_POSTE.find(t => t.key === filters.typePoste)?.label ?? filters.typePoste }] : []),
    ...(filters.valeur       ? [{ key: 'valeur',       label: 'Valeur',         value: filters.valeur }] : []),
  ], [filters])

  function removeTag(key: string) {
    setFilters(prev => ({ ...prev, [key]: '' }))
  }

  function clearAll() {
    setFilters({ domaine: '', experience: '', localisation: '', typePoste: '', valeur: '' })
    setSearch('')
  }

  function toggleSave(id: string) {
    setSavedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const selected = selectedId !== null ? (profils.find(p => p.user_id === selectedId) ?? null) : null

  // ── États de chargement / erreur ────────────────────────────────────────────

  if (loading) {
    return (
      <main style={{ height: '100vh', backgroundColor: C.creme, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style suppressHydrationWarning>{`@keyframes kapolia-spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${C.sable}`, borderTopColor: C.terracotta, animation: 'kapolia-spin 0.8s linear infinite' }} />
      </main>
    )
  }

  if (loadError) {
    return (
      <main style={{ height: '100vh', backgroundColor: C.creme, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <p style={{ fontSize: 15, color: C.red, margin: 0 }}>Impossible de charger les profils.</p>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '9px 20px', borderRadius: 10, border: `1.5px solid ${C.sable}`, backgroundColor: C.white, color: C.dark, fontSize: 13, cursor: 'pointer' }}
        >
          Réessayer
        </button>
      </main>
    )
  }

  // ── Rendu principal ─────────────────────────────────────────────────────────

  return (
    <>
      <main style={{ height: '100vh', overflowY: 'auto', backgroundColor: C.creme }}>

        {/* Topbar */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10, backgroundColor: C.creme,
          padding: '14px 22px', display: 'flex', alignItems: 'center', gap: '10px',
          borderBottom: `1px solid ${C.sable}`,
        }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '19px', color: C.dark, fontWeight: '400', margin: '0 auto 0 0' }}>
            Repérer des profils
          </h1>
          <div style={{ position: 'relative' }}>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Nom, signature, compétence…"
              style={{
                padding: '8px 12px 8px 34px', borderRadius: '9px', width: '240px',
                border: `1.5px solid ${C.sable}`, backgroundColor: C.white,
                fontSize: '13px', color: C.dark, outline: 'none', fontFamily: 'inherit',
              }}
            />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.grey} strokeWidth="2" strokeLinecap="round"
              style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
          </div>
          <button style={{
            padding: '8px 16px', borderRadius: '9px', border: 'none',
            backgroundColor: C.terracotta, color: C.white, fontSize: '13px', fontWeight: '600', cursor: 'pointer', flexShrink: 0,
          }}>
            + Publier une offre
          </button>
        </div>

        <div style={{ padding: '18px 22px' }}>

          {/* KPI réels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '16px' }}>
            <div style={{ backgroundColor: C.white, borderRadius: '13px', padding: '16px 18px', border: `1px solid ${C.sable}` }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '26px', fontWeight: '400', lineHeight: 1, marginBottom: '4px', color: C.vert }}>
                {profils.length}
              </div>
              <div style={{ fontSize: '12.5px', fontWeight: '600', color: C.dark }}>Profils disponibles</div>
            </div>
            <div style={{ backgroundColor: C.white, borderRadius: '13px', padding: '16px 18px', border: `1px solid ${C.sable}` }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '26px', fontWeight: '400', lineHeight: 1, marginBottom: '4px', color: C.terracotta }}>
                {filtered.length}
              </div>
              <div style={{ fontSize: '12.5px', fontWeight: '600', color: C.dark }}>Résultats filtrés</div>
            </div>
          </div>

          {/* Filtres */}
          <div style={{ backgroundColor: C.white, borderRadius: '14px', padding: '16px 18px', marginBottom: '14px', border: `1px solid ${C.sable}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: activeTags.length > 0 ? '12px' : 0 }}>

              <div>
                <FLabel>Domaine</FLabel>
                <select value={filters.domaine} onChange={e => setFilters(f => ({ ...f, domaine: e.target.value }))} style={selectStyle}>
                  <option value="">Tous</option>
                  {DOMAINES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <FLabel>Expérience</FLabel>
                <select value={filters.experience} onChange={e => setFilters(f => ({ ...f, experience: e.target.value }))} style={selectStyle}>
                  <option value="">Toutes</option>
                  {EXPERIENCES.map(e => <option key={e.key} value={e.key}>{e.key}</option>)}
                </select>
              </div>

              <div>
                <FLabel>Ville</FLabel>
                {villeOptions.length > 0 ? (
                  <select value={filters.localisation} onChange={e => setFilters(f => ({ ...f, localisation: e.target.value }))} style={selectStyle}>
                    <option value="">Toutes</option>
                    {villeOptions.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                ) : (
                  <input
                    type="text" value={filters.localisation}
                    placeholder="Ville…"
                    onChange={e => setFilters(f => ({ ...f, localisation: e.target.value }))}
                    style={{ ...selectStyle, cursor: 'text' }}
                  />
                )}
              </div>

              <div>
                <FLabel>Type de poste</FLabel>
                <select value={filters.typePoste} onChange={e => setFilters(f => ({ ...f, typePoste: e.target.value }))} style={selectStyle}>
                  <option value="">Tous</option>
                  {TYPES_POSTE.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>

              <div>
                <FLabel>Valeur</FLabel>
                <select value={filters.valeur} onChange={e => setFilters(f => ({ ...f, valeur: e.target.value }))} style={selectStyle}>
                  <option value="">Toutes</option>
                  {valeurOptions.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

            </div>

            {/* Tags actifs */}
            {activeTags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '10px', borderTop: `1px solid ${C.sable}` }}>
                {activeTags.map(tag => (
                  <span key={tag.key} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '3px 9px', borderRadius: '16px', fontSize: '12px',
                    backgroundColor: 'rgba(196,103,58,0.08)', border: '1px solid rgba(196,103,58,0.22)',
                    color: C.terracotta,
                  }}>
                    {tag.label} : {tag.value}
                    <button onClick={() => removeTag(tag.key)} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: C.terracotta, fontSize: '14px', padding: 0, lineHeight: 1, opacity: 0.7,
                    }}>×</button>
                  </span>
                ))}
                <button onClick={clearAll} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '12px', color: C.grey, padding: '3px 4px', textDecoration: 'underline',
                }}>
                  Effacer tout
                </button>
              </div>
            )}
          </div>

          {/* Liste */}
          <div style={{ backgroundColor: C.white, borderRadius: '14px', border: `1px solid ${C.sable}`, overflow: 'hidden', marginBottom: '14px' }}>
            <div style={{
              padding: '11px 18px', borderBottom: `1px solid ${C.sable}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '12.5px', fontWeight: '600', color: C.dark }}>
                {filtered.length} profil{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {pageData.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: C.grey, fontSize: '14px' }}>
                Aucun candidat ne correspond à votre recherche pour le moment.
              </div>
            ) : (
              pageData.map((p, i) => (
                <CandidateRow
                  key={p.user_id}
                  profil={p}
                  index={i}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  saved={savedIds.has(p.user_id)}
                  onSave={() => toggleSave(p.user_id)}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
              <PagBtn label="←" onClick={() => setPage(p => Math.max(1, p - 1))} />
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                <PagBtn key={p} label={String(p)} active={page === p} onClick={() => setPage(p)} />
              ))}
              {totalPages > 7 && page < totalPages && (
                <PagBtn label="→" onClick={() => setPage(p => Math.min(totalPages, p + 1))} />
              )}
            </div>
          )}

        </div>
      </main>

      {/* Overlay */}
      {selectedId !== null && (
        <div
          onClick={() => setSelectedId(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(26,26,26,0.12)', zIndex: 99 }}
        />
      )}

      {/* Panel droit */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 360,
        backgroundColor: C.white,
        boxShadow: selectedId !== null ? '-6px 0 40px rgba(26,26,26,0.1)' : 'none',
        transform: selectedId !== null ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.22,1,0.36,1)',
        zIndex: 100, overflowY: 'auto',
      }}>
        {selected && (
          <RightPanel
            key={selected.user_id}
            profil={selected}
            onClose={() => setSelectedId(null)}
            saved={savedIds.has(selected.user_id)}
            onSave={() => toggleSave(selected.user_id)}
          />
        )}
      </div>
    </>
  )
}
