'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { type GeoCoords } from '@/components/GeoVilleInput'
import { FONT_SERIF } from '@/lib/typography'
import { haversineKm } from '@/lib/geo'
import { type ScoreBreakdown } from '@/lib/matching'
import { C as _C, CARD_SHADOW, CARD_RADIUS } from '@/lib/colors'
import { EntrepriseLogo } from '@/components/EntrepriseLogo'
import { TELETRAVAIL_OPTIONS } from '@/lib/referentiels'

const C = { ..._C, lightGrey: '#D0D0D0' as const }


export type OffreCardData = {
  id: string
  titre: string
  recruteur_id?: string
  entreprise_nom?: string
  entreprise_logo_url?: string
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
  score?: number | null
  breakdown?: ScoreBreakdown | null
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

export function scoreLabel(score: number): string {
  if (score >= 80) return 'Très bonne correspondance avec votre profil'
  if (score >= 60) return 'Bonne correspondance avec votre profil'
  if (score >= 40) return 'Correspondance partielle avec votre profil'
  return 'Correspondance limitée avec votre profil'
}

function StarButton({ saved, onClick }: { saved: boolean; onClick: (e: React.MouseEvent) => void }) {
  const [hov, setHov]    = useState(false)
  const iconRef          = useRef<SVGSVGElement>(null)
  const prevSavedRef     = useRef(false)

  useEffect(() => {
    const icon = iconRef.current
    if (!icon || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      prevSavedRef.current = saved; return
    }
    if (saved && !prevSavedRef.current) {
      icon.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(0.6)' }, { transform: 'scale(1.2)' }, { transform: 'scale(1)' }],
        { duration: 380, easing: 'ease-out' }
      )
    } else if (!saved && prevSavedRef.current) {
      icon.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(0.7)' }, { transform: 'scale(1)' }],
        { duration: 260, easing: 'ease-out' }
      )
    }
    prevSavedRef.current = saved
  }, [saved])

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={saved ? 'Retirer des favoris' : 'Sauvegarder'}
      style={{
        width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 7, border: `1px solid ${saved ? 'rgba(194,97,31,0.35)' : C.sable}`,
        backgroundColor: saved ? `${C.vert}10` : hov ? C.bg : 'transparent',
        cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
      }}
    >
      <svg ref={iconRef} width="13" height="13" viewBox="0 0 24 24" fill={saved ? C.orange : 'none'} stroke={saved ? C.orange : '#9AA49E'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  )
}

// Shared pill styles — also imported by OffreDetail
export const PILL: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 500,
  backgroundColor: C.chip, color: '#3E4F46',
  padding: '3px 9px', borderRadius: 20,
}
export const PILL_SALARY: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 600,
  backgroundColor: '#EAF1EC', color: C.vert,
  padding: '3px 9px', borderRadius: 20,
}

