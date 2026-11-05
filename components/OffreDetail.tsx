'use client'

import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FONT_SERIF } from '@/lib/typography'
import { C as _C, CARD_SHADOW, CARD_RADIUS } from '@/lib/colors'
import { type ScoreBreakdown } from '@/lib/matching'
import { PILL, PILL_SALARY } from '@/components/OffreCard'
import { EntrepriseLogo } from '@/components/EntrepriseLogo'
import { TELETRAVAIL_OPTIONS, DUREES_CONTRAT, TEMPS_TRAVAIL, HORAIRES, PERMIS, labelDe, normaliserDebut } from '@/lib/referentiels'
import { LANGUES } from '@/lib/langues'
export { EntrepriseLogo } from '@/components/EntrepriseLogo'

const C = { ..._C, lightGrey: '#D0D0D0' as const }


export type OffreData = {
  id: string
  titre: string
  recruteur_id?: string
  entreprise_nom?: string
  entreprise_logo_url?: string
  type_contrat?: string
  domaine?: string
  experience?: string
  salaire_min?: number
  salaire_max?: number
  periode_salaire?: string
  mode_travail?: string
  jours_remote?: number
  deplacements?: string
  ville?: string
  description?: string
  missions?: string[]
  profil_recherche?: string
  competences?: string[]
  competences_bonus?: string[]
  valeurs?: string[]
  avantages?: string[]
  process_recrutement?: string[]
  langues?: string[]
  duree_contrat?: string
  date_debut?: string
  temps_travail?: string | null
  horaires?: string[]
  permis?: string[]
  statut_cadre?: boolean
  logement_fourni?: boolean
  repas_fournis?: boolean
  ouvert_handicap?: boolean
  published_at?: string | null
  created_at: string
  latitude?: number
  longitude?: number
}

export type OffreSimilaire = {
  id: string
  titre: string
  entreprise_nom?: string
  type_contrat?: string
  domaine?: string
  ville?: string
  salaire_min?: number
  salaire_max?: number
  periode_salaire?: string
  mode_travail?: string
}

type Props = {
  offre: OffreData
  applied: boolean
  appliedDate?: string | null
  applying: boolean
  saved: boolean
  isConnected: boolean
  similaires?: OffreSimilaire[]
  similairesTitle?: string
  onApply: () => void
  onToggleSave: () => void
  onSelectSimilaire?: (id: string) => void
  mode?: 'page' | 'panel'
  onBack?: () => void
  score?: number | null
  breakdown?: ScoreBreakdown | null
  removeAction?: () => void
  /**
   * Quand fourni, remplace la zone d'actions candidat dans le header
   * (Postuler, Favoris, Decouvrir l'entreprise) ET supprime le bloc CTA
   * du bas de page ("Ce poste vous interesse ?").
   * N'a d'effet qu'en mode page.
   */
  actionsRecruteur?: React.ReactNode
  /** Préfixe ajouté aux liens /entreprise/[id] — passer '/recruteur' en vue recruteur. */
  entrepriseLinkPrefix?: string
}

// ─── SimilaireCard ───────────────────────────────────────────────────────────

