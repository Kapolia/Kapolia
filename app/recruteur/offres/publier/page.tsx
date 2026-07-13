'use client'

/*
  SQL — Supabase SQL Editor :

  ALTER TABLE public.offres ADD COLUMN IF NOT EXISTS salaire_min         integer;
  ALTER TABLE public.offres ADD COLUMN IF NOT EXISTS salaire_max         integer;
  ALTER TABLE public.offres ADD COLUMN IF NOT EXISTS periode_salaire     text    default 'annuel';
  ALTER TABLE public.offres ADD COLUMN IF NOT EXISTS mode_travail        text;
  ALTER TABLE public.offres ADD COLUMN IF NOT EXISTS jours_remote        integer;
  ALTER TABLE public.offres ADD COLUMN IF NOT EXISTS deplacements        text;
  ALTER TABLE public.offres ADD COLUMN IF NOT EXISTS missions            text[];
  ALTER TABLE public.offres ADD COLUMN IF NOT EXISTS profil_recherche    text;
  ALTER TABLE public.offres ADD COLUMN IF NOT EXISTS competences_bonus   text[];
  ALTER TABLE public.offres ADD COLUMN IF NOT EXISTS avantages           text[];
  ALTER TABLE public.offres ADD COLUMN IF NOT EXISTS process_recrutement text[];
  ALTER TABLE public.offres ADD COLUMN IF NOT EXISTS date_debut          text;
  ALTER TABLE public.offres ADD COLUMN IF NOT EXISTS pays                text    default 'France';
  ALTER TABLE public.offres ADD COLUMN IF NOT EXISTS statut              text    default 'publiée';
  ALTER TABLE public.offres ADD COLUMN IF NOT EXISTS statut_publication  text    default 'publiée';
*/

import React, { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
  error:      '#C0392B',
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTRATS    = ['CDI', 'CDD', 'Freelance', 'Alternance', 'Stage', 'Intérim']
const DOMAINES    = ['Tech', 'Design', 'Marketing', 'Finance', 'Commerce', 'RH', 'Santé', 'Droit', 'Éducation', 'Autre']
const NIVEAUX     = ['Sans expérience', '1-2 ans', '3-5 ans', '5-10 ans', '+10 ans']
const MODES       = ['100% présentiel', 'Hybride', '100% remote']
const DEPLACS     = ['Jamais', 'Occasionnels', 'Fréquents']
const VALEURS     = ['Impact', 'Autonomie', 'Innovation', 'Équipe', 'Rigueur', 'Créativité', 'Leadership']
const AVANTAGES   = ['Mutuelle', 'RTT', 'Tickets restaurant', 'Intéressement', 'Stock options', 'Formation', 'Véhicule de fonction', 'Remboursement transport', 'Télétravail', 'Salle de sport']
const PAYS_OPTS   = ['France', 'Belgique', 'Suisse', 'Luxembourg', 'Canada', 'Allemagne', 'Autre']
const STEP_LABELS = ['Informations générales', 'Localisation', 'Description', 'Publication']
const DESC_MIN    = 200
const DESC_MAX    = 2000

// F3 — Suggestions de compétences par domaine
const COMP_SUGGESTIONS: Record<string, string[]> = {
  'Tech':      ['JavaScript', 'React', 'Node.js', 'Python', 'SQL', 'Git', 'AWS', 'Docker', 'TypeScript', 'Next.js'],
  'Design':    ['Figma', 'Adobe XD', 'Sketch', 'Photoshop', 'Illustrator', 'UX Research', 'Prototypage', 'CSS'],
  'Marketing': ['SEO', 'Google Ads', 'Meta Ads', 'Analytics', 'Content Marketing', 'CRM', 'Email Marketing'],
  'Finance':   ['Excel', 'Comptabilité', 'Analyse financière', 'ERP', 'Reporting', 'Contrôle de gestion'],
  'Commerce':  ['Prospection', 'CRM', 'Négociation', 'Salesforce', 'Account Management', 'B2B'],
  'RH':        ['Recrutement', 'SIRH', 'Paie', 'Formation', 'Droit du travail', 'ATS'],
  'Santé':     ['Soins infirmiers', 'Médecine générale', 'Pharmacologie', 'Bloc opératoire', 'Urgences'],
  'Droit':     ['Droit des affaires', 'Contrats', 'Droit social', 'Contentieux', 'LegalTech'],
  'Éducation': ['Pédagogie', 'E-learning', 'Formation adultes', 'Curriculum', 'Évaluation'],
}

// F1 — Icônes d'avantages pour la modale
const AVANTAGE_ICONS: Record<string, string> = {
  'Mutuelle': '🏥', 'RTT': '🏖️', 'Tickets restaurant': '🍽️',
  'Intéressement': '💰', 'Stock options': '📈', 'Formation': '🎓',
  'Véhicule de fonction': '🚗', 'Remboursement transport': '🚇',
  'Télétravail': '🏠', 'Salle de sport': '💪',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PreviewData = {
  titre: string; contrat: string; domaine: string; niveau: string
  salaireMin: string; salaireMax: string; periode: string
  ville: string; pays: string; modeTravail: string; joursRemote: number
  dateDebut: string; debutImmediat: boolean
  description: string; missions: string[]; profilRecherche: string
  competences: string[]; competencesBonus: string[]
  valeurs: string[]; avantages: string[]
  processRecrutement: string[]
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SLabel({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 600, color: C.dark }}>{children}</div>
      {sub && <div style={{ fontSize: 12, color: C.grey, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}
function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null
  return <div style={{ fontSize: 12, color: C.error, marginTop: 5 }}>{msg}</div>
}
function Divider() { return <div style={{ height: 1, backgroundColor: C.sable }} /> }
function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ backgroundColor: C.white, borderRadius: 20, border: `1px solid ${C.sable}`, padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 28 }}>{children}</div>
}

function Pills({ options, value, onChange, multi = false, color = C.terracotta }: {
  options: string[]; value: string | string[]
  onChange: (v: string | string[]) => void; multi?: boolean; color?: string
}) {
  const sel = (o: string) => Array.isArray(value) ? value.includes(o) : value === o
  const toggle = (o: string) => {
    if (multi && Array.isArray(value)) onChange(sel(o) ? value.filter(x => x !== o) : [...value, o])
    else onChange(sel(o) ? '' : o)
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(o => {
        const s = sel(o)
        return <button key={o} type="button" onClick={() => toggle(o)} style={{ padding: '9px 18px', borderRadius: 24, border: `1.5px solid ${s ? color : C.sable}`, backgroundColor: s ? `${color}16` : C.white, color: s ? color : C.grey, fontSize: 13, fontWeight: s ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{o}</button>
      })}
    </div>
  )
}

function TInput({ value, onChange, placeholder, type = 'text', style: sx }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; style?: React.CSSProperties
}) {
  return <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ width: '100%', padding: '12px 16px', fontSize: 14, borderRadius: 12, border: `1.5px solid ${value ? C.sable : C.lightGrey}`, backgroundColor: C.white, color: C.dark, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s', ...sx }} />
}

function TagInput({ tags, onAdd, onRemove, placeholder, max, inputVal, onInputChange, color = C.terracotta }: {
  tags: string[]; onAdd: () => void; onRemove: (t: string) => void
  placeholder: string; max: number; inputVal: string; onInputChange: (v: string) => void; color?: string
}) {
  return (
    <div>
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
          {tags.map(t => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color, backgroundColor: `${color}12`, border: `1px solid ${color}30`, padding: '4px 10px 4px 12px', borderRadius: 20 }}>
              {t}
              <button type="button" onClick={() => onRemove(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color, fontSize: 16, lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center' }}>×</button>
            </span>
          ))}
        </div>
      )}
      {tags.length < max && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={inputVal} onChange={e => onInputChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); onAdd() } }}
            placeholder={placeholder}
            style={{ flex: 1, padding: '10px 14px', fontSize: 13, borderRadius: 12, border: `1.5px solid ${C.sable}`, backgroundColor: C.white, color: C.dark, outline: 'none', fontFamily: 'inherit' }} />
          <button type="button" onClick={onAdd} style={{ padding: '0 16px', borderRadius: 12, border: 'none', backgroundColor: C.creme, color: C.dark, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Ajouter</button>
        </div>
      )}
      <div style={{ fontSize: 11, color: C.grey, marginTop: 5 }}>{tags.length}/{max} compétences</div>
    </div>
  )
}

