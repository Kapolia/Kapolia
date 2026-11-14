'use client'

import { useState, useRef } from 'react'
import { type ReactNode } from 'react'
import { C, CARD_SHADOW, CARD_RADIUS } from '@/lib/colors'
import { FONT_SERIF } from '@/lib/typography'
import {
  calculerFrise,
  lireMoisAnnee,
  dureeTexte,
  type PosteParcours,
  type FormationParcours,
  type DateMois,
} from '@/lib/parcours'

// ─── Types locaux ─────────────────────────────────────────────────────────────

export type ParcoursExp = {
  poste: string
  entreprise: string
  date_debut: string
  date_fin: string
  en_poste: boolean
  missions: string
  debut_annee?: number | null
  debut_mois?: number | null
  fin_annee?: number | null
  fin_mois?: number | null
  date_a_verifier?: boolean | null
}

export type ParcoursDiplome = {
  intitule: string
  ecole: string
  annee: string
  mention?: string
  en_cours?: boolean
  debut_annee?: number | null
  annee_debut?: string | null
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const POSTE_COLORS = ['#2C6E49', '#4A7C6E', '#8B6E4E', '#5E7A5A', '#7A6A50']
const VISI = 4

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initiales(nom: string): string {
  return nom
    .trim()
    .split(/\s+/)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 3)
}

function toPosteParcours(e: ParcoursExp, id: string): PosteParcours | null {
  const debut: DateMois | null =
    e.debut_annee != null
      ? { annee: e.debut_annee, mois: e.debut_mois ?? null }
      : lireMoisAnnee(e.date_debut)
  if (!debut) return null
  if (e.en_poste)
    return { id, poste: e.poste, entreprise: e.entreprise, debut, fin: null, enPoste: true }
  const fin: DateMois | null =
    e.fin_annee != null
      ? { annee: e.fin_annee, mois: e.fin_mois ?? null }
      : lireMoisAnnee(e.date_fin)
  if (!fin) return null
  return { id, poste: e.poste, entreprise: e.entreprise, debut, fin, enPoste: false }
}

