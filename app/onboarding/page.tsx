'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FONT_SANS } from '@/lib/typography'
import LogoKapolia from '@/components/LogoKapolia'
import InvitationModal from '@/components/InvitationModal'
import {
  ONBOARDING_TOTAL as TOTAL,
  LAST_STEP,
  DOMAINES,
  EXPERIENCES,
  TYPES_POSTE,
  displayStepNum,
  firstIncompleteStep,
  buildStepPayload,
  resumeStepFrom,
} from '@/lib/onboarding-utils'
import type { Experience, Diplome, OnboardingFormData as FormData } from '@/lib/onboarding-utils'
import {
  SITUATIONS,
  CURRENT_VERSION,
  QUALITE_LABELS,
  calculerQualites,
} from '@/lib/test-qualites'
import type { TestAnswer } from '@/lib/test-qualites'
import MissionsTextArea from '@/components/MissionsTextArea'
import SignatureCounter from '@/components/SignatureCounter'
import { MAX_SIGNATURE, MAX_PROJET_TITRE, MAX_PROJET_DESC } from '@/lib/constants'
import { COMP_REF, PREFERENCES_TELETRAVAIL } from '@/lib/referentiels'
import { C } from '@/lib/colors'

// ─── Post-signup redirect ─────────────────────────────────────────────────────

const NEXT_KEY = 'kapolia_post_signup_next'
const NEXT_TTL = 2 * 60 * 60 * 1000 // 2 hours

function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null
  return raw
}