function DynList({ items, onChange, placeholder, addLabel = 'Ajouter une étape' }: {
  items: string[]; onChange: (v: string[]) => void; placeholder: string; addLabel?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: it.trim() ? `${C.terracotta}18` : C.creme, border: `1.5px solid ${it.trim() ? C.terracotta : C.sable}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: it.trim() ? C.terracotta : C.lightGrey, flexShrink: 0, transition: 'all 0.15s' }}>{i + 1}</div>
          <input value={it} onChange={e => onChange(items.map((x, j) => j === i ? e.target.value : x))} placeholder={placeholder} style={{ flex: 1, padding: '10px 14px', fontSize: 13, borderRadius: 10, border: `1.5px solid ${it ? C.sable : C.lightGrey}`, backgroundColor: C.white, color: C.dark, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }} />
          {items.length > 1 && <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', backgroundColor: '#FEF2F2', color: C.error, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ''])} style={{ alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 10, border: `1.5px dashed ${C.sable}`, backgroundColor: 'transparent', color: C.grey, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>+ {addLabel}</button>
    </div>
  )
}

// ─── Progress stepper ─────────────────────────────────────────────────────────

function Stepper({ step }: { step: number }) {
  return (
    <div style={{ backgroundColor: C.white, borderBottom: `1px solid ${C.sable}`, padding: '18px 0', position: 'sticky', top: 56, zIndex: 15 }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'flex-start' }}>
        {STEP_LABELS.map((label, i) => {
          const n = i + 1; const done = step > n; const active = step === n
          const color = done ? C.vert : active ? C.terracotta : C.lightGrey
          return (
            <React.Fragment key={n}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, flexShrink: 0, minWidth: 80 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: done ? C.vert : active ? C.terracotta : C.white, border: `2.5px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s', boxShadow: active ? `0 0 0 4px ${C.terracotta}20` : 'none' }}>
                  {done ? <svg width="13" height="10" viewBox="0 0 13 10" fill="none"><polyline points="1.5,5 5,8.5 11.5,1" stroke={C.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    : <span style={{ fontSize: 12, fontWeight: 700, color: active ? C.white : C.lightGrey }}>{n}</span>}
                </div>
                <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? C.terracotta : done ? C.vert : C.grey, textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
              </div>
              {i < STEP_LABELS.length - 1 && <div style={{ flex: 1, height: 2.5, backgroundColor: step > n ? C.vert : C.sable, marginTop: 16, transition: 'background-color 0.3s' }} />}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

// ─── F2 — Toast ───────────────────────────────────────────────────────────────

function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 500, backgroundColor: C.dark, color: C.white, padding: '12px 22px', borderRadius: 12, fontSize: 13, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.18)', whiteSpace: 'nowrap', animation: 'kavio-fadein 0.2s ease' }}>
      {msg}
    </div>
  )
}

// ─── F1 — Preview modal ───────────────────────────────────────────────────────