function SLabel20({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 20, fontWeight: 600, color: C.dark, marginBottom: 14 }}>
      {children}
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CarteParcoursView({
  experiences,
  diplomes,
}: {
  experiences: ParcoursExp[]
  diplomes: ParcoursDiplome[]
}) {
  const [showAll, setShowAll]       = useState(false)
  const [activeId, setActiveId]     = useState<string | null>(null)
  const cardRef                     = useRef<HTMLDivElement>(null)
  const itemRefs                    = useRef<Record<string, HTMLDivElement | null>>({})

  // ── Préparer les données pour calculerFrise ──────────────────────────────
  const postsForFrise: PosteParcours[] = []
  experiences.forEach((e, i) => {
    const pp = toPosteParcours(e, String(i))
    if (pp) postsForFrise.push(pp)
  })

  const formationsForFrise: FormationParcours[] = []
  diplomes.forEach((d, i) => {
    const finN = d.annee ? parseInt(d.annee, 10) : (d.en_cours ? new Date().getFullYear() : NaN)
    if (isNaN(finN)) return
    const debut: DateMois | null = d.debut_annee != null ? { annee: d.debut_annee, mois: null } : null
    formationsForFrise.push({
      id: `f${i}`,
      intitule: d.intitule,
      debut,
      fin: { annee: finN, mois: null },
      enCours: d.en_cours ?? false,
    })
  })

  const frise   = calculerFrise(postsForFrise, formationsForFrise)
  const nbLines = frise.visible && frise.segments.length > 0
    ? Math.max(...frise.segments.map(s => s.ligne)) + 1
    : 1
  const friseH  = frise.visible ? 30 + (nbLines - 1) * 24 : 0

  // ── Interactions ──────────────────────────────────────────────────────────
  function handleSegClick(segId: string) {
    const idx = parseInt(segId, 10)
    setActiveId(prev => (prev === segId ? null : segId))
    // Si le poste est caché, l'exposer d'abord puis défiler
    if (idx >= VISI && !showAll) setShowAll(true)
    requestAnimationFrame(() => {
      itemRefs.current[segId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  function toggleAll() {
    if (showAll) {
      setShowAll(false)
      const card = cardRef.current
      if (card && card.getBoundingClientRect().top < 0) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    } else {
      setShowAll(true)
    }
  }

  const nbCaches  = Math.max(0, experiences.length - VISI)
  const visibles  = showAll ? experiences : experiences.slice(0, VISI)

  return (
    <div ref={cardRef} style={{ backgroundColor: C.white, borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '20px 22px' }}>
      <style suppressHydrationWarning>{`
        .parcours-frise { display: block; }
        @media (max-width: 768px) { .parcours-frise { display: none; } }
      `}</style>

      <SLabel20>Parcours</SLabel20>

      {/* ── FRISE ── */}
      {frise.visible && (
        <div className="parcours-frise" style={{ marginBottom: 24 }}>

          {/* Ligne postes */}
          <div style={{ position: 'relative', backgroundColor: C.bg, borderRadius: 8, height: friseH }}>

            {/* Bloc resserré : anciens postes hachurés */}
            {frise.resserre && frise.nbAnciens > 0 && (
              <button
                onClick={() => setShowAll(true)}
                title={`Voir les ${frise.nbAnciens} postes plus anciens`}
                style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: 'calc(12% - 3px)',
                  borderRadius: '8px 0 0 8px',
                  border: 'none', cursor: 'pointer',
                  background: 'repeating-linear-gradient(90deg, #B9C4BE 0px, #B9C4BE 1px, #CFD8D3 1px, #CFD8D3 12px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px', overflow: 'hidden', zIndex: 0,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: C.vert, whiteSpace: 'nowrap' }}>
                  {frise.nbAnciens} poste{frise.nbAnciens > 1 ? 's' : ''}
                </span>
              </button>
            )}

            {/* Segments postes */}
            {frise.segments.map(seg => {
              const idx   = parseInt(seg.id, 10)
              const exp   = experiences[idx]
              if (!exp) return null
              const color      = POSTE_COLORS[idx % POSTE_COLORS.length]
              const isActive   = activeId === seg.id
              const hasSince   = seg.depuis !== null
              const bgStyle    = hasSince
                ? `linear-gradient(to right, ${color}54, ${color})`
                : color

              return (
                <button
                  key={seg.id}
                  aria-pressed={isActive}
                  onClick={() => handleSegClick(seg.id)}
                  style={{
                    position: 'absolute',
                    left: `${seg.gauche}%`,
                    width: `max(6px, ${seg.largeur}%)`,
                    top: 4 + seg.ligne * 24,
                    height: 22,
                    minWidth: 6,
                    borderRadius: 5,
                    border: 'none',
                    background: bgStyle,
                    boxShadow: isActive ? `0 0 0 2px ${C.white}, 0 0 0 4px ${C.vert}` : 'none',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 5px',
                    gap: 4,
                    zIndex: isActive ? 2 : 1,
                  }}
                >
                  {seg.libelle !== 'aucun' && (
                    <span style={{ color: 'white', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flex: 1 }}>
                      {seg.libelle === 'complet' ? exp.poste : initiales(exp.entreprise)}
                    </span>
                  )}
                  {seg.libelle === 'complet' && hasSince && (
                    <span style={{ color: 'white', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      depuis {seg.depuis}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Ligne formations */}
          {frise.formations.length > 0 && (
            <div style={{ position: 'relative', height: 22, marginTop: 5 }}>
              {frise.formations.map(seg => {
                const dIdx = parseInt(seg.id.slice(1), 10)
                const d    = diplomes[dIdx]
                if (!d) return null
                const sigle = d.intitule.trim().split(/\s+/).slice(0, 2).join(' ')
                return (
                  <div
                    key={seg.id}
                    style={{
                      position: 'absolute',
                      left: `${seg.gauche}%`,
                      width: `max(6px, ${seg.largeur}%)`,
                      top: 0, bottom: 0,
                      borderRadius: 3,
                      backgroundColor: C.white,
                      border: '1.5px solid #9DB8A9',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 3px',
                    }}
                  >
                    {seg.libelle !== 'aucun' && (
                      <span style={{ color: C.vert, fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sigle}{seg.libelle === 'complet' && d.en_cours ? ' (en cours)' : ''}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Axe avec graduations */}
          <div style={{ position: 'relative', marginTop: frise.formations.length > 0 ? 3 : 2, borderTop: `1px solid ${C.sable}`, height: 18 }}>
            {frise.graduations.map(g => (
              <span
                key={g.annee}
                style={{
                  position: 'absolute',
                  left: `${g.gauche}%`,
                  transform: 'translateX(-50%)',
                  fontSize: 11.5,
                  color: C.grey,
                  top: 2,
                  whiteSpace: 'nowrap',
                  userSelect: 'none' as const,
                }}
              >
                {g.annee}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── LISTE DES POSTES ── */}
      <div>
        {visibles.map((exp, i) => {
          const color      = POSTE_COLORS[i % POSTE_COLORS.length]
          const ini        = initiales(exp.entreprise)
          const isActive   = activeId === String(i)

          const debutMois: DateMois | null =
            exp.debut_annee != null
              ? { annee: exp.debut_annee, mois: exp.debut_mois ?? null }
              : lireMoisAnnee(exp.date_debut)
          const finMois: DateMois | null = exp.en_poste
            ? null
            : exp.fin_annee != null
              ? { annee: exp.fin_annee, mois: exp.fin_mois ?? null }
              : lireMoisAnnee(exp.date_fin)

          const dateAVerifier = !debutMois
          const duree = dateAVerifier ? null : dureeTexte(debutMois!, finMois, exp.en_poste)
          const missions = exp.missions
            ? exp.missions.split('\n').filter(Boolean).slice(0, 2)
            : []

          return (
            <div
              key={i}
              ref={el => { itemRefs.current[String(i)] = el }}
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr auto',
                gap: '0 10px',
                alignItems: 'flex-start',
                padding: '12px 10px',
                borderRadius: 10,
                borderTop: i > 0 ? `1px solid ${C.sable}` : 'none',
                backgroundColor: isActive ? C.bg : 'transparent',
                transition: 'background-color 0.2s',
              }}
            >
              {/* Logo entreprise */}
              <div style={{ width: 40, height: 40, borderRadius: 9, backgroundColor: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>{ini}</span>
              </div>

              {/* Contenu */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.dark }}>{exp.poste}</div>
                <div style={{ fontSize: 13, color: C.grey, marginTop: 1 }}>
                  {exp.entreprise}
                  {!dateAVerifier && debutMois && (
                    <>
                      {' · '}
                      {debutMois.annee}
                      {exp.en_poste
                        ? " à aujourd'hui, en poste"
                        : finMois?.annee ? ` à ${finMois.annee}` : ''}
                    </>
                  )}
                </div>
                {missions.length > 0 && (
                  <ul style={{ margin: '5px 0 0', padding: '0 0 0 15px' }}>
                    {missions.map((m, j) => (
                      <li key={j} style={{ fontSize: 13.5, color: C.dark, lineHeight: 1.55 }}>{m.trim()}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Durée */}
              <div style={{ fontSize: 13, color: C.grey, whiteSpace: 'nowrap', paddingTop: 2, flexShrink: 0 }}>
                {duree ?? ''}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bouton voir plus / masquer */}
      {nbCaches > 0 && (
        <button
          onClick={toggleAll}
          style={{
            width: '100%', marginTop: 8,
            padding: '10px 16px', borderRadius: 10,
            border: '1px dashed #E2C6AE', backgroundColor: 'transparent',
            color: C.orangeTexte, fontSize: 13.5, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {showAll
            ? `Masquer les ${nbCaches} poste${nbCaches > 1 ? 's' : ''} plus ancien${nbCaches > 1 ? 's' : ''}`
            : `Voir les ${nbCaches} poste${nbCaches > 1 ? 's' : ''} plus ancien${nbCaches > 1 ? 's' : ''}`}
        </button>
      )}

      {/* ── FORMATIONS ── */}
      {diplomes.length > 0 && (
        <div style={{ marginTop: 20, paddingTop: experiences.length > 0 ? 16 : 0, borderTop: experiences.length > 0 ? `1px solid ${C.sable}` : 'none' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.dark, marginBottom: 10 }}>Formations</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {diplomes.map((d, i) => {
              const finA = d.annee || ''
              const debA = d.debut_annee ? String(d.debut_annee) : ''
              let dateStr: string
              if (d.en_cours) {
                dateStr = debA ? `${debA} à aujourd'hui` : "aujourd'hui"
              } else if (debA && finA) {
                dateStr = `${debA} à ${finA}`
              } else {
                dateStr = finA
              }

              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, border: '1.5px solid #9DB8A9', backgroundColor: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round">
                      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: C.dark }}>{d.intitule}</div>
                    <div style={{ fontSize: 13, color: C.grey, marginTop: 1 }}>
                      {d.ecole}{d.mention ? ` · ${d.mention}` : ''}
                    </div>
                  </div>
                  {dateStr && (
                    <div style={{ fontSize: 13, color: C.grey, whiteSpace: 'nowrap', paddingTop: 2, flexShrink: 0 }}>
                      {dateStr}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
