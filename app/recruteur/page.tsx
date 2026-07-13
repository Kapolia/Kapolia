'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  terracotta: '#C4673A',
  sable: '#E8D5B7',
  creme: '#F7F2EB',
  vert: '#2C4A3E',
  dark: '#1A1A1A',
  grey: '#6B6B6B',
  white: '#FFFFFF',
  amber: '#C88A2A',
}

// ─── Score ring ───────────────────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

type Dispo = 'dispo' | 'ouvert' | 'inactif'

type Candidate = {
  id: number
  initials: string
  avatarBg: string
  nom: string
  domaine: string
  poste: string
  experience: string
  ville: string
  dispo: Dispo
  score: number
  signature: string
  competences: string[]
  qualites: string[]
  valeur: string
}

type Filters = {
  domaine: string
  experience: string
  localisation: string
  typePoste: string
  valeurCle: string
  scoreMin: number
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const CANDIDATES: Candidate[] = [
  {
    id: 1, initials: 'SM', avatarBg: C.terracotta,
    nom: 'Sophie Marchand', domaine: 'Design & Créativité', poste: 'UX Designer',
    experience: '5–10 ans', ville: 'Lyon', dispo: 'dispo', score: 83,
    signature: 'Je crois que le bon design commence par écouter vraiment les gens.',
    competences: ['UX Research', 'Figma', 'Design System'],
    qualites: ['Empathique', 'Curieuse', 'Rigoureuse'],
    valeur: 'Honnêteté & transparence',
  },
  {
    id: 2, initials: 'AD', avatarBg: '#4A7C6E',
    nom: 'Alexandre Dubois', domaine: 'Tech & Ingénierie', poste: 'Product Manager',
    experience: '5–10 ans', ville: 'Paris', dispo: 'dispo', score: 91,
    signature: "Un bon produit, c'est d'abord 80 % d'écoute et 20 % de décision.",
    competences: ['Roadmap', 'OKR', 'Agile'],
    qualites: ['Stratégique', 'Fédérateur', 'Direct'],
    valeur: 'Impact mesurable',
  },
  {
    id: 3, initials: 'MC', avatarBg: '#7B6E8E',
    nom: 'Marie Chen', domaine: 'Tech & Ingénierie', poste: 'Data Scientist',
    experience: '2–5 ans', ville: 'Bordeaux', dispo: 'ouvert', score: 67,
    signature: 'Les données ne mentent pas — mais elles ont besoin d\'être bien interprétées.',
    competences: ['Python', 'Machine Learning', 'SQL'],
    qualites: ['Analytique', 'Précise', 'Curieuse'],
    valeur: 'Apprentissage continu',
  },
  {
    id: 4, initials: 'TP', avatarBg: '#2E6E5A',
    nom: 'Thomas Petit', domaine: 'Tech & Ingénierie', poste: 'Dév. Full Stack',
    experience: '5–10 ans', ville: 'Lyon', dispo: 'dispo', score: 88,
    signature: "Je construis des produits robustes avec une obsession pour la DX.",
    competences: ['React', 'Node.js', 'TypeScript'],
    qualites: ['Fiable', 'Autonome', 'Pédagogue'],
    valeur: 'Code de qualité',
  },
  {
    id: 5, initials: 'CR', avatarBg: '#B85C38',
    nom: 'Camille Rousseau', domaine: 'Design & Créativité', poste: 'Brand Designer',
    experience: '2–5 ans', ville: 'Nantes', dispo: 'ouvert', score: 74,
    signature: "Une identité visuelle forte, c'est une promesse tenue.",
    competences: ['Branding', 'Illustrator', 'Motion Design'],
    qualites: ['Créative', 'Sensible', 'Rigoureuse'],
    valeur: 'Cohérence créative',
  },
  {
    id: 6, initials: 'LM', avatarBg: '#5A6E7B',
    nom: 'Lucas Martin', domaine: 'Tech & Ingénierie', poste: 'DevOps Engineer',
    experience: '< 2 ans', ville: 'Toulouse', dispo: 'inactif', score: 55,
    signature: "Je veux construire des pipelines qui permettent aux équipes de livrer en confiance.",
    competences: ['Docker', 'CI/CD', 'Kubernetes'],
    qualites: ['Méthodique', 'Patient', 'Curieux'],
    valeur: 'Fiabilité systèmes',
  },
]

const DISPO: Record<Dispo, { dot: string; label: string }> = {
  dispo: { dot: '#4CAF50', label: 'Disponible' },
  ouvert: { dot: '#E8973A', label: 'Ouvert' },
  inactif: { dot: '#9E9E9E', label: 'Non actif' },
}

const STATS = [
  { label: 'Profils disponibles', value: '247', sub: '+12 ce mois' },
  { label: 'Matchs >75%', value: '34', sub: '↑ 8 depuis hier' },
  { label: 'Sauvegardés', value: '12', sub: '3 nouveaux' },
  { label: 'Taux de réponse', value: '78%', sub: 'Excellent' },
]

const FILTER_LABELS: Record<string, string> = {
  domaine: 'Domaine', experience: 'Expérience', localisation: 'Localisation',
  typePoste: 'Type de poste', valeurCle: 'Valeur clé', scoreMin: 'Score min.',
}

// ─── Filter select / input ────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: '8px', fontSize: '13px',
  border: `1.5px solid ${C.sable}`, backgroundColor: C.white, color: C.dark,
  outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
}

function FLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: '11px', fontWeight: '600', color: C.grey, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '5px' }}>
      {children}
    </label>
  )
}

// ─── Candidate row ────────────────────────────────────────────────────────────

function CandidateRow({
  cand, index, selectedId, onSelect, saved, onSave,
}: {
  cand: Candidate; index: number; selectedId: number | null
  onSelect: (id: number) => void; saved: boolean; onSave: () => void
}) {
  const [hover, setHover] = useState(false)
  const isSelected = selectedId === cand.id
  const dp = DISPO[cand.dispo]

  return (
    <div
      onClick={() => onSelect(cand.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        padding: '14px 18px',
        borderBottom: `1px solid ${C.sable}`,
        borderLeft: `3px solid ${isSelected ? C.terracotta : 'transparent'}`,
        backgroundColor: isSelected ? 'rgba(196,103,58,0.03)' : hover ? 'rgba(26,26,26,0.015)' : 'transparent',
        cursor: 'pointer', transition: 'background-color 0.12s',
      }}
    >
      {/* Avatar */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: '42px', height: '42px', borderRadius: '50%',
          backgroundColor: cand.avatarBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Georgia, serif', fontSize: '14px', color: C.white,
        }}>
          {cand.initials}
        </div>
        <span style={{
          position: 'absolute', bottom: '1px', right: '1px',
          width: '9px', height: '9px', borderRadius: '50%',
          backgroundColor: dp.dot, border: `2px solid ${C.white}`,
        }} />
      </div>

      {/* Name / meta */}
      <div style={{ width: 148, flexShrink: 0 }}>
        <div style={{ fontSize: '13.5px', fontWeight: '600', color: C.dark, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {cand.nom}
        </div>
        <div style={{ fontSize: '12px', color: C.grey, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {cand.poste} · {cand.experience}
        </div>
        <div style={{ fontSize: '11px', color: C.grey, marginTop: '1px' }}>📍 {cand.ville}</div>
      </div>

      {/* Signature + skills */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: 'Georgia, serif', fontStyle: 'italic',
          fontSize: '12.5px', color: C.grey, lineHeight: '1.5',
          margin: '0 0 7px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          « {cand.signature} »
        </p>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {cand.competences.map((skill, i) => (
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
      </div>

      {/* Score */}
      <ScoreRing score={cand.score} size={54} delay={index * 100} />

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
  cand, onClose, saved, onSave,
}: {
  cand: Candidate; onClose: () => void; saved: boolean; onSave: () => void
}) {
  const dp = DISPO[cand.dispo]

  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

      {/* Header — vert profond */}
      <div style={{ backgroundColor: C.vert, padding: '18px 22px 22px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.5)', fontSize: '18px', padding: '2px 4px', lineHeight: 1,
          }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0,
            backgroundColor: cand.avatarBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Georgia, serif', fontSize: '17px', color: C.white,
          }}>
            {cand.initials}
          </div>
          <div>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '19px', color: C.white, fontWeight: '400', margin: '0 0 4px' }}>
              {cand.nom}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: dp.dot, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)' }}>{dp.label} · {cand.ville}</span>
            </div>
          </div>
        </div>
        <p style={{
          fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '13px',
          color: 'rgba(255,255,255,0.78)', lineHeight: '1.7', margin: 0,
          borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '14px',
        }}>
          « {cand.signature} »
        </p>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 22px', flex: 1 }}>

        {/* Score + badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '22px' }}>
          <ScoreRing key={cand.id} score={cand.score} size={76} delay={80} sw={7} />
          <div>
            <div style={{ fontSize: '11px', color: C.grey, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '600' }}>
              Compatibilité
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ padding: '4px 10px', borderRadius: '16px', backgroundColor: C.vert, color: C.white, fontSize: '11px' }}>
                {cand.domaine}
              </span>
              <span style={{ padding: '4px 10px', borderRadius: '16px', border: `1.5px solid ${C.sable}`, color: C.dark, fontSize: '11px' }}>
                {cand.experience}
              </span>
            </div>
          </div>
        </div>

        {/* Qualités */}
        <div style={{ marginBottom: '18px' }}>
          <div style={panelSub}>Qualités naturelles</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {cand.qualites.map(q => (
              <span key={q} style={{ padding: '4px 11px', borderRadius: '16px', backgroundColor: 'rgba(44,74,62,0.09)', color: C.vert, fontSize: '12px', fontWeight: '500' }}>
                {q}
              </span>
            ))}
          </div>
        </div>

        {/* Compétences */}
        <div style={{ marginBottom: '18px' }}>
          <div style={panelSub}>Compétences</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {cand.competences.map((s, i) => (
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

        {/* Valeur */}
        <div style={{ padding: '13px 15px', borderRadius: '12px', backgroundColor: C.creme, border: `1px solid ${C.sable}`, marginBottom: '22px' }}>
          <div style={panelSub}>Valeur non négociable</div>
          <div style={{ fontSize: '13.5px', color: C.dark, fontWeight: '500' }}>🤝 {cand.valeur}</div>
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button style={{
            width: '100%', padding: '12px', borderRadius: '11px', border: 'none',
            backgroundColor: C.vert, color: C.white, fontSize: '14px', fontWeight: '500', cursor: 'pointer',
          }}>
            ✉ Écrire à {cand.nom.split(' ')[0]}
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onSave} style={{
              flex: 1, padding: '10px', borderRadius: '11px',
              border: `1.5px solid ${saved ? C.terracotta : C.sable}`,
              backgroundColor: saved ? 'rgba(196,103,58,0.08)' : C.white,
              color: saved ? C.terracotta : C.dark, fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {saved ? '★ Sauvegardé' : '☆ Sauvegarder'}
            </button>
            <a href="/profil" style={{
              flex: 1, padding: '10px', borderRadius: '11px',
              border: `1.5px solid ${C.sable}`, backgroundColor: C.white,
              color: C.dark, fontSize: '13px', cursor: 'pointer',
              textDecoration: 'none', textAlign: 'center',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              Profil complet →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

const panelSub: React.CSSProperties = {
  fontSize: '11px', fontWeight: '600', color: C.grey,
  textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px',
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

export default function RecruteurPage() {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Filters>({
    domaine: 'Design & Créativité', experience: '',
    localisation: 'Lyon', typePoste: '', valeurCle: '', scoreMin: 0,
  })
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set([1]))
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [page, setPage] = useState(2)

  const activeTags = Object.entries(filters)
    .filter(([k, v]) => k === 'scoreMin' ? (v as number) > 0 : (v as string).length > 0)
    .map(([k, v]) => ({
      key: k,
      label: FILTER_LABELS[k],
      value: k === 'scoreMin' ? `≥ ${v}%` : v as string,
    }))

  function removeTag(key: string) {
    setFilters(prev => ({ ...prev, [key]: key === 'scoreMin' ? 0 : '' }))
  }

  function clearAll() {
    setFilters({ domaine: '', experience: '', localisation: '', typePoste: '', valeurCle: '', scoreMin: 0 })
  }

  function toggleSave(id: number) {
    setSavedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const selected = selectedId !== null ? (CANDIDATES.find(c => c.id === selectedId) ?? null) : null

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
            Trouver des profils
          </h1>
          <div style={{ position: 'relative' }}>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un profil…"
              style={{
                padding: '8px 12px 8px 34px', borderRadius: '9px', width: '220px',
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

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
            {STATS.map((s, i) => (
              <div key={s.label} style={{
                backgroundColor: C.white, borderRadius: '13px', padding: '16px 18px',
                border: `1px solid ${C.sable}`,
              }}>
                <div style={{
                  fontFamily: 'Georgia, serif', fontSize: '26px', fontWeight: '400', lineHeight: 1, marginBottom: '4px',
                  color: [C.vert, C.terracotta, '#4A7C6E', C.amber][i],
                }}>
                  {s.value}
                </div>
                <div style={{ fontSize: '12.5px', fontWeight: '600', color: C.dark, marginBottom: '3px' }}>{s.label}</div>
                <div style={{ fontSize: '11px', color: C.grey }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ backgroundColor: C.white, borderRadius: '14px', padding: '16px 18px', marginBottom: '14px', border: `1px solid ${C.sable}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: activeTags.length > 0 ? '12px' : 0 }}>

              {/* Domaine */}
              <div>
                <FLabel>Domaine</FLabel>
                <select value={filters.domaine} onChange={e => setFilters(f => ({ ...f, domaine: e.target.value }))} style={selectStyle}>
                  <option value="">Tous</option>
                  {['Design & Créativité', 'Tech & Ingénierie', 'Marketing & Com', 'Finance & Compta', 'RH & Recrutement'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>

              {/* Expérience */}
              <div>
                <FLabel>Expérience</FLabel>
                <select value={filters.experience} onChange={e => setFilters(f => ({ ...f, experience: e.target.value }))} style={selectStyle}>
                  <option value="">Toutes</option>
                  {['< 2 ans', '2–5 ans', '5–10 ans', '10+ ans'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>

              {/* Localisation */}
              <div>
                <FLabel>Localisation</FLabel>
                <input type="text" value={filters.localisation} placeholder="Ville ou région…"
                  onChange={e => setFilters(f => ({ ...f, localisation: e.target.value }))}
                  style={{ ...selectStyle, cursor: 'text' }}
                />
              </div>

              {/* Type de poste */}
              <div>
                <FLabel>Type de poste</FLabel>
                <select value={filters.typePoste} onChange={e => setFilters(f => ({ ...f, typePoste: e.target.value }))} style={selectStyle}>
                  <option value="">Tous</option>
                  {['CDI', 'CDD', 'Freelance / Mission', 'Alternance'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>

              {/* Valeur clé */}
              <div>
                <FLabel>Valeur clé</FLabel>
                <input type="text" value={filters.valeurCle} placeholder="ex : transparence…"
                  onChange={e => setFilters(f => ({ ...f, valeurCle: e.target.value }))}
                  style={{ ...selectStyle, cursor: 'text' }}
                />
              </div>

              {/* Score minimum */}
              <div>
                <FLabel>Score minimum</FLabel>
                <select
                  value={filters.scoreMin === 0 ? '' : filters.scoreMin.toString()}
                  onChange={e => setFilters(f => ({ ...f, scoreMin: e.target.value ? parseInt(e.target.value) : 0 }))}
                  style={selectStyle}
                >
                  <option value="">Aucun</option>
                  {['50', '65', '75', '85'].map(o => <option key={o} value={o}>≥ {o}%</option>)}
                </select>
              </div>
            </div>

            {/* Active tags */}
            {activeTags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '10px', borderTop: `1px solid ${C.sable}` }}>
                {activeTags.map(tag => (
                  <span key={tag.key} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '3px 9px', borderRadius: '16px', fontSize: '12px',
                    backgroundColor: 'rgba(196,103,58,0.08)', border: `1px solid rgba(196,103,58,0.22)`,
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

          {/* Candidate list */}
          <div style={{ backgroundColor: C.white, borderRadius: '14px', border: `1px solid ${C.sable}`, overflow: 'hidden', marginBottom: '14px' }}>
            <div style={{
              padding: '11px 18px', borderBottom: `1px solid ${C.sable}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '12.5px', fontWeight: '600', color: C.dark }}>
                247 profils ·{' '}
                <span style={{ color: C.terracotta }}>34 matchs &gt;75%</span>
              </span>
              <span style={{ fontSize: '12px', color: C.grey }}>Trier par : Score ▼</span>
            </div>

            {CANDIDATES.map((cand, i) => (
              <CandidateRow
                key={cand.id}
                cand={cand}
                index={i}
                selectedId={selectedId}
                onSelect={setSelectedId}
                saved={savedIds.has(cand.id)}
                onSave={() => toggleSave(cand.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <PagBtn label="←" onClick={() => setPage(p => Math.max(1, p - 1))} />
            {[1, 2, 3, 4, 5].map(p => (
              <PagBtn key={p} label={String(p)} active={page === p} onClick={() => setPage(p)} />
            ))}
            <PagBtn label="→" onClick={() => setPage(p => Math.min(5, p + 1))} />
          </div>

        </div>
      </main>

      {/* Right panel slide-in */}
      {selectedId !== null && (
        <div
          onClick={() => setSelectedId(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(26,26,26,0.12)', zIndex: 99 }}
        />
      )}
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
            key={selected.id}
            cand={selected}
            onClose={() => setSelectedId(null)}
            saved={savedIds.has(selected.id)}
            onSave={() => toggleSave(selected.id)}
          />
        )}
      </div>

    </>
  )
}
