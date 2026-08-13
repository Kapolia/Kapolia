'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type Experience = {
  poste: string
  entreprise: string
  date_debut: string
  date_fin: string
  en_poste: boolean
  missions: string
}

type Diplome = {
  intitule: string
  ecole: string
  annee: string
  mention: string
}

type FormData = {
  prenom: string
  nom: string
  domaine: string
  experience: string
  parcours: string
  mots: [string, string, string]
  environnement: string
  defi: string
  projet: string
  passions: string[]
  sideProject: string
  disponibilite: string
  dispo_date: string
  typePoste: string
  lieu: string
  ville: string
  priorite: string[]
  experiences: Experience[]
  diplomes: Diplome[]
  competences_acquises: string[]
  langues: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL = 17

const BLOCKS = [
  { label: 'Identité & Parcours',      steps: [1, 2, 3, 4] },
  { label: 'Personnalité & Soft skills', steps: [5, 6, 7] },
  { label: 'Projets & Hobbies',         steps: [8, 9, 10] },
  { label: 'Cap & Préférences',          steps: [11, 12, 13, 14] },
  { label: 'Parcours professionnel',     steps: [15, 16, 17] },
]

// Étapes optionnelles — le bouton "Passer" y apparaît
const OPTIONAL_STEPS = new Set([4, 7, 8, 9, 10, 13, 15, 16, 17])
const LONG_OPTIONAL  = new Set([15, 16, 17])

// Texte de transition affiché en tête de la 1ère étape de chaque nouveau bloc
const TRANSITIONS: Record<number, string> = {
  5:  'Bien. Voyons ce qui vous définit au-delà de votre parcours.',
  8:  'Parlons à présent de ce que vous avez construit.',
  11: 'Votre profil prend forme. Précisons ce que vous recherchez.',
  15: "Presque terminé. Il ne reste plus qu'à détailler votre parcours professionnel.",
}

// Micro-texte explicatif sous chaque titre de question
const MICRO_TEXTS: Record<number, string> = {
  1:  'Votre prénom et votre nom apparaissent sur votre profil tel que les recruteurs le verront.',
  2:  "Votre domaine nous permet de vous mettre en contact avec les recruteurs dont les besoins vous correspondent — et d'écarter ceux qui n'y correspondent pas.",
  3:  'Votre niveau permet à Kavio de vous présenter des opportunités adaptées — ni trop juniors, ni hors d\'atteinte.',
  4:  "C'est la première section que lisent les recruteurs. Pas de format imposé : formations, reconversions, expériences marquantes — écrivez comme vous parlez.",
  5:  "Les compétences s'apprennent. La personnalité, non. Ces trois mots complètent votre portrait et aident les recruteurs à cerner qui vous êtes avant même de vous rencontrer.",
  6:  "L'adéquation culturelle est aussi importante que les compétences elles-mêmes. Votre réponse nous aide à vous orienter vers les entreprises dont le fonctionnement vous correspondra.",
  7:  "Votre façon d'aborder les problèmes est souvent ce que les recruteurs cherchent à comprendre en entretien. Cette réponse leur donne une longueur d'avance — dans votre sens.",
  8:  "Une réalisation concrète marque davantage qu'une liste de compétences. Professionnelle, personnelle, associative — ce qui compte, c'est ce que ce projet dit de vous.",
  9:  "Les recruteurs Kavio s'intéressent à qui vous êtes au-delà du bureau. Vos centres d'intérêt peuvent aussi être de véritables points de connexion.",
  10: "Un projet personnel, un blog, une association, une application — ces initiatives témoignent d'une curiosité et d'un engagement qui vont au-delà de la fiche de poste.",
  11: 'Cette information nous permet de ne vous présenter que des opportunités correspondant réellement à votre situation.',
  12: 'Votre zone géographique et vos préférences de mode de travail sont des critères décisifs — pour vous comme pour les recruteurs.',
  13: "Les entreprises où l'on s'épanouit sont celles dont les valeurs rejoignent les nôtres. Vos priorités guident Kavio vers les environnements qui vous ressemblent.",
  14: 'Les recruteurs ont besoin de connaître votre situation pour s\'assurer que leur calendrier de recrutement est compatible avec le vôtre.',
  15: 'Ajoutez vos postes les plus significatifs, du plus récent au plus ancien. Vous débutez ou changez de voie ? Passez cette étape — vos autres réponses parlent déjà pour vous.',
  16: 'Du plus récent au plus ancien. Les reconversions, bootcamps et formations continues sont tout aussi valorisés que les diplômes traditionnels.',
  17: 'Vos compétences et vos langues permettent aux recruteurs de vous trouver dans leurs recherches. Plus votre liste est précise, plus votre profil remonte.',
}

const DOMAINES = [
  'Tech & Ingénierie', 'Design & Créativité', 'Marketing & Com',
  'Finance & Compta', 'RH & Recrutement', 'Commerce & Vente',
  'Opérations & Logistique', 'Conseil & Stratégie', 'Autre',
]

const EXPERIENCES = [
  { key: '< 2 ans',  desc: 'Débuts prometteurs' },
  { key: '2–5 ans',  desc: 'Vous avez vos marques' },
  { key: '5–10 ans', desc: "Confirmé(e), vous avancez avec confiance" },
  { key: '10+ ans',  desc: 'Expert(e) reconnu(e)' },
]

const ENVIRONNEMENTS = [
  { key: 'startup',   label: 'Startup agile',   desc: 'Rythme rapide, polyvalence' },
  { key: 'scaleup',   label: 'Scale-up',          desc: 'Croissance forte, structuration en cours' },
  { key: 'corporate', label: 'Grand groupe',       desc: 'Structure, expertise, ressources' },
  { key: 'indep',     label: 'Indépendant(e)',     desc: 'Autonomie totale, projets variés' },
]

const DEFIS = [
  { key: 'analyse', label: "J'analyse avant d'agir", desc: 'Comprendre pour mieux décider' },
  { key: 'action',  label: "Je teste et j'ajuste",   desc: 'Apprendre en faisant' },
  { key: 'collab',  label: "Je consulte l'équipe",   desc: 'La force du collectif' },
  { key: 'creativ', label: "L'angle inattendu",      desc: "L'originalité comme levier" },
]

const TYPES_POSTE = [
  { key: 'cdi',        label: 'CDI' },
  { key: 'cdd',        label: 'CDD' },
  { key: 'freelance',  label: 'Freelance / Mission' },
  { key: 'alternance', label: 'Alternance / Stage' },
  { key: 'ouvert',     label: 'Ouvert(e) à tout' },
]

const LIEUX = [
  { key: 'remote',     label: '100 % Remote', desc: 'Depuis partout dans le monde' },
  { key: 'hybride',    label: 'Hybride',       desc: 'Présence et flexibilité' },
  { key: 'presentiel', label: 'Présentiel',    desc: 'Je préfère le bureau' },
  { key: 'flexible',   label: 'Flexible',      desc: 'La mission prime sur le lieu' },
]

const PRIORITES = [
  'Impact réel', 'Équipe soudée', 'Salaire compétitif',
  'Évolution rapide', 'Sens & mission', 'Flexibilité horaire',
  'Apprentissage continu', 'Autonomie', 'Stabilité',
]

const DISPOS = [
  { key: 'maintenant',  label: 'En recherche active',   desc: 'Disponible immédiatement' },
  { key: 'a_partir_de', label: 'Disponible à une date', desc: 'Précisez la date ci-dessous' },
  { key: 'en_poste',    label: "En poste, à l'écoute",  desc: 'Ouvert(e) aux bonnes opportunités' },
]

const LANGUES_LIST = [
  { key: 'Français',  flag: '🇫🇷' },
  { key: 'Anglais',   flag: '🇬🇧' },
  { key: 'Espagnol',  flag: '🇪🇸' },
  { key: 'Allemand',  flag: '🇩🇪' },
  { key: 'Italien',   flag: '🇮🇹' },
  { key: 'Portugais', flag: '🇵🇹' },
  { key: 'Arabe',     flag: '🇸🇦' },
  { key: 'Chinois',   flag: '🇨🇳' },
  { key: 'Autre',     flag: '🌐' },
]

const NIVEAUX_LANGUE = ['Natif', 'Courant', 'Intermédiaire', 'Débutant']

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  terracotta: '#C4673A',
  sable:      '#E8D5B7',
  creme:      '#F7F2EB',
  vert:       '#2C4A3E',
  dark:       '#1A1A1A',
  grey:       '#6B6B6B',
  white:      '#FFFFFF',
}