export function OffreCard({
  offre, applied, saved, onApply, onToggleSave, isConnected,
  isSelected = false, onSelect, searchCoords, dateLabel, expirePastille, ferme,
  showDescription = true, showApply = true, showSave = true,
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
  expirePastille?: string | null    // badge d'expiration (mode compact uniquement, offres ouvertes)
  ferme?: boolean                   // offre expirée ou dépubliée (mode compact)
  showDescription?: boolean
  showApply?: boolean
  showSave?: boolean
}) {
  const [hov, setHov]           = useState(false)
  const [applying, setApplying] = useState(false)
  const [barMounted, setBarMounted] = useState(false)
  const router = useRouter()
  const compact = !!onSelect

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBarMounted(true)
  }, [])

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
          borderLeft: `3px solid ${isSelected ? C.terracotta : hov ? `${C.terracotta}70` : 'transparent'}`,
          borderRadius: CARD_RADIUS,
          padding: (!ferme && offre.score != null) ? '14px 16px 0 13px' : '14px 16px 12px 13px',
          cursor: 'pointer',
          boxShadow: isSelected
            ? '0 4px 10px rgba(27,48,38,.10), 0 14px 34px rgba(27,48,38,.16)'
            : hov ? '0 2px 6px rgba(27,48,38,.08), 0 8px 24px rgba(27,48,38,.11)' : CARD_SHADOW,
          transition: 'box-shadow 0.15s, border-left-color 0.15s, background-color 0.15s, scale 320ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          scale: isSelected ? '1.035' : '1',
          zIndex: isSelected ? 2 : undefined,
          overflow: 'hidden',
        }}
      >
        {/* En-tête : logo · bloc texte · étoile */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <div style={ferme ? { filter: 'grayscale(1)', opacity: 0.6 } : undefined}>
            <EntrepriseLogo nom={entreprise} logoUrl={offre.entreprise_logo_url} size={36} />
          </div>
          <div style={{ flex: 1, minWidth: 0, opacity: ferme ? 0.55 : undefined }}>
            <div style={{
              fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 16, fontWeight: 600, lineHeight: 1.3,
              color: isSelected ? C.terracotta : hov ? C.terracotta : C.dark,
              transition: 'color 0.15s',
            }}>
              {offre.titre}
            </div>
            <div style={{ fontSize: 13, color: C.grey, marginTop: 3 }}>
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
              {offre.ville && <><span style={{ color: C.lightGrey }}> · </span><span style={{ color: C.grey }}>{offre.ville}</span></>}
            </div>
          </div>
          {!applied && <StarButton saved={saved} onClick={e => { e.stopPropagation(); onToggleSave(offre.id) }} />}
        </div>

        {/* Pastilles — pleine largeur */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: ferme ? 8 : (expirePastille ? 8 : (offre.score != null ? 10 : 0)), opacity: ferme ? 0.55 : undefined }}>
          {salaire && <span style={PILL_SALARY}>{salaire}</span>}
          {offre.type_contrat && <span style={PILL}>{offre.type_contrat}</span>}
          {offre.mode_travail && <span style={PILL}>{TELETRAVAIL_OPTIONS.find(o => o.value === offre.mode_travail)?.labelLong ?? offre.mode_travail}</span>}
          {applied && (
            <span style={{ ...PILL, display: 'inline-flex', alignItems: 'center', gap: 4, animation: 'kapolia-motion-pill-enter 450ms cubic-bezier(0.3, 1.6, 0.5, 1) both' }}>
              <svg width="11" height="9" viewBox="0 0 12 10" fill="none"><path d="M1 5L4 8L11 1" stroke={C.vert} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Candidature envoyée
            </span>
          )}
          {distanceKm != null && <span style={PILL}>à {distanceKm} km</span>}
        </div>

        {/* Badge expiration / offre fermée */}
        {ferme ? (
          <div style={{
            display: 'inline-flex', alignItems: 'center',
            fontSize: 11.5, fontWeight: 600, color: C.grey,
            backgroundColor: '#EEF0EF', borderRadius: 20, padding: '3px 9px',
          }}>
            Offre expirée
          </div>
        ) : expirePastille ? (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11.5, fontWeight: 600, color: '#8A5A12',
            backgroundColor: '#F7EEDD', borderRadius: 20, padding: '3px 9px',
            marginBottom: offre.score != null ? 8 : 0,
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8A5A12" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            {expirePastille}
          </div>
        ) : null}

        {/* Pied de score — pleine largeur */}
        {!ferme && offre.score != null ? (
          <div style={{ margin: '0 -16px 0 -13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 16px 5px 13px', fontSize: 12 }}>
              <span style={{ color: C.grey }}>{scoreLabel(offre.score)}</span>
              <span style={{ color: C.vert, fontWeight: 600 }}>{offre.score} %</span>
            </div>
            <div style={{ height: 3, backgroundColor: '#EEF0EF' }}>
              <div style={{
                height: 3, width: '100%', backgroundColor: C.vert,
                transform: barMounted ? `scaleX(${Math.min(100, offre.score) / 100})` : 'scaleX(0)',
                transformOrigin: 'left',
                transition: barMounted ? 'transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) 0.2s' : 'none',
              }} />
            </div>
          </div>
        ) : !ferme && isConnected ? (
          <Link
            href="/profil"
            onClick={e => e.stopPropagation()}
            style={{ display: 'block', marginTop: 6, fontSize: 11, color: C.vert, opacity: 0.55, textDecoration: 'underline', textDecorationColor: `${C.vert}40` }}
          >
            Complétez votre profil pour voir votre correspondance
          </Link>
        ) : null}
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
        borderLeft: `3px solid ${hov ? C.terracotta : 'transparent'}`,
        borderRadius: CARD_RADIUS,
        padding: offre.score != null ? '16px 22px 0 21px' : '16px 22px 14px 21px',
        display: 'flex', flexDirection: 'column', gap: 9,
        boxShadow: hov ? '0 2px 6px rgba(27,48,38,.08), 0 8px 24px rgba(27,48,38,.11)' : CARD_SHADOW,
        transform: hov ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'box-shadow 0.18s, border-left-color 0.18s, transform 0.18s',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 16, fontWeight: 600,
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
            {pubLabel && <><span style={{ color: C.lightGrey }}>·</span><span style={{ fontSize: 11, color: C.grey }}>{pubLabel}</span></>}
          </div>
        </div>
        {showSave && !applied && <StarButton saved={saved} onClick={e => { e.stopPropagation(); onToggleSave(offre.id) }} />}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {offre.type_contrat && <span style={PILL}>{offre.type_contrat}</span>}
        {offre.mode_travail && <span style={PILL}>{TELETRAVAIL_OPTIONS.find(o => o.value === offre.mode_travail)?.labelLong ?? offre.mode_travail}</span>}
        {offre.experience  && <span style={PILL}>{offre.experience}</span>}
        {salaire           && <span style={PILL_SALARY}>{salaire}</span>}
        {distanceKm != null && <span style={PILL}>à {distanceKm} km</span>}
      </div>

      {showDescription && offre.description && (
        <p style={{
          fontSize: 13, color: C.grey, margin: 0, lineHeight: 1.6,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {offre.description}
        </p>
      )}

      {showApply && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
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
      )}

      {offre.score != null ? (
        <div style={{ margin: '0 -22px 0 -21px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 22px 5px 21px', fontSize: 10 }}>
            <span style={{ color: C.grey }}>{scoreLabel(offre.score)}</span>
            <span style={{ color: C.vert, fontWeight: 600 }}>{offre.score} %</span>
          </div>
          <div style={{ height: 3, backgroundColor: '#EEF0EF', overflow: 'hidden' }}>
            <div style={{
              height: 3, width: '100%', backgroundColor: C.vert,
              transform: barMounted ? `scaleX(${Math.min(100, offre.score) / 100})` : 'scaleX(0)',
              transformOrigin: 'left',
              transition: 'transform 0.8s ease 0.45s',
            }} />
          </div>
        </div>
      ) : isConnected ? (
        <Link
          href="/profil"
          onClick={e => e.stopPropagation()}
          style={{ fontSize: 11, color: C.vert, opacity: 0.55, textDecoration: 'underline', textDecorationColor: `${C.vert}40` }}
        >
          Complétez votre profil pour voir votre correspondance
        </Link>
      ) : null}
    </div>
  )
}
