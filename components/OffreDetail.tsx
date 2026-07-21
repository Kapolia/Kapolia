'use client'

import { useState } from 'react'
import Link from 'next/link'

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

export type OffreData = {
  id: string
  titre: string
  entreprise_nom?: string
  entreprise_logo_url?: string
  type_contrat?: string
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
}

type Props = {
  offre: OffreData
  applied: boolean
  appliedDate?: string | null
  applying: boolean
  saved: boolean
  isConnected: boolean
  onApply: () => void
  onToggleSave: () => void
  mode?: 'page' | 'panel'
  onBack?: () => void
}

// ─── EntrepriseLogo ───────────────────────────────────────────────────────────

const LOGO_COLORS = [
  { bg: '#F5EBE5', color: '#C4673A' },
  { bg: '#E8EDE9', color: '#2C4A3E' },
  { bg: '#F0EBF5', color: '#7B5EA7' },
  { bg: '#F5EDE0', color: '#9B7B48' },
]

function EntrepriseLogo({ nom, logoUrl, size = 48 }: { nom: string; logoUrl?: string; size?: number }) {
  const [imgError, setImgError] = useState(false)
  const initial    = nom.trim().charAt(0).toUpperCase()
  const { bg, color } = LOGO_COLORS[nom.charCodeAt(0) % LOGO_COLORS.length]
  const showFallback   = !logoUrl || imgError

  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size / 4),
      flexShrink: 0, overflow: 'hidden',
      border: `1px solid ${showFallback ? 'transparent' : '#E8E8E8'}`,
      backgroundColor: showFallback ? bg : '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {showFallback ? (
        <span style={{
          fontSize: Math.round(size * 0.44),
          fontFamily: 'Georgia, serif', fontWeight: 700, color,
          lineHeight: 1, userSelect: 'none',
        }}>
          {initial}
        </span>
      ) : (
        <img
          src={logoUrl}
          alt={nom}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: Math.round(size * 0.1) }}
        />
      )}
    </div>
  )
}

// ─── Apply button helpers ─────────────────────────────────────────────────────

