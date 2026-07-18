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
  passions: string
  sideProject: string
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

const TOTAL = 16

const BLOCKS = [
  { label: 'Identité & Parcours', steps: [1, 2, 3, 4] },
  { label: 'Personnalité & Soft skills', steps: [5, 6, 7] },
  { label: 'Projets & Hobbies', steps: [8, 9, 10] },
  { label: 'Cap & Préférences', steps: [11, 12, 13] },
  { label: 'Parcours professionnel', steps: [14, 15, 16] },
]

const DOMAINES = [
  'Tech & Ingénierie', 'Design & Créativité', 'Marketing & Com',
  'Finance & Compta', 'RH & Recrutement', 'Commerce & Vente',
  'Opérations & Logistique', 'Conseil & Stratégie', 'Autre',
]

const EXPERIENCES = [
  { key: '< 2 ans', desc: 'Débuts prometteurs' },
  { key: '2–5 ans', desc: 'Vous avez vos marques' },
  { key: '5–10 ans', desc: "Confirmé(e), vous avancez avec confiance" },
  { key: '10+ ans', desc: 'Expert(e) reconnu(e)' },
]

const ENVIRONNEMENTS = [
  { key: 'startup', label: 'Startup agile', desc: 'Rythme rapide, polyvalence' },
  { key: 'scaleup', label: 'Scale-up', desc: 'Croissance forte, structuration en cours' },
  { key: 'corporate', label: 'Grand groupe', desc: 'Structure, expertise, ressources' },
  { key: 'indep', label: 'Indépendant(e)', desc: 'Autonomie totale, projets variés' },
]

const DEFIS = [
  { key: 'analyse', label: "J'analyse avant d'agir", desc: 'Comprendre pour mieux décider' },
  { key: 'action', label: "Je teste et j'ajuste", desc: 'Apprendre en faisant' },
  { key: 'collab', label: "Je consulte l'équipe", desc: 'La force du collectif' },
  { key: 'creativ', label: "L'angle inattendu", desc: "L'originalité comme levier" },
]

const TYPES_POSTE = [
  { key: 'cdi', label: 'CDI' },
  { key: 'cdd', label: 'CDD' },
  { key: 'freelance', label: 'Freelance / Mission' },
  { key: 'alternance', label: 'Alternance / Stage' },
  { key: 'ouvert', label: 'Ouvert(e) à tout' },
]

const LIEUX = [
  { key: 'remote', label: '100% Remote', desc: 'Depuis partout dans le monde' },
  { key: 'hybride', label: 'Hybride', desc: 'Présence & flexibilité' },
  { key: 'presentiel', label: 'Présentiel', desc: 'Je préfère le bureau' },
  { key: 'flexible', label: 'Flexible', desc: 'La mission prime sur le lieu' },
]

const PRIORITES = [
  'Impact réel', 'Équipe soudée', 'Salaire compétitif',
  'Évolution rapide', 'Sens & mission', 'Flexibilité horaire',
  'Apprentissage continu', 'Autonomie', 'Stabilité',
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
  sable: '#E8D5B7',
  creme: '#F7F2EB',
  vert: '#2C4A3E',
  dark: '#1A1A1A',
  grey: '#6B6B6B',
  white: '#FFFFFF',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function QuestionLabel({ num, text }: { num: number; text: string }) {
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
        color: C.dark,
        lineHeight: '1.3',
        marginBottom: '28px',
        fontWeight: 'normal',
      }}>
        {text}
      </h2>
    </>
  )
}

