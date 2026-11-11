'use client'

import { useState, useEffect, useMemo, useRef, useLayoutEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { FONT_SERIF } from '@/lib/typography'
import { fetchProfilsEntreprise } from '@/lib/enrichir-entreprise'
import { C, CARD_SHADOW, CARD_RADIUS } from '@/lib/colors'
import { largeurUtile } from '@/lib/largeur-utile'
import { EASE, reduitMouvement, fondurPanneau, entrerPanneau } from '@/lib/motion'
import { Bandeau, type BandeauHandle } from '@/components/Bandeau'
import { EntrepriseLogo } from '@/components/EntrepriseLogo'
import { BadgeStatutCandidat } from '@/components/BadgeStatutCandidat'
import { OngletNav } from '@/components/OngletNav'
import { type OffreSimilaire } from '@/components/OffreDetail'
import { trouverSimilaires, type SimOffre } from '@/lib/similaires'
import { accepterCreneau, isRdvPlusPropose } from '@/lib/rdv'

// ─── Types ────────────────────────────────────────────────────────────────────

type OffreResume = {
  id: string
  titre: string
  domaine: string | null
  type_contrat: string | null
  experience: string | null
  ville: string | null
  created_at: string | null
  recruteur_id: string | null
  expire_at: string | null
  description: string | null
  salaire_min: number | null
  salaire_max: number | null
  periode_salaire: string | null
  latitude: number | null
  longitude: number | null
  entreprise_nom?: string
  entreprise_logo_url?: string
}

type Cand = {
  id: string
  offre_id: string
  created_at: string
  statut: string
  offres: OffreResume | null
}

type Conv = {
  id: string
  offre_id: string
  non_lu_candidat: number
  recruteur_id: string
  dernier_message?: string | null
  derniere_activite?: string | null
}

type RecruteurProfil = { prenom?: string | null; nom?: string | null }

type Creneau = { id: string; debut_utc: string; selectionne: boolean }

type Rdv = {
  id: string
  conversation_id: string
  type: 'telephonique' | 'entretien'
  statut: string
  creneaux_rdv: Creneau[]
}

type Tab = 'en_cours' | 'cloturees'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateEnvoi(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return "Envoyée aujourd'hui"
  if (days === 1) return 'Envoyée hier'
  return `Envoyée il y a ${days} jour${days > 1 ? 's' : ''}`
}

function formatDateRdv(utc: string): string {
  const d = new Date(utc)
  const opts: Intl.DateTimeFormatOptions = d.getFullYear() === new Date().getFullYear()
    ? { weekday: 'long', day: 'numeric', month: 'long' }
    : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ')
  return d.toLocaleDateString('fr-FR', opts) + ' à ' + heure
}

function formatDateCourte(iso: string): string {
  const d = new Date(iso)
  const opts: Intl.DateTimeFormatOptions = d.getFullYear() === new Date().getFullYear()
    ? { day: 'numeric', month: 'long' }
    : { day: 'numeric', month: 'long', year: 'numeric' }
  return d.toLocaleDateString('fr-FR', opts)
}

function formatRelativeDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d    = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  return 'le ' + formatDateCourte(iso)
}

function salaireLabel(min?: number | null, max?: number | null, periode?: string | null): string | null {
  if (!min && !max) return null
  const kFmt = (n: number) => n >= 1000 ? `${Math.round(n / 1000)} k€` : `${n} €`
  const range = min && max && min !== max
    ? `${kFmt(min)} – ${kFmt(max)}`
    : min ? `dès ${kFmt(min)}` : `jusqu'à ${kFmt(max!)}`
  const per = periode === 'heure' ? '/h' : periode === 'mois' ? '/mois' : '/an'
  return range + per
}

function premieresPhrase(text: string | null | undefined): string {
  if (!text) return ''
  const plain = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const m = plain.match(/[^.!?\n]+[.!?\n]+/g)
  if (!m) return plain.length > 300 ? plain.slice(0, 300) + '…' : plain
  return m.slice(0, 2).join('').trim()
}

type NextStep = { text: string; color: string; dotColor: string }

function computeNextStep(
  cand: Cand,
  convByOffre: Map<string, Conv>,
  rdvByConv: Map<string, Rdv>,
): NextStep | null {
  const conv = convByOffre.get(cand.offre_id)
  const rdv  = conv ? rdvByConv.get(conv.id) : undefined
  const now  = Date.now()

  if (rdv?.statut === 'acceptee') {
    const choisi = rdv.creneaux_rdv.find(c => c.selectionne)
    if (choisi) {
      const label = rdv.type === 'telephonique' ? 'Appel téléphonique' : 'Entretien'
      return { text: `${label} ${formatDateRdv(choisi.debut_utc)}`, color: C.succes, dotColor: C.succes }
    }
  }

  if (rdv?.statut === 'proposee' && rdv.creneaux_rdv.some(c => new Date(c.debut_utc).getTime() > now)) {
    return { text: 'Rendez-vous à confirmer', color: C.orangeTexte, dotColor: C.orange }
  }

  if (conv && (conv.non_lu_candidat ?? 0) > 0) {
    return { text: 'Nouveau message', color: C.orangeTexte, dotColor: C.orange }
  }

  return null
}

function needsAction(
  cand: Cand,
  convByOffre: Map<string, Conv>,
  rdvByConv: Map<string, Rdv>,
): boolean {
  const conv = convByOffre.get(cand.offre_id)
  if (!conv) return false
  if ((conv.non_lu_candidat ?? 0) > 0) return true
  const rdv = rdvByConv.get(conv.id)
  if (!rdv || rdv.statut !== 'proposee') return false
  const now = Date.now()
  return rdv.creneaux_rdv.some(c => new Date(c.debut_utc).getTime() > now)
}

