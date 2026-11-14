'use client'

import { useState, useEffect, useMemo, useLayoutEffect, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { FONT_SANS } from '@/lib/typography'
import { C, CARD_SHADOW, CARD_RADIUS } from '@/lib/colors'
import { EntrepriseLogo } from '@/components/EntrepriseLogo'
import AssistantPrepEntretien from '@/components/AssistantPrepEntretien'
import { accepterCreneau, isRdvPlusPropose, refuserCreneaux } from '@/lib/rdv'
import NumeroAppel from '@/components/NumeroAppel'
import { formatJourLong, formatHeure, formatJourCourt, delaiRelatif, jourRelatifCourt, formatDateAnalyse } from '@/lib/rdv-format'
import { animerCartes, EASE, reduitMouvement, type CardPos } from '@/lib/motion'
import { genererIcs } from '@/lib/ics'
import { sanitizeFilename } from '@/lib/storage-utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Creneau = { id: string; debut_utc: string; selectionne: boolean }
type RdvRow  = {
  id:                 string
  conversation_id:    string
  type:               'telephonique' | 'entretien'
  duree_minutes:      number
  contact_info:       string | null
  statut:             string
  created_at:         string
  creneaux_rdv:       Creneau[]
  offreTitre:         string
  offreId:            string
  entrepriseNom:      string
  entrepriseLogoUrl:  string | null
  recruteurNom:       string
  recruteurPrenom:    string
  ville:              string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHIFFRES_FR = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'] as const

function nEnLettres(n: number): string {
  return n >= 1 && n <= 10 ? CHIFFRES_FR[n] : String(n)
}

function dateRef(rdv: RdvRow): string | null {
  const choisi = rdv.creneaux_rdv.find(c => c.selectionne)
  if (choisi) return choisi.debut_utc
  if (!rdv.creneaux_rdv.length) return null
  return [...rdv.creneaux_rdv].sort(
    (a, b) => new Date(b.debut_utc).getTime() - new Date(a.debut_utc).getTime()
  )[0].debut_utc
}

function dateRefMs(rdv: RdvRow): number {
  const d = dateRef(rdv)
  return d ? new Date(d).getTime() : new Date(rdv.created_at).getTime()
}

type Section = 'attente' | 'avenir' | 'passes'

function classify(rdv: RdvRow): Section {
  const now = Date.now()
  if (rdv.statut === 'proposee') {
    return rdv.creneaux_rdv.some(c => new Date(c.debut_utc).getTime() > now) ? 'attente' : 'passes'
  }
  if (rdv.statut === 'acceptee') {
    const choisi = rdv.creneaux_rdv.find(c => c.selectionne)
    if (!choisi) return 'passes'
    return new Date(choisi.debut_utc).getTime() > now ? 'avenir' : 'passes'
  }
  if (rdv.statut === 'annulee') {
    const d = dateRef(rdv)
    return d && new Date(d).getTime() > now ? 'avenir' : 'passes'
  }
  return 'passes'
}

function libelleEtat(rdv: RdvRow): string {
  if (rdv.statut === 'acceptee') return 'Passé'
  if (rdv.statut === 'annulee')  return 'Annulé par le recruteur'
  return 'Aucun créneau retenu'
}

function propositionDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 7)   return `il y a ${days} jours`
  return `le ${formatJourCourt(iso)}`
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconPhone() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 012 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
    </svg>
  )
}

function IconBriefcase() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
    </svg>
  )
}

function IconClock() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}

// ─── Spinner & check ─────────────────────────────────────────────────────────

function SpinnerSmall() {
  return (
    <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'rdvp-spin 0.7s linear infinite', flexShrink: 0 }} />
  )
}

function CheckMark({ color = C.vert, animated = false }: { color?: string; animated?: boolean }) {
  const shouldAnimate = animated && !reduitMouvement()
  return (
    <svg width="14" height="11" viewBox="0 0 13 10" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M1 5L4 8L11 1" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={shouldAnimate ? { strokeDasharray: 16, strokeDashoffset: 16, animation: 'rdvp-draw 350ms ease forwards' } : undefined}
      />
    </svg>
  )
}

function Chip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: C.chipTexte, backgroundColor: C.chip, borderRadius: 20, padding: '3px 10px' }}>
      {icon}
      {label}
    </span>
  )
}

// ─── Carte "À confirmer" ──────────────────────────────────────────────────────

