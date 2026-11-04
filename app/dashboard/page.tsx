'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { scoreBreakdownCandidat, profilSuffisantPourScoreCandidat, type ScoreBreakdown } from '@/lib/matching'
import { fetchProfilsEntreprise } from '@/lib/enrichir-entreprise'
import Avatar from '@/components/Avatar'
import { FONT_SERIF } from '@/lib/typography'
import { OffreCard, type OffreCardData } from '@/components/OffreCard'
import { useFavoris } from '@/lib/favoris-context'
import { C as _C, CARD_SHADOW, CARD_RADIUS } from '@/lib/colors'
import { countRdvEnAttente } from '@/lib/rdv-en-attente'
import { largeurUtile } from '@/lib/largeur-utile'

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = { ..._C, lightGrey: '#E4E7E5' as const }

// ─── Types ────────────────────────────────────────────────────────────────────

type Profil = {
  id?: string
  user_id?: string
  prenom?: string
  nom?: string
  domaine?: string
  experience?: string
  valeur?: string
  ville?: string
  signature?: string
  qualites?: string[]
  passions?: string[]
  type_poste?: string[]
  mode_travail?: string
  type_entreprise?: string[]
  projet_phare?: string
  projet_titre?: string
  projet_impact?: string
  plus_grande_reussite?: string
  ce_que_je_veux_apprendre?: string
  photo_url?: string
  side_project?: string
  disponibilite?: string
  avatar_url?: string
  avatar_type?: string
  competences_acquises?: string[]
  experiences?: string[]
  diplomes?: string[]
  langues?: string[]
  linkedin_url?: string
  portfolio_url?: string
  video_presentation_url?: string | null
}

type Offre = {
  id: string
  titre: string
  recruteur_id?: string
  entreprise_nom?: string
  ville?: string
  type_contrat?: string
  domaine?: string
  experience?: string
  valeurs?: string[]
  mode_travail?: string
  langues?: string[] | null
  teletravail?: boolean
  active?: boolean
  statut_publication?: string
  created_at?: string
  salaire_min?: number
  salaire_max?: number
  periode_salaire?: string
  latitude?: number
  longitude?: number
  score?: number
  breakdown?: ScoreBreakdown | null
}

type OffresMode = 'match' | 'recent'

type Candidature = {
  id: string
  statut: string
  created_at: string
  offres?: {
    titre?: string
    recruteur_id?: string
    entreprise_nom?: string
    ville?: string
    type_contrat?: string
  }
}

type Conversation = {
  id: string
  created_at: string
  dernier_message?: string
  offres?: { titre?: string }
  profils?: { prenom?: string; nom?: string }
}

type ConvRaw = {
  id: string; recruteur_id: string; offre_id?: string
  dernier_message?: string; derniere_activite?: string
  non_lu_candidat: number; offres?: { titre?: string } | null
}

type ActivityKind = 'vue' | 'message' | 'candidature'
type ActivityItem = {
  date: string
  kind: ActivityKind
  text: string
  href: string
}

function ActivityIcon({ kind }: { kind: ActivityKind }) {
  const p = {
    width: 15, height: 15, viewBox: '0 0 24 24',
    fill: 'none' as const, stroke: C.vert,
    strokeWidth: '1.8', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 30, height: 30, borderRadius: '50%',
      backgroundColor: C.chip, flexShrink: 0,
    }}>
      {kind === 'vue' && (
        <svg {...p}>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
      {kind === 'message' && (
        <svg {...p}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      )}
      {kind === 'candidature' && (
        <svg {...p}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      )}
    </span>
  )
}

type VueProfil = {
  created_at: string
  visiteur_id?: string
  visiteur_type?: string
}

type VueRecente = { created_at: string }
type FavOffre = { id: string; titre: string; recruteur_id?: string; entreprise_nom?: string; ville?: string }

type MessageActivite = {
  created_at: string
  contenu?: string
  conversation_id?: string
}

type ActionItem = { label: string; href: string }

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'maintenant',      label: 'En recherche active',      dot: C.succes },
  { value: 'a_partir_de',    label: 'Ouvert aux opportunités',  dot: C.attente },
  { value: 'non_disponible', label: 'Pas disponible',           dot: C.erreur },
]

function StatusDot({ color }: { color: string }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8,
      borderRadius: '50%', backgroundColor: color, flexShrink: 0,
    }} />
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// suggestion: texte encourageant affiché dans le dashboard ; omis pour les champs
// toujours remplis après onboarding (prenom, nom, domaine, experience).
type CompletionField = { key: keyof Profil; label: string; suggestion?: string }
type CompletionSection = { label: string; weight: number; fields: CompletionField[] }

