'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FONT_SERIF } from '@/lib/typography'
import { trouverConversation } from '@/lib/conversations'
import Avatar from '@/components/Avatar'
import LogoKapolia from '@/components/LogoKapolia'
import { LANGUES } from '@/lib/langues'
import { COMP_REF, DOMAINES, EXPERIENCES, PREFERENCES_TELETRAVAIL, PERMIS } from '@/lib/referentiels'
import CartePresentation from '@/components/profil/CartePresentation'
import CarteRecherche from '@/components/profil/CarteRecherche'
import CarteParcours, { type ParcoursExpEdit, type ParcoursDiplomeEdit } from '@/components/profil/CarteParcours'
import CarteQualites from '@/components/profil/CarteQualites'
import CarteCompetences from '@/components/profil/CarteCompetences'
import CarteProjet from '@/components/profil/CarteProjet'
import { anneesExperience, lireMoisAnnee, ecrireMoisAnnee, type PosteParcours } from '@/lib/parcours'
import CarteParcoursView from '@/components/profil/Parcours'
import { QUALITE_LABELS } from '@/lib/test-qualites'
import { iconePassion, PASSIONS_SUGGESTIONS } from '@/components/profil/IconesPassions'
import MissionsTextArea from '@/components/MissionsTextArea'
import SignatureCounter from '@/components/SignatureCounter'
import { MAX_SIGNATURE, MAX_PROJET_TITRE, MAX_PROJET_DESC } from '@/lib/constants'
import InvitationModal, { type ActiveInvitation } from '@/components/InvitationModal'
import AssistantProfilPanel from '@/components/AssistantProfilPanel'
import { C, CARD_RADIUS, CARD_SHADOW } from '@/lib/colors'
import { sanitizeFilename, normalizeText } from '@/lib/storage-utils'


function isFromRef(comp: string): boolean {
  return Object.values(COMP_REF).some(list => list.includes(comp))
}

// ─── Palette ──────────────────────────────────────────────────────────────────

// ─── Types ────────────────────────────────────────────────────────────────────

type CarteType = 'presentation' | 'recherche' | 'parcours' | 'qualites' | 'competences' | 'projet' | 'priorites' | 'passions' | 'liens'

type ProfilExperience = {
  poste: string; entreprise: string
  date_debut: string; date_fin: string; en_poste: boolean; missions: string
  debut_annee?: number | null; debut_mois?: number | null
  fin_annee?: number | null; fin_mois?: number | null
  date_a_verifier?: boolean | null
}

type ProfilDiplome = {
  intitule: string; ecole: string; annee: string; mention?: string
  en_cours?: boolean; debut_annee?: number | null; annee_debut?: string | null
}

type Lien = { intitule: string; url: string }

type ReponseGroupe = {
  reponse_id:    string
  prenom_proche: string
  lien:          string
  qualites:      string[]
}

const LIEN_LABELS: Record<string, string> = {
  ami:             'ami(e)',
  collegue:        'collègue',
  ancien_manager:  'ancien manager',
  famille:         'famille',
  autre:           'autre',
}

function formatExpiry(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

type Profil = {
  prenom: string; nom: string; domaine?: string; experience?: string
  signature?: string; qualites?: string[]; type_entreprise?: string[]
  valeur?: string; projet_phare?: string; passions?: string[]
  type_poste?: string[]; mode_travail?: string; disponibilite?: string | null
  dispo_date?: string | null; priorites?: string[]
  ville?: string; competences?: string[]; competences_bonus?: string[]
  portfolio?: string; user_id?: string
  experiences?: ProfilExperience[]; diplomes?: ProfilDiplome[]
  competences_acquises?: string[]; langues?: string[]
  projet_titre?: string; projet_impact?: string; projet_resultat?: string | null; projet_lien?: string
  projet_images?: string[]; projet_video_url?: string
  avatar_url?: string; avatar_type?: string
  telephone?: string | null
  linkedin_url?: string; portfolio_url?: string
  plus_grande_reussite?: string
  ce_que_je_veux_apprendre?: string
  derniere_maj_profil?: string
  video_presentation_url?: string | null
  video_miroir?: boolean | null
  qualites_test?: Record<string, number> | null
  liens?: Lien[] | null
  metier?: string | null
  permis?: string[] | null
}

// Colonnes sélectionnées selon le contexte d'affichage.
// Propriétaire : liste complète, incluant telephone et les préférences privées.
// Visiteur (recruteur) : même liste sans telephone, email_notifications,
// messages_recruteurs ni visible_candidatheque — ces colonnes ne transitent
// pas dans la réponse réseau, indépendamment de ce qui est rendu à l'écran.
const COLONNES_PROPRIETAIRE = [
  'user_id', 'prenom', 'nom', 'domaine', 'experience', 'signature',
  'qualites', 'type_entreprise', 'valeur', 'projet_phare', 'passions',
  'type_poste', 'mode_travail', 'disponibilite', 'dispo_date', 'priorites',
  'ville',
  'experiences', 'diplomes', 'competences_acquises', 'langues',
  'projet_titre', 'projet_impact', 'projet_resultat', 'projet_lien', 'projet_images', 'projet_video_url',
  'avatar_url', 'avatar_type', 'telephone', 'linkedin_url', 'portfolio_url',
  'plus_grande_reussite', 'ce_que_je_veux_apprendre', 'derniere_maj_profil',
  'video_presentation_url', 'video_miroir', 'qualites_test', 'liens',
  'metier', 'permis',
  'email_notifications', 'messages_recruteurs', 'visible_candidatheque',
].join(', ')

const COLONNES_VISITEUR = [
  'user_id', 'prenom', 'nom', 'domaine', 'experience', 'signature',
  'qualites', 'type_entreprise', 'valeur', 'projet_phare', 'passions',
  'type_poste', 'mode_travail', 'disponibilite', 'dispo_date', 'priorites',
  'ville',
  'experiences', 'diplomes', 'competences_acquises', 'langues',
  'projet_titre', 'projet_impact', 'projet_resultat', 'projet_lien', 'projet_images', 'projet_video_url',
  'avatar_url', 'avatar_type', 'linkedin_url', 'portfolio_url',
  'plus_grande_reussite', 'ce_que_je_veux_apprendre', 'derniere_maj_profil',
  'video_presentation_url', 'video_miroir', 'qualites_test', 'liens',
  'metier', 'permis',
].join(', ')

// ─── Lookup maps ──────────────────────────────────────────────────────────────

const ENVIRONNEMENT_MAP: Record<string, string> = {
  startup: 'Startup agile', scaleup: 'Scale-up', corporate: 'Grand groupe', indep: 'Indépendant(e)',
  sans_pref: 'Sans préférence',
}


const TYPE_POSTE_MAP: Record<string, string> = {
  cdi: 'CDI', cdd: 'CDD', freelance: 'Freelance / Mission', alternance: 'Alternance / Stage', ouvert: 'Ouvert(e) à tout',
}

const LIEU_MAP: Record<string, string> = Object.fromEntries(
  PREFERENCES_TELETRAVAIL.map(p => [p.key, p.label])
)

const PRIORITES = [
  'Impact réel', 'Équipe soudée', 'Salaire compétitif',
  'Évolution rapide', 'Sens & mission', 'Flexibilité horaire',
  'Apprentissage continu', 'Autonomie', 'Stabilité',
]

const DISPO_OPTIONS = [
  { key: 'maintenant',      label: 'Disponible maintenant', color: C.succes },
  { key: 'a_partir_de',    label: 'À partir de…',          color: C.attente },
  { key: 'non_disponible', label: 'Non disponible',         color: C.erreur },
]

const MOIS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]