function isCloturee(statut: string): boolean {
  return statut === 'acceptée' || statut === 'refusée'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner({ fullPage = false }: { fullPage?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      ...(fullPage ? { minHeight: '100vh', backgroundColor: C.bg } : { flex: 1 }),
    }}>
      <style suppressHydrationWarning>{`@keyframes kapolia-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: `3px solid ${C.sable}`, borderTopColor: C.orange,
        animation: 'kapolia-spin 0.8s linear infinite',
      }} />
    </div>
  )
}


function GroupLabel({ label, count }: { label: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px', marginBottom: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.grey }}>{label}</span>
      <span style={{ fontSize: 12, color: C.grey }}>{count}</span>
    </div>
  )
}

function CandidatureCard({ cand, isSelected, convByOffre, rdvByConv, onClick }: {
  cand: Cand
  isSelected: boolean
  convByOffre: Map<string, Conv>
  rdvByConv: Map<string, Rdv>
  onClick: () => void
}) {
  const [hov, setHov] = useState(false)
  const offre     = cand.offres
  const entreprise = offre?.entreprise_nom ?? ''
  const isExpired  = offre?.expire_at ? new Date(offre.expire_at) <= new Date() : false
  const step       = computeNextStep(cand, convByOffre, rdvByConv)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', textAlign: 'left', fontFamily: 'inherit',
        backgroundColor: isSelected ? `${C.orange}07` : hov ? `${C.dark}03` : C.white,
        border: `1px solid ${isSelected ? C.orange : C.sable}`,
        borderLeft: `3px solid ${isSelected ? C.orange : hov ? `${C.orange}60` : 'transparent'}`,
        borderRadius: CARD_RADIUS,
        padding: '14px 16px',
        cursor: 'pointer',
        boxShadow: isSelected
          ? '0 4px 10px rgba(27,48,38,.10), 0 14px 34px rgba(27,48,38,.14)'
          : CARD_SHADOW,
        transition: 'box-shadow 0.15s, border-color 0.15s, background-color 0.15s',
      }}
    >
      {/* Ligne 1 : logo + titre + sous-titre */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
        <EntrepriseLogo nom={entreprise || '?'} logoUrl={offre?.entreprise_logo_url} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14.5, fontWeight: 600, color: C.dark,
            lineHeight: 1.3, marginBottom: 3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {offre?.titre ?? 'Offre supprimée'}
          </div>
          <div style={{ fontSize: 13, color: C.grey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[entreprise, offre?.ville].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>

      {/* Ligne 2 : badge statut · date · offre expirée */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        <BadgeStatutCandidat statut={cand.statut} />
        <span style={{ fontSize: 12, color: C.grey }}>{dateEnvoi(cand.created_at)}</span>
        {isExpired && (
          <span style={{
            fontSize: 11, fontWeight: 500, color: C.grey,
            border: '1px solid #E7EAE8', borderRadius: 20,
            padding: '2px 8px', backgroundColor: 'transparent',
          }}>
            Offre expirée
          </span>
        )}
      </div>

      {/* Ligne 3 : prochain pas */}
      {step && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: step.dotColor, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: step.color, lineHeight: 1.3 }}>
            {step.text}
          </span>
        </div>
      )}
    </button>
  )
}

// ─── Timeline "Suivi" ─────────────────────────────────────────────────────────

const ETAPES = [
  { key: 'envoyée',  label: 'Envoyée'  },
  { key: 'vue',      label: 'Vue'      },
  { key: 'en cours', label: 'En cours' },
  { key: 'reponse',  label: 'Réponse'  },
]

const STATUT_RANG: Record<string, number> = { 'envoyée': 0, 'vue': 1, 'en cours': 2, 'acceptée': 3, 'refusée': 3 }
const ETAPE_RANG: Record<string, number>  = { 'envoyée': 0, 'vue': 1, 'en cours': 2, 'reponse': 3 }

function Suivi({ statut, candCreatedAt }: { statut: string; candCreatedAt: string }) {
  const terminal = isCloturee(statut)
  const curRang  = STATUT_RANG[statut] ?? 0

  function circleState(i: number): 'franchie' | 'actuelle' | 'avenir' {
    if (terminal) return 'franchie'
    if (i < curRang) return 'franchie'
    if (i === curRang) return 'actuelle'
    return 'avenir'
  }

  const dateStr = new Date(candCreatedAt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>
        Suivi
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {ETAPES.map((etape, i) => {
          const st        = circleState(i)
          const lineColor = (i < curRang || terminal) ? C.vert : '#E1E5E2'

          return (
            <div key={etape.key} style={{ display: 'contents' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  backgroundColor: st === 'franchie' ? C.vert : 'transparent',
                  border: st === 'franchie' ? 'none' : `2px solid ${st === 'actuelle' ? C.vert : '#C9CECB'}`,
                  boxShadow: st === 'actuelle' ? '0 0 0 4px #E6EFE9' : 'none',
                }} />
                <div style={{ fontSize: 11, color: st === 'avenir' ? '#9AA19C' : C.grey, marginTop: 7, textAlign: 'center', lineHeight: 1.3 }}>
                  {etape.label}
                </div>
                {i === 0 && (
                  <div style={{ fontSize: 10, color: '#9AA19C', marginTop: 2, textAlign: 'center' }}>
                    {dateStr}
                  </div>
                )}
                {i === 3 && terminal && (
                  <div style={{
                    fontSize: 11, fontWeight: 600, marginTop: 2, textAlign: 'center',
                    color: statut === 'acceptée' ? '#2F7049' : C.grey,
                  }}>
                    {statut === 'acceptée' ? 'Retenue' : 'Non retenue'}
                  </div>
                )}
              </div>
              {i < 3 && (
                <div style={{ flex: 1, height: 2, backgroundColor: lineColor, marginTop: 9, minWidth: 8 }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Panneau droit — composants utilitaires ───────────────────────────────────

function OffreProcheCard({ o }: { o: OffreSimilaire }) {
  return (
    <Link href={`/offres/${o.id}`} style={{
      display: 'block', textDecoration: 'none',
      backgroundColor: C.bg, border: '1px solid #E7EAE8',
      borderRadius: 10, padding: '10px 14px',
    }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: C.dark, marginBottom: 3, lineHeight: 1.3 }}>
        {o.titre}
      </div>
      <div style={{ fontSize: 12, color: C.grey }}>
        {[o.entreprise_nom, o.ville, o.type_contrat].filter(Boolean).join(' · ')}
      </div>
    </Link>
  )
}

function BoutonConv({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  return (
    <Link href={href} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
      textDecoration: 'none', fontFamily: 'inherit', flexShrink: 0,
      ...(primary
        ? { backgroundColor: C.orange, color: '#fff', border: 'none' }
        : { backgroundColor: 'transparent', color: C.dark, border: '1px solid #E7EAE8' }
      ),
    }}>
      {label}
    </Link>
  )
}

function formatCreneauParis(utc: string): string {
  const d  = new Date(utc)
  const tz = { timeZone: 'Europe/Paris' } as const
  const wd  = d.toLocaleDateString('fr-FR', { weekday: 'short', ...tz })
  const day = d.toLocaleDateString('fr-FR', { day: 'numeric', ...tz })
  const mo  = d.toLocaleDateString('fr-FR', { month: 'short', ...tz })
  const hm  = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', ...tz })
              .replace(':', ' h ')
  const moStr = mo.endsWith('.') ? mo : mo + '.'
  return `${wd.charAt(0).toUpperCase() + wd.slice(1)} ${day} ${moStr}, ${hm}`
}

function SpinnerSmall() {
  return (
    <>
      <style suppressHydrationWarning>{`@keyframes cand-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'cand-spin 0.7s linear infinite', flexShrink: 0 }} />
    </>
  )
}

