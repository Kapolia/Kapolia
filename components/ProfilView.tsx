'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FONT_SERIF } from '@/lib/typography'
import { trouverConversation } from '@/lib/conversations'
import Avatar from '@/components/Avatar'
import LogoKapolia from '@/components/LogoKapolia'
import { LANGUES } from '@/lib/langues'
import { COMP_REF, DOMAINES, PREFERENCES_TELETRAVAIL } from '@/lib/referentiels'
import { QUALITE_LABELS } from '@/lib/test-qualites'
import MissionsTextArea from '@/components/MissionsTextArea'
import SignatureCounter from '@/components/SignatureCounter'
import { MAX_SIGNATURE, MAX_PROJET_TITRE, MAX_PROJET_DESC } from '@/lib/constants'
import InvitationModal, { type ActiveInvitation } from '@/components/InvitationModal'
import AssistantProfilPanel from '@/components/AssistantProfilPanel'
import { C as _C, CARD_RADIUS, CARD_SHADOW } from '@/lib/colors'
import { sanitizeFilename } from '@/lib/storage-utils'

const C = { ..._C, lightGrey: '#C8C8C8' as const }


function isFromRef(comp: string): boolean {
  return Object.values(COMP_REF).some(list => list.includes(comp))
}

// ─── Palette ──────────────────────────────────────────────────────────────────

// ─── Types ────────────────────────────────────────────────────────────────────

type ProfilExperience = {
  poste: string; entreprise: string
  date_debut: string; date_fin: string; en_poste: boolean; missions: string
}

type ProfilDiplome = {
  intitule: string; ecole: string; annee: string; mention?: string
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
  projet_titre?: string; projet_impact?: string; projet_lien?: string
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
  'projet_titre', 'projet_impact', 'projet_lien', 'projet_images', 'projet_video_url',
  'avatar_url', 'avatar_type', 'telephone', 'linkedin_url', 'portfolio_url',
  'plus_grande_reussite', 'ce_que_je_veux_apprendre', 'derniere_maj_profil',
  'video_presentation_url', 'video_miroir', 'qualites_test', 'liens',
  'email_notifications', 'messages_recruteurs', 'visible_candidatheque',
].join(', ')

const COLONNES_VISITEUR = [
  'user_id', 'prenom', 'nom', 'domaine', 'experience', 'signature',
  'qualites', 'type_entreprise', 'valeur', 'projet_phare', 'passions',
  'type_poste', 'mode_travail', 'disponibilite', 'dispo_date', 'priorites',
  'ville',
  'experiences', 'diplomes', 'competences_acquises', 'langues',
  'projet_titre', 'projet_impact', 'projet_lien', 'projet_images', 'projet_video_url',
  'avatar_url', 'avatar_type', 'linkedin_url', 'portfolio_url',
  'plus_grande_reussite', 'ce_que_je_veux_apprendre', 'derniere_maj_profil',
  'video_presentation_url', 'video_miroir', 'qualites_test', 'liens',
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
  { key: 'maintenant',      label: 'Disponible maintenant', color: '#27AE60' },
  { key: 'a_partir_de',    label: 'À partir de…',          color: '#E67E22' },
  { key: 'non_disponible', label: 'Non disponible',         color: C.erreur },
]

const MOIS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]

const NIVEAUX_LANGUE = ['Natif', 'Courant', 'Intermédiaire', 'Débutant']

