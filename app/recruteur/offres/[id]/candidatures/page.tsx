'use client'

/*
  SQL :
  ALTER TABLE public.candidatures ADD COLUMN IF NOT EXISTS statut text default 'envoyée';
  ALTER TABLE public.candidatures ADD COLUMN IF NOT EXISTS masquee_candidat boolean NOT NULL DEFAULT false;
  -- Valeurs statut : 'envoyée', 'vue', 'en cours', 'acceptée', 'refusée'
  -- La table profils doit avoir : prenom, nom, domaine, experience, ville,
  --   signature, qualites (text[]), passions (text[]), type_poste, valeur,
  --   disponibilite, projet_phare, photo_url, competences (text[])
*/

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { trouverConversation } from '@/lib/conversations'
import { calculerScore, type ProfilMatch, type OffreMatch } from '@/lib/matching'
import { getStatut } from '@/lib/statuts'

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
  amber:      '#C88A2A',
  blue:       '#2563EB',
  red:        '#C0392B',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type CandProfil = {
  prenom: string | null
  nom: string | null
  domaine: string | null
  experience: string | null
  ville: string | null
  signature: string | null
  qualites: string[] | null
  passions: string[] | null
  type_poste: string[] | null
  valeur: string | null
  disponibilite: string | null
  projet_phare: string | null
  avatar_url: string | null
  avatar_type: string | null
  competences_acquises: string[] | null
}

type Candidature = {
  id: string
  created_at: string
  candidat_id: string
  offre_id: string
  statut: string
  profil: CandProfil | null
}

type OffreRow = {
  id: string
  titre: string
  type_contrat: string | null
  domaine: string | null
  ville: string | null
  mode_travail: string | null
  experience: string | null
  salaire_min: number | null
  salaire_max: number | null
  periode_salaire: string | null
  competences: string[] | null
  valeurs: string[] | null
}

type StatutKey = 'envoyée' | 'vue' | 'en cours' | 'acceptée' | 'refusée'
const STATUTS: StatutKey[] = ['envoyée', 'vue', 'en cours', 'acceptée', 'refusée']

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_BG = [C.terracotta, '#4A7C6E', '#8B6E4E', '#5C6BC0', '#2C6E49', '#7B5EA7', '#B06000']
function avatarBg(id: string) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return AVATAR_BG[h % AVATAR_BG.length]
}

function dateLabel(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Hier'
  if (days < 7) return `Il y a ${days}j`
  if (days < 30) return `Il y a ${Math.floor(days / 7)} sem.`
  return `Il y a ${Math.floor(days / 30)} mois`
}

// Délégué à lib/statuts — source unique partagée avec la page candidat
const statutInfo = getStatut

function computeScore(cand: Candidature, offre: OffreRow | null): number {
  if (!offre || !cand.profil) return 0
  const p = cand.profil
  const profil: ProfilMatch = {
    domaine:      p.domaine,
    experience:   p.experience,
    type_poste:   p.type_poste,
    valeur:       p.valeur,
    ville:        p.ville,
  }
  const offreMatch: OffreMatch = {
    domaine:      offre.domaine,
    experience:   offre.experience,
    type_contrat: offre.type_contrat,
    valeurs:      offre.valeurs,
    ville:        offre.ville,
    teletravail:  offre.mode_travail === '100% remote' || offre.mode_travail === 'Hybride',
  }
  // Base score: +10 for applying, up to 90 from matching
  return Math.min(100, 10 + Math.round(calculerScore(profil, offreMatch) * 0.9))
}

// ─── Small components ─────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${C.sable}`, borderTopColor: C.terracotta, animation: 'kapolia-spin 0.8s linear infinite' }} />
    </div>
  )
}

function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 500, backgroundColor: C.dark, color: C.white, padding: '12px 22px', borderRadius: 12, fontSize: 13, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.18)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
      {msg}
    </div>
  )
}

