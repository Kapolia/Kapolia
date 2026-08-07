'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
  amber:      '#C88A2A',
  red:        '#C0392B',
}

const AVANTAGE_ICONS: Record<string, string> = {
  'Mutuelle': '🏥', 'RTT': '🏖️', 'Tickets restaurant': '🍽️',
  'Intéressement': '💰', 'Stock options': '📈', 'Formation': '🎓',
  'Véhicule de fonction': '🚗', 'Remboursement transport': '🚇',
  'Télétravail': '🏠', 'Salle de sport': '💪',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type OffreRow = {
  id: string
  created_at: string
  titre: string
  type_contrat: string | null
  domaine: string | null
  ville: string | null
  mode_travail: string | null
  experience: string | null
  salaire_min: number | null
  salaire_max: number | null
  periode_salaire: string | null
  statut: string | null
  description: string | null
  competences: string[] | null
  competences_bonus: string[] | null
  avantages: string[] | null
  missions: string[] | null
  profil_recherche: string | null
  process_recrutement: string[] | null
  valeurs: string[] | null
  candidatures: { count: number }[]
}

type TabFilter = 'toutes' | 'publiée' | 'brouillon' | 'archivée'
type SortKey  = 'recent' | 'ancien' | 'candidatures'
const CAND_TARGET = 10

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_BG = [C.terracotta, '#4A7C6E', '#8B6E4E', '#5C6BC0', '#2C6E49', '#7B5EA7', '#B06000']
function avatarBg(id: string) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return AVATAR_BG[h % AVATAR_BG.length]
}

function candCount(o: OffreRow) {
  return (o.candidatures as { count: number }[])[0]?.count ?? 0
}

function dateLabel(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Hier'
  if (days < 7)  return `Il y a ${days} jours`
  if (days < 30) return `Il y a ${Math.floor(days / 7)} sem.`
  return `Il y a ${Math.floor(days / 30)} mois`
}

function offreStatut(o: OffreRow): 'publiée' | 'brouillon' | 'archivée' {
  if (o.statut === 'brouillon') return 'brouillon'
  if (o.statut === 'archivée')  return 'archivée'
  return 'publiée'
}

function statutInfo(s: string) {
  if (s === 'brouillon') return { label: 'Brouillon', bg: `${C.grey}18`,   color: C.grey }
  if (s === 'archivée')  return { label: 'Archivée',  bg: `${C.amber}18`,  color: C.amber }
  return                        { label: 'Active',    bg: `${C.vert}14`,   color: C.vert }
}

function exportCSV(offres: OffreRow[]) {
  const hdr = ['Titre', 'Contrat', 'Domaine', 'Ville', 'Statut', 'Candidatures', 'Date']
  const rows = offres.map(o => [
    `"${o.titre}"`, o.type_contrat ?? '', o.domaine ?? '',
    o.ville ?? '', offreStatut(o), String(candCount(o)), o.created_at.slice(0, 10),
  ])
  const csv = [hdr, ...rows].map(r => r.join(',')).join('\n')
  const a = document.createElement('a')
  a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`
  a.download = `kavio-offres-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 36 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
      <div style={{ width: size, height: size, borderRadius: '50%', border: `3px solid ${C.sable}`, borderTopColor: C.terracotta, animation: 'kavio-spin 0.8s linear infinite' }} />
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 500, backgroundColor: C.dark, color: C.white, padding: '12px 22px', borderRadius: 12, fontSize: 13, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.18)', whiteSpace: 'nowrap', pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.white} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      {msg}
    </div>
  )
}

