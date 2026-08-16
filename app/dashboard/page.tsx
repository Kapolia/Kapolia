'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { calculerScore } from '@/lib/matching'
import Avatar from '@/components/Avatar'

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  terracotta: '#C4673A',
  sable:      '#E8D5B7',
  creme:      '#F7F2EB',
  vert:       '#2C4A3E',
  dark:       '#1A1A1A',
  grey:       '#6B6B6B',
  lightGrey:  '#E0D8CC',
  white:      '#FFFFFF',
}

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
  structure?: string
  mode_travail?: string[]
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
  entreprise_nom?: string
  ville?: string
  type_contrat?: string
  domaine?: string
  experience?: string
  valeurs?: string[]
  teletravail?: boolean
  active?: boolean
  statut_publication?: string
  created_at?: string
  score?: number
}

type OffresMode = 'match' | 'recent'

type Candidature = {
  id: string
  statut: string
  created_at: string
  offres?: {
    titre?: string
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

type ActivityItem = {
  date: string
  icon: string
  text: string
  href: string
}

type VueProfil = {
  created_at: string
  visiteur_id?: string
  visiteur_type?: string
}

type VueRecente = { created_at: string }
type FavOffre = { id: string; titre: string; entreprise_nom?: string; ville?: string }

type MessageActivite = {
  created_at: string
  contenu?: string
  conversation_id?: string
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'maintenant',      label: 'En recherche active',      dot: '🟢' },
  { value: 'a_partir_de',    label: 'Ouvert aux opportunités',  dot: '🟡' },
  { value: 'non_disponible', label: 'Pas disponible',           dot: '🔴' },
]

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
      { key: 'mode_travail',  label: 'Environnement',         suggestion: 'Ajoutez votre environnement préféré' },
      { key: 'structure',     label: 'Mode de travail',       suggestion: 'Précisez votre mode de travail préféré' },
      { key: 'disponibilite', label: 'Disponibilité',         suggestion: 'Confirmez votre disponibilité' },
      { key: 'langues',       label: 'Langues',               suggestion: 'Renseignez vos langues' },
    ],
  },
  {
    label: 'Mon histoire', weight: 0.25,
    fields: [
      { key: 'signature',                label: 'Phrase signature',      suggestion: 'Rédigez votre phrase signature' },
      { key: 'valeur',                   label: "Ce qui m'anime",        suggestion: 'Précisez ce qui vous anime' },
      { key: 'plus_grande_reussite',     label: 'Plus grande réussite',  suggestion: 'Partagez votre plus grande réussite' },
      { key: 'ce_que_je_veux_apprendre', label: 'Ce que je veux apprendre', suggestion: 'Décrivez ce que vous voulez apprendre' },
      { key: 'projet_titre',             label: 'Titre du projet',       suggestion: 'Donnez un titre à votre projet phare' },
      { key: 'projet_phare',             label: 'Description du projet', suggestion: 'Décrivez votre projet phare en détail' },
      { key: 'projet_impact',            label: 'Impact du projet',      suggestion: "Précisez l'impact de votre projet" },
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
  'signature', 'valeur', 'plus_grande_reussite', 'ce_que_je_veux_apprendre',
  'projet_titre', 'projet_phare', 'projet_impact',
  'type_poste', 'disponibilite', 'langues', 'mode_travail', 'structure',
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

function getContextPhrase(unread: number, nbCandidatures: number, completion: number): string {
  if (unread > 0) return `Vous avez ${unread} message${unread > 1 ? 's' : ''} non lu${unread > 1 ? 's' : ''}.`
  if (nbCandidatures > 0) return `${nbCandidatures} candidature${nbCandidatures > 1 ? 's' : ''} en cours — bonne chance !`
  if (completion < 60) return 'Complétez votre profil pour être mieux repéré.'
  return 'Bienvenue — de nouvelles opportunités vous attendent.'
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
  return s.length > n ? s.slice(0, n) + '…' : s
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', backgroundColor: C.creme,
    }}>
      <style suppressHydrationWarning>{`@keyframes kavio-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        border: `3px solid ${C.sable}`, borderTopColor: C.terracotta,
        animation: 'kavio-spin 0.8s linear infinite',
      }} />
    </div>
  )
}

function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      backgroundColor: C.white,
      border: `1px solid ${C.sable}`,
      borderRadius: 20,
      padding: 28,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
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
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: C.dark, margin: 0 }}>
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
  'refusée':    { bg: '#FDECEA', color: '#C0392B' },
}

function StatusBadge({ statut }: { statut: string }) {
  const key = statut?.toLowerCase() ?? ''
  const style = STATUT_COLORS[key] ?? { bg: C.creme, color: C.grey }
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

function OffreCard({ offre, onPostuler }: { offre: Offre; onPostuler: (id: string) => void }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        border: `1px solid ${hov ? C.terracotta : C.sable}`,
        borderRadius: 16,
        padding: '18px 20px',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: hov ? '0 4px 16px rgba(196,103,58,0.1)' : 'none',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.dark, marginBottom: 4 }}>
          {offre.titre}
        </div>
        <div style={{ fontSize: 13, color: C.grey }}>
          {[offre.entreprise_nom, offre.ville].filter(Boolean).join(' · ')}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {offre.type_contrat && (
          <span style={{
            fontSize: 11, backgroundColor: C.creme, color: C.grey,
            padding: '3px 10px', borderRadius: 20, fontWeight: 500,
          }}>
            {offre.type_contrat}
          </span>
        )}
        <button
          onClick={() => onPostuler(offre.id)}
          style={{
            marginLeft: 'auto',
            backgroundColor: C.terracotta, color: C.white,
            border: 'none', borderRadius: 10,
            padding: '7px 16px', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Postuler en 1 clic
        </button>
      </div>
    </div>
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
          backgroundColor: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: 10, padding: '7px 14px',
          color: C.white, fontSize: 13, fontWeight: 500,
          cursor: 'pointer', fontFamily: 'inherit',
          backdropFilter: 'blur(8px)',
        }}
      >
        <span>{current.dot}</span>
        <span>{current.label}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0,
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
                backgroundColor: opt.value === value ? C.creme : 'transparent',
                color: C.dark, fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'background-color 0.1s',
              }}
            >
              <span>{opt.dot}</span>
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

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/inscription'); return }

      const [
        { data: profilData },
        { data: candidaturesData },
        { data: offresData },
        { data: convsRaw },
        { data: vuesData },
        { data: favData },
      ] = await Promise.all([
        supabase.from('profils').select('*').eq('user_id', user.id).single(),
        supabase.from('candidatures')
          .select('*, offres(titre, entreprise_nom, ville, type_contrat)')
          .eq('candidat_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase.from('offres').select('*')
          .eq('active', true)
          .eq('statut_publication', 'publiée')
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
          .select('created_at, offres(id, titre, entreprise_nom, ville)')
          .eq('candidat_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3),
      ])

      if (!(profilData as { onboarding_completed?: boolean } | null)?.onboarding_completed) {
        router.replace('/onboarding')
        return
      }

      const p: Profil = (profilData as Profil) ?? {}
      setProfil(p)
      setCandidatures((candidaturesData as Candidature[]) ?? [])

      if (offresData) {
        const MATCH_THRESHOLD = 50
        const scored = (offresData as Offre[]).map(o => ({ ...o, score: calculerScore(p, o) }))
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

      // Two-step : récupère les profils recruteurs + messages non-lus reçus
      const convList = (convsRaw ?? []) as ConvRaw[]
      const recruteurIds = [...new Set(convList.map(c => c.recruteur_id).filter(Boolean))]
      const convIds      = convList.map(c => c.id)

      const profilMap: Record<string, { prenom?: string; nom?: string }> = {}
      if (recruteurIds.length) {
        const { data: rData } = await supabase
          .from('profils').select('user_id, prenom, nom').in('user_id', recruteurIds)
        for (const r of (rData ?? [])) profilMap[r.user_id] = r
      }

      let activeMsgs: MessageActivite[] = []
      if (convIds.length) {
        const { data: mData } = await supabase
          .from('messages')
          .select('created_at, contenu, conversation_id')
          .in('conversation_id', convIds)
          .neq('expediteur_id', user.id)
          .eq('lu', false)
          .order('created_at', { ascending: false })
          .limit(3)
        activeMsgs = (mData ?? []) as MessageActivite[]
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
          icon: '👁',
          text: `Votre profil a été consulté par un recruteur`,
          href: '/profil',
        })
      }

      const convById = Object.fromEntries(convList.map(c => [c.id, c]))
      for (const m of activeMsgs) {
        const titre = convById[m.conversation_id ?? '']?.offres?.titre
        items.push({
          date: m.created_at,
          icon: '💬',
          text: titre ? `Nouveau message concernant « ${titre} »` : 'Nouveau message reçu',
          href: '/dashboard/messages',
        })
      }

      for (const c of ((candidaturesData ?? []) as Candidature[])) {
        const entreprise = c.offres?.entreprise_nom ?? c.offres?.titre ?? 'une entreprise'
        items.push({
          date: c.created_at,
          icon: '📋',
          text: `Candidature chez ${entreprise} — statut : ${c.statut}`,
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
        offres: { id: string; titre: string; entreprise_nom: string | null; ville: string | null } | null
      }
      const favList: FavOffre[] = ((favData ?? []) as unknown as FavRaw[])
        .filter(f => f.offres != null)
        .map(f => ({
          id:            f.offres!.id,
          titre:         f.offres!.titre,
          entreprise_nom: f.offres!.entreprise_nom ?? undefined,
          ville:         f.offres!.ville ?? undefined,
        }))
      setFavOffres(favList)

      setLoading(false)
    }
    load()
  }, [router])

  async function handleStatusChange(newStatus: string) {
    if (!profil) return
    setStatusLoading(true)
    setProfil(prev => prev ? { ...prev, disponibilite: newStatus } : prev)
    await supabase.from('profils').update({ disponibilite: newStatus })
      .eq('user_id', profil.user_id ?? '')
    setStatusLoading(false)
  }

  async function handlePostuler(offreId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('candidatures').insert({
      candidat_id: user.id,
      offre_id:    offreId,
      statut:      'envoyée',
    })
    if (!error) {
      const { data } = await supabase.from('candidatures')
        .select('*, offres(titre, entreprise_nom, ville, type_contrat)')
        .eq('candidat_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3)
      setCandidatures((data as Candidature[]) ?? [])
    }
  }

  if (loading) return <Spinner />

  const p             = profil ?? {}
  const prenom        = p.prenom ?? 'vous'
  const initials      = `${p.prenom?.[0] ?? ''}${p.nom?.[0] ?? ''}`.toUpperCase() || 'K'
  const completion    = calcCompletion(p)
  const statusValue   = p.disponibilite ?? 'maintenant'
  const phrase        = getContextPhrase(unreadCount, candidatures.length, completion)
  const offresBlocTitle = offresMode === 'match'
    ? 'Offres qui correspondent à votre profil'
    : 'Offres récentes'

  const missingSuggestions = COMPLETION_SECTIONS
    .flatMap(s => s.fields)
    .filter(f => f.suggestion && !isFilled(p, f.key))
    .sort((a, b) => (SUGGESTION_RANK[a.key as string] ?? 99) - (SUGGESTION_RANK[b.key as string] ?? 99))
    .slice(0, 3)
    .map(f => ({ key: f.key, label: f.suggestion! }))

  return (
    <div style={{ backgroundColor: C.creme, minHeight: '100vh' }}>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header style={{
        background: `linear-gradient(135deg, ${C.vert} 0%, #3d5c50 60%, #7a4a32 100%)`,
        padding: '40px 40px 36px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative blobs */}
        <div style={{
          position: 'absolute', top: -40, right: -40,
          width: 200, height: 200, borderRadius: '50%',
          backgroundColor: `${C.terracotta}20`,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, right: 120,
          width: 140, height: 140, borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.04)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Top row: greeting + status */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{
                fontFamily: 'Georgia, serif',
                fontSize: 'clamp(28px, 4vw, 44px)',
                color: C.white, margin: '0 0 8px',
                lineHeight: 1.15,
              }}>
                Bonjour {prenom} 👋
              </h1>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.72)', margin: 0, fontWeight: 300 }}>
                {phrase}
              </p>
            </div>

            <StatusToggle
              value={statusValue}
              onChange={handleStatusChange}
            />
          </div>

          {/* 3 inline stats */}
          <div style={{
            marginTop: 28, display: 'flex', gap: 24, flexWrap: 'wrap',
          }}>
            {[
              { label: matchCount > 0 ? `${matchCount} offre${matchCount !== 1 ? 's' : ''} correspond${matchCount !== 1 ? 'ent' : ''} à votre profil` : 'Aucune offre ne correspond encore', icon: '✦' },
              { label: `${candidatures.length} candidature${candidatures.length !== 1 ? 's' : ''} en cours`, icon: '📋' },
              { label: `${unreadCount} message${unreadCount !== 1 ? 's' : ''} non lu${unreadCount !== 1 ? 's' : ''}`, icon: '💬' },
            ].map(({ label, icon }) => (
              <div
                key={label}
                style={{
                  fontSize: 13, color: 'rgba(255,255,255,0.85)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <span style={{ opacity: 0.7 }}>{icon}</span>
                {label}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── BODY GRID ────────────────────────────────────────────────────────── */}
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        padding: '32px 32px 48px',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
        gap: 24,
      }}>

        {/* ══ LEFT COLUMN ═══════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* BLOC 1 — Offres recommandées */}
          <Card>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {offres.map(o => (
                  <OffreCard key={o.id} offre={o} onPostuler={handlePostuler} />
                ))}
              </div>
            )}
          </Card>

          {/* BLOC 2 — Candidatures récentes */}
          <Card>
            <SectionTitle
              title="Mes candidatures"
              link="Voir tout →"
              href="/candidatures"
            />
            {candidatures.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <p style={{ color: C.grey, fontSize: 14, marginBottom: 16 }}>
                  Vous n'avez pas encore postulé.
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
                {candidatures.map((c, i) => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 0',
                      borderBottom: i < candidatures.length - 1 ? `1px solid ${C.sable}` : 'none',
                      gap: 12,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.dark, marginBottom: 3 }}>
                        {c.offres?.titre ?? '—'}
                      </div>
                      <div style={{ fontSize: 12, color: C.grey }}>
                        {[c.offres?.entreprise_nom, daysSince(c.created_at)].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <StatusBadge statut={c.statut} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* BLOC 3 — Activité récente */}
          <Card>
            <SectionTitle title="Activité récente" />
            {activites.length === 0 ? (
              <div style={{
                padding: '20px 0', textAlign: 'center',
                color: C.grey, fontSize: 13, lineHeight: 1.6,
              }}>
                Aucune activité récente — complétez votre profil pour être visible
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
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = C.creme)}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{a.icon}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.4 }}>{a.text}</div>
                      <div style={{ fontSize: 11, color: C.grey, marginTop: 3 }}>{timeAgo(a.date)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ══ RIGHT COLUMN ══════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* BLOC 4 — Mon profil miniature */}
          <Card>
            <SectionTitle title="Mon profil" />

            {/* Avatar + info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <Avatar profil={p} size="md" />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.dark }}>
                  {p.prenom} {p.nom}
                </div>
                <div style={{ fontSize: 12, color: C.grey, marginTop: 2 }}>
                  {p.domaine ?? '—'} · {p.ville ?? '—'}
                </div>
              </div>
            </div>

            {p.signature && (
              <p style={{
                fontStyle: 'italic', fontSize: 13, color: C.grey,
                margin: '0 0 16px', lineHeight: 1.5,
                borderLeft: `3px solid ${C.sable}`,
                paddingLeft: 12,
              }}>
                "{truncate(p.signature, 80)}"
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
              <div style={{ height: 6, backgroundColor: C.sable, borderRadius: 3 }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: `${completion}%`,
                  backgroundColor: completion >= 80 ? C.vert : C.terracotta,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>

            {/* Priority suggestions */}
            {missingSuggestions.length > 0 && (
              <div style={{
                backgroundColor: `${C.terracotta}0D`,
                border: `1px solid ${C.terracotta}30`,
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

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => router.push('/profil')}
                style={{
                  flex: 1, backgroundColor: C.vert, color: C.white,
                  border: 'none', borderRadius: 10,
                  padding: '9px 14px', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Voir mon profil
              </button>
              <button
                onClick={() => router.push('/profil?edit=true')}
                style={{
                  flex: 1, backgroundColor: 'transparent',
                  border: `1px solid ${C.sable}`, borderRadius: 10,
                  padding: '9px 14px', fontSize: 12, fontWeight: 600,
                  color: C.dark, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Modifier
              </button>
            </div>
          </Card>

          {/* BLOC 5 — Messages */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: C.dark, margin: 0 }}>
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
                {conversations.map(conv => {
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
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = C.creme)}
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
          <Card>
            <SectionTitle title="Qui a consulté votre profil" />

            <div style={{ textAlign: 'center', padding: '12px 0 18px' }}>
              <div style={{
                fontFamily: 'Georgia, serif',
                fontSize: 40, fontWeight: 700, color: C.vert, lineHeight: 1,
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

          {/* BLOC 7 — Favoris récents */}
          <Card>
            <SectionTitle title="Vos favoris" link="Voir tous mes favoris →" href="/favoris" />

            {favOffres.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
                <p style={{ fontSize: 13, color: C.grey, margin: '0 0 14px', lineHeight: 1.6 }}>
                  Aucune offre sauvegardée pour le moment.
                </p>
                <button
                  onClick={() => router.push('/offres')}
                  style={{
                    backgroundColor: 'transparent',
                    border: `1px solid ${C.sable}`, borderRadius: 10,
                    padding: '8px 18px', fontSize: 12, fontWeight: 600,
                    color: C.dark, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Parcourir les offres
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {favOffres.map(o => (
                  <button
                    key={o.id}
                    onClick={() => router.push(`/offres/${o.id}`)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      padding: '10px 12px', borderRadius: 10, border: 'none',
                      backgroundColor: 'transparent', cursor: 'pointer',
                      textAlign: 'left', width: '100%', fontFamily: 'inherit',
                      transition: 'background-color 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = C.creme)}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.dark, lineHeight: 1.3 }}>
                      {o.titre}
                    </div>
                    <div style={{ fontSize: 11, color: C.grey, marginTop: 2 }}>
                      {[o.entreprise_nom, o.ville].filter(Boolean).join(' · ')}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

        </div>
      </div>
    </div>
  )
}
