'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { FONT_SERIF } from '@/lib/typography'
import { notifRdvAnnule } from '@/lib/actions/email-notifs'

const C = {
  terracotta: '#C4673A',
  sable:      '#E7EAE8',
  creme:      '#F6F7F6',
  dark:       '#15201B',
  grey:       '#687069',
  lightGrey:  '#C8C8C8',
  white:      '#FFFFFF',
  red:        '#C0392B',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Creneau = { id: string; debut_utc: string; selectionne: boolean }

type RdvDetail = {
  id:              string
  type:            'telephonique' | 'entretien'
  duree_minutes:   number
  contact_info:    string | null
  statut:          'proposee' | 'acceptee'
  created_at:      string
  candidat_id:     string | null
  conversation_id: string
  creneaux_rdv:    Creneau[]
}

type ProfilDetail = {
  prenom:      string | null
  nom:         string | null
  domaine:     string | null
  avatar_url:  string | null
  avatar_type: string | null
} | null

type OffreDetail = { id: string; titre: string } | null

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateLongue(utc: string): string {
  const d = new Date(utc)
  const jour = d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${jour} a ${heure}`
}

function tempsRelatif(isoDate: string): string {
  const ms    = Date.now() - new Date(isoDate).getTime()
  const min   = Math.floor(ms / 60000)
  const h     = Math.floor(min / 60)
  const jours = Math.floor(h / 24)
  if (jours >= 1) return `proposee il y a ${jours} jour${jours > 1 ? 's' : ''}`
  if (h    >= 1)  return `proposee il y a ${h} heure${h > 1 ? 's' : ''}`
  if (min  >= 1)  return `proposee il y a ${min} minute${min > 1 ? 's' : ''}`
  return "proposee il y a moins d'une minute"
}

function capitaliser(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function nomComplet(p: ProfilDetail): string {
  if (!p) return 'Candidat supprime'
  return [p.prenom, p.nom].filter(Boolean).join(' ') || 'Candidat'
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ profil, taille = 44 }: { profil: ProfilDetail; taille?: number }) {
  const base: React.CSSProperties = {
    width: taille, height: taille, borderRadius: '50%',
    flexShrink: 0, overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  if (!profil) {
    return (
      <div style={{ ...base, backgroundColor: C.lightGrey }}>
        <svg width={Math.round(taille * 0.52)} height={Math.round(taille * 0.52)}
          viewBox="0 0 24 24" fill="none"
          stroke={C.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
    )
  }

  const type = profil.avatar_type ?? 'initiales'
  const url  = profil.avatar_url

  if (type === 'photo' && url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" style={{ ...base, objectFit: 'cover' as const }} />
  }

  if (type === 'avatar' && url) {
    return (
      <div style={{ ...base, backgroundColor: C.creme, fontSize: Math.round(taille * 0.55) }}>
        {url}
      </div>
    )
  }

  const bg       = url && url.startsWith('#') ? url : C.terracotta
  const initiales = ((profil.prenom?.[0] ?? '') + (profil.nom?.[0] ?? '')).toUpperCase() || '?'
  return (
    <div style={{ ...base, backgroundColor: bg, color: C.white, fontSize: Math.round(taille * 0.38), fontWeight: 700 }}>
      {initiales}
    </div>
  )
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: C.grey,
        textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 5,
      }}>
        {titre}
      </div>
      {children}
    </div>
  )
}

function BoutonLien({ href, label }: { href: string; label: string }) {
  const [hov, setHov] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '9px 0', borderRadius: 10, fontSize: 12, fontWeight: 600,
        border: 'none',
        backgroundColor: hov ? '#B35830' : C.terracotta,
        color: C.creme,
        textDecoration: 'none', flex: 1, textAlign: 'center' as const,
        transition: 'background-color 0.15s',
      }}
    >
      {label}
    </Link>
  )
}

// ─── Panneau principal ────────────────────────────────────────────────────────

type PanneauProps = {
  rdvId:     string | null
  onClose:   () => void
  onAnnulee: (rdvId: string) => void
}

export default function PanneauRdv({ rdvId, onClose, onAnnulee }: PanneauProps) {
  const [rdv,                 setRdv]                 = useState<RdvDetail | null>(null)
  const [profil,              setProfil]              = useState<ProfilDetail>(null)
  const [offre,               setOffre]               = useState<OffreDetail>(null)
  const [loading,             setLoading]             = useState(false)
  const [erreur,              setErreur]              = useState<string | null>(null)
  const [acting,              setActing]              = useState(false)
  const [confirmerAnnulation, setConfirmerAnnulation] = useState(false)
  const [visible,             setVisible]             = useState(false)

  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  // Déclenchement de l'animation d'entrée
  useEffect(() => {
    if (rdvId) {
      const t = setTimeout(() => setVisible(true), 16)
      return () => clearTimeout(t)
    }
    setVisible(false)
  }, [rdvId])

  // Chargement des données à chaque changement de rdvId
  useEffect(() => {
    if (!rdvId) {
      setRdv(null); setProfil(null); setOffre(null)
      setErreur(null); setConfirmerAnnulation(false)
      return
    }

    let annule = false
    setLoading(true)
    setErreur(null)
    setConfirmerAnnulation(false)
    setRdv(null); setProfil(null); setOffre(null)

    async function charger() {
      // 1. Rendez-vous complet
      const { data: rdvData, error: rdvErr } = await supabase
        .from('rendez_vous')
        .select('id, type, duree_minutes, contact_info, statut, created_at, candidat_id, conversation_id, creneaux_rdv(id, debut_utc, selectionne)')
        .eq('id', rdvId)
        .single()

      if (rdvErr) {
        console.error('[panneau rdv]', rdvErr.message, rdvErr.code, rdvErr.details, rdvErr.hint)
        if (!annule) { setErreur('Impossible de charger ce rendez-vous.'); setLoading(false) }
        return
      }

      const r = rdvData as unknown as RdvDetail
      if (!annule) setRdv(r)

      // 2. Profil du candidat + conversation en parallèle
      const [profilRes, convRes] = await Promise.all([
        r.candidat_id
          ? supabase
              .from('profils')
              .select('prenom, nom, domaine, avatar_url, avatar_type')
              .eq('user_id', r.candidat_id)
              .single()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from('conversations')
          .select('offre_id')
          .eq('id', r.conversation_id)
          .single(),
      ])

      // PGRST116 = aucune ligne trouvée (candidat supprimé) — pas une erreur fatale
      if (profilRes.error && profilRes.error.code !== 'PGRST116') {
        console.error('[panneau profil]', profilRes.error.message, profilRes.error.code, profilRes.error.details, profilRes.error.hint)
      }
      if (convRes.error) {
        console.error('[panneau conv]', convRes.error.message, convRes.error.code, convRes.error.details, convRes.error.hint)
      }

      if (!annule) setProfil(profilRes.data as ProfilDetail ?? null)

      const offreId = (convRes.data as { offre_id?: string | null } | null)?.offre_id ?? null

      // 3. Offre si présente
      if (offreId) {
        const { data: offreData, error: offreErr } = await supabase
          .from('offres')
          .select('id, titre')
          .eq('id', offreId)
          .single()
        if (offreErr) {
          console.error('[panneau offre]', offreErr.message, offreErr.code, offreErr.details, offreErr.hint)
        } else if (!annule) {
          setOffre(offreData as OffreDetail)
        }
      }

      if (!annule) setLoading(false)
    }

    charger()
    return () => { annule = true }
  }, [rdvId])

  // Fermeture par Echap (ref pour éviter des réabonnements à chaque render)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  async function annuler() {
    if (!rdv || acting) return
    setActing(true)
    const statutAvant = rdv.statut
    const { error } = await supabase
      .from('rendez_vous')
      .update({ statut: 'annulee' })
      .eq('id', rdv.id)
    if (error) {
      console.error('[panneau annuler]', error.message, error.code, error.details, error.hint)
      setActing(false)
      return
    }
    notifRdvAnnule(rdv.id, statutAvant).catch(e => console.error('[notif rdv-annule]', e))
    onAnnulee(rdv.id)
    onClose()
  }

  const ouvert = visible && !!rdvId

  const creneauxTries = rdv
    ? [...rdv.creneaux_rdv].sort((a, b) => new Date(a.debut_utc).getTime() - new Date(b.debut_utc).getTime())
    : []
  const creneauConfirme = creneauxTries.find(c => c.selectionne) ?? null
  const confirme        = rdv?.statut === 'acceptee'
  const candidatSupprime = !rdv?.candidat_id || !profil

  return (
    <>
      {/* Fond semi-transparent */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          backgroundColor: 'rgba(26, 26, 26, 0.35)',
          opacity: ouvert ? 1 : 0,
          transition: 'opacity 0.22s',
          pointerEvents: ouvert ? 'auto' : 'none',
        }}
      />

      {/* Panneau glissant */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
          width: 420, backgroundColor: C.white,
          boxShadow: '-4px 0 24px rgba(0,0,0,0.10)',
          display: 'flex', flexDirection: 'column',
          transform: ouvert ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* En-tete */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '16px 20px', borderBottom: `1px solid ${C.sable}`,
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: FONT_SERIF, fontSize: 16, color: C.dark, fontWeight: 600 }}>
            Rendez-vous
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: 'none', background: 'none', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: C.grey,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6"  y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Corps scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px' }}>
          <style suppressHydrationWarning>{`@keyframes pan-sp{to{transform:rotate(360deg)}}`}</style>

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                border: `2.5px solid ${C.sable}`, borderTopColor: C.terracotta,
                animation: 'pan-sp 0.7s linear infinite',
              }} />
            </div>
          )}

          {erreur && (
            <div style={{ fontSize: 13, color: C.grey, padding: '24px 0', lineHeight: 1.65 }}>
              {erreur}
            </div>
          )}

          {!loading && !erreur && rdv && (
            <>
              {/* Bloc candidat */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px', backgroundColor: C.creme, borderRadius: 12,
                marginBottom: 20,
              }}>
                <Avatar profil={profil} taille={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 700, color: C.dark, lineHeight: 1.25,
                    fontStyle: candidatSupprime ? 'italic' : 'normal',
                  }}>
                    {nomComplet(profil)}
                  </div>
                  {profil?.domaine && (
                    <div style={{ fontSize: 12, color: C.grey, marginTop: 2 }}>
                      {profil.domaine}
                    </div>
                  )}
                </div>
              </div>

              {/* Type et duree */}
              <Section titre="Type et duree">
                <span style={{ fontSize: 13, color: C.dark }}>
                  {rdv.type === 'telephonique' ? 'Appel telephonique' : 'Entretien'}, {rdv.duree_minutes} minutes
                </span>
              </Section>

              {/* Date et heure (confirme uniquement) */}
              {confirme && creneauConfirme && (
                <Section titre="Date et heure">
                  <span style={{ fontSize: 13, color: C.dark, lineHeight: 1.65 }}>
                    {capitaliser(formatDateLongue(creneauConfirme.debut_utc))}
                  </span>
                </Section>
              )}

              {/* Coordonnees (confirme uniquement) */}
              {confirme && rdv.contact_info && (
                <Section titre={rdv.type === 'telephonique' ? 'Numero' : 'Lieu'}>
                  <span style={{ fontSize: 13, color: C.dark }}>{rdv.contact_info}</span>
                </Section>
              )}

              {/* Creneaux proposes (en attente) */}
              {!confirme && (
                <Section titre={`Creneaux proposes (${creneauxTries.length})`}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {creneauxTries.map(c => (
                      <div key={c.id} style={{ fontSize: 13, color: C.dark, lineHeight: 1.65 }}>
                        {capitaliser(formatDateLongue(c.debut_utc))}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Depuis quand (en attente) */}
              {!confirme && rdv.created_at && (
                <div style={{ fontSize: 12, color: C.grey, marginBottom: 16, fontStyle: 'italic' }}>
                  {capitaliser(tempsRelatif(rdv.created_at))}
                </div>
              )}

              {/* Offre concernee */}
              {offre && (
                <Section titre="Offre concernee">
                  <span style={{ fontSize: 13, color: C.dark }}>{offre.titre}</span>
                </Section>
              )}

              {/* Boutons d'acces */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                {!candidatSupprime && rdv.candidat_id && (
                  <BoutonLien
                    href={`/recruteur/candidats/${rdv.candidat_id}`}
                    label="Profil"
                  />
                )}
                {offre && (
                  <BoutonLien href={`/recruteur/offres/${offre.id}`} label="Offre" />
                )}
                <BoutonLien
                  href={`/recruteur/messages?conv=${rdv.conversation_id}`}
                  label="Conversation"
                />
              </div>
            </>
          )}
        </div>

        {/* Pied — annulation */}
        {!loading && !erreur && rdv && (
          <div style={{
            flexShrink: 0, borderTop: `1px solid ${C.sable}`,
            padding: '14px 20px',
          }}>
            {!confirmerAnnulation ? (
              <button
                onClick={() => setConfirmerAnnulation(true)}
                disabled={acting}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 10,
                  border: '1.5px solid rgba(192, 57, 43, 0.2)',
                  backgroundColor: '#FBEAEA',
                  color: C.red, fontSize: 13, fontWeight: 600,
                  cursor: acting ? 'default' : 'pointer',
                  fontFamily: 'inherit', opacity: acting ? 0.5 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                Annuler le rendez-vous
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 13, color: C.dark, textAlign: 'center' as const, fontWeight: 500 }}>
                  Confirmer l'annulation ?
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setConfirmerAnnulation(false)}
                    disabled={acting}
                    style={{
                      flex: 1, padding: '9px 0', borderRadius: 10,
                      border: `1.5px solid ${C.sable}`,
                      backgroundColor: 'transparent', color: C.dark,
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'inherit', opacity: acting ? 0.5 : 1,
                    }}
                  >
                    Conserver
                  </button>
                  <button
                    onClick={annuler}
                    disabled={acting}
                    style={{
                      flex: 1, padding: '9px 0', borderRadius: 10,
                      border: 'none', backgroundColor: C.red, color: C.white,
                      fontSize: 13, fontWeight: 600,
                      cursor: acting ? 'default' : 'pointer',
                      fontFamily: 'inherit', opacity: acting ? 0.5 : 1,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    {acting ? 'En cours...' : 'Oui, annuler'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