// ─── Confirm modal ────────────────────────────────────────────────────────────

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, backgroundColor: 'rgba(26,26,26,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onCancel}>
      <div style={{ backgroundColor: C.white, borderRadius: 18, padding: '28px 32px', maxWidth: 380, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.16)', animation: 'kavio-modal 0.18s ease' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: C.dark, marginBottom: 10 }}>Confirmer la suppression</div>
        <p style={{ fontSize: 14, color: C.grey, lineHeight: 1.65, margin: '0 0 22px' }}>{message}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1.5px solid ${C.sable}`, backgroundColor: 'transparent', color: C.grey, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', backgroundColor: C.red, color: C.white, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Supprimer</button>
        </div>
      </div>
    </div>
  )
}

// ─── Offre detail modal (Changement 1) ───────────────────────────────────────

function OffreDetailModal({ offre, onClose, onEdit }: { offre: OffreRow; onClose: () => void; onEdit: () => void }) {
  const count         = candCount(offre)
  const hasSal        = offre.salaire_min || offre.salaire_max
  const modeColor     = offre.mode_travail === '100% remote' ? C.vert : offre.mode_travail === 'Hybride' ? '#7B5EA7' : C.grey
  const validMissions = (offre.missions ?? []).filter(m => m.trim())
  const validProcess  = (offre.process_recrutement ?? []).filter(p => p.trim())
  const avantages     = offre.avantages ?? []
  const comps         = offre.competences ?? []
  const compsBonus    = offre.competences_bonus ?? []
  const valeurs       = offre.valeurs ?? []

  const ST = { fontSize: 11, fontWeight: 700 as const, color: C.grey, textTransform: 'uppercase' as const, letterSpacing: '0.09em', marginBottom: 10 }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, backgroundColor: 'rgba(26,26,26,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '28px 16px 60px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ backgroundColor: C.white, borderRadius: 20, width: '100%', maxWidth: 800, boxShadow: '0 8px 48px rgba(0,0,0,0.20)', overflow: 'hidden', animation: 'kavio-modal 0.2s ease' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: `1px solid ${C.sable}`, backgroundColor: C.creme, gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: C.dark }}>{offre.titre}</span>
            <span style={{ padding: '2px 10px', borderRadius: 20, backgroundColor: `${C.grey}14`, fontSize: 11, color: C.grey, fontWeight: 600 }}>Aperçu</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: `1.5px solid ${C.sable}`, backgroundColor: C.white, color: C.dark, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              ✏️ Modifier
            </button>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.sable}`, backgroundColor: C.white, color: C.grey, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        </div>

        {/* Offer header */}
        <div style={{ padding: '28px 32px', borderBottom: `1px solid ${C.sable}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 14 }}>
            <div>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: C.dark, margin: '0 0 6px', fontWeight: 700 }}>{offre.titre}</h2>
              <div style={{ fontSize: 14, color: C.grey }}>
                {[offre.ville].filter(Boolean).join(', ')}
                {offre.mode_travail && <span style={{ color: modeColor, fontWeight: 500 }}> · {offre.mode_travail}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
              {offre.type_contrat && <span style={{ padding: '5px 14px', borderRadius: 20, backgroundColor: `${C.terracotta}15`, color: C.terracotta, fontSize: 13, fontWeight: 600 }}>{offre.type_contrat}</span>}
              {offre.domaine && <span style={{ padding: '5px 14px', borderRadius: 20, backgroundColor: `${C.vert}12`, color: C.vert, fontSize: 13, fontWeight: 600 }}>{offre.domaine}</span>}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', marginBottom: valeurs.length > 0 ? 14 : 0 }}>
            {hasSal && (
              <div style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>
                💰 {offre.salaire_min && offre.salaire_max
                  ? `${offre.salaire_min.toLocaleString('fr-FR')} – ${offre.salaire_max.toLocaleString('fr-FR')} €`
                  : `${(offre.salaire_min ?? offre.salaire_max)!.toLocaleString('fr-FR')} €`}
                <span style={{ color: C.grey, fontWeight: 400 }}> / {offre.periode_salaire ?? 'an'}</span>
              </div>
            )}
            {offre.experience && <div style={{ fontSize: 13, color: C.grey }}>⌛ {offre.experience}</div>}
            <div style={{ fontSize: 13, color: C.grey }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.terracotta} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 4 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span style={{ color: C.terracotta, fontWeight: 600 }}>{count}</span> candidature{count !== 1 ? 's' : ''}
            </div>
          </div>

          {valeurs.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {valeurs.map(v => <span key={v} style={{ padding: '3px 12px', borderRadius: 20, backgroundColor: `${C.vert}10`, border: `1px solid ${C.vert}25`, fontSize: 12, color: C.vert, fontWeight: 600 }}>{v}</span>)}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {offre.description && (
            <div>
              <div style={ST}>Description</div>
              <p style={{ fontSize: 14, color: C.dark, lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap' }}>{offre.description}</p>
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

          {offre.profil_recherche && (
            <div>
              <div style={ST}>Profil recherché</div>
              <p style={{ fontSize: 14, color: C.dark, lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap' }}>{offre.profil_recherche}</p>
            </div>
          )}

          {(comps.length > 0 || compsBonus.length > 0) && (
            <div>
              <div style={ST}>Compétences</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {comps.map(c => <span key={c} style={{ padding: '5px 14px', borderRadius: 12, backgroundColor: C.creme, border: `1.5px solid ${C.sable}`, fontSize: 13, color: C.dark, fontWeight: 500 }}>{c}</span>)}
                {compsBonus.map(c => <span key={c} style={{ padding: '5px 14px', borderRadius: 12, backgroundColor: C.white, border: `1.5px dashed ${C.sable}`, fontSize: 13, color: C.grey }}>{c} <span style={{ fontSize: 10 }}>BONUS</span></span>)}
              </div>
            </div>
          )}

          {avantages.length > 0 && (
            <div>
              <div style={ST}>Avantages</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {avantages.map(a => (
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
                    {i < validProcess.length - 1 && <span style={{ color: C.lightGrey, fontSize: 14 }}>→</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CTA footer */}
        <div style={{ padding: '18px 32px', borderTop: `1px solid ${C.sable}`, backgroundColor: C.creme, display: 'flex', gap: 10 }}>
          <button onClick={() => { onClose(); /* navigate handled by parent */ }} style={{ flex: 1, padding: '13px', borderRadius: 12, border: 'none', backgroundColor: C.terracotta, color: C.white, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Voir les {count} candidature{count !== 1 ? 's' : ''} →
          </button>
          <button onClick={onClose} style={{ padding: '13px 20px', borderRadius: 12, border: `1.5px solid ${C.sable}`, backgroundColor: C.white, color: C.dark, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Fermer</button>
        </div>
      </div>
    </div>
  )
}

// ─── Offer card ───────────────────────────────────────────────────────────────

function actionBtn(color: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: `1px solid ${color}30`, backgroundColor: `${color}0D`, color, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
}

function OffreCard({ offre, selected, onSelect, onDetail, onViewCands, onArchive, onActivate, onDuplicate, onDelete, onEdit }: {
  offre: OffreRow; selected: boolean; onSelect: () => void
  onDetail: () => void; onViewCands: () => void
  onArchive: () => void; onActivate: () => void
  onDuplicate: () => void; onDelete: () => void; onEdit: () => void
}) {
  const count  = candCount(offre)
  const st     = offreStatut(offre)
  const stInfo = statutInfo(st)
  const pct    = Math.min(100, Math.round((count / CAND_TARGET) * 100))
  const hasSal = offre.salaire_min || offre.salaire_max
  const modeColor = offre.mode_travail === '100% remote' ? C.vert : offre.mode_travail === 'Hybride' ? '#7B5EA7' : C.grey

  return (
    <div onClick={onDetail} style={{ backgroundColor: C.white, borderRadius: 18, border: `1.5px solid ${selected ? C.terracotta : C.sable}`, padding: '20px 22px 18px', display: 'flex', gap: 14, alignItems: 'flex-start', transition: 'border-color 0.15s', boxShadow: '0 1px 8px rgba(0,0,0,0.04)', cursor: 'pointer' }}>

      <label onClick={e => e.stopPropagation()} style={{ marginTop: 2, flexShrink: 0, cursor: 'pointer' }}>
        <input type="checkbox" checked={selected} onChange={onSelect} style={{ accentColor: C.terracotta, width: 16, height: 16, cursor: 'pointer' }} />
      </label>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Title row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Clickable title */}
            <button onClick={e => { e.stopPropagation(); onDetail() }} style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: C.dark, lineHeight: 1.2, marginBottom: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: 3, transition: 'text-decoration-color 0.15s', fontStyle: 'normal' }}
              onMouseEnter={e => (e.currentTarget.style.textDecorationColor = C.terracotta)}
              onMouseLeave={e => (e.currentTarget.style.textDecorationColor = 'transparent')}
            >
              {offre.titre}
            </button>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {offre.type_contrat && <span style={{ padding: '2px 9px', borderRadius: 20, backgroundColor: `${C.terracotta}15`, color: C.terracotta, fontSize: 11, fontWeight: 700 }}>{offre.type_contrat}</span>}
              {offre.domaine     && <span style={{ padding: '2px 9px', borderRadius: 20, backgroundColor: `${C.vert}12`, color: C.vert, fontSize: 11, fontWeight: 700 }}>{offre.domaine}</span>}
              {offre.ville       && <span style={{ padding: '2px 9px', borderRadius: 20, backgroundColor: C.creme, border: `1px solid ${C.sable}`, color: C.grey, fontSize: 11 }}>◎ {offre.ville}</span>}
              {offre.mode_travail && <span style={{ padding: '2px 9px', borderRadius: 20, backgroundColor: `${modeColor}12`, color: modeColor, fontSize: 11, fontWeight: 500 }}>{offre.mode_travail}</span>}
            </div>
          </div>
          <span style={{ padding: '4px 12px', borderRadius: 20, backgroundColor: stInfo.bg, color: stInfo.color, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{stInfo.label}</span>
        </div>

        {/* Meta */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 12, alignItems: 'center' }}>
          {hasSal && (
            <div style={{ fontSize: 13, fontWeight: 600, color: C.dark }}>
              💰 {offre.salaire_min && offre.salaire_max
                ? `${offre.salaire_min.toLocaleString('fr-FR')} – ${offre.salaire_max.toLocaleString('fr-FR')} €`
                : `${(offre.salaire_min ?? offre.salaire_max)!.toLocaleString('fr-FR')} €`}
              <span style={{ fontWeight: 400, color: C.grey }}> / {offre.periode_salaire ?? 'an'}</span>
            </div>
          )}
          <div style={{ fontSize: 12, color: C.grey }}>📅 {dateLabel(offre.created_at)}</div>
          <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.terracotta} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span style={{ color: C.terracotta, fontWeight: 600 }}>{count}</span>
            <span style={{ color: C.grey }}>candidature{count !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: C.grey }}>Progression des candidatures</span>
            <span style={{ fontSize: 11, color: pct >= 80 ? C.vert : C.grey, fontWeight: 600 }}>{count} / {CAND_TARGET}</span>
          </div>
          <div style={{ height: 5, borderRadius: 10, backgroundColor: C.creme, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 10, backgroundColor: pct >= 80 ? C.vert : C.terracotta, transition: 'width 0.5s ease' }} />
          </div>
        </div>

        {/* Actions */}
        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={e => { e.stopPropagation(); onViewCands() }} style={actionBtn(C.terracotta)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            Voir candidatures
          </button>
          <button onClick={e => { e.stopPropagation(); onEdit() }} style={actionBtn(C.grey)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
            Modifier
          </button>
          <button onClick={e => { e.stopPropagation(); onDuplicate() }} style={actionBtn(C.grey)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Dupliquer
          </button>
          {st === 'archivée' || st === 'brouillon'
            ? <button onClick={e => { e.stopPropagation(); onActivate() }} style={actionBtn(C.vert)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Activer
              </button>
            : <button onClick={e => { e.stopPropagation(); onArchive() }} style={actionBtn(C.amber)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                Archiver
              </button>
          }
          <button onClick={e => { e.stopPropagation(); onDelete() }} style={{ ...actionBtn(C.red), marginLeft: 'auto' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Bulk bar ─────────────────────────────────────────────────────────────────

function BulkBar({ count, offres, onArchiveAll, onDeleteAll, onClear }: {
  count: number; offres: OffreRow[]; onArchiveAll: () => void; onDeleteAll: () => void; onClear: () => void
}) {
  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 200, backgroundColor: C.dark, color: C.white, borderRadius: 16, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 6px 30px rgba(0,0,0,0.22)', animation: 'kavio-slidein-up 0.2s ease', whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{count} sélectionnée{count !== 1 ? 's' : ''}</span>
      <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.2)' }} />
      <button onClick={onArchiveAll} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', backgroundColor: 'transparent', color: C.white, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Archiver tout</button>
      <button onClick={() => exportCSV(offres)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', backgroundColor: 'transparent', color: C.white, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Exporter CSV</button>
      <button onClick={onDeleteAll} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', backgroundColor: C.red, color: C.white, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Supprimer tout</button>
      <button onClick={onClear} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onPublish }: { onPublish: () => void }) {
  return (
    <div style={{ backgroundColor: C.white, borderRadius: 20, border: `1px solid ${C.sable}`, padding: '72px 40px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: `${C.terracotta}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.terracotta} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
      </div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: C.dark, margin: '0 0 10px' }}>Aucune offre publiée</h2>
      <p style={{ fontSize: 14, color: C.grey, lineHeight: 1.7, margin: '0 0 28px' }}>Commencez à attirer les meilleurs talents en publiant votre première offre. C'est rapide et gratuit.</p>
      <button onClick={onPublish} style={{ padding: '14px 28px', borderRadius: 12, border: 'none', backgroundColor: C.terracotta, color: C.white, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
        Publier ma première offre →
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MesOffresPage() {
  const router = useRouter()

  const [offres, setOffres]         = useState<OffreRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<TabFilter>('toutes')
  const [search, setSearch]         = useState('')
  const [sort, setSort]             = useState<SortKey>('recent')
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [detailOffre, setDetailOffre] = useState<OffreRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteBulk, setDeleteBulk] = useState(false)
  const [toastMsg, setToastMsg]     = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/connexion'); return }

      const { data, error } = await supabase
        .from('offres')
        .select('*, candidatures(count)')
        .eq('recruteur_id', user.id)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setOffres(data as OffreRow[])
      }
      setLoading(false)
    }
    load()
  }, [router])

  function showToast(msg: string) {
    setToastMsg(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(''), 3000)
  }

  async function archive(id: string) {
    await supabase.from('offres').update({ statut: 'archivée' }).eq('id', id)
    setOffres(p => p.map(o => o.id === id ? { ...o, statut: 'archivée' } : o))
    showToast('Offre archivée')
  }

  async function activate(id: string) {
    await supabase.from('offres').update({ statut: 'publiée' }).eq('id', id)
    setOffres(p => p.map(o => o.id === id ? { ...o, statut: 'publiée' } : o))
    showToast('Offre activée')
  }

  async function duplicate(id: string) {
    const o = offres.find(x => x.id === id)
    if (!o) return
    const { candidatures: _, id: __, created_at: ___, ...rest } = o
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
      .from('offres')
      .insert({ ...rest, titre: `${o.titre} (copie)`, statut: 'brouillon', recruteur_id: user.id })
      .select('*')
      .single()
    if (!error && data) {
      // Offre fraîchement créée : 0 candidature par définition
      setOffres(p => [{ ...(data as OffreRow), candidatures: [{ count: 0 }] }, ...p])
      showToast('Offre dupliquée en brouillon')
    }
  }

  async function deleteOffre(id: string) {
    await supabase.from('offres').delete().eq('id', id)
    setOffres(p => p.filter(o => o.id !== id))
    setSelected(s => { const n = new Set(s); n.delete(id); return n })
    if (detailOffre?.id === id) setDetailOffre(null)
    setDeleteTarget(null)
    showToast('Offre supprimée')
  }

  async function archiveAll() {
    const ids = [...selected]
    await supabase.from('offres').update({ statut: 'archivée' }).in('id', ids)
    setOffres(p => p.map(o => ids.includes(o.id) ? { ...o, statut: 'archivée' } : o))
    setSelected(new Set()); showToast(`${ids.length} offre${ids.length > 1 ? 's' : ''} archivée${ids.length > 1 ? 's' : ''}`)
  }

  async function deleteAll() {
    const ids = [...selected]
    await supabase.from('offres').delete().in('id', ids)
    setOffres(p => p.filter(o => !ids.includes(o.id)))
    setSelected(new Set()); setDeleteBulk(false)
    showToast(`${ids.length} offre${ids.length > 1 ? 's' : ''} supprimée${ids.length > 1 ? 's' : ''}`)
  }

  function toggleSelect(id: string) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const displayed = useMemo(() => {
    let list = offres.filter(o => {
      if (tab !== 'toutes' && offreStatut(o) !== tab) return false
      if (search) {
        const q = search.toLowerCase()
        if (!o.titre.toLowerCase().includes(q) && !(o.domaine ?? '').toLowerCase().includes(q)) return false
      }
      return true
    })
    if (sort === 'recent')         list = list.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    else if (sort === 'ancien')    list = list.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    else if (sort === 'candidatures') list = list.slice().sort((a, b) => candCount(b) - candCount(a))
    return list
  }, [offres, tab, search, sort])

  const stats = useMemo(() => ({
    actives:    offres.filter(o => offreStatut(o) === 'publiée').length,
    brouillons: offres.filter(o => offreStatut(o) === 'brouillon').length,
    archivees:  offres.filter(o => offreStatut(o) === 'archivée').length,
  }), [offres])

  const TABS: { key: TabFilter; label: string; count: number }[] = [
    { key: 'toutes',    label: 'Toutes',     count: offres.length },
    { key: 'publiée',   label: 'Actives',    count: stats.actives },
    { key: 'brouillon', label: 'Brouillons', count: stats.brouillons },
    { key: 'archivée',  label: 'Archivées',  count: stats.archivees },
  ]

  return (
    <main style={{ backgroundColor: C.creme, minHeight: '100vh' }}>
      <style suppressHydrationWarning>{`
        @keyframes kavio-spin       { to { transform: rotate(360deg); } }
        @keyframes kavio-modal      { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes kavio-slidein-up { from { opacity: 0; transform: translateX(-50%) translateY(12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      `}</style>

      <Toast msg={toastMsg} />

      {detailOffre && (
        <OffreDetailModal
          offre={detailOffre}
          onClose={() => setDetailOffre(null)}
          onEdit={() => { setDetailOffre(null); router.push(`/recruteur/offres/publier?id=${detailOffre.id}`) }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          message="Cette offre sera définitivement supprimée. Cette action est irréversible."
          onConfirm={() => deleteOffre(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {deleteBulk && (
        <ConfirmModal
          message={`Vous allez supprimer définitivement ${selected.size} offre${selected.size > 1 ? 's' : ''}. Cette action est irréversible.`}
          onConfirm={deleteAll}
          onCancel={() => setDeleteBulk(false)}
        />
      )}

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: C.white, borderBottom: `1px solid ${C.sable}`, padding: '32px 40px 0', position: 'sticky', top: 64, zIndex: 20 }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
            <div>
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(24px, 3.5vw, 32px)', color: C.dark, margin: '0 0 6px', lineHeight: 1.15 }}>Mes offres</h1>
              {!loading && (
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: C.vert, fontWeight: 600 }}>● {stats.actives} active{stats.actives !== 1 ? 's' : ''}</span>
                  {stats.brouillons > 0 && <span style={{ fontSize: 13, color: C.grey }}>○ {stats.brouillons} brouillon{stats.brouillons !== 1 ? 's' : ''}</span>}
                  {stats.archivees  > 0 && <span style={{ fontSize: 13, color: C.amber }}>◐ {stats.archivees} archivée{stats.archivees !== 1 ? 's' : ''}</span>}
                </div>
              )}
            </div>
            <button onClick={() => router.push('/recruteur/offres/publier')} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 20px', borderRadius: 12, border: 'none', backgroundColor: C.terracotta, color: C.white, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, boxShadow: `0 2px 10px ${C.terracotta}40` }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Publier une nouvelle offre
            </button>
          </div>
          <div style={{ display: 'flex', gap: 0, marginBottom: -1 }}>
            {TABS.map(t => {
              const active = tab === t.key
              return (
                <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '10px 16px', border: 'none', borderBottom: `2px solid ${active ? C.terracotta : 'transparent'}`, backgroundColor: 'transparent', color: active ? C.terracotta : C.grey, fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {t.label}
                  <span style={{ padding: '1px 7px', borderRadius: 20, backgroundColor: active ? `${C.terracotta}15` : C.creme, color: active ? C.terracotta : C.grey, fontSize: 11, fontWeight: 600 }}>{t.count}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── TOOLBAR ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 40px 0' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.lightGrey} strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par titre ou domaine…" style={{ width: '100%', padding: '10px 12px 10px 36px', fontSize: 13, borderRadius: 10, border: `1.5px solid ${C.sable}`, backgroundColor: C.white, color: C.dark, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>
          <select value={sort} onChange={e => setSort(e.target.value as SortKey)} style={{ padding: '10px 14px', fontSize: 13, borderRadius: 10, border: `1.5px solid ${C.sable}`, backgroundColor: C.white, color: C.dark, outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            <option value="recent">Plus récentes</option>
            <option value="ancien">Plus anciennes</option>
            <option value="candidatures">Plus de candidatures</option>
          </select>
          {displayed.length > 0 && (
            <button onClick={() => { if (selected.size === displayed.length) setSelected(new Set()); else setSelected(new Set(displayed.map(o => o.id))) }} style={{ padding: '9px 14px', borderRadius: 10, border: `1.5px solid ${C.sable}`, backgroundColor: selected.size === displayed.length && selected.size > 0 ? `${C.dark}08` : 'transparent', color: C.grey, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              {selected.size === displayed.length && selected.size > 0 ? 'Désélectionner' : 'Tout sélectionner'}
            </button>
          )}
        </div>
      </div>

      {/* ── LIST ────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 40px 100px' }}>
        {loading ? <Spinner /> : offres.length === 0 ? (
          <EmptyState onPublish={() => router.push('/recruteur/offres/publier')} />
        ) : displayed.length === 0 ? (
          <div style={{ backgroundColor: C.white, borderRadius: 18, border: `1px solid ${C.sable}`, padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>◎</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: C.dark, marginBottom: 6 }}>Aucune offre dans cette catégorie</div>
            <div style={{ fontSize: 13, color: C.grey }}>Essayez un autre filtre ou modifiez votre recherche.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {displayed.map(o => (
              <OffreCard
                key={o.id}
                offre={o}
                selected={selected.has(o.id)}
                onSelect={() => toggleSelect(o.id)}
                onDetail={() => setDetailOffre(o)}
                onViewCands={() => router.push(`/recruteur/offres/${o.id}/candidatures`)}
                onEdit={() => router.push(`/recruteur/offres/publier?id=${o.id}`)}
                onDuplicate={() => duplicate(o.id)}
                onArchive={() => archive(o.id)}
                onActivate={() => activate(o.id)}
                onDelete={() => setDeleteTarget(o.id)}
              />
            ))}
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          offres={displayed.filter(o => selected.has(o.id))}
          onArchiveAll={archiveAll}
          onDeleteAll={() => setDeleteBulk(true)}
          onClear={() => setSelected(new Set())}
        />
      )}
    </main>
  )
}