function formatAppliedLabel(iso: string): string {
  const d = new Date(iso)
  if (d.toDateString() === new Date().toDateString()) return 'Postulé aujourd’hui'
  return `Postulé le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
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
  const per = periode === 'mensuel' ? '/mois' : '/an'
  return range + per
}

// ─── Page-mode helpers ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: C.white, borderRadius: 20, border: `1px solid ${C.sable}`, padding: '28px 32px' }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: C.dark, margin: '0 0 18px', fontWeight: 600 }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function PageApplyButton({ applied, appliedDate, applying, onApply, isConnected }: {
  applied: boolean; appliedDate?: string | null; applying: boolean; onApply: () => void; isConnected: boolean
}) {
  if (applied) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        backgroundColor: `${C.vert}10`, color: C.vert,
        border: `1px solid ${C.vert}30`, padding: '11px 22px',
        borderRadius: 12, fontSize: 14, fontWeight: 600,
      }}>
        <svg width="14" height="12" viewBox="0 0 12 10" fill="none">
          <path d="M1 5L4 8L11 1" stroke={C.vert} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {appliedDate ? formatAppliedLabel(appliedDate) : 'Candidature envoyée'}
      </div>
    )
  }
  return (
    <button
      onClick={onApply}
      disabled={applying}
      style={{
        backgroundColor: applying ? C.sable : C.terracotta, color: C.white,
        border: 'none', borderRadius: 12, padding: '11px 26px',
        fontSize: 14, fontWeight: 700, cursor: applying ? 'default' : 'pointer',
        fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
        transition: 'background-color 0.15s',
      }}
    >
      {applying ? (
        <>
          <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: C.white, animation: 'kavio-spin 0.7s linear infinite' }} />
          Envoi…
        </>
      ) : isConnected ? 'Postuler' : 'Se connecter pour postuler'}
    </button>
  )
}

// ─── Panel-mode helpers ───────────────────────────────────────────────────────

function PanelSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 600, color: C.dark, marginBottom: 12 }}>
      {children}
    </div>
  )
}

function PanelSection({ title, children, last = false }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ padding: '24px 28px', borderBottom: last ? 'none' : `1px solid ${C.sable}` }}>
      <PanelSectionTitle>{title}</PanelSectionTitle>
      {children}
    </div>
  )
}

function PanelApplyButton({ applied, appliedDate, applying, onApply, isConnected }: {
  applied: boolean; appliedDate?: string | null; applying: boolean; onApply: () => void; isConnected: boolean
}) {
  if (applied) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        backgroundColor: `${C.vert}10`, color: C.vert,
        border: `1px solid ${C.vert}30`, padding: '9px 16px',
        borderRadius: 10, fontSize: 13, fontWeight: 600,
      }}>
        <svg width="11" height="9" viewBox="0 0 12 10" fill="none">
          <path d="M1 5L4 8L11 1" stroke={C.vert} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {appliedDate ? formatAppliedLabel(appliedDate) : 'Candidature envoyée'}
      </div>
    )
  }
  return (
    <button
      onClick={onApply}
      disabled={applying}
      style={{
        backgroundColor: applying ? C.sable : C.terracotta, color: C.white,
        border: 'none', borderRadius: 10, padding: '9px 20px',
        fontSize: 13, fontWeight: 700, cursor: applying ? 'default' : 'pointer',
        fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
        transition: 'background-color 0.15s',
      }}
    >
      {applying ? (
        <>
          <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: C.white, animation: 'kavio-spin 0.7s linear infinite' }} />
          Envoi…
        </>
      ) : isConnected ? 'Postuler en 1 clic' : 'Se connecter pour postuler'}
    </button>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OffreDetail({
  offre, applied, appliedDate, applying, saved, isConnected,
  onApply, onToggleSave, mode = 'page', onBack,
}: Props) {
  const [copied, setCopied] = useState(false)

  const salaire    = formatSalaire(offre.salaire_min, offre.salaire_max, offre.periode_salaire)
  const entreprise = offre.entreprise_nom || 'Entreprise'

  function handleShare() {
    const url = `${window.location.origin}/offres/${offre.id}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Panel mode ─────────────────────────────────────────────────────────────

  if (mode === 'panel') {
    const details: { label: string; value: string }[] = [
      ...(offre.type_contrat  ? [{ label: 'Contrat',         value: offre.type_contrat }]  : []),
      ...(offre.experience    ? [{ label: 'Expérience',      value: offre.experience }]     : []),
      ...(offre.mode_travail  ? [{ label: 'Mode de travail', value: offre.mode_travail }]   : []),
      ...(offre.date_debut    ? [{ label: 'Prise de poste',  value: offre.date_debut }]     : []),
    ]

    // Compute which sections exist to apply last-child logic
    const hasDetails     = details.length > 0
    const hasLieu        = !!offre.ville
    const hasAvantages   = (offre.avantages?.length ?? 0) > 0
    const hasDescription = !!offre.description
    const hasCompetences = (offre.competences?.length ?? 0) > 0
    const hasValeurs     = (offre.valeurs?.length ?? 0) > 0

    const sections = [hasDetails, hasLieu, hasAvantages, hasDescription, hasCompetences, hasValeurs]
    const lastIdx  = sections.lastIndexOf(true)
    let sIdx = 0

    return (
      <div style={{
        backgroundColor: C.white,
        borderRadius: 16,
        border: `1px solid ${C.sable}`,
        boxShadow: '0 4px 20px rgba(44,74,62,0.08)',
        overflow: 'hidden',
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header — ancré en haut de la carte */}
        <div style={{
          backgroundColor: C.white,
          borderBottom: `1px solid ${C.sable}`,
          padding: '20px 28px 16px',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
        }}>
          {/* Title */}
          <h2 style={{
            fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700,
            color: C.dark, margin: '0 0 12px', lineHeight: 1.2,
          }}>
            {offre.titre}
          </h2>

          {/* Bloc identité entreprise */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <EntrepriseLogo nom={entreprise} logoUrl={offre.entreprise_logo_url} size={44} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.dark, lineHeight: 1.2 }}>
                {entreprise}
              </div>
              <div style={{ fontSize: 12, color: C.grey, marginTop: 3 }}>
                {[offre.ville, offre.mode_travail].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>

          {/* Salary + Contract badges */}
          {(salaire || offre.type_contrat || offre.experience) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
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
              {offre.experience && (
                <span style={{ fontSize: 12, fontWeight: 500, backgroundColor: C.creme, color: C.grey, padding: '3px 10px', borderRadius: 20, border: `1px solid ${C.sable}` }}>
                  {offre.experience}
                </span>
              )}
            </div>
          )}

          {/* Action row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <PanelApplyButton applied={applied} appliedDate={appliedDate} applying={applying} onApply={onApply} isConnected={isConnected} />

            <button
              onClick={onToggleSave}
              title={saved ? 'Retirer des favoris' : 'Sauvegarder'}
              style={{
                width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 10,
                border: `1px solid ${saved ? '#F59E0B50' : C.sable}`,
                backgroundColor: saved ? '#FEF3C720' : C.white,
                cursor: 'pointer', fontSize: 18, transition: 'all 0.15s',
              }}
            >
              {saved ? '★' : '☆'}
            </button>

            <button
              onClick={handleShare}
              title="Copier le lien"
              style={{
                height: 36, padding: '0 12px',
                display: 'inline-flex', alignItems: 'center', gap: 5,
                borderRadius: 10,
                border: `1px solid ${copied ? `${C.vert}40` : C.sable}`,
                backgroundColor: copied ? `${C.vert}08` : C.white,
                color: copied ? C.vert : C.grey,
                cursor: 'pointer', fontSize: 12, fontWeight: 500,
                fontFamily: 'inherit', transition: 'all 0.2s',
              }}
            >
              {copied ? (
                <>
                  <svg width="11" height="9" viewBox="0 0 12 10" fill="none">
                    <path d="M1 5L4 8L11 1" stroke={C.vert} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Copié !
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                  </svg>
                  Partager
                </>
              )}
            </button>
          </div>

          {/* Open-in-page link */}
          <div style={{ marginTop: 10 }}>
            <Link
              href={`/offres/${offre.id}`}
              style={{
                fontSize: 12, color: C.vert, textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontWeight: 500, opacity: 0.8,
              }}
            >
              Ouvrir dans une page
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Body scrollable */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

            {/* Détails du poste */}
            {hasDetails && (
              <PanelSection title="Détails du poste" last={lastIdx === sIdx++}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {details.map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '4px 0' }}>
                      <span style={{ fontSize: 12, color: C.grey, fontWeight: 500, minWidth: 118, flexShrink: 0 }}>
                        {label}
                      </span>
                      <span style={{ fontSize: 14, color: C.dark, fontWeight: 500 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </PanelSection>
            )}

            {/* Lieu */}
            {hasLieu && (
              <PanelSection title="Lieu" last={lastIdx === sIdx++}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: C.dark }}>
                  <svg width="14" height="16" viewBox="0 0 14 18" fill="none">
                    <path d="M7 1C4.24 1 2 3.24 2 6c0 3.75 5 11 5 11s5-7.25 5-11c0-2.76-2.24-5-5-5z" fill={C.terracotta} opacity="0.7" />
                    <circle cx="7" cy="6" r="1.8" fill={C.white} />
                  </svg>
                  <span style={{ fontWeight: 500 }}>{offre.ville}</span>
                </div>
              </PanelSection>
            )}

            {/* Avantages — bullet list */}
            {hasAvantages && (
              <PanelSection title="Avantages" last={lastIdx === sIdx++}>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {offre.avantages!.map(a => (
                    <li key={a} style={{ fontSize: 14, color: C.dark, lineHeight: 1.5 }}>{a}</li>
                  ))}
                </ul>
              </PanelSection>
            )}

            {/* Description */}
            {hasDescription && (
              <PanelSection title="Description du poste" last={lastIdx === sIdx++}>
                <p style={{ fontSize: 14, color: C.grey, margin: 0, lineHeight: 2.0, whiteSpace: 'pre-wrap' }}>
                  {offre.description}
                </p>
              </PanelSection>
            )}

            {/* Compétences */}
            {hasCompetences && (
              <PanelSection title="Compétences recherchées" last={lastIdx === sIdx++}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {offre.competences!.map(s => (
                    <span key={s} style={{ fontSize: 13, fontWeight: 500, backgroundColor: C.creme, border: `1px solid ${C.sable}`, color: C.dark, padding: '4px 12px', borderRadius: 8 }}>
                      {s}
                    </span>
                  ))}
                </div>
              </PanelSection>
            )}

            {/* Valeurs */}
            {hasValeurs && (
              <PanelSection title="Nos valeurs" last={lastIdx === sIdx++}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {offre.valeurs!.map(v => (
                    <span key={v} style={{ fontSize: 13, fontWeight: 600, backgroundColor: `${C.vert}10`, color: C.vert, border: `1px solid ${C.vert}20`, padding: '4px 12px', borderRadius: 20 }}>
                      {v}
                    </span>
                  ))}
                </div>
              </PanelSection>
            )}

          {/* Published date */}
          <div style={{ textAlign: 'center', padding: '16px 0 28px', fontSize: 12, color: C.lightGrey }}>
            Publié {daysSince(offre.created_at)}
          </div>
        </div>
      </div>
    )
  }

  // ── Page mode ──────────────────────────────────────────────────────────────

  const badges = (mt: number) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: mt }}>
      {offre.type_contrat && (
        <span style={{ fontSize: 12, fontWeight: 600, backgroundColor: `${C.terracotta}14`, color: C.terracotta, padding: '4px 13px', borderRadius: 20 }}>
          {offre.type_contrat}
        </span>
      )}
      {offre.mode_travail && (
        <span style={{
          fontSize: 12, fontWeight: 600, padding: '4px 13px', borderRadius: 20,
          backgroundColor: offre.mode_travail === '100% remote' ? `${C.vert}14` : offre.mode_travail === 'Hybride' ? '#7B5EA714' : `${C.dark}0A`,
          color: offre.mode_travail === '100% remote' ? C.vert : offre.mode_travail === 'Hybride' ? '#7B5EA7' : C.grey,
        }}>
          {offre.mode_travail}
        </span>
      )}
      {offre.experience && (
        <span style={{ fontSize: 12, fontWeight: 500, backgroundColor: C.creme, color: C.grey, padding: '4px 13px', borderRadius: 20, border: `1px solid ${C.sable}` }}>
          {offre.experience}
        </span>
      )}
      {salaire && (
        <span style={{ fontSize: 12, fontWeight: 600, backgroundColor: '#F0FDF4', color: '#16A34A', padding: '4px 13px', borderRadius: 20 }}>
          💰 {salaire}
        </span>
      )}
    </div>
  )

  const bodySections = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {offre.description && (
        <Section title="Description du poste">
          <p style={{ fontSize: 14, color: C.grey, margin: 0, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
            {offre.description}
          </p>
        </Section>
      )}
      {(offre.competences?.length ?? 0) > 0 && (
        <Section title="Compétences recherchées">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {offre.competences!.map(s => (
              <span key={s} style={{ fontSize: 13, fontWeight: 500, backgroundColor: C.creme, border: `1px solid ${C.sable}`, color: C.dark, padding: '5px 14px', borderRadius: 8 }}>
                {s}
              </span>
            ))}
          </div>
        </Section>
      )}
      {(offre.valeurs?.length ?? 0) > 0 && (
        <Section title="Nos valeurs">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {offre.valeurs!.map(v => (
              <span key={v} style={{ fontSize: 13, fontWeight: 600, backgroundColor: `${C.vert}10`, color: C.vert, border: `1px solid ${C.vert}20`, padding: '5px 14px', borderRadius: 20 }}>
                {v}
              </span>
            ))}
          </div>
        </Section>
      )}
      {(offre.avantages?.length ?? 0) > 0 && (
        <Section title="Avantages">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {offre.avantages!.map(a => (
              <span key={a} style={{ fontSize: 13, fontWeight: 500, backgroundColor: `${C.terracotta}0A`, color: C.terracotta, border: `1px solid ${C.terracotta}20`, padding: '5px 14px', borderRadius: 20 }}>
                {a}
              </span>
            ))}
          </div>
        </Section>
      )}
      <div style={{
        backgroundColor: C.white, borderRadius: 20, border: `1px solid ${C.sable}`,
        padding: '28px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 20, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 600, color: C.dark, marginBottom: 5 }}>
            Ce poste vous intéresse ?
          </div>
          <div style={{ fontSize: 13, color: C.grey }}>
            {isConnected
              ? 'Postulez en un clic — votre profil sera transmis au recruteur.'
              : 'Connectez-vous pour postuler rapidement avec votre profil Kavio.'}
          </div>
        </div>
        <PageApplyButton applied={applied} appliedDate={appliedDate} applying={applying} onApply={onApply} isConnected={isConnected} />
      </div>
    </div>
  )

  return (
    <>
      <div style={{ backgroundColor: C.white, borderBottom: `1px solid ${C.sable}`, padding: '28px 40px 32px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 13, color: C.grey, background: 'none', border: 'none',
                cursor: 'pointer', padding: 0, marginBottom: 22, fontFamily: 'inherit',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Retour aux offres
            </button>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(22px, 3vw, 30px)', color: C.dark, margin: '0 0 14px', lineHeight: 1.2, fontWeight: 700 }}>
                {offre.titre}
              </h1>
              {/* Bloc identité entreprise */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <EntrepriseLogo nom={entreprise} logoUrl={offre.entreprise_logo_url} size={42} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.dark, lineHeight: 1.2 }}>
                    {entreprise}
                  </div>
                  <div style={{ fontSize: 13, color: C.grey, marginTop: 3 }}>
                    {[offre.ville, offre.mode_travail].filter(Boolean).join(' · ')}
                    <span style={{ marginLeft: 12, fontSize: 12, color: C.lightGrey }}>
                      Publié {daysSince(offre.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
              <button
                onClick={onToggleSave}
                title={saved ? 'Retirer des favoris' : 'Sauvegarder'}
                style={{
                  width: 44, height: 44,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 12,
                  border: `1px solid ${saved ? '#F59E0B50' : C.sable}`,
                  backgroundColor: saved ? '#FEF3C720' : C.white,
                  cursor: 'pointer', fontSize: 22, transition: 'all 0.15s',
                }}
              >
                {saved ? '★' : '☆'}
              </button>
              <PageApplyButton applied={applied} appliedDate={appliedDate} applying={applying} onApply={onApply} isConnected={isConnected} />
            </div>
          </div>

          {badges(16)}
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 40px 80px' }}>
        {bodySections}
      </div>
    </>
  )
}