const PASSION_EMOJIS: Record<string, string> = {
  Musique: '🎵', Sport: '⚽', Lecture: '📚', Voyage: '✈️', Cuisine: '🍳',
  Jeux: '🎮', Photo: '📷', Art: '🎨', Cinema: '🎬', Tech: '💻',
  Nature: '🌿', Yoga: '🧘', Gaming: '🕹️', Podcast: '🎙️',
  Randonnée: '🥾', Danse: '💃', Ecriture: '✍️', Dessin: '✏️', Montagne: '⛰️',
}

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
      return { color: '#E67E22', label: `À partir de ${label}` }
    }
    return { color: '#E67E22', label: 'Disponible prochainement' }
  }
  if (dispo === 'maintenant') return { color: '#27AE60', label: 'Disponible maintenant' }
  return { color: '#27AE60', label: 'Disponible' }
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
  const volIcon     = (muted || volume === 0) ? '🔇' : volume < 0.4 ? '🔉' : '🔊'

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
            <button onClick={toggleMute} style={btnBase}>{volIcon}</button>
          </div>

          {/* Plein écran */}
          <button onClick={toggleFullscreen} style={{ ...btnBase, fontSize: 12, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.03em' }}>
            {isFullscreen ? '✕' : '⛶'}
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
  const color = score >= 80 ? '#6ABFA0' : score >= 60 ? C.terracotta : C.lightGrey
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
  const [projetModal, setProjetModal]         = useState(false)
  const [zoomImage, setZoomImage]             = useState<string | null>(null)
  const [projetCardHover, setProjetCardHover] = useState(false)

  const [toastMsg, setToastMsg]         = useState('')
  const [toastVisible, setToastVisible]         = useState(false)
  const [writingMsg, setWritingMsg]             = useState(false)
  const [downloadingPortrait, setDownloading]    = useState(false)
  const [portraitModal, setPortraitModal]        = useState(false)
  const [portraitTitle, setPortraitTitle]        = useState('')
  const [portraitWithPhoto, setPortraitWithPhoto] = useState(false)
  const [portraitShowEmail, setPortraitShowEmail] = useState(true)
  const [portraitShowPhone, setPortraitShowPhone] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving]       = useState(false)

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
  const [editTypeEntreprise, setEditTypeEntreprise] = useState<string[]>([])
  const [editPriorite, setEditPriorite]             = useState<string[]>([])
  const [editLangues, setEditLangues]               = useState<string[]>([])
  const [selectingLangue, setSelectingLangue]       = useState('')
  const [editPassions, setEditPassions]             = useState<string[]>([])
  const [newPassion, setNewPassion]                 = useState('')
  const [uploadingVedette, setUploadingVedette]     = useState(false)
  const [deletingVideo, setDeletingVideo]           = useState(false)
  const [togglingMiroir, setTogglingMiroir]         = useState(false)

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
        setIsEditing(true)
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

  // Marquer les notifications reponse_proche comme lues au passage en modification
  useEffect(() => {
    if (!isEditing || !isOwner || unreadNotifCount === 0) return
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
  }, [isEditing, isOwner, unreadNotifCount, userId])

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

  function showToast(msg: string) {
    setToastMsg(msg); setToastVisible(true)
    setTimeout(() => setToastVisible(false), 3000)
  }

  function startEdit() {
    setEditSignature(p.signature ?? '')
    setEditQualites([...(p.qualites ?? [])])
    setEditCompetences([...(p.competences_acquises ?? [])])
    setEditExperiences(JSON.parse(JSON.stringify(p.experiences ?? [])))
    setEditDiplomes(JSON.parse(JSON.stringify(p.diplomes ?? [])))
    setEditProjetTitre(p.projet_titre ?? '')
    setEditProjetDesc(p.projet_phare ?? '')
    setEditProjetImpact(p.projet_impact ?? '')
    setEditProjetLien(p.projet_lien ?? '')
    setEditProjetImages([...(p.projet_images ?? [])])
    setEditProjetVideo(p.projet_video_url ?? '')
    setEditVille(p.ville ?? '')
    setEditModeTravail(p.mode_travail ?? '')
    setEditDispo(p.disponibilite ?? '')
    setEditDispoDate(p.dispo_date ?? '')
    setEditTypePoste([...(p.type_poste ?? [])])
    setEditPriorite([...(p.priorites ?? [])])
    setEditLiens(p.liens && p.liens.length > 0 ? [...p.liens] : [
      ...(p.linkedin_url ? [{ intitule: 'LinkedIn', url: p.linkedin_url }] : []),
      ...(p.portfolio_url ? [{ intitule: 'Portfolio', url: p.portfolio_url }] : []),
    ])
    setEditLiensErrs({})
    setEditTypeEntreprise([...(p.type_entreprise ?? [])])
    setEditLangues([...(p.langues ?? [])])
    setEditPassions([...(p.passions ?? [])])
    setNewQualite(''); setNewCompetence('')
    setEditQualitesProches([...qualitesProchesSel])
    setIsEditing(true)
  }

  function cancelEdit() {
    setEditQualitesProches([...qualitesProchesSel])
    setIsEditing(false)
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

  async function saveEdit() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    // ── Valider et sauvegarder les liens via la route sécurisée ─────────────
    if (isOwner) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        const res = await fetch('/api/profil/liens', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ liens: editLiens }),
        })
        const json = await res.json()
        if (!res.ok || json.errors) {
          setEditLiensErrs(json.errors ?? { 0: json.error ?? 'Erreur de validation.' })
          setSaving(false)
          return
        }
        setEditLiensErrs({})
      }
    }

    const coreData = {
      signature:                editSignature,
      qualites:                 editQualites,
      competences_acquises:     editCompetences,
      experiences:              editExperiences,
      diplomes:                 editDiplomes,
      projet_phare:             editProjetDesc,
      ville:                    editVille,
      mode_travail:             editModeTravail,
      disponibilite:            editDispo || null,
      dispo_date:               editDispo === 'a_partir_de' ? (editDispoDate || null) : null,
      type_poste:               editTypePoste,
      priorites:                editPriorite,
      type_entreprise:          editTypeEntreprise,
      langues:                  editLangues,
      passions:                 editPassions,
    }

    const projetData = {
      projet_titre:     editProjetTitre,
      projet_impact:    editProjetImpact,
      projet_lien:      editProjetLien,
      projet_images:    editProjetImages,
      projet_video_url: editProjetVideo,
    }

    const editData = { ...coreData, ...projetData }

    const { error } = await supabase.from('profils').update(editData).eq('user_id', user.id)

    if (!error) {
      setProfil(prev => prev ? { ...prev, ...editData, liens: editLiens } : null)

      // ── Sauvegarde intégrée de la sélection de qualités reçues ──────────────
      const currentSet = new Set(qualitesProchesSel.map(s => s.qualite))
      const newMap     = new Map(editQualitesProches.map(s => [s.qualite, s.reponse_id]))
      const toDelete   = qualitesProchesSel.filter(s => !newMap.has(s.qualite))
      const toInsert   = editQualitesProches.filter(s => !currentSet.has(s.qualite))
      let prochesErr   = false

      if (toDelete.length > 0) {
        const { error: errDel } = await supabase
          .from('qualites_proches_selectionnees')
          .delete()
          .eq('user_id', user.id)
          .in('qualite', toDelete.map(s => s.qualite))
        if (errDel) prochesErr = true
      }
      if (!prochesErr && toInsert.length > 0) {
        const { error: errIns } = await supabase
          .from('qualites_proches_selectionnees')
          .insert(toInsert.map(s => ({ user_id: user.id, reponse_id: s.reponse_id, qualite: s.qualite })))
        if (errIns) prochesErr = true
      }

      setIsEditing(false)
      setSaving(false)
      if (prochesErr) {
        showToast('Profil enregistré. La sélection de qualités reçues n\'a pas pu être sauvegardée — réessayez en repassant en modification.')
      } else {
        setQualitesProchesSel([...editQualitesProches])
        showToast('Profil mis à jour ✓')
      }
      return
    }

    if (error.code === '42703') {
      console.warn('Colonnes projet_* absentes — sauvegarde partielle des champs de base.')
      const { error: err2 } = await supabase.from('profils').update(coreData).eq('user_id', user.id)
      if (!err2) {
        setProfil(prev => prev ? { ...prev, ...coreData } : null)
        setIsEditing(false)
        showToast('Profil mis à jour ✓ (colonnes projet manquantes — voir console)')
      } else {
        showToast(`Erreur : ${err2.message}`)
      }
    } else {
      showToast(`Erreur : ${error.message}`)
    }

    setSaving(false)
  }

  async function processImageFiles(files: File[]) {
    const remaining = 5 - editProjetImages.length
    if (remaining <= 0) { showToast('Maximum 5 images.'); return }
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
    if (duration > 30) { showToast('La vidéo doit faire 30 secondes maximum.'); return }
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
      if (elapsed >= 60) stopRecording()
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
    const file = new File([recordedBlob], `presentation-${Date.now()}.${ext}`, { type: recordedBlob.type })
    closeRecordModal()
    await uploadVedetteVideo(file)
  }

  function updateExp(i: number, patch: Partial<ProfilExperience>) {
    const arr = [...editExperiences]; arr[i] = { ...arr[i], ...patch }; setEditExperiences(arr)
  }
  function updateDip(i: number, patch: Partial<ProfilDiplome>) {
    const arr = [...editDiplomes]; arr[i] = { ...arr[i], ...patch }; setEditDiplomes(arr)
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <main style={{ backgroundColor: C.bg, minHeight: '100vh', marginLeft: sidebarOffset, paddingBottom: isEditing ? 72 : 0 }}>
      <style suppressHydrationWarning>{`
        @keyframes kapolia-spin { to { transform: rotate(360deg); } }
        @keyframes kapolia-pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
        * { box-sizing: border-box; }
        .btn-portrait:hover:not(:disabled) { opacity: 0.8; }
        .profil-layout { display: flex; gap: 20px; align-items: flex-start; }
        .profil-left { width: 360px; flex-shrink: 0; position: sticky; top: 20px; }
        .profil-right { flex: 1; min-width: 0; }
        @media (max-width: 1000px) {
          .profil-layout { flex-direction: column; }
          .profil-left { width: 100%; position: static; }
        }
      `}</style>

      {/* Toast */}
      <div style={{
        position: 'fixed', bottom: isEditing ? 84 : 28, left: '50%',
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


      {/* ━━━ MISE EN PAGE DEUX COLONNES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 80px' }}>
        <div className="profil-layout">

          {/* ── COLONNE GAUCHE (fixe) ─────────────────────────────────────── */}
          <div className="profil-left">

            {/* Carte verte — identité */}
            <div style={{ backgroundColor: C.vert, borderRadius: CARD_RADIUS, boxShadow: '0 1px 2px rgba(27, 48, 38, .10), 0 6px 16px rgba(27, 48, 38, .14)', padding: '20px 16px 16px', marginBottom: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar profil={p} size="lg" />
            {isEditing && (
              <button
                onClick={openAvatarModal}
                style={{
                  position: 'absolute', inset: 0, borderRadius: '50%', border: 'none',
                  backgroundColor: 'rgba(0,0,0,0.45)', color: C.white, fontSize: 20,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0, transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0' }}
                title="Changer l'avatar"
              >
                ✎
              </button>
            )}
            {!isEditing && (
              <div style={{
                position: 'absolute', bottom: 2, right: 2, width: 16, height: 16, borderRadius: '50%',
                backgroundColor: dispo.color, border: `2.5px solid ${C.vert}`,
              }} title={dispo.label} />
            )}
          </div>

          {/* Identité */}
          <div style={{ width: '100%', textAlign: 'center' }}>
            <h1 style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 20, color: C.white, fontWeight: 600, margin: '0 0 4px', lineHeight: 1.2 }}>
              {p.prenom} {p.nom}
            </h1>

            {/* Indicateur activité (signal de confiance côté recruteur) */}
            {!isEditing && activity.label && (
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                {activity.isActif && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 9px', borderRadius: 20,
                    backgroundColor: 'rgba(39,174,96,0.18)',
                    border: '1px solid rgba(39,174,96,0.4)',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#27AE60', flexShrink: 0, boxShadow: '0 0 0 2px rgba(39,174,96,0.3)' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6ABFA0', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>Actif</span>
                  </span>
                )}
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>{activity.label}</span>
              </div>
            )}

            {/* Signature — affichée dans le bandeau vert, éditable inline */}
            {isEditing ? (
              <div style={{ marginTop: 12 }}>
                <textarea
                  ref={sigTextareaRef}
                  value={editSignature}
                  onChange={e => {
                    const next = e.target.value
                    if (next.length <= MAX_SIGNATURE || next.length < editSignature.length) {
                      setEditSignature(next)
                    }
                  }}
                  placeholder="Votre phrase signature — ce qui vous définit en une ligne…"
                  style={{
                    width: '100%', backgroundColor: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8,
                    color: C.white, fontSize: 13, padding: '8px 12px',
                    fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontStyle: 'italic', lineHeight: 1.6,
                    resize: 'none', outline: 'none', boxSizing: 'border-box' as const,
                    overflow: 'hidden', minHeight: 42,
                  }}
                />
                <SignatureCounter count={editSignature.length} max={MAX_SIGNATURE} theme="dark" />
              </div>
            ) : (
              p.signature && (
                <div style={{ marginTop: 6 }}>
                  <p style={{
                    margin: 0, textAlign: 'left',
                    fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontStyle: 'italic',
                    fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 1.55,
                    ...(signatureExpanded ? {} : {
                      display: '-webkit-box', WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
                    }),
                  }}>
                    « {p.signature} »
                  </p>
                  {p.signature.length > 120 && (
                    <button
                      onClick={() => setSignatureExpanded(v => !v)}
                      style={{
                        background: 'none', border: 'none', padding: 0, marginTop: 5,
                        color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer',
                        fontFamily: 'inherit', textDecoration: 'underline', display: 'block', textAlign: 'left',
                      }}
                    >
                      {signatureExpanded ? 'voir moins' : 'voir plus'}
                    </button>
                  )}
                </div>
              )
            )}
          </div>

              </div>
            </div>

            {/* Actions */}
            <div style={{ marginBottom: 12 }}>
          {/* CTA */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, flexShrink: 0 }}>
            {!isEditing && !isOwner && <ScoreCircle score={83} size={72} />}
            {!isEditing && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {isOwner ? (
                  <>
                  <button onClick={startEdit} style={{
                    padding: '8px 20px', borderRadius: 10, border: 'none',
                    backgroundColor: C.terracotta, color: C.white,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    Modifier mon profil
                  </button>
                  <button
                    className="btn-portrait"
                    onClick={() => {
                      const saved = typeof window !== 'undefined' ? localStorage.getItem(`kapolia_portrait_title_${userId}`) : null
                      setPortraitTitle(saved ?? profil?.domaine ?? '')
                      setPortraitWithPhoto(false)

                      const savedEmail = typeof window !== 'undefined' ? localStorage.getItem(`kapolia_portrait_email_${userId}`) : null
                      setPortraitShowEmail(savedEmail !== null ? savedEmail === 'true' : true)

                      const hasPhone = !!(profil?.telephone)
                      const savedPhone = typeof window !== 'undefined' ? localStorage.getItem(`kapolia_portrait_phone_${userId}`) : null
                      setPortraitShowPhone(hasPhone ? (savedPhone !== null ? savedPhone === 'true' : true) : false)

                      setPortraitModal(true)
                    }}
                    style={{
                      padding: '8px 20px', borderRadius: 10,
                      border: `1px solid ${C.sable}`,
                      backgroundColor: C.white,
                      color: C.dark,
                      fontSize: 13, fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    ↓ Mon portrait en PDF
                  </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={async () => {
                        setWritingMsg(true)
                        const existing = await trouverConversation(userId)
                        setWritingMsg(false)
                        if (existing) { router.push(`/recruteur/messages?conv=${existing}`); return }
                        router.push(`/recruteur/messages?new=${userId}`)
                      }}
                      disabled={writingMsg}
                      style={{
                        padding: '8px 18px', borderRadius: 10, border: 'none',
                        backgroundColor: C.terracotta, color: C.white,
                        fontSize: 13, fontWeight: 600, cursor: writingMsg ? 'default' : 'pointer',
                        fontFamily: 'inherit', opacity: writingMsg ? 0.7 : 1,
                      }}
                    >{writingMsg ? '…' : 'Écrire'}</button>
                    <button onClick={() => setSaved(s => !s)} style={{
                      padding: '8px 18px', borderRadius: 10,
                      border: `1.5px solid ${saved ? '#6ABFA0' : 'rgba(255,255,255,0.2)'}`,
                      backgroundColor: saved ? 'rgba(106,191,160,0.15)' : 'rgba(255,255,255,0.08)',
                      color: saved ? '#6ABFA0' : 'rgba(255,255,255,0.8)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                    }}>
                      {saved ? 'Sauvegardé' : 'Sauvegarder'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
            </div>

            {/* Carte Son cap */}
            <div style={{ backgroundColor: C.white, borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '16px 18px', marginBottom: 12 }}>
          {/* Cap header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0 8px' }}>
            <span style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 15, fontWeight: 600, color: C.dark }}>{isOwner ? 'Cap sur votre recherche' : 'Son cap'}</span>
            <div style={{ flex: 1, height: 1, backgroundColor: C.sable }} />
          </div>
          {/* 3 columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', paddingBottom: 14, gap: 12 }}>

            {/* Disponibilité */}
            <div style={{ display: 'flex', alignItems: isEditing && isOwner ? 'flex-start' : 'center', gap: 10, paddingTop: isEditing && isOwner ? 4 : 0 }}>
              {!(isEditing && isOwner) && <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: dispo.color, flexShrink: 0, boxShadow: `0 0 0 3px ${dispo.color}22` }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.terracotta, marginBottom: 5 }}>Disponibilité</div>
                {isEditing && isOwner ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {DISPO_OPTIONS.map(opt => {
                      const sel = editDispo === opt.key
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setEditDispo(opt.key)
                            if (opt.key === 'a_partir_de' && !editDispoDate) {
                              const d = new Date(); d.setMonth(d.getMonth() + 1)
                              setEditDispoDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
                            }
                          }}
                          style={{
                            padding: '4px 10px', borderRadius: 8,
                            border: `1.5px solid ${sel ? opt.color : C.sable}`,
                            backgroundColor: sel ? `${opt.color}14` : 'transparent',
                            color: sel ? opt.color : C.grey, fontSize: 11, fontWeight: sel ? 700 : 500,
                            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const,
                            transition: 'all 0.12s',
                          }}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                    {editDispo === 'a_partir_de' && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                        <select
                          value={editDispoDate.slice(5, 7)}
                          onChange={e => setEditDispoDate(prev => (prev || `${new Date().getFullYear()}-01-01`).slice(0, 5) + e.target.value.padStart(2, '0') + '-01')}
                          style={{ flex: 1, fontSize: 11, padding: '3px 6px', borderRadius: 6, border: `1px solid ${C.sable}`, backgroundColor: C.white, color: C.dark, fontFamily: 'inherit' }}
                        >
                          {MOIS_FR.map((m, i) => (
                            <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>
                          ))}
                        </select>
                        <select
                          value={editDispoDate.slice(0, 4)}
                          onChange={e => setEditDispoDate(prev => e.target.value + (prev || `-01-01`).slice(4))}
                          style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: `1px solid ${C.sable}`, backgroundColor: C.white, color: C.dark, fontFamily: 'inherit' }}
                        >
                          {[0, 1, 2].map(offset => {
                            const y = new Date().getFullYear() + offset
                            return <option key={y} value={y}>{y}</option>
                          })}
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, fontWeight: 600, color: dispo.color }}>{dispo.label}</div>
                )}
              </div>
            </div>

            {/* Type de poste — sélection multiple */}
            <div style={{ display: 'flex', alignItems: isEditing && isOwner ? 'flex-start' : 'center', gap: 10, paddingTop: isEditing && isOwner ? 4 : 0 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.terracotta, marginBottom: 5 }}>Type de poste</div>
                {isEditing && isOwner ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {Object.entries(TYPE_POSTE_MAP).map(([key, label]) => {
                      const sel = editTypePoste.includes(key)
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setEditTypePoste(prev =>
                            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
                          )}
                          style={{
                            padding: '4px 10px', borderRadius: 8, border: `1.5px solid ${sel ? C.vert : C.sable}`,
                            backgroundColor: sel ? `${C.vert}12` : 'transparent',
                            color: sel ? C.vert : C.grey, fontSize: 11, fontWeight: sel ? 700 : 500,
                            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const,
                            transition: 'all 0.12s',
                          }}
                        >
                          {sel ? '✓ ' : ''}{label}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.dark }}>{typePosteLabel}</div>
                )}
              </div>
            </div>

            {/* Lieu / Mobilité — éditable directement ici */}
            <div style={{ display: 'flex', alignItems: isEditing && isOwner ? 'flex-start' : 'center', gap: 10, paddingTop: isEditing && isOwner ? 4 : 0 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.terracotta, marginBottom: isEditing && isOwner ? 5 : 3 }}>Lieu / Mobilité</div>
                {isEditing && isOwner ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      value={editVille}
                      onChange={e => setEditVille(e.target.value)}
                      placeholder="Votre ville / région / zone géographique"
                      style={{
                        width: '100%', fontSize: 10, padding: '4px 8px', borderRadius: 6,
                        border: `1px solid ${C.sable}`, outline: 'none', fontFamily: 'inherit',
                        color: C.dark, backgroundColor: C.white, boxSizing: 'border-box' as const,
                      }}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4 }}>
                      {Object.entries(LIEU_MAP).map(([key, label]) => {
                        const sel = editModeTravail === key
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setEditModeTravail(sel ? '' : key)}
                            style={{
                              padding: '3px 8px', borderRadius: 20, border: `1.5px solid ${sel ? C.vert : C.sable}`,
                              backgroundColor: sel ? `${C.vert}12` : 'transparent',
                              color: sel ? C.vert : C.grey, fontSize: 10, fontWeight: sel ? 700 : 500,
                              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                            }}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                    {[p.ville, modeTravailLabel].filter(Boolean).join(' · ') || '—'}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Priorités — ligne sous les 3 colonnes, visible si renseignées ou en édition */}
          {((isEditing && isOwner) || (p.priorites && p.priorites.length > 0)) && (
            <div style={{ borderTop: `1px solid ${C.sable}`, paddingTop: 12, paddingBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.terracotta, marginBottom: 8 }}>Priorités</div>
              {isEditing && isOwner ? (
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                  {PRIORITES.map(prio => {
                    const sel       = editPriorite.includes(prio)
                    const maxReached = editPriorite.length >= 3
                    return (
                      <button
                        key={prio}
                        type="button"
                        onClick={() => setEditPriorite(prev =>
                          prev.includes(prio) ? prev.filter(x => x !== prio) : maxReached ? prev : [...prev, prio]
                        )}
                        style={{
                          padding: '4px 10px', borderRadius: 8,
                          border: `1.5px solid ${sel ? C.terracotta : C.sable}`,
                          backgroundColor: sel ? `${C.terracotta}14` : 'transparent',
                          color: sel ? C.terracotta : C.grey,
                          fontSize: 11, fontWeight: sel ? 700 : 500,
                          cursor: (maxReached && !sel) ? 'default' : 'pointer',
                          opacity: (maxReached && !sel) ? 0.4 : 1,
                          fontFamily: 'inherit', transition: 'all 0.12s',
                        }}
                      >
                        {sel ? '✓ ' : ''}{prio}
                      </button>
                    )
                  })}
                  {editPriorite.length >= 3 && (
                    <span style={{ fontSize: 11, color: C.terracotta, fontWeight: 500, alignSelf: 'center' }}>Maximum atteint.</span>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                  {(p.priorites ?? []).map(item => (
                    <span key={item} style={{
                      display: 'inline-block',
                      padding: '3px 10px', borderRadius: 20,
                      backgroundColor: `${C.terracotta}14`,
                      border: `1px solid ${C.terracotta}44`,
                      fontSize: 11, fontWeight: 600, color: C.terracotta,
                    }}>{item}</span>
                  ))}
                </div>
              )}
            </div>
          )}
            </div>


            {/* Carte Liens */}
            {(isEditing || (p.liens && p.liens.length > 0) || p.linkedin_url || p.portfolio_url) && (
              <div style={{ backgroundColor: C.white, borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '16px 18px', marginBottom: 12 }}>
                <SLabel>Liens</SLabel>
                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {editLiens.map((lien, i) => (
                      <div key={i} style={{ backgroundColor: C.bg, borderRadius: 8, padding: '10px 12px', position: 'relative' as const }}>
                        {editLiensErrs[i] && (
                          <p style={{ margin: '0 0 6px', fontSize: 11, color: C.terracotta, lineHeight: 1.4 }}>{editLiensErrs[i]}</p>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
                          <input
                            style={{ ...editInputStyle, fontSize: 12 }}
                            value={lien.intitule}
                            onChange={e => { const l = [...editLiens]; l[i] = { ...l[i], intitule: e.target.value }; setEditLiens(l) }}
                            placeholder="Intitulé (LinkedIn, GitHub…)"
                            maxLength={50}
                          />
                          <input
                            style={{ ...editInputStyle, fontSize: 12 }}
                            type="url"
                            value={lien.url}
                            onChange={e => { const l = [...editLiens]; l[i] = { ...l[i], url: e.target.value }; setEditLiens(l) }}
                            placeholder="https://…"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => { const errs = { ...editLiensErrs }; delete errs[i]; setEditLiensErrs(errs); setEditLiens(editLiens.filter((_, j) => j !== i)) }}
                          style={{ position: 'absolute' as const, top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: C.grey, padding: 2, lineHeight: 1 }}
                          title="Supprimer ce lien"
                        >✕</button>
                      </div>
                    ))}
                    {editLiens.length < 6 && (
                      <button
                        type="button"
                        onClick={() => setEditLiens([...editLiens, { intitule: '', url: '' }])}
                        style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px dashed ${C.sable}`, backgroundColor: 'transparent', color: C.grey, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' as const }}
                      >
                        + Ajouter un lien {editLiens.length > 0 ? `(${editLiens.length}/6)` : ''}
                      </button>
                    )}
                  </div>
                ) : (() => {
                  const liensAffiches = p.liens && p.liens.length > 0
                    ? p.liens
                    : [
                      ...(p.linkedin_url ? [{ intitule: 'LinkedIn', url: p.linkedin_url }] : []),
                      ...(p.portfolio_url ? [{ intitule: 'Portfolio', url: p.portfolio_url }] : []),
                    ]
                  if (liensAffiches.length === 0) return null
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
                      {liensAffiches.map((lien, i) => {
                        let hostname = ''
                        try { hostname = new URL(lien.url).hostname.replace(/^www\./, '') } catch {}
                        return (
                          <a
                            key={i}
                            href={lien.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 12px', borderRadius: 8, backgroundColor: C.bg, border: `1px solid ${C.sable}`, textDecoration: 'none' }}
                          >
                            <span style={{ fontSize: 13, fontWeight: 600, color: C.dark, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{lien.intitule}</span>
                            <span style={{ fontSize: 11, color: C.grey, whiteSpace: 'nowrap' as const, flexShrink: 0 }}>{hostname} →</span>
                          </a>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            )}

          </div>

          {/* ── COLONNE DROITE (défile) ───────────────────────────────────── */}
          <div className="profil-right">

      {/* ━━━ VIDÉO EN VEDETTE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {!isEditing && (videoPresentation || isOwner) && (
        <div style={{ backgroundColor: C.white, borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '18px', marginBottom: 16 }}>
            {videoPresentation ? (
              <div>
                {/* Player 16:9 — contrôles custom non affectés par scaleX(-1) */}
                <VideoPlayer
                  src={videoPresentation}
                  miroir={videoMiroir}
                  frameStyle={{
                    borderRadius: 16, aspectRatio: '16 / 9',
                    boxShadow: '0 8px 36px rgba(36, 69, 58,0.14)',
                    border: `1px solid ${C.sable}`,
                    marginBottom: 16,
                  }}
                />
                {/* Caption + boutons owner */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const }}>
                  <div>
                    <div style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 16, fontWeight: 600, color: C.dark, marginBottom: 4 }}>Présentation vidéo</div>
                    <div style={{ fontSize: 11, color: C.grey }}>30 secondes pour faire connaissance.</div>
                  </div>
                  {isOwner && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                      <button
                        onClick={toggleVideoMiroir}
                        disabled={togglingMiroir || uploadingVedette || deletingVideo}
                        title={videoMiroir ? 'Désactiver le miroir' : 'Activer le miroir horizontal'}
                        style={{
                          padding: '6px 13px', borderRadius: 10,
                          border: `1.5px solid ${videoMiroir ? C.vert : C.sable}`,
                          backgroundColor: videoMiroir ? `${C.vert}18` : C.white,
                          color: videoMiroir ? C.vert : C.grey,
                          fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                          opacity: togglingMiroir || uploadingVedette || deletingVideo ? 0.5 : 1,
                          transition: 'all 0.15s',
                        }}
                      >
                        Miroir
                      </button>
                      <button
                        onClick={() => { setRecordPhase('preview'); setRecordError(''); setRecordModal(true) }}
                        disabled={uploadingVedette || deletingVideo}
                        style={{
                          padding: '6px 13px', borderRadius: 10, border: `1.5px solid ${C.sable}`,
                          backgroundColor: C.white, color: C.dark, fontSize: 12, fontWeight: 500,
                          cursor: 'pointer', fontFamily: 'inherit',
                          opacity: uploadingVedette || deletingVideo ? 0.5 : 1,
                        }}
                      >
                        Remplacer
                      </button>
                      <button
                        onClick={deleteVideoPresentation}
                        disabled={uploadingVedette || deletingVideo}
                        style={{
                          padding: '6px 13px', borderRadius: 10, border: `1.5px solid #e88`,
                          backgroundColor: C.white, color: '#c44', fontSize: 12, fontWeight: 500,
                          cursor: 'pointer', fontFamily: 'inherit',
                          opacity: uploadingVedette || deletingVideo ? 0.5 : 1,
                        }}
                      >
                        {deletingVideo ? 'Suppression…' : 'Supprimer'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* isOwner && pas de vidéo — invitation */
              <div style={{
                backgroundColor: C.white, borderRadius: 14, padding: '16px 20px',
                border: `1.5px dashed ${C.sable}`,
              }}>
                <div style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 15, color: C.dark, marginBottom: 6 }}>
                  Ajoutez votre vidéo de présentation
                </div>
                <p style={{ margin: '0 0 10px', fontSize: 13, color: C.grey, lineHeight: 1.55 }}>
                  Les recruteurs regardent les vidéos en priorité. 30 à 60 secondes suffisent.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5, marginBottom: 14 }}>
                  {[
                    'Qui vous êtes et votre domaine d\'expertise',
                    'Ce que vous recherchez comme prochain rôle',
                    'Ce qui vous anime et vous différencie',
                  ].map((tip, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: `${C.terracotta}18`, color: C.terracotta, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                      <span style={{ fontSize: 13, color: C.dark, lineHeight: 1.45 }}>{tip}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                  <button
                    onClick={() => { setRecordPhase('preview'); setRecordError(''); setRecordModal(true) }}
                    disabled={uploadingVedette}
                    style={{
                      padding: '8px 16px', borderRadius: 10, border: 'none',
                      backgroundColor: C.terracotta, color: C.white,
                      fontSize: 13, fontWeight: 600, cursor: uploadingVedette ? 'default' : 'pointer',
                      fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
                      opacity: uploadingVedette ? 0.5 : 1,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>●</span> Enregistrer ma vidéo
                  </button>
                  <button
                    onClick={() => vedetteVideoInputRef.current?.click()}
                    disabled={uploadingVedette}
                    style={{
                      padding: '8px 16px', borderRadius: 10,
                      border: `1.5px solid ${C.sable}`, backgroundColor: C.white,
                      color: C.dark, fontSize: 13, fontWeight: 500,
                      cursor: uploadingVedette ? 'default' : 'pointer',
                      fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
                      opacity: uploadingVedette ? 0.5 : 1,
                    }}
                  >
                    {uploadingVedette
                      ? <><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.15)', borderTopColor: C.terracotta, animation: 'kapolia-spin 0.7s linear infinite' }} /> Envoi en cours…</>
                      : 'Importer un fichier'
                    }
                  </button>
                </div>
                {uploadingVedette && (
                  <div style={{ marginTop: 8, fontSize: 12, color: C.grey }}>
                    Les vidéos peuvent prendre quelques secondes selon votre connexion.
                  </div>
                )}
              </div>
            )}
        </div>
      )}


        {/* ── EXPÉRIENCES ────────────────────────────────────────────────────── */}
        {(isEditing || experiences.length > 0) && (
          <div style={{ backgroundColor: C.white, borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '18px', marginBottom: 16 }}>
            <SLabel>Expériences professionnelles</SLabel>
            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {editExperiences.map((exp, i) => (
                  <div key={i} style={{ backgroundColor: C.white, borderRadius: 14, padding: '16px 18px', border: `1px solid ${C.sable}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: C.grey }}>Expérience {i + 1}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <button type="button" aria-label="Monter" onClick={() => setEditExperiences(moveUp(editExperiences, i))} disabled={i === 0} style={{ width: 28, background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? C.lightGrey : C.grey, fontSize: 15, lineHeight: 1, padding: 0, textAlign: 'center' as const }}>↑</button>
                        <button type="button" aria-label="Descendre" onClick={() => setEditExperiences(moveDown(editExperiences, i))} disabled={i === editExperiences.length - 1} style={{ width: 28, background: 'none', border: 'none', cursor: i === editExperiences.length - 1 ? 'default' : 'pointer', color: i === editExperiences.length - 1 ? C.lightGrey : C.grey, fontSize: 15, lineHeight: 1, padding: 0, textAlign: 'center' as const }}>↓</button>
                        <button type="button" onClick={() => setEditExperiences(editExperiences.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.grey, padding: '0 4px', lineHeight: 1, fontFamily: 'inherit' }}>Supprimer</button>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <input style={editInputStyle} value={exp.poste} onChange={e => updateExp(i, { poste: e.target.value })} placeholder="Poste" />
                      <input style={editInputStyle} value={exp.entreprise} onChange={e => updateExp(i, { entreprise: e.target.value })} placeholder="Entreprise" />
                      <input style={editInputStyle} value={exp.date_debut} onChange={e => updateExp(i, { date_debut: e.target.value })} placeholder="Début (ex : jan. 2022)" />
                      <input style={editInputStyle} value={exp.date_fin} onChange={e => updateExp(i, { date_fin: e.target.value })} placeholder="Fin" disabled={exp.en_poste} />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.grey, marginBottom: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={exp.en_poste} onChange={e => updateExp(i, { en_poste: e.target.checked, date_fin: e.target.checked ? '' : exp.date_fin })} />
                      En poste actuellement
                    </label>
                    <MissionsTextArea
                      value={exp.missions}
                      onChange={v => updateExp(i, { missions: v })}
                      rows={3}
                      textareaStyle={{ ...editInputStyle, resize: 'vertical', lineHeight: 1.6, minHeight: 72 }}
                    />
                  </div>
                ))}
                <button type="button" onClick={() => setEditExperiences([...editExperiences, { poste: '', entreprise: '', date_debut: '', date_fin: '', en_poste: false, missions: '' }])} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, cursor: 'pointer', border: `1.5px dashed ${C.sable}`, backgroundColor: 'transparent', color: C.terracotta, fontSize: 13, fontWeight: 600 }}>
                  + Ajouter une expérience
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 7, top: 6, bottom: 6, width: 2, backgroundColor: C.sable }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {experiences.map((exp, i) => (
                    <div key={i} style={{ display: 'flex', gap: 20, paddingLeft: 28, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 0, top: 5, width: 16, height: 16, borderRadius: '50%', backgroundColor: C.terracotta, border: `2.5px solid ${C.bg}`, flexShrink: 0 }} />
                      <div style={{ flex: 1, backgroundColor: C.white, borderRadius: 14, padding: '16px 20px', border: `1px solid ${C.sable}` }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: C.dark, marginBottom: 2 }}>{exp.poste}</div>
                        <div style={{ fontSize: 12, color: C.grey, marginBottom: exp.missions ? 10 : 0 }}>
                          {exp.entreprise}
                          {(exp.date_debut || exp.date_fin || exp.en_poste) && <span style={{ color: C.lightGrey, margin: '0 6px' }}>·</span>}
                          {exp.date_debut && <span>{exp.date_debut}</span>}
                          {exp.date_debut && (exp.en_poste || exp.date_fin) && <span> — </span>}
                          {exp.en_poste ? <span style={{ color: C.terracotta }}>En poste</span> : <span>{exp.date_fin}</span>}
                        </div>
                        {exp.missions && (
                          <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                            {exp.missions.split('\n').filter(Boolean).slice(0, 4).map((m, j) => (
                              <li key={j} style={{ fontSize: 12, color: C.dark, lineHeight: 1.7 }}>{m.trim()}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}


        {/* ── DIPLÔMES ───────────────────────────────────────────────────────── */}
        {(isEditing || diplomes.length > 0) && (
          <div style={{ backgroundColor: C.white, borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '18px', marginBottom: 16 }}>
            <SLabel>Formations</SLabel>
            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {editDiplomes.map((d, i) => (
                  <div key={i} style={{ backgroundColor: C.white, borderRadius: 14, padding: '16px 18px', border: `1px solid ${C.sable}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: C.grey }}>Diplôme {i + 1}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <button type="button" aria-label="Monter" onClick={() => setEditDiplomes(moveUp(editDiplomes, i))} disabled={i === 0} style={{ width: 28, background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? C.lightGrey : C.grey, fontSize: 15, lineHeight: 1, padding: 0, textAlign: 'center' as const }}>↑</button>
                        <button type="button" aria-label="Descendre" onClick={() => setEditDiplomes(moveDown(editDiplomes, i))} disabled={i === editDiplomes.length - 1} style={{ width: 28, background: 'none', border: 'none', cursor: i === editDiplomes.length - 1 ? 'default' : 'pointer', color: i === editDiplomes.length - 1 ? C.lightGrey : C.grey, fontSize: 15, lineHeight: 1, padding: 0, textAlign: 'center' as const }}>↓</button>
                        <button type="button" onClick={() => setEditDiplomes(editDiplomes.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.grey, padding: '0 4px', lineHeight: 1, fontFamily: 'inherit' }}>Supprimer</button>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <input style={editInputStyle} value={d.intitule} onChange={e => updateDip(i, { intitule: e.target.value })} placeholder="Intitulé du diplôme" />
                      <input style={editInputStyle} value={d.ecole} onChange={e => updateDip(i, { ecole: e.target.value })} placeholder="École / Établissement" />
                      <input style={editInputStyle} value={d.annee} onChange={e => updateDip(i, { annee: e.target.value })} placeholder="Année (ex : 2021)" />
                      <input style={editInputStyle} value={d.mention ?? ''} onChange={e => updateDip(i, { mention: e.target.value })} placeholder="Mention (optionnel)" />
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setEditDiplomes([...editDiplomes, { intitule: '', ecole: '', annee: '', mention: '' }])} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, cursor: 'pointer', border: `1.5px dashed ${C.sable}`, backgroundColor: 'transparent', color: C.terracotta, fontSize: 13, fontWeight: 600 }}>
                  + Ajouter un diplôme
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {diplomes.map((d, i) => (
                  <div key={i} style={{ backgroundColor: C.white, borderRadius: 14, padding: '14px 18px', border: `1px solid ${C.sable}`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: C.dark }}>{d.intitule}</div>
                      <div style={{ fontSize: 12, color: C.grey, marginTop: 2 }}>
                        {d.ecole}{d.annee && <> · {d.annee}</>}{d.mention && <> · <span style={{ color: C.terracotta }}>{d.mention}</span></>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}


        {/* ── MON PROJET PHARE ───────────────────────────────────────────────── */}
        {(isEditing || p.projet_phare) && (
          <div style={{ backgroundColor: C.white, borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '18px', marginBottom: 16 }}>
            <SLabel>Mon projet phare</SLabel>
            {isEditing ? (
              <div style={{ backgroundColor: C.white, borderRadius: 18, padding: '24px 28px', border: `1px solid ${C.sable}` }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <input style={editInputStyle} value={editProjetTitre} onChange={e => { const v = e.target.value; if (v.length <= MAX_PROJET_TITRE || v.length < editProjetTitre.length) setEditProjetTitre(v) }} placeholder="Titre du projet" />
                    <SignatureCounter count={editProjetTitre.length} max={MAX_PROJET_TITRE} theme="dark" />
                  </div>
                  <div>
                    <textarea style={{ ...editInputStyle, resize: 'vertical', lineHeight: 1.6, minHeight: 96 }} value={editProjetDesc} onChange={e => { const v = e.target.value; if (v.length <= MAX_PROJET_DESC || v.length < editProjetDesc.length) setEditProjetDesc(v) }} placeholder="Description du projet…" rows={4} />
                    <SignatureCounter count={editProjetDesc.length} max={MAX_PROJET_DESC} theme="dark" />
                  </div>
                  <input style={editInputStyle} value={editProjetImpact} onChange={e => setEditProjetImpact(e.target.value)} placeholder="Résultat / Impact (ex : +67% d'engagement en 3 mois)" />
                  <input style={editInputStyle} value={editProjetLien} onChange={e => setEditProjetLien(e.target.value)} placeholder="Lien du projet (https://…)" type="url" />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: C.grey, marginBottom: 8 }}>Images (max 5 · 5 MB)</div>
                    <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); processImageFiles(Array.from(e.dataTransfer.files)) }} style={{ border: `2px dashed ${C.sable}`, borderRadius: 10, padding: '14px 16px', backgroundColor: C.bg, textAlign: 'center' as const, marginBottom: 8, fontSize: 12, color: C.grey }}>
                      {uploadingImages ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', border: `2px solid ${C.sable}`, borderTopColor: C.terracotta, animation: 'kapolia-spin 0.7s linear infinite' }} />Upload en cours…</span> : 'Glissez des images ici'}
                    </div>
                    <button type="button" disabled={uploadingImages || editProjetImages.length >= 5} onClick={() => imageInputRef.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${C.sable}`, backgroundColor: C.bg, color: C.dark, fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: (uploadingImages || editProjetImages.length >= 5) ? 0.5 : 1 }}>
                      Ajouter des images{editProjetImages.length > 0 && <span style={{ color: C.grey }}>({editProjetImages.length}/5)</span>}
                    </button>
                    {editProjetImages.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6, marginTop: 8 }}>
                        {editProjetImages.map((url, i) => (
                          <div key={i} style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', aspectRatio: '16/9', backgroundColor: C.sable }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            <button type="button" onClick={() => setEditProjetImages(editProjetImages.filter((_, j) => j !== i))} style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.6)', color: C.white, border: 'none', cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: C.grey, marginBottom: 8 }}>Vidéo (30 sec max · 50 MB)</div>
                    <button type="button" disabled={uploadingVideo} onClick={() => videoInputRef.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${C.sable}`, backgroundColor: C.bg, color: C.dark, fontSize: 12, fontWeight: 500, cursor: uploadingVideo ? 'default' : 'pointer', opacity: uploadingVideo ? 0.6 : 1 }}>
                      {uploadingVideo ? <><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', border: `2px solid rgba(0,0,0,0.12)`, borderTopColor: C.terracotta, animation: 'kapolia-spin 0.7s linear infinite' }} /> Upload en cours…</> : <>{editProjetVideo ? 'Changer la vidéo' : 'Ajouter une vidéo de présentation (30 sec max)'}</>}
                    </button>
                    {editProjetVideo && (
                      <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.sable}` }}>
                        <div style={{ backgroundColor: '#000' }}><video src={editProjetVideo} controls style={{ width: '100%', maxHeight: 200, display: 'block' }} /></div>
                        <button type="button" onClick={() => setEditProjetVideo('')} style={{ display: 'block', width: '100%', padding: '7px', backgroundColor: C.bg, border: 'none', borderTop: `1px solid ${C.sable}`, color: C.grey, fontSize: 12, cursor: 'pointer' }}>Supprimer la vidéo</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div onClick={() => setProjetModal(true)} onMouseEnter={() => setProjetCardHover(true)} onMouseLeave={() => setProjetCardHover(false)} style={{ backgroundColor: C.vert, borderRadius: 18, padding: '28px 32px', cursor: 'pointer', filter: projetCardHover ? 'brightness(1.14)' : 'brightness(1)', transition: 'filter 0.18s' }}>
                <div style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 17, color: C.white, fontWeight: 600, marginBottom: 14 }}>{p.projet_titre || 'Projet phare'}</div>
                <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{p.projet_phare}</p>
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.12)', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Voir les détails du projet →</div>
              </div>
            )}
          </div>
        )}



        {/* ── ENVIRONNEMENT RECHERCHÉ ────────────────────────────────────────── */}
        {(isEditing || typeEntrepriseItems.length > 0) && (
          <div style={{ backgroundColor: C.white, borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '18px', marginBottom: 16 }}>
            <SLabel>Environnement recherché</SLabel>
            {isEditing && isOwner ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(ENVIRONNEMENT_MAP).map(([key, label]) => {
                  const sel = editTypeEntreprise.includes(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (key === 'sans_pref') {
                          setEditTypeEntreprise(sel ? [] : ['sans_pref'])
                          return
                        }
                        if (sel) {
                          setEditTypeEntreprise(editTypeEntreprise.filter(k => k !== key))
                          return
                        }
                        const withoutSansPref = editTypeEntreprise.filter(k => k !== 'sans_pref')
                        if (withoutSansPref.length >= 3) return
                        setEditTypeEntreprise([...withoutSansPref, key])
                      }}
                      style={{
                        padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: sel ? 600 : 400,
                        backgroundColor: sel ? `${C.vert}12` : C.white,
                        border: `1.5px solid ${sel ? C.vert : C.sable}`,
                        color: sel ? C.vert : C.dark,
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                      }}
                    >
                      {sel ? '✓ ' : ''}{label}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {typeEntrepriseItems.map(item => (
                  <span key={item} style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
                    backgroundColor: C.white, border: `1px solid ${C.sable}`, color: C.dark,
                  }}>
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}


        {/* ── QUALITÉS ────────────────────────────────────────────────────────── */}
        {(isEditing || qualites.length > 0 || qualitesProchesSel.length > 0 || unreadNotifCount > 0 || (p.qualites_test && Object.keys(p.qualites_test).length > 0)) && (
          <div style={{ backgroundColor: C.white, borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '18px', marginBottom: 16 }}>
            <SLabel>Qualités</SLabel>
            {isEditing ? (
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Mes qualités</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {editQualites.map(q => (
                    <span key={q} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 20, backgroundColor: `${C.vert}12`, color: C.vert, border: `1px solid ${C.vert}25`, fontSize: 12, fontWeight: 500 }}>
                      {q}<button type="button" onClick={() => setEditQualites(editQualites.filter(x => x !== q))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grey, fontSize: 11, padding: 0, lineHeight: 1 }}>✕</button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input style={{ ...editInputStyle, flex: 1 }} value={newQualite} onChange={e => setNewQualite(e.target.value)} onKeyDown={e => { if (e.key !== 'Enter') return; e.preventDefault(); const v = newQualite.trim(); if (v && !editQualites.includes(v)) { setEditQualites([...editQualites, v]); setNewQualite('') } }} placeholder="Ajouter une qualité… (Entrée pour valider)" />
                  <button type="button" onClick={() => { const v = newQualite.trim(); if (v && !editQualites.includes(v)) { setEditQualites([...editQualites, v]); setNewQualite('') } }} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', backgroundColor: C.vert, color: C.white, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>+</button>
                </div>
              </div>
            ) : (
              <>
                {isOwner && unreadNotifCount > 0 && (
                  <p style={{
                    margin: '0 0 14px',
                    padding: '11px 16px',
                    borderRadius: 10,
                    backgroundColor: `${C.terracotta}0F`,
                    border: `1px solid ${C.terracotta}35`,
                    fontSize: 13,
                    color: C.terracotta,
                    lineHeight: 1.55,
                  }}>
                    {unreadNotifCount === 1
                      ? 'Un proche vous a répondu. Modifiez votre profil pour découvrir ses mots.'
                      : `Vous avez reçu ${unreadNotifCount} réponses de proches. Modifiez votre profil pour découvrir leurs mots.`}
                  </p>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {p.qualites_test && Object.entries(p.qualites_test)
                    .sort((a, b) => b[1] - a[1])
                    .map(([key, count]) => (
                      <span key={key} style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 12px', borderRadius: 20, backgroundColor: `${C.vert}18`, color: C.vert, border: `1px solid ${C.vert}30`, fontSize: 12, fontWeight: 600 }}>
                        {QUALITE_LABELS[key] ?? key}
                        <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.6, fontWeight: 400 }}>×{count}</span>
                      </span>
                    ))
                  }
                  {qualites.map(q => (
                    <span key={q} style={{ padding: '5px 12px', borderRadius: 20, backgroundColor: `${C.vert}12`, color: C.vert, border: `1px solid ${C.vert}25`, fontSize: 12, fontWeight: 500 }}>{q}</span>
                  ))}
                  {qualitesProchesSel.map(s => (
                    <span key={s.qualite} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, backgroundColor: `${C.vert}12`, color: C.vert, border: `1px solid ${C.vert}25`, fontSize: 12, fontWeight: 500 }}>
                      <LogoKapolia variante="sombre" avecTexte={false} taille={14} />
                      {s.qualite}
                    </span>
                  ))}
                </div>
                {qualitesProchesSel.length > 0 && (
                  <p style={{ margin: '8px 0 0', fontSize: 11, fontStyle: 'italic', color: C.grey }}>
                    Les qualités marquées viennent de proches.
                  </p>
                )}
              </>
            )}
            {isEditing && isOwner && (() => {
              const limiteAtteinte = activeInvitations.length >= 4
              const selMap   = new Map(editQualitesProches.map(s => [s.qualite, s.reponse_id]))
              const totalSel = editQualitesProches.length
              const unchanged =
                totalSel === qualitesProchesSel.length &&
                editQualitesProches.every(s =>
                  qualitesProchesSel.some(c => c.qualite === s.qualite && c.reponse_id === s.reponse_id)
                )
              return (
                <div>
                  {/* Filet de séparation */}
                  <div style={{ borderTop: `1px solid ${C.sable}`, margin: '20px 0 18px' }} />
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px' }}>Ce que mes proches disent de moi</p>

                  {/* Bouton d'invitation */}
                  <div style={{ marginBottom: 12 }}>
                    <button
                      onClick={() => setInvitModalOpen(true)}
                      disabled={limiteAtteinte}
                      style={{
                        padding: '7px 16px', borderRadius: 8,
                        border: `1.5px solid ${limiteAtteinte ? C.sable : C.terracotta}`,
                        backgroundColor: C.white,
                        color: limiteAtteinte ? C.grey : C.terracotta,
                        fontSize: 13, fontWeight: 500,
                        cursor: limiteAtteinte ? 'default' : 'pointer',
                        fontFamily: 'inherit', opacity: limiteAtteinte ? 0.7 : 1,
                        transition: 'all 0.15s',
                      }}
                    >
                      Inviter un proche
                    </button>
                    {limiteAtteinte && (
                      <p style={{ fontSize: 12, color: C.grey, margin: '6px 0 0', lineHeight: 1.5 }}>
                        Vous avez déjà quatre invitations en attente. Supprimez-en une ou attendez qu'une expire.
                      </p>
                    )}
                  </div>

                  {/* Invitations en attente */}
                  {activeInvitations.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                      {activeInvitations.map(inv => (
                        <div key={inv.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                          padding: '9px 12px', borderRadius: 8,
                          backgroundColor: C.bg, border: `1px solid ${C.sable}`,
                        }}>
                          <span style={{ fontSize: 13, color: C.dark, flex: 1, lineHeight: 1.4 }}>
                            {inv.label_proche} · {LIEN_LABELS[inv.lien] ?? inv.lien} · expire le {formatExpiry(inv.expire_at)}
                          </span>
                          <button
                            onClick={() => supprimerInvitation(inv.id)}
                            disabled={supprimantInvId === inv.id}
                            style={{
                              fontSize: 12, color: C.grey, background: 'none', border: 'none',
                              cursor: supprimantInvId === inv.id ? 'default' : 'pointer',
                              padding: '2px 0', flexShrink: 0, fontFamily: 'inherit',
                            }}
                          >
                            {supprimantInvId === inv.id ? '...' : 'Supprimer'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Réponses — toutes les pastilles ensemble */}
                  {reponsesProches.length > 0 && (() => {
                    const flat = reponsesProches.flatMap(r =>
                      r.qualites.map(q => ({ q, reponse_id: r.reponse_id, prenom: r.prenom_proche, lien: r.lien }))
                    )
                    return (
                      <>
                        <p style={{ fontSize: 12, color: C.grey, margin: '0 0 10px', lineHeight: 1.5 }}>
                          Choisissez jusqu'à 3 qualités à afficher sur votre profil.
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                          {flat.map(({ q, reponse_id, prenom }) => {
                            const isChecked        = selMap.get(q) === reponse_id
                            const isTakenElsewhere = selMap.has(q) && selMap.get(q) !== reponse_id
                            const isDisabled       = isTakenElsewhere || (totalSel >= 3 && !isChecked)
                            return (
                              <label
                                key={`${reponse_id}-${q}`}
                                title={`Donnée par ${prenom}`}
                                style={{
                                  display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                                  padding: '5px 12px 4px', borderRadius: 20,
                                  backgroundColor: isChecked ? C.vert : C.white,
                                  border: `1px solid ${isChecked ? C.vert : C.sable}`,
                                  color: isChecked ? C.white : C.dark,
                                  fontSize: 12, fontWeight: 500,
                                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                                  opacity: isDisabled && !isChecked ? 0.4 : 1,
                                  transition: 'all 0.15s',
                                  userSelect: 'none' as const,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={isDisabled}
                                  onChange={() => {
                                    if (isChecked) {
                                      setEditQualitesProches(prev =>
                                        prev.filter(s => !(s.qualite === q && s.reponse_id === reponse_id))
                                      )
                                    } else if (!isDisabled) {
                                      setEditQualitesProches(prev => [...prev, { reponse_id, qualite: q }])
                                    }
                                  }}
                                  style={{ display: 'none' }}
                                />
                                {q}
                                <span style={{ fontSize: 9, lineHeight: 1.3, marginTop: 1, opacity: isChecked ? 0.7 : 0.5 }}>{prenom}</span>
                              </label>
                            )
                          })}
                        </div>
                        <span style={{ fontSize: 11, color: C.grey }}>
                          {totalSel}/3 sélectionnée{totalSel !== 1 ? 's' : ''}
                        </span>
                      </>
                    )
                  })()}
                </div>
              )
            })()}
          </div>
        )}

        {/* ── COMPÉTENCES ────────────────────────────────────────────────────── */}
        {(isEditing || competencesAcquises.length > 0) && (
          <div style={{ backgroundColor: C.white, borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '18px', marginBottom: 16 }}>
            <SLabel>Compétences</SLabel>
            {isEditing ? (() => {
              const domain           = p.domaine ?? ''
              const domainSuggs      = COMP_REF[domain] ?? []
              const otherDomains     = DOMAINES.filter(d => d !== domain && !!COMP_REF[d])
              const browseSuggs      = otherBrowseDomain ? (COMP_REF[otherBrowseDomain] ?? []) : []
              const hasFreeTags      = editCompetences.some(c => !isFromRef(c))

              const suggPill = (s: string): React.CSSProperties => {
                const added = editCompetences.includes(s)
                const full  = !added && editCompetences.length >= 15
                return {
                  padding: '5px 12px', borderRadius: 20, fontSize: 12,
                  border: `1.5px solid ${added ? C.vert : C.sable}`,
                  backgroundColor: added ? `${C.vert}12` : C.white,
                  color: added ? C.vert : full ? C.lightGrey : C.grey,
                  cursor: full && !added ? 'default' : 'pointer',
                  fontFamily: 'inherit', transition: 'all 0.15s',
                }
              }

              return (
                <div>
                  {/* Tags sélectionnés */}
                  {editCompetences.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {editCompetences.map(c => {
                        const inRef = isFromRef(c)
                        return (
                          <span key={c} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                            backgroundColor: inRef ? `${C.vert}12` : C.chip,
                            color: inRef ? C.vert : C.grey,
                            border: `1.5px ${inRef ? 'solid' : 'dashed'} ${inRef ? `${C.vert}30` : C.lightGrey}`,
                          }}>
                            {c}
                            <button type="button" onClick={() => setEditCompetences(editCompetences.filter(x => x !== c))}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grey, fontSize: 11, padding: 0, lineHeight: 1 }}>✕</button>
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {/* Note explicative pour les compétences hors référentiel */}
                  {hasFreeTags && (
                    <p style={{ fontSize: 12, color: C.grey, marginBottom: 12, lineHeight: 1.5 }}>
                      Les compétences en pointillés ne sont pas prises en compte dans le calcul de correspondance. Choisissez l'équivalent dans la liste pour qu'elles comptent.
                    </p>
                  )}

                  {/* Suggestions du domaine courant */}
                  {domainSuggs.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 11, fontWeight: 500, color: C.grey, marginBottom: 8 }}>
                        Suggestions pour « {domain} »
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {domainSuggs.map(s => {
                          const full = !editCompetences.includes(s) && editCompetences.length >= 15
                          return (
                            <button key={s} type="button" onClick={() => !full && toggleEditCompetence(s)} style={suggPill(s)}>
                              {editCompetences.includes(s) ? `✓ ${s}` : `+ ${s}`}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Autres domaines */}
                  <button type="button"
                    onClick={() => { setShowOtherDomains(v => !v); if (showOtherDomains) setOtherBrowseDomain(null) }}
                    style={{ padding: '6px 13px', borderRadius: 20, fontSize: 12, border: `1.5px dashed ${C.sable}`, backgroundColor: 'transparent', color: C.grey, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10 }}>
                    {showOtherDomains ? '— Réduire' : "+ Compétences d'autres domaines"}
                  </button>

                  {showOtherDomains && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {otherDomains.map(d => (
                          <button key={d} type="button"
                            onClick={() => setOtherBrowseDomain(d === otherBrowseDomain ? null : d)}
                            style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, border: `1.5px solid ${d === otherBrowseDomain ? C.terracotta : C.sable}`, backgroundColor: d === otherBrowseDomain ? `${C.terracotta}10` : C.white, color: d === otherBrowseDomain ? C.terracotta : C.grey, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                            {d}
                          </button>
                        ))}
                      </div>
                      {otherBrowseDomain && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {browseSuggs.map(s => {
                            const full = !editCompetences.includes(s) && editCompetences.length >= 15
                            return (
                              <button key={s} type="button" onClick={() => !full && toggleEditCompetence(s)} style={suggPill(s)}>
                                {editCompetences.includes(s) ? `✓ ${s}` : `+ ${s}`}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Saisie libre */}
                  {editCompetences.length < 15 && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input style={{ ...editInputStyle, flex: 1 }} value={newCompetence}
                        onChange={e => setNewCompetence(e.target.value)}
                        onKeyDown={e => { if (e.key !== 'Enter') return; e.preventDefault(); const v = newCompetence.trim(); if (v && !editCompetences.includes(v)) { setEditCompetences([...editCompetences, v]); setNewCompetence('') } }}
                        placeholder="Autre compétence (saisie libre) — Entrée pour valider" />
                      <button type="button"
                        onClick={() => { const v = newCompetence.trim(); if (v && !editCompetences.includes(v)) { setEditCompetences([...editCompetences, v]); setNewCompetence('') } }}
                        style={{ padding: '9px 16px', borderRadius: 8, border: 'none', backgroundColor: C.vert, color: C.white, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>+</button>
                    </div>
                  )}
                  <p style={{ fontSize: 11, color: C.grey, marginTop: 6 }}>{editCompetences.length} / 15 compétences</p>
                </div>
              )
            })() : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {competencesAcquises.map(s => <span key={s} style={{ padding: '5px 12px', borderRadius: 20, backgroundColor: C.sable, color: C.vert, border: `1px solid ${C.sable}`, fontSize: 12, fontWeight: 500 }}>{s}</span>)}
              </div>
            )}
          </div>
        )}


        {/* ── LANGUES ────────────────────────────────────────────────────────── */}
        {(isEditing && isOwner ? true : langues.length > 0) && (
          <div style={{ backgroundColor: C.white, borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '18px', marginBottom: 16 }}>
            <SLabel>Langues</SLabel>
            {isEditing && isOwner ? (
              <div>
                {/* Menu déroulant d'ajout */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <select
                    value={selectingLangue}
                    onChange={e => setSelectingLangue(e.target.value)}
                    style={{ flex: 1, padding: '9px 12px', borderRadius: 8, fontFamily: 'inherit', border: `1px solid ${C.sable}`, backgroundColor: C.white, color: selectingLangue ? C.dark : C.grey, fontSize: 13, cursor: 'pointer', outline: 'none' }}
                  >
                    <option value="">Ajouter une langue…</option>
                    {LANGUES.filter(l => !editLangues.some(e => e.startsWith(l.nom + ' — '))).map(l => (
                      <option key={l.code} value={l.nom}>{l.nom}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectingLangue}
                    onClick={() => {
                      if (!selectingLangue) return
                      setEditLangues([...editLangues, `${selectingLangue} — Natif`])
                      setSelectingLangue('')
                    }}
                    style={{ padding: '9px 16px', borderRadius: 8, border: 'none', backgroundColor: selectingLangue ? C.vert : C.sable, color: C.white, fontSize: 18, cursor: selectingLangue ? 'pointer' : 'default', lineHeight: 1, transition: 'background 0.12s' }}
                  >+</button>
                </div>
                {/* Langues ajoutées avec sélecteur de niveau */}
                {editLangues.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {editLangues.map(entry => {
                      const sepIdx = entry.indexOf(' — ')
                      const nom    = sepIdx >= 0 ? entry.slice(0, sepIdx) : entry
                      const niveau = sepIdx >= 0 ? entry.slice(sepIdx + 3) : 'Natif'
                      return (
                        <div key={nom} style={{ display: 'flex', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 10, border: `1px solid ${C.sable}`, padding: '10px 14px' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: C.dark, flex: 1 }}>{nom}</span>
                          <select
                            value={NIVEAUX_LANGUE.includes(niveau) ? niveau : 'Natif'}
                            onChange={e => setEditLangues(editLangues.map(l =>
                              l.startsWith(nom + ' — ') ? `${nom} — ${e.target.value}` : l
                            ))}
                            style={{ padding: '5px 10px', borderRadius: 8, fontFamily: 'inherit', border: `1px solid ${C.sable}`, backgroundColor: C.bg, color: C.dark, fontSize: 13, cursor: 'pointer', outline: 'none' }}
                          >
                            {NIVEAUX_LANGUE.map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => setEditLangues(editLangues.filter(l => !l.startsWith(nom + ' — ')))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grey, fontSize: 16, padding: '0 4px', lineHeight: 1 }}
                          >✕</button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {langues.map((entry: string) => {
                  const sepIdx = entry.indexOf(' — ')
                  const nom    = sepIdx >= 0 ? entry.slice(0, sepIdx) : entry
                  const niv    = sepIdx >= 0 ? entry.slice(sepIdx + 3) : ''
                  return (
                    <span key={entry} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 24, backgroundColor: C.white, border: `1px solid ${C.sable}`, fontSize: 13, color: C.dark, fontWeight: 500 }}>
                      {nom}{niv && <span style={{ color: C.grey, fontWeight: 400 }}> · {niv}</span>}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        )}


        {/* ── CE QUI M'ANIME ────────────────────────────────────────────────── */}
        {(isEditing && isOwner ? true : passions.length > 0) && (
          <div style={{ backgroundColor: C.white, borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '18px', marginBottom: 16 }}>
            <SLabel>{isOwner ? "Ce qui m'anime" : "Ce qui l'anime"}</SLabel>
            {isEditing && isOwner ? (
              <div>
                {/* Options prédéfinies */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {Object.entries(PASSION_EMOJIS).map(([nom]) => {
                    const sel = editPassions.includes(nom)
                    return (
                      <button
                        key={nom}
                        type="button"
                        onClick={() => setEditPassions(sel ? editPassions.filter(x => x !== nom) : [...editPassions, nom])}
                        style={{
                          padding: '6px 14px', borderRadius: 24, fontSize: 13, fontFamily: 'inherit',
                          border: `1.5px solid ${sel ? C.vert : C.sable}`,
                          backgroundColor: sel ? `${C.vert}12` : C.white,
                          color: sel ? C.vert : C.dark,
                          fontWeight: sel ? 600 : 400, cursor: 'pointer', transition: 'all 0.12s',
                        }}
                      >
                        {nom}
                      </button>
                    )
                  })}
                </div>
                {/* Tags personnalisés (valeurs hors PASSION_EMOJIS) */}
                {editPassions.filter(nom => !PASSION_EMOJIS[nom]).map(passion => (
                  <span key={passion} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 20, backgroundColor: `${C.vert}12`, color: C.vert, border: `1px solid ${C.vert}25`, fontSize: 12, fontWeight: 500, marginRight: 6, marginBottom: 8 }}>
                    {passion}<button type="button" onClick={() => setEditPassions(editPassions.filter(x => x !== passion))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grey, fontSize: 11, padding: 0, lineHeight: 1 }}>✕</button>
                  </span>
                ))}
                {/* Champ libre pour passion personnalisée */}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <input
                    style={{ ...editInputStyle, flex: 1 }}
                    value={newPassion}
                    onChange={e => setNewPassion(e.target.value)}
                    onKeyDown={e => {
                      if (e.key !== 'Enter') return
                      e.preventDefault()
                      const v = newPassion.trim()
                      if (v && !editPassions.includes(v)) { setEditPassions([...editPassions, v]); setNewPassion('') }
                    }}
                    placeholder="Autre passion… (Entrée pour valider)"
                  />
                  <button
                    type="button"
                    onClick={() => { const v = newPassion.trim(); if (v && !editPassions.includes(v)) { setEditPassions([...editPassions, v]); setNewPassion('') } }}
                    style={{ padding: '9px 16px', borderRadius: 8, border: 'none', backgroundColor: C.vert, color: C.white, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
                  >+</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {passions.map(passion => (
                  <span key={passion} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 24, backgroundColor: C.white, border: `1px solid ${C.sable}`, fontSize: 13, color: C.dark, fontWeight: 500 }}>
                    {passion}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}


          </div>

        </div>
      </div>

      {/* ━━━ BARRE FLOTTANTE ÉDITION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {isEditing && (
        <div style={{ position: 'fixed', bottom: 0, left: 'var(--kapolia-sidebar-w)', right: 0, zIndex: 200, backgroundColor: C.dark, borderTop: '1px solid rgba(255,255,255,0.08)', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Mode édition — modifications non sauvegardées</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={cancelEdit} style={{ padding: '8px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Annuler</button>
            <button onClick={saveEdit} disabled={saving} style={{ padding: '8px 22px', borderRadius: 10, border: 'none', backgroundColor: C.terracotta, color: C.white, fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.65 : 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              {saving && <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', animation: 'kapolia-spin 0.7s linear infinite' }} />}
              {saving ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      )}

      {/* ━━━ MODALE PROJET PHARE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {projetModal && !isEditing && (
        <div onClick={() => setProjetModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.72)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: C.white, borderRadius: 20, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', padding: 'clamp(24px, 4%, 40px)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
              <h2 style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 22, color: C.dark, margin: 0, fontWeight: 600, lineHeight: 1.3 }}>{p.projet_titre || 'Projet phare'}</h2>
              <button onClick={() => setProjetModal(false)} style={{ flexShrink: 0, width: 36, height: 36, borderRadius: '50%', border: `1px solid ${C.sable}`, backgroundColor: C.bg, color: C.grey, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>✕</button>
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

      {/* ━━━ MODALE AVATAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {avatarModal && (
        <div onClick={() => setAvatarModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: C.white, borderRadius: 24, width: '100%', maxWidth: 480, padding: 'clamp(24px, 4%, 36px)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 20, color: C.dark, margin: 0, fontWeight: 600 }}>Personnaliser mon avatar</h2>
              <button onClick={() => setAvatarModal(false)} style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid ${C.sable}`, backgroundColor: C.bg, color: C.grey, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>✕</button>
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
                    onClick={() => { closeRecordModal(); setTimeout(() => mobileRecordInputRef.current?.click(), 50) }}
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
                      {String(Math.floor(recordDuration / 60)).padStart(2, '0')}:{String(recordDuration % 60).padStart(2, '0')} / 01:00
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

      {isOwner && (
        <InvitationModal
          open={invitModalOpen}
          onClose={() => setInvitModalOpen(false)}
          candidatId={userId}
          activeCount={activeInvitations.length}
          onCreated={inv => setActiveInvitations(prev => [...prev, inv])}
        />
      )}

      {isOwner && <AssistantProfilPanel isEditing={isEditing} />}
    </main>
  )
}