function PreviewModal({ d, onClose }: { d: PreviewData; onClose: () => void }) {
  const hasSalaire   = d.salaireMin || d.salaireMax
  const modeColor    = d.modeTravail === '100% remote' ? C.vert : d.modeTravail === 'Hybride' ? '#7B5EA7' : C.grey
  const validMissions = d.missions.filter(m => m.trim())
  const validProcess  = d.processRecrutement.filter(p => p.trim())

  const ST = { fontSize: 11, fontWeight: 700, color: C.grey, textTransform: 'uppercase' as const, letterSpacing: '0.09em', marginBottom: 10 }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(26,26,26,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px 60px' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ backgroundColor: C.white, borderRadius: 20, width: '100%', maxWidth: 780, boxShadow: '0 8px 48px rgba(0,0,0,0.20)', overflow: 'hidden', animation: 'kavio-modal 0.2s ease' }}>

        {/* Modal top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: `1px solid ${C.sable}`, backgroundColor: C.creme }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>👁</span>
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: C.dark }}>Aperçu candidat</span>
            <span style={{ padding: '2px 10px', borderRadius: 20, backgroundColor: `${C.grey}18`, fontSize: 11, color: C.grey, fontWeight: 600 }}>Vue simulée</span>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.sable}`, backgroundColor: C.white, color: C.grey, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Offer header */}
        <div style={{ padding: '28px 32px', borderBottom: `1px solid ${C.sable}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 14 }}>
            <div>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: C.dark, margin: '0 0 6px', fontWeight: 700 }}>
                {d.titre || <span style={{ color: C.lightGrey }}>Titre du poste</span>}
              </h2>
              <div style={{ fontSize: 14, color: C.grey }}>
                {[d.ville, d.pays !== 'France' ? d.pays : ''].filter(Boolean).join(', ')}
                {d.modeTravail && <span style={{ color: modeColor, fontWeight: 500 }}> · {d.modeTravail}{d.modeTravail === 'Hybride' && d.joursRemote ? ` (${d.joursRemote}j/sem)` : ''}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
              {d.contrat  && <span style={{ padding: '5px 14px', borderRadius: 20, backgroundColor: `${C.terracotta}15`, color: C.terracotta, fontSize: 13, fontWeight: 600 }}>{d.contrat}</span>}
              {d.domaine  && <span style={{ padding: '5px 14px', borderRadius: 20, backgroundColor: `${C.vert}12`, color: C.vert, fontSize: 13, fontWeight: 600 }}>{d.domaine}</span>}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {hasSalaire && (
              <div style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>
                💰 {d.salaireMin && d.salaireMax
                  ? `${Number(d.salaireMin).toLocaleString('fr-FR')} – ${Number(d.salaireMax).toLocaleString('fr-FR')} €`
                  : `${Number(d.salaireMin || d.salaireMax).toLocaleString('fr-FR')} €`}
                <span style={{ color: C.grey, fontWeight: 400 }}> / {d.periode}</span>
              </div>
            )}
            {d.niveau && <div style={{ fontSize: 13, color: C.grey }}>⌛ {d.niveau}</div>}
            {d.debutImmediat
              ? <div style={{ fontSize: 13, color: C.grey }}>📅 Dès maintenant</div>
              : d.dateDebut ? <div style={{ fontSize: 13, color: C.grey }}>📅 {d.dateDebut}</div> : null}
          </div>

          {d.valeurs.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
              {d.valeurs.map(v => <span key={v} style={{ padding: '3px 12px', borderRadius: 20, backgroundColor: `${C.vert}10`, border: `1px solid ${C.vert}25`, fontSize: 12, color: C.vert, fontWeight: 600 }}>{v}</span>)}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {d.description && (
            <div>
              <div style={ST}>Description</div>
              <p style={{ fontSize: 14, color: C.dark, lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap' }}>{d.description}</p>
            </div>
          )}

          {validMissions.length > 0 && (
            <div style={{ backgroundColor: C.creme, borderRadius: 14, padding: '18px 22px' }}>
              <div style={ST}>Missions principales</div>
              <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {validMissions.map((m, i) => <li key={i} style={{ fontSize: 14, color: C.dark, lineHeight: 1.5 }}>{m}</li>)}
              </ul>
            </div>
          )}

          {d.profilRecherche && (
            <div>
              <div style={ST}>Profil recherché</div>
              <p style={{ fontSize: 14, color: C.dark, lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap' }}>{d.profilRecherche}</p>
            </div>
          )}

          {(d.competences.length > 0 || d.competencesBonus.length > 0) && (
            <div>
              <div style={ST}>Compétences</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {d.competences.map(c => <span key={c} style={{ padding: '5px 14px', borderRadius: 12, backgroundColor: C.creme, border: `1.5px solid ${C.sable}`, fontSize: 13, color: C.dark, fontWeight: 500 }}>{c}</span>)}
                {d.competencesBonus.map(c => <span key={c} style={{ padding: '5px 14px', borderRadius: 12, backgroundColor: C.white, border: `1.5px dashed ${C.sable}`, fontSize: 13, color: C.grey }}>{c} <span style={{ fontSize: 10 }}>BONUS</span></span>)}
              </div>
            </div>
          )}

          {d.avantages.length > 0 && (
            <div>
              <div style={ST}>Avantages</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {d.avantages.map(a => (
                  <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 10, backgroundColor: `${C.vert}0D`, border: `1px solid ${C.vert}20` }}>
                    <span style={{ fontSize: 15 }}>{AVANTAGE_ICONS[a] ?? '✓'}</span>
                    <span style={{ fontSize: 13, color: C.dark, fontWeight: 500 }}>{a}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {validProcess.length > 0 && (
            <div>
              <div style={ST}>Process de recrutement</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                {validProcess.map((p, i) => (
                  <React.Fragment key={i}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 10, border: `1.5px solid ${C.sable}`, backgroundColor: C.white }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: C.terracotta, color: C.white, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                      <span style={{ fontSize: 13, color: C.dark }}>{p}</span>
                    </div>
                    {i < validProcess.length - 1 && <span style={{ color: C.lightGrey, fontSize: 14, fontWeight: 300 }}>→</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CTA */}
        <div style={{ padding: '20px 32px', borderTop: `1px solid ${C.sable}`, backgroundColor: C.creme, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <button disabled style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', backgroundColor: `${C.terracotta}50`, color: C.white, fontSize: 14, fontWeight: 700, cursor: 'not-allowed', fontFamily: 'inherit' }}>
              Postuler en 1 clic
            </button>
            <div style={{ position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)', backgroundColor: C.dark, color: C.white, fontSize: 11, padding: '4px 10px', borderRadius: 8, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
              Aperçu uniquement
            </div>
          </div>
          <button onClick={onClose} style={{ padding: '14px 22px', borderRadius: 12, border: `1.5px solid ${C.sable}`, backgroundColor: C.white, color: C.dark, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Fermer</button>
        </div>
      </div>
    </div>
  )
}

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen({ titre, isDraft, isEdit, router, onReset }: { titre: string; isDraft: boolean; isEdit: boolean; router: ReturnType<typeof useRouter>; onReset: () => void }) {
  return (
    <main style={{ minHeight: '100vh', backgroundColor: C.creme, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ backgroundColor: C.white, borderRadius: 24, padding: '52px 44px', maxWidth: 460, width: '100%', textAlign: 'center', boxShadow: '0 4px 32px rgba(26,26,26,0.08)' }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', backgroundColor: isDraft ? `${C.vert}14` : `${C.terracotta}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          {isDraft
            ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
            : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.terracotta} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          }
        </div>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: C.dark, margin: '0 0 10px' }}>
          {isDraft ? 'Brouillon sauvegardé !' : isEdit ? 'Offre mise à jour !' : 'Offre publiée !'}
        </h2>
        <p style={{ fontSize: 14, color: C.grey, margin: '0 0 8px', lineHeight: 1.65 }}>
          {isDraft
            ? <>Votre offre <strong style={{ color: C.dark }}>{titre || 'sans titre'}</strong> a été sauvegardée. Vous pourrez la publier depuis vos offres.</>
            : isEdit
              ? <>Les modifications de <strong style={{ color: C.dark }}>{titre}</strong> sont enregistrées et visibles par les candidats.</>
              : <><strong style={{ color: C.dark }}>{titre}</strong> est maintenant visible par les candidats Kavio.</>
          }
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 28 }}>
          <button onClick={() => router.push('/recruteur/offres')} style={{ padding: '13px', borderRadius: 12, border: 'none', backgroundColor: C.terracotta, color: C.white, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Voir mes offres
          </button>
          {!isEdit && (
            <button onClick={onReset} style={{ padding: '12px', borderRadius: 12, border: `1px solid ${C.sable}`, backgroundColor: 'transparent', color: C.grey, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              Publier une autre offre
            </button>
          )}
        </div>
      </div>
    </main>
  )
}

// ─── Compact preview (step 4 summary) ────────────────────────────────────────

function OffrePreviewCard({ d }: { d: PreviewData }) {
  const hasSalaire = d.salaireMin || d.salaireMax
  const modeColor  = d.modeTravail === '100% remote' ? C.vert : d.modeTravail === 'Hybride' ? '#7B5EA7' : C.grey
  return (
    <div style={{ backgroundColor: C.white, borderRadius: 16, border: `1.5px solid ${C.sable}`, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.sable}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: C.dark, marginBottom: 3 }}>{d.titre || <span style={{ color: C.lightGrey }}>Titre du poste</span>}</div>
            <div style={{ fontSize: 12, color: C.grey }}>{[d.ville, d.pays].filter(Boolean).join(', ')}{d.modeTravail && <span style={{ color: modeColor, fontWeight: 500 }}> · {d.modeTravail}</span>}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
            {d.contrat && <span style={{ padding: '3px 10px', borderRadius: 20, backgroundColor: `${C.terracotta}15`, color: C.terracotta, fontSize: 11, fontWeight: 600 }}>{d.contrat}</span>}
            {d.domaine && <span style={{ padding: '3px 10px', borderRadius: 20, backgroundColor: `${C.vert}12`, color: C.vert, fontSize: 11, fontWeight: 600 }}>{d.domaine}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {hasSalaire && <div style={{ fontSize: 12, fontWeight: 600, color: C.dark }}>💰 {d.salaireMin && d.salaireMax ? `${Number(d.salaireMin).toLocaleString('fr-FR')} – ${Number(d.salaireMax).toLocaleString('fr-FR')} €` : `${Number(d.salaireMin || d.salaireMax).toLocaleString('fr-FR')} €`} <span style={{ color: C.grey, fontWeight: 400 }}>/ {d.periode}</span></div>}
          {d.niveau && <div style={{ fontSize: 12, color: C.grey }}>⌛ {d.niveau}</div>}
          {d.debutImmediat ? <div style={{ fontSize: 12, color: C.grey }}>📅 Dès maintenant</div> : d.dateDebut ? <div style={{ fontSize: 12, color: C.grey }}>📅 {d.dateDebut}</div> : null}
        </div>
      </div>
      <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {d.description && <p style={{ fontSize: 13, color: C.grey, lineHeight: 1.6, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{d.description}</p>}
        {d.competences.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {d.competences.slice(0, 6).map(c => <span key={c} style={{ padding: '2px 9px', borderRadius: 8, backgroundColor: C.creme, border: `1px solid ${C.sable}`, fontSize: 11, color: C.dark }}>{c}</span>)}
            {d.competences.length > 6 && <span style={{ padding: '2px 9px', borderRadius: 8, backgroundColor: C.creme, border: `1px solid ${C.sable}`, fontSize: 11, color: C.grey }}>+{d.competences.length - 6}</span>}
          </div>
        )}
        {d.avantages.length > 0 && <div style={{ fontSize: 11, color: C.grey }}>{d.avantages.slice(0, 5).map(a => `${AVANTAGE_ICONS[a] ?? '✓'} ${a}`).join(' · ')}{d.avantages.length > 5 ? ` · +${d.avantages.length - 5}` : ''}</div>}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function PublierOffrePageInner() {
  const router        = useRouter()
  const searchParams  = useSearchParams()
  const editId        = searchParams.get('id')

  // Navigation
  const [step, setStep]             = useState(1)
  const [errors, setErrors]         = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [published, setPublished]   = useState(false)
  const [isDraft, setIsDraft]       = useState(false)
  const [serverError, setServerError] = useState('')
  // F1 — Modal
  const [previewOpen, setPreviewOpen] = useState(false)
  // F2 — Toast
  const [toastMsg, setToastMsg]     = useState('')

  // Step 1
  const [titre, setTitre]           = useState('')
  const [contrat, setContrat]       = useState('')
  const [domaine, setDomaine]       = useState('')
  const [niveau, setNiveau]         = useState('')
  const [salaireMin, setSalaireMin] = useState('')
  const [salaireMax, setSalaireMax] = useState('')
  const [periode, setPeriode]       = useState('annuel')
  const [debutImmediat, setDebutImmediat] = useState(true)
  const [dateDebut, setDateDebut]   = useState('')

  // Step 2
  const [ville, setVille]           = useState('')
  const [pays, setPays]             = useState('France')
  const [modeTravail, setModeTravail] = useState('')
  const [joursRemote, setJoursRemote] = useState(2)
  const [deplacements, setDeplacements] = useState('')

  // Step 3
  const [description, setDescription] = useState('')
  const [missions, setMissions]       = useState<string[]>([''])
  const [profilRecherche, setProfilRecherche] = useState('')
  const [competences, setCompetences] = useState<string[]>([])
  const [compInput, setCompInput]     = useState('')
  const [competencesBonus, setCompetencesBonus] = useState<string[]>([])
  const [compBonusInput, setCompBonusInput] = useState('')
  const [valeurs, setValeurs]         = useState<string[]>([])

  // Step 4
  const [avantages, setAvantages]   = useState<string[]>([])
  const [processRecrutement, setProcessRecrutement] = useState<string[]>(['Entretien RH'])

  // F2 — Ref for auto-save (avoids stale closures)
  const formRef = useRef({ titre, contrat, domaine, niveau, salaireMin, salaireMax, periode, debutImmediat, dateDebut, ville, pays, modeTravail, joursRemote, deplacements, description, missions, profilRecherche, competences, competencesBonus, valeurs, avantages, processRecrutement })
  formRef.current = { titre, contrat, domaine, niveau, salaireMin, salaireMax, periode, debutImmediat, dateDebut, ville, pays, modeTravail, joursRemote, deplacements, description, missions, profilRecherche, competences, competencesBonus, valeurs, avantages, processRecrutement }

  // ── Toast helper ──────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3000)
  }

  // ── Load existing offer when editing ─────────────────────────────────────

  useEffect(() => {
    if (!editId) return
    async function load() {
      const { data } = await supabase.from('offres').select('*').eq('id', editId).single()
      if (!data) return
      setTitre(data.titre ?? '')
      setContrat(data.type_contrat ?? '')
      setDomaine(data.domaine ?? '')
      setNiveau(data.experience ?? '')
      setSalaireMin(data.salaire_min != null ? String(data.salaire_min) : '')
      setSalaireMax(data.salaire_max != null ? String(data.salaire_max) : '')
      setPeriode(data.periode_salaire ?? 'annuel')
      if (data.date_debut === 'immediat') {
        setDebutImmediat(true)
      } else {
        setDebutImmediat(false)
        setDateDebut(data.date_debut ?? '')
      }
      setVille(data.ville ?? '')
      setPays(data.pays ?? 'France')
      setModeTravail(data.mode_travail ?? '')
      setJoursRemote(data.jours_remote ?? 2)
      setDeplacements(data.deplacements ?? '')
      setDescription(data.description ?? '')
      setMissions(data.missions?.length ? data.missions : [''])
      setProfilRecherche(data.profil_recherche ?? '')
      setCompetences(data.competences ?? [])
      setCompetencesBonus(data.competences_bonus ?? [])
      setValeurs(data.valeurs ?? [])
      setAvantages(data.avantages ?? [])
      setProcessRecrutement(data.process_recrutement?.length ? data.process_recrutement : ['Entretien RH'])
    }
    load()
  }, [editId])

  // ── F2 — Auto-save every 60s ──────────────────────────────────────────────

  useEffect(() => {
    const id = setInterval(async () => {
      const f = formRef.current
      if (!f.titre.trim() || editId) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('offres').insert({
        recruteur_id: user.id, titre: f.titre, type_contrat: f.contrat,
        domaine: f.domaine, experience: f.niveau,
        salaire_min: f.salaireMin ? parseInt(f.salaireMin) : null,
        salaire_max: f.salaireMax ? parseInt(f.salaireMax) : null,
        periode_salaire: f.periode,
        date_debut: f.debutImmediat ? 'immediat' : f.dateDebut,
        ville: f.ville, pays: f.pays, mode_travail: f.modeTravail,
        jours_remote: f.modeTravail === 'Hybride' ? f.joursRemote : null,
        deplacements: f.deplacements, description: f.description,
        missions: f.missions.filter(m => m.trim()),
        profil_recherche: f.profilRecherche,
        competences: f.competences, competences_bonus: f.competencesBonus,
        valeurs: f.valeurs, avantages: f.avantages,
        process_recrutement: f.processRecrutement.filter(p => p.trim()),
        statut: 'brouillon',
      })
      showToast('Brouillon sauvegardé automatiquement ✓')
    }, 60000)
    return () => clearInterval(id)
  }, [])

  // ── Validation ────────────────────────────────────────────────────────────

  function validate1() {
    const e: Record<string, string> = {}
    if (!titre.trim())  e.titre   = 'Le titre du poste est obligatoire.'
    if (!contrat)       e.contrat = 'Sélectionnez un type de contrat.'
    if (!domaine)       e.domaine = 'Sélectionnez un domaine.'
    if (salaireMin && salaireMax && Number(salaireMin) > Number(salaireMax)) e.salaire = 'Le minimum doit être inférieur au maximum.'
    if (!debutImmediat && !dateDebut) e.dateDebut = 'Indiquez une date de début.'
    setErrors(e); return Object.keys(e).length === 0
  }
  function validate2() {
    const e: Record<string, string> = {}
    if (!ville.trim()) e.ville       = 'La ville est obligatoire.'
    if (!modeTravail)  e.modeTravail = 'Sélectionnez un mode de travail.'
    setErrors(e); return Object.keys(e).length === 0
  }
  function validate3() {
    const e: Record<string, string> = {}
    if (description.trim().length < DESC_MIN) e.description = `Min. ${DESC_MIN} caractères (${description.trim().length} actuellement).`
    if (description.trim().length > DESC_MAX) e.description = `Max. ${DESC_MAX} caractères.`
    if (competences.length === 0) e.competences = 'Ajoutez au moins une compétence requise.'
    setErrors(e); return Object.keys(e).length === 0
  }

  function nextStep() {
    const ok = step === 1 ? validate1() : step === 2 ? validate2() : step === 3 ? validate3() : true
    if (!ok) return
    setErrors({}); setStep(s => Math.min(s + 1, 4)); window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function prevStep() { setErrors({}); setStep(s => Math.max(s - 1, 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function save(statut: 'publiée' | 'brouillon', opts: { silent?: boolean } = {}) {
    if (opts.silent) setSavingDraft(true); else setSubmitting(true)
    setServerError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/connexion'); return }

    const fields = {
      titre, type_contrat: contrat,
      domaine, experience: niveau,
      salaire_min: salaireMin ? parseInt(salaireMin) : null,
      salaire_max: salaireMax ? parseInt(salaireMax) : null,
      periode_salaire: periode,
      date_debut: debutImmediat ? 'immediat' : dateDebut,
      ville, pays, mode_travail: modeTravail,
      jours_remote: modeTravail === 'Hybride' ? joursRemote : null,
      deplacements, description,
      missions: missions.filter(m => m.trim()),
      profil_recherche: profilRecherche,
      competences, competences_bonus: competencesBonus,
      valeurs, avantages,
      process_recrutement: processRecrutement.filter(p => p.trim()),
      statut,
    }

    const { error } = editId
      ? await supabase.from('offres').update(fields).eq('id', editId).select()
      : await supabase.from('offres').insert({ ...fields, recruteur_id: user.id }).select()

    if (opts.silent) setSavingDraft(false); else setSubmitting(false)
    if (error) {
      if (opts.silent) { showToast('⚠ Erreur lors de la sauvegarde'); return }
      setServerError(`Erreur : ${error.message}`); return
    }
    if (opts.silent) { showToast('Brouillon sauvegardé ✓'); return }
    setIsDraft(statut === 'brouillon'); setPublished(true)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function addComp()      { const v = compInput.trim(); if (v && !competences.includes(v) && competences.length < 10) setCompetences(p => [...p, v]); setCompInput('') }
  function addCompBonus() { const v = compBonusInput.trim(); if (v && !competencesBonus.includes(v) && competencesBonus.length < 5) setCompetencesBonus(p => [...p, v]); setCompBonusInput('') }
  function addSuggestion(s: string) { if (!competences.includes(s) && competences.length < 10) setCompetences(p => [...p, s]) }
  function toggleAvantage(a: string) { setAvantages(p => p.includes(a) ? p.filter(x => x !== a) : [...p, a]) }

  function resetForm() {
    setTitre(''); setContrat(''); setDomaine(''); setNiveau(''); setSalaireMin(''); setSalaireMax(''); setPeriode('annuel'); setDebutImmediat(true); setDateDebut('')
    setVille(''); setPays('France'); setModeTravail(''); setJoursRemote(2); setDeplacements('')
    setDescription(''); setMissions(['']); setProfilRecherche(''); setCompetences([]); setCompInput(''); setCompetencesBonus([]); setCompBonusInput(''); setValeurs([])
    setAvantages([]); setProcessRecrutement(['Entretien RH'])
    setStep(1); setErrors({}); setServerError(''); setPublished(false); setIsDraft(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const previewData: PreviewData = { titre, contrat, domaine, niveau, salaireMin, salaireMax, periode, ville, pays, modeTravail, joursRemote, dateDebut, debutImmediat, description, missions, profilRecherche, competences, competencesBonus, valeurs, avantages, processRecrutement }
  const descLen    = description.trim().length
  const descColor  = descLen > DESC_MAX ? C.error : descLen >= DESC_MIN ? C.vert : C.grey
  const suggestions = (COMP_SUGGESTIONS[domaine] ?? []).filter(s => !competences.includes(s))
  const hasData    = titre.trim().length > 0

  // ── Render ────────────────────────────────────────────────────────────────

  if (published) return <SuccessScreen titre={titre} isDraft={isDraft} isEdit={!!editId} router={router} onReset={resetForm} />

  return (
    <main style={{ backgroundColor: C.creme, minHeight: '100vh' }}>
      <style suppressHydrationWarning>{`
        @keyframes kavio-spin    { to { transform: rotate(360deg); } }
        @keyframes kavio-fadein  { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes kavio-modal   { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        input[type=range] { accent-color: ${C.terracotta}; }
      `}</style>

      <Toast msg={toastMsg} />
      {previewOpen && <PreviewModal d={previewData} onClose={() => setPreviewOpen(false)} />}

      {/* ── TOP BAR ───────────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: C.white, borderBottom: `1px solid ${C.sable}`, padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: C.dark, letterSpacing: '-0.01em' }}>Kavio</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {hasData && (
            <button onClick={() => save('brouillon', { silent: true })} disabled={savingDraft}
              style={{ padding: '7px 14px', borderRadius: 10, border: `1.5px solid ${C.vert}`, backgroundColor: 'transparent', color: C.vert, fontSize: 12, fontWeight: 600, cursor: savingDraft ? 'default' : 'pointer', fontFamily: 'inherit', opacity: savingDraft ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              {savingDraft ? <><div style={{ width: 11, height: 11, borderRadius: '50%', border: `1.5px solid ${C.vert}50`, borderTopColor: C.vert, animation: 'kavio-spin 0.7s linear infinite' }} /> Sauvegarde…</> : '💾 Brouillon'}
            </button>
          )}
          <button onClick={() => router.push('/recruteur/offres')}
            style={{ padding: '7px 16px', borderRadius: 10, border: `1px solid ${C.sable}`, backgroundColor: 'transparent', color: C.grey, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            ← Mes offres
          </button>
        </div>
      </div>

      {/* ── STEPPER ───────────────────────────────────────────────────────── */}
      <Stepper step={step} />

      {/* ── CONTENT ───────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 32px 100px' }}>

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.terracotta, textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 6 }}>{editId ? 'Modifier l\'offre' : `Étape ${step} / ${STEP_LABELS.length}`}</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(22px, 3.5vw, 30px)', color: C.dark, margin: 0, lineHeight: 1.2 }}>
            {['Informations générales', 'Localisation & mode de travail', 'Description du poste', 'Avantages & publication'][step - 1]}
          </h1>
          <p style={{ fontSize: 14, color: C.grey, margin: '6px 0 0', lineHeight: 1.5 }}>
            {['Les informations essentielles qui apparaîtront sur votre annonce.', "Où se déroule le poste et comment est organisé le travail.", 'Décrivez le poste en détail pour attirer les bons candidats.', 'Finalisez votre annonce et choisissez comment la publier.'][step - 1]}
          </p>
        </div>

        {/* ── STEP 1 ──────────────────────────────────────────────────────── */}
        {step === 1 && (
          <Card>
            <div>
              <SLabel sub="Ce titre sera la première chose que les candidats verront.">Titre du poste *</SLabel>
              <TInput value={titre} onChange={setTitre} placeholder="ex. Lead Product Designer, Développeur React Senior…" style={{ fontSize: 15 }} />
              <FieldErr msg={errors.titre} />
            </div>
            <Divider />
            <div>
              <SLabel>Type de contrat *</SLabel>
              <Pills options={CONTRATS} value={contrat} onChange={v => setContrat(v as string)} />
              <FieldErr msg={errors.contrat} />
            </div>
            <Divider />
            <div>
              <SLabel>Domaine *</SLabel>
              <Pills options={DOMAINES} value={domaine} onChange={v => setDomaine(v as string)} color={C.vert} />
              <FieldErr msg={errors.domaine} />
            </div>
            <Divider />
            <div>
              <SLabel sub="Entre en compte dans le score de compatibilité Kavio.">Niveau d'expérience requis</SLabel>
              <Pills options={NIVEAUX} value={niveau} onChange={v => setNiveau(v as string)} />
            </div>
            <Divider />
            <div>
              <SLabel sub="Indiquer une fourchette augmente le taux de candidature de 30 %.">Fourchette de salaire</SLabel>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <input type="number" value={salaireMin} onChange={e => setSalaireMin(e.target.value)} placeholder="Minimum" min={0} style={{ width: '100%', padding: '12px 14px', fontSize: 14, borderRadius: 12, border: `1.5px solid ${salaireMin ? C.sable : C.lightGrey}`, backgroundColor: C.white, color: C.dark, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                </div>
                <div style={{ color: C.grey, fontWeight: 600, flexShrink: 0 }}>—</div>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <input type="number" value={salaireMax} onChange={e => setSalaireMax(e.target.value)} placeholder="Maximum" min={0} style={{ width: '100%', padding: '12px 14px', fontSize: 14, borderRadius: 12, border: `1.5px solid ${salaireMax ? C.sable : C.lightGrey}`, backgroundColor: C.white, color: C.dark, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                </div>
                <div style={{ flexShrink: 0, fontSize: 14, fontWeight: 700, color: C.dark }}>€</div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                {['annuel', 'mensuel'].map(p => { const a = periode === p; return <button key={p} type="button" onClick={() => setPeriode(p)} style={{ padding: '6px 16px', borderRadius: 20, border: `1.5px solid ${a ? C.terracotta : C.sable}`, backgroundColor: a ? `${C.terracotta}16` : C.white, color: a ? C.terracotta : C.grey, fontSize: 12, fontWeight: a ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>{p === 'annuel' ? 'Par an' : 'Par mois'}</button> })}
              </div>
              <FieldErr msg={errors.salaire} />
            </div>
            <Divider />
            <div>
              <SLabel>Date de début</SLabel>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {[true, false].map(imm => { const a = debutImmediat === imm; return <button key={String(imm)} type="button" onClick={() => setDebutImmediat(imm)} style={{ padding: '9px 18px', borderRadius: 24, border: `1.5px solid ${a ? C.terracotta : C.sable}`, backgroundColor: a ? `${C.terracotta}16` : C.white, color: a ? C.terracotta : C.grey, fontSize: 13, fontWeight: a ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>{imm ? '⚡ Immédiat' : '📅 Date précise'}</button> })}
              </div>
              {!debutImmediat && <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} style={{ padding: '11px 14px', fontSize: 14, borderRadius: 12, border: `1.5px solid ${dateDebut ? C.sable : C.lightGrey}`, backgroundColor: C.white, color: C.dark, outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }} />}
              <FieldErr msg={errors.dateDebut} />
            </div>
          </Card>
        )}

        {/* ── STEP 2 ──────────────────────────────────────────────────────── */}
        {step === 2 && (
          <Card>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
              <div>
                <SLabel>Ville *</SLabel>
                <TInput value={ville} onChange={setVille} placeholder="ex. Paris, Lyon, Bordeaux…" />
                <FieldErr msg={errors.ville} />
              </div>
              <div>
                <SLabel>Pays</SLabel>
                <select value={pays} onChange={e => setPays(e.target.value)} style={{ padding: '12px 14px', fontSize: 14, borderRadius: 12, border: `1.5px solid ${C.sable}`, backgroundColor: C.white, color: C.dark, outline: 'none', cursor: 'pointer', fontFamily: 'inherit', minWidth: 130 }}>
                  {PAYS_OPTS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <Divider />
            <div>
              <SLabel sub="L'un des critères les plus consultés par les candidats.">Mode de travail *</SLabel>
              <Pills options={MODES} value={modeTravail} onChange={v => setModeTravail(v as string)} />
              <FieldErr msg={errors.modeTravail} />
              {modeTravail === 'Hybride' && (
                <div style={{ marginTop: 20, backgroundColor: C.creme, borderRadius: 12, padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.dark }}>Jours de télétravail par semaine</span>
                    <span style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: C.terracotta }}>{joursRemote}</span>
                  </div>
                  <input type="range" min={1} max={4} step={1} value={joursRemote} onChange={e => setJoursRemote(Number(e.target.value))} style={{ width: '100%', cursor: 'pointer' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    {['1j', '2j', '3j', '4j'].map(d => <span key={d} style={{ fontSize: 11, color: C.grey }}>{d}</span>)}
                  </div>
                </div>
              )}
            </div>
            <Divider />
            <div>
              <SLabel sub="Des déplacements sont-ils requis dans le cadre du poste ?">Déplacements requis</SLabel>
              <Pills options={DEPLACS} value={deplacements} onChange={v => setDeplacements(v as string)} color={C.vert} />
            </div>
          </Card>
        )}

        {/* ── STEP 3 ──────────────────────────────────────────────────────── */}
        {step === 3 && (
          <Card>
            <div>
              <SLabel sub={`Min. ${DESC_MIN} caractères — Max. ${DESC_MAX}. Contexte, équipe, défis du poste.`}>Description complète *</SLabel>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Nous recherchons un(e)… Le poste s'inscrit dans… Vous rejoindrez une équipe de…" rows={8}
                style={{ width: '100%', padding: '14px 16px', fontSize: 14, borderRadius: 12, border: `1.5px solid ${descLen >= DESC_MIN && descLen <= DESC_MAX ? C.sable : C.lightGrey}`, backgroundColor: C.white, color: C.dark, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.65 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, alignItems: 'center' }}>
                <FieldErr msg={errors.description} />
                <span style={{ fontSize: 11, color: descColor, marginLeft: 'auto', fontWeight: descLen >= DESC_MIN ? 600 : 400 }}>{descLen} / {DESC_MAX}</span>
              </div>
            </div>
            <Divider />
            <div>
              <SLabel sub="Listez les missions principales — les candidats y prêtent beaucoup d'attention.">Missions principales</SLabel>
              <DynList items={missions} onChange={setMissions} placeholder="ex. Animer les comités produit hebdomadaires…" addLabel="Ajouter une mission" />
            </div>
            <Divider />
            <div>
              <SLabel sub="Personnalité, approche, background attendus.">Profil recherché</SLabel>
              <textarea value={profilRecherche} onChange={e => setProfilRecherche(e.target.value)} placeholder="Vous êtes passionné(e) par… Vous avez une approche…" rows={4}
                style={{ width: '100%', padding: '13px 16px', fontSize: 14, borderRadius: 12, border: `1.5px solid ${profilRecherche ? C.sable : C.lightGrey}`, backgroundColor: C.white, color: C.dark, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.65 }} />
            </div>
            <Divider />
            {/* F3 — Compétences avec suggestions */}
            <div>
              <SLabel sub="Alimentent le moteur de matching Kavio. Max. 10.">Compétences requises *</SLabel>
              <TagInput tags={competences} onAdd={addComp} onRemove={t => setCompetences(p => p.filter(x => x !== t))} placeholder="ex. React, Figma, SQL… (Entrée pour valider)" max={10} inputVal={compInput} onInputChange={setCompInput} />
              <FieldErr msg={errors.competences} />
              {/* F3 — Suggestions par domaine */}
              {suggestions.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.grey, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Suggestions pour «&nbsp;{domaine}&nbsp;»
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(COMP_SUGGESTIONS[domaine] ?? []).map(s => {
                      const added = competences.includes(s)
                      return (
                        <button key={s} type="button" onClick={() => !added && addSuggestion(s)} disabled={added || competences.length >= 10}
                          style={{ padding: '5px 13px', borderRadius: 20, border: `1px solid ${added ? C.lightGrey : C.sable}`, backgroundColor: added ? C.creme : C.white, color: added ? C.lightGrey : C.grey, fontSize: 12, cursor: added ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', textDecoration: added ? 'line-through' : 'none' }}>
                          {added ? `✓ ${s}` : `+ ${s}`}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            <Divider />
            <div>
              <SLabel sub="Compétences appréciées mais non bloquantes. Max. 5.">Compétences bonus ✦</SLabel>
              <TagInput tags={competencesBonus} onAdd={addCompBonus} onRemove={t => setCompetencesBonus(p => p.filter(x => x !== t))} placeholder="ex. Notion, Docker, SEO…" max={5} inputVal={compBonusInput} onInputChange={setCompBonusInput} color={C.vert} />
            </div>
            <Divider />
            <div>
              <SLabel sub="Apparaissent sur l'annonce, filtrent les candidats partageant la même vision.">Valeurs importantes pour ce poste</SLabel>
              <Pills options={VALEURS} value={valeurs} onChange={v => { const a = v as string[]; if (a.length <= 4) setValeurs(a) }} multi color={C.vert} />
              <div style={{ fontSize: 11, color: C.grey, marginTop: 6 }}>{valeurs.length}/4 valeurs sélectionnées</div>
            </div>
          </Card>
        )}

        {/* ── STEP 4 ──────────────────────────────────────────────────────── */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <Card>
              <div>
                <SLabel sub="Les avantages augmentent le taux de candidature. Sélectionnez tous ceux qui s'appliquent.">Avantages proposés</SLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                  {AVANTAGES.map(a => {
                    const checked = avantages.includes(a)
                    return (
                      <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${checked ? C.vert : C.sable}`, backgroundColor: checked ? `${C.vert}0D` : C.white, cursor: 'pointer', transition: 'all 0.15s' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleAvantage(a)} style={{ accentColor: C.vert, width: 15, height: 15, flexShrink: 0 }} />
                        <span style={{ fontSize: 13 }}>{AVANTAGE_ICONS[a] ?? ''}</span>
                        <span style={{ fontSize: 13, color: checked ? C.vert : C.dark, fontWeight: checked ? 600 : 400 }}>{a}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
              <Divider />
              <div>
                <SLabel sub="Les candidats apprécient la transparence sur le process.">Process de recrutement</SLabel>
                <DynList items={processRecrutement} onChange={setProcessRecrutement} placeholder="ex. Entretien RH, Test technique, Entretien CEO…" addLabel="Ajouter une étape" />
              </div>
            </Card>

            {/* F1 — Aperçu + compact preview */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: C.dark }}>Aperçu de votre annonce</div>
                <button type="button" onClick={() => setPreviewOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, border: `1.5px solid ${C.terracotta}`, backgroundColor: `${C.terracotta}0D`, color: C.terracotta, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  👁 Aperçu de l'annonce
                </button>
              </div>
              <OffrePreviewCard d={previewData} />
            </div>

            {serverError && (
              <div style={{ padding: '12px 16px', borderRadius: 10, backgroundColor: '#FEF2F2', border: `1px solid ${C.error}30`, color: C.error, fontSize: 13 }}>{serverError}</div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button type="button" onClick={() => save('publiée')} disabled={submitting}
                style={{ width: '100%', padding: 16, borderRadius: 14, border: 'none', backgroundColor: submitting ? C.sable : C.terracotta, color: C.white, fontSize: 15, fontWeight: 700, cursor: submitting ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s', fontFamily: 'inherit' }}>
                {submitting ? <><div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: C.white, animation: 'kavio-spin 0.7s linear infinite' }} /> {editId ? 'Mise à jour…' : 'Publication…'}</> : <>{editId ? 'Mettre à jour l\'offre →' : 'Publier l\'offre →'}</>}
              </button>
              <button type="button" onClick={() => save('brouillon', { silent: true })} disabled={savingDraft}
                style={{ width: '100%', padding: 14, borderRadius: 14, border: `2px solid ${C.vert}`, backgroundColor: 'transparent', color: C.vert, fontSize: 14, fontWeight: 600, cursor: savingDraft ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {savingDraft ? <><div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${C.vert}30`, borderTopColor: C.vert, animation: 'kavio-spin 0.7s linear infinite' }} /> Sauvegarde…</> : 'Sauvegarder en brouillon'}
              </button>
            </div>
          </div>
        )}

        {/* ── NAVIGATION ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 }}>
          {step > 1
            ? <button type="button" onClick={prevStep} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 22px', borderRadius: 12, border: `1.5px solid ${C.sable}`, backgroundColor: C.white, color: C.dark, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Précédent</button>
            : <div />}
          {step < 4 && (
            <button type="button" onClick={nextStep} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 24px', borderRadius: 12, border: 'none', backgroundColor: C.terracotta, color: C.white, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 2px 12px ${C.terracotta}40` }}>
              Suivant →
            </button>
          )}
        </div>

        {/* Dots */}
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <div style={{ display: 'inline-flex', gap: 6 }}>
            {STEP_LABELS.map((_, i) => { const n = i + 1; return <div key={n} style={{ width: n === step ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: n < step ? C.vert : n === step ? C.terracotta : C.sable, transition: 'all 0.3s' }} /> })}
          </div>
        </div>
      </div>
    </main>
  )
}

export default function PublierOffrePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: '#F7F2EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><style suppressHydrationWarning>{`@keyframes kavio-spin{to{transform:rotate(360deg)}}`}</style><div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #E8D5B7', borderTopColor: '#C4673A', animation: 'kavio-spin 0.8s linear infinite' }} /></div>}>
      <PublierOffrePageInner />
    </Suspense>
  )
}