function AttenteCard({ rdv, onConfirme, onReload, onRefuse, confirmedDates }: {
  rdv:            RdvRow
  onConfirme:     (rdvId: string, creneauId: string) => void
  onReload:       (rdvId: string) => void
  onRefuse:       (rdvId: string) => void
  confirmedDates: { jourParis: string; type: 'telephonique' | 'entretien'; heure: string }[]
}) {
  const [selectedId,      setSelectedId]      = useState<string | null>(null)
  const [submitting,      setSubmitting]       = useState(false)
  const [confirmed,       setConfirmed]        = useState<string | null>(null)
  const [errMsg,          setErrMsg]           = useState<string | null>(null)
  const [showNumero,      setShowNumero]       = useState(false)
  const [showRefus,       setShowRefus]        = useState(false)
  const [refusMsg,        setRefusMsg]         = useState('')
  const [refusSubmitting, setRefusSubmitting]  = useState(false)
  const [refusErrMsg,     setRefusErrMsg]      = useState<string | null>(null)
  const [refusMsgPartiel, setRefusMsgPartiel]  = useState(false)

  const cardRef         = useRef<HTMLDivElement>(null)
  const confirmerBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!selectedId || reduitMouvement()) return
    const btn = document.querySelector<HTMLButtonElement>(`[data-creneau-id="${selectedId}"]`)
    if (btn) btn.animate(
      [{ transform: 'scale(0.97)' }, { transform: 'scale(1.03)', offset: 0.6 }, { transform: 'scale(1)' }],
      { duration: 260, easing: 'cubic-bezier(0.3,1.5,0.5,1)' }
    )
  }, [selectedId])

  useEffect(() => {
    if (!selectedId || reduitMouvement()) return
    const btn = confirmerBtnRef.current
    if (btn) btn.animate([{ opacity: '0.5' }, { opacity: '1' }], { duration: 200, easing: 'ease-out' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!selectedId])

  function collapserEtConfirmer(rdvId: string, creneauId: string) {
    const card = cardRef.current
    if (card && !reduitMouvement()) {
      const h = card.offsetHeight
      card.style.overflow = 'hidden'
      card.animate(
        [{ height: `${h}px`, opacity: '1' }, { height: '0px', opacity: '0' }],
        { duration: 320, easing: EASE, fill: 'forwards' }
      ).onfinish = () => onConfirme(rdvId, creneauId)
    } else {
      onConfirme(rdvId, creneauId)
    }
  }

  function collapserEtRefuser() {
    const card = cardRef.current
    if (card && !reduitMouvement()) {
      const h = card.offsetHeight
      card.style.overflow = 'hidden'
      card.animate(
        [{ height: `${h}px`, opacity: '1' }, { height: '0px', opacity: '0' }],
        { duration: 320, easing: EASE, fill: 'forwards' }
      ).onfinish = () => onRefuse(rdv.id)
    } else {
      onRefuse(rdv.id)
    }
  }

  const now    = Date.now()
  const futurs = rdv.creneaux_rdv
    .filter(c => new Date(c.debut_utc).getTime() > now)
    .sort((a, b) => new Date(a.debut_utc).getTime() - new Date(b.debut_utc).getTime())

  const premierRelatif = futurs.length > 0 ? jourRelatifCourt(futurs[0].debut_utc) : null
  const dernierFutur   = futurs.length > 0 ? futurs[futurs.length - 1] : null
  const conflitOpts    = { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' } as const

  const n                = futurs.length
  const nStr             = nEnLettres(n)
  const typeStr          = rdv.type === 'telephonique'
    ? `un appel de ${rdv.duree_minutes} minutes`
    : `un entretien de ${rdv.duree_minutes} minutes`
  const dateCreation     = propositionDate(rdv.created_at)
  const qui              = rdv.recruteurNom || 'Le recruteur'
  const convHref         = `/dashboard/messages?conv=${rdv.conversation_id}`
  const confirmedCreneau = confirmed ? rdv.creneaux_rdv.find(c => c.id === confirmed) ?? null : null

  async function confirmer() {
    if (!selectedId || submitting || confirmed) return
    setSubmitting(true)
    setErrMsg(null)
    const { error } = await accepterCreneau(rdv.id, selectedId)
    if (error) {
      setErrMsg(isRdvPlusPropose(error)
        ? 'Cette proposition n\'est plus disponible. Le recruteur l\'a peut-être retirée.'
        : 'Le créneau n\'a pas pu être confirmé. Réessayez dans un instant.'
      )
      if (isRdvPlusPropose(error)) onReload(rdv.id)
      setSubmitting(false)
      return
    }
    setConfirmed(selectedId)
    setSubmitting(false)
    setTimeout(() => collapserEtConfirmer(rdv.id, selectedId!), 900)
  }

  async function decliner() {
    if (refusSubmitting) return
    setRefusSubmitting(true)
    setRefusErrMsg(null)
    const result = await refuserCreneaux(rdv.id, refusMsg || null)
    if (result.error) {
      setRefusErrMsg('Votre réponse n\'a pas pu être envoyée. Réessayez dans un instant.')
      if (isRdvPlusPropose(result.error)) onReload(rdv.id)
      setRefusSubmitting(false)
      return
    }
    if (result.messageNonEnvoye) {
      setRefusMsgPartiel(true)
      setRefusSubmitting(false)
      return
    }
    setRefusSubmitting(false)
    collapserEtRefuser()
  }

  return (
    <div ref={cardRef} data-card-id={rdv.id} style={{ backgroundColor: C.white, borderRadius: 14, boxShadow: CARD_SHADOW }}>

      {/* En-tête */}
      <div style={{ padding: '18px 22px 0', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <EntrepriseLogo nom={rdv.entrepriseNom || '?'} logoUrl={rdv.entrepriseLogoUrl ?? undefined} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 600, color: C.dark, lineHeight: 1.3, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {rdv.offreTitre || 'Poste non précisé'}
          </div>
          <div style={{ fontSize: 13.5, color: C.grey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[rdv.entrepriseNom, rdv.ville].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>

      {/* Phrase */}
      <div style={{ margin: '16px 22px 0', backgroundColor: '#FBF3EC', borderRadius: 10, padding: '14px 16px' }}>
        <p style={{ fontSize: 15, color: C.dark, margin: 0, lineHeight: 1.6 }}>
          <strong>{qui}</strong> vous propose {nStr} créneau{n > 1 ? 'x' : ''} pour {typeStr}. Proposition reçue {dateCreation}.
        </p>
        {dernierFutur && (
          <p style={{ fontSize: 13.5, color: '#7A4317', margin: '8px 0 0', lineHeight: 1.5 }}>
            {premierRelatif && `Le premier créneau est ${premierRelatif}. `}
            Sans réponse, la proposition expire après le dernier créneau, {formatJourLong(dernierFutur.debut_utc)} à {formatHeure(dernierFutur.debut_utc)}.
          </p>
        )}
      </div>

      {/* Zone créneaux */}
      <div style={{ padding: '16px 22px 0' }}>
        {!confirmed ? (
          <>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: C.grey, marginBottom: 10 }}>
              Choisissez un créneau
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {futurs.map(c => {
                const sel         = c.id === selectedId
                const creneauJour = new Date(c.debut_utc).toLocaleDateString('fr-FR', conflitOpts)
                const conflit     = confirmedDates.find(cd => cd.jourParis === creneauJour)
                return (
                  <div key={c.id}>
                    <button
                      data-creneau-id={c.id}
                      className="rdvp-creneau-btn"
                      onClick={() => !submitting && setSelectedId(c.id)}
                      style={{
                        backgroundColor: sel ? C.salaire : C.white,
                        border:         `1.5px solid ${sel ? C.vert : C.sable}`,
                        borderRadius: 10, padding: '9px 14px',
                        cursor: submitting ? 'default' : 'pointer',
                        fontFamily: 'inherit', textAlign: 'center', minWidth: 110,
                        transition: 'border-color 0.12s, background-color 0.12s',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: sel ? C.vert : C.dark, lineHeight: 1.3 }}>
                        {formatJourCourt(c.debut_utc)}
                      </div>
                      <div style={{ fontSize: 12.5, color: sel ? C.vert : C.grey, marginTop: 2 }}>
                        {formatHeure(c.debut_utc)}
                      </div>
                    </button>
                    {conflit && (
                      <div style={{ fontSize: 11.5, color: '#8A5D14', marginTop: 4 }}>
                        Même jour que votre {conflit.type === 'telephonique' ? 'appel' : 'entretien'} de {conflit.heure}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {errMsg && (
              <p style={{ fontSize: 13, color: '#8A3B12', margin: '8px 0 0', lineHeight: 1.5 }}>
                {errMsg}
              </p>
            )}
          </>
        ) : (
          confirmedCreneau && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckMark color={C.vert} animated />
              <span style={{ fontSize: 14, fontWeight: 600, color: C.vert }}>
                Créneau confirmé : {formatJourLong(confirmedCreneau.debut_utc)} à {formatHeure(confirmedCreneau.debut_utc)}
              </span>
            </div>
          )
        )}
      </div>

      {/* Pied */}
      {showNumero && selectedId ? (
        <div style={{ padding: '14px 22px 18px' }}>
          <NumeroAppel
            rdvId={rdv.id}
            creneauId={selectedId}
            recruteurNom={rdv.recruteurNom || 'Le recruteur'}
            entrepriseNom={rdv.entrepriseNom || 'ce recruteur'}
            onConfirme={() => {
              setShowNumero(false)
              setConfirmed(selectedId)
              setTimeout(() => collapserEtConfirmer(rdv.id, selectedId!), 900)
            }}
            onAnnuler={() => setShowNumero(false)}
            onExpire={() => {
              setShowNumero(false)
              setErrMsg('Cette proposition n\'est plus disponible. Le recruteur l\'a peut-être retirée.')
              onReload(rdv.id)
            }}
          />
        </div>
      ) : (
        <div style={{ padding: '14px 22px 18px', marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              ref={confirmerBtnRef}
              onClick={rdv.type === 'telephonique' ? () => { if (selectedId && !confirmed) setShowNumero(true) } : confirmer}
              disabled={!selectedId || !!confirmed}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                backgroundColor: C.orange, color: '#fff', fontWeight: 600,
                borderRadius: 10, padding: '10px 18px', fontSize: 14,
                border: 'none', fontFamily: 'inherit',
                cursor: !selectedId || !!confirmed ? 'default' : 'pointer',
                opacity: !selectedId || !!confirmed ? 0.5 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {submitting ? <><SpinnerSmall /> Confirmer ce créneau</> : 'Confirmer ce créneau'}
            </button>
            <Link href={convHref} style={{ fontSize: 14, fontWeight: 600, color: C.orangeTexte, textDecoration: 'none' }}>
              Voir la conversation
            </Link>
          </div>
          <button
            onClick={() => setShowRefus(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: C.grey, textDecoration: 'underline', fontFamily: 'inherit', padding: 0 }}
          >
            Aucun créneau ne me convient
          </button>
        </div>
      )}

      {showRefus && (
        <div style={{ padding: '0 22px 18px' }}>
          <div style={{ backgroundColor: C.bg, borderRadius: 10, padding: '14px 16px' }}>
            {refusMsgPartiel ? (
              <>
                <p style={{ fontSize: 13, color: '#8A3B12', margin: '0 0 12px', lineHeight: 1.5 }}>
                  Les créneaux ont été déclinés, mais votre message n'a pas pu être ajouté à la conversation.{' '}
                  <Link href={convHref} style={{ fontWeight: 600, color: C.orangeTexte, textDecoration: 'none' }}>
                    Ouvrir la conversation
                  </Link>
                </p>
                <textarea
                  value={refusMsg}
                  readOnly
                  rows={3}
                  style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: `1.5px solid ${C.sable}`, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', color: C.grey, backgroundColor: C.bg, resize: 'vertical', outline: 'none' }}
                />
              </>
            ) : (
              <>
                <p style={{ fontSize: 14, color: C.dark, margin: '0 0 12px', lineHeight: 1.6 }}>
                  Votre réponse sera transmise à <strong>{qui}</strong>. Vous pouvez lui indiquer vos disponibilités, votre message sera ajouté à la conversation.
                </p>
                <textarea
                  value={refusMsg}
                  onChange={e => setRefusMsg(e.target.value.slice(0, 500))}
                  maxLength={500}
                  rows={3}
                  placeholder="Par exemple : je suis disponible les mardis et jeudis après-midi."
                  style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: `1.5px solid ${C.sable}`, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', color: C.dark, backgroundColor: C.white, resize: 'vertical', outline: 'none', marginBottom: 12 }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <button
                    onClick={decliner}
                    disabled={refusSubmitting}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, backgroundColor: C.orange, color: '#fff', fontWeight: 600, borderRadius: 10, padding: '10px 18px', fontSize: 14, border: 'none', fontFamily: 'inherit', cursor: refusSubmitting ? 'default' : 'pointer', opacity: refusSubmitting ? 0.7 : 1 }}
                  >
                    {refusSubmitting ? <><SpinnerSmall /> Décliner ces créneaux</> : 'Décliner ces créneaux'}
                  </button>
                  <button
                    onClick={() => { setShowRefus(false); setRefusMsgPartiel(false) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.grey, fontFamily: 'inherit', padding: 0 }}
                  >
                    Revenir aux créneaux
                  </button>
                </div>
                {refusErrMsg && (
                  <p style={{ fontSize: 13, color: '#8A3B12', margin: '8px 0 0', lineHeight: 1.5 }}>
                    {refusErrMsg}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Colonne date verte ───────────────────────────────────────────────────────

function ColonneDate({ utc }: { utc: string }) {
  const tz  = { timeZone: 'Europe/Paris' } as const
  const d   = new Date(utc)
  const wd  = d.toLocaleDateString('fr-FR', { weekday: 'long', ...tz })
  const day = d.toLocaleDateString('fr-FR', { day: 'numeric', ...tz })
  const mo  = d.toLocaleDateString('fr-FR', { month: 'long', ...tz })
  const hm  = formatHeure(utc)

  return (
    <div style={{ width: 132, flexShrink: 0, backgroundColor: C.vert, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 8px' }}>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 1.3 }}>{wd}</div>
      <div style={{ fontFamily: FONT_SANS, fontWeight: 700, fontSize: 44, color: '#fff', lineHeight: 1.1, marginTop: 2 }}>{day}</div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 1.3 }}>{mo}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginTop: 10 }}>{hm}</div>
    </div>
  )
}

// ─── Carte "À venir" (mise en avant) ─────────────────────────────────────────

function FeaturedCard({ rdv, onPreparer, onAgenda, prepData }: {
  rdv:        RdvRow
  onPreparer: () => void
  onAgenda:   () => void
  prepData:   { analysed_at: string } | null
}) {
  const choisi = rdv.creneaux_rdv.find(c => c.selectionne)
  if (!choisi) return null

  const delai    = delaiRelatif(choisi.debut_utc)
  const typeChip = rdv.type === 'telephonique' ? 'Appel téléphonique' : 'Entretien'
  const typeIcon = rdv.type === 'telephonique' ? <IconPhone /> : <IconBriefcase />
  const prepLbl  = rdv.type === 'telephonique' ? 'Préparer cet appel' : 'Préparer cet entretien'
  const contextParts = [rdv.entrepriseNom, rdv.ville, rdv.recruteurNom ? `avec ${rdv.recruteurNom}` : null].filter(Boolean)
  const convHref = `/dashboard/messages?conv=${rdv.conversation_id}`
  const infoLine = rdv.type === 'telephonique'
    ? `${rdv.recruteurPrenom || rdv.recruteurNom || 'Le recruteur'} vous appellera à l’heure prévue.`
    : (rdv.contact_info ?? null)

  return (
    <div data-card-id={rdv.id} className="rdvp-featured-card" style={{ backgroundColor: C.white, borderRadius: 14, display: 'flex', overflow: 'hidden' }}>
      <ColonneDate utc={choisi.debut_utc} />
      <div style={{ flex: 1, minWidth: 0, padding: '18px 22px' }}>
        {delai && (
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.orangeTexte, backgroundColor: 'rgba(194,97,31,.1)', borderRadius: 7, padding: '2px 9px' }}>
              {delai}
            </span>
          </div>
        )}
        <div style={{ fontFamily: FONT_SANS, fontWeight: 700, fontSize: 21, color: C.dark, lineHeight: 1.2, marginBottom: 6 }}>
          {rdv.offreTitre || 'Poste non précisé'}
        </div>
        {contextParts.length > 0 && (
          <div style={{ fontSize: 14, color: C.grey, marginBottom: 12 }}>
            {contextParts.join(' · ')}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <Chip icon={typeIcon} label={typeChip} />
          <Chip icon={<IconClock />} label={`${rdv.duree_minutes} minutes`} />
        </div>
        {infoLine && (
          <div style={{ fontSize: 14, color: C.grey, marginBottom: 16 }}>{infoLine}</div>
        )}
        {!infoLine && !prepData && <div style={{ marginBottom: 16 }} />}
        {prepData && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: C.salaire, borderRadius: 8, padding: '8px 12px', marginBottom: 16, fontSize: 13.5, color: C.vert }}>
            <CheckMark color={C.vert} />
            <span>Préparation faite le {formatDateAnalyse(prepData.analysed_at)}.</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={onPreparer}
            style={{ backgroundColor: C.orange, color: '#fff', fontWeight: 600, borderRadius: 10, padding: '10px 18px', fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {prepData ? 'Revoir ma préparation' : prepLbl}
          </button>
          <button
            onClick={onAgenda}
            style={{ backgroundColor: C.white, color: C.dark, border: `1px solid ${C.sable}`, borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Ajouter à mon agenda
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Link href={convHref} style={{ fontSize: 13, fontWeight: 600, color: C.grey, textDecoration: 'none' }}>
              Voir la conversation
            </Link>
            {rdv.offreId && (
              <Link href={`/offres/${rdv.offreId}`} style={{ fontSize: 13, fontWeight: 600, color: C.grey, textDecoration: 'none' }}>
                Voir l&apos;offre
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Ligne "À venir" suivante ─────────────────────────────────────────────────

function AvenirRow({ rdv, annule, onPreparer, onAgenda, prepData }: {
  rdv:        RdvRow
  annule:     boolean
  onPreparer: () => void
  onAgenda:   () => void
  prepData:   { analysed_at: string } | null
}) {
  const choisi   = rdv.creneaux_rdv.find(c => c.selectionne)
  const dateUtc  = choisi?.debut_utc ?? dateRef(rdv)
  if (!dateUtc) return null

  const convHref  = `/dashboard/messages?conv=${rdv.conversation_id}`
  const typeLabel = rdv.type === 'telephonique' ? 'Appel téléphonique' : 'Entretien'
  const prepLbl   = rdv.type === 'telephonique' ? 'Préparer cet appel' : 'Préparer cet entretien'

  if (annule) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '132px 1fr', borderRadius: 12, border: '1px dashed #D3D8D5', overflow: 'hidden' }}>
        <div style={{ textAlign: 'center', padding: '14px 0', borderRight: `1px solid ${C.sable}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.grey, textDecoration: 'line-through' }}>{formatJourCourt(dateUtc)}</div>
          <div style={{ fontSize: 13, color: C.grey, marginTop: 2, textDecoration: 'line-through' }}>{formatHeure(dateUtc)}</div>
        </div>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: C.grey, marginBottom: 4 }}>{rdv.offreTitre || 'Poste non précisé'}</div>
          <div style={{ fontSize: 13, color: C.grey, marginBottom: 8 }}>Annulé par le recruteur. Un message vous attend peut-être dans la conversation.</div>
          <Link href={convHref} style={{ fontSize: 13, fontWeight: 600, color: C.orangeTexte, textDecoration: 'none' }}>
            Voir la conversation
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div data-card-id={rdv.id} className="rdvp-avenir-row" style={{ display: 'grid', gridTemplateColumns: '132px 1fr auto', borderRadius: 12, backgroundColor: C.white, overflow: 'hidden' }}>
      <div style={{ textAlign: 'center', padding: '14px 0', borderRight: `1px solid ${C.sable}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.dark }}>{formatJourCourt(dateUtc)}</div>
        <div style={{ fontSize: 13, color: C.grey, marginTop: 2 }}>{formatHeure(dateUtc)}</div>
      </div>
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: C.dark, marginBottom: 3 }}>{rdv.offreTitre || 'Poste non précisé'}</div>
        <div style={{ fontSize: 13, color: C.grey }}>{[rdv.entrepriseNom, `${typeLabel}, ${rdv.duree_minutes} min`].filter(Boolean).join(' · ')}</div>
      </div>
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: 8 }}>
        <button onClick={onPreparer} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.orangeTexte, fontFamily: 'inherit', padding: 0, whiteSpace: 'nowrap' }}>
          {prepData ? 'Revoir' : prepLbl}
        </button>
        <button onClick={onAgenda} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.orangeTexte, fontFamily: 'inherit', padding: 0, whiteSpace: 'nowrap' }}>
          Ajouter à mon agenda
        </button>
        <Link href={convHref} style={{ fontSize: 13, fontWeight: 600, color: C.grey, textDecoration: 'none', whiteSpace: 'nowrap' }}>
          Voir la conversation
        </Link>
      </div>
    </div>
  )
}

// ─── Ligne passé ─────────────────────────────────────────────────────────────

function PasseRow({ rdv, hasBorder }: { rdv: RdvRow; hasBorder: boolean }) {
  const dateUtc   = dateRef(rdv) ?? rdv.created_at
  const typeLabel = rdv.type === 'telephonique' ? 'Appel téléphonique' : 'Entretien'
  const etatLabel = libelleEtat(rdv)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '132px 1fr auto', alignItems: 'center', borderTop: hasBorder ? `1px solid ${C.sable}` : 'none', padding: '10px 16px 10px 0' }}>
      <div style={{ textAlign: 'center', padding: '0 8px', borderRight: `1px solid ${C.sable}` }}>
        <div style={{ fontSize: 13.5, color: C.grey }}>{formatJourCourt(dateUtc)}</div>
        <div style={{ fontSize: 13.5, color: C.grey }}>{formatHeure(dateUtc)}</div>
      </div>
      <div style={{ padding: '0 16px' }}>
        <div style={{ fontSize: 13.5, color: C.grey }}>{[rdv.offreTitre, rdv.entrepriseNom, typeLabel].filter(Boolean).join(' · ')}</div>
      </div>
      <div>
        <span style={{ fontSize: 12, color: C.grey, backgroundColor: C.chip, borderRadius: 20, padding: '2px 10px', whiteSpace: 'nowrap' }}>
          {etatLabel}
        </span>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ padding: '80px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 19, fontFamily: FONT_SANS, fontWeight: 700, letterSpacing: '-0.005em', color: C.dark, marginBottom: 8 }}>
        Aucun rendez-vous pour le moment
      </div>
      <div style={{ fontSize: 14, color: C.grey, lineHeight: 1.65 }}>
        Les recruteurs qui souhaitent vous rencontrer vous proposeront des créneaux depuis la messagerie.
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RendezVousPage() {
  const [rows,    setRows]    = useState<RdvRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeRdv, setActiveRdv] = useState<{
    id: string; dateRdv: string; typeRdv: 'telephonique' | 'entretien'
  } | null>(null)
  const [prepMap, setPrepMap] = useState<Record<string, { analysed_at: string }>>({})
  const [passesOpen, setPassesOpen] = useState(false)

  const containerRef     = useRef<HTMLDivElement>(null)
  const prevPositionsRef = useRef<Map<string, CardPos>>(new Map())
  const flipPendingRef   = useRef(false)
  const newRdvIdRef      = useRef<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // ── Rendez-vous ─────────────────────────────────────────────────────────
      const { data: rdvData, error: rdvErr } = await supabase
        .from('rendez_vous')
        .select('id, conversation_id, type, duree_minutes, contact_info, statut, created_at, creneaux_rdv(id, debut_utc, selectionne)')
        .eq('candidat_id', user.id)
        .in('statut', ['proposee', 'acceptee', 'annulee', 'refusee'])
        .order('created_at', { ascending: false })

      if (rdvErr) {
        console.error('[rendez-vous load rdv]', rdvErr.message, rdvErr.code, rdvErr.details, rdvErr.hint)
        setLoading(false)
        return
      }
      if (!rdvData?.length) { setLoading(false); return }

      // ── Conversations ───────────────────────────────────────────────────────
      const convIds = [...new Set(rdvData.map(r => r.conversation_id).filter(Boolean))]
      const { data: convData, error: convErr } = await supabase
        .from('conversations')
        .select('id, recruteur_id, offres(id, titre, entreprise_nom, ville)')
        .in('id', convIds)

      if (convErr) console.error('[rendez-vous load convs]', convErr.message, convErr.code, convErr.details, convErr.hint)

      // ── Profils recruteurs ──────────────────────────────────────────────────
      const recruteurIds = [...new Set((convData ?? []).map(c => c.recruteur_id).filter(Boolean))]
      const recruteurNomMap:    Record<string, string> = {}
      const recruteurPrenomMap: Record<string, string> = {}
      const entrepriseNomMap:   Record<string, string> = {}
      const entrepriseLogoMap:  Record<string, string> = {}

      if (recruteurIds.length > 0) {
        const { data: profilData } = await supabase
          .from('profils_vue_publique')
          .select('user_id, prenom, nom, entreprise_nom, entreprise_logo_url')
          .in('user_id', recruteurIds)
        for (const p of profilData ?? []) {
          const nom = [p.prenom, p.nom].filter(Boolean).join(' ')
          if (nom)                   recruteurNomMap[p.user_id]    = nom
          if (p.prenom)              recruteurPrenomMap[p.user_id] = p.prenom
          if (p.entreprise_nom)      entrepriseNomMap[p.user_id]   = p.entreprise_nom
          if (p.entreprise_logo_url) entrepriseLogoMap[p.user_id]  = p.entreprise_logo_url
        }
      }

      type ConvEntry = {
        offreTitre: string; offreId: string; ville: string | null
        entrepriseNom: string; entrepriseLogoUrl: string | null
        recruteurNom: string; recruteurPrenom: string
      }
      const convMap: Record<string, ConvEntry> = {}
      for (const c of convData ?? []) {
        const offre = c.offres as { id?: string; titre?: string; entreprise_nom?: string; ville?: string } | null
        convMap[c.id] = {
          offreTitre:        offre?.titre           ?? '',
          offreId:           offre?.id              ?? '',
          ville:             offre?.ville            ?? null,
          entrepriseNom:     entrepriseNomMap[c.recruteur_id]  || offre?.entreprise_nom || '',
          entrepriseLogoUrl: entrepriseLogoMap[c.recruteur_id] ?? null,
          recruteurNom:      recruteurNomMap[c.recruteur_id]   ?? '',
          recruteurPrenom:   recruteurPrenomMap[c.recruteur_id] ?? '',
        }
      }

      const fallback: ConvEntry = { offreTitre: '', offreId: '', ville: null, entrepriseNom: '', entrepriseLogoUrl: null, recruteurNom: '', recruteurPrenom: '' }
      setRows(
        (rdvData as unknown as Omit<RdvRow, 'offreTitre' | 'offreId' | 'ville' | 'entrepriseNom' | 'entrepriseLogoUrl' | 'recruteurNom' | 'recruteurPrenom'>[])
          .map(r => ({ ...r, ...(convMap[r.conversation_id] ?? fallback) }))
      )
      setLoading(false)
    }
    load()
  }, [])

  // ── Sections ─────────────────────────────────────────────────────────────
  const attente = rows.filter(r => classify(r) === 'attente')
  const avenir  = rows.filter(r => classify(r) === 'avenir')
  const passes  = rows.filter(r => classify(r) === 'passes')

  const avenirSorted = useMemo(
    () => [...avenir].sort((a, b) => dateRefMs(a) - dateRefMs(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [avenir.map(r => r.id).join(',')]
  )
  const featuredIdx  = avenirSorted.findIndex(r => r.statut !== 'annulee')
  const featuredRdv  = featuredIdx >= 0 ? avenirSorted[featuredIdx] : null
  const avenirRows   = featuredIdx >= 0
    ? avenirSorted.filter((_, i) => i !== featuredIdx)
    : avenirSorted

  const passesSorted = useMemo(
    () => [...passes].sort((a, b) => dateRefMs(b) - dateRefMs(a)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [passes.map(r => r.id).join(',')]
  )

  const confirmedDates = useMemo(() => {
    const opts = { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' } as const
    return avenir
      .filter(r => r.statut === 'acceptee')
      .flatMap(r => {
        const choisi = r.creneaux_rdv.find(c => c.selectionne)
        if (!choisi) return []
        return [{
          jourParis: new Date(choisi.debut_utc).toLocaleDateString('fr-FR', opts),
          type: r.type as 'telephonique' | 'entretien',
          heure: formatHeure(choisi.debut_utc),
        }]
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avenir.map(r => r.id + r.statut).join(',')])

  useEffect(() => {
    const rdvsToFetch = avenirSorted.filter(r => r.statut !== 'annulee').slice(0, 5)
    if (!rdvsToFetch.length) return
    async function fetchPreps() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const results = await Promise.all(
        rdvsToFetch.map(async r => {
          try {
            const res = await fetch(`/api/prep-entretien?rdv_id=${encodeURIComponent(r.id)}`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            })
            if (!res.ok) return null
            const data = await res.json() as { reponse?: string; analysed_at?: string }
            return data.analysed_at ? { id: r.id, analysed_at: data.analysed_at } : null
          } catch {
            return null
          }
        })
      )
      const map: Record<string, { analysed_at: string }> = {}
      for (const r of results) {
        if (r) map[r.id] = { analysed_at: r.analysed_at }
      }
      setPrepMap(map)
    }
    fetchPreps()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avenirSorted.map(r => r.id).join(',')])

  useEffect(() => {
    if (loading || !containerRef.current) return
    const cards = Array.from(containerRef.current.querySelectorAll<HTMLElement>('[data-card-id]'))
    prevPositionsRef.current = animerCartes(cards, new Map<string, CardPos>())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  useLayoutEffect(() => {
    if (!flipPendingRef.current || !containerRef.current) return
    flipPendingRef.current = false
    const cards = Array.from(containerRef.current.querySelectorAll<HTMLElement>('[data-card-id]'))
    prevPositionsRef.current = animerCartes(cards, prevPositionsRef.current)
    if (newRdvIdRef.current) {
      const newCard = containerRef.current.querySelector<HTMLElement>(`[data-card-id="${newRdvIdRef.current}"]`)
      if (newCard && !reduitMouvement()) {
        newCard.classList.add('rdvp-new-card')
        setTimeout(() => newCard.classList.remove('rdvp-new-card'), 1600)
      }
      newRdvIdRef.current = null
    }
  })

  const isEmpty = !loading && attente.length === 0 && avenir.length === 0 && passes.length === 0

  // ── Sous-titre ────────────────────────────────────────────────────────────
  const subtitle = useMemo(() => {
    const nAtt = attente.length
    const nAv  = avenir.filter(r => r.statut !== 'annulee').length
    const parts: string[] = []
    if (nAtt > 0) parts.push(nAtt === 1 ? 'Une proposition attend votre réponse' : `${nAtt} propositions attendent votre réponse`)
    if (nAv  > 0) parts.push(`${nAv} rendez-vous à venir`)
    return parts.length > 0 ? parts.join(', ') + '.' : null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attente.length, avenir.length])

  // ── Callbacks ─────────────────────────────────────────────────────────────
  function telechargerIcs(rdv: RdvRow) {
    const choisi = rdv.creneaux_rdv.find(c => c.selectionne)
    if (!choisi) return
    const icsText = genererIcs({
      rdvId:         rdv.id,
      type:          rdv.type,
      dureeMinutes:  rdv.duree_minutes,
      entrepriseNom: rdv.entrepriseNom,
      recruteurNom:  rdv.recruteurNom,
      offreTitre:    rdv.offreTitre,
      contactInfo:   rdv.contact_info,
      debutUtc:      choisi.debut_utc,
    })
    const jourIso = new Date(choisi.debut_utc)
      .toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/Paris' })
      .split('/').reverse().join('-')
    const filename = sanitizeFilename(`rendez-vous-${rdv.entrepriseNom}-${jourIso}.ics`)
    const blob = new Blob([icsText], { type: 'text/calendar' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleConfirme(rdvId: string, creneauId: string) {
    if (containerRef.current) {
      const cards = Array.from(containerRef.current.querySelectorAll<HTMLElement>('[data-card-id]'))
      const before = new Map<string, CardPos>()
      cards.forEach(c => { const id = c.dataset.cardId; if (id) before.set(id, { top: c.offsetTop, left: c.offsetLeft }) })
      prevPositionsRef.current = before
      flipPendingRef.current   = true
      newRdvIdRef.current      = rdvId
    }
    setRows(prev => prev.map(r =>
      r.id !== rdvId ? r : {
        ...r, statut: 'acceptee',
        creneaux_rdv: r.creneaux_rdv.map(c => ({ ...c, selectionne: c.id === creneauId })),
      }
    ))
    window.dispatchEvent(new Event('rdv-confirme'))
  }

  async function handleReload(rdvId: string) {
    const { data } = await supabase
      .from('rendez_vous')
      .select('id, conversation_id, type, duree_minutes, contact_info, statut, created_at, creneaux_rdv(id, debut_utc, selectionne)')
      .eq('id', rdvId)
      .single()
    setRows(prev => {
      if (!data) return prev.filter(r => r.id !== rdvId)
      const existing = prev.find(r => r.id === rdvId)
      if (!existing) return prev
      return prev.map(r =>
        r.id !== rdvId ? r : {
          ...r,
          statut:       (data as unknown as RdvRow).statut,
          contact_info: (data as unknown as RdvRow).contact_info,
          creneaux_rdv: (data as unknown as RdvRow).creneaux_rdv,
        }
      )
    })
  }

  function handleRefuse(rdvId: string) {
    setRows(prev => prev.map(r =>
      r.id !== rdvId ? r : { ...r, statut: 'refusee' }
    ))
    window.dispatchEvent(new Event('rdv-confirme'))
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main style={{ backgroundColor: C.bg, minHeight: '100vh' }}>
      <style suppressHydrationWarning>{`
        @keyframes rdvp-spin { to { transform: rotate(360deg) } }
        @keyframes rdvp-draw { from { stroke-dashoffset: 16 } to { stroke-dashoffset: 0 } }
        @keyframes rdvp-new-outline {
          0%   { box-shadow: 0 0 0 2px ${C.vert}, 0 1px 2px rgba(27,48,38,.06), 0 6px 16px rgba(27,48,38,.07); }
          100% { box-shadow: 0 0 0 0px transparent, 0 1px 2px rgba(27,48,38,.06), 0 6px 16px rgba(27,48,38,.07); }
        }
        .rdvp-featured-card { box-shadow: 0 1px 2px rgba(27,48,38,.06), 0 6px 16px rgba(27,48,38,.07); transition: transform 180ms ease, box-shadow 180ms ease; }
        .rdvp-featured-card:hover { transform: translateY(-2px); box-shadow: 0 2px 4px rgba(27,48,38,.08), 0 12px 28px rgba(27,48,38,.12); }
        .rdvp-avenir-row { box-shadow: 0 1px 2px rgba(27,48,38,.06), 0 6px 16px rgba(27,48,38,.07); transition: transform 180ms ease, box-shadow 180ms ease; }
        .rdvp-avenir-row:hover { transform: translateY(-2px); box-shadow: 0 2px 4px rgba(27,48,38,.08), 0 12px 28px rgba(27,48,38,.12); }
        .rdvp-creneau-btn { transition: transform 120ms; }
        .rdvp-creneau-btn:active { transform: scale(0.97); }
        .rdvp-new-card { animation: rdvp-new-outline 1.6s ease forwards; }
        .rdvp-chevron { transition: transform 0.2s; display: inline-flex; }
        .rdvp-passes-content { overflow: hidden; max-height: 0; opacity: 0; transition: max-height 280ms ${EASE}, opacity 280ms ${EASE}; }
        .rdvp-passes-open { max-height: 2000px; opacity: 1; }
        @media (prefers-reduced-motion: reduce) { .rdvp-featured-card, .rdvp-avenir-row, .rdvp-creneau-btn, .rdvp-chevron, .rdvp-passes-content { transition: none; } .rdvp-featured-card:hover, .rdvp-avenir-row:hover { transform: none; } }
      `}</style>

      <div ref={containerRef} style={{ maxWidth: 980, margin: '0 auto', padding: '28px 36px 60px' }}>

        {/* ── En-tête ──────────────────────────────────────────────────── */}
        <h1 style={{ fontFamily: FONT_SANS, letterSpacing: '-0.005em', fontSize: 28, fontWeight: 700, color: C.dark, margin: '0 0 6px' }}>
          Mes rendez-vous
        </h1>
        <div style={{ marginBottom: 28 }}>
          {!loading && subtitle && (
            <p style={{ fontSize: 14, color: C.grey, margin: 0 }}>{subtitle}</p>
          )}
        </div>

        {/* ── Chargement ───────────────────────────────────────────────── */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2.5px solid ${C.sable}`, borderTopColor: C.orange, animation: 'rdvp-spin 0.7s linear infinite' }} />
          </div>
        )}

        {/* ── État vide ────────────────────────────────────────────────── */}
        {isEmpty && <EmptyState />}

        {/* ── Section À confirmer ──────────────────────────────────────── */}
        {!loading && attente.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
              <span style={{ fontFamily: FONT_SANS, letterSpacing: '-0.005em', fontSize: 17, fontWeight: 600, color: C.dark }}>À confirmer</span>
              <span style={{ fontSize: 13, color: C.grey, fontWeight: 400 }}>{attente.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {attente.map(rdv => (
                <AttenteCard key={rdv.id} rdv={rdv} onConfirme={handleConfirme} onReload={handleReload} onRefuse={handleRefuse} confirmedDates={confirmedDates} />
              ))}
            </div>
          </section>
        )}

        {/* ── Section À venir ──────────────────────────────────────────── */}
        {!loading && avenir.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
              <span style={{ fontFamily: FONT_SANS, letterSpacing: '-0.005em', fontSize: 17, fontWeight: 600, color: C.dark }}>À venir</span>
              <span style={{ fontSize: 13, color: C.grey, fontWeight: 400 }}>{avenir.filter(r => r.statut !== 'annulee').length}</span>
            </div>

            {featuredRdv && (
              <div style={{ marginBottom: avenirRows.length > 0 ? 12 : 0 }}>
                <FeaturedCard
                  rdv={featuredRdv}
                  onPreparer={() => {
                    const choisi = featuredRdv.creneaux_rdv.find(c => c.selectionne)
                    setActiveRdv({ id: featuredRdv.id, dateRdv: choisi?.debut_utc ?? '', typeRdv: featuredRdv.type })
                  }}
                  onAgenda={() => telechargerIcs(featuredRdv)}
                  prepData={prepMap[featuredRdv.id] ?? null}
                />
              </div>
            )}

            {avenirRows.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {avenirRows.map(rdv => (
                  <AvenirRow
                    key={rdv.id}
                    rdv={rdv}
                    annule={rdv.statut === 'annulee'}
                    onPreparer={() => {
                      const choisi = rdv.creneaux_rdv.find(c => c.selectionne)
                      setActiveRdv({ id: rdv.id, dateRdv: choisi?.debut_utc ?? '', typeRdv: rdv.type })
                    }}
                    onAgenda={() => telechargerIcs(rdv)}
                    prepData={prepMap[rdv.id] ?? null}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Section Passés ───────────────────────────────────────────── */}
        {!loading && passes.length > 0 && (
          <div data-card-id="passes">
            <button
              onClick={() => setPassesOpen(p => !p)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0' }}
            >
              <span className="rdvp-chevron" style={{ transform: passesOpen ? 'rotate(90deg)' : undefined }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.grey} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.grey }}>
                Rendez-vous passés ({passes.length})
              </span>
            </button>
            <div className={`rdvp-passes-content${passesOpen ? ' rdvp-passes-open' : ''}`}>
              <div style={{ marginTop: 10, backgroundColor: C.white, borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, overflow: 'hidden', padding: '0 16px' }}>
                {passesSorted.map((rdv, i) => (
                  <PasseRow key={rdv.id} rdv={rdv} hasBorder={i > 0} />
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {activeRdv && (
        <AssistantPrepEntretien
          key={activeRdv.id}
          rdvId={activeRdv.id}
          dateRdv={activeRdv.dateRdv}
          typeRdv={activeRdv.typeRdv}
          onClose={() => setActiveRdv(null)}
        />
      )}
    </main>
  )
}