const NIVEAUX_LANGUE = ['Natif', 'Courant', 'Intermédiaire', 'Débutant']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(prenom: string, nom: string) {
  return `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase()
}

function getDispoStatus(dispo?: string | null, dispoDate?: string | null): { color: string; label: string } {
  if (dispo === 'non_disponible') return { color: C.erreur, label: 'Non disponible' }
  if (dispo === 'a_partir_de') {
    if (dispoDate) {
      const d = new Date(dispoDate + 'T00:00:00')
      const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      return { color: C.attente, label: `À partir de ${label}` }
    }
    return { color: C.attente, label: 'Disponible prochainement' }
  }
  if (dispo === 'maintenant') return { color: C.succes, label: 'Disponible maintenant' }
  return { color: C.succes, label: 'Disponible' }
}

// ─── Recording helpers ────────────────────────────────────────────────────────

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  for (const t of ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

// ─── Profil activity ──────────────────────────────────────────────────────────

function getProfilActivity(dateStr?: string): { label: string; isActif: boolean } {
  if (!dateStr) return { label: '', isActif: false }
  const diffMs   = Date.now() - new Date(dateStr).getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)
  let label: string
  if (diffDays === 0)       label = "Profil mis à jour aujourd'hui"
  else if (diffDays === 1)  label = 'Profil mis à jour hier'
  else if (diffDays < 7)   label = `Profil mis à jour il y a ${diffDays} jours`
  else if (diffDays < 14)  label = 'Profil mis à jour la semaine dernière'
  else if (diffDays < 30)  label = `Profil mis à jour il y a ${Math.floor(diffDays / 7)} semaines`
  else                      label = `Profil mis à jour il y a ${Math.floor(diffDays / 30)} mois`
  return { label, isActif: diffDays < 7 }
}

// ─── VideoPlayer (contrôles custom — le scaleX(-1) ne touche pas les contrôles) ─

function VideoPlayer({ src, miroir, frameStyle }: {
  src: string
  miroir: boolean
  frameStyle?: React.CSSProperties
}) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const wrapperRef  = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const hideTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  // ref pour éviter les stale closures dans les listeners document
  const durationRef = useRef(0)
  const playingRef  = useRef(false)

  const [playing,       setPlaying]      = useState(false)
  const [currentTime,   setCurrentTime]  = useState(0)
  const [duration,      setDuration]     = useState(0)
  const [volume,        setVolume]       = useState(1)
  const [muted,         setMuted]        = useState(false)
  const [ctrlVisible,   setCtrlVisible]  = useState(true)
  const [isFullscreen,  setIsFullscreen] = useState(false)
  const [showVolSlider, setShowVolSlider] = useState(false)

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  // Synchronise les refs (accessibles dans les callbacks document sans stale closure)
  useEffect(() => { playingRef.current = playing }, [playing])
  useEffect(() => { durationRef.current = duration }, [duration])

  function revealControls() {
    setCtrlVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    if (playingRef.current) hideTimer.current = setTimeout(() => setCtrlVisible(false), 2500)
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60)
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  }

  // ── Seek ─────────────────────────────────────────────────────────────────────
  // progressRef est dans le div de contrôles NON transformé.
  // getBoundingClientRect() retourne toujours des coords écran left→right.
  // Le miroir sur le <video> n'affecte pas ce calcul.
  function seekFromX(clientX: number) {
    const bar = progressRef.current
    const v   = videoRef.current
    if (!bar || !v || !isFinite(durationRef.current) || durationRef.current === 0) return
    const rect = bar.getBoundingClientRect()
    const pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    v.currentTime = pct * durationRef.current
    setCurrentTime(pct * durationRef.current)
  }

  function handleProgressMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    seekFromX(e.clientX)
    const onMove = (ev: MouseEvent) => seekFromX(ev.clientX)
    const onUp   = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
  }

  function handleProgressTouch(e: React.TouchEvent<HTMLDivElement>) {
    e.stopPropagation()
    const t = e.touches[0] ?? e.changedTouches[0]
    if (t) seekFromX(t.clientX)
  }

  // ── Play / Pause ─────────────────────────────────────────────────────────────
  function togglePlay(e: React.MouseEvent) {
    e.stopPropagation()
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play()
    else v.pause()
  }

  // ── Volume ───────────────────────────────────────────────────────────────────
  function handleVolumeChange(val: number) {
    const v = videoRef.current
    if (!v) return
    v.volume = val
    v.muted  = val === 0
    setVolume(val)
    setMuted(val === 0)
  }

  function toggleMute(e: React.MouseEvent) {
    e.stopPropagation()
    const v = videoRef.current
    if (!v) return
    if (muted || volume === 0) {
      const restore = volume > 0 ? volume : 0.7
      v.muted  = false
      v.volume = restore
      setMuted(false)
      setVolume(restore)
    } else {
      v.muted = true
      setMuted(true)
    }
  }

  // ── Fullscreen ───────────────────────────────────────────────────────────────
  function toggleFullscreen(e: React.MouseEvent) {
    e.stopPropagation()
    if (!wrapperRef.current) return
    if (!document.fullscreenElement) wrapperRef.current.requestFullscreen?.()
    else document.exitFullscreen?.()
  }

  const pct         = duration ? (currentTime / duration) * 100 : 0
  const effectiveVol = muted ? 0 : volume
  const volState    = (muted || volume === 0) ? 'mute' : volume < 0.4 ? 'low' : 'high'

  const wrapperStyle: React.CSSProperties = isFullscreen
    ? { position: 'relative', overflow: 'hidden', backgroundColor: '#000', cursor: 'pointer', width: '100%', height: '100%' }
    : { position: 'relative', overflow: 'hidden', backgroundColor: '#000', cursor: 'pointer', ...frameStyle }

  const btnBase: React.CSSProperties = {
    background: 'none', border: 'none', color: C.white,
    fontSize: 14, cursor: 'pointer', padding: '2px 5px', lineHeight: 1, flexShrink: 0,
  }

  return (
    <div
      ref={wrapperRef}
      style={wrapperStyle}
      onMouseMove={revealControls}
      onMouseLeave={() => { if (playingRef.current) setCtrlVisible(false) }}
      onClick={togglePlay}
    >
      {/* Video — transform ici seulement, jamais sur les contrôles */}
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        playsInline
        style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain', transform: miroir ? 'scaleX(-1)' : 'none' }}
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => {
          const v = videoRef.current
          if (!v) return
          if (isFinite(v.duration)) {
            setDuration(v.duration)
          } else {
            // Webm MediaRecorder : duration = Infinity (pas de metadata de durée).
            // Seeker jusqu'à la fin force le navigateur à calculer la vraie durée.
            v.currentTime = 1e10
            const onSeeked = () => {
              setDuration(v.duration)
              durationRef.current = v.duration
              v.currentTime = 0
              v.removeEventListener('seeked', onSeeked)
            }
            v.addEventListener('seeked', onSeeked)
          }
        }}
        onPlay={() => {
          setPlaying(true)
          if (hideTimer.current) clearTimeout(hideTimer.current)
          hideTimer.current = setTimeout(() => setCtrlVisible(false), 2500)
        }}
        onPause={() => { setPlaying(false); setCtrlVisible(true); if (hideTimer.current) clearTimeout(hideTimer.current) }}
        onEnded={() => { setPlaying(false); setCtrlVisible(true); if (hideTimer.current) clearTimeout(hideTimer.current) }}
      />

      {/* Bouton play central — visible avant démarrage */}
      {!playing && currentTime === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            backgroundColor: 'rgba(0,0,0,0.52)', border: '2px solid rgba(255,255,255,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, color: C.white, paddingLeft: 3,
          }}>▶</div>
        </div>
      )}

      {/* Contrôles — positionnés en absolu, jamais transformés */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
          padding: '32px 12px 10px',
          opacity: ctrlVisible ? 1 : 0,
          transition: 'opacity 0.22s',
          pointerEvents: ctrlVisible ? 'auto' : 'none',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Barre de progression — drag-to-scrub, miroir-safe */}
        <div
          ref={progressRef}
          onMouseDown={handleProgressMouseDown}
          onTouchStart={handleProgressTouch}
          onTouchMove={handleProgressTouch}
          style={{
            width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.22)',
            borderRadius: 3, marginBottom: 8, cursor: 'pointer', position: 'relative' as const,
          }}
        >
          <div style={{ width: `${pct}%`, height: '100%', backgroundColor: C.terracotta, borderRadius: 3 }} />
          <div style={{
            position: 'absolute', top: '50%', left: `${pct}%`,
            transform: 'translate(-50%, -50%)',
            width: 13, height: 13, borderRadius: '50%',
            backgroundColor: C.terracotta, boxShadow: '0 0 0 2.5px rgba(255,255,255,0.45)',
            pointerEvents: 'none',
          }} />
        </div>

        {/* Ligne de boutons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Play/Pause */}
          <button onClick={togglePlay} style={btnBase}>{playing ? '⏸' : '▶'}</button>

          {/* Temps */}
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', fontFamily: 'monospace', minWidth: 82, flexShrink: 0, marginLeft: 2 }}>
            {fmt(currentTime)} / {fmt(duration)}
          </span>

          <div style={{ flex: 1 }} />

          {/* Volume — slider au survol */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 3 }}
            onMouseEnter={() => setShowVolSlider(true)}
            onMouseLeave={() => setShowVolSlider(false)}
          >
            {showVolSlider && (
              <input
                type="range"
                min={0} max={1} step={0.02}
                value={effectiveVol}
                onChange={e => { e.stopPropagation(); handleVolumeChange(Number(e.target.value)) }}
                onClick={e => e.stopPropagation()}
                style={{ width: 68, accentColor: C.terracotta, cursor: 'pointer', verticalAlign: 'middle' }}
              />
            )}
            <button onClick={toggleMute} style={btnBase}>
              {volState === 'mute' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
                </svg>
              ) : volState === 'low' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
              )}
            </button>
          </div>

          {/* Plein écran */}
          <button onClick={toggleFullscreen} style={{ ...btnBase, fontSize: 12, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.03em' }}>
            {isFullscreen ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Score circle ─────────────────────────────────────────────────────────────

function ScoreCircle({ score, size = 70 }: { score: number; size?: number }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 400); return () => clearTimeout(t) }, [])
  const r = size / 2 - 5
  const circ = 2 * Math.PI * r
  const offset = animated ? circ * (1 - score / 100) : circ
  const color = score >= 80 ? C.succes : score >= 60 ? C.terracotta : C.sable
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={4} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.3s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <div style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: Math.min(17, size * 0.38), color: C.white, fontWeight: 600, lineHeight: 1 }}>{score}%</div>
        <div style={{ fontSize: Math.min(9.5, size * 0.21), color: 'rgba(255,255,255,0.55)', lineHeight: 1 }}>match</div>
      </div>
    </div>
  )
}

function SLabel({ children }: { children: string }) {
  return (
    <div style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 15, fontWeight: 600, color: C.dark, marginBottom: 12 }}>
      {children}
    </div>
  )
}

function SLabel20({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 20, fontWeight: 600, color: C.dark, marginBottom: 14 }}>
      {children}
    </div>
  )
}

function SLabel17({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 17, fontWeight: 600, color: C.dark, marginBottom: 12 }}>
      {children}
    </div>
  )
}

const editInputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8,
  border: `1.5px solid ${C.sable}`, backgroundColor: C.white, color: C.dark,
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}

function moveUp<T>(arr: T[], i: number): T[] {
  if (i === 0) return arr
  const next = [...arr];
  [next[i - 1], next[i]] = [next[i], next[i - 1]]
  return next
}

function moveDown<T>(arr: T[], i: number): T[] {
  if (i >= arr.length - 1) return arr
  const next = [...arr];
  [next[i], next[i + 1]] = [next[i + 1], next[i]]
  return next
}

// ─── Props ────────────────────────────────────────────────────────────────────

type ProfilViewProps = {
  userId: string
  isOwner: boolean
  initialEditMode?: boolean
  notFoundRedirect?: string
  sidebarOffset?: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfilView({
  userId,
  isOwner,
  initialEditMode = false,
  notFoundRedirect,
  sidebarOffset = 64,
}: ProfilViewProps) {
  const router = useRouter()

  const [profil, setProfil]   = useState<Profil | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saved, setSaved]         = useState(false)
  const [notFound, setNotFound]   = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [projetModal, setProjetModal]             = useState(false)
  const [zoomImage, setZoomImage]               = useState<string | null>(null)
  const [projetCardHover, setProjetCardHover]   = useState(false)
  const [portraitVideoOpen, setPortraitVideoOpen] = useState(false)

  const [toastMsg, setToastMsg]         = useState('')
  const [toastVisible, setToastVisible]         = useState(false)
  const [writingMsg, setWritingMsg]             = useState(false)
  const [downloadingPortrait, setDownloading]    = useState(false)
  const [portraitModal, setPortraitModal]        = useState(false)
  const [portraitTitle, setPortraitTitle]        = useState('')
  const [portraitWithPhoto, setPortraitWithPhoto] = useState(false)
  const [portraitShowEmail, setPortraitShowEmail] = useState(true)
  const [portraitShowPhone, setPortraitShowPhone] = useState(false)

  const [carteOuverte, setCarteOuverte]     = useState<CarteType | null>(null)
  const [savingCarte, setSavingCarte]       = useState(false)
  const [carteErreur, setCarteErreur]       = useState('')
  const [carteModifiee, setCarteModifiee]   = useState(false)

  const [editPrenom, setEditPrenom]                 = useState('')
  const [editNom, setEditNom]                       = useState('')
  const [editMetier, setEditMetier]                 = useState('')
  const [editDomaine, setEditDomaine]               = useState('')
  const [editExperience, setEditExperience]         = useState('')
  const [editSignature, setEditSignature]           = useState('')
  const [signatureExpanded, setSignatureExpanded]   = useState(false)
  const [editQualites, setEditQualites]             = useState<string[]>([])
  const [editCompetences, setEditCompetences]       = useState<string[]>([])
  const [reponsesProches, setReponsesProches]         = useState<ReponseGroupe[]>([])
  const [qualitesProchesSel, setQualitesProchesSel]   = useState<Array<{reponse_id: string; qualite: string}>>([])
  const [editQualitesProches, setEditQualitesProches] = useState<Array<{reponse_id: string; qualite: string}>>([])

  const [unreadNotifCount, setUnreadNotifCount]       = useState(0)
  const [activeInvitations, setActiveInvitations]     = useState<ActiveInvitation[]>([])
  const [invitModalOpen, setInvitModalOpen]           = useState(false)
  const [supprimantInvId, setSupprimantInvId]         = useState<string | null>(null)
  const [editExperiences, setEditExperiences]       = useState<ProfilExperience[]>([])
  const [editDiplomes, setEditDiplomes]             = useState<ProfilDiplome[]>([])
  const [editProjetTitre, setEditProjetTitre]       = useState('')
  const [editProjetDesc, setEditProjetDesc]         = useState('')
  const [editProjetImpact, setEditProjetImpact]     = useState('')
  const [editProjetLien, setEditProjetLien]         = useState('')
  const [editProjetImages, setEditProjetImages]     = useState<string[]>([])
  const [editProjetVideo, setEditProjetVideo]       = useState('')
  const [editProjetResultat, setEditProjetResultat] = useState('')
  const [recordContext, setRecordContext]           = useState<'presentation' | 'projet'>('presentation')
  const [uploadingImages, setUploadingImages]       = useState(false)
  const [uploadingVideo, setUploadingVideo]         = useState(false)
  const [avatarModal, setAvatarModal]               = useState(false)
  const [avatarTab, setAvatarTab]                   = useState<'photo' | 'avatar' | 'initiales'>('photo')
  const [avatarFile, setAvatarFile]                 = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview]           = useState<string | null>(null)
  const [selectedColor, setSelectedColor]           = useState<string>(C.orange)
  const [selectedEmoji, setSelectedEmoji]           = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar]       = useState(false)
  const [newQualite, setNewQualite]                 = useState('')
  const [newCompetence, setNewCompetence]           = useState('')
  const [showOtherDomains,  setShowOtherDomains]    = useState(false)
  const [otherBrowseDomain, setOtherBrowseDomain]   = useState<string | null>(null)
  const [editVille, setEditVille]                   = useState('')
  const [editModeTravail, setEditModeTravail]        = useState('')
  const [editDispo, setEditDispo]                   = useState('')
  const [editDispoDate, setEditDispoDate]           = useState('')
  const [editTypePoste, setEditTypePoste]           = useState<string[]>([])
  const [editLiens, setEditLiens]                   = useState<Lien[]>([])
  const [editLiensErrs, setEditLiensErrs]           = useState<Record<number, string>>({})
  const [editPermis, setEditPermis]                 = useState<string[]>([])
  const [editTypeEntreprise, setEditTypeEntreprise] = useState<string[]>([])
  const [editPriorite, setEditPriorite]             = useState<string[]>([])
  const [editLangues, setEditLangues]               = useState<string[]>([])

  const [editPassions, setEditPassions]             = useState<string[]>([])
  const [newPassion, setNewPassion]                 = useState('')
  const [uploadingVedette, setUploadingVedette]     = useState(false)
  const [deletingVideo, setDeletingVideo]           = useState(false)
  const [togglingMiroir, setTogglingMiroir]         = useState(false)
  const [apercuRecruteur, setApercuRecruteur]       = useState(false)

  // Recording modal state
  const [recordModal, setRecordModal]     = useState(false)
  const [recordPhase, setRecordPhase]     = useState<'preview' | 'countdown' | 'recording' | 'playback' | 'error'>('preview')
  const [recordError, setRecordError]     = useState('')
  const [countdown, setCountdown]         = useState(3)
  const [recordDuration, setRecordDuration] = useState(0)
  const [recordedBlob, setRecordedBlob]   = useState<Blob | null>(null)
  const [recordedUrl, setRecordedUrl]     = useState<string | null>(null)

  const imageInputRef        = useRef<HTMLInputElement>(null)
  const videoInputRef        = useRef<HTMLInputElement>(null)
  const vedetteVideoInputRef = useRef<HTMLInputElement>(null)
  const mobileRecordInputRef = useRef<HTMLInputElement>(null)
  const avatarFileRef        = useRef<HTMLInputElement>(null)
  const previewVideoRef      = useRef<HTMLVideoElement>(null)
  const sigTextareaRef       = useRef<HTMLTextAreaElement>(null)
  const streamRef            = useRef<MediaStream | null>(null)
  const mediaRecorderRef     = useRef<MediaRecorder | null>(null)
  const chunksRef            = useRef<Blob[]>([])
  const countdownTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recordTimerRef       = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setNotFound(false)
      setFetchError(null)

      const { data, error } = await supabase
        .from('profils')
        .select(isOwner ? COLONNES_PROPRIETAIRE : COLONNES_VISITEUR)
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        // Erreur technique (colonne inexistante, RLS, réseau…) — ne pas renvoyer en onboarding
        setFetchError('Une erreur est survenue lors du chargement de ce profil.')
        setLoading(false)
        return
      }

      if (!data) {
        // Profil réellement absent (PGRST116 = 0 lignes)
        if (notFoundRedirect) {
          router.replace(notFoundRedirect)
        } else {
          setNotFound(true)
          setLoading(false)
        }
        return
      }

      const profil = data as unknown as Profil
      setProfil(profil)

      // Qualités proches sélectionnées : visible en lecture pour tous les visiteurs autorisés
      const { data: selData } = await supabase
        .from('qualites_proches_selectionnees')
        .select('reponse_id, qualite')
        .eq('user_id', userId)
      const sel = (selData ?? []) as Array<{reponse_id: string; qualite: string}>
      setQualitesProchesSel(sel)
      setEditQualitesProches(sel)

      // Invitations, réponses et notifications non lues : propriétaire uniquement
      if (isOwner) {
        const [invRes, repRes, notifRes] = await Promise.all([
          supabase.from('invitations_proches').select('id, label_proche, lien, expire_at, used_at').eq('candidat_id', userId),
          supabase.from('reponses_proches').select('id, invitation_id, prenom_proche, qualites'),
          supabase.from('notifications').select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('type', 'reponse_proche')
            .is('read_at', null),
        ])
        const now    = new Date().toISOString()
        const allInv = invRes.data ?? []
        const invMap = new Map(allInv.map(inv => [inv.id as string, inv.lien as string]))
        setActiveInvitations(
          allInv
            .filter(inv => (inv.expire_at as string) > now && inv.used_at === null)
            .map(inv => ({
              id:           inv.id           as string,
              label_proche: inv.label_proche as string,
              lien:         inv.lien         as string,
              expire_at:    inv.expire_at    as string,
            }))
        )
        setReponsesProches(
          (repRes.data ?? []).map(r => ({
            reponse_id:    r.id as string,
            prenom_proche: r.prenom_proche as string,
            lien:          invMap.get(r.invitation_id as string) ?? 'autre',
            qualites:      r.qualites as string[],
          }))
        )
        setUnreadNotifCount(notifRes.count ?? 0)
      }

      setLoading(false)

      if (!isOwner) {
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (currentUser) {
          const { error: vueError } = await supabase.from('vues_profil').insert({
            profil_id:    profil.user_id,
            visiteur_id:  currentUser.id,
            visiteur_type: 'recruteur',
          })
          if (vueError) {
            if (vueError.code !== '23505') console.error('vues_profil INSERT error:', vueError)
          }
        }
      }

      if (isOwner && initialEditMode) {
        setEditSignature(profil.signature ?? '')
        setEditQualites([...(profil.qualites ?? [])])
        setEditCompetences([...(profil.competences_acquises ?? [])])
        setEditExperiences(JSON.parse(JSON.stringify(profil.experiences ?? [])))
        setEditDiplomes(JSON.parse(JSON.stringify(profil.diplomes ?? [])))
        setEditProjetTitre(profil.projet_titre ?? '')
        setEditProjetDesc(profil.projet_phare ?? '')
        setEditProjetImpact(profil.projet_impact ?? '')
        setEditProjetLien(profil.projet_lien ?? '')
        setEditProjetImages([...(profil.projet_images ?? [])])
        setEditProjetVideo(profil.projet_video_url ?? '')
        setEditVille(profil.ville ?? '')
        setEditModeTravail(profil.mode_travail ?? '')
        setEditDispo(profil.disponibilite ?? '')
        setEditDispoDate(profil.dispo_date ?? '')
        setEditTypePoste([...(profil.type_poste ?? [])])
        setEditPriorite([...(profil.priorites ?? [])])
        setEditLiens(profil.liens && profil.liens.length > 0 ? [...profil.liens] : [
          ...(profil.linkedin_url ? [{ intitule: 'LinkedIn', url: profil.linkedin_url }] : []),
          ...(profil.portfolio_url ? [{ intitule: 'Portfolio', url: profil.portfolio_url }] : []),
        ])
        setEditTypeEntreprise([...(profil.type_entreprise ?? [])])
        setEditLangues([...(profil.langues ?? [])])
        setEditPassions([...(profil.passions ?? [])])
        setEditPermis([...(profil.permis ?? [])])
        setCarteOuverte('presentation')
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isOwner, initialEditMode, notFoundRedirect])

  // Auto-resize signature textarea as content grows
  useEffect(() => {
    const el = sigTextareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [editSignature])

  // Camera lifecycle — starts when modal opens, cleans up on close or unmount
  useEffect(() => {
    if (!recordModal) return
    let cancelled = false

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream
          previewVideoRef.current.play().catch(() => {})
        }
      } catch {
        if (!cancelled) {
          setRecordPhase('error')
          setRecordError("Accès refusé à la caméra ou au micro. Autorisez-les dans les paramètres de votre navigateur, puis réessayez.")
        }
      }
    }

    startCamera()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current)
      if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordModal])

  // Re-attach stream when returning to preview (retake flow)
  useEffect(() => {
    if (recordPhase !== 'preview' || !streamRef.current || !previewVideoRef.current) return
    previewVideoRef.current.srcObject = streamRef.current
    previewVideoRef.current.play().catch(() => {})
  }, [recordPhase])

  // Marquer les notifications reponse_proche comme lues à l'ouverture de la carte qualités
  useEffect(() => {
    if (carteOuverte !== 'qualites' || !isOwner || unreadNotifCount === 0) return
    setUnreadNotifCount(0)
    window.dispatchEvent(new CustomEvent('kapolia:notif-read'))
    supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('type', 'reponse_proche')
      .is('read_at', null)
      .then(({ error }) => {
        if (error) console.error('[mark-read] update error:', error)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carteOuverte, isOwner, unreadNotifCount, userId])

  if (loading) return (
    <main style={{ backgroundColor: C.bg, minHeight: '100vh', marginLeft: sidebarOffset, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style suppressHydrationWarning>{`@keyframes kapolia-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${C.sable}`, borderTopColor: C.terracotta, animation: 'kapolia-spin 0.8s linear infinite' }} />
    </main>
  )

  if (fetchError) return (
    <main style={{ backgroundColor: C.bg, minHeight: '100vh', marginLeft: sidebarOffset, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 22, color: C.dark }}>Erreur de chargement</div>
      <div style={{ fontSize: 14, color: C.grey, textAlign: 'center', maxWidth: 320 }}>{fetchError}</div>
      <button onClick={() => window.location.reload()} style={{ marginTop: 8, padding: '10px 24px', borderRadius: 12, border: 'none', backgroundColor: C.terracotta, color: C.white, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
        Réessayer
      </button>
    </main>
  )

  if (notFound) return (
    <main style={{ backgroundColor: C.bg, minHeight: '100vh', marginLeft: sidebarOffset, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 40 }}>◎</div>
      <div style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 22, color: C.dark }}>Profil introuvable</div>
      <div style={{ fontSize: 14, color: C.grey }}>Ce profil n'existe pas ou n'est plus accessible.</div>
      <button onClick={() => router.back()} style={{ marginTop: 8, padding: '10px 24px', borderRadius: 12, border: 'none', backgroundColor: C.terracotta, color: C.white, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
        ← Retour
      </button>
    </main>
  )

  const p = profil!
  const effectiveOwner = isOwner && !apercuRecruteur

  const initials         = getInitials(p.prenom, p.nom)
  const dispo            = getDispoStatus(p.disponibilite, p.dispo_date)
  const typeEntrepriseItems = (p.type_entreprise ?? []).filter(k => k !== 'sans_pref').map(k => ENVIRONNEMENT_MAP[k] ?? k)
  const typePosteLabel      = (p.type_poste ?? []).map(k => TYPE_POSTE_MAP[k] ?? k).join(' · ') || '—'
  const modeTravailLabel    = LIEU_MAP[p.mode_travail ?? ''] ?? p.mode_travail ?? ''
  const qualites            = p.qualites ?? []
  const passions            = p.passions ?? []
  const experiences         = p.experiences ?? []
  const diplomes            = p.diplomes ?? []
  const competencesAcquises = p.competences_acquises ?? []
  const langues             = p.langues ?? []
  const projetImages        = p.projet_images ?? []
  const projetLien          = p.projet_lien ?? ''
  const projetImpact        = p.projet_impact ?? ''
  const projetVideoUrl      = p.projet_video_url ?? ''        // used in projet phare modal only
  const videoPresentation   = p.video_presentation_url ?? '' // used in vedette section
  const videoMiroir         = p.video_miroir ?? false
  const activity            = getProfilActivity(p.derniere_maj_profil)
  const liensAffiches: Lien[] = p.liens && p.liens.length > 0
    ? p.liens
    : [
      ...(p.linkedin_url ? [{ intitule: 'LinkedIn', url: p.linkedin_url }] : []),
      ...(p.portfolio_url ? [{ intitule: 'Portfolio', url: p.portfolio_url }] : []),
    ]
  const anneesExp: number = (() => {
    const postes: PosteParcours[] = []
    for (const e of experiences) {
      const debut = lireMoisAnnee(e.date_debut)
      if (!debut) continue
      if (e.en_poste) { postes.push({ id: '', poste: e.poste, entreprise: e.entreprise, debut, fin: null, enPoste: true }); continue }
      const fin = lireMoisAnnee(e.date_fin)
      if (!fin) continue
      postes.push({ id: '', poste: e.poste, entreprise: e.entreprise, debut, fin, enPoste: false })
    }
    return anneesExperience(postes)
  })()

  function showToast(msg: string) {
    setToastMsg(msg); setToastVisible(true)
    setTimeout(() => setToastVisible(false), 3000)
  }

  function ouvrirCarte(carte: CarteType) {
    if (carteModifiee) { setCarteErreur('Enregistrez ou annulez d\'abord vos changements.'); return }
    if (carte === 'presentation' || carte === 'recherche') {
      setEditPrenom(p.prenom ?? ''); setEditNom(p.nom ?? ''); setEditMetier(p.metier ?? '')
      setEditDomaine(p.domaine ?? ''); setEditExperience(p.experience ?? '')
      setEditSignature(p.signature ?? ''); setEditDispo(p.disponibilite ?? ''); setEditDispoDate(p.dispo_date ?? '')
      setEditTypePoste([...(p.type_poste ?? [])]); setEditModeTravail(p.mode_travail ?? ''); setEditVille(p.ville ?? '')
      setEditTypeEntreprise([...(p.type_entreprise ?? [])]); setEditLangues([...(p.langues ?? [])]); setEditPermis([...(p.permis ?? [])])
    } else if (carte === 'parcours') {
      setEditExperiences(JSON.parse(JSON.stringify(p.experiences ?? [])))
      setEditDiplomes(JSON.parse(JSON.stringify(p.diplomes ?? [])))
    } else if (carte === 'qualites') {
      setEditQualites([...(p.qualites ?? [])]); setNewQualite(''); setEditQualitesProches([...qualitesProchesSel])
    } else if (carte === 'competences') {
      setEditCompetences([...(p.competences_acquises ?? [])]); setNewCompetence('')
    } else if (carte === 'projet') {
      setEditProjetTitre(p.projet_titre ?? ''); setEditProjetDesc(p.projet_phare ?? '')
      setEditProjetImpact(p.projet_impact ?? ''); setEditProjetLien(p.projet_lien ?? '')
      setEditProjetImages([...(p.projet_images ?? [])]); setEditProjetVideo(p.projet_video_url ?? '')
      setEditProjetResultat(p.projet_resultat ?? '')
    } else if (carte === 'priorites') {
      setEditPriorite([...(p.priorites ?? [])])
    } else if (carte === 'passions') {
      setEditPassions([...(p.passions ?? [])]); setNewPassion('')
    } else if (carte === 'liens') {
      setEditLiens(p.liens && p.liens.length > 0 ? [...p.liens] : [
        ...(p.linkedin_url ? [{ intitule: 'LinkedIn', url: p.linkedin_url }] : []),
        ...(p.portfolio_url ? [{ intitule: 'Portfolio', url: p.portfolio_url }] : []),
      ]); setEditLiensErrs({})
    }
    setCarteModifiee(false); setCarteErreur(''); setCarteOuverte(carte)
  }

  function annulerCarte() {
    setCarteModifiee(false); setCarteErreur(''); setCarteOuverte(null)
  }

  function toggleEditCompetence(comp: string) {
    if (editCompetences.includes(comp)) setEditCompetences(editCompetences.filter(x => x !== comp))
    else if (editCompetences.length < 15) setEditCompetences([...editCompetences, comp])
  }

  async function supprimerInvitation(invId: string) {
    setSupprimantInvId(invId)
    const { error } = await supabase
      .from('invitations_proches')
      .delete()
      .eq('id', invId)
      .eq('candidat_id', userId)
    setSupprimantInvId(null)
    if (error) { console.error('[invitation] delete error:', error); return }
    setActiveInvitations(prev => prev.filter(inv => inv.id !== invId))
  }

  function openAvatarModal() {
    const type = p.avatar_type ?? 'initiales'
    setAvatarTab(type === 'photo' ? 'photo' : type === 'avatar' ? 'avatar' : 'initiales')
    setSelectedColor(type === 'initiales' && p.avatar_url ? p.avatar_url : C.orange)
    setSelectedEmoji(type === 'avatar' ? (p.avatar_url ?? null) : null)
    setAvatarPreview(null)
    setAvatarFile(null)
    setAvatarModal(true)
  }

  async function saveAvatar() {
    setUploadingAvatar(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploadingAvatar(false); return }

    let newUrl: string | null = null
    let newType: string | null = null

    if (avatarTab === 'photo' && avatarFile) {
      const path = `${user.id}/avatar.jpg`
      const { error } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })
      if (error) { showToast(`Erreur: ${error.message}`); setUploadingAvatar(false); return }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      newUrl = `${urlData.publicUrl}?t=${Date.now()}`
      newType = 'photo'
    } else if (avatarTab === 'avatar' && selectedEmoji) {
      newUrl = selectedEmoji
      newType = 'avatar'
    } else if (avatarTab === 'initiales') {
      newUrl = selectedColor
      newType = 'initiales'
    }

    if (!newUrl || !newType) { setUploadingAvatar(false); return }

    const { error } = await supabase.from('profils').update({ avatar_url: newUrl, avatar_type: newType }).eq('user_id', user.id)
    if (error) { showToast(`Erreur: ${error.message}`); setUploadingAvatar(false); return }

    setProfil(prev => prev ? { ...prev, avatar_url: newUrl!, avatar_type: newType! } : null)
    setAvatarModal(false)
    setUploadingAvatar(false)
    showToast('Avatar mis à jour ✓')
  }

  async function enregistrerCarte(carte: CarteType) {
    setSavingCarte(true); setCarteErreur('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSavingCarte(false); return }

    if (carte === 'liens') {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        const res = await fetch('/api/profil/liens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ liens: editLiens }),
        })
        const json = await res.json()
        if (!res.ok || json.errors) {
          setEditLiensErrs(json.errors ?? { 0: json.error ?? 'Erreur.' })
          setCarteErreur(json.error ?? 'Erreur de validation.')
          setSavingCarte(false); return
        }
        setEditLiensErrs({})
      }
      setProfil(prev => prev ? { ...prev, liens: editLiens } : null)
      setCarteModifiee(false); setCarteOuverte(null); setSavingCarte(false); showToast('Modifications enregistrées'); return
    }

    let payload: Record<string, unknown> = {}
    if (carte === 'presentation') payload = { prenom: editPrenom, nom: editNom, metier: editMetier || null, domaine: editDomaine || null, experience: editExperience || null, signature: editSignature }
    else if (carte === 'recherche') payload = { disponibilite: editDispo || null, dispo_date: editDispo === 'a_partir_de' ? (editDispoDate || null) : null, type_poste: editTypePoste, mode_travail: editModeTravail, ville: editVille, type_entreprise: editTypeEntreprise, langues: editLangues, permis: editPermis }
    else if (carte === 'parcours') {
      const finErr = editExperiences.some(exp => {
        if (exp.en_poste || !exp.debut_annee || !exp.fin_annee) return false
        if (exp.fin_annee < exp.debut_annee) return true
        return exp.fin_annee === exp.debut_annee && !!exp.debut_mois && !!exp.fin_mois && exp.fin_mois < exp.debut_mois
      })
      if (finErr) { setCarteErreur('Corrigez les dates avant d\'enregistrer.'); setSavingCarte(false); return }
      const expsToSave = [...editExperiences].map(exp => {
        const debut = exp.debut_annee ? { annee: exp.debut_annee, mois: exp.debut_mois ?? null } : null
        const fin = !exp.en_poste && exp.fin_annee ? { annee: exp.fin_annee, mois: exp.fin_mois ?? null } : null
        return {
          ...exp,
          date_debut: debut ? ecrireMoisAnnee(debut) : exp.date_debut,
          date_fin: fin ? ecrireMoisAnnee(fin) : exp.en_poste ? '' : exp.date_fin,
          date_a_verifier: false,
        }
      }).sort((a, b) => {
        const diff = (b.debut_annee ?? 0) - (a.debut_annee ?? 0)
        return diff !== 0 ? diff : (b.debut_mois ?? 0) - (a.debut_mois ?? 0)
      })
      const diploToSave = editDiplomes.map(d => ({
        ...d,
        annee_debut: d.debut_annee ? String(d.debut_annee) : null,
      }))
      payload = { experiences: expsToSave, diplomes: diploToSave }
    }
    else if (carte === 'qualites') payload = { qualites: editQualites }
    else if (carte === 'competences') payload = { competences_acquises: editCompetences }
    else if (carte === 'projet') {
      if (editProjetImpact.length > 80 && editProjetImpact !== (p.projet_impact ?? '')) {
        setCarteErreur('Résumez le résultat en un chiffre et quelques mots (80 caractères max).')
        setSavingCarte(false); return
      }
      payload = { projet_phare: editProjetDesc, projet_titre: editProjetTitre, projet_resultat: editProjetResultat || null, projet_impact: editProjetImpact, projet_lien: editProjetLien, projet_images: editProjetImages, projet_video_url: editProjetVideo }
    }
    else if (carte === 'priorites') payload = { priorites: editPriorite }
    else if (carte === 'passions') payload = { passions: editPassions }

    const { error } = await supabase.from('profils').update(payload).eq('user_id', user.id)
    if (error) { setCarteErreur(error.message); setSavingCarte(false); return }

    if (carte === 'qualites') {
      const currentSet = new Set(qualitesProchesSel.map(s => s.qualite))
      const newMap = new Map(editQualitesProches.map(s => [s.qualite, s.reponse_id]))
      const toDelete = qualitesProchesSel.filter(s => !newMap.has(s.qualite))
      const toInsert = editQualitesProches.filter(s => !currentSet.has(s.qualite))
      if (toDelete.length > 0) await supabase.from('qualites_proches_selectionnees').delete().eq('user_id', user.id).in('qualite', toDelete.map(s => s.qualite))
      if (toInsert.length > 0) await supabase.from('qualites_proches_selectionnees').insert(toInsert.map(s => ({ user_id: user.id, reponse_id: s.reponse_id, qualite: s.qualite })))
      setQualitesProchesSel([...editQualitesProches])
    }

    setProfil(prev => prev ? { ...prev, ...payload } : null)
    setCarteModifiee(false); setCarteOuverte(null); setSavingCarte(false); showToast('Modifications enregistrées')
  }

  async function processImageFiles(files: File[]) {
    const remaining = 4 - editProjetImages.length
    if (remaining <= 0) { showToast('Maximum 4 fichiers.'); return }
    const MAX = 5 * 1024 * 1024
    setUploadingImages(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploadingImages(false); return }
    const urls: string[] = []
    let erreurs = 0
    for (const file of files.slice(0, remaining)) {
      if (file.size > MAX) { showToast(`${file.name} dépasse 5 MB.`); continue }
      const path = `projets/${user.id}/${Date.now()}-${sanitizeFilename(file.name)}`
      const { error } = await supabase.storage.from('projets-medias').upload(path, file)
      if (!error) {
        const { data: u } = supabase.storage.from('projets-medias').getPublicUrl(path)
        urls.push(u.publicUrl)
      } else {
        console.error('[upload image] Supabase Storage erreur:', error.message, error)
        erreurs++
      }
    }
    if (urls.length > 0) setEditProjetImages(prev => [...prev, ...urls])
    if (erreurs > 0) showToast(erreurs === 1 ? 'Une image n\'a pas pu être envoyée.' : `${erreurs} images n'ont pas pu être envoyées.`)
    setUploadingImages(false)
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length) processImageFiles(files)
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    if (file.size > 50 * 1024 * 1024) { showToast('La vidéo dépasse 50 MB.'); return }
    const duration = await new Promise<number>(resolve => {
      const vid = document.createElement('video'); vid.preload = 'metadata'
      vid.onloadedmetadata = () => { URL.revokeObjectURL(vid.src); resolve(vid.duration) }
      vid.onerror = () => { URL.revokeObjectURL(vid.src); resolve(0) }
      vid.src = URL.createObjectURL(file)
    })
    if (duration > 45) { showToast('Cette vidéo dure plus de 45 secondes. Raccourcissez-la ou filmez-en une nouvelle.'); return }
    setUploadingVideo(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploadingVideo(false); return }
    const path = `projets/${user.id}/video-${Date.now()}-${sanitizeFilename(file.name)}`
    const { error } = await supabase.storage.from('projets-medias').upload(path, file)
    if (error) { console.error('[upload vidéo projet] Supabase Storage erreur:', error.message, error); showToast("Erreur upload vidéo."); setUploadingVideo(false); return }
    const { data: u } = supabase.storage.from('projets-medias').getPublicUrl(path)
    setEditProjetVideo(u.publicUrl)
    setUploadingVideo(false)
  }

  function extractStoragePath(publicUrl: string): string | null {
    const marker = '/object/public/projets-medias/'
    const idx = publicUrl.indexOf(marker)
    if (idx < 0) return null
    return decodeURIComponent(publicUrl.slice(idx + marker.length).split('?')[0])
  }

  async function deleteStorageVideo(url: string) {
    const storagePath = extractStoragePath(url)
    if (!storagePath) return
    const { error } = await supabase.storage.from('projets-medias').remove([storagePath])
    if (error) console.error('Storage remove error:', error.message)
  }

  // Core upload — called by file input handler AND recorder "Utiliser"
  async function uploadVedetteVideo(file: File) {
    setUploadingVedette(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploadingVedette(false); return }

    const ext = file.type.includes('mp4') ? 'mp4' : 'webm'
    const path = `${user.id}/presentation-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('projets-medias')
      .upload(path, file, { contentType: file.type })

    if (uploadError) {
      console.error('Video upload error:', uploadError.message, uploadError)
      showToast(`Erreur upload : ${uploadError.message}`)
      setUploadingVedette(false)
      return
    }

    const { data: urlData } = supabase.storage.from('projets-medias').getPublicUrl(path)
    const publicUrl = urlData.publicUrl

    const { error: dbError } = await supabase
      .from('profils')
      .update({ video_presentation_url: publicUrl, video_miroir: false })
      .eq('user_id', user.id)

    if (dbError) {
      console.error('Video DB update error:', dbError.message, dbError)
      showToast(`Erreur sauvegarde : ${dbError.message}`)
      setUploadingVedette(false)
      return
    }

    // Delete old file only after Storage + DB both succeeded
    const oldUrl = profil?.video_presentation_url
    if (oldUrl) deleteStorageVideo(oldUrl)

    setProfil(prev => prev ? { ...prev, video_presentation_url: publicUrl, video_miroir: false } : null)
    setUploadingVedette(false)
    showToast('Vidéo ajoutée ✓')
  }

  async function toggleVideoMiroir() {
    setTogglingMiroir(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setTogglingMiroir(false); return }
    const newVal = !videoMiroir
    const { error } = await supabase.from('profils').update({ video_miroir: newVal }).eq('user_id', user.id)
    if (error) { console.error('video_miroir update error:', error.message); setTogglingMiroir(false); return }
    setProfil(prev => prev ? { ...prev, video_miroir: newVal } : null)
    setTogglingMiroir(false)
  }

  async function deleteVideoPresentation() {
    setDeletingVideo(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setDeletingVideo(false); return }

    const oldUrl = profil?.video_presentation_url
    if (oldUrl) await deleteStorageVideo(oldUrl)

    const { error: dbErr } = await supabase
      .from('profils')
      .update({ video_presentation_url: null, video_miroir: false })
      .eq('user_id', user.id)

    if (dbErr) {
      console.error('Video delete DB error:', dbErr.message, dbErr)
      showToast(`Erreur suppression : ${dbErr.message}`)
      setDeletingVideo(false)
      return
    }

    setProfil(prev => prev ? { ...prev, video_presentation_url: null, video_miroir: false } : null)
    setDeletingVideo(false)
    showToast('Vidéo supprimée')
  }

  async function handleVedetteVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    if (file.size > 100 * 1024 * 1024) { showToast('Vidéo trop volumineuse — 100 Mo maximum.'); return }
    const duration = await new Promise<number>(resolve => {
      const vid = document.createElement('video'); vid.preload = 'metadata'
      vid.onloadedmetadata = () => { URL.revokeObjectURL(vid.src); resolve(vid.duration) }
      vid.onerror = () => { URL.revokeObjectURL(vid.src); resolve(0) }
      vid.src = URL.createObjectURL(file)
    })
    if (duration > 60) { showToast('La vidéo doit faire 60 secondes maximum.'); return }
    await uploadVedetteVideo(file)
  }

  // ─── Recording functions ───────────────────────────────────────────────────

  function closeRecordModal() {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current)
    if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
    chunksRef.current = []
    if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    setRecordModal(false)
    setRecordPhase('preview')
    setCountdown(3)
    setRecordDuration(0)
    setRecordedBlob(null)
    setRecordedUrl(null)
    setRecordError('')
  }

  function startCountdown() {
    setRecordPhase('countdown')
    setCountdown(3)
    let n = 3
    function tick() {
      n -= 1
      setCountdown(n)
      if (n <= 0) { startRecording() }
      else { countdownTimerRef.current = setTimeout(tick, 1000) }
    }
    countdownTimerRef.current = setTimeout(tick, 1000)
  }

  function startRecording() {
    if (!streamRef.current) return
    const mimeType = getSupportedMimeType()
    chunksRef.current = []
    const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : {})
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' })
      const url = URL.createObjectURL(blob)
      setRecordedBlob(blob)
      setRecordedUrl(url)
      setRecordPhase('playback')
    }
    recorder.start(100)
    mediaRecorderRef.current = recorder
    setRecordPhase('recording')
    setRecordDuration(0)
    let elapsed = 0
    recordTimerRef.current = setInterval(() => {
      elapsed += 1
      setRecordDuration(elapsed)
      if (elapsed >= (recordContext === 'projet' ? 45 : 60)) stopRecording()
    }, 1000)
  }

  function stopRecording() {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
  }

  function retakeRecording() {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    setRecordedBlob(null)
    setRecordedUrl(null)
    setRecordDuration(0)
    chunksRef.current = []
    setRecordPhase('preview')
  }

  async function useRecordedVideo() {
    if (!recordedBlob) return
    const ext = recordedBlob.type.includes('mp4') ? 'mp4' : 'webm'
    const file = new File([recordedBlob], `video-${Date.now()}.${ext}`, { type: recordedBlob.type })
    closeRecordModal()
    if (recordContext === 'projet') {
      setUploadingVideo(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setUploadingVideo(false); return }
      const path = `projets/${user.id}/video-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('projets-medias').upload(path, file, { contentType: file.type })
      if (error) { showToast('Erreur upload vidéo.'); setUploadingVideo(false); return }
      const { data: u } = supabase.storage.from('projets-medias').getPublicUrl(path)
      setEditProjetVideo(u.publicUrl)
      setUploadingVideo(false)
      setCarteModifiee(true)
    } else {
      await uploadVedetteVideo(file)
    }
  }

  function updateExp(i: number, patch: Partial<ProfilExperience>) {
    const arr = [...editExperiences]; arr[i] = { ...arr[i], ...patch }; setEditExperiences(arr)
  }
  function updateDip(i: number, patch: Partial<ProfilDiplome>) {
    const arr = [...editDiplomes]; arr[i] = { ...arr[i], ...patch }; setEditDiplomes(arr)
  }

  // ─── Helpers rendu carte-par-carte ───────────────────────────────────────────

  const enTeteIsOpen = carteOuverte === 'presentation' || carteOuverte === 'recherche'

  function carteWrapStyle(carte: CarteType, padding?: string): React.CSSProperties {
    const p2 = padding ?? '20px 22px'
    const base: React.CSSProperties = { backgroundColor: C.white, borderRadius: CARD_RADIUS, padding: p2 }
    if (carteOuverte === carte) return { ...base, border: `1.5px solid ${C.accent}`, boxShadow: `0 0 0 4px rgba(194,97,31,.08)` }
    if (carteOuverte !== null) return { ...base, boxShadow: CARD_SHADOW, opacity: 0.4, filter: 'saturate(0)', pointerEvents: 'none' as const }
    return { ...base, boxShadow: CARD_SHADOW }
  }

  function modifierBtn(carte: CarteType) {
    const isOpen = carte === 'presentation' || carte === 'recherche' ? enTeteIsOpen : carteOuverte === carte
    return isOpen
      ? <span style={{ fontSize: 12, fontWeight: 700, color: C.lien, backgroundColor: C.peche, borderRadius: 6, padding: '2px 8px' }}>En modification</span>
      : <button onClick={() => ouvrirCarte(carte)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.lien, padding: '2px 0', fontFamily: 'inherit' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Modifier
        </button>
  }

  function cardFooter(carte: CarteType) {
    return <>
      {carteErreur && <p style={{ fontSize: 13, color: C.erreur, margin: '12px 0 0' }}>{carteErreur}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.sable}` }}>
        <button onClick={annulerCarte} style={{ padding: '8px 18px', borderRadius: 10, border: `1.5px solid ${C.sable}`, backgroundColor: C.white, color: C.grey, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
        <button onClick={() => enregistrerCarte(carte)} disabled={savingCarte} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 10, border: 'none', backgroundColor: C.orange, color: C.white, fontSize: 13, fontWeight: 600, cursor: savingCarte ? 'default' : 'pointer', opacity: savingCarte ? 0.75 : 1, fontFamily: 'inherit' }}>
          {savingCarte && <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: C.white, animation: 'kapolia-spin 0.7s linear infinite', flexShrink: 0, display: 'inline-block' }} />}
          {savingCarte ? 'Enregistrement' : 'Enregistrer'}
        </button>
      </div>
    </>
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <main style={{ backgroundColor: C.bg, minHeight: '100vh', marginLeft: sidebarOffset, paddingBottom: 0 }}>
      <style suppressHydrationWarning>{`
        @keyframes kapolia-spin { to { transform: rotate(360deg); } }
        @keyframes kapolia-pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
        * { box-sizing: border-box; }
        .btn-portrait:hover:not(:disabled) { opacity: 0.8; }
        .profil-lien-action { display:inline-flex; align-items:center; gap:6px; padding:6px 8px; border-radius:8px; border:none; background:transparent; color:#A9541A; font-size:13.5px; font-weight:600; cursor:pointer; font-family:inherit; transition:background 0.15s; }
        .profil-lien-action:hover { background:#FBF3EC; }
.profil-entete { display: grid; grid-template-columns: 200px 1fr; gap: 26px; align-items: flex-start; }
        .profil-entete-portrait { width: 200px; height: 244px; flex-shrink: 0; }
        .profil-col3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .profil-lien-row { display:flex; align-items:center; gap:10px; padding:9px 11px; border-radius:9px; background:${C.bg}; text-decoration:none; transition:background 0.15s; }
        .profil-lien-row:hover { background:${C.salaire}; }
        @media (max-width: 768px) {
          .profil-entete { display: flex; flex-direction: column; align-items: stretch; }
          .profil-entete-portrait { width: 100% !important; height: 260px; }
          .profil-col3 { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Toast */}
      <div style={{
        position: 'fixed', bottom: 28, left: '50%',
        transform: `translateX(-50%) translateY(${toastVisible ? '0' : '14px'})`,
        opacity: toastVisible ? 1 : 0, transition: 'opacity 0.22s, transform 0.22s',
        pointerEvents: 'none', zIndex: 300,
        backgroundColor: toastMsg.includes('Erreur') ? C.erreur : C.vert,
        color: C.white, padding: '11px 22px', borderRadius: 28, fontSize: 14, fontWeight: 600,
        boxShadow: '0 4px 20px rgba(0,0,0,0.18)', whiteSpace: 'nowrap' as const,
      }}>
        {toastMsg}
      </div>

      {/* Hidden file inputs */}
      <input ref={imageInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImageUpload} />
      <input ref={videoInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVideoUpload} />
      <input ref={vedetteVideoInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVedetteVideoUpload} />
      <input ref={mobileRecordInputRef} type="file" accept="video/*" capture="user" style={{ display: 'none' }} onChange={handleVedetteVideoUpload} />
      <input ref={avatarFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
        const file = e.target.files?.[0]; e.target.value = ''
        if (!file) return
        setAvatarFile(file)
        setAvatarPreview(URL.createObjectURL(file))
      }} />



      {/* ━━━ VUE LECTURE — mise en page une colonne ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 80px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── BANDEAU APERÇU RECRUTEUR ── */}
          {apercuRecruteur && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', backgroundColor: C.salaire, borderRadius: 11 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: C.vert }}>Vous voyez votre profil tel qu&apos;un recruteur le voit.</span>
              <button
                onClick={() => { setApercuRecruteur(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                style={{ padding: '6px 14px', borderRadius: 8, border: 'none', backgroundColor: C.white, color: C.vert, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
              >Revenir à mon profil</button>
            </div>
          )}

          {/* ── EN-TÊTE ── */}
          <div style={{ backgroundColor: C.white, borderRadius: 16, padding: 22, ...(enTeteIsOpen ? { border: `1.5px solid ${C.accent}`, boxShadow: `0 0 0 4px rgba(194,97,31,.08)` } : carteOuverte !== null ? { boxShadow: CARD_SHADOW, opacity: 0.4, filter: 'saturate(0)', pointerEvents: 'none' } : { boxShadow: CARD_SHADOW }) }}>
            <div className="profil-entete">

              {/* Portrait */}
              <div className="profil-entete-portrait" style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', backgroundColor: C.bg }}>
                <Avatar profil={p} size="lg" style={{ width: '100%', height: '100%', borderRadius: 0 }} />
                {videoPresentation ? (
                  <button
                    onClick={() => setPortraitVideoOpen(true)}
                    style={{
                      position: 'absolute', bottom: 10, right: 10,
                      padding: '5px 11px', borderRadius: 20, border: 'none',
                      backgroundColor: 'rgba(0,0,0,0.65)', color: C.white,
                      fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >▶ Vidéo</button>
                ) : effectiveOwner ? (
                  <button
                    className="btn-portrait"
                    onClick={() => { setRecordContext('presentation'); setRecordPhase('preview'); setRecordError(''); setRecordModal(true) }}
                    disabled={uploadingVedette}
                    style={{
                      position: 'absolute', bottom: 10, right: 10,
                      padding: '5px 11px', borderRadius: 20,
                      border: `1.5px dashed ${C.sable}`,
                      backgroundColor: 'rgba(255,255,255,0.9)', color: C.grey,
                      fontSize: 11, fontWeight: 500, cursor: uploadingVedette ? 'default' : 'pointer',
                      fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
                      transition: 'opacity 0.15s',
                    }}
                  >+ Vidéo</button>
                ) : null}
              </div>

              {/* Info */}
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>

                {/* Nom + liens action */}
                <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap' as const, gap: 8 }}>
                  <h1 style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 30, fontWeight: 600, color: C.dark, margin: 0, lineHeight: 1.2 }}>
                    {p.prenom} {p.nom}
                  </h1>
                  {effectiveOwner ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginLeft: 'auto', maxWidth: 440 }}>
                      <button className="profil-lien-action" onClick={() => typeof window !== 'undefined' && window.dispatchEvent(new Event('ouvrir-assistant-profil'))}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2v4m0 12v4M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.49 8.49 2.83 2.83M4.93 19.07l2.83-2.83m8.49-8.49 2.83-2.83"/></svg>
                        {"Qu'est-ce qui manque ?"}
                      </button>
                      <button className="profil-lien-action" onClick={() => {
                        const saved = typeof window !== 'undefined' ? localStorage.getItem(`kapolia_portrait_title_${userId}`) : null
                        setPortraitTitle(saved ?? p.domaine ?? '')
                        setPortraitWithPhoto(false)
                        const savedEmail = typeof window !== 'undefined' ? localStorage.getItem(`kapolia_portrait_email_${userId}`) : null
                        setPortraitShowEmail(savedEmail !== null ? savedEmail === 'true' : true)
                        const hasPhone = !!(p.telephone)
                        const savedPhone = typeof window !== 'undefined' ? localStorage.getItem(`kapolia_portrait_phone_${userId}`) : null
                        setPortraitShowPhone(hasPhone ? (savedPhone !== null ? savedPhone === 'true' : true) : false)
                        setPortraitModal(true)
                      }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 3v13m-5-5 5 5 5-5M3 20h18"/></svg>
                        Portrait PDF
                      </button>
                      <button className="profil-lien-action" onClick={() => { setApercuRecruteur(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
                        Voir comme un recruteur
                      </button>
                      {modifierBtn('presentation')}
                    </div>
                  ) : !apercuRecruteur ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center', marginLeft: 'auto' }}>
                      <ScoreCircle score={83} size={58} />
                      <button
                        onClick={async () => {
                          setWritingMsg(true)
                          const existing = await trouverConversation(userId)
                          setWritingMsg(false)
                          if (existing) { router.push(`/recruteur/messages?conv=${existing}`); return }
                          router.push(`/recruteur/messages?new=${userId}`)
                        }}
                        disabled={writingMsg}
                        style={{ padding: '8px 18px', borderRadius: 10, border: 'none', backgroundColor: C.terracotta, color: C.white, fontSize: 13, fontWeight: 600, cursor: writingMsg ? 'default' : 'pointer', fontFamily: 'inherit', opacity: writingMsg ? 0.7 : 1 }}
                      >{writingMsg ? '…' : 'Écrire'}</button>
                      <button onClick={() => setSaved(s => !s)} style={{ padding: '8px 18px', borderRadius: 10, border: `1.5px solid ${saved ? C.vert : C.sable}`, backgroundColor: saved ? `${C.vert}12` : C.white, color: saved ? C.vert : C.grey, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>
                        {saved ? 'Sauvegardé' : 'Sauvegarder'}
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* Métier */}
                {(() => {
                  const titre = p.metier?.trim() || experiences.find(e => e.en_poste)?.poste || experiences[0]?.poste || null
                  return titre ? <div style={{ fontSize: 18, fontWeight: 600, color: C.dark, marginTop: 4 }}>{titre}</div> : null
                })()}

                {/* Domaine · N ans d'expérience */}
                {(() => {
                  const domaine = p.domaine ?? ''
                  if (anneesExp < 1) return domaine ? <div style={{ fontSize: 14.5, color: C.grey, marginTop: 3 }}>{domaine}</div> : null
                  const expStr = anneesExp === 1 ? "1 an d'expérience" : `${anneesExp} ans d'expérience`
                  if (!domaine) return <div style={{ fontSize: 14.5, color: C.grey, marginTop: 3 }}>{expStr}</div>
                  return <div style={{ fontSize: 14.5, color: C.grey, marginTop: 3 }}>{domaine} · {expStr}</div>
                })()}

                {/* Signature */}
                {p.signature ? (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ margin: 0, fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontStyle: 'italic', fontSize: 15, color: C.grey, lineHeight: 1.6, ...(signatureExpanded ? {} : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }) }}>
                      {`« ${p.signature} »`}
                    </p>
                    {p.signature.length > 120 && (
                      <button onClick={() => setSignatureExpanded(v => !v)} style={{ background: 'none', border: 'none', padding: 0, marginTop: 4, color: C.grey, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
                        {signatureExpanded ? 'voir moins' : 'voir plus'}
                      </button>
                    )}
                  </div>
                ) : effectiveOwner ? (
                  <button onClick={() => ouvrirCarte('presentation')} style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, border: '1.5px dashed #E2C6AE', backgroundColor: 'transparent', color: C.orangeTexte, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const, alignSelf: 'flex-start' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2v4m0 12v4M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.49 8.49 2.83 2.83M4.93 19.07l2.83-2.83m8.49-8.49 2.83-2.83"/></svg>
                    Ajouter votre phrase
                  </button>
                ) : null}

                {/* Pastilles */}
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginTop: 18 }}>

                  {/* Disponibilité */}
                  {p.disponibilite ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, backgroundColor: C.bg, fontSize: 14, fontWeight: 600, color: C.dark }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                      {p.disponibilite === 'maintenant' ? 'Disponible maintenant'
                        : p.disponibilite === 'a_partir_de' ? (() => {
                          if (!p.dispo_date) return 'Disponible prochainement'
                          const d = new Date(p.dispo_date + 'T00:00:00')
                          return `À partir de ${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`
                        })()
                        : p.disponibilite === 'en_poste' ? "En poste, à l'écoute"
                        : 'Pas disponible pour le moment'
                      }
                    </span>
                  ) : effectiveOwner ? (
                    <button onClick={() => ouvrirCarte('recherche')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, border: '1.5px dashed #E2C6AE', backgroundColor: C.white, color: C.orangeTexte, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                      Indiquer votre disponibilité
                    </button>
                  ) : null}

                  {/* Contrat */}
                  {(p.type_poste ?? []).length > 0 ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, backgroundColor: C.bg, fontSize: 14, fontWeight: 600, color: C.dark }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                      {(p.type_poste ?? []).map(k => TYPE_POSTE_MAP[k] ?? k).join(' ou ')}
                    </span>
                  ) : effectiveOwner ? (
                    <button onClick={() => ouvrirCarte('recherche')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, border: '1.5px dashed #E2C6AE', backgroundColor: C.white, color: C.orangeTexte, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                      Indiquer le contrat recherché
                    </button>
                  ) : null}

                  {/* Ville */}
                  {p.ville ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, backgroundColor: C.bg, fontSize: 14, fontWeight: 600, color: C.dark }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                      {p.ville}
                    </span>
                  ) : effectiveOwner ? (
                    <button onClick={() => ouvrirCarte('recherche')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, border: '1.5px dashed #E2C6AE', backgroundColor: C.white, color: C.orangeTexte, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                      Indiquer votre ville
                    </button>
                  ) : null}

                  {/* Télétravail */}
                  {modeTravailLabel && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, backgroundColor: C.bg, fontSize: 14, fontWeight: 600, color: C.dark }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round"><path d="M3 12l2-2m0 0 7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11 2 2m-2-2v10a1 1 0 0 1-1 1h-3m-6 0a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1m-6 0h6"/></svg>
                      {modeTravailLabel}
                    </span>
                  )}

                  {/* Permis */}
                  {(p.permis ?? []).length > 0 ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, backgroundColor: C.bg, fontSize: 14, fontWeight: 600, color: C.dark }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14l3 5v5a2 2 0 0 1-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
                      {(p.permis ?? []).map(v => PERMIS.find(x => x.value === v)?.label ?? v).join(', ')}
                    </span>
                  ) : effectiveOwner ? (
                    <button onClick={() => ouvrirCarte('recherche')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, border: '1.5px dashed #E2C6AE', backgroundColor: C.white, color: C.orangeTexte, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14l3 5v5a2 2 0 0 1-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
                      Ajouter vos permis
                    </button>
                  ) : null}

                  {/* Langues */}
                  {(() => {
                    const restantes = langues
                      .map(entry => {
                        const sep = entry.indexOf(' — ')
                        const nom = sep >= 0 ? entry.slice(0, sep) : entry
                        const niv = sep >= 0 ? entry.slice(sep + 3) : ''
                        if (nom.toLowerCase() === 'français' && niv.toLowerCase() === 'natif') return null
                        return { nom, niv }
                      })
                      .filter((x): x is { nom: string; niv: string } => x !== null)
                    if (restantes.length === 0) return null
                    const texte = restantes.map((x, i) => {
                      const n = i === 0 ? x.nom : x.nom.toLowerCase()
                      const niv = x.niv.toLowerCase()
                      return niv ? `${n} ${niv}` : n
                    }).join(', ')
                    return (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, backgroundColor: C.bg, fontSize: 14, fontWeight: 600, color: C.dark }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                        {texte}
                      </span>
                    )
                  })()}

                </div>

              </div>
            </div>
            {enTeteIsOpen && effectiveOwner && (
              <>
                {carteOuverte === 'presentation' ? (
                  <CartePresentation
                    profil={p}
                    editPrenom={editPrenom} setEditPrenom={setEditPrenom}
                    editNom={editNom} setEditNom={setEditNom}
                    editMetier={editMetier} setEditMetier={setEditMetier}
                    editDomaine={editDomaine} setEditDomaine={setEditDomaine}
                    editExperience={editExperience} setEditExperience={setEditExperience}
                    editSignature={editSignature} setEditSignature={setEditSignature}
                    sigTextareaRef={sigTextareaRef}
                    videoPresentation={p.video_presentation_url}
                    uploadingVedette={uploadingVedette}
                    deletingVideo={deletingVideo}
                    onOpenAvatarModal={openAvatarModal}
                    onOpenRecord={() => { setRecordContext('presentation'); setRecordPhase('preview'); setRecordError(''); setRecordModal(true) }}
                    vedetteVideoInputRef={vedetteVideoInputRef}
                    onDeleteVideo={deleteVideoPresentation}
                    onChange={() => setCarteModifiee(true)}
                  />
                ) : (
                  <CarteRecherche
                    editDispo={editDispo} setEditDispo={setEditDispo}
                    editDispoDate={editDispoDate} setEditDispoDate={setEditDispoDate}
                    editTypePoste={editTypePoste} setEditTypePoste={setEditTypePoste}
                    editVille={editVille} setEditVille={setEditVille}
                    editModeTravail={editModeTravail} setEditModeTravail={setEditModeTravail}
                    editTypeEntreprise={editTypeEntreprise} setEditTypeEntreprise={setEditTypeEntreprise}
                    editPermis={editPermis} setEditPermis={setEditPermis}
                    editLangues={editLangues} setEditLangues={setEditLangues}
                    onChange={() => setCarteModifiee(true)}
                  />
                )}
                {cardFooter(carteOuverte!)}
              </>
            )}
          </div>

          {/* ── PARCOURS ── */}
          {(effectiveOwner || experiences.length > 0 || diplomes.length > 0) && (
            <div style={carteWrapStyle('parcours', '20px 22px')}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <SLabel20>Parcours</SLabel20>
                {effectiveOwner && modifierBtn('parcours')}
              </div>
              {carteOuverte === 'parcours' ? (
                <>
                  <CarteParcours
                    editExperiences={editExperiences as ParcoursExpEdit[]}
                    setEditExperiences={v => setEditExperiences(v as ProfilExperience[])}
                    editDiplomes={editDiplomes as ParcoursDiplomeEdit[]}
                    setEditDiplomes={v => setEditDiplomes(v as ProfilDiplome[])}
                    onChange={() => setCarteModifiee(true)}
                  />
                  {cardFooter('parcours')}
                </>
              ) : (
                (experiences.length > 0 || diplomes.length > 0)
                  ? <CarteParcoursView experiences={experiences} diplomes={diplomes} />
                  : <p style={{ fontSize: 13, color: C.grey, margin: 0 }}>Ajoutez votre parcours professionnel et vos formations.</p>
              )}
            </div>
          )}

          {/* ── QUALITÉS ── */}
          {(effectiveOwner || qualites.length > 0 || qualitesProchesSel.length > 0 || (p.qualites_test && Object.keys(p.qualites_test).length > 0)) && (() => {
            const testLabels = Object.entries(p.qualites_test ?? {}).sort((a, b) => b[1] - a[1]).map(([k]) => QUALITE_LABELS[k] ?? k)
            const procheLabels = qualitesProchesSel.map(s => s.qualite)
            const candidatLabels = qualites
            const nt = new Set(testLabels.map(normalizeText))
            const np = new Set(procheLabels.map(normalizeText))
            const nc = new Set(candidatLabels.map(normalizeText))
            const isCommun = (label: string) => [nt, np, nc].filter(s => s.has(normalizeText(label))).length >= 2
            const tagSt = (label: string): React.CSSProperties => isCommun(label)
              ? { display: 'inline-block', padding: '4px 10px', borderRadius: 7, backgroundColor: C.vert, border: `1px solid ${C.vert}`, fontSize: 13.5, fontWeight: 600, color: C.white }
              : { display: 'inline-block', padding: '4px 10px', borderRadius: 7, backgroundColor: C.white, border: `1px solid ${C.sable}`, fontSize: 13.5, fontWeight: 600, color: C.dark }
            const selIds = new Set(qualitesProchesSel.map(s => s.reponse_id))
            const uniqueProches = [...new Map(reponsesProches.filter(r => selIds.has(r.reponse_id)).map(r => [r.prenom_proche, r])).values()].map(r => r.prenom_proche)
            return (
              <div style={carteWrapStyle('qualites')}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <SLabel20>Qualités</SLabel20>
                  {effectiveOwner && modifierBtn('qualites')}
                </div>
                {carteOuverte === 'qualites' ? (
                  <>
                    <CarteQualites
                      testLabels={testLabels}
                      hasTest={!!(p.qualites_test && Object.keys(p.qualites_test).length > 0)}
                      reponsesProches={reponsesProches}
                      activeInvitations={activeInvitations}
                      editQualites={editQualites}
                      setEditQualites={setEditQualites}
                      editQualitesProches={editQualitesProches}
                      setEditQualitesProches={setEditQualitesProches}
                      onInviter={() => setInvitModalOpen(true)}
                      onChange={() => setCarteModifiee(true)}
                    />
                    {cardFooter('qualites')}
                  </>
                ) : (
                  <>
                    {effectiveOwner && unreadNotifCount > 0 && (
                      <p style={{ margin: '0 0 14px', padding: '11px 16px', borderRadius: 10, backgroundColor: `${C.terracotta}0F`, border: `1px solid ${C.terracotta}35`, fontSize: 13, color: C.terracotta, lineHeight: 1.55 }}>
                        {unreadNotifCount === 1
                          ? 'Un proche vous a répondu. Modifiez votre profil pour découvrir ses mots.'
                          : `Vous avez reçu ${unreadNotifCount} réponses de proches. Modifiez votre profil pour découvrir leurs mots.`}
                      </p>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                      <div style={{ backgroundColor: C.bg, borderRadius: 10, padding: '10px 10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, fontSize: 12.5, fontWeight: 600, color: C.grey }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill={C.vert} stroke="none" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          Selon le questionnaire
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5 }}>
                          {testLabels.length > 0 ? testLabels.map(label => <span key={label} style={tagSt(label)}>{label}</span>) : <span style={{ fontSize: 12, color: C.grey, fontStyle: 'italic' }}>—</span>}
                        </div>
                      </div>
                      <div style={{ backgroundColor: C.bg, borderRadius: 10, padding: '10px 10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, fontSize: 12.5, fontWeight: 600, color: C.grey }}>
                          {uniqueProches.length > 0 ? (
                            <span style={{ display: 'inline-flex', gap: 2, flexShrink: 0 }}>
                              {uniqueProches.slice(0, 3).map((prenom, j) => (
                                <span key={j} style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: `${C.vert}22`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: C.vert }}>
                                  {(prenom[0] ?? '?').toUpperCase()}
                                </span>
                              ))}
                            </span>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                            </svg>
                          )}
                          {effectiveOwner ? 'Selon vos proches' : 'Selon ses proches'}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5 }}>
                          {procheLabels.length > 0 ? procheLabels.map(label => <span key={label} style={tagSt(label)}>{label}</span>) : <span style={{ fontSize: 12, color: C.grey, fontStyle: 'italic' }}>—</span>}
                        </div>
                      </div>
                      <div style={{ backgroundColor: C.bg, borderRadius: 10, padding: '10px 10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, fontSize: 12.5, fontWeight: 600, color: C.grey }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill={C.vert} stroke="none" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                          {effectiveOwner ? 'Selon vous' : `Selon ${p.prenom}`}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5 }}>
                          {candidatLabels.length > 0 ? candidatLabels.map(label => <span key={label} style={tagSt(label)}>{label}</span>) : <span style={{ fontSize: 12, color: C.grey, fontStyle: 'italic' }}>—</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 11, color: C.grey }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: C.vert, flexShrink: 0, display: 'inline-block' }} />
                      Qualité commune à plusieurs sources
                    </div>
                  </>
                )}
              </div>
            )
          })()}

          {/* ── COMPÉTENCES ── */}
          {(competencesAcquises.length > 0 || effectiveOwner) && (
            <div id="competences" style={{ ...carteWrapStyle('competences'), scrollMarginTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <SLabel20>Compétences</SLabel20>
                {effectiveOwner && modifierBtn('competences')}
              </div>
              {carteOuverte === 'competences' ? (
                <>
                  <CarteCompetences
                    valeurs={editCompetences}
                    onChange={setEditCompetences}
                    onMark={() => setCarteModifiee(true)}
                  />
                  {cardFooter('competences')}
                </>
              ) : competencesAcquises.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                  {competencesAcquises.map(s => (
                    <span key={s} style={{ padding: '4px 10px', borderRadius: 7, backgroundColor: C.chip, color: C.chipTexte, fontSize: 13, fontWeight: 500 }}>{s}</span>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 13, color: C.grey }}>Ajoutez vos compétences techniques ou transverses.</span>
                  <button onClick={() => ouvrirCarte('competences')} style={{ padding: '5px 14px', borderRadius: 8, border: 'none', backgroundColor: C.salaire, color: C.vert, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Ajouter</button>
                </div>
              )}
            </div>
          )}

          {/* ── PROJET PHARE ── */}
          {(p.projet_phare || effectiveOwner) && (
            <div style={carteWrapStyle('projet')}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <SLabel20>Mon projet phare</SLabel20>
                {effectiveOwner && modifierBtn('projet')}
              </div>
              {carteOuverte === 'projet' ? (
                <>
                  <CarteProjet
                    editTitre={editProjetTitre} setEditTitre={setEditProjetTitre}
                    editDesc={editProjetDesc} setEditDesc={setEditProjetDesc}
                    editResultat={editProjetResultat} setEditResultat={setEditProjetResultat}
                    editImpact={editProjetImpact} setEditImpact={setEditProjetImpact}
                    initialImpact={p.projet_impact ?? ''}
                    editVideo={editProjetVideo}
                    editImages={editProjetImages}
                    uploadingVideo={uploadingVideo}
                    uploadingImages={uploadingImages}
                    onFilmer={() => { setRecordContext('projet'); setRecordPhase('preview'); setRecordError(''); setRecordModal(true) }}
                    onImporterVideo={() => videoInputRef.current?.click()}
                    onImporterImages={() => imageInputRef.current?.click()}
                    onSupprimerVideo={() => { deleteStorageVideo(editProjetVideo); setEditProjetVideo('') }}
                    onSupprimerImage={url => setEditProjetImages(prev => prev.filter(u => u !== url))}
                    onChange={() => setCarteModifiee(true)}
                  />
                  {cardFooter('projet')}
                </>
              ) : p.projet_phare ? (
                <div style={{ display: 'grid', gridTemplateColumns: p.projet_resultat ? '150px 1fr' : '1fr', gap: 16, alignItems: 'center' }}>
                  {p.projet_resultat && (
                    <div style={{ width: 120, height: 120, borderRadius: 14, backgroundColor: C.vert, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: '12px 8px', flexShrink: 0 }}>
                      <span style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.02em', fontSize: 38, fontWeight: 600, color: C.white, lineHeight: 1 }}>{p.projet_resultat}</span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 5, lineHeight: 1.3, textAlign: 'center' as const }}>résultat clé</span>
                    </div>
                  )}
                  <div>
                    <div style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 16.5, fontWeight: 600, color: C.dark, marginBottom: 8 }}>{p.projet_titre || 'Projet phare'}</div>
                    <p style={{ margin: 0, fontSize: 13.5, color: C.grey, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{p.projet_phare}</p>
                    {!p.projet_resultat && p.projet_impact && (
                      <div style={{ marginTop: 8, fontSize: 13.5, color: C.dark }}>Résultat : <strong>{p.projet_impact}</strong></div>
                    )}
                    <button onClick={() => setProjetModal(true)} style={{ marginTop: 10, padding: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.vert, textDecoration: 'underline', textUnderlineOffset: 3, fontFamily: 'inherit' }}>Voir le projet</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 13, color: C.grey }}>Présentez votre réalisation la plus marquante.</span>
                  <button onClick={() => ouvrirCarte('projet')} style={{ padding: '5px 14px', borderRadius: 8, border: 'none', backgroundColor: C.salaire, color: C.vert, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Ajouter</button>
                </div>
              )}
            </div>
          )}

          {/* ── GRILLE 3 COLONNES ── */}
          {(effectiveOwner || (p.priorites && p.priorites.length > 0) || passions.length > 0 || liensAffiches.length > 0) && (
            <div className="profil-col3">

              {/* Ce qui compte */}
              {(effectiveOwner || (p.priorites && p.priorites.length > 0)) && (
                <div style={carteWrapStyle('priorites')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <SLabel17>Ce qui compte</SLabel17>
                    {effectiveOwner && modifierBtn('priorites')}
                  </div>
                  {carteOuverte === 'priorites' ? (
                    <>
                      <p style={{ fontSize: 13.5, color: C.grey, margin: '0 0 16px' }}>Vos priorités en termes d&apos;environnement de travail.</p>
                      {cardFooter('priorites')}
                    </>
                  ) : p.priorites && p.priorites.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                      {(p.priorites ?? []).map(item => (
                        <span key={item} style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 8, backgroundColor: C.salaire, color: C.vert, fontSize: 13, fontWeight: 600 }}>{item}</span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 13, color: C.grey }}>Vos priorités en termes d&apos;environnement.</span>
                      <button onClick={() => ouvrirCarte('priorites')} style={{ padding: '5px 14px', borderRadius: 8, border: 'none', backgroundColor: C.salaire, color: C.vert, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Ajouter</button>
                    </div>
                  )}
                </div>
              )}

              {/* Ce qui anime */}
              {(effectiveOwner || passions.length > 0) && (
                <div style={carteWrapStyle('passions')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <SLabel17>{effectiveOwner ? "Ce qui m'anime" : "Ce qui l'anime"}</SLabel17>
                    {effectiveOwner && modifierBtn('passions')}
                  </div>
                  {carteOuverte === 'passions' ? (
                    <>
                      <p style={{ fontSize: 13.5, color: C.grey, margin: '0 0 16px' }}>Vos passions en dehors du travail.</p>
                      {cardFooter('passions')}
                    </>
                  ) : passions.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
                      {passions.map(passion => (
                        <div key={passion} style={{ width: 96, padding: '12px 6px', borderRadius: 12, backgroundColor: C.bg, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: C.salaire, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {iconePassion(passion)}
                          </div>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: C.dark, textAlign: 'center' as const, lineHeight: 1.3, wordBreak: 'break-word' as const }}>{passion}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 13, color: C.grey }}>Vos passions en dehors du travail.</span>
                      <button onClick={() => ouvrirCarte('passions')} style={{ padding: '5px 14px', borderRadius: 8, border: 'none', backgroundColor: C.salaire, color: C.vert, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Ajouter</button>
                    </div>
                  )}
                </div>
              )}

              {/* Liens */}
              {(effectiveOwner || liensAffiches.length > 0) && (
                <div style={carteWrapStyle('liens')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <SLabel17>Liens</SLabel17>
                    {effectiveOwner && modifierBtn('liens')}
                  </div>
                  {carteOuverte === 'liens' ? (
                    <>
                      <p style={{ fontSize: 13.5, color: C.grey, margin: '0 0 16px' }}>Ajoutez votre LinkedIn, portfolio ou site web.</p>
                      {cardFooter('liens')}
                    </>
                  ) : liensAffiches.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
                      {liensAffiches.map((lien, i) => {
                        let hostname = ''
                        try { hostname = new URL(lien.url).hostname.replace(/^www\./, '') } catch {}
                        return (
                          <a key={i} href={lien.url} target="_blank" rel="noopener noreferrer" className="profil-lien-row">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                            </svg>
                            <span style={{ fontSize: 14, fontWeight: 600, color: C.dark, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{lien.intitule}</span>
                            <span style={{ fontSize: 12.5, color: C.grey, flexShrink: 0 }}>{hostname}</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.grey} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                              <polyline points="9 18 15 12 9 6"/>
                            </svg>
                          </a>
                        )
                      })}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 13, color: C.grey }}>Ajoutez votre LinkedIn, portfolio ou site web.</span>
                      <button onClick={() => ouvrirCarte('liens')} style={{ padding: '5px 14px', borderRadius: 8, border: 'none', backgroundColor: C.salaire, color: C.vert, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Ajouter</button>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>

      {/* ━━━ MODALE PROJET PHARE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {projetModal && (
        <div onClick={() => setProjetModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.72)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: C.white, borderRadius: 20, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', padding: 'clamp(24px, 4%, 40px)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
              <h2 style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 22, color: C.dark, margin: 0, fontWeight: 600, lineHeight: 1.3 }}>{p.projet_titre || 'Projet phare'}</h2>
              <button onClick={() => setProjetModal(false)} style={{ flexShrink: 0, width: 36, height: 36, borderRadius: '50%', border: `1px solid ${C.sable}`, backgroundColor: C.bg, color: C.grey, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {projetVideoUrl && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.grey, marginBottom: 10 }}>Présentation du projet (30 sec)</div>
                <div style={{ backgroundColor: '#000', borderRadius: 12, overflow: 'hidden' }}><video src={projetVideoUrl} controls style={{ width: '100%', maxHeight: 320, display: 'block' }} /></div>
              </div>
            )}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.grey, marginBottom: 10 }}>Description</div>
              <p style={{ margin: 0, fontSize: 14, color: C.dark, lineHeight: 1.75 }}>{p.projet_phare}</p>
              {projetImpact && <div style={{ marginTop: 14 }}><span style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 20, backgroundColor: `${C.terracotta}15`, color: C.terracotta, fontSize: 13, fontWeight: 700 }}>{projetImpact}</span></div>}
            </div>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.grey, marginBottom: 10 }}>Images</div>
              {projetImages.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                  {projetImages.map((url, i) => (
                    <div key={i} onClick={() => setZoomImage(url)} style={{ borderRadius: 10, overflow: 'hidden', cursor: 'zoom-in', aspectRatio: '16/9', backgroundColor: C.sable }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 20, textAlign: 'center' as const, color: C.grey, fontSize: 13, backgroundColor: C.bg, borderRadius: 10 }}>Aucune image ajoutée</div>
              )}
            </div>
            {projetLien && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.grey, marginBottom: 10 }}>Lien</div>
                <a href={projetLien} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, backgroundColor: C.vert, color: C.white, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Voir le projet en ligne →</a>
                <div style={{ fontSize: 12, color: C.grey, marginTop: 6 }}>{projetLien.length > 60 ? projetLien.slice(0, 60) + '…' : projetLien}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ━━━ MODALE VIDÉO PORTRAIT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {portraitVideoOpen && videoPresentation && (
        <div onClick={() => setPortraitVideoOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 760 }}>
            <VideoPlayer src={videoPresentation} miroir={videoMiroir} frameStyle={{ borderRadius: 16, aspectRatio: '16 / 9', boxShadow: '0 8px 36px rgba(36,69,58,0.14)' }} />
            <button onClick={() => setPortraitVideoOpen(false)} style={{ marginTop: 14, display: 'block', margin: '14px auto 0', padding: '8px 20px', borderRadius: 10, border: 'none', backgroundColor: 'rgba(255,255,255,0.1)', color: C.white, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Fermer</button>
          </div>
        </div>
      )}

      {/* ━━━ MODALE AVATAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {avatarModal && (
        <div onClick={() => setAvatarModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: C.white, borderRadius: 24, width: '100%', maxWidth: 480, padding: 'clamp(24px, 4%, 36px)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 20, color: C.dark, margin: 0, fontWeight: 600 }}>Personnaliser mon avatar</h2>
              <button onClick={() => setAvatarModal(false)} style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid ${C.sable}`, backgroundColor: C.bg, color: C.grey, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 28, backgroundColor: C.bg, borderRadius: 12, padding: 4 }}>
              {(['photo', 'avatar', 'initiales'] as const).map(tab => (
                <button key={tab} onClick={() => setAvatarTab(tab)} style={{ flex: 1, padding: '8px 6px', borderRadius: 9, border: 'none', backgroundColor: avatarTab === tab ? C.white : 'transparent', boxShadow: avatarTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', color: avatarTab === tab ? C.dark : C.grey, fontSize: 13, fontWeight: avatarTab === tab ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}>
                  {tab === 'photo' ? '📷 Photo' : tab === 'avatar' ? '🧑 Avatar' : '✦ Initiales'}
                </button>
              ))}
            </div>
            {avatarTab === 'photo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
                {avatarPreview ? (
                  <div style={{ width: 110, height: 110, borderRadius: '50%', overflow: 'hidden', border: `3px solid ${C.terracotta}`, flexShrink: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatarPreview} alt="Prévisualisation" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                ) : (
                  <div style={{ width: 110, height: 110, borderRadius: '50%', backgroundColor: C.bg, border: `2px dashed ${C.sable}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>📷</div>
                )}
                <button onClick={() => avatarFileRef.current?.click()} style={{ padding: '10px 24px', borderRadius: 12, border: `1.5px solid ${C.sable}`, backgroundColor: C.white, color: C.dark, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>📷 Choisir une photo</button>
                <p style={{ fontSize: 12, color: C.grey, margin: 0, textAlign: 'center' as const }}>JPG, PNG ou WebP · Max 5 MB · Recadrage circulaire automatique</p>
              </div>
            )}
            {avatarTab === 'avatar' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, justifyItems: 'center' }}>
                  {['🧑','👩','👨','🧔','👱','👩‍🦱','👨‍🦱','👩‍🦰','👨‍🦰','🧓','👴','👵'].map(emoji => (
                    <button key={emoji} onClick={() => setSelectedEmoji(emoji)} style={{ width: 54, height: 54, borderRadius: '50%', border: `3px solid ${selectedEmoji === emoji ? C.terracotta : C.sable}`, backgroundColor: selectedEmoji === emoji ? `${C.terracotta}12` : C.bg, fontSize: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>{emoji}</button>
                  ))}
                </div>
                {selectedEmoji && <p style={{ fontSize: 12, color: C.grey, textAlign: 'center' as const, margin: 0 }}>Sélectionné : <span style={{ fontSize: 20 }}>{selectedEmoji}</span></p>}
              </div>
            )}
            {avatarTab === 'initiales' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
                <div style={{ width: 96, height: 96, borderRadius: '50%', backgroundColor: selectedColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 30, color: C.white, fontWeight: 600 }}>{initials}</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const, justifyContent: 'center' }}>
                  {[C.orange,C.vert,'#3B82F6','#7C3AED','#EC4899','#475569'].map(color => (
                    <button key={color} onClick={() => setSelectedColor(color)} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', backgroundColor: color, cursor: 'pointer', outline: selectedColor === color ? `3px solid ${C.dark}` : '3px solid transparent', outlineOffset: 2, transition: 'outline 0.15s' }} title={color} />
                  ))}
                </div>
                <p style={{ fontSize: 12, color: C.grey, margin: 0 }}>Vos initiales : <strong style={{ color: C.dark }}>{initials}</strong></p>
              </div>
            )}
            <div style={{ marginTop: 28, display: 'flex', gap: 10 }}>
              <button onClick={() => setAvatarModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 12, border: `1.5px solid ${C.sable}`, backgroundColor: 'transparent', color: C.dark, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
              <button onClick={saveAvatar} disabled={uploadingAvatar || (avatarTab === 'photo' && !avatarFile) || (avatarTab === 'avatar' && !selectedEmoji)} style={{ flex: 2, padding: '11px', borderRadius: 12, border: 'none', backgroundColor: C.terracotta, color: C.white, fontSize: 14, fontWeight: 600, cursor: uploadingAvatar ? 'default' : 'pointer', opacity: (uploadingAvatar || (avatarTab === 'photo' && !avatarFile) || (avatarTab === 'avatar' && !selectedEmoji)) ? 0.55 : 1, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {uploadingAvatar && <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', animation: 'kapolia-spin 0.7s linear infinite' }} />}
                {uploadingAvatar ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━ ZOOM IMAGE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {zoomImage && (
        <div onClick={() => setZoomImage(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.92)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomImage} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8, display: 'block' }} />
        </div>
      )}

      {/* ━━━ MODALE ENREGISTREMENT VIDÉO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {recordModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ backgroundColor: '#111', borderRadius: 24, overflow: 'hidden', width: '100%', maxWidth: 680, display: 'flex', flexDirection: 'column' as const, maxHeight: '92vh' }}>

            {/* Header */}
            <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.white, letterSpacing: '0.02em' }}>
                {recordPhase === 'playback' ? 'Prévisualisation' : 'Présentation vidéo'}
              </span>
              <button onClick={closeRecordModal} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.18)', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, lineHeight: 1 }}>✕</button>
            </div>

            {/* Video area — landscape 16:9 */}
            <div style={{ position: 'relative', backgroundColor: '#000', aspectRatio: '16 / 9', overflow: 'hidden', flexShrink: 0 }}>

              {/* Error */}
              {recordPhase === 'error' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 28, textAlign: 'center' as const }}>
                  <span style={{ fontSize: 48 }}>📷</span>
                  <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{recordError}</p>
                  <button
                    onClick={() => { closeRecordModal(); setTimeout(() => (recordContext === 'projet' ? videoInputRef : mobileRecordInputRef).current?.click(), 50) }}
                    style={{ padding: '10px 20px', borderRadius: 12, border: 'none', backgroundColor: C.terracotta, color: C.white, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Utiliser la caméra native
                  </button>
                </div>
              )}

              {/* Camera live feed */}
              {(recordPhase === 'preview' || recordPhase === 'countdown' || recordPhase === 'recording') && (
                <>
                  <video
                    ref={previewVideoRef}
                    muted
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }}
                  />

                  {/* Countdown overlay */}
                  {recordPhase === 'countdown' && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }}>
                      <div style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 112, color: C.white, fontWeight: 600, lineHeight: 1, textShadow: '0 4px 24px rgba(0,0,0,0.6)' }}>{countdown}</div>
                    </div>
                  )}

                  {/* Tips overlay during recording */}
                  {recordPhase === 'recording' && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.72))', padding: '32px 16px 14px' }}>
                      {['Qui vous êtes et votre domaine', 'Ce que vous recherchez', 'Ce qui vous anime'].map((tip, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                          <span style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: `${C.terracotta}cc`, fontSize: 9, fontWeight: 700, color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.88)' }}>{tip}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Timer */}
                  {recordPhase === 'recording' && (
                    <div style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(194, 97, 31,0.9)', borderRadius: 20, padding: '3px 11px', fontSize: 12, fontWeight: 700, color: C.white, fontFamily: 'monospace' }}>
                      {String(Math.floor(recordDuration / 60)).padStart(2, '0')}:{String(recordDuration % 60).padStart(2, '0')} / {recordContext === 'projet' ? '00:45' : '01:00'}
                    </div>
                  )}

                  {/* Red dot */}
                  {recordPhase === 'recording' && (
                    <div style={{ position: 'absolute', top: 16, left: 14, width: 9, height: 9, borderRadius: '50%', backgroundColor: '#E74C3C', boxShadow: '0 0 0 3px rgba(231,76,60,0.3)', animation: 'kapolia-pulse 1.2s ease-in-out infinite' }} />
                  )}
                </>
              )}

              {/* Playback */}
              {recordPhase === 'playback' && recordedUrl && (
                <video
                  src={recordedUrl}
                  controls
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', backgroundColor: '#000' }}
                />
              )}
            </div>

            {/* Controls */}
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column' as const, gap: 9 }}>
              {recordPhase === 'preview' && (
                <button onClick={startCountdown} style={{ padding: '12px', borderRadius: 14, border: 'none', backgroundColor: C.terracotta, color: C.white, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ● Commencer l'enregistrement
                </button>
              )}

              {recordPhase === 'countdown' && (
                <button disabled style={{ padding: '12px', borderRadius: 14, border: 'none', backgroundColor: C.grey, color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 700, cursor: 'default', fontFamily: 'inherit' }}>
                  Préparez-vous…
                </button>
              )}

              {recordPhase === 'recording' && (
                <button onClick={stopRecording} style={{ padding: '12px', borderRadius: 14, border: 'none', backgroundColor: '#E74C3C', color: C.white, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ■ Arrêter
                </button>
              )}

              {recordPhase === 'playback' && (
                <>
                  <button
                    onClick={useRecordedVideo}
                    disabled={uploadingVedette}
                    style={{ padding: '12px', borderRadius: 14, border: 'none', backgroundColor: uploadingVedette ? C.grey : C.vert, color: C.white, fontSize: 14, fontWeight: 700, cursor: uploadingVedette ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    {uploadingVedette && <span style={{ display: 'inline-block', width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: C.white, animation: 'kapolia-spin 0.7s linear infinite' }} />}
                    {uploadingVedette ? 'Envoi en cours…' : '✓ Utiliser cette vidéo'}
                  </button>
                  <button
                    onClick={retakeRecording}
                    disabled={uploadingVedette}
                    style={{ padding: '11px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.18)', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 500, cursor: uploadingVedette ? 'default' : 'pointer', fontFamily: 'inherit' }}
                  >
                    ↩ Recommencer
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ── Modal export portrait PDF ──────────────────────────────────────── */}
      {portraitModal && (
        <div
          onClick={() => !downloadingPortrait && setPortraitModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 32,
              maxWidth: 480,
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
          >
            <p style={{ margin: 0, marginBottom: 20, fontSize: 18, fontWeight: 700, color: C.vert, fontFamily: 'inherit' }}>
              Générer mon portrait PDF
            </p>

            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: C.dark }}>
              Intitulé de poste
            </label>
            <input
              type="text"
              value={portraitTitle}
              onChange={e => {
                const v = e.target.value.slice(0, 70)
                setPortraitTitle(v)
                if (typeof window !== 'undefined') localStorage.setItem(`kapolia_portrait_title_${userId}`, v)
              }}
              maxLength={70}
              placeholder={profil?.domaine ?? 'Ex : Responsable marketing'}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 14px', borderRadius: 8,
                border: '1.5px solid #E0D8CF', fontSize: 14,
                marginBottom: 16, fontFamily: 'inherit', outline: 'none',
              }}
            />

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={portraitShowEmail}
                onChange={e => {
                  setPortraitShowEmail(e.target.checked)
                  if (typeof window !== 'undefined') localStorage.setItem(`kapolia_portrait_email_${userId}`, String(e.target.checked))
                }}
                style={{ width: 16, height: 16, accentColor: C.vert, flexShrink: 0 }}
              />
              <span style={{ color: C.dark }}>Afficher mon adresse e-mail</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 13, cursor: profil?.telephone ? 'pointer' : 'default' }}>
              <input
                type="checkbox"
                checked={portraitShowPhone}
                onChange={e => {
                  setPortraitShowPhone(e.target.checked)
                  if (typeof window !== 'undefined') localStorage.setItem(`kapolia_portrait_phone_${userId}`, String(e.target.checked))
                }}
                disabled={!profil?.telephone}
                style={{ width: 16, height: 16, accentColor: C.vert, flexShrink: 0 }}
              />
              <span style={{ color: profil?.telephone ? C.dark : C.grey }}>
                Afficher mon téléphone
                {!profil?.telephone && (
                  <span style={{ fontStyle: 'italic', marginLeft: 8, fontSize: 12, color: C.grey }}>
                    (aucun numéro renseigné dans vos paramètres)
                  </span>
                )}
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, fontSize: 13, cursor: profil?.avatar_type === 'photo' ? 'pointer' : 'default' }}>
              <input
                type="checkbox"
                checked={portraitWithPhoto}
                onChange={e => setPortraitWithPhoto(e.target.checked)}
                disabled={profil?.avatar_type !== 'photo'}
                style={{ width: 16, height: 16, accentColor: C.vert, flexShrink: 0 }}
              />
              <span style={{ color: profil?.avatar_type !== 'photo' ? C.grey : C.dark }}>
                Afficher ma photo
                {profil?.avatar_type !== 'photo' && (
                  <span style={{ fontStyle: 'italic', marginLeft: 8, fontSize: 12, color: C.grey }}>
                    (aucune photo de profil ajoutée)
                  </span>
                )}
              </span>
            </label>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setPortraitModal(false)}
                disabled={downloadingPortrait}
                style={{
                  padding: '9px 20px', borderRadius: 10,
                  border: '1.5px solid #E0D8CF', background: 'white',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Annuler
              </button>
              <button
                disabled={downloadingPortrait}
                onClick={async () => {
                  setDownloading(true)
                  try {
                    const { data: { session } } = await supabase.auth.getSession()
                    if (!session) throw new Error('session manquante')
                    const params = new URLSearchParams()
                    if (portraitTitle) params.set('title', portraitTitle)
                    if (portraitWithPhoto) params.set('withPhoto', 'true')
                    if (!portraitShowEmail) params.set('showEmail', 'false')
                    if (!portraitShowPhone) params.set('showPhone', 'false')
                    const res = await fetch(`/api/portrait?${params}`, {
                      headers: { Authorization: `Bearer ${session.access_token}` },
                    })
                    if (!res.ok) throw new Error(`HTTP ${res.status}`)
                    const blob = await res.blob()
                    const url  = URL.createObjectURL(blob)
                    const a    = document.createElement('a')
                    a.href     = url
                    a.download = `${profil?.prenom ?? 'portrait'}_${profil?.nom ?? ''}_portrait.pdf`
                    a.click()
                    URL.revokeObjectURL(url)
                    setPortraitModal(false)
                  } catch (e) {
                    console.error('[portrait] téléchargement échoué', e)
                  } finally {
                    setDownloading(false)
                  }
                }}
                style={{
                  padding: '9px 20px', borderRadius: 10,
                  border: 'none', backgroundColor: C.terracotta,
                  color: 'white', fontSize: 13, fontWeight: 600,
                  cursor: downloadingPortrait ? 'default' : 'pointer',
                  fontFamily: 'inherit', opacity: downloadingPortrait ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {downloadingPortrait
                  ? <><span style={{ display: 'inline-block', width: 11, height: 11, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: 'white', animation: 'kapolia-spin 0.7s linear infinite' }} />Génération...</>
                  : '↓ Télécharger le PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {effectiveOwner && (
        <InvitationModal
          open={invitModalOpen}
          onClose={() => setInvitModalOpen(false)}
          candidatId={userId}
          activeCount={activeInvitations.length}
          onCreated={inv => setActiveInvitations(prev => [...prev, inv])}
        />
      )}

      {effectiveOwner && <AssistantProfilPanel isEditing={false} />}
    </main>
  )
}