function ChoiceCard({
  label, desc, selected, onClick,
}: {
  label: string; desc?: string; selected: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '15px 18px',
        borderRadius: '14px',
        border: `2px solid ${selected ? C.terracotta : C.sable}`,
        backgroundColor: selected ? 'rgba(196,103,58,0.07)' : C.white,
        cursor: 'pointer',
        transition: 'all 0.15s',
        marginBottom: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
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

function StyledInput({
  value, onChange, placeholder, autoFocus,
}: {
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

function StyledTextArea({
  value, onChange, placeholder, rows = 5,
}: {
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


function TagInput({
  tags, onAddTag, onRemoveTag, maxTags = 15, placeholder,
}: {
  tags: string[]; onAddTag: (tag: string) => void; onRemoveTag: (tag: string) => void
  maxTags?: number; placeholder?: string
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
        {tags.length} / {maxTags} compétences
      </p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<FormData>({
    prenom: '', nom: '', domaine: '', experience: '', parcours: '',
    mots: ['', '', ''],
    environnement: '', defi: '', projet: '', passions: '',
    sideProject: '', typePoste: '', lieu: '', ville: '', priorite: [],
    experiences: [], diplomes: [], competences_acquises: [], langues: [],
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const blockIndex = BLOCKS.findIndex(b => b.steps.includes(step))

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  function isValid(): boolean {
    switch (step) {
      case 1: return data.prenom.trim().length > 0 && data.nom.trim().length > 0
      case 2: return data.domaine.length > 0
      case 3: return data.experience.length > 0
      case 4: return data.parcours.trim().length > 5
      case 5: return data.mots.every(m => m.trim().length > 0)
      case 6: return data.environnement.length > 0
      case 7: return data.defi.length > 0
      case 8: return data.projet.trim().length > 5
      case 9: return data.passions.trim().length > 0
      case 10: return data.sideProject.trim().length > 0
      case 11: return data.typePoste.length > 0
      case 12: return data.lieu.length > 0
      case 13: return data.priorite.length > 0
      case 14: return true
      case 15: return true
      case 16: return data.langues.length > 0
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
      console.log('user:', user)
      if (!user) throw new Error('Utilisateur non connecté')
      const { error, data: upsertData } = await supabase.from('profils').upsert({
        user_id: user.id,
        type_compte: 'candidat',
        prenom: data.prenom,
        nom: data.nom,
        domaine: data.domaine,
        experience: data.experience,
        signature: data.parcours,
        qualites: Array.isArray(data.mots) ? data.mots : [data.mots],
        mode_travail: Array.isArray(data.environnement) ? data.environnement : [data.environnement],
        valeur: data.defi,
        projet_phare: data.projet,
        passions: Array.isArray(data.passions) ? data.passions : data.passions.split(',').map(s => s.trim()).filter(Boolean),
        type_poste: data.typePoste ? [data.typePoste] : [],
        structure: data.lieu,
        ville: data.ville || null,
        disponibilite: 'maintenant',
        experiences: data.experiences,
        diplomes: data.diplomes,
        competences_acquises: data.competences_acquises,
        langues: data.langues,
      }, { onConflict: 'user_id' })
      console.log('error:', error)
      console.log('data:', upsertData)
      if (error) throw error
      router.push('/profil')
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Une erreur est survenue')
      setSaving(false)
    }
  }

  function handleBack() {
    if (step > 1) setStep(s => s - 1)
  }

  function renderStep() {
    switch (step) {
      case 1:
        return (
          <>
            <QuestionLabel num={1} text="Comment vous appelez-vous ?" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <StyledInput
                value={data.prenom}
                onChange={v => set('prenom', v)}
                placeholder="Prénom"
                autoFocus
              />
              <StyledInput
                value={data.nom}
                onChange={v => set('nom', v)}
                placeholder="Nom"
              />
            </div>
          </>
        )

      case 2:
        return (
          <>
            <QuestionLabel num={2} text="Dans quel domaine évoluez-vous ?" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {DOMAINES.map(d => (
                <button
                  key={d}
                  onClick={() => set('domaine', d)}
                  style={{
                    padding: '10px 18px', borderRadius: '24px',
                    border: `2px solid ${data.domaine === d ? C.terracotta : C.sable}`,
                    backgroundColor: data.domaine === d ? 'rgba(196,103,58,0.08)' : C.white,
                    color: data.domaine === d ? C.terracotta : C.dark,
                    fontSize: '14px', fontWeight: data.domaine === d ? '600' : '400',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </>
        )

      case 3:
        return (
          <>
            <QuestionLabel num={3} text="Où en êtes-vous dans votre parcours professionnel ?" />
            {EXPERIENCES.map(e => (
              <ChoiceCard
                key={e.key}
                label={e.key}
                desc={e.desc}
                selected={data.experience === e.key}
                onClick={() => set('experience', e.key)}
              />
            ))}
          </>
        )

      case 4:
        return (
          <>
            <QuestionLabel num={4} text="Racontez-nous votre parcours en quelques mots." />
            <StyledTextArea
              value={data.parcours}
              onChange={v => set('parcours', v)}
              placeholder="Formations, expériences, reconversions, particularités… Soyez vous-même."
            />
            <p style={{ fontSize: '13px', color: C.grey, marginTop: '10px' }}>
              Pas de format imposé — écrivez comme vous parlez.
            </p>
          </>
        )

      case 5:
        return (
          <>
            <QuestionLabel num={5} text="En trois mots, comment vos proches vous décriraient-ils ?" />
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
                      fontFamily: 'inherit', transition: 'border-color 0.2s',
                      boxSizing: 'border-box',
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
            <QuestionLabel num={6} text="Quel type d'environnement de travail vous correspond le mieux ?" />
            {ENVIRONNEMENTS.map(e => (
              <ChoiceCard
                key={e.key}
                label={e.label}
                desc={e.desc}
                selected={data.environnement === e.key}
                onClick={() => set('environnement', e.key)}
              />
            ))}
          </>
        )

      case 7:
        return (
          <>
            <QuestionLabel num={7} text="Face à un défi complexe, quelle est votre première réaction ?" />
            {DEFIS.map(d => (
              <ChoiceCard
                key={d.key}
                label={d.label}
                desc={d.desc}
                selected={data.defi === d.key}
                onClick={() => set('defi', d.key)}
              />
            ))}
          </>
        )

      case 8:
        return (
          <>
            <QuestionLabel num={8} text="Décrivez-nous un projet dont vous êtes particulièrement fier(e)." />
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
            <QuestionLabel num={9} text="Quelles sont vos passions en dehors du travail ?" />
            <StyledTextArea
              value={data.passions}
              onChange={v => set('passions', v)}
              placeholder="Sport, musique, voyages, jeux, lecture, cuisine… Tout ce qui vous fait vibrer."
              rows={4}
            />
            <p style={{ fontSize: '13px', color: C.grey, marginTop: '10px' }}>
              Les recruteurs Kavio regardent aussi qui vous êtes en dehors du bureau.
            </p>
          </>
        )

      case 10:
        return (
          <>
            <QuestionLabel num={10} text="Avez-vous des projets personnels ou créatifs ?" />
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
            <QuestionLabel num={11} text="Quel type de contrat recherchez-vous ?" />
            {TYPES_POSTE.map(t => (
              <ChoiceCard
                key={t.key}
                label={t.label}
                selected={data.typePoste === t.key}
                onClick={() => set('typePoste', t.key)}
              />
            ))}
          </>
        )

      case 12:
        return (
          <>
            <QuestionLabel num={12} text="Où souhaitez-vous travailler ?" />
            {LIEUX.map(l => (
              <ChoiceCard
                key={l.key}
                label={l.label}
                desc={l.desc}
                selected={data.lieu === l.key}
                onClick={() => set('lieu', l.key)}
              />
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
            <QuestionLabel num={13} text="Qu'est-ce qui compte le plus dans votre prochain poste ?" />
            <p style={{ fontSize: '14px', color: C.grey, marginBottom: '20px', marginTop: '-14px' }}>
              Choisissez jusqu'à 3 priorités.{' '}
              {maxReached && (
                <span style={{ color: C.terracotta, fontWeight: '500' }}>Maximum atteint.</span>
              )}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {PRIORITES.map(p => {
                const selected = data.priorite.includes(p)
                const disabled = !selected && maxReached
                return (
                  <button
                    key={p}
                    onClick={() => {
                      if (selected) {
                        set('priorite', data.priorite.filter(x => x !== p))
                      } else if (!maxReached) {
                        set('priorite', [...data.priorite, p])
                      }
                    }}
                    style={{
                      padding: '10px 18px', borderRadius: '24px',
                      border: `2px solid ${selected ? C.terracotta : C.sable}`,
                      backgroundColor: selected ? 'rgba(196,103,58,0.09)' : C.white,
                      color: selected ? C.terracotta : C.dark,
                      fontSize: '14px', fontWeight: selected ? '600' : '400',
                      cursor: disabled ? 'default' : 'pointer',
                      opacity: disabled ? 0.4 : 1,
                      transition: 'all 0.15s',
                    }}
                  >
                    {selected ? '✓ ' : ''}{p}
                  </button>
                )
              })}
            </div>
          </>
        )
      }

      case 14: {
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
            <QuestionLabel num={14} text="Vos expériences professionnelles" />
            <p style={{ fontSize: '13px', color: C.grey, marginBottom: '20px', marginTop: '-14px' }}>
              Ajoutez vos postes. Vous pouvez passer cette étape si vous débutez.
            </p>
            {data.experiences.map((exp, i) => (
              <div key={i} style={{
                backgroundColor: C.white, borderRadius: 14,
                border: `1px solid ${C.sable}`, padding: '16px', marginBottom: '12px',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <StyledInput value={exp.poste} onChange={v => updateExp(i, { poste: v })} placeholder="Intitulé du poste" />
                  <StyledInput value={exp.entreprise} onChange={v => updateExp(i, { entreprise: v })} placeholder="Entreprise" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                  <StyledInput value={exp.date_debut} onChange={v => updateExp(i, { date_debut: v })} placeholder="Début (ex: Jan 2021)" />
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {!exp.en_poste && (
                      <div style={{ flex: 1 }}>
                        <StyledInput value={exp.date_fin} onChange={v => updateExp(i, { date_fin: v })} placeholder="Fin (ex: Déc 2023)" />
                      </div>
                    )}
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      fontSize: '13px', color: C.grey, cursor: 'pointer',
                      flexShrink: 0, fontFamily: 'inherit', whiteSpace: 'nowrap',
                    }}>
                      <input
                        type="checkbox"
                        checked={exp.en_poste}
                        onChange={e => updateExp(i, { en_poste: e.target.checked })}
                      />
                      En poste
                    </label>
                  </div>
                </div>
                <StyledTextArea
                  value={exp.missions}
                  onChange={v => updateExp(i, { missions: v })}
                  placeholder="Missions principales (une par ligne)…"
                  rows={3}
                />
                <button
                  onClick={() => removeExp(i)}
                  style={{
                    marginTop: '10px', background: 'none', border: 'none',
                    color: '#C0392B', fontSize: '13px', cursor: 'pointer',
                    padding: 0, fontFamily: 'inherit',
                  }}
                >
                  ✕ Supprimer cette expérience
                </button>
              </div>
            ))}
            <button
              onClick={addExp}
              style={{
                width: '100%', padding: '13px', borderRadius: 12,
                border: `2px dashed ${C.sable}`, backgroundColor: 'transparent',
                color: C.grey, fontSize: '14px', cursor: 'pointer',
                fontFamily: 'inherit', transition: 'border-color 0.2s',
              }}
            >
              + Ajouter une expérience
            </button>
          </>
        )
      }

      case 15: {
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
            <QuestionLabel num={15} text="Vos diplômes & formations" />
            <p style={{ fontSize: '13px', color: C.grey, marginBottom: '20px', marginTop: '-14px' }}>
              Du plus récent au plus ancien. Vous pouvez passer cette étape.
            </p>
            {data.diplomes.map((d, i) => (
              <div key={i} style={{
                backgroundColor: C.white, borderRadius: 14,
                border: `1px solid ${C.sable}`, padding: '16px', marginBottom: '12px',
              }}>
                <div style={{ marginBottom: '10px' }}>
                  <StyledInput value={d.intitule} onChange={v => updateDiplome(i, { intitule: v })} placeholder="Intitulé du diplôme (ex: Master Marketing)" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <StyledInput value={d.ecole} onChange={v => updateDiplome(i, { ecole: v })} placeholder="École / Établissement" />
                  <StyledInput value={d.annee} onChange={v => updateDiplome(i, { annee: v })} placeholder="Année (ex: 2020)" />
                </div>
                <StyledInput value={d.mention} onChange={v => updateDiplome(i, { mention: v })} placeholder="Mention (optionnel : Bien, Très Bien…)" />
                <button
                  onClick={() => removeDiplome(i)}
                  style={{
                    marginTop: '10px', background: 'none', border: 'none',
                    color: '#C0392B', fontSize: '13px', cursor: 'pointer',
                    padding: 0, fontFamily: 'inherit',
                  }}
                >
                  ✕ Supprimer ce diplôme
                </button>
              </div>
            ))}
            <button
              onClick={addDiplome}
              style={{
                width: '100%', padding: '13px', borderRadius: 12,
                border: `2px dashed ${C.sable}`, backgroundColor: 'transparent',
                color: C.grey, fontSize: '14px', cursor: 'pointer',
                fontFamily: 'inherit', transition: 'border-color 0.2s',
              }}
            >
              + Ajouter un diplôme
            </button>
          </>
        )
      }

      case 16:
        return (
          <>
            <QuestionLabel num={16} text="Compétences acquises & Langues" />

            {/* ── Compétences acquises ── */}
            <p style={{ fontSize: '12px', fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              Compétences techniques & outils
            </p>
            <TagInput
              tags={data.competences_acquises}
              onAddTag={tag => set('competences_acquises', [...data.competences_acquises, tag])}
              onRemoveTag={tag => set('competences_acquises', data.competences_acquises.filter(t => t !== tag))}
              maxTags={15}
              placeholder="React, Excel, Figma… Tapez et appuyez sur Entrée"
            />

            <div style={{ height: 28 }} />

            {/* ── Langues ── */}
            <p style={{ fontSize: '12px', fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
              Langues parlées
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {LANGUES_LIST.map(({ key, flag }) => {
                const selected = data.langues.some(l => l.startsWith(key + ' — '))
                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (selected) {
                        set('langues', data.langues.filter(l => !l.startsWith(key + ' — ')))
                      } else {
                        set('langues', [...data.langues, `${key} — Natif`])
                      }
                    }}
                    style={{
                      padding: '8px 16px', borderRadius: '24px', fontFamily: 'inherit',
                      border: `2px solid ${selected ? C.terracotta : C.sable}`,
                      backgroundColor: selected ? 'rgba(196,103,58,0.08)' : C.white,
                      color: selected ? C.terracotta : C.dark,
                      fontSize: '14px', fontWeight: selected ? '600' : '400',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {flag} {key}
                  </button>
                )
              })}
            </div>

            {data.langues.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.langues.map(entry => {
                  const sepIdx = entry.indexOf(' — ')
                  const langName = sepIdx >= 0 ? entry.slice(0, sepIdx) : entry
                  const niveau   = sepIdx >= 0 ? entry.slice(sepIdx + 3) : 'Natif'
                  const flag = LANGUES_LIST.find(l => l.key === langName)?.flag ?? '🌐'
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

  return (
    <main style={{ backgroundColor: C.creme, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{
        padding: '22px clamp(20px, 5%, 48px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '20px', color: C.dark }}>
          Kavio
        </div>
        <span style={{ fontSize: '13px', color: C.grey, fontWeight: '500' }}>
          {step} / {TOTAL}
        </span>
      </header>

      {/* Progress */}
      <div style={{ padding: '0 clamp(20px, 5%, 48px) 28px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          {BLOCKS.map((b, i) => {
            const isCurrent = i === blockIndex
            const isPast = i < blockIndex
            return (
              <span
                key={b.label}
                style={{
                  fontSize: '12px', padding: '4px 12px', borderRadius: '20px',
                  backgroundColor: isCurrent ? C.terracotta : isPast ? 'rgba(196,103,58,0.12)' : 'transparent',
                  border: `1px solid ${isCurrent || isPast ? C.terracotta : C.sable}`,
                  color: isCurrent ? 'white' : isPast ? C.terracotta : C.grey,
                  fontWeight: isCurrent ? '500' : '400',
                  transition: 'all 0.3s',
                }}
              >
                {b.label}
              </span>
            )
          })}
        </div>
        <div style={{ height: '3px', backgroundColor: C.sable, borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${(step / TOTAL) * 100}%`,
            backgroundColor: C.terracotta,
            borderRadius: '2px',
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Question */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '12px clamp(20px, 5%, 48px) 32px', overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: '560px' }}>
          {renderStep()}
        </div>
      </div>

      {/* Navigation */}
      <footer style={{
        padding: '18px clamp(20px, 5%, 48px)',
        borderTop: `1px solid ${C.sable}`,
        backgroundColor: C.creme,
      }}>
        {saveError && (
          <p style={{
            color: '#C0392B', fontSize: '14px', marginBottom: '12px',
            textAlign: 'center', fontWeight: '500',
          }}>
            {saveError}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={handleBack}
            disabled={step === 1 || saving}
            style={{
              background: 'none', border: 'none',
              padding: '10px 0', fontSize: '14px',
              color: step === 1 || saving ? 'transparent' : C.grey,
              cursor: step === 1 || saving ? 'default' : 'pointer',
              transition: 'color 0.2s',
            }}
          >
            ← Retour
          </button>

          <button
            onClick={handleNext}
            disabled={!isValid() || saving}
            style={{
              backgroundColor: isValid() && !saving ? C.terracotta : C.sable,
              color: isValid() && !saving ? 'white' : C.grey,
              border: 'none', borderRadius: '14px',
              padding: '12px 28px', fontSize: '15px', fontWeight: '500',
              cursor: isValid() && !saving ? 'pointer' : 'default',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}
          >
            {saving ? (
              <>
                <span style={{
                  width: '16px', height: '16px', borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: 'white',
                  display: 'inline-block',
                  animation: 'spin 0.7s linear infinite',
                }} />
                Enregistrement…
              </>
            ) : (
              step === TOTAL ? 'Terminer →' : 'Suivant →'
            )}
          </button>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </footer>

    </main>
  )
}