// ─── Écran d'accueil ──────────────────────────────────────────────────────────

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <main style={{ backgroundColor: C.creme, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '22px clamp(20px, 5%, 48px)' }}>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: '20px', color: C.dark }}>Kavio</span>
      </header>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '32px clamp(20px, 5%, 48px)',
      }}>
        <div style={{ width: '100%', maxWidth: '560px' }}>
          <h1 style={{
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(32px, 5vw, 48px)',
            color: C.dark, fontWeight: 'normal',
            marginBottom: '32px', lineHeight: '1.2',
          }}>
            Bienvenue.
          </h1>
          <p style={{ fontSize: '17px', color: C.dark, lineHeight: '1.8', marginBottom: '16px' }}>
            Sur Kavio, les recruteurs ne reçoivent pas de CV.
          </p>
          <p style={{ fontSize: '17px', color: C.dark, lineHeight: '1.8', marginBottom: '16px' }}>
            Ils découvrent des candidats à travers un portrait complet — vos compétences, mais aussi
            votre personnalité, vos valeurs et ce que vous recherchez. De quoi leur donner envie de
            vous rencontrer.
          </p>
          <p style={{ fontSize: '17px', color: C.dark, lineHeight: '1.8', marginBottom: '44px' }}>
            Ce parcours vous prend une dizaine de minutes. Vous pourrez le compléter ou l'ajuster
            à tout moment depuis votre espace personnel.
          </p>
          <button
            onClick={onStart}
            style={{
              backgroundColor: C.terracotta, color: C.white,
              border: 'none', borderRadius: '14px',
              padding: '14px 32px', fontSize: '16px', fontWeight: '500',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: '8px',
            }}
          >
            Commencer →
          </button>
        </div>
      </div>
    </main>
  )
}