const COMPLETION_SECTIONS: CompletionSection[] = [
  {
    label: 'Identité', weight: 0.20,
    fields: [
      { key: 'prenom',     label: 'Prénom' },
      { key: 'nom',        label: 'Nom' },
      { key: 'domaine',    label: 'Domaine' },
      { key: 'experience', label: "Niveau d'expérience" },
      { key: 'ville',      label: 'Ville',           suggestion: 'Indiquez votre ville' },
      { key: 'avatar_url', label: 'Photo de profil', suggestion: 'Ajoutez une photo de profil' },
    ],
  },
  {
    label: 'Ma recherche', weight: 0.20,
    fields: [
      { key: 'type_poste',    label: 'Type de poste',         suggestion: 'Précisez le type de poste recherché' },
      { key: 'type_entreprise', label: 'Type d\'entreprise',   suggestion: 'Précisez le type d\'entreprise qui vous correspond' },
      { key: 'mode_travail',   label: 'Mode de travail',      suggestion: 'Précisez votre mode de travail préféré' },
      { key: 'disponibilite', label: 'Disponibilité',         suggestion: 'Confirmez votre disponibilité' },
      { key: 'langues',       label: 'Langues',               suggestion: 'Renseignez vos langues' },
    ],
  },
  {
    label: 'Mon histoire', weight: 0.25,
    fields: [
      { key: 'signature',    label: 'Phrase signature',      suggestion: 'Rédigez votre phrase signature' },
      { key: 'valeur',       label: "Ce qui m'anime",        suggestion: 'Précisez ce qui vous anime' },
      { key: 'projet_titre', label: 'Titre du projet',       suggestion: 'Donnez un titre à votre projet phare' },
      { key: 'projet_phare', label: 'Description du projet', suggestion: 'Décrivez votre projet phare en détail' },
      { key: 'projet_impact', label: 'Impact du projet',     suggestion: "Précisez l'impact de votre projet" },
    ],
  },
  {
    label: 'Mon parcours', weight: 0.20,
    fields: [
      { key: 'experiences',          label: 'Expériences',         suggestion: 'Ajoutez vos expériences professionnelles' },
      { key: 'qualites',             label: 'Compétences',         suggestion: 'Listez vos compétences clés' },
      { key: 'competences_acquises', label: 'Compétences acquises', suggestion: 'Listez vos compétences acquises' },
      { key: 'passions',             label: 'Passions',            suggestion: 'Ajoutez vos passions et loisirs' },
      { key: 'diplomes',             label: 'Diplômes',            suggestion: 'Renseignez vos diplômes ou formations' },
    ],
  },
  {
    label: 'Ma présentation', weight: 0.15,
    fields: [
      { key: 'video_presentation_url', label: 'Vidéo de présentation', suggestion: 'Ajoutez une vidéo de présentation' },
    ],
  },
]

// Ordre de priorité d'affichage des suggestions (indépendant de l'ordre des sections)
const SUGGESTION_PRIORITY: (keyof Profil)[] = [
  'video_presentation_url',
  'signature', 'valeur', 'projet_titre', 'projet_phare', 'projet_impact',
  'type_poste', 'disponibilite', 'langues', 'type_entreprise', 'mode_travail',
  'experiences', 'qualites', 'competences_acquises', 'passions', 'diplomes',
  'ville', 'avatar_url',
]
const SUGGESTION_RANK = Object.fromEntries(SUGGESTION_PRIORITY.map((k, i) => [k, i]))

function isFilled(p: Profil, key: keyof Profil): boolean {
  const v = p[key]
  if (v == null) return false
  if (Array.isArray(v)) return v.length > 0
  return String(v).trim().length > 0
}

function calcCompletion(p: Profil): number {
  let score = 0
  for (const section of COMPLETION_SECTIONS) {
    const filled = section.fields.filter(({ key }) => isFilled(p, key)).length
    score += section.weight * (filled / section.fields.length)
  }
  return Math.round(score * 100)
}


function daysSince(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return "aujourd'hui"
  if (diff === 1) return 'il y a 1 jour'
  return `il y a ${diff} jours`
}

function timeAgo(iso: string): string {
  const ms    = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(ms / 60000)
  const hours = Math.floor(ms / 3600000)
  const days  = Math.floor(ms / 86400000)
  if (mins  <  1) return "à l'instant"
  if (hours <  1) return `il y a ${mins} min`
  if (days  <  1) return hours === 1 ? 'il y a 1h' : `il y a ${hours}h`
  if (days  === 1) return 'hier'
  return `il y a ${days} jours`
}

