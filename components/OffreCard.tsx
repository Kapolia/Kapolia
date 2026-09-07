'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { type GeoCoords } from '@/components/GeoVilleInput'
import { haversineKm } from '@/lib/geo'

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

export type OffreCardData = {
  id: string
  titre: string
  recruteur_id?: string
  entreprise_nom?: string
  type_contrat?: string
  ville?: string
  mode_travail?: string
  salaire_min?: number
  salaire_max?: number
  periode_salaire?: string
  experience?: string
  description?: string
  created_at?: string
  latitude?: number
  longitude?: number
}

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
  return range + (periode === 'mensuel' ? '/mois' : '/an')
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

export function OffreCard({
  offre, applied, saved, onApply, onToggleSave, isConnected,
  isSelected = false, onSelect, searchCoords, dateLabel,
}: {
  offre: OffreCardData
  applied: boolean
  saved: boolean
  onApply: (id: string) => void
  onToggleSave: (id: string) => void
  isConnected: boolean
  isSelected?: boolean
  onSelect?: (id: string) => void   // presence triggers compact (split-view) mode
  searchCoords?: GeoCoords | null
  dateLabel?: string                // replaces auto-computed "publié il y a X jours"
}) {
  const [hov, setHov]           = useState(false)
  const [applying, setApplying] = useState(false)
  const router = useRouter()
  const compact = !!onSelect

  const entreprise = offre.entreprise_nom || 'Entreprise'
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

  // ── Compact card (split view) ─────────────────────────────────────────
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

        <div style={{ fontSize: 13, color: C.grey, marginBottom: 10 }}>
          {offre.recruteur_id ? (
            <Link
              href={`/entreprise/${offre.recruteur_id}`}
              onClick={e => e.stopPropagation()}
              style={{ fontWeight: 600, color: C.terracotta, textDecoration: 'none' }}
            >
              {entreprise}
            </Link>
          ) : (
            <span style={{ fontWeight: 600, color: '#444' }}>{entreprise}</span>
          )}
          {offre.ville && <span style={{ color: C.lightGrey }}> · {offre.ville}</span>}
        </div>

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

  // ── Full card ─────────────────────────────────────────────────────────
  const pubLabel = dateLabel ?? (offre.created_at ? daysSince(offre.created_at) : null)

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
        padding: '16px 22px 14px 21px',
        display: 'flex', flexDirection: 'column', gap: 9,
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
            {offre.recruteur_id ? (
              <Link
                href={`/entreprise/${offre.recruteur_id}`}
                onClick={e => e.stopPropagation()}
                style={{ fontWeight: 600, color: C.terracotta, textDecoration: 'none' }}
              >
                {entreprise}
              </Link>
            ) : (
              <span style={{ fontWeight: 600, color: C.dark }}>{entreprise}</span>
            )}
            {offre.ville && <><span style={{ color: C.lightGrey }}>·</span><span>{offre.ville}</span></>}
            {pubLabel && <><span style={{ color: C.lightGrey }}>·</span><span style={{ fontSize: 11, color: C.lightGrey }}>{pubLabel}</span></>}
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
                <div style={{ width: 11, height: 11, borderRadius: '50%', border: `2px solid ${C.sable}`, borderTopColor: C.terracotta, animation: 'kapolia-spin 0.7s linear infinite' }} />
                Envoi…
              </>
            ) : 'Postuler en 1 clic'}
          </button>
        )}
      </div>
    </div>
  )
}