// ─── Écran final ──────────────────────────────────────────────────────────────

function FinalScreen({ onGoToProfile }: { onGoToProfile: () => void }) {
  return (
    <main style={{ backgroundColor: C.creme, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '22px clamp(20px, 5%, 48px)' }}>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: '20px', color: C.dark }}>Kavio</span>
      </header>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '32px clamp(20px, 5%, 48px)',
      }}>
        <div style={{ width: '100%', maxWidth: '480px', textAlign: 'center' }}>
          {/* Boussole */}
          <div style={{ marginBottom: '36px', display: 'flex', justifyContent: 'center' }}>
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
              <circle cx="28" cy="28" r="26" stroke={C.terracotta} strokeWidth="1" opacity="0.2" />
              <circle cx="28" cy="28" r="22" stroke={C.terracotta} strokeWidth="1.5" />
              <path d="M28 9 L25 25 L28 23 L31 25 Z" fill={C.terracotta} />
              <path d="M28 47 L31 31 L28 33 L25 31 Z" fill={C.sable} />
              <circle cx="28" cy="28" r="3.5" fill={C.terracotta} />
              <line x1="28" y1="3"  x2="28" y2="7"  stroke={C.terracotta} strokeWidth="1.5" strokeLinecap="round" />
              <line x1="28" y1="49" x2="28" y2="53" stroke={C.sable}      strokeWidth="1.5" strokeLinecap="round" />
              <line x1="3"  y1="28" x2="7"  y2="28" stroke={C.grey}       strokeWidth="1"   strokeLinecap="round" opacity="0.4" />
              <line x1="49" y1="28" x2="53" y2="28" stroke={C.grey}       strokeWidth="1"   strokeLinecap="round" opacity="0.4" />
            </svg>
          </div>

          <h1 style={{
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(26px, 4vw, 38px)',
            color: C.dark, fontWeight: 'normal',
            marginBottom: '20px', lineHeight: '1.3',
          }}>
            Votre profil est prêt.
          </h1>
          <p style={{ fontSize: '16px', color: C.grey, lineHeight: '1.8', marginBottom: '14px' }}>
            Les recruteurs vont vous découvrir autrement qu'à travers un CV.
          </p>
          <p style={{ fontSize: '16px', color: C.grey, lineHeight: '1.8', marginBottom: '44px' }}>
            Vous pouvez l'enrichir à tout moment depuis votre espace personnel — chaque détail
            ajouté augmente vos chances d'être contacté.
          </p>
          <button
            onClick={onGoToProfile}
            style={{
              backgroundColor: C.terracotta, color: C.white,
              border: 'none', borderRadius: '14px',
              padding: '14px 32px', fontSize: '16px', fontWeight: '500',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: '8px',
            }}
          >
            Accéder à mon profil →
          </button>
        </div>
      </div>
    </main>
  )
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function QuestionLabel({ num, text, sub }: { num: number; text: string; sub?: string }) {
  return (
    <>
      <p style={{
        fontSize: '12px', color: C.terracotta, fontWeight: '600',
        marginBottom: '12px', letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>
        Question {num}
      </p>
      <h2 style={{
        fontFamily: 'Georgia, serif',
        fontSize: 'clamp(22px, 3.5vw, 34px)',
        color: C.dark, lineHeight: '1.3',
        marginBottom: sub ? '12px' : '28px',
        fontWeight: 'normal',
      }}>
        {text}
      </h2>
      {sub && (
        <p style={{ fontSize: '14px', color: C.grey, lineHeight: '1.65', marginBottom: '28px' }}>
          {sub}
        </p>
      )}
    </>
  )
}

function ChoiceCard({ label, desc, selected, onClick }: {
  label: string; desc?: string; selected: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', padding: '15px 18px',
        borderRadius: '14px', border: `2px solid ${selected ? C.terracotta : C.sable}`,
        backgroundColor: selected ? 'rgba(196,103,58,0.07)' : C.white,
        cursor: 'pointer', transition: 'all 0.15s',
        marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '14px',
      }}
    >
      <span style={{
        width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${selected ? C.terracotta : '#CCC'}`,
        backgroundColor: selected ? C.terracotta : 'transparent',
        transition: 'all 0.15s',
      }} />
      <span style={{ flex: 1 }}>
        <span style={{ fontSize: '15px', fontWeight: '500', color: C.dark, display: 'block' }}>
          {label}
        </span>
        {desc && (
          <span style={{ fontSize: '13px', color: C.grey, marginTop: '2px', display: 'block' }}>
            {desc}
          </span>
        )}
      </span>
    </button>
  )
}

function StyledInput({ value, onChange, placeholder, autoFocus }: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      style={{
        width: '100%', padding: '13px 16px', fontSize: '16px',
        borderRadius: '12px', border: `2px solid ${value ? C.terracotta : C.sable}`,
        backgroundColor: C.white, color: C.dark, outline: 'none',
        boxSizing: 'border-box', transition: 'border-color 0.2s', fontFamily: 'inherit',
      }}
    />
  )
}

function StyledTextArea({ value, onChange, placeholder, rows = 5 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: '100%', padding: '13px 16px', fontSize: '15px',
        borderRadius: '12px', border: `2px solid ${value ? C.terracotta : C.sable}`,
        backgroundColor: C.white, color: C.dark, outline: 'none',
        boxSizing: 'border-box', resize: 'vertical', lineHeight: '1.65',
        fontFamily: 'inherit', transition: 'border-color 0.2s',
      }}
    />
  )
}

function TagInput({ tags, onAddTag, onRemoveTag, maxTags = 15, placeholder, countLabel = 'éléments' }: {
  tags: string[]; onAddTag: (tag: string) => void; onRemoveTag: (tag: string) => void
  maxTags?: number; placeholder?: string; countLabel?: string
}) {
  const [val, setVal] = useState('')
  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const trimmed = val.trim()
    if (trimmed && !tags.includes(trimmed) && tags.length < maxTags) {
      onAddTag(trimmed)
      setVal('')
    }
  }
  return (
    <div>
      {tags.length < maxTags && (
        <input
          type="text"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder ?? 'Tapez et appuyez sur Entrée'}
          style={{
            width: '100%', padding: '13px 16px', fontSize: '15px',
            borderRadius: '12px', border: `2px solid ${val ? C.terracotta : C.sable}`,
            backgroundColor: C.white, color: C.dark, outline: 'none',
            boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.2s',
          }}
        />
      )}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
          {tags.map(tag => (
            <span key={tag} style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '20px',
              backgroundColor: `${C.vert}12`, color: C.vert,
              border: `1px solid ${C.vert}25`, fontSize: '13px', fontWeight: '500',
            }}>
              {tag}
              <button
                onClick={() => onRemoveTag(tag)}
                style={{ background: 'none', border: 'none', color: C.grey, cursor: 'pointer', padding: 0, fontSize: '14px', lineHeight: 1, display: 'flex' }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <p style={{ fontSize: '12px', color: C.grey, marginTop: '8px' }}>
        {tags.length} / {maxTags} {countLabel}
      </p>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [showWelcome, setShowWelcome] = useState(true)
  const [showFinal,   setShowFinal]   = useState(false)
  const [step, setStep] = useState(1)
  const [data, setData] = useState<FormData>({
    prenom: '', nom: '', domaine: '', experience: '', parcours: '',
    mots: ['', '', ''],
    environnement: '', defi: '', projet: '', passions: [],
    sideProject: '', disponibilite: '', dispo_date: '',
    typePoste: '', lieu: '', ville: '', priorite: [],
    experiences: [], diplomes: [], competences_acquises: [], langues: [],
  })
  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const blockIndex = BLOCKS.findIndex(b => b.steps.includes(step))

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  function isValid(): boolean {
    switch (step) {
      case 1:  return data.prenom.trim().length > 0 && data.nom.trim().length > 0
      case 2:  return data.domaine.length > 0
      case 3:  return data.experience.length > 0
      case 4:  return true   // optionnel
      case 5:  return data.mots.every(m => m.trim().length > 0)
      case 6:  return data.environnement.length > 0
      case 7:  return true   // optionnel
      case 8:  return true   // optionnel
      case 9:  return true   // optionnel
      case 10: return true   // optionnel
      case 11: return data.typePoste.length > 0
      case 12: return data.lieu.length > 0
      case 13: return true   // optionnel
      case 14: return data.disponibilite.length > 0
      case 15: return true   // optionnel
      case 16: return true   // optionnel
      case 17: return true   // optionnel
      default: return false
    }
  }

  async function handleNext() {
    if (step < TOTAL) {
      setStep(s => s + 1)
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Utilisateur non connecté')
      const { error } = await supabase.from('profils').upsert({
        user_id: user.id,
        type_compte: 'candidat',
        prenom: data.prenom,
        nom: data.nom,
        domaine: data.domaine,
        experience: data.experience,
        signature: data.parcours,
        qualites: data.mots,
        mode_travail: [data.environnement],
        valeur: data.defi,
        projet_phare: data.projet,
        passions: data.passions,
        side_project: data.sideProject || null,
        type_poste: data.typePoste ? [data.typePoste] : [],
        structure: data.lieu,
        ville: data.ville || null,
        priorites: data.priorite,
        disponibilite: data.disponibilite,
        dispo_date: data.disponibilite === 'a_partir_de' ? data.dispo_date || null : null,
        experiences: data.experiences,
        diplomes: data.diplomes,
        competences_acquises: data.competences_acquises,
        langues: data.langues,
        onboarding_completed: true,
      }, { onConflict: 'user_id' })
      if (error) throw error
      setShowFinal(true)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Une erreur est survenue')
      setSaving(false)
    }
  }

  function handleBack() {
    if (step > 1) setStep(s => s - 1)
  }

  function handleSkip() {
    if (step < TOTAL) setStep(s => s + 1)
    else handleNext()
  }

  function renderStep() {
    switch (step) {
      case 1:
        return (
          <>
            <QuestionLabel num={step} text="Comment vous appelez-vous ?" sub={MICRO_TEXTS[step]} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <StyledInput value={data.prenom} onChange={v => set('prenom', v)} placeholder="Prénom" autoFocus />
              <StyledInput value={data.nom}    onChange={v => set('nom', v)}    placeholder="Nom" />
            </div>
          </>
        )

      case 2:
        return (
          <>
            <QuestionLabel num={step} text="Dans quel domaine exercez-vous ?" sub={MICRO_TEXTS[step]} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {DOMAINES.map(d => (
                <button key={d} onClick={() => set('domaine', d)} style={{
                  padding: '10px 18px', borderRadius: '24px',
                  border: `2px solid ${data.domaine === d ? C.terracotta : C.sable}`,
                  backgroundColor: data.domaine === d ? 'rgba(196,103,58,0.08)' : C.white,
                  color: data.domaine === d ? C.terracotta : C.dark,
                  fontSize: '14px', fontWeight: data.domaine === d ? '600' : '400',
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                }}>
                  {d}
                </button>
              ))}
            </div>
          </>
        )

      case 3:
        return (
          <>
            <QuestionLabel num={step} text="Où en êtes-vous dans votre parcours ?" sub={MICRO_TEXTS[step]} />
            {EXPERIENCES.map(e => (
              <ChoiceCard key={e.key} label={e.key} desc={e.desc}
                selected={data.experience === e.key} onClick={() => set('experience', e.key)} />
            ))}
          </>
        )

      case 4:
        return (
          <>
            <QuestionLabel num={step} text="Racontez-nous votre parcours." sub={MICRO_TEXTS[step]} />
            <StyledTextArea
              value={data.parcours}
              onChange={v => set('parcours', v)}
              placeholder="Formations, expériences, reconversions, particularités… Soyez vous-même."
            />
          </>
        )

      case 5:
        return (
          <>
            <QuestionLabel num={step} text="Comment vos proches vous décriraient-ils en trois mots ?" sub={MICRO_TEXTS[step]} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {([0, 1, 2] as const).map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                    backgroundColor: data.mots[i] ? C.terracotta : C.sable,
                    color: data.mots[i] ? 'white' : C.grey,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: '600', transition: 'all 0.2s',
                  }}>
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    value={data.mots[i]}
                    onChange={e => {
                      const next = [...data.mots] as [string, string, string]
                      next[i] = e.target.value
                      set('mots', next)
                    }}
                    placeholder={(['Créatif(ve)', 'Fiable', 'Curieux(se)'])[i]}
                    autoFocus={i === 0}
                    style={{
                      flex: 1, padding: '12px 15px', fontSize: '15px',
                      borderRadius: '12px',
                      border: `2px solid ${data.mots[i] ? C.terracotta : C.sable}`,
                      backgroundColor: C.white, color: C.dark, outline: 'none',
                      fontFamily: 'inherit', transition: 'border-color 0.2s', boxSizing: 'border-box',
                    }}
                  />
                </div>
              ))}
            </div>
          </>
        )

      case 6:
        return (
          <>
            <QuestionLabel num={step} text="Quel environnement de travail vous correspond ?" sub={MICRO_TEXTS[step]} />
            {ENVIRONNEMENTS.map(e => (
              <ChoiceCard key={e.key} label={e.label} desc={e.desc}
                selected={data.environnement === e.key} onClick={() => set('environnement', e.key)} />
            ))}
          </>
        )

      case 7:
        return (
          <>
            <QuestionLabel num={step} text="Face à un défi, quelle est votre première réaction ?" sub={MICRO_TEXTS[step]} />
            {DEFIS.map(d => (
              <ChoiceCard key={d.key} label={d.label} desc={d.desc}
                selected={data.defi === d.key} onClick={() => set('defi', d.key)} />
            ))}
          </>
        )

      case 8:
        return (
          <>
            <QuestionLabel num={step} text="Quel est le projet dont vous êtes le plus fier ?" sub={MICRO_TEXTS[step]} />
            <StyledTextArea
              value={data.projet}
              onChange={v => set('projet', v)}
              placeholder="Un projet perso, pro, associatif… Qu'est-ce qui l'a rendu spécial ?"
            />
          </>
        )

      case 9:
        return (
          <>
            <QuestionLabel num={step} text="Quelles sont vos passions en dehors du travail ?" sub={MICRO_TEXTS[step]} />
            <TagInput
              tags={data.passions}
              onAddTag={tag => set('passions', [...data.passions, tag])}
              onRemoveTag={tag => set('passions', data.passions.filter(t => t !== tag))}
              maxTags={10}
              placeholder="Sport, musique, voyages… Tapez et appuyez sur Entrée"
              countLabel="passions"
            />
          </>
        )

      case 10:
        return (
          <>
            <QuestionLabel num={step} text="Avez-vous des projets personnels ou créatifs ?" sub={MICRO_TEXTS[step]} />
            <StyledTextArea
              value={data.sideProject}
              onChange={v => set('sideProject', v)}
              placeholder="Side-project, blog, association, app, œuvre… ou simplement « pas pour l'instant »."
              rows={4}
            />
          </>
        )

      case 11:
        return (
          <>
            <QuestionLabel num={step} text="Quel type de contrat recherchez-vous ?" sub={MICRO_TEXTS[step]} />
            {TYPES_POSTE.map(t => (
              <ChoiceCard key={t.key} label={t.label}
                selected={data.typePoste === t.key} onClick={() => set('typePoste', t.key)} />
            ))}
          </>
        )

      case 12:
        return (
          <>
            <QuestionLabel num={step} text="Où souhaitez-vous travailler ?" sub={MICRO_TEXTS[step]} />
            {LIEUX.map(l => (
              <ChoiceCard key={l.key} label={l.label} desc={l.desc}
                selected={data.lieu === l.key} onClick={() => set('lieu', l.key)} />
            ))}
            <StyledInput
              value={data.ville}
              onChange={v => set('ville', v)}
              placeholder="Votre ville / région / zone géographique"
            />
          </>
        )

      case 13: {
        const maxReached = data.priorite.length >= 3
        return (
          <>
            <QuestionLabel num={step} text="Qu'est-ce qui compte le plus dans votre prochain poste ?" sub={MICRO_TEXTS[step]} />
            <p style={{ fontSize: '14px', color: C.grey, marginBottom: '20px', marginTop: '-14px' }}>
              Choisissez jusqu'à 3 priorités.{' '}
              {maxReached && <span style={{ color: C.terracotta, fontWeight: '500' }}>Maximum atteint.</span>}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {PRIORITES.map(p => {
                const selected = data.priorite.includes(p)
                const disabled = !selected && maxReached
                return (
                  <button key={p} onClick={() => {
                    if (selected) set('priorite', data.priorite.filter(x => x !== p))
                    else if (!maxReached) set('priorite', [...data.priorite, p])
                  }} style={{
                    padding: '10px 18px', borderRadius: '24px',
                    border: `2px solid ${selected ? C.terracotta : C.sable}`,
                    backgroundColor: selected ? 'rgba(196,103,58,0.09)' : C.white,
                    color: selected ? C.terracotta : C.dark,
                    fontSize: '14px', fontWeight: selected ? '600' : '400',
                    cursor: disabled ? 'default' : 'pointer',
                    opacity: disabled ? 0.4 : 1, transition: 'all 0.15s',
                    fontFamily: 'inherit',
                  }}>
                    {selected ? '✓ ' : ''}{p}
                  </button>
                )
              })}
            </div>
          </>
        )
      }

      case 14: {
        const showDate = data.disponibilite === 'a_partir_de'
        return (
          <>
            <QuestionLabel num={step} text="Quelle est votre disponibilité ?" sub={MICRO_TEXTS[step]} />
            {DISPOS.map(d => (
              <ChoiceCard key={d.key} label={d.label} desc={d.desc}
                selected={data.disponibilite === d.key} onClick={() => set('disponibilite', d.key)} />
            ))}
            {showDate && (
              <div style={{ marginTop: 8 }}>
                <input
                  type="date"
                  value={data.dispo_date}
                  onChange={e => set('dispo_date', e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  style={{
                    width: '100%', padding: '13px 16px', fontSize: '16px',
                    borderRadius: '12px', border: `2px solid ${data.dispo_date ? C.terracotta : C.sable}`,
                    backgroundColor: C.white, color: C.dark, outline: 'none',
                    boxSizing: 'border-box', fontFamily: 'inherit',
                  }}
                />
              </div>
            )}
          </>
        )
      }

      case 15: {
        const addExp = () => set('experiences', [
          ...data.experiences,
          { poste: '', entreprise: '', date_debut: '', date_fin: '', en_poste: false, missions: '' },
        ])
        const removeExp = (i: number) =>
          set('experiences', data.experiences.filter((_, idx) => idx !== i))
        const updateExp = (i: number, patch: Partial<Experience>) =>
          set('experiences', data.experiences.map((e, idx) => idx === i ? { ...e, ...patch } : e))
        return (
          <>
            <QuestionLabel num={step} text="Vos expériences professionnelles" sub={MICRO_TEXTS[step]} />
            {data.experiences.map((exp, i) => (
              <div key={i} style={{
                backgroundColor: C.white, borderRadius: 14,
                border: `1px solid ${C.sable}`, padding: '16px', marginBottom: '12px',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <StyledInput value={exp.poste}      onChange={v => updateExp(i, { poste: v })}      placeholder="Intitulé du poste" />
                  <StyledInput value={exp.entreprise} onChange={v => updateExp(i, { entreprise: v })} placeholder="Entreprise" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                  <StyledInput value={exp.date_debut} onChange={v => updateExp(i, { date_debut: v })} placeholder="Début (ex : Jan 2021)" />
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {!exp.en_poste && (
                      <div style={{ flex: 1 }}>
                        <StyledInput value={exp.date_fin} onChange={v => updateExp(i, { date_fin: v })} placeholder="Fin (ex : Déc 2023)" />
                      </div>
                    )}
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      fontSize: '13px', color: C.grey, cursor: 'pointer',
                      flexShrink: 0, fontFamily: 'inherit', whiteSpace: 'nowrap',
                    }}>
                      <input type="checkbox" checked={exp.en_poste}
                        onChange={e => updateExp(i, { en_poste: e.target.checked })} />
                      En poste
                    </label>
                  </div>
                </div>
                <StyledTextArea value={exp.missions} onChange={v => updateExp(i, { missions: v })}
                  placeholder="Missions principales (une par ligne)…" rows={3} />
                <button onClick={() => removeExp(i)} style={{
                  marginTop: '10px', background: 'none', border: 'none',
                  color: '#C0392B', fontSize: '13px', cursor: 'pointer',
                  padding: 0, fontFamily: 'inherit',
                }}>
                  ✕ Supprimer cette expérience
                </button>
              </div>
            ))}
            <button onClick={addExp} style={{
              width: '100%', padding: '13px', borderRadius: 12,
              border: `2px dashed ${C.sable}`, backgroundColor: 'transparent',
              color: C.grey, fontSize: '14px', cursor: 'pointer',
              fontFamily: 'inherit', transition: 'border-color 0.2s',
            }}>
              + Ajouter une expérience
            </button>
          </>
        )
      }

      case 16: {
        const addDiplome = () => set('diplomes', [
          ...data.diplomes,
          { intitule: '', ecole: '', annee: '', mention: '' },
        ])
        const removeDiplome = (i: number) =>
          set('diplomes', data.diplomes.filter((_, idx) => idx !== i))
        const updateDiplome = (i: number, patch: Partial<Diplome>) =>
          set('diplomes', data.diplomes.map((d, idx) => idx === i ? { ...d, ...patch } : d))
        return (
          <>
            <QuestionLabel num={step} text="Vos diplômes et formations" sub={MICRO_TEXTS[step]} />
            {data.diplomes.map((d, i) => (
              <div key={i} style={{
                backgroundColor: C.white, borderRadius: 14,
                border: `1px solid ${C.sable}`, padding: '16px', marginBottom: '12px',
              }}>
                <div style={{ marginBottom: '10px' }}>
                  <StyledInput value={d.intitule} onChange={v => updateDiplome(i, { intitule: v })}
                    placeholder="Intitulé du diplôme (ex : Master Marketing)" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <StyledInput value={d.ecole} onChange={v => updateDiplome(i, { ecole: v })} placeholder="École / Établissement" />
                  <StyledInput value={d.annee} onChange={v => updateDiplome(i, { annee: v })} placeholder="Année (ex : 2020)" />
                </div>
                <StyledInput value={d.mention} onChange={v => updateDiplome(i, { mention: v })}
                  placeholder="Mention (optionnel : Bien, Très Bien…)" />
                <button onClick={() => removeDiplome(i)} style={{
                  marginTop: '10px', background: 'none', border: 'none',
                  color: '#C0392B', fontSize: '13px', cursor: 'pointer',
                  padding: 0, fontFamily: 'inherit',
                }}>
                  ✕ Supprimer ce diplôme
                </button>
              </div>
            ))}
            <button onClick={addDiplome} style={{
              width: '100%', padding: '13px', borderRadius: 12,
              border: `2px dashed ${C.sable}`, backgroundColor: 'transparent',
              color: C.grey, fontSize: '14px', cursor: 'pointer',
              fontFamily: 'inherit', transition: 'border-color 0.2s',
            }}>
              + Ajouter un diplôme
            </button>
          </>
        )
      }

      case 17:
        return (
          <>
            <QuestionLabel num={step} text="Compétences et langues" sub={MICRO_TEXTS[step]} />

            <p style={{ fontSize: '12px', fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              Compétences techniques &amp; outils
            </p>
            <TagInput
              tags={data.competences_acquises}
              onAddTag={tag => set('competences_acquises', [...data.competences_acquises, tag])}
              onRemoveTag={tag => set('competences_acquises', data.competences_acquises.filter(t => t !== tag))}
              maxTags={15}
              placeholder="React, Excel, Figma… Tapez et appuyez sur Entrée"
            />

            <div style={{ height: 28 }} />

            <p style={{ fontSize: '12px', fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
              Langues parlées
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {LANGUES_LIST.map(({ key, flag }) => {
                const selected = data.langues.some(l => l.startsWith(key + ' — '))
                return (
                  <button key={key} onClick={() => {
                    if (selected) set('langues', data.langues.filter(l => !l.startsWith(key + ' — ')))
                    else set('langues', [...data.langues, `${key} — Natif`])
                  }} style={{
                    padding: '8px 16px', borderRadius: '24px', fontFamily: 'inherit',
                    border: `2px solid ${selected ? C.terracotta : C.sable}`,
                    backgroundColor: selected ? 'rgba(196,103,58,0.08)' : C.white,
                    color: selected ? C.terracotta : C.dark,
                    fontSize: '14px', fontWeight: selected ? '600' : '400',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                    {flag} {key}
                  </button>
                )
              })}
            </div>

            {data.langues.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.langues.map(entry => {
                  const sepIdx   = entry.indexOf(' — ')
                  const langName = sepIdx >= 0 ? entry.slice(0, sepIdx) : entry
                  const niveau   = sepIdx >= 0 ? entry.slice(sepIdx + 3) : 'Natif'
                  const flag     = LANGUES_LIST.find(l => l.key === langName)?.flag ?? '🌐'
                  return (
                    <div key={langName} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      backgroundColor: C.white, borderRadius: 12,
                      border: `1px solid ${C.sable}`, padding: '10px 14px',
                    }}>
                      <span style={{ fontSize: '18px', flexShrink: 0 }}>{flag}</span>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: C.dark, flex: 1 }}>{langName}</span>
                      <select
                        value={niveau}
                        onChange={e => set('langues', data.langues.map(l =>
                          l.startsWith(langName + ' — ') ? `${langName} — ${e.target.value}` : l
                        ))}
                        style={{
                          padding: '6px 10px', borderRadius: '8px', fontFamily: 'inherit',
                          border: `1px solid ${C.sable}`, backgroundColor: C.creme,
                          color: C.dark, fontSize: '13px', cursor: 'pointer', outline: 'none',
                        }}
                      >
                        {NIVEAUX_LANGUE.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )

      default:
        return null
    }
  }

  // Écrans hors parcours
  if (showWelcome) return <WelcomeScreen onStart={() => setShowWelcome(false)} />
  if (showFinal)   return <FinalScreen   onGoToProfile={() => router.push('/profil')} />

  const isOpt    = OPTIONAL_STEPS.has(step)
  const skipLabel = LONG_OPTIONAL.has(step) ? 'Passer, je compléterai plus tard' : 'Passer'
  const transition = TRANSITIONS[step]

  return (
    <main style={{ backgroundColor: C.creme, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <style suppressHydrationWarning>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Header */}
      <header style={{
        padding: '22px clamp(20px, 5%, 48px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: '20px', color: C.dark }}>Kavio</span>
        <span style={{ fontSize: '13px', color: C.grey, fontWeight: '500' }}>
          {step} / {TOTAL}
        </span>
      </header>

      {/* Progression */}
      <div style={{ padding: '0 clamp(20px, 5%, 48px) 28px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          {BLOCKS.map((b, i) => {
            const isCurrent = i === blockIndex
            const isPast    = i < blockIndex
            return (
              <span key={b.label} style={{
                fontSize: '12px', padding: '4px 12px', borderRadius: '20px',
                backgroundColor: isCurrent ? C.terracotta : isPast ? 'rgba(196,103,58,0.12)' : 'transparent',
                border: `1px solid ${isCurrent || isPast ? C.terracotta : C.sable}`,
                color: isCurrent ? 'white' : isPast ? C.terracotta : C.grey,
                fontWeight: isCurrent ? '500' : '400',
                transition: 'all 0.3s',
              }}>
                {b.label}
              </span>
            )
          })}
        </div>
        <div style={{ height: '3px', backgroundColor: C.sable, borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${(step / TOTAL) * 100}%`,
            backgroundColor: C.terracotta, borderRadius: '2px', transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Question */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '12px clamp(20px, 5%, 48px) 32px', overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: '560px' }}>
          {/* Texte de transition — 1ère étape de chaque nouveau bloc */}
          {transition && (
            <p style={{
              fontSize: '14px', color: C.grey, fontStyle: 'italic',
              marginBottom: '28px', lineHeight: '1.6',
              paddingLeft: '14px', borderLeft: `2px solid ${C.sable}`,
            }}>
              {transition}
            </p>
          )}
          {renderStep()}
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        padding: '18px clamp(20px, 5%, 48px)',
        borderTop: `1px solid ${C.sable}`,
        backgroundColor: C.creme,
      }}>
        {saveError && (
          <p style={{ color: '#C0392B', fontSize: '14px', marginBottom: '12px', textAlign: 'center', fontWeight: '500' }}>
            {saveError}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Retour */}
          <button onClick={handleBack} disabled={step === 1 || saving} style={{
            background: 'none', border: 'none', padding: '10px 0', fontSize: '14px',
            color: step === 1 || saving ? 'transparent' : C.grey,
            cursor: step === 1 || saving ? 'default' : 'pointer', transition: 'color 0.2s',
          }}>
            ← Retour
          </button>

          {/* Passer + Suivant/Terminer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {isOpt && !saving && (
              <button onClick={handleSkip} style={{
                background: 'none', border: 'none', padding: '10px 0',
                fontSize: '13px', color: C.grey, cursor: 'pointer',
                fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: '3px',
              }}>
                {skipLabel}
              </button>
            )}
            <button onClick={handleNext} disabled={!isValid() || saving} style={{
              backgroundColor: isValid() && !saving ? C.terracotta : C.sable,
              color: isValid() && !saving ? 'white' : C.grey,
              border: 'none', borderRadius: '14px',
              padding: '12px 28px', fontSize: '15px', fontWeight: '500',
              cursor: isValid() && !saving ? 'pointer' : 'default',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: '8px',
              fontFamily: 'inherit',
            }}>
              {saving ? (
                <>
                  <span style={{
                    width: '16px', height: '16px', borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white',
                    display: 'inline-block', animation: 'spin 0.7s linear infinite',
                  }} />
                  Enregistrement…
                </>
              ) : step === TOTAL ? 'Terminer →' : 'Suivant →'}
            </button>
          </div>
        </div>
      </footer>
    </main>
  )
}