function CheckAnim() {
  return (
    <svg width="14" height="11" viewBox="0 0 13 10" fill="none" style={{ flexShrink: 0 }}>
      <style suppressHydrationWarning>{`@keyframes cand-check{from{stroke-dashoffset:16}to{stroke-dashoffset:0}}`}</style>
      <path
        d="M1 5L4 8L11 1"
        stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="16" strokeDashoffset="16"
        style={{ animation: 'cand-check 350ms cubic-bezier(0.2,0.8,0.2,1) forwards' }}
      />
    </svg>
  )
}

function RdvPropose({ conv, rdv, recruteurNom, onRdvAccepte, onRdvReload }: {
  conv: Conv | undefined
  rdv: Rdv
  recruteurNom: string
  onRdvAccepte: (rdvId: string, creneauId: string) => void
  onRdvReload: (rdvId: string) => void
}) {
  const [expanded,   setExpanded]   = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmed,  setConfirmed]  = useState(false)
  const [errMsg,     setErrMsg]     = useState<string | null>(null)

  const now    = Date.now()
  const futurs = rdv.creneaux_rdv
    .filter(c => new Date(c.debut_utc).getTime() > now)
    .sort((a, b) => new Date(a.debut_utc).getTime() - new Date(b.debut_utc).getTime())
  const typeLabel = rdv.type === 'telephonique' ? 'un appel téléphonique' : 'un entretien'
  const convHref  = conv ? `/dashboard/messages?conv=${conv.id}` : '/dashboard/messages'

  async function confirmer() {
    if (!selectedId || submitting || confirmed) return
    setSubmitting(true)
    setErrMsg(null)
    const { error } = await accepterCreneau(rdv.id, selectedId)
    if (error) {
      if (isRdvPlusPropose(error)) {
        setErrMsg('Ce rendez-vous n\'est plus disponible.')
        onRdvReload(rdv.id)
      } else {
        setErrMsg('Le créneau n\'a pas pu être confirmé. Réessayez dans un instant.')
      }
      setSubmitting(false)
      return
    }
    setConfirmed(true)
    setSubmitting(false)
    setTimeout(() => onRdvAccepte(rdv.id, selectedId!), 700)
  }

  return (
    <div style={{ backgroundColor: '#FBF3EC', borderRadius: 10, padding: '16px 18px' }}>
      <p style={{ fontSize: 15, color: C.dark, margin: '0 0 16px', lineHeight: 1.6 }}>
        <strong>{recruteurNom}</strong> vous propose {futurs.length} créneau{futurs.length > 1 ? 'x' : ''} pour {typeLabel}.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => {
            if (!expanded) { setExpanded(true); return }
            if (selectedId && !submitting && !confirmed) confirmer()
          }}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            backgroundColor: confirmed ? C.vert : C.orange, color: '#fff', border: 'none',
            cursor: (expanded && !selectedId) || submitting || confirmed ? 'default' : 'pointer',
            fontFamily: 'inherit', flexShrink: 0,
            opacity: expanded && !selectedId && !submitting && !confirmed ? 0.5 : 1,
            transition: 'opacity 0.15s, background-color 0.2s',
          }}
        >
          {!expanded && 'Choisir un créneau'}
          {expanded && !submitting && !confirmed && 'Confirmer ce créneau'}
          {expanded && submitting && <><SpinnerSmall /> Confirmer ce créneau</>}
          {expanded && confirmed  && <><CheckAnim /> Créneau confirmé</>}
        </button>
        <BoutonConv href={convHref} label="Voir la conversation" />
      </div>

      {/* Accordion créneaux */}
      <div style={{
        display: 'grid',
        gridTemplateRows: expanded ? '1fr' : '0fr',
        transition: `grid-template-rows 300ms ${EASE}`,
      }}>
        <div style={{ minHeight: 0, overflow: 'hidden' }}>
          <div style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {futurs.map(c => {
              const sel = c.id === selectedId
              return (
                <button
                  key={c.id}
                  onClick={() => !submitting && !confirmed && setSelectedId(c.id)}
                  style={{
                    padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: sel ? 600 : 400,
                    textAlign: 'left', cursor: submitting || confirmed ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                    backgroundColor: sel ? '#E6EFE9' : '#fff',
                    border: `1.5px solid ${sel ? C.vert : '#E7EAE8'}`,
                    color: sel ? C.vert : C.dark,
                    transition: 'border-color 0.12s, background-color 0.12s, color 0.12s',
                  }}
                >
                  {formatCreneauParis(c.debut_utc)}
                </button>
              )
            })}
            {errMsg && (
              <p style={{ fontSize: 13, color: C.erreur, margin: '4px 0 0', lineHeight: 1.5 }}>
                {errMsg}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CeQuiVousAttend({ cand, conv, rdv, recruteurNom, offresProches, onRdvAccepte, onRdvReload }: {
  cand: Cand
  conv: Conv | undefined
  rdv: Rdv | undefined
  recruteurNom: string
  offresProches: OffreSimilaire[]
  onRdvAccepte: (rdvId: string, creneauId: string) => void
  onRdvReload: (rdvId: string) => void
}) {
  const now = Date.now()
  const offre = cand.offres

  // ── Cas 1 : RDV proposé ─────────────────────────────────────────────────
  if (rdv?.statut === 'proposee') {
    return <RdvPropose conv={conv} rdv={rdv} recruteurNom={recruteurNom} onRdvAccepte={onRdvAccepte} onRdvReload={onRdvReload} />
  }

  // ── Cas 2 : message non lu ──────────────────────────────────────────────
  if (conv && (conv.non_lu_candidat ?? 0) > 0) {
    const dateStr  = formatRelativeDate(conv.derniere_activite)
    const convHref = `/dashboard/messages?conv=${conv.id}`
    const msg      = conv.dernier_message ?? ''
    const preview  = msg.length > 160 ? msg.slice(0, 160) + '…' : msg
    return (
      <div>
        <p style={{ fontSize: 14, color: C.dark, margin: '0 0 10px', lineHeight: 1.6 }}>
          <strong>{recruteurNom}</strong> vous a écrit {dateStr} :
        </p>
        {preview && (
          <div style={{ borderLeft: `2px solid ${C.orange}`, paddingLeft: 12, marginBottom: 16 }}>
            <p style={{
              fontFamily: FONT_SERIF, fontStyle: 'italic', fontSize: 15,
              color: C.dark, margin: 0, lineHeight: 1.6,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {preview}
            </p>
          </div>
        )}
        <BoutonConv href={convHref} label="Répondre" primary />
      </div>
    )
  }

  // ── Cas 3 : RDV accepté ─────────────────────────────────────────────────
  if (rdv?.statut === 'acceptee') {
    const choisi = rdv.creneaux_rdv.find(c => c.selectionne)
    if (choisi) {
      const typeLabel = rdv.type === 'telephonique' ? 'téléphonique' : 'en présentiel'
      return (
        <div style={{ backgroundColor: '#E6EFE9', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <svg width="14" height="14" viewBox="0 0 13 10" fill="none" style={{ marginTop: 3, flexShrink: 0 }}>
            <path d="M1 5L4 8L11 1" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p style={{ fontSize: 14, color: C.vert, margin: 0, lineHeight: 1.65 }}>
            {rdv.type === 'telephonique' ? 'Appel' : 'Entretien'} confirmé le {formatDateRdv(choisi.debut_utc)}, {typeLabel}. Il apparaît dans vos{' '}
            <Link href="/dashboard/rendez-vous" style={{ color: C.vert, fontWeight: 600, textDecoration: 'underline' }}>
              rendez-vous
            </Link>.
          </p>
        </div>
      )
    }
  }

  // ── Cas 4 : statut acceptée ─────────────────────────────────────────────
  if (cand.statut === 'acceptée') {
    const convHref = conv ? `/dashboard/messages?conv=${conv.id}` : null
    return (
      <div>
        <p style={{ fontSize: 14, color: C.dark, margin: '0 0 14px', lineHeight: 1.65 }}>
          Le recruteur a retenu votre candidature. La suite se passe dans votre conversation avec lui.
        </p>
        {convHref && <BoutonConv href={convHref} label="Voir la conversation" />}
      </div>
    )
  }

  // ── Cas 5 : statut refusée ──────────────────────────────────────────────
  if (cand.statut === 'refusée') {
    return (
      <div>
        <p style={{ fontSize: 14, color: C.dark, margin: '0 0 14px', lineHeight: 1.65 }}>
          Le recruteur n&apos;a pas retenu votre candidature pour ce poste. {offresProches.length > 0 ? 'Voici deux offres proches de celle-ci :' : ''}
        </p>
        {offresProches.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {offresProches.map(o => <OffreProcheCard key={o.id} o={o} />)}
          </div>
        )}
      </div>
    )
  }

  // ── Cas 6 : offre expirée sans réponse ──────────────────────────────────
  if (!isCloturee(cand.statut) && offre?.expire_at && new Date(offre.expire_at) <= new Date()) {
    return (
      <div>
        <p style={{ fontSize: 14, color: C.dark, margin: '0 0 14px', lineHeight: 1.65 }}>
          L&apos;offre a expiré le {formatDateCourte(offre.expire_at)}. Le recruteur n&apos;a pas encore répondu, mais il peut toujours vous écrire. {offresProches.length > 0 ? 'En attendant, voici deux offres proches de celle-ci :' : ''}
        </p>
        {offresProches.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {offresProches.map(o => <OffreProcheCard key={o.id} o={o} />)}
          </div>
        )}
      </div>
    )
  }

  // ── Cas 7 : statut vue ──────────────────────────────────────────────────
  if (cand.statut === 'vue') {
    return (
      <p style={{ fontSize: 14, color: C.dark, margin: 0, lineHeight: 1.65 }}>
        Le recruteur a consulté votre candidature. Rien à faire de votre côté pour l&apos;instant.
      </p>
    )
  }

  // ── Cas 8 : statut envoyée ──────────────────────────────────────────────
  return (
    <p style={{ fontSize: 14, color: C.dark, margin: 0, lineHeight: 1.65 }}>
      Le recruteur n&apos;a pas encore ouvert votre candidature. Rien à faire de votre côté pour l&apos;instant.
    </p>
  )
}

// ─── Panneau droit ────────────────────────────────────────────────────────────

function CandidaturePanel({ cand, convByOffre, rdvByConv, recruteurProfils, offresProchesMap, onRetirer, onClose, onRdvAccepte, onRdvReload }: {
  cand: Cand
  convByOffre: Map<string, Conv>
  rdvByConv: Map<string, Rdv>
  recruteurProfils: Map<string, RecruteurProfil>
  offresProchesMap: Map<string, OffreSimilaire[]>
  onRetirer: () => void
  onClose?: () => void
  onRdvAccepte: (rdvId: string, creneauId: string) => void
  onRdvReload: (rdvId: string) => void
}) {
  const offre      = cand.offres
  const entreprise = offre?.entreprise_nom ?? ''
  const extrait    = premieresPhrase(offre?.description)
  const salaire    = salaireLabel(offre?.salaire_min, offre?.salaire_max, offre?.periode_salaire)
  const conv       = convByOffre.get(cand.offre_id)
  const rdv        = conv ? rdvByConv.get(conv.id) : undefined
  const profil     = conv?.recruteur_id ? recruteurProfils.get(conv.recruteur_id) : undefined
  const recruteurNom = [profil?.prenom, profil?.nom].filter(Boolean).join(' ') || 'Le recruteur'
  const offresProches = offresProchesMap.get(cand.offre_id) ?? []

  if (!offre) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 14, color: C.grey }}>Cette offre n&apos;est plus disponible.</span>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: C.white, borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>

      {/* Bouton retour (mobile) */}
      {onClose && (
        <div style={{ padding: '16px 20px 0' }}>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 13, color: C.grey, cursor: 'pointer', fontFamily: 'inherit', padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Retour
          </button>
        </div>
      )}

      {/* En-tête */}
      <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid #E7EAE8', display: 'flex', alignItems: 'flex-start', gap: 16, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
          <EntrepriseLogo nom={entreprise || '?'} logoUrl={offre.entreprise_logo_url} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 23, fontWeight: 600, color: C.dark, margin: '0 0 5px', lineHeight: 1.2 }}>
              {offre.titre}
            </h2>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
              {offre.recruteur_id ? (
                <Link
                  href={`/entreprise/${offre.recruteur_id}`}
                  style={{ fontSize: 14, fontWeight: 600, color: C.orangeTexte, textDecoration: 'none' }}
                >
                  {entreprise}
                </Link>
              ) : entreprise ? (
                <span style={{ fontSize: 14, color: C.grey }}>{entreprise}</span>
              ) : null}
              {offre.ville && (
                <><span style={{ fontSize: 13, color: '#D0D0D0' }}>·</span><span style={{ fontSize: 13, color: C.grey }}>{offre.ville}</span></>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {salaire && (
                <span style={{ fontSize: 12, fontWeight: 500, backgroundColor: C.salaire, color: C.vert, padding: '3px 10px', borderRadius: 20 }}>
                  {salaire}
                </span>
              )}
              {offre.type_contrat && (
                <span style={{ fontSize: 12, fontWeight: 500, backgroundColor: C.chip, color: C.chipTexte, padding: '3px 10px', borderRadius: 20 }}>
                  {offre.type_contrat}
                </span>
              )}
            </div>
          </div>
        </div>
        <BadgeStatutCandidat statut={cand.statut} />
      </div>

      {/* Suivi */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #E7EAE8' }}>
        <Suivi statut={cand.statut} candCreatedAt={cand.created_at} />
      </div>

      {/* Ce qui vous attend */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #E7EAE8' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
          Ce qui vous attend
        </div>
        <CeQuiVousAttend
          cand={cand}
          conv={conv}
          rdv={rdv}
          recruteurNom={recruteurNom}
          offresProches={offresProches}
          onRdvAccepte={onRdvAccepte}
          onRdvReload={onRdvReload}
        />
      </div>

      {/* L'offre */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #E7EAE8' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
          L&apos;offre
        </div>
        {extrait ? (
          <p style={{ fontSize: 13, color: C.dark, lineHeight: 1.65, margin: '0 0 12px' }}>
            {extrait}
          </p>
        ) : (
          <p style={{ fontSize: 13, color: C.grey, margin: '0 0 12px', fontStyle: 'italic' }}>
            Aucune description disponible.
          </p>
        )}
        <Link
          href={`/offres/${offre.id}`}
          style={{ fontSize: 13, color: C.orangeTexte, fontWeight: 600, textDecoration: 'none' }}
        >
          Voir l&apos;offre complète
        </Link>
      </div>

      {/* Retirer de ma liste — uniquement pour les candidatures clôturées */}
      {isCloturee(cand.statut) && (
        <div style={{ padding: '16px 24px' }}>
          <button
            onClick={onRetirer}
            title="Le recruteur conserve votre candidature et peut toujours la consulter"
            style={{ background: 'none', border: 'none', fontSize: 13, color: C.grey, cursor: 'pointer', fontFamily: 'inherit', padding: 0, textDecoration: 'underline' }}
          >
            Retirer de ma liste
          </button>
        </div>
      )}

    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function CandidaturesPageInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const offreParam   = searchParams.get('offre')

  const [candidatures, setCandidatures] = useState<Cand[]>([])
  const [conversations, setConversations] = useState<Conv[]>([])
  const [rdvs, setRdvs]       = useState<Rdv[]>([])
  const [recruteurProfils, setRecruteurProfils] = useState<Map<string, RecruteurProfil>>(new Map())
  const [offresProchesMap, setOffresProchesMap] = useState<Map<string, OffreSimilaire[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [isSplit, setIsSplit] = useState(false)
  const [tab, setTab]         = useState<Tab>('en_cours')
  const [selectedId, setSelectedId]   = useState<string | null>(null)
  const [bandeauCand, setBandeauCand] = useState<Cand | null>(null)
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)

  const detailPanelRef    = useRef<HTMLDivElement>(null)
  const initDoneRef       = useRef(false)
  const bandeauRef        = useRef<BandeauHandle>(null)
  const bandeauTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bandeauIndexRef   = useRef<number>(-1)
  const pendingRetirerRef = useRef<string | null>(null)

  // ── Responsive ───────────────────────────────────────────────────────────
  useEffect(() => {
    function check() { setIsSplit(largeurUtile() >= 900) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── Flush écriture différée (navigation SPA + fermeture onglet) ───────────
  useEffect(() => {
    function flush() {
      if (!pendingRetirerRef.current) return
      supabase.from('candidatures').update({ masquee_candidat: true }).eq('id', pendingRetirerRef.current)
      pendingRetirerRef.current = null
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      if (bandeauTimerRef.current) clearTimeout(bandeauTimerRef.current)
      flush()
    }
  }, [])

  // ── Chargement données ───────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/connexion'); return }

      const [candsRes, convsRes, rdvsRes, allCandIdsRes] = await Promise.all([
        supabase
          .from('candidatures')
          .select(`
            id, offre_id, created_at, statut,
            offres(
              id, titre, domaine, type_contrat, experience, ville, created_at, recruteur_id,
              expire_at, description, salaire_min, salaire_max, periode_salaire,
              latitude, longitude
            )
          `)
          .eq('candidat_id', user.id)
          .eq('masquee_candidat', false)
          .order('created_at', { ascending: false }),

        supabase
          .from('conversations')
          .select('id, offre_id, non_lu_candidat, recruteur_id, dernier_message, derniere_activite')
          .eq('candidat_id', user.id)
          .eq('masquee_candidat', false),

        supabase
          .from('rendez_vous')
          .select('id, conversation_id, type, statut, creneaux_rdv(id, debut_utc, selectionne)')
          .eq('candidat_id', user.id)
          .in('statut', ['proposee', 'acceptee']),

        supabase
          .from('candidatures')
          .select('offre_id')
          .eq('candidat_id', user.id),
      ])

      if (candsRes.error) {
        console.error('[candidatures]', candsRes.error)
        setLoading(false)
        return
      }

      const raw = (candsRes.data as unknown as Cand[]) ?? []
      const rids = [...new Set(raw.map(c => c.offres?.recruteur_id).filter(Boolean))] as string[]
      const { map, error: epErr } = await fetchProfilsEntreprise(rids)
      if (epErr) console.error('[candidatures profils]', epErr)

      const enriched: Cand[] = raw.map(c => {
        const ep = c.offres?.recruteur_id ? map[c.offres.recruteur_id] : undefined
        if (!ep || !c.offres) return c
        return { ...c, offres: { ...c.offres, entreprise_nom: ep.entreprise_nom ?? undefined, entreprise_logo_url: ep.entreprise_logo_url ?? undefined } }
      })

      const convs = (convsRes.data as Conv[]) ?? []
      setCandidatures(enriched)
      setConversations(convs)
      setRdvs((rdvsRes.data as unknown as Rdv[]) ?? [])

      // ── Profils recruteurs ──────────────────────────────────────────────
      const recruteurIds = [...new Set(convs.map(c => c.recruteur_id).filter(Boolean))] as string[]
      if (recruteurIds.length > 0) {
        const { data: profData } = await supabase
          .from('profils_vue_publique')
          .select('user_id, prenom, nom')
          .in('user_id', recruteurIds)
        const pmap = new Map<string, RecruteurProfil>()
        for (const p of profData ?? []) pmap.set(p.user_id, { prenom: p.prenom, nom: p.nom })
        setRecruteurProfils(pmap)
      }

      // ── Offres proches (refusée / expirée sans réponse) ─────────────────
      const now = new Date().toISOString()
      const ownOffreIds = new Set(
        ((allCandIdsRes.data ?? []) as { offre_id: string }[]).map(c => c.offre_id)
      )
      const needsProches = enriched.filter(c => {
        if (c.statut === 'refusée') return true
        if (isCloturee(c.statut)) return false
        return c.offres?.expire_at ? c.offres.expire_at <= now : false
      })
      if (needsProches.length > 0) {
        const { data: openRaw } = await supabase
          .from('offres')
          .select('id, titre, type_contrat, domaine, experience, salaire_min, salaire_max, periode_salaire, latitude, longitude, created_at, ville, recruteur_id')
          .eq('active', true)
          .eq('statut_publication', 'publiée')
          .gt('expire_at', now)
        if (openRaw && openRaw.length > 0) {
          const rids2 = [...new Set(openRaw.map(o => o.recruteur_id).filter(Boolean))] as string[]
          const { map: map2 } = await fetchProfilsEntreprise(rids2)
          const enrichedOpen = openRaw.map(o => ({
            ...o,
            entreprise_nom: (o.recruteur_id ? (map2[o.recruteur_id]?.entreprise_nom ?? null) : null),
          })) as SimOffre[]
          const ppmap = new Map<string, OffreSimilaire[]>()
          for (const c of needsProches) {
            if (!c.offres) continue
            const ref: SimOffre = {
              id:             c.offre_id,
              titre:          c.offres.titre,
              domaine:        c.offres.domaine ?? null,
              experience:     c.offres.experience ?? null,
              type_contrat:   c.offres.type_contrat ?? null,
              salaire_min:    c.offres.salaire_min ?? null,
              salaire_max:    c.offres.salaire_max ?? null,
              periode_salaire: c.offres.periode_salaire ?? null,
              ville:          c.offres.ville ?? null,
              created_at:     c.offres.created_at ?? c.created_at,
              latitude:       c.offres.latitude ?? null,
              longitude:      c.offres.longitude ?? null,
              entreprise_nom: c.offres.entreprise_nom ?? null,
            }
            const cands = enrichedOpen.filter(o => !ownOffreIds.has(o.id))
            const { similaires: sim } = trouverSimilaires(ref, cands)
            ppmap.set(c.offre_id, sim.slice(0, 2))
          }
          setOffresProchesMap(ppmap)
        }
      }

      setLoading(false)
    }
    load()
  }, [router])

  // ── Maps dérivées ─────────────────────────────────────────────────────────
  const convByOffre = useMemo(() => {
    const m = new Map<string, Conv>()
    for (const c of conversations) if (c.offre_id) m.set(c.offre_id, c)
    return m
  }, [conversations])

  const rdvByConv = useMemo(() => {
    const m = new Map<string, Rdv>()
    for (const r of rdvs) m.set(r.conversation_id, r)
    return m
  }, [rdvs])

  // ── Listes dérivées ───────────────────────────────────────────────────────
  const enCours   = useMemo(() => candidatures.filter(c => !isCloturee(c.statut)), [candidatures])
  const cloturees = useMemo(() => candidatures.filter(c =>  isCloturee(c.statut)), [candidatures])

  const attenteAction   = useMemo(() => enCours.filter(c =>  needsAction(c, convByOffre, rdvByConv)), [enCours, convByOffre, rdvByConv])
  const attenteRecruteur = useMemo(() => enCours.filter(c => !needsAction(c, convByOffre, rdvByConv)), [enCours, convByOffre, rdvByConv])

  const currentList = tab === 'en_cours' ? enCours : cloturees

  // ── Sélection initiale ────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || initDoneRef.current) return
    initDoneRef.current = true

    if (offreParam) {
      const target = candidatures.find(c => c.offre_id === offreParam)
      if (target) {
        setTab(isCloturee(target.statut) ? 'cloturees' : 'en_cours')
        setSelectedId(target.id)
        return
      }
    }

    if (isSplit && currentList.length > 0) {
      setSelectedId(currentList[0].id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  // ── Changement d'onglet ───────────────────────────────────────────────────
  function handleTabChange(newTab: Tab) {
    setTab(newTab)
    setMobilePanelOpen(false)
    if (isSplit) {
      const list = newTab === 'en_cours' ? enCours : cloturees
      setSelectedId(list[0]?.id ?? null)
    } else {
      setSelectedId(null)
    }
  }

  // ── Sélection carte ───────────────────────────────────────────────────────
  function handleSelect(id: string) {
    if (id === selectedId) return
    if (!isSplit) {
      setSelectedId(id)
      setMobilePanelOpen(true)
      return
    }
    if (!reduitMouvement() && detailPanelRef.current) {
      fondurPanneau(detailPanelRef.current, () => setSelectedId(id))
    } else {
      setSelectedId(id)
    }
  }

  // ── Animation panneau ─────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = detailPanelRef.current
    if (!el || !selectedId || reduitMouvement()) return
    entrerPanneau(el)
  }, [selectedId])

  // ── Retirer de ma liste (bandeau Annuler, écriture différée 5 s) ──────────
  function handleRetirer(candId: string) {
    // Commit toute écriture précédente en attente
    if (bandeauTimerRef.current) { clearTimeout(bandeauTimerRef.current); bandeauTimerRef.current = null }
    if (pendingRetirerRef.current) {
      supabase.from('candidatures').update({ masquee_candidat: true }).eq('id', pendingRetirerRef.current)
      pendingRetirerRef.current = null
    }

    const idx  = candidatures.findIndex(c => c.id === candId)
    const cand = idx >= 0 ? candidatures[idx] : null
    if (!cand) return

    if (selectedId === candId) {
      const idx2 = currentList.findIndex(c => c.id === candId)
      setSelectedId(isSplit ? (currentList[idx2 + 1]?.id ?? currentList[idx2 - 1]?.id ?? null) : null)
      if (!isSplit) setMobilePanelOpen(false)
    }

    setCandidatures(prev => prev.filter(c => c.id !== candId))
    bandeauIndexRef.current   = idx
    pendingRetirerRef.current = candId
    setBandeauCand(cand)

    bandeauTimerRef.current = setTimeout(() => {
      const commit = () => {
        setBandeauCand(null)
        if (pendingRetirerRef.current) {
          supabase.from('candidatures').update({ masquee_candidat: true }).eq('id', pendingRetirerRef.current)
          pendingRetirerRef.current = null
        }
      }
      if (bandeauRef.current) bandeauRef.current.animateOut(commit)
      else commit()
    }, 5000)
  }

  async function handleAnnuler() {
    if (bandeauTimerRef.current) { clearTimeout(bandeauTimerRef.current); bandeauTimerRef.current = null }
    const toRestore = bandeauCand
    const idx       = bandeauIndexRef.current

    await new Promise<void>(resolve => {
      if (bandeauRef.current) bandeauRef.current.animateOut(resolve)
      else resolve()
    })

    setBandeauCand(null)
    pendingRetirerRef.current = null
    if (!toRestore) return

    setCandidatures(prev => {
      const next = [...prev]
      next.splice(Math.min(Math.max(0, idx), next.length), 0, toRestore)
      return next
    })
    if (isSplit) setSelectedId(toRestore.id)
  }

  // ── Confirmation créneau ──────────────────────────────────────────────────
  function handleRdvConfirme(rdvId: string, creneauId: string) {
    setRdvs(prev => prev.map(r =>
      r.id !== rdvId ? r : {
        ...r, statut: 'acceptee',
        creneaux_rdv: r.creneaux_rdv.map(c => ({ ...c, selectionne: c.id === creneauId })),
      }
    ))
    window.dispatchEvent(new Event('rdv-confirme'))
  }

  async function handleRdvReload(rdvId: string) {
    const { data } = await supabase
      .from('rendez_vous')
      .select('id, conversation_id, type, statut, creneaux_rdv(id, debut_utc, selectionne)')
      .eq('id', rdvId)
      .single()
    setRdvs(prev => {
      if (!data) return prev.filter(r => r.id !== rdvId)
      return prev.map(r => r.id === rdvId ? (data as unknown as Rdv) : r)
    })
  }

  // ── Sous-titre ────────────────────────────────────────────────────────────
  const subtitle = useMemo(() => {
    if (tab === 'cloturees') {
      const n = cloturees.length
      return `${n} candidature${n > 1 ? 's' : ''} clôturée${n > 1 ? 's' : ''}`
    }
    const n = enCours.length
    const a = attenteAction.length
    const base = `${n} candidature${n > 1 ? 's' : ''} en cours`
    if (a === 0) return base
    return `${base}, dont ${a} qui attend${a > 1 ? 'ent' : ''} votre réponse`
  }, [tab, enCours, cloturees, attenteAction])

  if (loading) return <Spinner fullPage />

  const selectedCand = candidatures.find(c => c.id === selectedId) ?? null

  // ── Render panneau ────────────────────────────────────────────────────────
  const panelNode = selectedCand ? (
    <div ref={detailPanelRef} style={{ padding: '16px 20px 40px' }}>
      <CandidaturePanel
        cand={selectedCand}
        convByOffre={convByOffre}
        rdvByConv={rdvByConv}
        recruteurProfils={recruteurProfils}
        offresProchesMap={offresProchesMap}
        onRetirer={() => handleRetirer(selectedCand.id)}
        onClose={!isSplit ? () => setMobilePanelOpen(false) : undefined}
        onRdvAccepte={handleRdvConfirme}
        onRdvReload={handleRdvReload}
      />
    </div>
  ) : (
    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <span style={{ fontSize: 14, color: C.grey }}>Sélectionnez une candidature pour voir le détail.</span>
    </div>
  )

  // ── Render liste ──────────────────────────────────────────────────────────
  function renderList() {
    const groups: { label: string; items: Cand[] }[] = tab === 'en_cours'
      ? [
          ...(attenteAction.length    > 0 ? [{ label: 'Attend votre réponse',      items: attenteAction    }] : []),
          ...(attenteRecruteur.length > 0 ? [{ label: 'En attente du recruteur', items: attenteRecruteur }] : []),
        ]
      : [{ label: '', items: cloturees }]

    if (groups.length === 0 || (groups.length === 1 && groups[0].items.length === 0)) {
      return (
        <div style={{ padding: '48px 20px', textAlign: 'center', color: C.grey, fontSize: 14 }}>
          {tab === 'en_cours' ? 'Aucune candidature en cours.' : 'Aucune candidature clôturée.'}
        </div>
      )
    }

    return groups.map((g, gi) => (
      <div key={gi} style={{ marginBottom: g.label ? 20 : 0 }}>
        {g.label && <GroupLabel label={g.label} count={g.items.length} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {g.items.map(cand => (
            <CandidatureCard
              key={cand.id}
              cand={cand}
              isSelected={cand.id === selectedId}
              convByOffre={convByOffre}
              rdvByConv={rdvByConv}
              onClick={() => handleSelect(cand.id)}
            />
          ))}
        </div>
      </div>
    ))
  }

  // ── En-tête commun ────────────────────────────────────────────────────────
  const header = (
    <div style={{ padding: isSplit ? '28px 28px 0' : '28px 20px 0', flexShrink: 0 }}>
      <h1 style={{
        fontFamily: FONT_SERIF, letterSpacing: '-0.005em',
        fontSize: 28, fontWeight: 600, color: C.dark,
        margin: '0 0 4px',
      }}>
        Mes candidatures
      </h1>
      <p style={{ fontSize: 14, color: C.grey, margin: '0 0 20px', minHeight: 20 }}>{subtitle}</p>
      <OngletNav
        onglets={[
          { key: 'en_cours',   label: 'En cours',   count: enCours.length   },
          { key: 'cloturees',  label: 'Clôturées',  count: cloturees.length },
        ]}
        actif={tab}
        onChange={k => handleTabChange(k as Tab)}
      />
      <div style={{ height: 1, backgroundColor: C.sable, marginTop: 16 }} />
    </div>
  )

  // ── Vue mobile plein écran panneau ────────────────────────────────────────
  if (!isSplit && mobilePanelOpen && selectedCand) {
    return (
      <div style={{ backgroundColor: C.bg, minHeight: '100vh' }}>
        <style suppressHydrationWarning>{`@keyframes kapolia-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 20px 80px' }}>
          <CandidaturePanel
            cand={selectedCand}
            convByOffre={convByOffre}
            rdvByConv={rdvByConv}
            recruteurProfils={recruteurProfils}
            offresProchesMap={offresProchesMap}
            onRetirer={() => handleRetirer(selectedCand.id)}
            onClose={() => setMobilePanelOpen(false)}
            onRdvAccepte={handleRdvConfirme}
            onRdvReload={handleRdvReload}
          />
        </div>
        {bandeauCand && (
          <Bandeau
            ref={bandeauRef}
            message="Candidature retirée de votre liste"
            action={{ libelle: 'Annuler', onClick: handleAnnuler }}
            fixe
          />
        )}
      </div>
    )
  }

  // ── Vue mobile liste ──────────────────────────────────────────────────────
  if (!isSplit) {
    return (
      <div style={{ backgroundColor: C.bg, minHeight: '100vh' }}>
        <style suppressHydrationWarning>{`@keyframes kapolia-spin { to { transform: rotate(360deg); } }`}</style>
        {header}
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '16px 20px 80px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {renderList()}
        </div>
        {bandeauCand && (
          <Bandeau
            ref={bandeauRef}
            message="Candidature retirée de votre liste"
            action={{ libelle: 'Annuler', onClick: handleAnnuler }}
            fixe
          />
        )}
      </div>
    )
  }

  // ── Vue split ─────────────────────────────────────────────────────────────
  return (
    <div style={{ backgroundColor: C.bg, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <style suppressHydrationWarning>{`@keyframes kapolia-spin { to { transform: rotate(360deg); } }`}</style>

      {header}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Colonne gauche */}
        <div style={{
          width: 372, flexShrink: 0,
          overflowY: 'auto',
          padding: '16px 16px 40px',
          borderRight: `1px solid ${C.sable}`,
          display: 'flex', flexDirection: 'column', gap: 20,
        }}>
          {renderList()}
        </div>

        {/* Panneau droit */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', backgroundColor: C.bg }}>
          {panelNode}
        </div>

      </div>

      {bandeauCand && (
        <Bandeau
          ref={bandeauRef}
          message="Candidature retirée de votre liste"
          action={{ libelle: 'Annuler', onClick: handleAnnuler }}
        />
      )}
    </div>
  )
}

export default function CandidaturesPage() {
  return (
    <Suspense>
      <CandidaturesPageInner />
    </Suspense>
  )
}
