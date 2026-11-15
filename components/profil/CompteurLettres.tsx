'use client'
import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import { C } from '@/lib/colors'
import { useRessort, RESSORT_SUIVI, RESSORT_POP, RESSORT_POSE } from '@/lib/motion'

export type CompteurRef = { trembler: () => void }

type Props = { longueur: number; max: number }

const R = 9       // rayon du cercle (SVG 18 px)
const PERIM = 2 * Math.PI * R

const CompteurLettres = forwardRef<CompteurRef, Props>(function CompteurLettres({ longueur, max }, ref) {
  const ratio = Math.min(longueur / max, 1)
  const pct   = ratio * 100

  // ── Anneau ────────────────────────────────────────────────────────────────
  const arcAnime  = useRessort(ratio, RESSORT_SUIVI)
  const dash      = arcAnime * PERIM
  const couleurArc = pct >= 100 ? C.erreur : pct >= 80 ? C.attente : C.vert

  // ── Échelle de l'anneau à 100 % ──────────────────────────────────────────
  const [cibleAnneau, setCibleAnneau] = useState(1)
  const echelleAnneau = useRessort(cibleAnneau, RESSORT_POP)
  const prevAt100 = useRef(false)
  useEffect(() => {
    const at100 = pct >= 100
    if (at100 && !prevAt100.current) { setCibleAnneau(1.2); setTimeout(() => setCibleAnneau(1), 0) }
    prevAt100.current = at100
  }, [pct])

  // ── Compteur de caractères restants ──────────────────────────────────────
  const restants = max - longueur
  const affiche  = pct >= 80
  const [cibleOpacite, setCibleOpacite] = useState(affiche ? 1 : 0)
  const [cibleEchelle, setCibleEchelle] = useState(affiche ? 1 : 0.6)
  const opaciteAnime  = useRessort(cibleOpacite, RESSORT_POP)
  const echelleAnime  = useRessort(cibleEchelle, RESSORT_POP)

  useEffect(() => {
    setCibleOpacite(affiche ? 1 : 0)
    setCibleEchelle(affiche ? 1 : 0.6)
  }, [affiche])

  // rebond sur chaque changement de chiffre
  const prevRestants = useRef(restants)
  const [cibleChiffre, setCibleChiffre] = useState(1)
  const echelleChiffre = useRessort(cibleChiffre, RESSORT_POP)
  useEffect(() => {
    if (affiche && restants !== prevRestants.current) {
      setCibleChiffre(1.15)
      setTimeout(() => setCibleChiffre(1), 0)
    }
    prevRestants.current = restants
  }, [restants, affiche])

  // ── Tremblement du champ ──────────────────────────────────────────────────
  const [cibleX, setCibleX] = useState(0)
  const translateX = useRessort(cibleX, RESSORT_POSE)
  useImperativeHandle(ref, () => ({
    trembler() { setCibleX(6); setTimeout(() => setCibleX(0), 0) }
  }))

  // ── Aria-live ─────────────────────────────────────────────────────────────
  const [ariaMsg, setAriaMsg] = useState('')
  const prevPct = useRef(pct)
  useEffect(() => {
    const prev = prevPct.current
    prevPct.current = pct
    if (pct >= 100 && prev < 100) { setAriaMsg('Limite atteinte'); return }
    if (pct >= 90 && prev < 90)   { setAriaMsg(`${restants} caractères restants`); return }
    if (pct >= 80 && prev < 80)   { setAriaMsg(`${restants} caractères restants`) }
  }, [pct, restants])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, transform: `translateX(${translateX}px)` }}>
      {/* Texte restant */}
      <div style={{ transform: `scale(${echelleAnime * echelleChiffre})`, opacity: opaciteAnime, transformOrigin: 'right center', fontSize: 13, fontWeight: 600, color: couleurArc, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        {pct >= 100 ? 'Limite atteinte' : restants}
      </div>

      {/* Anneau SVG */}
      <svg width="18" height="18" viewBox="0 0 18 18" style={{ transform: `scale(${echelleAnneau})`, flexShrink: 0 }} aria-hidden="true">
        {/* fond */}
        <circle cx="9" cy="9" r={R} fill="none" stroke={C.sable} strokeWidth="2" />
        {/* arc */}
        <circle
          cx="9" cy="9" r={R}
          fill="none"
          stroke={couleurArc}
          strokeWidth="2"
          strokeDasharray={`${dash} ${PERIM}`}
          strokeDashoffset={PERIM / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke 0.2s' }}
        />
      </svg>

      {/* Annonce screen reader */}
      <span aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
        {ariaMsg}
      </span>
    </div>
  )
})

export default CompteurLettres