function readPostSignupNext(): string | null {
  try {
    const raw = localStorage.getItem(NEXT_KEY)
    if (!raw) return null
    localStorage.removeItem(NEXT_KEY)
    const { url, ts } = JSON.parse(raw) as { url: string; ts: number }
    if (Date.now() - ts > NEXT_TTL) return null
    return safeNext(url)
  } catch { return null }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BLOCKS = [
  { label: 'Identité & Parcours',       steps: [1, 2, 3, 4] },
  { label: 'Personnalité & Soft skills', steps: [5] },
  { label: 'Projets & Hobbies',          steps: [7, 8] },
  { label: 'Cap & Préférences',           steps: [9, 10, 11, 12] },
  { label: 'Parcours professionnel',      steps: [13, 14, 15] },
]

const OPTIONAL_STEPS = new Set([4, 7, 8, 11, 13, 14, 15])
const LONG_OPTIONAL  = new Set([13, 14, 15])

const TRANSITIONS: Record<number, string> = {
  5:  'Voyons à présent ce qui vous définit, au-delà de votre parcours.',
  7:  'Parlons de ce que vous avez construit.',
  9:  'Votre profil prend forme. Précisons ce que vous recherchez.',
  13: "Presque terminé. Il ne reste qu'à détailler votre parcours professionnel.",
}

const MICRO_TEXTS: Record<number, string> = {
  1:  'Votre prénom et votre nom apparaissent sur votre profil tel que les recruteurs le verront.',
  2:  'Votre domaine oriente les offres que nous vous proposons, et aide les recruteurs de votre secteur à vous repérer.',
  3:  "Votre niveau d'expérience affine les offres que nous vous présentons, pour rester au plus près de là où vous en êtes.",
  4:  "C'est souvent la première section que lisent les recruteurs. Formations, reconversions, expériences marquantes : racontez votre parcours avec vos mots, sans format imposé.",
  5:  "Neuf situations de travail, quatre réponses chacune. Choisissez les deux qui vous ressemblent le plus.",
  6:  "Startup, grand groupe, indépendant… Votre réponse nous aide à vous présenter des entreprises dont le fonctionnement vous conviendra.",
  7:  "Une réalisation concrète marque plus qu'une liste de compétences. Qu'elle soit professionnelle, personnelle ou associative, racontez celle dont vous êtes fier et ce qu'elle dit de vous.",
  8:  "Sur Kapolia, les recruteurs s'intéressent à qui vous êtes, aussi en dehors du travail. Vos centres d'intérêt créent parfois de vrais points communs.",
  9:  'Cette information nous permet de ne vous présenter que des opportunités correspondant réellement à votre situation.',
  10: 'Votre préférence pour le télétravail. Votre ville est demandée juste en dessous.',
  11: "On s'épanouit dans les entreprises dont les valeurs rejoignent les nôtres. Vos priorités disent aux recruteurs ce que vous cherchez vraiment.",
  12: 'Indiquez où vous en êtes dans votre recherche. Les recruteurs sauront ainsi à quel moment vous pourriez les rejoindre.',
  13: 'Ajoutez les expériences qui comptent vraiment. Ce ne sont pas les plus nombreuses qui parlent le mieux de vous, mais les plus significatives.',
  14: 'Vos diplômes et formations complètent votre profil. Formations académiques, certifications, autoformations : tout ce qui a construit vos compétences a sa place ici.',
  15: "Vos compétences sont ce que vous apportez concrètement. Ajoutez-les, avec les langues que vous maîtrisez, pour que rien de ce que vous savez faire ne passe inaperçu.",
}


const LIEUX = PREFERENCES_TELETRAVAIL

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

// ─── Écran d'accueil ──────────────────────────────────────────────────────────

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const [anim, setAnim] = useState<'idle' | 'hover' | 'spinning'>('idle')

  function handleClick() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onStart()
      return
    }
    setAnim('spinning')
    setTimeout(onStart, 420)
  }

  const needleCls = anim === 'spinning' ? 'kv-needle kv-needle--spin'
                  : anim === 'hover'    ? 'kv-needle kv-needle--hover'
                  :                       'kv-needle'

  return (
    <div style={{
      backgroundColor: '#EFE8DC',
      height: '100vh',
      padding: 14,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      boxSizing: 'border-box',
    }}>
      <style suppressHydrationWarning>{`
        .kv-btn { transition: background-color 0.2s, transform 0.15s; }
        .kv-btn:hover { background-color: #b05832 !important; transform: translateY(-1px); }

        .kv-needle { transform-box: view-box; transform-origin: center; transition: transform 200ms ease; }
        .kv-needle--hover { transform: rotate(8deg); }
        .kv-needle--spin  { animation: kv-spin-needle 420ms cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        @keyframes kv-spin-needle { from { transform: rotate(0deg); } to { transform: rotate(90deg); } }
        @media (prefers-reduced-motion: reduce) {
          .kv-needle { transition: none; }
          .kv-needle--spin { animation: none; }
        }

        @media (max-width: 768px) {
          .kv-grid  { grid-template-columns: 1fr !important; }
          .kv-bloc-a { grid-row: 1 !important; grid-column: 1 !important; }
          .kv-bloc-c { grid-row: 2 !important; grid-column: 1 !important; }
          .kv-bloc-b { grid-row: 3 !important; grid-column: 1 !important; height: 140px !important; min-height: 140px !important; }
          .kv-title  { font-size: 32px !important; }
        }
      `}</style>

      {/* ── Signature ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, flexShrink: 0 }}>
        <LogoKapolia variante="sombre" taille={24} avecTexte={false} />
        <span style={{
          fontFamily: FONT_SANS, letterSpacing: '-0.005em',
          fontWeight: 600,
          fontSize: 14,
          color: C.vert,
          lineHeight: 1,
        }}>
          Kapolia
        </span>
      </div>

      {/* ── Grille 3 blocs ───────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        minHeight: 0,
      }}>
      <div className="kv-grid" style={{
        display: 'grid',
        gridTemplateColumns: '1.6fr 1fr',
        gridTemplateRows: '1fr auto',
        gap: 12,
        width: '100%',
        height: '100%',
        maxHeight: 620,
      }}>

        {/* ── Bloc A — colonne gauche, 2 rangées ─────────────────────────────── */}
        <div className="kv-bloc-a" style={{
          gridRow: '1 / 3',
          gridColumn: 1,
          backgroundColor: C.bg,
          borderRadius: 16,
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}>
          <p style={{
            fontFamily: FONT_SANS,
            fontSize: 12,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: C.orange,
            margin: '0 0 16px',
          }}>
            Trouvez votre cap{' '}!
          </p>
          <h1 className="kv-title" style={{
            fontFamily: FONT_SANS, letterSpacing: '-0.005em',
            fontWeight: 700,
            fontSize: 48,
            lineHeight: 1.06,
            color: '#22312B',
            margin: '0 0 24px',
          }}>
            Bienvenue<br />sur Kapolia
          </h1>
          <p style={{
            fontSize: 15.5,
            lineHeight: 1.62,
            color: '#4A5A52',
            maxWidth: 420,
            margin: '0 0 32px',
          }}>
            Ici, pas de CV. Les recruteurs vous découvrent à travers un profil vivant :
            vos compétences, bien sûr, mais aussi votre personnalité, vos valeurs et ce
            que vous recherchez. C'est ce qui donne envie de vous rencontrer.
          </p>
          <div>
            <button
              onClick={handleClick}
              disabled={anim === 'spinning'}
              onMouseEnter={() => { if (anim !== 'spinning') setAnim('hover') }}
              onMouseLeave={() => { if (anim !== 'spinning') setAnim('idle') }}
              className="kv-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                backgroundColor: C.orange,
                color: C.bg,
                border: 'none',
                borderRadius: 100,
                padding: '14px 28px',
                fontSize: 14,
                fontWeight: 500,
                cursor: anim === 'spinning' ? 'default' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Commencer
              <svg
                viewBox="0 0 14 16"
                width={14}
                height={16}
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M3 2 L11 8 L3 14"
                  stroke={C.bg}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Bloc B — fond vert, logo contour débordant ──────────────────────── */}
        <div className="kv-bloc-b" style={{
          gridRow: 1,
          gridColumn: 2,
          backgroundColor: C.vert,
          borderRadius: 16,
          minHeight: 150,
          overflow: 'hidden',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            left: '26%',
            top: '22%',
            width: '92%',
            height: '92%',
          }}>
            <LogoKapolia
              variante="contour"
              taille="100%"
              avecTexte={false}
              needleClassName={needleCls}
              style={{ width: '100%', height: '100%', display: 'block' }}
            />
          </div>
        </div>

        {/* ── Bloc C — durée et flexibilité ───────────────────────────────────── */}
        <div className="kv-bloc-c" style={{
          gridRow: 2,
          gridColumn: 2,
          backgroundColor: C.sable,
          borderRadius: 16,
          padding: '22px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 10 }}>
            <span style={{
              fontFamily: FONT_SANS, letterSpacing: '-0.005em',
              fontWeight: 700,
              fontSize: 34,
              color: C.vert,
              lineHeight: 1,
            }}>
              10
            </span>
            <span style={{ fontSize: 12.5, color: '#5A6B62' }}>minutes environ</span>
          </div>
          <p style={{ fontSize: 12.5, lineHeight: 1.55, color: '#5A6B62', margin: 0 }}>
            Rien n'est figé : vous pourrez enrichir votre profil quand vous le souhaitez.
          </p>
        </div>

      </div>
      </div>
    </div>
  )
}

// ─── Carrousel qualités (étape 5) ─────────────────────────────────────────────

const TOTAL_SITUATIONS = SITUATIONS[CURRENT_VERSION].length  // 9

function QualitesCarousel({
  userId,
  onComplete,
  forceEmpty = false,
  writeDate  = false,
  onRefaireDone,
}: {
  userId:         string
  onComplete:     (done: boolean) => void
  forceEmpty?:    boolean
  writeDate?:     boolean
  onRefaireDone?: () => void
}) {
  const [idx,         setIdx]        = useState(0)
  const [selections,  setSelections] = useState<Record<number, (1|2|3|4)[]>>({})
  const [savingIdx,   setSavingIdx]  = useState<number | null>(null)
  const [phase,       setPhase]      = useState<'quiz' | 'done'>('quiz')
  const [flashId,     setFlashId]    = useState<number | null>(null)
  const [loading,     setLoading]    = useState(true)
  const [updateError, setUpdateError] = useState('')

  // Charge les réponses existantes
  useEffect(() => {
    if (!userId) return
    if (forceEmpty) { setLoading(false); return }
    supabase
      .from('test_qualites')
      .select('situation_id, reponse_1, reponse_2, version_test')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (error) { console.error('[test_qualites] fetch error:', error); setLoading(false); return }
        if (data && data.length > 0) {
          const loaded: Record<number, (1|2|3|4)[]> = {}
          for (const row of data) {
            loaded[row.situation_id] = [row.reponse_1, row.reponse_2]
          }
          setSelections(loaded)
          if (data.length >= TOTAL_SITUATIONS) {
            setPhase('done')
            onComplete(true)
          } else {
            // Commence à la première situation sans réponse
            const situations = SITUATIONS[CURRENT_VERSION]
            const firstUnanswered = situations.findIndex(s => !loaded[s.id])
            setIdx(firstUnanswered >= 0 ? firstUnanswered : 0)
          }
        }
        setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  function handleSelect(reponseId: 1|2|3|4) {
    const sitId = SITUATIONS[CURRENT_VERSION][idx].id
    const current = selections[sitId] ?? []
    if (current.includes(reponseId)) {
      // Désélection
      setSelections(prev => ({ ...prev, [sitId]: current.filter(r => r !== reponseId) }))
      return
    }
    if (current.length < 2) {
      setSelections(prev => ({ ...prev, [sitId]: [...current, reponseId] }))
      return
    }
    // FIFO : remplace le plus ancien
    const replaced = current[0]
    setFlashId(replaced)
    setTimeout(() => setFlashId(null), 300)
    setSelections(prev => ({ ...prev, [sitId]: [current[1], reponseId] }))
  }

  async function handleAdvance() {
    const situation = SITUATIONS[CURRENT_VERSION][idx]
    const sel = selections[situation.id]
    if (!sel || sel.length < 2 || savingIdx !== null) return

    setSavingIdx(idx)
    const { error } = await supabase
      .from('test_qualites')
      .upsert(
        {
          user_id:     userId,
          situation_id: situation.id,
          reponse_1:   sel[0],
          reponse_2:   sel[1],
          version_test: CURRENT_VERSION,
        },
        { onConflict: 'user_id,situation_id' },
      )
    setSavingIdx(null)

    if (error) { console.error('[test_qualites] upsert error:', error); return }

    if (idx < TOTAL_SITUATIONS - 1) {
      setIdx(idx + 1)
    } else {
      const allAnswers = SITUATIONS[CURRENT_VERSION]
        .map(s => {
          const saved = selections[s.id]
          if (!saved || saved.length < 2) return null
          return { situation_id: s.id, reponse_1: saved[0], reponse_2: saved[1], version_test: CURRENT_VERSION } as TestAnswer
        })
        .filter((a): a is TestAnswer => a !== null)
      const resultats    = calculerQualites(allAnswers)
      const qualitesTest = Object.fromEntries(resultats.map(r => [r.qualite, r.count]))
      const { error: profilErr } = await supabase.from('profils').update({
        qualites_test: qualitesTest,
        ...(writeDate ? { test_qualites_fait_le: new Date().toISOString() } : {}),
      }).eq('user_id', userId)
      if (profilErr) {
        setUpdateError("L'enregistrement n'a pas abouti, réessayez.")
        setSavingIdx(null)
        return
      }
      setPhase('done')
      if (onRefaireDone) { onRefaireDone() } else { onComplete(true) }
    }
  }

  if (loading) return null

  const situations    = SITUATIONS[CURRENT_VERSION]
  const situation     = situations[idx]
  const sel           = phase === 'quiz' ? (selections[situation?.id] ?? []) : []
  const selCount      = sel.length
  const canAdvance    = selCount === 2 && savingIdx === null
  const isSaving      = savingIdx === idx
  const answeredCount = Object.keys(selections).filter(k => (selections[Number(k)] ?? []).length === 2).length

  if (phase === 'done') {
    const answers = situations
      .map(s => {
        const r = selections[s.id]
        if (!r || r.length < 2) return null
        return { situation_id: s.id, reponse_1: r[0], reponse_2: r[1], version_test: CURRENT_VERSION } as TestAnswer
      })
      .filter((a): a is TestAnswer => a !== null)
    const resultats = calculerQualites(answers)

    return (
      <div>
        <p style={{
          fontFamily: FONT_SANS, letterSpacing: '-0.005em', fontSize: 22, color: C.dark,
          margin: '0 0 10px', fontWeight: 700, lineHeight: 1.3,
        }}>
          Votre profil de qualités est prêt.
        </p>
        <p style={{ fontSize: 14, color: C.grey, margin: '0 0 24px', lineHeight: 1.6 }}>
          Voici les qualités qui sont ressorties le plus souvent.
        </p>

        {resultats.length === 0 ? (
          <p style={{ fontSize: 14, color: C.grey, lineHeight: 1.6 }}>
            Aucune qualité n'est apparue deux fois ou plus. Vous pouvez en ajouter manuellement depuis votre profil.
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            {resultats.map(r => (
              <div key={r.qualite} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', borderRadius: 24,
                border: `1.5px solid ${C.terracotta}`,
                backgroundColor: 'rgba(194, 97, 31,0.06)',
              }}>
                <span style={{ fontSize: 14, color: C.dark, fontWeight: 500 }}>
                  {QUALITE_LABELS[r.qualite] ?? r.qualite}
                </span>
                <span style={{ fontSize: 12, color: C.terracotta }}>
                  {r.count === 1 ? '1 situation' : `${r.count} situations`}
                </span>
              </div>
            ))}
          </div>
        )}

        <p style={{ fontSize: 12, color: C.grey, fontStyle: 'italic', lineHeight: 1.55 }}>
          Les qualités apparues dans une seule situation ne sont pas retenues.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Pastilles de progression */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, alignItems: 'center' }}>
        {situations.map((s, i) => {
          const done    = (selections[s.id] ?? []).length === 2
          const current = i === idx
          return (
            <div key={s.id} style={{
              width: current ? 10 : 8,
              height: current ? 10 : 8,
              borderRadius: '50%',
              flexShrink: 0,
              backgroundColor: done || current ? C.terracotta : C.sable,
              transition: 'all 0.2s',
            }} />
          )
        })}
      </div>

      {/* Compteur */}
      <p style={{ fontSize: 12, color: C.grey, fontWeight: 600, margin: '0 0 16px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Situation {idx + 1} sur {TOTAL_SITUATIONS}
      </p>

      {/* Introduction — visible uniquement sur la situation 1 */}
      {idx === 0 && (
        <p style={{ fontSize: 14, color: C.grey, lineHeight: 1.7, margin: '0 0 24px' }}>
          Neuf situations de travail. Pour chacune, choisissez les deux réactions
          les plus proches de la vôtre. Il n'y a pas de bonne réponse, et répondre
          au plus près de ce que vous feriez réellement vous servira davantage
          qu'essayer de bien faire. Les qualités qui ressortent de vos choix seront
          affichées sur votre profil : elles auront plus de poids que si vous les
          aviez simplement déclarées. Vous pourrez ensuite inviter un proche à
          compléter ce regard par le sien.
        </p>
      )}

      {/* Texte de la situation */}
      <p style={{
        fontFamily: FONT_SANS, letterSpacing: '-0.005em', fontSize: 18, color: C.dark,
        margin: '0 0 20px', lineHeight: 1.5, fontWeight: 700,
      }}>
        {situation.texte}
      </p>

      {/* Cartes de réponse */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {situation.reponses.map(r => {
          const selected = sel.includes(r.id)
          const flashing = flashId === r.id
          return (
            <button
              key={r.id}
              onClick={() => handleSelect(r.id)}
              style={{
                textAlign: 'left', padding: '13px 16px', borderRadius: 12,
                border: `2px solid ${selected ? C.terracotta : C.sable}`,
                backgroundColor: flashing ? `${C.terracotta}18`
                                : selected ? `${C.terracotta}0D` : C.white,
                color: selected ? C.dark : C.dark,
                fontSize: 14, lineHeight: 1.5, cursor: 'pointer',
                fontFamily: 'inherit', transition: 'border-color 0.15s, background-color 0.15s',
                outline: 'none',
              }}
            >
              {r.texte}
            </button>
          )
        })}
      </div>

      {/* Compteur de sélection */}
      <p style={{
        fontSize: 13, color: selCount === 2 ? C.terracotta : C.grey,
        margin: '0 0 20px', fontWeight: selCount === 2 ? 600 : 400,
        transition: 'color 0.2s',
      }}>
        {selCount === 0 ? 'Choisissez 2 réponses'
         : selCount === 1 ? '1 réponse choisie sur 2'
         : '2 réponses choisies'}
      </p>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => setIdx(i => i - 1)}
          disabled={idx === 0}
          style={{
            flex: 1, padding: '12px 16px', borderRadius: 12,
            border: `1.5px solid ${idx === 0 ? C.sable : C.sable}`,
            backgroundColor: C.white,
            color: idx === 0 ? C.sable : C.dark,
            fontSize: 14, cursor: idx === 0 ? 'default' : 'pointer',
            fontFamily: 'inherit', fontWeight: 500,
          }}
        >
          Situation précédente
        </button>
        <button
          onClick={handleAdvance}
          disabled={!canAdvance}
          style={{
            flex: 1, padding: '12px 16px', borderRadius: 12,
            border: 'none',
            backgroundColor: canAdvance ? C.terracotta : C.sable,
            color: canAdvance ? C.white : C.grey,
            fontSize: 14, fontWeight: 600,
            cursor: canAdvance ? 'pointer' : 'default',
            fontFamily: 'inherit', transition: 'background-color 0.15s',
          }}
        >
          {isSaving ? 'Enregistrement...'
           : idx < TOTAL_SITUATIONS - 1 ? 'Situation suivante'
           : 'Voir mes résultats'}
        </button>
      </div>

      {updateError && (
        <p style={{ fontSize: 13, color: C.erreur, margin: '10px 0 0', textAlign: 'center' }}>{updateError}</p>
      )}

      {/* Indicateur de progression globale (nombre de situations répondues) */}
      {answeredCount > 0 && answeredCount < TOTAL_SITUATIONS && (
        <p style={{ fontSize: 12, color: C.grey, margin: '12px 0 0', textAlign: 'center' }}>
          {answeredCount} situation{answeredCount > 1 ? 's' : ''} sur {TOTAL_SITUATIONS} répondue{answeredCount > 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}

// ─── Écran final ──────────────────────────────────────────────────────────────

function FinalScreen({ onGoToProfile, userId, emailConfirme }: { onGoToProfile: () => void; userId: string; emailConfirme: boolean }) {
  const [chosen, setChosen]             = useState<boolean | null>(null)
  const [saving, setSaving]             = useState(false)
  const [invitModalOpen, setInvitModalOpen] = useState(false)
  const [activeCount, setActiveCount]   = useState(0)
  const [invitHover, setInvitHover]     = useState(false)

  useEffect(() => {
    const now = new Date().toISOString()
    supabase
      .from('invitations_proches')
      .select('id', { count: 'exact', head: true })
      .eq('candidat_id', userId)
      .gt('expire_at', now)
      .is('used_at', null)
      .then(({ count, error }) => { if (!error) setActiveCount(count ?? 0) })
  }, [userId])

  async function handleChoice(value: boolean) {
    setSaving(true)
    try {
      await supabase.from('profils').update({
        visible_candidatheque: value,
        visible_candidatheque_maj_le: new Date().toISOString(),
      }).eq('user_id', userId)
    } finally {
      setSaving(false)
      setChosen(value)
    }
  }

  return (
    <main style={{
      backgroundColor: C.vert,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '40px 34px 34px',
      boxSizing: 'border-box' as const,
    }}>
      <style suppressHydrationWarning>{`
        .final-title { font-size: 36px; }
        .final-card  { max-width: 460px; width: 100%; }
        .final-btns  { flex-direction: row; }
        .final-btn   { flex: 1; }
        @media (max-width: 768px) {
          .final-title { font-size: 28px; }
          .final-card  { max-width: 100%; }
          .final-btns  { flex-direction: column; }
          .final-btn   { width: 100%; }
        }
      `}</style>

      {/* Logo */}
      <div style={{ marginBottom: 32 }}>
        <LogoKapolia variante="clair" taille={52} avecTexte={false} />
      </div>

      {/* Titre */}
      <h1 className="final-title" style={{
        fontFamily: FONT_SANS, letterSpacing: '-0.005em',
        fontWeight: 700,
        lineHeight: 1.1,
        color: C.bg,
        textAlign: 'center',
        marginBottom: 20,
        marginTop: 0,
      }}>
        Vous avez trouvé votre cap
      </h1>

      {/* Accroche */}
      <p style={{
        fontFamily: FONT_SANS,
        fontSize: 14,
        lineHeight: 1.6,
        color: '#A9BDB2',
        textAlign: 'center',
        maxWidth: 400,
        marginBottom: 36,
        marginTop: 0,
      }}>
        Votre profil est prêt. Les recruteurs vous découvriront tel que vous êtes, et vous pourrez
        l'enrichir quand vous le souhaitez.
      </p>

      {chosen === null ? (
        /* Carte de visibilité */
        <div className="final-card" style={{
          backgroundColor: C.bg,
          borderRadius: 14,
          padding: '24px 26px',
          textAlign: 'left',
        }}>
          <p style={{
            fontFamily: FONT_SANS, letterSpacing: '-0.005em',
            fontWeight: 600,
            fontSize: 17,
            color: '#22312B',
            margin: '0 0 12px',
            lineHeight: 1.35,
          }}>
            Souhaitez-vous être visible par les recruteurs ?
          </p>
          <p style={{
            fontFamily: FONT_SANS,
            fontSize: 13,
            color: '#5A6B62',
            lineHeight: 1.6,
            margin: '0 0 24px',
          }}>
            Les recruteurs inscrits pourront consulter votre profil et vous écrire, même sans
            candidature de votre part. Vous pourrez changer d'avis à tout moment.
          </p>
          {!emailConfirme && (
            <p style={{ fontSize: 12, color: '#8BA99E', lineHeight: 1.55, margin: '0 0 14px' }}>
              Confirmez d'abord votre adresse e-mail pour activer la visibilité.
              Vous pourrez le faire depuis vos paramètres.
            </p>
          )}
          <div className="final-btns" style={{ display: 'flex', gap: 12 }}>
            <button
              className="final-btn"
              onClick={() => handleChoice(true)}
              disabled={saving || !emailConfirme}
              style={{
                backgroundColor: C.orange,
                color: C.bg,
                border: 'none',
                borderRadius: 100,
                padding: '12px 20px',
                fontSize: 14,
                fontWeight: 600,
                cursor: saving || !emailConfirme ? 'default' : 'pointer',
                opacity: saving || !emailConfirme ? 0.4 : 1,
                fontFamily: 'inherit',
              }}
            >
              Oui, je veux être visible
            </button>
            <button
              className="final-btn"
              onClick={() => handleChoice(false)}
              disabled={saving}
              style={{
                backgroundColor: 'transparent',
                color: '#5A6B62',
                border: '1.5px solid #DDD2BF',
                borderRadius: 100,
                padding: '12px 20px',
                fontSize: 14,
                fontWeight: 500,
                cursor: saving ? 'default' : 'pointer',
                opacity: saving ? 0.7 : 1,
                fontFamily: 'inherit',
              }}
            >
              Pas pour le moment
            </button>
          </div>
        </div>
      ) : (
        /* Après le choix */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%', maxWidth: 340 }}>
          <button
            onClick={onGoToProfile}
            style={{
              width: '100%',
              backgroundColor: C.orange,
              color: C.bg,
              border: 'none',
              borderRadius: 100,
              padding: '14px 36px',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Accéder à mon profil
          </button>
          {activeCount < 4 && (
            <button
              onClick={() => setInvitModalOpen(true)}
              onMouseEnter={() => setInvitHover(true)}
              onMouseLeave={() => setInvitHover(false)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontFamily: FONT_SANS,
                fontSize: 13,
                color: invitHover ? C.bg : '#A9BDB2',
                textDecoration: 'underline',
                cursor: 'pointer',
                transition: 'color 0.15s',
              }}
            >
              Inviter un proche à compléter vos qualités
            </button>
          )}
        </div>
      )}

      <InvitationModal
        open={invitModalOpen}
        onClose={() => setInvitModalOpen(false)}
        candidatId={userId}
        activeCount={activeCount}
        onCreated={() => setActiveCount(prev => prev + 1)}
      />
    </main>
  )
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function QuestionLabel({ num, text, sub }: { num: number; text: string; sub?: string }) {
  const displayNum = displayStepNum(num)
  return (
    <>
      <p style={{
        fontSize: '11px', color: C.terracotta, fontWeight: '700',
        marginBottom: '10px', letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        Étape {displayNum} sur {TOTAL}
      </p>
      <h2 style={{
        fontFamily: FONT_SANS, letterSpacing: '-0.005em',
        fontSize: 'clamp(22px, 3.5vw, 32px)',
        color: C.dark, lineHeight: '1.35',
        marginBottom: sub ? '10px' : '28px',
        fontWeight: 700,
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

function ChoiceCard({ label, desc, selected, onClick, disabled = false }: {
  label: string; desc?: string; selected: boolean; onClick: () => void; disabled?: boolean
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        width: '100%', textAlign: 'left', padding: '14px 18px',
        borderRadius: '14px',
        border: `2px solid ${selected ? C.terracotta : C.sable}`,
        backgroundColor: selected ? 'rgba(194, 97, 31,0.07)' : C.white,
        cursor: disabled ? 'default' : 'pointer', transition: 'all 0.15s',
        marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '14px',
        opacity: disabled ? 0.45 : 1,
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

function VoiceTextArea({ value, onChange, placeholder, rows = 5 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  const [supported,  setSupported]  = useState(false)
  const [listening,  setListening]  = useState(false)
  const [permError,  setPermError]  = useState(false)
  const [interim,    setInterim]    = useState('')
  const recogRef  = useRef<any>(null)
  const valueRef  = useRef(value)
  useEffect(() => { valueRef.current = value }, [value])

  useEffect(() => {
    setSupported('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    return () => { recogRef.current?.stop() }
  }, [])

  function start() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    const recog = new SR()
    recog.lang = 'fr-FR'
    recog.continuous = true
    recog.interimResults = true

    recog.onresult = (e: any) => {
      let final = '', interimText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t
        else interimText += t
      }
      if (final.trim()) {
        const cur = valueRef.current
        const sep = cur.length > 0 && !cur.endsWith('\n') ? ' ' : ''
        onChange(cur + sep + final.trim())
        setInterim('')
      } else {
        setInterim(interimText)
      }
    }

    recog.onerror = (e: any) => {
      if (e.error === 'not-allowed') setPermError(true)
      setListening(false); setInterim(''); recogRef.current = null
    }

    recog.onend = () => {
      setListening(false); setInterim(''); recogRef.current = null
    }

    recogRef.current = recog
    try { recog.start(); setListening(true); setPermError(false) }
    catch { setListening(false) }
  }

  function stop() {
    recogRef.current?.stop(); recogRef.current = null
    setListening(false); setInterim('')
  }

  const active = value.length > 0 || listening

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: '100%', padding: '13px 16px',
          paddingBottom: supported ? '46px' : '13px',
          fontSize: '15px',
          borderRadius: '12px', border: `2px solid ${active ? C.terracotta : C.sable}`,
          backgroundColor: C.white, color: C.dark, outline: 'none',
          boxSizing: 'border-box', resize: 'vertical', lineHeight: '1.65',
          fontFamily: 'inherit', transition: 'border-color 0.2s',
        }}
      />
      {interim && (
        <p style={{
          fontSize: '13px', color: C.terracotta, fontStyle: 'italic',
          position: 'absolute', bottom: '48px', left: '16px', right: '48px',
          margin: 0, lineHeight: '1.4', pointerEvents: 'none',
          backgroundColor: 'rgba(247,242,235,0.9)',
          borderRadius: '4px', padding: '2px 4px',
        }}>
          {interim}…
        </p>
      )}
      {supported && (
        <button
          type="button"
          onClick={listening ? stop : start}
          title={listening ? 'Arrêter la dictée' : 'Dicter avec le micro (fr)'}
          style={{
            position: 'absolute', bottom: '10px', right: '10px',
            width: '32px', height: '32px', borderRadius: '50%',
            border: `1.5px solid ${listening ? C.terracotta : C.sable}`,
            backgroundColor: listening ? C.terracotta : C.white,
            color: listening ? C.white : C.grey,
            cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
            animation: listening ? 'kapolia-pulse 1.4s ease-in-out infinite' : 'none',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="9" y="2" width="6" height="12" rx="3"/>
            <path d="M5 10a7 7 0 0014 0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            <line x1="8"  y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
        </button>
      )}
      {permError && (
        <p style={{ fontSize: '12px', color: C.erreur, marginTop: '6px' }}>
          Accès au microphone refusé. Vérifiez les permissions dans votre navigateur.
        </p>
      )}
    </div>
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
      onAddTag(trimmed); setVal('')
    }
  }
  return (
    <div>
      {tags.length < maxTags && (
        <input
          type="text" value={val}
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
              <button onClick={() => onRemoveTag(tag)} style={{
                background: 'none', border: 'none', color: C.grey,
                cursor: 'pointer', padding: 0, fontSize: '14px', lineHeight: 1, display: 'flex',
              }}>×</button>
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

// ─── Saisie des compétences avec suggestions par domaine ──────────────────────

function CompRefTagInput({
  domain, tags, onAdd, onRemove, maxTags = 15,
}: {
  domain: string; tags: string[]
  onAdd: (t: string) => void; onRemove: (t: string) => void; maxTags?: number
}) {
  const [freeVal,      setFreeVal]      = useState('')
  const [showOther,    setShowOther]    = useState(false)
  const [otherDomain,  setOtherDomain]  = useState<string | null>(null)

  const domainSuggestions = COMP_REF[domain] ?? []
  const otherDomains      = DOMAINES.filter(d => d !== domain && !!COMP_REF[d])
  const browseSuggestions = otherDomain ? (COMP_REF[otherDomain] ?? []) : []

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const trimmed = freeVal.trim()
    if (trimmed && !tags.includes(trimmed) && tags.length < maxTags) {
      onAdd(trimmed); setFreeVal('')
    }
  }

  function toggle(comp: string) {
    if (tags.includes(comp)) onRemove(comp)
    else if (tags.length < maxTags) onAdd(comp)
  }

  const pillStyle = (added: boolean, full: boolean): React.CSSProperties => ({
    padding: '6px 13px', borderRadius: 20, fontSize: 13,
    border: `1.5px solid ${added ? C.vert : C.sable}`,
    backgroundColor: added ? `${C.vert}12` : C.white,
    color: added ? C.vert : full ? '#C0C0C0' : C.dark,
    cursor: full && !added ? 'default' : 'pointer',
    fontFamily: 'inherit', transition: 'all 0.15s',
  })

  return (
    <div>
      {/* Compétences sélectionnées */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {tags.map(tag => (
            <span key={tag} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 20,
              backgroundColor: `${C.vert}12`, color: C.vert,
              border: `1px solid ${C.vert}25`, fontSize: 13, fontWeight: 500,
            }}>
              {tag}
              <button onClick={() => onRemove(tag)} style={{
                background: 'none', border: 'none', color: C.grey,
                cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1, display: 'flex',
              }}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* Suggestions du domaine courant */}
      {domainSuggestions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            Suggestions pour « {domain} »
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {domainSuggestions.map(s => {
              const added = tags.includes(s)
              const full  = !added && tags.length >= maxTags
              return (
                <button key={s} type="button" onClick={() => !full && toggle(s)}
                  style={pillStyle(added, full)}>
                  {added ? `✓ ${s}` : `+ ${s}`}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Autres domaines */}
      <button type="button"
        onClick={() => { setShowOther(v => !v); if (showOther) setOtherDomain(null) }}
        style={{
          padding: '7px 14px', borderRadius: 20, fontSize: 12,
          border: `1.5px dashed ${C.sable}`, backgroundColor: 'transparent',
          color: C.grey, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12,
        }}>
        {showOther ? '— Réduire' : '+ Compétences d\'autres domaines'}
      </button>

      {showOther && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
            {otherDomains.map(d => (
              <button key={d} type="button"
                onClick={() => setOtherDomain(d === otherDomain ? null : d)}
                style={{
                  padding: '6px 13px', borderRadius: 20, fontSize: 12,
                  border: `1.5px solid ${d === otherDomain ? C.terracotta : C.sable}`,
                  backgroundColor: d === otherDomain ? `${C.terracotta}10` : C.white,
                  color: d === otherDomain ? C.terracotta : C.grey,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                }}>
                {d}
              </button>
            ))}
          </div>
          {otherDomain && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {browseSuggestions.map(s => {
                const added = tags.includes(s)
                const full  = !added && tags.length >= maxTags
                return (
                  <button key={s} type="button" onClick={() => !full && toggle(s)}
                    style={pillStyle(added, full)}>
                    {added ? `✓ ${s}` : `+ ${s}`}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Saisie libre */}
      {tags.length < maxTags && (
        <input
          type="text" value={freeVal}
          onChange={e => setFreeVal(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Autre compétence (saisie libre) — Entrée pour valider"
          style={{
            width: '100%', padding: '13px 16px', fontSize: '14px',
            borderRadius: '12px', border: `2px solid ${freeVal ? C.terracotta : C.sable}`,
            backgroundColor: C.white, color: C.dark, outline: 'none',
            boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.2s',
          }}
        />
      )}
      <p style={{ fontSize: '12px', color: C.grey, marginTop: '8px' }}>
        {tags.length} / {maxTags} compétences
      </p>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

function OnboardingPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isRefaire = searchParams.get('refaire') === 'questionnaire'
  const [showWelcome, setShowWelcome] = useState(true)
  const [showFinal,   setShowFinal]   = useState(false)
  const [step, setStep] = useState(1)
  const [step5Complete, setStep5Complete] = useState(false)
  const [data, setData] = useState<FormData>({
    prenom: '', nom: '', domaine: '', experience: '', parcours: '',
    projet: '', projet_titre: '', passions: [],
    disponibilite: '', dispo_date: '',
    typePoste: [], lieu: '', ville: '', priorite: [],
    experiences: [], diplomes: [], competences_acquises: [], langues: [],
  })
  const [saving,        setSaving]        = useState(false)
  const [saveError,     setSaveError]     = useState<string | null>(null)
  const [loadingResume, setLoadingResume] = useState(true)
  const [userId,        setUserId]        = useState('')
  const [emailConfirme, setEmailConfirme] = useState(true)
  // Ref pour le step max atteint — ne régresse jamais, même si l'utilisateur revient en arrière
  const maxStepRef = useRef(1)

  useEffect(() => {
    async function resumeIfNeeded() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (isRefaire) { router.replace('/connexion'); return } setLoadingResume(false); return }
      setUserId(user.id)
      setEmailConfirme(!!user.email_confirmed_at)
      if (isRefaire) { setLoadingResume(false); return }

      const [{ data: profil }, { count: testCount }] = await Promise.all([
        supabase
          .from('profils')
          .select('prenom, nom, domaine, experience, signature, type_entreprise, valeur, projet_phare, projet_titre, passions, type_poste, mode_travail, ville, priorites, disponibilite, dispo_date, experiences, diplomes, competences_acquises, langues, onboarding_step')
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('test_qualites')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
      ])

      const allTestDone = (testCount ?? 0) >= SITUATIONS[CURRENT_VERSION].length
      if (allTestDone) setStep5Complete(true)

      if (profil?.prenom) {
        const p = profil as Record<string, unknown>
        const filled: FormData = {
          prenom:               (p.prenom as string)      || '',
          nom:                  (p.nom as string)          || '',
          domaine:              (p.domaine as string)      || '',
          experience:           (p.experience as string)   || '',
          parcours:             (p.signature as string)    || '',
          projet:               (p.projet_phare as string) || '',
          projet_titre:         (p.projet_titre as string)  || '',
          passions:             Array.isArray(p.passions) ? p.passions as string[] : [],
          typePoste:            Array.isArray(p.type_poste) ? p.type_poste as string[] : [],
          lieu:                 (p.mode_travail as string)  || '',
          ville:                (p.ville as string)        || '',
          priorite:             Array.isArray(p.priorites) ? p.priorites as string[] : [],
          disponibilite:        (p.disponibilite as string) || '',
          dispo_date:           (p.dispo_date as string)   || '',
          experiences:          Array.isArray(p.experiences) ? p.experiences as Experience[] : [],
          diplomes:             Array.isArray(p.diplomes) ? p.diplomes as Diplome[] : [],
          competences_acquises: Array.isArray(p.competences_acquises) ? p.competences_acquises as string[] : [],
          langues:              Array.isArray(p.langues) ? p.langues as string[] : [],
        }
        // Reprend exactement au step enregistré, avec firstIncompleteStep en fallback
        const savedStep = typeof p.onboarding_step === 'number' ? p.onboarding_step : 0
        const resumeAt  = savedStep > 1 ? resumeStepFrom(savedStep) : firstIncompleteStep(filled, allTestDone)
        maxStepRef.current = Math.max(resumeAt, 1)
        setData(filled)
        setStep(resumeAt)
        setShowWelcome(false)
      }

      setLoadingResume(false)
    }
    resumeIfNeeded()
  }, [])

  const blockIndex = BLOCKS.findIndex(b => b.steps.includes(step))

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  function isValid(): boolean {
    switch (step) {
      case 1:  return data.prenom.trim().length > 0 && data.nom.trim().length > 0
      case 2:  return data.domaine.length > 0
      case 3:  return data.experience.length > 0
      case 4:  return true
      case 5:  return step5Complete
      case 6:  return true
      case 7: {
        const hasDesc = data.projet.trim().length > 0
        return !hasDesc || data.projet_titre.trim().length > 0
      }
      case 8:  return true
      case 9:  return data.typePoste.length > 0
      case 10: return data.lieu.length > 0
      case 11: return true
      case 12: return data.disponibilite.length > 0
      case 13: return true
      case 14: return true
      case 15: return true
      default: return false
    }
  }

  // Sauvegarde progressive : fire-and-forget pour les étapes 1–16.
  // Les erreurs sont silencieuses — la sauvegarde finale (étape 17) reste le filet complet.
  async function saveStep(currentStep: number) {
    const payload = buildStepPayload(currentStep, data, maxStepRef.current)
    if (!payload) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profils').upsert(
      { user_id: user.id, ...payload },
      { onConflict: 'user_id' }
    )
  }

  async function handleNext() {
    if (step < LAST_STEP) {
      const nextStep = step === 5 ? 7 : step + 1
      maxStepRef.current = Math.max(maxStepRef.current, nextStep)
      saveStep(step)   // fire-and-forget
      setStep(nextStep)
      return
    }
    // Étape finale : upsert complet + onboarding_completed = true
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
        projet_phare: data.projet,
        projet_titre: data.projet_titre || null,
        passions: data.passions,
        type_poste: data.typePoste,
        mode_travail: data.lieu,
        ville: data.ville || null,
        priorites: data.priorite,
        disponibilite: data.disponibilite,
        dispo_date: data.disponibilite === 'a_partir_de' ? data.dispo_date || null : null,
        experiences: data.experiences,
        diplomes: data.diplomes,
        competences_acquises: data.competences_acquises,
        langues: data.langues,
        onboarding_completed: true,
        onboarding_step: LAST_STEP,
      }, { onConflict: 'user_id' })
      if (error) throw error
      setShowFinal(true)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Une erreur est survenue')
      setSaving(false)
    }
  }

  function handleBack() {
    if (step > 1) setStep(s => s === 7 ? 5 : s - 1)
    // Pas de save : le retour arrière ne modifie pas la progression en base
  }

  function handleSkip() {
    if (step < LAST_STEP) {
      const nextStep = step === 5 ? 7 : step + 1
      maxStepRef.current = Math.max(maxStepRef.current, nextStep)
      setStep(nextStep)
    } else {
      handleNext()
    }
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
                  padding: '10px 18px', borderRadius: '24px', fontFamily: 'inherit',
                  border: `2px solid ${data.domaine === d ? C.terracotta : C.sable}`,
                  backgroundColor: data.domaine === d ? 'rgba(194, 97, 31,0.08)' : C.white,
                  color: data.domaine === d ? C.terracotta : C.dark,
                  fontSize: '14px', fontWeight: data.domaine === d ? '600' : '400',
                  cursor: 'pointer', transition: 'all 0.15s',
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
            <VoiceTextArea
              value={data.parcours}
              onChange={v => {
                const next = v
                if (next.length <= MAX_SIGNATURE || next.length < data.parcours.length) {
                  set('parcours', next)
                }
              }}
              placeholder="Formations, expériences, reconversions, particularités… Soyez vous-même."
            />
            <SignatureCounter count={data.parcours.length} max={MAX_SIGNATURE} theme="light" />
          </>
        )

      case 5:
        return (
          <QualitesCarousel
            userId={userId}
            onComplete={done => setStep5Complete(done)}
          />
        )

      case 7:
        return (
          <>
            <QuestionLabel num={step} text="Quel est le projet dont vous êtes le plus fier ?" sub={MICRO_TEXTS[step]} />
            <input
              type="text"
              value={data.projet_titre}
              onChange={e => {
                const v = e.target.value
                if (v.length <= MAX_PROJET_TITRE || v.length < data.projet_titre.length) set('projet_titre', v)
              }}
              placeholder="Titre du projet"
              style={{
                width: '100%', boxSizing: 'border-box' as const,
                padding: '12px 16px', borderRadius: 10,
                border: `1.5px solid ${C.sable}`, fontSize: 15,
                fontFamily: 'inherit', outline: 'none',
                backgroundColor: C.white, color: C.dark,
                marginBottom: 2,
              }}
            />
            <SignatureCounter count={data.projet_titre.length} max={MAX_PROJET_TITRE} theme="light" />
            <div style={{ marginTop: 12 }}>
              <VoiceTextArea
                value={data.projet}
                onChange={v => {
                  if (v.length <= MAX_PROJET_DESC || v.length < data.projet.length) set('projet', v)
                }}
                placeholder="Un projet perso, pro, associatif… Ce qui l'a rendu marquant."
              />
              <SignatureCounter count={data.projet.length} max={MAX_PROJET_DESC} theme="light" />
            </div>
          </>
        )

      case 8:
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

      case 9: {
        return (
          <>
            <QuestionLabel num={step} text="Quel type de contrat recherchez-vous ?" sub={MICRO_TEXTS[step]} />
            <p style={{ fontSize: '13px', color: C.grey, marginBottom: '16px', marginTop: '-14px' }}>
              Vous pouvez en sélectionner plusieurs.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {TYPES_POSTE.map(t => {
                const selected = data.typePoste.includes(t.key)
                return (
                  <button key={t.key} onClick={() => {
                    if (selected) set('typePoste', data.typePoste.filter(k => k !== t.key))
                    else set('typePoste', [...data.typePoste, t.key])
                  }} style={{
                    padding: '11px 22px', borderRadius: '24px', fontFamily: 'inherit',
                    border: `2px solid ${selected ? C.terracotta : C.sable}`,
                    backgroundColor: selected ? 'rgba(194, 97, 31,0.08)' : C.white,
                    color: selected ? C.terracotta : C.dark,
                    fontSize: '14px', fontWeight: selected ? '600' : '400',
                    cursor: 'pointer', transition: 'all 0.15s',
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                  }}>
                    {selected && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {t.label}
                  </button>
                )
              })}
            </div>
          </>
        )
      }

      case 10:
        return (
          <>
            <QuestionLabel num={step} text="Sur place ou à distance ?" sub={MICRO_TEXTS[step]} />
            {LIEUX.map(l => (
              <ChoiceCard key={l.key} label={l.label} desc={l.description}
                selected={data.lieu === l.key} onClick={() => set('lieu', l.key)} />
            ))}
            <div style={{ marginTop: '4px' }}>
              <StyledInput
                value={data.ville}
                onChange={v => set('ville', v)}
                placeholder="Votre ville, région ou zone géographique"
              />
            </div>
          </>
        )

      case 11: {
        const maxReached = data.priorite.length >= 3
        return (
          <>
            <QuestionLabel num={step} text="Qu'est-ce qui compte le plus dans votre prochain poste ?" sub={MICRO_TEXTS[step]} />
            <p style={{ fontSize: '13px', color: C.grey, marginBottom: '16px', marginTop: '-14px' }}>
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
                    padding: '10px 18px', borderRadius: '24px', fontFamily: 'inherit',
                    border: `2px solid ${selected ? C.terracotta : C.sable}`,
                    backgroundColor: selected ? 'rgba(194, 97, 31,0.09)' : C.white,
                    color: selected ? C.terracotta : C.dark,
                    fontSize: '14px', fontWeight: selected ? '600' : '400',
                    cursor: disabled ? 'default' : 'pointer',
                    opacity: disabled ? 0.4 : 1, transition: 'all 0.15s',
                  }}>
                    {selected ? '✓ ' : ''}{p}
                  </button>
                )
              })}
            </div>
          </>
        )
      }

      case 12: {
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

      case 13: {
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
                <MissionsTextArea
                  value={exp.missions}
                  onChange={v => updateExp(i, { missions: v })}
                  rows={3}
                  textareaStyle={{
                    width: '100%', padding: '13px 16px', fontSize: '15px',
                    borderRadius: '12px', border: `2px solid ${exp.missions ? C.terracotta : C.sable}`,
                    backgroundColor: C.white, color: C.dark, outline: 'none',
                    boxSizing: 'border-box', resize: 'vertical', lineHeight: '1.65',
                    fontFamily: 'inherit', transition: 'border-color 0.2s',
                  }}
                />
                <button onClick={() => removeExp(i)} style={{
                  marginTop: '10px', background: 'none', border: 'none',
                  color: C.erreur, fontSize: '13px', cursor: 'pointer',
                  padding: 0, fontFamily: 'inherit',
                }}>
                  Supprimer cette expérience
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

      case 14: {
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
                  <StyledInput value={d.ecole} onChange={v => updateDiplome(i, { ecole: v })} placeholder="École ou établissement" />
                  <StyledInput value={d.annee} onChange={v => updateDiplome(i, { annee: v })} placeholder="Année (ex : 2020)" />
                </div>
                <StyledInput value={d.mention} onChange={v => updateDiplome(i, { mention: v })}
                  placeholder="Mention (optionnel : Bien, Très Bien…)" />
                <button onClick={() => removeDiplome(i)} style={{
                  marginTop: '10px', background: 'none', border: 'none',
                  color: C.erreur, fontSize: '13px', cursor: 'pointer',
                  padding: 0, fontFamily: 'inherit',
                }}>
                  Supprimer ce diplôme
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

      case 15:
        return (
          <>
            <QuestionLabel num={step} text="Compétences et langues" sub={MICRO_TEXTS[step]} />

            <p style={{ fontSize: '12px', fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              Compétences techniques et outils
            </p>
            <CompRefTagInput
              domain={data.domaine}
              tags={data.competences_acquises}
              onAdd={tag => set('competences_acquises', [...data.competences_acquises, tag])}
              onRemove={tag => set('competences_acquises', data.competences_acquises.filter(t => t !== tag))}
              maxTags={15}
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
                    backgroundColor: selected ? 'rgba(194, 97, 31,0.08)' : C.white,
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
                          border: `1px solid ${C.sable}`, backgroundColor: C.bg,
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

  if (loadingResume) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
      <style suppressHydrationWarning>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${C.sable}`, borderTopColor: C.terracotta, animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (isRefaire) return (
    <main style={{ backgroundColor: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '20px clamp(20px,5%,48px)', borderBottom: `1px solid ${C.sable}`, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
        <span style={{ fontFamily: FONT_SANS, fontSize: 20, fontWeight: 700, color: C.dark }}>Refaire le questionnaire</span>
        <a href="/profil" style={{ fontSize: 13, fontWeight: 600, color: C.orangeTexte, textDecoration: 'none' }}>Revenir à mon profil</a>
      </header>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px clamp(20px,5%,48px)' }}>
        <div style={{ width: '100%', maxWidth: 560 }}>
          {!loadingResume && userId && (
            <QualitesCarousel
              userId={userId}
              forceEmpty
              writeDate
              onComplete={() => {}}
              onRefaireDone={() => router.push('/profil?questionnaire=refait')}
            />
          )}
        </div>
      </div>
    </main>
  )

  if (showWelcome) return <WelcomeScreen onStart={() => setShowWelcome(false)} />
  if (showFinal)   return <FinalScreen   onGoToProfile={() => router.push(readPostSignupNext() ?? '/profil')} userId={userId} emailConfirme={emailConfirme} />

  const isOpt      = OPTIONAL_STEPS.has(step)
  const skipLabel  = LONG_OPTIONAL.has(step) ? 'Passer, je compléterai plus tard' : 'Passer'
  const transition = TRANSITIONS[step]

  return (
    <main style={{ backgroundColor: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <style suppressHydrationWarning>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes kapolia-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(194, 97, 31,0.45); }
          50%       { box-shadow: 0 0 0 7px rgba(194, 97, 31,0); }
        }
      `}</style>

      {/* Header */}
      <header style={{
        padding: '20px clamp(20px, 5%, 48px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${C.sable}`,
      }}>
        <span style={{ fontFamily: FONT_SANS, fontWeight: 700, letterSpacing: '-0.005em', fontSize: '20px', color: C.dark }}>Kapolia</span>
        <span style={{ fontSize: '12px', color: C.grey, fontWeight: '500', letterSpacing: '0.04em' }}>
          {displayStepNum(step)} / {TOTAL}
        </span>
      </header>

      {/* Progression — blocs + barre */}
      <div style={{ padding: '16px clamp(20px, 5%, 48px) 20px' }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {BLOCKS.map((b, i) => {
            const isCurrent = i === blockIndex
            const isPast    = i < blockIndex
            return (
              <span key={b.label} style={{
                fontSize: '11px', padding: '3px 10px', borderRadius: '20px',
                backgroundColor: isCurrent ? C.terracotta : isPast ? 'rgba(194, 97, 31,0.1)' : 'transparent',
                border: `1px solid ${isCurrent || isPast ? C.terracotta : C.sable}`,
                color: isCurrent ? 'white' : isPast ? C.terracotta : C.grey,
                fontWeight: isCurrent ? '600' : '400',
                transition: 'all 0.3s',
              }}>
                {b.label}
              </span>
            )
          })}
        </div>
        <div style={{ height: '3px', backgroundColor: C.sable, borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${(displayStepNum(step) / TOTAL) * 100}%`,
            backgroundColor: C.terracotta, borderRadius: '2px', transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Contenu de la question */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '16px clamp(20px, 5%, 48px) 32px', overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: '560px' }}>
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

      {/* Footer navigation */}
      <footer style={{
        padding: '16px clamp(20px, 5%, 48px)',
        borderTop: `1px solid ${C.sable}`,
        backgroundColor: C.bg,
      }}>
        {saveError && (
          <p style={{ color: C.erreur, fontSize: '14px', marginBottom: '12px', textAlign: 'center', fontWeight: '500' }}>
            {saveError}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={handleBack} disabled={step === 1 || saving} style={{
            background: 'none', border: 'none', padding: '10px 0', fontSize: '14px',
            color: step === 1 || saving ? 'transparent' : C.grey,
            cursor: step === 1 || saving ? 'default' : 'pointer', transition: 'color 0.2s',
          }}>
            ← Retour
          </button>

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
              border: 'none', borderRadius: '12px',
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
              ) : step === LAST_STEP ? 'Terminer' : 'Suivant'}
            </button>
          </div>
        </div>
      </footer>
    </main>
  )
}

import { Suspense } from 'react'
export default function OnboardingPage() {
  return <Suspense><OnboardingPageInner /></Suspense>
}