function Avatar({ prenom, nom, photoUrl, candidatId, size = 48 }: { prenom?: string | null; nom?: string | null; photoUrl?: string | null; candidatId: string; size?: number }) {
  const letters = `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase() || '?'
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', backgroundColor: avatarBg(candidatId), display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.white, fontSize: size * 0.33, fontWeight: 700 }}>
      {photoUrl ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : letters}
    </div>
  )
}

// ─── Score ring (animated) ────────────────────────────────────────────────────

function ScoreRing({ score, size = 64, delay = 0 }: { score: number; size?: number; delay?: number }) {
  const sw   = 5
  const r    = (size - sw * 2) / 2
  const circ = 2 * Math.PI * r
  const [go, setGo] = useState(false)
  useEffect(() => { const t = setTimeout(() => setGo(true), delay); return () => clearTimeout(t) }, [delay])
  const offset = go ? circ * (1 - score / 100) : circ
  const color  = score >= 75 ? C.vert : score >= 50 ? C.terracotta : C.lightGrey

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.sable} strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.22, fontWeight: 700, color, lineHeight: 1 }}>{score}%</span>
        <span style={{ fontSize: size * 0.14, color: C.grey, lineHeight: 1.2 }}>match</span>
      </div>
    </div>
  )
}

// ─── Status dropdown ──────────────────────────────────────────────────────────

function StatutDropdown({ statut, onChange }: { statut: string; onChange: (s: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const info = statutInfo(statut)

  useEffect(() => {
    function outside(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, border: 'none', backgroundColor: info.bg, color: info.color, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
        {info.label}
        <svg width="8" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke={info.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, backgroundColor: C.white, border: `1px solid ${C.sable}`, borderRadius: 10, padding: 4, minWidth: 140, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', zIndex: 50 }}>
          {STATUTS.map(s => {
            const si = statutInfo(s)
            return <button key={s} onClick={() => { onChange(s); setOpen(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', borderRadius: 7, backgroundColor: 'transparent', color: si.color, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>{si.label}</button>
          })}
        </div>
      )}
    </div>
  )
}

// ─── Stat bar chart ───────────────────────────────────────────────────────────

function StatBar({ cands }: { cands: Candidature[] }) {
  const total   = cands.length
  const counts  = STATUTS.map(s => ({ statut: s, count: cands.filter(c => c.statut === s).length }))
  const statCards = [
    { label: 'Total', count: total, color: C.dark },
    ...STATUTS.map(s => ({ label: statutInfo(s).label, count: counts.find(c => c.statut === s)!.count, color: statutInfo(s).color })),
  ]

  return (
    <div style={{ backgroundColor: C.white, borderRadius: 16, border: `1px solid ${C.sable}`, padding: '22px 24px', marginBottom: 20 }}>
      {/* Stat pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        {statCards.map(s => (
          <div key={s.label} style={{ display: 'flex', flex: '1 1 90px', flexDirection: 'column', alignItems: 'center', padding: '12px 10px', borderRadius: 12, backgroundColor: s.label === 'Total' ? C.creme : `${s.color}0A`, border: `1px solid ${s.label === 'Total' ? C.sable : `${s.color}25`}` }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.count}</div>
            <div style={{ fontSize: 11, color: C.grey, marginTop: 4, textAlign: 'center', fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      {total > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {STATUTS.map(s => {
            const n    = counts.find(c => c.statut === s)!.count
            const pct  = total > 0 ? Math.round((n / total) * 100) : 0
            const info = statutInfo(s)
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 70, fontSize: 11, color: C.grey, fontWeight: 500, flexShrink: 0 }}>{info.label}</div>
                <div style={{ flex: 1, height: 7, borderRadius: 10, backgroundColor: C.creme, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 10, backgroundColor: info.color, transition: 'width 0.6s ease', opacity: 0.8 }} />
                </div>
                <div style={{ width: 32, fontSize: 11, color: C.grey, textAlign: 'right', flexShrink: 0 }}>{n}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Candidate card ───────────────────────────────────────────────────────────

function CandidateCard({ cand, offre, index, selected, isActive, onSelect, onClick, onStatusChange, onMessage }: {
  cand: Candidature; offre: OffreRow | null; index: number
  selected: boolean; isActive: boolean
  onSelect: () => void; onClick: () => void
  onStatusChange: (id: string, s: string) => void
  onMessage: () => void
}) {
  const p      = cand.profil
  const score  = computeScore(cand, offre)
  const offreComps = offre?.competences ?? []
  const candComps  = (p?.competences_acquises ?? []).slice(0, 5)

  return (
    <div
      onClick={onClick}
      style={{ backgroundColor: C.white, borderRadius: 16, border: `2px solid ${isActive ? C.terracotta : selected ? `${C.terracotta}50` : C.sable}`, padding: '20px 22px', cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s', boxShadow: isActive ? `0 0 0 3px ${C.terracotta}15` : '0 1px 6px rgba(0,0,0,0.04)' }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        {/* Checkbox */}
        <div onClick={e => { e.stopPropagation(); onSelect() }} style={{ marginTop: 4, flexShrink: 0 }}>
          <input type="checkbox" checked={selected} onChange={onSelect} onClick={e => e.stopPropagation()} style={{ accentColor: C.terracotta, width: 16, height: 16, cursor: 'pointer' }} />
        </div>

        {/* Avatar */}
        <Avatar prenom={p?.prenom} nom={p?.nom} photoUrl={p?.avatar_type === 'photo' ? p?.avatar_url : null} candidatId={cand.candidat_id} size={48} />

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 3 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.dark }}>{p?.prenom} {p?.nom}</div>
              <div style={{ fontSize: 12, color: C.grey, marginTop: 1 }}>
                {[p?.domaine, p?.experience, p?.ville].filter(Boolean).join(' · ')}
              </div>
            </div>
            <ScoreRing score={score} size={60} delay={index * 60} />
          </div>

          {p?.signature && (
            <div style={{ fontSize: 13, color: C.grey, fontStyle: 'italic', lineHeight: 1.5, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              "{p.signature}"
            </div>
          )}

          {/* Competences with match highlighting */}
          {candComps.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
              {candComps.map((c: string) => {
                const matched = offreComps.some((oc: string) => oc.toLowerCase() === c.toLowerCase())
                return (
                  <span key={c} style={{ padding: '3px 9px', borderRadius: 8, fontSize: 11, fontWeight: matched ? 600 : 400, backgroundColor: matched ? `${C.vert}14` : C.creme, color: matched ? C.vert : C.grey, border: `1px solid ${matched ? `${C.vert}30` : C.sable}` }}>
                    {matched && <span style={{ marginRight: 3 }}>✓</span>}{c}
                  </span>
                )
              })}
            </div>
          )}

          {/* Footer row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
            <StatutDropdown statut={cand.statut} onChange={s => onStatusChange(cand.id, s)} />
            <span style={{ fontSize: 11, color: C.lightGrey }}>{dateLabel(cand.created_at)}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button onClick={e => { e.stopPropagation(); onClick() }} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${C.sable}`, backgroundColor: 'transparent', color: C.dark, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                Voir profil
              </button>
              <button onClick={e => { e.stopPropagation(); onMessage() }} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${C.terracotta}`, backgroundColor: `${C.terracotta}0D`, color: C.terracotta, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                Écrire
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Right panel ──────────────────────────────────────────────────────────────

function CandidatePanel({ cand, offre, onClose, onStatusChange, onMessage }: {
  cand: Candidature; offre: OffreRow | null
  onClose: () => void
  onStatusChange: (id: string, s: string) => void
  onMessage: () => void
}) {
  const router = useRouter()
  const p      = cand.profil
  const score  = computeScore(cand, offre)

  return (
    <div style={{ width: 300, flexShrink: 0, backgroundColor: C.white, borderLeft: `1px solid ${C.sable}`, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

      {/* Header */}
      <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${C.sable}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Avatar prenom={p?.prenom} nom={p?.nom} photoUrl={p?.avatar_type === 'photo' ? p?.avatar_url : null} candidatId={cand.candidat_id} size={40} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.dark }}>{p?.prenom} {p?.nom}</div>
            <div style={{ fontSize: 11, color: C.grey, marginTop: 1 }}>{p?.domaine}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.sable}`, backgroundColor: 'transparent', color: C.grey, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      </div>

      {/* Score + statut */}
      <div style={{ padding: '16px 18px', borderBottom: `1px solid ${C.sable}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <ScoreRing score={score} size={64} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <StatutDropdown statut={cand.statut} onChange={s => onStatusChange(cand.id, s)} />
          <div style={{ fontSize: 11, color: C.grey }}>{dateLabel(cand.created_at)}</div>
        </div>
      </div>

      {/* Profile details */}
      <div style={{ flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {p?.signature && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Signature</div>
            <div style={{ fontSize: 13, color: C.dark, fontStyle: 'italic', lineHeight: 1.6 }}>"{p.signature}"</div>
          </div>
        )}

        {[p?.experience, p?.ville].some(Boolean) && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Informations</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {p?.experience && <div style={{ fontSize: 12, color: C.dark }}>⌛ {p.experience}</div>}
              {p?.ville      && <div style={{ fontSize: 12, color: C.dark }}>◎ {p.ville}</div>}
              {(p?.type_poste ?? []).length > 0 && <div style={{ fontSize: 12, color: C.dark }}>◈ Cherche {(p!.type_poste!).map(k => ({ cdi:'CDI',cdd:'CDD',freelance:'Freelance',alternance:'Alternance',stage:'Stage',ouvert:'Tout type' })[k] ?? k).join(' · ')}</div>}
            </div>
          </div>
        )}

        {(p?.qualites ?? []).length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Qualités</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {(p!.qualites ?? []).map(q => <span key={q} style={{ padding: '3px 9px', borderRadius: 20, backgroundColor: `${C.vert}10`, border: `1px solid ${C.vert}20`, fontSize: 11, color: C.vert, fontWeight: 500 }}>{q}</span>)}
            </div>
          </div>
        )}

        {(p?.competences_acquises ?? []).length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Compétences</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {(p!.competences_acquises ?? []).map((c: string) => {
                const matched = (offre?.competences ?? []).some((oc: string) => oc.toLowerCase() === c.toLowerCase())
                return <span key={c} style={{ padding: '3px 9px', borderRadius: 8, fontSize: 11, backgroundColor: matched ? `${C.vert}14` : C.creme, color: matched ? C.vert : C.grey, fontWeight: matched ? 600 : 400, border: `1px solid ${matched ? `${C.vert}25` : C.sable}` }}>{matched && '✓ '}{c}</span>
              })}
            </div>
          </div>
        )}

        {p?.projet_phare && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Projet phare</div>
            <div style={{ fontSize: 12, color: C.dark, lineHeight: 1.6, backgroundColor: C.creme, borderRadius: 8, padding: '10px 12px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.projet_phare}</div>
          </div>
        )}

        {(p?.passions ?? []).length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Passions</div>
            <div style={{ fontSize: 12, color: C.grey }}>{(p!.passions ?? []).join(' · ')}</div>
          </div>
        )}

        {p?.valeur && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Valeur clé</div>
            <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 20, backgroundColor: `${C.terracotta}12`, color: C.terracotta, fontSize: 12, fontWeight: 600 }}>{p.valeur}</div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ padding: '14px 18px', borderTop: `1px solid ${C.sable}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onStatusChange(cand.id, 'acceptée')} style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', backgroundColor: `${C.vert}14`, color: C.vert, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✓ Accepter</button>
          <button onClick={() => onStatusChange(cand.id, 'refusée')} style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', backgroundColor: '#FDECEA', color: C.red, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✕ Refuser</button>
        </div>
        <button onClick={() => onStatusChange(cand.id, 'en cours')} style={{ width: '100%', padding: '9px', borderRadius: 10, border: `1px solid ${C.sable}`, backgroundColor: 'transparent', color: C.grey, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>⏸ Mettre en attente</button>
        <button onClick={onMessage} style={{ width: '100%', padding: '9px', borderRadius: 10, border: `1.5px solid ${C.terracotta}`, backgroundColor: `${C.terracotta}0D`, color: C.terracotta, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Envoyer un message
        </button>
        <button onClick={() => router.push(`/recruteur/candidats/${cand.candidat_id}`)} style={{ width: '100%', padding: '9px', borderRadius: 10, border: 'none', backgroundColor: C.terracotta, color: C.white, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Voir profil complet →
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CandidaturesPage() {
  const router  = useRouter()
  const params  = useParams()
  const id      = params.id as string

  const [offre, setOffre]         = useState<OffreRow | null>(null)
  const [cands, setCands]         = useState<Candidature[]>([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState<'toutes' | StatutKey>('toutes')
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [active, setActive]       = useState<Candidature | null>(null)
  const [toastMsg, setToastMsg]   = useState('')
  const [bulkStatut, setBulkStatut] = useState<StatutKey>('vue')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true)

      console.log('params.id:', params.id)

      const { data: offreData } = await supabase
        .from('offres')
        .select('id, titre, type_contrat, domaine, ville, mode_travail, experience, salaire_min, salaire_max, periode_salaire, competences, valeurs')
        .eq('id', params.id)
        .single()
      if (offreData) setOffre(offreData as OffreRow)

      // Étape 1 : charger les candidatures
      const { data: candidaturesData, error: candError } = await supabase
        .from('candidatures')
        .select('id, created_at, statut, candidat_id, offre_id')
        .eq('offre_id', params.id)
        .order('created_at', { ascending: false })

      if (candError) console.log('erreur candidatures:', candError)

      // Étape 2 : charger les profils séparément et fusionner
      if (candidaturesData && candidaturesData.length > 0) {
        const candidatIds = candidaturesData.map(c => c.candidat_id)

        const { data: profilsData, error: profilsError } = await supabase
          .from('profils')
          .select('user_id, prenom, nom, domaine, experience, ville, signature, qualites, competences_acquises, avatar_url, avatar_type, projet_phare, passions, type_poste, structure, disponibilite, valeur')
          .in('user_id', candidatIds)

        if (profilsError) console.log('erreur profils:', profilsError)

        setCands(candidaturesData.map(c => ({
          ...c,
          profil: (profilsData?.find(p => p.user_id === c.candidat_id) ?? null) as CandProfil | null,
        })))
      } else {
        setCands([])
      }

      setLoading(false)
    }
    load()
  }, [id])

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToastMsg(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(''), 2800)
  }

  // ── Status change ─────────────────────────────────────────────────────────

  async function changeStatus(candId: string, statut: string) {
    await supabase.from('candidatures').update({ statut }).eq('id', candId)
    setCands(p => p.map(c => c.id === candId ? { ...c, statut } : c))
    if (active?.id === candId) setActive(prev => prev ? { ...prev, statut } : null)
    showToast(`Statut → ${statutInfo(statut).label}`)
  }

  // ── Bulk ─────────────────────────────────────────────────────────────────

  async function applyBulkStatus() {
    const ids = [...selected]
    await supabase.from('candidatures').update({ statut: bulkStatut }).in('id', ids)
    setCands(p => p.map(c => ids.includes(c.id) ? { ...c, statut: bulkStatut } : c))
    setSelected(new Set())
    showToast(`${ids.length} candidature${ids.length > 1 ? 's' : ''} → ${statutInfo(bulkStatut).label}`)
  }

  // ── Filtering ─────────────────────────────────────────────────────────────

  const displayed = useMemo(() => {
    return cands.filter(c => {
      if (tab !== 'toutes' && c.statut !== tab) return false
      if (search) {
        const q = search.toLowerCase()
        const p = c.profil
        const name = `${p?.prenom ?? ''} ${p?.nom ?? ''}`.toLowerCase()
        if (!name.includes(q) && !(p?.domaine ?? '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [cands, tab, search])

  const TABS: { key: 'toutes' | StatutKey; label: string }[] = [
    { key: 'toutes',   label: 'Toutes' },
    ...STATUTS.map(s => ({ key: s as 'toutes' | StatutKey, label: statutInfo(s).label })),
  ]

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', backgroundColor: C.creme }}>
      <style suppressHydrationWarning>{`
        @keyframes kapolia-spin { to { transform: rotate(360deg); } }
      `}</style>

      <Toast msg={toastMsg} />

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', minWidth: 0, overflow: 'hidden' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* ── HEADER ──────────────────────────────────────────────────── */}
          <div style={{ backgroundColor: C.white, borderBottom: `1px solid ${C.sable}`, padding: '20px 28px 0', position: 'sticky', top: 0, zIndex: 10 }}>

            {/* Breadcrumb + title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <button onClick={() => router.push('/recruteur/offres')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.sable}`, backgroundColor: 'transparent', color: C.grey, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                ← Mes offres
              </button>
              <span style={{ color: C.lightGrey, fontSize: 13 }}>/</span>
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  {offre && <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: C.dark, fontWeight: 600 }}>{offre.titre}</div>}
                  <div style={{ fontSize: 12, color: C.grey, marginTop: 2 }}>
                    {cands.length} candidature{cands.length !== 1 ? 's' : ''} reçue{cands.length !== 1 ? 's' : ''}
                  </div>
                </div>
                {/* Search */}
                <div style={{ position: 'relative', width: 240 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.lightGrey} strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un candidat…" style={{ width: '100%', padding: '8px 10px 8px 30px', fontSize: 12, borderRadius: 8, border: `1.5px solid ${C.sable}`, backgroundColor: C.white, color: C.dark, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                </div>
              </div>
            </div>

            {/* Status filter tabs */}
            <div style={{ display: 'flex', gap: 0 }}>
              {TABS.map(t => {
                const cnt    = t.key === 'toutes' ? cands.length : cands.filter(c => c.statut === t.key).length
                const active = tab === t.key
                const info   = t.key !== 'toutes' ? statutInfo(t.key) : null
                return (
                  <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '10px 14px', border: 'none', borderBottom: `2px solid ${active ? (info?.color ?? C.dark) : 'transparent'}`, backgroundColor: 'transparent', color: active ? (info?.color ?? C.dark) : C.grey, fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                    {t.label}
                    <span style={{ padding: '1px 6px', borderRadius: 20, backgroundColor: active ? `${info?.color ?? C.dark}14` : C.creme, color: active ? (info?.color ?? C.dark) : C.grey, fontSize: 10, fontWeight: 600 }}>{cnt}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── CONTENT ─────────────────────────────────────────────────── */}
          <div style={{ padding: '20px 28px 80px', flex: 1, overflowY: 'auto' }}>
            {loading ? <Spinner /> : (
              <>
                <StatBar cands={cands} />

                {displayed.length === 0 ? (
                  <div style={{ backgroundColor: C.white, borderRadius: 16, border: `1px solid ${C.sable}`, padding: '60px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>◎</div>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: C.dark, marginBottom: 6 }}>
                      {tab === 'toutes' ? 'Aucune candidature reçue' : `Aucune candidature « ${statutInfo(tab).label} »`}
                    </div>
                    <div style={{ fontSize: 13, color: C.grey }}>
                      {tab === 'toutes' ? 'Les candidatures apparaîtront ici dès que des profils postulent.' : 'Essayez un autre filtre.'}
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 13, color: C.grey }}><strong style={{ color: C.dark }}>{displayed.length}</strong> candidat{displayed.length !== 1 ? 's' : ''}</span>
                      <button onClick={() => { if (selected.size === displayed.length) setSelected(new Set()); else setSelected(new Set(displayed.map(c => c.id))) }} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.sable}`, backgroundColor: 'transparent', color: C.grey, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {selected.size === displayed.length && selected.size > 0 ? 'Désélectionner' : 'Tout sélectionner'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {displayed.map((c, i) => (
                        <CandidateCard
                          key={c.id}
                          cand={c}
                          offre={offre}
                          index={i}
                          selected={selected.has(c.id)}
                          isActive={active?.id === c.id}
                          onSelect={() => setSelected(s => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n })}
                          onClick={() => setActive(prev => prev?.id === c.id ? null : c)}
                          onStatusChange={changeStatus}
                          onMessage={async () => {
                            const existing = await trouverConversation(c.candidat_id, offre?.id)
                            if (existing) { router.push(`/recruteur/messages?conv=${existing}`); return }
                            const p = new URLSearchParams({ new: c.candidat_id })
                            if (offre?.id) p.set('offre', offre.id)
                            router.push(`/recruteur/messages?${p}`)
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL ─────────────────────────────────────────────── */}
        {active && (
          <CandidatePanel
            cand={active}
            offre={offre}
            onClose={() => setActive(null)}
            onStatusChange={changeStatus}
            onMessage={async () => {
              const existing = await trouverConversation(active.candidat_id, offre?.id)
              if (existing) { router.push(`/recruteur/messages?conv=${existing}`); return }
              const p = new URLSearchParams({ new: active.candidat_id })
              if (offre?.id) p.set('offre', offre.id)
              router.push(`/recruteur/messages?${p}`)
            }}
          />
        )}
      </div>

      {/* ── BULK BAR ────────────────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 200, backgroundColor: C.dark, color: C.white, borderRadius: 16, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 6px 30px rgba(0,0,0,0.22)', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{selected.size} sélectionné{selected.size > 1 ? 's' : ''}</span>
          <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.2)' }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Changer statut :</span>
          <select value={bulkStatut} onChange={e => setBulkStatut(e.target.value as StatutKey)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)', color: C.white, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            {STATUTS.map(s => <option key={s} value={s} style={{ backgroundColor: C.dark }}>{statutInfo(s).label}</option>)}
          </select>
          <button onClick={applyBulkStatus} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', backgroundColor: C.terracotta, color: C.white, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Appliquer</button>
          <button onClick={() => setSelected(new Set())} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
      )}
    </div>
  )
}