function SimilaireCard({ s, onSelect, compact = false }: { s: OffreSimilaire; onSelect?: (id: string) => void; compact?: boolean }) {
  const sal = (s.salaire_min || s.salaire_max)
    ? ((s.salaire_min && s.salaire_max)
        ? `${Math.round(s.salaire_min / 1000)}–${Math.round(s.salaire_max / 1000)}k`
        : `${Math.round(((s.salaire_min || s.salaire_max) as number) / 1000)}k`)
      + (s.periode_salaire === 'mensuel' ? '/mois' : '/an')
    : null

  const inner = (
    <div style={{ padding: compact ? '10px 12px' : '12px 14px' }}>
      <div style={{ fontSize: compact ? 12 : 13, fontWeight: 600, color: C.dark, lineHeight: 1.3, marginBottom: 3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
        {s.titre}
      </div>
      <div style={{ fontSize: 11, color: C.grey, marginBottom: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {[s.entreprise_nom, s.ville].filter(Boolean).join(' · ')}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {s.type_contrat && (
          <span style={{ ...PILL, fontSize: 10, padding: '2px 7px' }}>{s.type_contrat}</span>
        )}
        {sal && (
          <span style={{ ...PILL_SALARY, fontSize: 10, padding: '2px 7px' }}>{sal}</span>
        )}
      </div>
    </div>
  )

  const baseStyle: React.CSSProperties = compact ? {
    display: 'block', borderRadius: CARD_RADIUS,
    border: `1px solid ${C.sable}`, backgroundColor: C.white,
    cursor: 'pointer', textDecoration: 'none',
    transition: 'border-color 0.15s',
  } : {
    display: 'block', borderRadius: CARD_RADIUS,
    backgroundColor: C.white, boxShadow: CARD_SHADOW,
    cursor: 'pointer', textDecoration: 'none',
    transition: 'box-shadow 0.15s',
  }

  if (onSelect) {
    return <div style={baseStyle} onClick={() => onSelect(s.id)}>{inner}</div>
  }
  return <Link href={`/offres/${s.id}`} style={baseStyle}>{inner}</Link>
}


// ─── Apply button helpers ─────────────────────────────────────────────────────

function formatAppliedLabel(iso: string): string {
  const d = new Date(iso)
  if (d.toDateString() === new Date().toDateString()) return "Postulé aujourd'hui"
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

function labelDebut(val: string | null | undefined): string | null {
  if (!val) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const d = new Date(val + 'T00:00:00')
    return isNaN(d.getTime()) ? null : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  const cat = normaliserDebut(val)
  if (cat === 'immediat')   return 'Immédiate'
  if (cat === 'mois')       return 'Dans le mois'
  if (cat === 'trois_mois') return 'Dans les 3 mois'
  return null
}

// ─── Page-mode helpers ────────────────────────────────────────────────────────

function Section({ title, children, first = false }: { title: string; children: React.ReactNode; first?: boolean }) {
  return (
    <div style={{ padding: '28px 32px', borderTop: first ? undefined : `1px solid ${C.sable}` }}>
      <h2 style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 18, color: C.dark, margin: '0 0 18px', fontWeight: 600 }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function PageApplyButton({ applied, appliedDate, applying, onApply, isConnected }: {
  applied: boolean; appliedDate?: string | null; applying: boolean; onApply: () => void; isConnected: boolean
}) {
  const checkRef = useRef<SVGPathElement>(null)

  useLayoutEffect(() => {
    if (!applied || !checkRef.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    checkRef.current.animate(
      [{ strokeDashoffset: '16' }, { strokeDashoffset: '0' }],
      { duration: 350, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
    )
  }, [applied])

  if (applied) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        backgroundColor: `${C.vert}10`, color: C.vert,
        border: `1px solid ${C.vert}30`, padding: '11px 22px',
        borderRadius: 12, fontSize: 14, fontWeight: 600,
      }}>
        <svg width="14" height="12" viewBox="0 0 12 10" fill="none">
          <path ref={checkRef} d="M1 5L4 8L11 1" stroke={C.vert} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="16" />
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
          <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: C.white, animation: 'kapolia-spin 0.7s linear infinite' }} />
          Envoi…
        </>
      ) : isConnected ? 'Postuler' : 'Se connecter pour postuler'}
    </button>
  )
}

// ─── Panel-mode helpers ───────────────────────────────────────────────────────

function PanelSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 14, fontWeight: 600, color: C.dark, marginBottom: 12 }}>
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
  const checkRef = useRef<SVGPathElement>(null)

  useLayoutEffect(() => {
    if (!applied || !checkRef.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    checkRef.current.animate(
      [{ strokeDashoffset: '16' }, { strokeDashoffset: '0' }],
      { duration: 350, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
    )
  }, [applied])

  if (applied) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        backgroundColor: `${C.vert}10`, color: C.vert,
        border: `1px solid ${C.vert}30`, padding: '9px 16px',
        borderRadius: 10, fontSize: 13, fontWeight: 600,
      }}>
        <svg width="11" height="9" viewBox="0 0 12 10" fill="none">
          <path ref={checkRef} d="M1 5L4 8L11 1" stroke={C.vert} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="16" />
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
          <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: C.white, animation: 'kapolia-spin 0.7s linear infinite' }} />
          Envoi…
        </>
      ) : isConnected ? 'Postuler en 1 clic' : 'Se connecter pour postuler'}
    </button>
  )
}



// ─── Guest CTA ────────────────────────────────────────────────────────────────