function truncate(s: string | undefined, n: number): string {
  if (!s) return ''
  if (s.length <= n) return s
  const cut = s.slice(0, n).trimEnd()
  return (/[.,;:!?…]$/.test(cut) ? cut.slice(0, -1) : cut) + '…'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', backgroundColor: C.bg,
    }}>
      <style suppressHydrationWarning>{`@keyframes kapolia-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        border: `3px solid ${C.sable}`, borderTopColor: C.terracotta,
        animation: 'kapolia-spin 0.8s linear infinite',
      }} />
    </div>
  )
}


function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      backgroundColor: C.white,
      borderRadius: CARD_RADIUS,
      padding: 28,
      boxShadow: CARD_SHADOW,
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ title, link, href, onClick }: { title: string; link?: string; href?: string; onClick?: () => void }) {
  const router = useRouter()
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
      <h2 style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 20, color: C.dark, margin: 0 }}>
        {title}
      </h2>
      {link && (
        <button
          onClick={onClick ?? (() => href && router.push(href))}
          style={{
            background: 'none', border: 'none', fontSize: 13,
            color: C.terracotta, cursor: 'pointer', fontWeight: 500, padding: 0,
            fontFamily: 'inherit',
          }}
        >
          {link}
        </button>
      )}
    </div>
  )
}

const STATUT_COLORS: Record<string, { bg: string; color: string }> = {
  'envoyée':    { bg: '#EEF2FF', color: '#4F46E5' },
  'vue':        { bg: `${C.sable}80`, color: C.grey },
  'en cours':   { bg: `${C.terracotta}18`, color: C.terracotta },
  'acceptée':   { bg: `${C.vert}18`, color: C.vert },
  'refusée':    { bg: '#FDECEA', color: C.erreur },
}

function StatusBadge({ statut }: { statut: string }) {
  const key = statut?.toLowerCase() ?? ''
  const style = STATUT_COLORS[key] ?? { bg: C.chip, color: C.grey }
  const labels: Record<string, string> = {
    'envoyée': 'Envoyée', 'vue': 'Vue', 'en cours': 'En cours',
    'acceptée': 'Acceptée', 'refusée': 'Refusée',
  }
  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      backgroundColor: style.bg, color: style.color,
      padding: '3px 10px', borderRadius: 20,
    }}>
      {labels[key] ?? statut}
    </span>
  )
}



function StatusToggle({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const current = STATUS_OPTIONS.find(o => o.value === value) ?? STATUS_OPTIONS[0]

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          backgroundColor: 'rgba(36, 69, 58,0.07)',
          border: `1px solid ${C.sable}`,
          borderRadius: 10, padding: '7px 14px',
          color: C.dark, fontSize: 13, fontWeight: 500,
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <StatusDot color={current.dot} />
        <span>{current.label}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke={C.dark} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          backgroundColor: C.white, border: `1px solid ${C.sable}`,
          borderRadius: 12, padding: 6, minWidth: 220,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50,
        }}>
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', textAlign: 'left',
                padding: '9px 12px', border: 'none', borderRadius: 8,
                backgroundColor: opt.value === value ? C.chip : 'transparent',
                color: C.dark, fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'background-color 0.1s',
              }}
            >
              <StatusDot color={opt.dot} />
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()

  const [profil, setProfil]             = useState<Profil | null>(null)
  const [offres, setOffres]             = useState<Offre[]>([])
  const [offresMode, setOffresMode]     = useState<OffresMode>('match')
  const [matchCount, setMatchCount]     = useState(0)
  const [candidatures, setCandidatures] = useState<Candidature[]>([])
  const [unreadCount, setUnreadCount]   = useState(0)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading]           = useState(true)
  const [statusLoading, setStatusLoading] = useState(false)
  const [activites, setActivites]       = useState<ActivityItem[]>([])
  const [vueCount, setVueCount]         = useState(0)
  const [vueTotal, setVueTotal]         = useState(0)
  const [vuesRecentes, setVuesRecentes] = useState<VueRecente[]>([])
  const [favOffres, setFavOffres]       = useState<FavOffre[]>([])
  const [searchQuery, setSearchQuery]   = useState('')
  const [totalOffresCount, setTotalOffresCount] = useState(0)
  const [actionItems, setActionItems]   = useState<ActionItem[]>([])
  const [winSize, setWinSize] = useState({ w: 1200, h: 900, rawW: 1200 })
  const [applied, setApplied]           = useState<Set<string>>(new Set())
  const [mounted, setMounted]           = useState(false)
  const userIdRef = useRef<string | null>(null)

  const { favIds, toggleFav } = useFavoris()

  useEffect(() => {
    function onResize() { setWinSize({ w: largeurUtile(), h: window.innerHeight, rawW: window.innerWidth }) }
    setWinSize({ w: largeurUtile(), h: window.innerHeight, rawW: window.innerWidth })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/inscription'); return }
      userIdRef.current = user.id

      const [
        { data: profilData },
        { data: candidaturesData },
        { data: offresData },
        { data: convsRaw },
        { data: vuesData },
        { data: favData },
        { count: offresCount },
        { data: rdvData },
      ] = await Promise.all([
        supabase.from('profils').select('*').eq('user_id', user.id).single(),
        supabase.from('candidatures')
          .select('*, offres(titre, ville, type_contrat, recruteur_id)')
          .eq('candidat_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase.from('offres').select('*')
          .eq('active', true)
          .eq('statut_publication', 'publiée')
          .gt('expire_at', new Date().toISOString())
          .limit(6),
        supabase.from('conversations')
          .select('id, recruteur_id, offre_id, dernier_message, derniere_activite, non_lu_candidat, offres(titre)')
          .eq('candidat_id', user.id)
          .eq('masquee_candidat', false)
          .order('derniere_activite', { ascending: false }),
        supabase.from('vues_profil')
          .select('created_at, visiteur_id, visiteur_type')
          .eq('profil_id', user.id)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase.from('offres_favorites')
          .select('created_at, offres(id, titre, ville, recruteur_id, expire_at)')
          .eq('candidat_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('offres')
          .select('id', { count: 'exact', head: true })
          .eq('active', true)
          .eq('statut_publication', 'publiée')
          .gt('expire_at', new Date().toISOString()),
        supabase.from('rendez_vous')
          .select('id, creneaux_rdv(id, debut_utc)')
          .eq('candidat_id', user.id)
          .eq('statut', 'proposee'),
      ])

      if (!(profilData as { onboarding_completed?: boolean } | null)?.onboarding_completed) {
        router.replace('/onboarding')
        return
      }

      const p: Profil = (profilData as Profil) ?? {}
      setProfil(p)

      // ── Aller 1 → IDs pour l'aller 2 ─────────────────────────────────────────
      const allOffreRids = [
        ...((offresData as Offre[] | null) ?? []).map(o => o.recruteur_id),
        ...((candidaturesData as Candidature[] | null) ?? []).map(c => c.offres?.recruteur_id),
        ...((favData as unknown as { offres: { recruteur_id?: string | null } | null }[] | null) ?? [])
          .map(f => f?.offres?.recruteur_id),
      ].filter((id): id is string => Boolean(id))

      const convList     = (convsRaw ?? []) as ConvRaw[]
      const recruteurIds = [...new Set(convList.map(c => c.recruteur_id).filter(Boolean))]
      const convIds      = convList.map(c => c.id)

      // ── Aller 2 : profils entreprise + profils recruteurs convs + messages non lus — en parallèle
      const [epResult, rResult, mResult] = await Promise.all([
        fetchProfilsEntreprise([...new Set(allOffreRids)]),
        recruteurIds.length
          ? supabase.from('profils').select('user_id, prenom, nom').in('user_id', recruteurIds)
          : Promise.resolve({ data: null as null, error: null }),
        convIds.length
          ? supabase.from('messages')
              .select('created_at, contenu, conversation_id')
              .in('conversation_id', convIds)
              .neq('expediteur_id', user.id)
              .eq('lu', false)
              .order('created_at', { ascending: false })
              .limit(3)
          : Promise.resolve({ data: null as null, error: null }),
      ])
      const { map: epMap, error: epErr } = epResult
      if (epErr) console.error('[dashboard profils entreprise]', epErr)

      const profilMap: Record<string, { prenom?: string; nom?: string }> = {}
      for (const r of (rResult.data ?? [])) profilMap[r.user_id] = r

      const activeMsgs = (mResult.data ?? []) as MessageActivite[]

      const enrichedCands = ((candidaturesData as Candidature[]) ?? []).map(c => {
        const rid = c.offres?.recruteur_id
        const ep  = rid ? epMap[rid] : undefined
        if (!ep || !c.offres) return c
        return { ...c, offres: { ...c.offres, entreprise_nom: ep.entreprise_nom ?? undefined } }
      })
      setCandidatures(enrichedCands)

      if (offresData) {
        const MATCH_THRESHOLD = 50
        const scored = (offresData as Offre[]).map(o => {
          const ep = o.recruteur_id ? epMap[o.recruteur_id] : undefined
          const om = { ...o }
          const bd = scoreBreakdownCandidat(p, om)
          return { ...o, entreprise_nom: ep?.entreprise_nom ?? undefined, score: bd.total ?? undefined, breakdown: bd }
        })
        const matching = scored
          .filter(o => (o.score ?? 0) >= MATCH_THRESHOLD)
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        setMatchCount(matching.length)
        if (matching.length >= 1) {
          setOffres(matching.slice(0, 3))
          setOffresMode('match')
        } else {
          const recent = [...scored].sort((a, b) =>
            new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
          )
          setOffres(recent.slice(0, 3))
          setOffresMode('recent')
        }
      }

      setUnreadCount(convList.reduce((sum, c) => sum + (c.non_lu_candidat ?? 0), 0))
      setConversations(convList.slice(0, 3).map(c => ({
        id:             c.id,
        created_at:     c.derniere_activite ?? '',
        dernier_message: c.dernier_message,
        offres:         c.offres ?? undefined,
        profils:        profilMap[c.recruteur_id],
      })))

      // Build activity feed
      const items: ActivityItem[] = []

      for (const v of (vuesData ?? []) as VueProfil[]) {
        items.push({
          date: v.created_at,
          kind: 'vue' as ActivityKind,
          text: `Votre profil a été consulté par un recruteur`,
          href: '/profil',
        })
      }

      const convById = Object.fromEntries(convList.map(c => [c.id, c]))
      for (const m of activeMsgs) {
        const titre = convById[m.conversation_id ?? '']?.offres?.titre
        items.push({
          date: m.created_at,
          kind: 'message' as ActivityKind,
          text: titre ? `Nouveau message concernant « ${titre} »` : 'Nouveau message reçu',
          href: '/dashboard/messages',
        })
      }

      for (const c of ((candidaturesData ?? []) as Candidature[])) {
        const entreprise = c.offres?.entreprise_nom ?? c.offres?.titre ?? 'une entreprise'
        items.push({
          date: c.created_at,
          kind: 'candidature' as ActivityKind,
          text: `Votre candidature chez ${entreprise} est ${c.statut}`,
          href: '/candidatures',
        })
      }

      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setActivites(items.slice(0, 5))

      // Vues profil — visiteurs DISTINCTS sur 30 jours + two-step noms
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
      const vueList30 = ((vuesData ?? []) as VueProfil[]).filter(v => v.created_at >= thirtyDaysAgo)

      // Déduplique par visiteur_id : garde la vue la plus récente par visiteur
      const vueByVisitor = new Map<string, VueProfil>()
      for (const v of vueList30) {
        const vid = v.visiteur_id
        if (!vid) continue
        const existing = vueByVisitor.get(vid)
        if (!existing || v.created_at > existing.created_at) vueByVisitor.set(vid, v)
      }
      const uniqueVisitors = [...vueByVisitor.values()]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))

      setVueCount(uniqueVisitors.length)
      setVueTotal(vueList30.length)
      setVuesRecentes(uniqueVisitors.slice(0, 3).map(v => ({ created_at: v.created_at })))

      // Favoris récents
      type FavRaw = {
        created_at: string
        offres: { id: string; titre: string; ville: string | null; recruteur_id?: string | null; expire_at?: string | null } | null
      }
      const favList: FavOffre[] = ((favData ?? []) as unknown as FavRaw[])
        .filter(f => f.offres != null)
        .map(f => {
          const rid = f.offres?.recruteur_id
          const ep  = rid ? epMap[rid] : undefined
          return {
            id:            f.offres!.id,
            titre:         f.offres!.titre,
            recruteur_id:  rid ?? undefined,
            entreprise_nom: ep?.entreprise_nom ?? undefined,
            ville:         f.offres!.ville ?? undefined,
          }
        })
      setFavOffres(favList)
      setTotalOffresCount(offresCount ?? 0)

      // ── Bloc « À traiter » ────────────────────────────────────────────────────
      const actionList: ActionItem[] = []

      // Cas 1 : rendez-vous proposé en attente de réponse
      type RdvRaw = { id: string; creneaux_rdv: { debut_utc: string }[] }
      const rdvCount = countRdvEnAttente((rdvData ?? []) as RdvRaw[])
      if (rdvCount === 1) {
        actionList.push({ label: 'Un recruteur vous propose un rendez-vous', href: '/dashboard/rendez-vous' })
      } else if (rdvCount > 1) {
        actionList.push({ label: `${rdvCount} propositions de rendez-vous en attente`, href: '/dashboard/rendez-vous' })
      }

      // Cas 2 : messages non lus
      const unreadTotal = convList.reduce((s, c) => s + (c.non_lu_candidat ?? 0), 0)
      if (unreadTotal === 1) {
        actionList.push({ label: 'Vous avez un message non lu', href: '/dashboard/messages' })
      } else if (unreadTotal > 1) {
        actionList.push({ label: `Vous avez ${unreadTotal} messages non lus`, href: '/dashboard/messages' })
      }

      // Cas 3 : favoris expirant dans moins de 3 jours
      const nowIso      = new Date().toISOString()
      const threeDaysIso = new Date(Date.now() + 3 * 86400000).toISOString()
      const favExpirantCount = ((favData ?? []) as unknown as FavRaw[])
        .filter(f => {
          const exp = f.offres?.expire_at
          return exp && exp > nowIso && exp < threeDaysIso
        }).length
      if (favExpirantCount === 1) {
        actionList.push({ label: 'Une offre en favori expire dans moins de trois jours', href: '/favoris' })
      } else if (favExpirantCount > 1) {
        actionList.push({ label: `${favExpirantCount} offres en favori expirent dans moins de trois jours`, href: '/favoris' })
      }

      // Cas 4 : profil incomplet (< 80 %)
      if (calcCompletion(p) < 80) {
        actionList.push({ label: 'Complétez votre profil pour apparaître dans plus de recherches', href: '/profil' })
      }

      setActionItems(actionList.slice(0, 3))

      setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!loading) setMounted(true)
  }, [loading])

  async function handleApply(offreId: string) {
    const uid = userIdRef.current
    if (!uid) return
    const { error } = await supabase.from('candidatures').insert({ candidat_id: uid, offre_id: offreId, statut: 'envoyée' })
    if (!error) setApplied(prev => new Set([...prev, offreId]))
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = searchQuery.trim()
    router.push(q ? `/offres?q=${encodeURIComponent(q)}` : '/offres')
  }

  function handleSuggestion(tag: string) {
    router.push(`/offres?q=${encodeURIComponent(tag)}`)
  }

  async function handleStatusChange(newStatus: string) {
    if (!profil) return
    setStatusLoading(true)
    setProfil(prev => prev ? { ...prev, disponibilite: newStatus } : prev)
    await supabase.from('profils').update({ disponibilite: newStatus })
      .eq('user_id', profil.user_id ?? '')
    setStatusLoading(false)
  }

  if (loading) return <Spinner />

  const p               = profil ?? {}
  const profilSuffisant = profilSuffisantPourScoreCandidat(p)
  const prenom          = p.prenom ?? 'vous'
  const initials      = `${p.prenom?.[0] ?? ''}${p.nom?.[0] ?? ''}`.toUpperCase() || 'K'
  const completion    = calcCompletion(p)
  const statusValue   = p.disponibilite ?? 'maintenant'
  const offresBlocTitle = offresMode === 'match'
    ? 'Offres qui correspondent à votre profil'
    : 'Offres récentes'

  const LABELS_TYPE_POSTE: Record<string, string> = {
    cdi: 'CDI', cdd: 'CDD', freelance: 'Freelance', alternance: 'Alternance',
  }
  const LABELS_MODE_TRAVAIL: Record<string, string> = {
    remote: '100 % Remote', hybride: 'Hybride', presentiel: 'Présentiel',
  }
  const searchSuggestions: string[] = (() => {
    const tags: string[] = []
    if (p.domaine) tags.push(p.domaine)
    if (p.ville) tags.push(p.ville)
    if (Array.isArray(p.type_poste)) {
      const valid = p.type_poste.filter((k: string) => k !== 'ouvert')
      if (valid.length > 0) tags.push(LABELS_TYPE_POSTE[valid[0]] ?? valid[0])
    }
    if (p.mode_travail && p.mode_travail !== 'flexible') {
      tags.push(LABELS_MODE_TRAVAIL[p.mode_travail] ?? p.mode_travail)
    }
    return tags.slice(0, 4)
  })()

  const missingSuggestions = COMPLETION_SECTIONS
    .flatMap(s => s.fields)
    .filter(f => f.suggestion && !isFilled(p, f.key))
    .sort((a, b) => (SUGGESTION_RANK[a.key as string] ?? 99) - (SUGGESTION_RANK[b.key as string] ?? 99))
    .slice(0, 3)
    .map(f => ({ key: f.key, label: f.suggestion! }))

  const winWidth    = winSize.w
  const winHeight   = winSize.h
  const isXL        = winSize.rawW >= 1920
  const offresLimit = winHeight >= 900 ? 3 : 2
  const itemsLimit  = winHeight >= 900 ? 3 : 2
  const gridCols    = isXL ? '1.3fr 1fr 0.9fr' : winWidth >= 1000 ? '1.4fr 1fr' : '1fr'
  const gridGap     = isXL ? 24 : 20
  const gridMaxW    = isXL ? 1760 : 1200

  const animStyle = (delay: number): React.CSSProperties =>
    mounted
      ? { animation: `kapolia-motion-fadein-up 450ms ease ${delay}ms both` }
      : { opacity: 0 }

  // ── Blocs extraits pour le réemploi en mode 3 colonnes ──────────────────────

  const blocCandidatures = (
    <Card style={animStyle(100)}>
      <SectionTitle
        title="Mes candidatures"
        link="Voir tout →"
        href="/candidatures"
      />
      {candidatures.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <p style={{ color: C.grey, fontSize: 14, marginBottom: 16 }}>
            Vous n&apos;avez pas encore postulé.
          </p>
          <button
            onClick={() => router.push('/offres')}
            style={{
              backgroundColor: C.terracotta, color: C.white,
              border: 'none', borderRadius: 12,
              padding: '10px 20px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Découvrir les offres
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {candidatures.slice(0, itemsLimit).map((c, i, arr) => (
            <div
              key={c.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 0',
                borderBottom: i < arr.length - 1 ? `1px solid ${C.sable}` : 'none',
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 16, fontWeight: 600, color: C.dark, marginBottom: 3 }}>
                  {c.offres?.titre ?? 'Offre indisponible'}
                </div>
                <div style={{ fontSize: 12, color: C.grey, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                  {c.offres?.recruteur_id ? (
                    <Link
                      href={`/entreprise/${c.offres.recruteur_id}`}
                      onClick={e => e.stopPropagation()}
                      style={{ color: C.terracotta, fontWeight: 600, textDecoration: 'none' }}
                    >
                      {c.offres.entreprise_nom}
                    </Link>
                  ) : c.offres?.entreprise_nom ? (
                    <span>{c.offres.entreprise_nom}</span>
                  ) : null}
                  {c.offres?.entreprise_nom && <span>·</span>}
                  <span>{daysSince(c.created_at)}</span>
                </div>
              </div>
              <StatusBadge statut={c.statut} />
            </div>
          ))}
        </div>
      )}
    </Card>
  )

  const blocActivite = (
    <Card style={animStyle(150)}>
      <SectionTitle title="Activité récente" />
      {activites.length === 0 ? (
        <div style={{
          padding: '20px 0', textAlign: 'center',
          color: C.grey, fontSize: 13, lineHeight: 1.6,
        }}>
          Aucune activité récente. Complétez votre profil pour être visible.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {activites.map((a, i) => (
            <button
              key={i}
              onClick={() => router.push(a.href)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '13px 14px', borderRadius: 12, border: 'none',
                backgroundColor: 'transparent', cursor: 'pointer',
                textAlign: 'left', width: '100%', fontFamily: 'inherit',
                transition: 'background-color 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = C.chip)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <ActivityIcon kind={a.kind} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.4 }}>{a.text}</div>
                <div style={{ fontSize: 11, color: C.grey, marginTop: 3 }}>{timeAgo(a.date)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  )

  return (
    <div style={{ backgroundColor: C.bg, minHeight: '100vh' }}>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header style={{ padding: '28px 32px 0', ...animStyle(0) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <h1 style={{
            fontFamily: FONT_SERIF, letterSpacing: '-0.005em',
            fontSize: 34, fontWeight: 600,
            color: C.dark, margin: 0,
            lineHeight: 1.2,
          }}>
            Bonjour {prenom}
          </h1>
          <StatusToggle value={statusValue} onChange={handleStatusChange} />
        </div>
        <div style={{ maxWidth: 530, margin: '0 auto 28px' }}>
          <div style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 18, fontWeight: 600, color: C.dark, marginBottom: 4, textAlign: 'center' }}>
            Chercher un poste
          </div>
          <div style={{ fontSize: 12.5, color: C.grey, marginBottom: 12, textAlign: 'center' }}>
            Lancez une recherche parmi les {totalOffresCount} offres publiées sur Kapolia
          </div>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <svg
                width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="#9B9B9B" strokeWidth="2" strokeLinecap="round"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              >
                <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Poste, compétence, entreprise…"
                style={{
                  width: '100%', height: 42, boxSizing: 'border-box',
                  paddingLeft: 36, paddingRight: 14,
                  fontSize: 14, borderRadius: 9,
                  border: `1.5px solid ${C.sable}`,
                  backgroundColor: C.white, color: C.dark,
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
            </div>
            <button
              type="submit"
              onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.93)')}
              onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
              style={{
                height: 42, padding: '0 18px',
                borderRadius: 9, border: 'none',
                backgroundColor: C.terracotta, color: C.chip,
                fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                whiteSpace: 'nowrap', flexShrink: 0,
                transition: 'filter 150ms ease',
              }}
            >
              Rechercher
            </button>
          </form>
          {searchSuggestions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11.5, color: C.grey, flexShrink: 0 }}>Suggestions</span>
              {searchSuggestions.map((tag, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestion(tag)}
                  style={{
                    fontSize: 11.5, color: C.dark,
                    backgroundColor: C.white, border: `1px solid ${C.sable}`,
                    borderRadius: 20, padding: '4px 12px',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'border-color 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = C.terracotta)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = C.sable)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ── BODY GRID ────────────────────────────────────────────────────────── */}
      <div style={{
        maxWidth: gridMaxW, margin: '0 auto',
        padding: '24px 32px 48px',
        display: 'grid',
        gridTemplateColumns: gridCols,
        gap: gridGap,
      }}>

        {/* ══ COL 1 — Offres (+ candidatures/activité si non-XL) ════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: gridGap }}>

          {/* BLOC 1 — Offres recommandées */}
          <Card style={animStyle(50)}>
            <SectionTitle
              title={offresBlocTitle}
              link="Voir toutes les offres →"
              href="/offres"
            />
            {offres.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: C.grey, fontSize: 14 }}>
                Aucune offre disponible pour le moment.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {offres.slice(0, offresLimit).map(o => (
                  <OffreCard
                    key={o.id}
                    offre={o as OffreCardData}
                    applied={applied.has(o.id)}
                    saved={favIds.has(o.id)}
                    onApply={handleApply}
                    onToggleSave={toggleFav}
                    isConnected={true}
                    showDescription={false}
                    showApply={false}
                    showSave={false}
                  />
                ))}
              </div>
            )}
          </Card>

          {/* En dessous de 1920 px : candidatures et activité dans cette colonne */}
          {!isXL && blocCandidatures}
          {!isXL && blocActivite}
        </div>

        {/* ══ COL 2 — Candidatures + Activité (XL uniquement) ══════════════ */}
        {isXL && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: gridGap }}>
            {blocCandidatures}
            {blocActivite}
          </div>
        )}

        {/* ══ COL 3 (XL) ou COL 2 (non-XL) — Blocs de droite ══════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: gridGap }}>

          {/* BLOC À TRAITER */}
          {actionItems.length > 0 && (
            <Card style={animStyle(200)}>
              <SectionTitle title="À traiter" />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {actionItems.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => router.push(item.href)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: 12, padding: '10px 0',
                      borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                      borderBottom: i < actionItems.length - 1 ? `1px solid ${C.sable}` : 'none',
                      backgroundColor: 'transparent', cursor: 'pointer',
                      textAlign: 'left', width: '100%', fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => {
                      const arr = e.currentTarget.lastElementChild as HTMLElement
                      if (arr) arr.style.transform = 'translateX(4px)'
                    }}
                    onMouseLeave={e => {
                      const arr = e.currentTarget.lastElementChild as HTMLElement
                      if (arr) arr.style.transform = 'translateX(0)'
                    }}
                  >
                    <span style={{ fontSize: 13, color: C.dark, lineHeight: 1.4, flex: 1 }}>{item.label}</span>
                    <span style={{ fontSize: 13, color: C.terracotta, flexShrink: 0, transition: 'transform 180ms ease' }}>→</span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* BLOC 4 — Mon profil miniature */}
          <Card style={animStyle(actionItems.length > 0 ? 250 : 200)}>
            <SectionTitle title="Mon profil" />

            {/* Avatar + info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <Avatar profil={p} size="md" />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: p.prenom || p.nom ? C.dark : C.grey }}>
                  {p.prenom || p.nom
                    ? [p.prenom, p.nom].filter(Boolean).join(' ')
                    : 'Profil à compléter'}
                </div>
                {(p.domaine || p.ville) && (
                  <div style={{ fontSize: 12, color: C.grey, marginTop: 2 }}>
                    {[p.domaine, p.ville].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
            </div>

            {p.signature && (
              <p style={{
                fontStyle: 'italic', fontSize: 13, color: C.grey,
                margin: '0 0 16px', lineHeight: 1.5,
                borderLeft: `3px solid ${C.sable}`,
                paddingLeft: 12,
              }}>
                {`« ${truncate(p.signature, 80)} »`}
              </p>
            )}

            {/* Completion bar */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: C.grey }}>Complétion du profil</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: completion >= 80 ? C.vert : C.terracotta }}>
                  {completion}%
                </span>
              </div>
              <div style={{ height: 6, backgroundColor: C.sable, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: '100%',
                  backgroundColor: completion >= 80 ? C.vert : C.terracotta,
                  transform: mounted ? `scaleX(${completion / 100})` : 'scaleX(0)',
                  transformOrigin: 'left',
                  transition: 'transform 0.8s ease 0.45s',
                }} />
              </div>
            </div>

            {/* Priority suggestions */}
            {missingSuggestions.length > 0 && (
              <div style={{
                backgroundColor: C.chip,
                border: `1px solid `,
                borderRadius: 10, padding: '10px 14px',
                marginBottom: 16,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.terracotta, marginBottom: 8 }}>
                  Pour aller plus loin :
                </div>
                {missingSuggestions.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => router.push('/profil?edit=true')}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      fontSize: 12, color: C.terracotta, marginBottom: 4,
                      background: 'none', border: 'none', padding: 0,
                      cursor: 'pointer', fontFamily: 'inherit',
                      textDecoration: 'underline', textDecorationStyle: 'dotted',
                    }}
                  >
                    → {label}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => router.push('/profil')}
              onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.93)')}
              onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
              style={{
                width: '100%', backgroundColor: C.vert, color: C.white,
                border: 'none', borderRadius: 10,
                padding: '9px 14px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'filter 150ms ease',
              }}
            >
              Voir mon profil
            </button>
          </Card>

          {/* BLOC 5 — Messages */}
          <Card style={animStyle(actionItems.length > 0 ? 300 : 250)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 20, color: C.dark, margin: 0 }}>
                  Messages
                </h2>
                {unreadCount > 0 && (
                  <span style={{
                    backgroundColor: '#E53E3E', color: C.white,
                    fontSize: 11, fontWeight: 700,
                    padding: '2px 7px', borderRadius: 20, minWidth: 20, textAlign: 'center',
                  }}>
                    {unreadCount}
                  </span>
                )}
              </div>
              <button
                onClick={() => router.push('/dashboard/messages')}
                style={{
                  background: 'none', border: 'none', fontSize: 12,
                  color: C.terracotta, cursor: 'pointer', fontWeight: 500,
                  padding: 0, fontFamily: 'inherit',
                }}
              >
                Voir tout →
              </button>
            </div>

            {conversations.length === 0 ? (
              <p style={{ color: C.grey, fontSize: 13, textAlign: 'center', padding: '16px 0', margin: 0 }}>
                Aucun message pour le moment.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {conversations.slice(0, itemsLimit).map(conv => {
                  const recruteur = conv.profils
                  const nom = (recruteur
                    ? `${recruteur.prenom ?? ''} ${recruteur.nom ?? ''}`.trim()
                    : '') || 'Recruteur'
                  return (
                    <button
                      key={conv.id}
                      onClick={() => router.push('/dashboard/messages')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px', borderRadius: 12, border: 'none',
                        backgroundColor: 'transparent', cursor: 'pointer',
                        textAlign: 'left', width: '100%', fontFamily: 'inherit',
                        transition: 'background-color 0.12s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = C.chip)}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        backgroundColor: C.sable, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, color: C.vert,
                      }}>
                        {nom[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 2 }}>
                          {nom}
                        </div>
                        <div style={{ fontSize: 11, color: C.grey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {conv.offres?.titre ? `Re: ${conv.offres.titre}` : 'Conversation'}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            <button
              onClick={() => router.push('/dashboard/messages')}
              style={{
                marginTop: 16, width: '100%',
                backgroundColor: 'transparent',
                border: `1px solid ${C.sable}`, borderRadius: 10,
                padding: '9px 14px', fontSize: 12, fontWeight: 600,
                color: C.dark, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Voir tous les messages
            </button>
          </Card>

          {/* BLOC 6 — Vues du profil */}
          <Card style={animStyle(actionItems.length > 0 ? 350 : 300)}>
            <SectionTitle title="Qui a consulté votre profil" />

            <div style={{ textAlign: 'center', padding: '12px 0 18px' }}>
              <div style={{
                fontFamily: FONT_SERIF, letterSpacing: '-0.005em',
                fontSize: 40, fontWeight: 600, color: C.vert, lineHeight: 1,
              }}>
                {vueCount}
              </div>
              <div style={{ fontSize: 13, color: C.grey, marginTop: 6, lineHeight: 1.5 }}>
                {vueCount === 1 ? 'recruteur a consulté' : 'recruteurs ont consulté'} votre profil
                <br />
                <span style={{ fontSize: 11 }}>
                  ces 30 derniers jours
                  {vueTotal > vueCount && ` · ${vueTotal} consultation${vueTotal > 1 ? 's' : ''}`}
                </span>
              </div>
            </div>

            {vueCount === 0 ? (
              <div style={{ textAlign: 'center', paddingBottom: 4 }}>
                <p style={{ fontSize: 13, color: C.grey, margin: '0 0 14px', lineHeight: 1.6 }}>
                  Complétez votre profil pour être mieux repéré par les recruteurs.
                </p>
                <button
                  onClick={() => router.push('/profil')}
                  style={{
                    backgroundColor: C.vert, color: C.white,
                    border: 'none', borderRadius: 10,
                    padding: '8px 18px', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Compléter mon profil
                </button>
              </div>
            ) : (
              <div style={{
                borderTop: `1px solid ${C.sable}`,
                paddingTop: 14,
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                {vuesRecentes.map((v, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 0',
                  }}>
                    <div style={{ fontSize: 13, color: C.dark }}>Un recruteur</div>
                    <div style={{ fontSize: 11, color: C.grey }}>{timeAgo(v.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>


        </div>
      </div>
    </div>
  )
}