function GuestCTA({ offreId }: { offreId: string }) {
  const router = useRouter()
  const next   = encodeURIComponent('/offres/' + offreId)

  function goToInscription() {
    try {
      localStorage.setItem('kapolia_post_signup_next', JSON.stringify({
        url: '/offres/' + offreId,
        ts: Date.now(),
      }))
    } catch {}
    router.push('/inscription?next=' + next)
  }

  return (
    <div style={{
      backgroundColor: C.chip,
      border: `1px solid `,
      borderRadius: 16,
      padding: '28px 32px',
      marginTop: 40,
    }}>
      <p style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 18, color: C.dark, margin: '0 0 8px', fontWeight: 600 }}>
        Vous souhaitez postuler ?
      </p>
      <p style={{ fontSize: 14, color: C.grey, margin: '0 0 20px', lineHeight: 1.65 }}>
        Créez votre profil candidat en quelques minutes et postulez à cette offre en un clic.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          onClick={goToInscription}
          style={{
            backgroundColor: C.terracotta, color: C.white,
            border: 'none', borderRadius: 10, padding: '11px 22px',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Créer un compte
        </button>
        <button
          onClick={() => router.push('/connexion?next=' + next)}
          style={{
            backgroundColor: 'transparent', color: C.dark,
            border: `1px solid ${C.sable}`, borderRadius: 10, padding: '11px 22px',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Se connecter
        </button>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OffreDetail({
  offre, applied, appliedDate, applying, saved, isConnected,
  similaires, similairesTitle, onApply, onToggleSave, onSelectSimilaire, mode = 'page', onBack, score, breakdown: _breakdown, removeAction, actionsRecruteur,
  entrepriseLinkPrefix = '',
}: Props) {
  const [copied, setCopied] = useState(false)

  const saveRef       = useRef<SVGPolygonElement>(null)
  const prevSavedRef  = useRef(false)
  const shareCheckRef = useRef<SVGPathElement>(null)

  useEffect(() => {
    if (saved && !prevSavedRef.current && saveRef.current) {
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        saveRef.current.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(0.6)' }, { transform: 'scale(1.2)' }, { transform: 'scale(1)' }],
          { duration: 380, easing: 'ease-out' }
        )
      }
    }
    prevSavedRef.current = saved
  }, [saved])

  useLayoutEffect(() => {
    if (!copied || !shareCheckRef.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    shareCheckRef.current.animate(
      [{ strokeDashoffset: '16' }, { strokeDashoffset: '0' }],
      { duration: 350, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', delay: 80 }
    )
  }, [copied])

  const salaire    = formatSalaire(offre.salaire_min, offre.salaire_max, offre.periode_salaire)
  const entreprise = offre.entreprise_nom || 'Entreprise'
  const teleLabel  = offre.mode_travail ? (TELETRAVAIL_OPTIONS.find(o => o.value === offre.mode_travail)?.labelLong ?? offre.mode_travail) : undefined
  const dureeLabel = offre.duree_contrat ? labelDe(DUREES_CONTRAT, offre.duree_contrat) : null
  const horairesLabel = (() => {
    const parts: string[] = []
    if (offre.temps_travail) { const l = labelDe(TEMPS_TRAVAIL, offre.temps_travail); if (l) parts.push(l) }
    for (const h of (offre.horaires ?? [])) { const l = labelDe(HORAIRES, h); if (l) parts.push(l) }
    return parts.length > 0 ? parts.join(', ') : null
  })()
  const languesNoms  = (offre.langues ?? []).map(c => LANGUES.find(l => l.code === c)?.nom).filter(Boolean) as string[]
  const permisLabels = (offre.permis ?? []).map(p => labelDe(PERMIS, p)).filter(Boolean) as string[]
  const permisValue  = permisLabels.length > 0
    ? permisLabels.join(', ')
    : (offre.permis != null && (offre.published_at ?? '') > '2026-11-05T00:11:00Z' ? 'Aucun permis requis' : null)
  const debutLabel   = labelDebut(offre.date_debut)
  const infosPills: string[] = [
    ...(offre.statut_cadre    ? ['Statut cadre'] : []),
    ...(offre.logement_fourni ? ['Logement fourni'] : []),
    ...(offre.repas_fournis   ? ['Repas fournis'] : []),
    ...(offre.ouvert_handicap ? ['Poste ouvert aux personnes en situation de handicap'] : []),
  ]

  function handleShare() {
    const url = `${window.location.origin}/offres/${offre.id}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Panel mode ─────────────────────────────────────────────────────────────

  if (mode === 'panel') {
    const modeTravailLabel = teleLabel
      ? teleLabel + (offre.mode_travail === 'Hybride' && offre.jours_remote ? ` · ${offre.jours_remote}j télétravail/sem` : '')
      : undefined

    const details: { label: string; value: string }[] = [
      ...(offre.type_contrat   ? [{ label: 'Contrat',              value: offre.type_contrat }]              : []),
      ...(dureeLabel           ? [{ label: 'Durée du contrat',     value: dureeLabel }]                      : []),
      ...(horairesLabel        ? [{ label: 'Horaires de travail',  value: horairesLabel }]                   : []),
      ...(offre.experience     ? [{ label: 'Expérience',           value: offre.experience }]                : []),
      ...(modeTravailLabel     ? [{ label: 'Télétravail',          value: modeTravailLabel }]                : []),
      ...(offre.deplacements   ? [{ label: 'Déplacements',         value: offre.deplacements }]              : []),
      ...(debutLabel           ? [{ label: 'Prise de poste',       value: debutLabel }]                      : []),
      ...(languesNoms.length > 0 ? [{ label: 'Langues demandées',  value: languesNoms.join(', ') }]          : []),
      ...(permisValue          ? [{ label: 'Permis',               value: permisValue }]                     : []),
    ]

    const hasDetails         = details.length > 0 || infosPills.length > 0
    const hasLieu            = !!offre.ville
    const hasDescription     = !!offre.description
    const hasMissions        = (offre.missions?.filter(m => m.trim()).length ?? 0) > 0
    const hasProfilRecherche = !!offre.profil_recherche
    const hasCompetences     = (offre.competences?.length ?? 0) > 0 || (offre.competences_bonus?.length ?? 0) > 0
    const hasAvantages       = (offre.avantages?.length ?? 0) > 0
    const hasProcess         = (offre.process_recrutement?.filter(p => p.trim()).length ?? 0) > 0

    const sections = [hasDetails, hasLieu, hasDescription, hasMissions, hasProfilRecherche, hasCompetences, hasAvantages, hasProcess]
    const lastIdx  = sections.lastIndexOf(true)
    let sIdx = 0

    return (
      <div style={{
        backgroundColor: C.white,
        borderRadius: 16,
        border: `1px solid ${C.sable}`,
        boxShadow: '0 4px 20px rgba(36, 69, 58,0.08)',
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
          overflow: 'hidden',
        }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
            <h2 style={{
              fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 22, fontWeight: 600,
              color: C.dark, margin: 0, lineHeight: 1.2, flex: 1,
            }}>
              {offre.titre}
            </h2>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0, paddingTop: 3 }}>
              <button
                onClick={onToggleSave}
                title={saved ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: `1px solid ${C.sable}`, backgroundColor: 'transparent', cursor: 'pointer', flexShrink: 0 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill={saved ? C.orange : 'none'} stroke={saved ? C.orange : C.grey} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon ref={saveRef} points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
              <button
                onClick={handleShare}
                title="Partager cette offre"
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: `1px solid ${copied ? `${C.vert}40` : C.sable}`, backgroundColor: copied ? `${C.vert}08` : 'transparent', cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s' }}
              >
                <div style={{ position: 'relative', width: 14, height: 14 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.grey} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ position: 'absolute', top: 0, left: 0, opacity: copied ? 0 : 1, transform: copied ? 'scale(0.5)' : 'scale(1)', transition: 'opacity 250ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                  </svg>
                  <svg width="12" height="10" viewBox="0 0 12 10" fill="none"
                    style={{ position: 'absolute', top: 2, left: 1, opacity: copied ? 1 : 0, transform: copied ? 'scale(1)' : 'scale(0.5)', transition: 'opacity 250ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
                    <path ref={shareCheckRef} d="M1 5L4 8L11 1" stroke={C.vert} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="16" />
                  </svg>
                </div>
              </button>
            </div>
          </div>

          {/* Bloc identité entreprise */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <EntrepriseLogo nom={entreprise} logoUrl={offre.entreprise_logo_url} size={44} />
            <div>
              {offre.recruteur_id ? (
                <Link
                  href={`${entrepriseLinkPrefix}/entreprise/${offre.recruteur_id}`}
                  style={{ fontSize: 15, fontWeight: 700, color: C.terracotta, lineHeight: 1.2, textDecoration: 'none', display: 'block' }}
                >
                  {entreprise}
                </Link>
              ) : (
                <div style={{ fontSize: 15, fontWeight: 700, color: C.dark, lineHeight: 1.2 }}>
                  {entreprise}
                </div>
              )}
              <div style={{ fontSize: 12, color: C.grey, marginTop: 3 }}>
                {[offre.ville, modeTravailLabel].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>

          {/* Pills */}
          {(salaire || offre.type_contrat || offre.experience) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {salaire           && <span style={PILL_SALARY}>{salaire}</span>}
              {offre.type_contrat && <span style={PILL}>{offre.type_contrat}</span>}
              {offre.experience  && <span style={PILL}>{offre.experience}</span>}
            </div>
          )}

          {/* Action row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <PanelApplyButton applied={applied} appliedDate={appliedDate} applying={applying} onApply={onApply} isConnected={isConnected} />

            {offre.recruteur_id && (
              <Link
                href={`${entrepriseLinkPrefix}/entreprise/${offre.recruteur_id}`}
                style={{
                  height: 36, padding: '0 12px',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  borderRadius: 10,
                  border: `1px solid ${C.terracotta}50`,
                  backgroundColor: `${C.terracotta}07`,
                  color: C.terracotta,
                  fontSize: 12, fontWeight: 600,
                  textDecoration: 'none', fontFamily: 'inherit',
                  whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s',
                }}
              >
                Découvrir l'entreprise
              </Link>
            )}

            <Link
              href={`/offres/${offre.id}`}
              onClick={() => sessionStorage.setItem('kapolia-offre-return', offre.id)}
              style={{
                height: 36, padding: '0 12px',
                display: 'inline-flex', alignItems: 'center', gap: 5,
                borderRadius: 10,
                border: `1px solid ${C.vert}50`,
                backgroundColor: `${C.vert}07`,
                color: C.vert,
                fontSize: 12, fontWeight: 600,
                textDecoration: 'none', fontFamily: 'inherit',
                whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s',
              }}
            >
              Ouvrir dans une page
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
              </svg>
            </Link>

            {removeAction && (
              <button
                onClick={removeAction}
                title="Supprimer de mon suivi"
                style={{
                  height: 36, width: 36,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 10,
                  border: `1px solid ${C.sable}`,
                  backgroundColor: C.white,
                  color: C.lightGrey,
                  cursor: 'pointer', flexShrink: 0,
                  transition: 'color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = C.grey; e.currentTarget.style.borderColor = C.grey }}
                onMouseLeave={e => { e.currentTarget.style.color = C.lightGrey; e.currentTarget.style.borderColor = C.sable }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                </svg>
              </button>
            )}
          </div>

        </div>

        {/* Body scrollable */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

            {/* Détails du poste */}
            {hasDetails && (
              <PanelSection title="Détails du poste" last={lastIdx === sIdx++}>
                {details.length > 0 && (
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
                )}
                {infosPills.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: details.length > 0 ? 14 : 0 }}>
                    {infosPills.map(label => (
                      <span key={label} style={PILL}>{label}</span>
                    ))}
                  </div>
                )}
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

            {/* Description */}
            {hasDescription && (
              <PanelSection title="Description du poste" last={lastIdx === sIdx++}>
                <p style={{ fontSize: 14, color: C.grey, margin: 0, lineHeight: 2.0, whiteSpace: 'pre-wrap' }}>
                  {offre.description}
                </p>
              </PanelSection>
            )}

            {/* Missions */}
            {hasMissions && (
              <PanelSection title="Missions principales" last={lastIdx === sIdx++}>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {offre.missions!.filter(m => m.trim()).map((m, i) => (
                    <li key={i} style={{ fontSize: 14, color: C.dark, lineHeight: 1.6 }}>{m}</li>
                  ))}
                </ul>
              </PanelSection>
            )}

            {/* Profil recherché */}
            {hasProfilRecherche && (
              <PanelSection title="Profil recherché" last={lastIdx === sIdx++}>
                <p style={{ fontSize: 14, color: C.grey, margin: 0, lineHeight: 2.0, whiteSpace: 'pre-wrap' }}>
                  {offre.profil_recherche}
                </p>
              </PanelSection>
            )}

            {/* Compétences */}
            {hasCompetences && (
              <PanelSection title="Compétences" last={lastIdx === sIdx++}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {(offre.competences ?? []).map(s => (
                    <span key={s} style={{ fontSize: 13, fontWeight: 500, backgroundColor: C.bg, border: `1px solid ${C.sable}`, color: C.dark, padding: '4px 12px', borderRadius: 8 }}>
                      {s}
                    </span>
                  ))}
                  {(offre.competences_bonus ?? []).map(s => (
                    <span key={s} style={{ fontSize: 13, fontWeight: 400, backgroundColor: C.white, border: `1px dashed ${C.sable}`, color: C.grey, padding: '4px 12px', borderRadius: 8 }}>
                      {s} <span style={{ fontSize: 12, color: C.grey }}>appréciée</span>
                    </span>
                  ))}
                </div>
              </PanelSection>
            )}

            {/* Avantages */}
            {hasAvantages && (
              <PanelSection title="Avantages" last={lastIdx === sIdx++}>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {offre.avantages!.map(a => (
                    <li key={a} style={{ fontSize: 14, color: C.dark, lineHeight: 1.5 }}>{a}</li>
                  ))}
                </ul>
              </PanelSection>
            )}

            {/* Processus de recrutement */}
            {hasProcess && (
              <PanelSection title="Processus de recrutement" last={lastIdx === sIdx++}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {offre.process_recrutement!.filter(p => p.trim()).map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: C.terracotta, color: C.white, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <span style={{ fontSize: 14, color: C.dark }}>{p}</span>
                    </div>
                  ))}
                </div>
              </PanelSection>
            )}

          {/* Offres similaires */}
          {similaires && similaires.length > 0 && (
            <div style={{ padding: '20px 28px', borderTop: `1px solid ${C.sable}` }}>
              <div style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 14, fontWeight: 600, color: C.dark, marginBottom: 12 }}>
                {similairesTitle ?? 'Offres similaires'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {similaires.map(s => <SimilaireCard key={s.id} s={s} onSelect={onSelectSimilaire} compact />)}
              </div>
            </div>
          )}

          {/* Published date */}
          <div style={{ textAlign: 'center', padding: '16px 0 28px', fontSize: 12, color: C.grey }}>
            Publié {daysSince(offre.created_at)}
          </div>
        </div>
      </div>
    )
  }

  // ── Page mode ──────────────────────────────────────────────────────────────

  const pageModeLabel = teleLabel
    ? teleLabel + (offre.mode_travail === 'Hybride' && offre.jours_remote ? ` · ${offre.jours_remote}j/sem` : '')
    : undefined

  const badges = (mt: number) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: mt }}>
      {offre.type_contrat && <span style={PILL}>{offre.type_contrat}</span>}
      {offre.domaine      && <span style={PILL}>{offre.domaine}</span>}
      {pageModeLabel      && <span style={PILL}>{pageModeLabel}</span>}
      {offre.experience   && <span style={PILL}>{offre.experience}</span>}
      {salaire            && <span style={PILL_SALARY}>{salaire}</span>}
    </div>
  )

  const validMissions = offre.missions?.filter(m => m.trim()) ?? []
  const validProcess  = offre.process_recrutement?.filter(p => p.trim()) ?? []

  const pageDetails: { label: string; value: string }[] = [
    ...(offre.type_contrat   ? [{ label: 'Contrat',              value: offre.type_contrat }]              : []),
    ...(dureeLabel           ? [{ label: 'Durée du contrat',     value: dureeLabel }]                      : []),
    ...(horairesLabel        ? [{ label: 'Horaires de travail',  value: horairesLabel }]                   : []),
    ...(offre.experience     ? [{ label: 'Expérience',           value: offre.experience }]                : []),
    ...(pageModeLabel        ? [{ label: 'Télétravail',          value: pageModeLabel }]                   : []),
    ...(offre.deplacements   ? [{ label: 'Déplacements',         value: offre.deplacements }]              : []),
    ...(offre.ville          ? [{ label: 'Lieu',                 value: offre.ville }]                     : []),
    ...(debutLabel           ? [{ label: 'Prise de poste',       value: debutLabel }]                      : []),
    ...(languesNoms.length > 0 ? [{ label: 'Langues demandées',  value: languesNoms.join(', ') }]          : []),
    ...(permisValue          ? [{ label: 'Permis',               value: permisValue }]                     : []),
  ]

  const sectionEls: React.ReactNode[] = []
  if (pageDetails.length > 0 || infosPills.length > 0) sectionEls.push(
    <Section key="details" title="Détails du poste" first={sectionEls.length === 0}>
      {pageDetails.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px 24px' }}>
          {pageDetails.map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 12, color: C.grey, fontWeight: 500, marginBottom: 3 }}>
                {label}
              </div>
              <div style={{ fontSize: 14, color: C.dark, fontWeight: 500 }}>{value}</div>
            </div>
          ))}
        </div>
      )}
      {infosPills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: pageDetails.length > 0 ? 16 : 0 }}>
          {infosPills.map(label => (
            <span key={label} style={PILL}>{label}</span>
          ))}
        </div>
      )}
    </Section>
  )
  if (offre.description) sectionEls.push(
    <Section key="desc" title="Description du poste" first={sectionEls.length === 0}>
      <p style={{ fontSize: 14, color: C.grey, margin: 0, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
        {offre.description}
      </p>
    </Section>
  )
  if (validMissions.length > 0) sectionEls.push(
    <Section key="missions" title="Missions principales" first={sectionEls.length === 0}>
      <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {validMissions.map((m, i) => (
          <li key={i} style={{ fontSize: 14, color: C.dark, lineHeight: 1.65 }}>{m}</li>
        ))}
      </ul>
    </Section>
  )
  if (offre.profil_recherche) sectionEls.push(
    <Section key="profil" title="Profil recherché" first={sectionEls.length === 0}>
      <p style={{ fontSize: 14, color: C.grey, margin: 0, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
        {offre.profil_recherche}
      </p>
    </Section>
  )
  if ((offre.competences?.length ?? 0) > 0 || (offre.competences_bonus?.length ?? 0) > 0) sectionEls.push(
    <Section key="competences" title="Compétences" first={sectionEls.length === 0}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {(offre.competences ?? []).map(s => (
          <span key={s} style={{ fontSize: 13, fontWeight: 500, backgroundColor: C.bg, border: `1px solid ${C.sable}`, color: C.dark, padding: '5px 14px', borderRadius: 8 }}>
            {s}
          </span>
        ))}
        {(offre.competences_bonus ?? []).map(s => (
          <span key={s} style={{ fontSize: 13, fontWeight: 400, backgroundColor: C.white, border: `1.5px dashed ${C.sable}`, color: C.grey, padding: '5px 14px', borderRadius: 8 }}>
            {s} <span style={{ fontSize: 12, color: C.grey }}>appréciée</span>
          </span>
        ))}
      </div>
    </Section>
  )
  if ((offre.avantages?.length ?? 0) > 0) sectionEls.push(
    <Section key="avantages" title="Avantages" first={sectionEls.length === 0}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {offre.avantages!.map(a => (
          <span key={a} style={{ fontSize: 13, fontWeight: 500, backgroundColor: `${C.terracotta}0A`, color: C.terracotta, border: `1px solid ${C.terracotta}20`, padding: '5px 14px', borderRadius: 20 }}>
            {a}
          </span>
        ))}
      </div>
    </Section>
  )
  if (validProcess.length > 0) sectionEls.push(
    <Section key="process" title="Processus de recrutement" first={sectionEls.length === 0}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {validProcess.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', backgroundColor: C.terracotta, color: C.white, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {i + 1}
            </div>
            <span style={{ fontSize: 14, color: C.dark }}>{p}</span>
          </div>
        ))}
      </div>
    </Section>
  )

  const bodySections = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {sectionEls.length > 0 && (
        <div style={{ backgroundColor: C.white, borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
          {sectionEls}
        </div>
      )}
      {!actionsRecruteur && (
        <div style={{
          backgroundColor: C.white, borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW,
          padding: '28px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 20, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 17, fontWeight: 600, color: C.dark, marginBottom: 5 }}>
              Ce poste vous intéresse ?
            </div>
            <div style={{ fontSize: 13, color: C.grey }}>
              {isConnected
                ? 'Postulez en un clic. Votre profil sera transmis au recruteur.'
                : 'Connectez-vous pour postuler rapidement avec votre profil Kapolia.'}
            </div>
          </div>
          <PageApplyButton applied={applied} appliedDate={appliedDate} applying={applying} onApply={onApply} isConnected={isConnected} />
        </div>
      )}
    </div>
  )

  return (
    <>
      <div style={{ backgroundColor: C.white, borderBottom: `1px solid ${C.sable}`, padding: '28px 40px 0', overflow: 'hidden' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', paddingBottom: 32 }}>
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
              Retour
            </button>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14 }}>
                <h1 style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 'clamp(22px, 3vw, 30px)', color: C.dark, margin: 0, lineHeight: 1.2, fontWeight: 600, flex: 1 }}>
                  {offre.titre}
                </h1>
                {actionsRecruteur == null && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, paddingTop: 4 }}>
                    <button
                      onClick={onToggleSave}
                      title={saved ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                      style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: `1px solid ${C.sable}`, backgroundColor: 'transparent', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill={saved ? C.orange : 'none'} stroke={saved ? C.orange : C.grey} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon ref={saveRef} points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>
                    <button
                      onClick={handleShare}
                      title="Partager cette offre"
                      style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: `1px solid ${copied ? `${C.vert}40` : C.sable}`, backgroundColor: copied ? `${C.vert}08` : 'transparent', cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s' }}
                    >
                      <div style={{ position: 'relative', width: 14, height: 14 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.grey} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          style={{ position: 'absolute', top: 0, left: 0, opacity: copied ? 0 : 1, transform: copied ? 'scale(0.5)' : 'scale(1)', transition: 'opacity 250ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
                          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                        </svg>
                        <svg width="12" height="10" viewBox="0 0 12 10" fill="none"
                          style={{ position: 'absolute', top: 2, left: 1, opacity: copied ? 1 : 0, transform: copied ? 'scale(1)' : 'scale(0.5)', transition: 'opacity 250ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
                          <path ref={shareCheckRef} d="M1 5L4 8L11 1" stroke={C.vert} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="16" />
                        </svg>
                      </div>
                    </button>
                  </div>
                )}
              </div>
              {/* Bloc identité entreprise */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <EntrepriseLogo nom={entreprise} logoUrl={offre.entreprise_logo_url} size={42} />
                <div>
                  {offre.recruteur_id ? (
                    <Link
                      href={`${entrepriseLinkPrefix}/entreprise/${offre.recruteur_id}`}
                      style={{ fontSize: 16, fontWeight: 700, color: C.terracotta, lineHeight: 1.2, textDecoration: 'none', display: 'block' }}
                    >
                      {entreprise}
                    </Link>
                  ) : (
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.dark, lineHeight: 1.2 }}>
                      {entreprise}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: C.grey, marginTop: 3 }}>
                    {[offre.ville, pageModeLabel].filter(Boolean).join(' · ')}
                    <span style={{ marginLeft: 12, fontSize: 12, color: C.grey }}>
                      Publié {daysSince(offre.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {actionsRecruteur != null ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {actionsRecruteur}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {offre.recruteur_id && (
                  <Link
                    href={`${entrepriseLinkPrefix}/entreprise/${offre.recruteur_id}`}
                    style={{
                      height: 44, padding: '0 16px',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      borderRadius: 12,
                      border: `1px solid ${C.terracotta}50`,
                      backgroundColor: `${C.terracotta}07`,
                      color: C.terracotta,
                      fontSize: 13, fontWeight: 600,
                      textDecoration: 'none', fontFamily: 'inherit',
                      whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s',
                    }}
                  >
                    Découvrir l'entreprise
                  </Link>
                )}
                <PageApplyButton applied={applied} appliedDate={appliedDate} applying={applying} onApply={onApply} isConnected={isConnected} />
              </div>
            )}
          </div>

          {badges(16)}

        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 40px 80px' }}>
        {bodySections}
        {!isConnected && <GuestCTA offreId={offre.id} />}
        {similaires && similaires.length > 0 && (
          <div style={{ marginTop: 40, paddingTop: 36, borderTop: `1px solid ${C.sable}` }}>
            <h2 style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 18, color: C.dark, margin: '0 0 20px', fontWeight: 600 }}>
              {similairesTitle ?? 'Offres similaires'}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {similaires.map(s => <SimilaireCard key={s.id} s={s} onSelect={onSelectSimilaire} />)}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
