'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FONT_SANS, FONT_LOGO } from '@/lib/typography'
import LogoKapolia from '@/components/LogoKapolia'
import InvitationModal from '@/components/InvitationModal'
import {
  ONBOARDING_TOTAL as TOTAL,
  LAST_STEP,
  DOMAINES,
  EXPERIENCES,
  TYPES_POSTE,
  screenToStep,
  convertSavedStep,
  firstIncompleteStep,
  buildStepPayload,
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
import { COMP_REF, PREFERENCES_TELETRAVAIL, PERMIS, PERMIS_AUTRES } from '@/lib/referentiels'
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
  { label: 'Vous',              steps: [1, 2] },
  { label: 'Vos qualités',      steps: [3] },
  { label: 'Ce qui vous anime', steps: [4] },
  { label: 'Votre recherche',   steps: [5, 6] },
  { label: 'Votre parcours',    steps: [7, 8, 9] },
]

const OPTIONAL_STEPS = new Set([4, 6, 7, 8])

const TRANSITIONS: Record<number, string> = {
  3: 'Voyons à présent ce qui vous définit, au-delà de votre parcours.',
  4: 'Parlons de ce qui vous anime et de ce que vous avez construit.',
  7: "Presque terminé. Il ne reste qu'à détailler votre parcours professionnel.",
  9: 'Votre profil prend forme. Ajoutons ce que vous savez faire.',
}

const MICRO_TEXTS: Record<number, string> = {
  1: 'Votre prénom et votre nom apparaissent sur votre profil tel que les recruteurs le verront.',
  2: "Votre domaine oriente les offres que nous vous proposons. Votre niveau d'expérience affine les opportunités qui vous correspondent.",
  3: "Neuf situations de travail, quatre réponses chacune. Choisissez les deux qui vous ressemblent le plus.",
  4: "Vos projets et centres d'intérêt créent parfois de vrais points communs avec les recruteurs.",
  5: "Précisez vos préférences de contrat, de lieu et de disponibilité pour affiner vos opportunités.",
  6: "On s'épanouit dans les entreprises dont les valeurs rejoignent les nôtres. Vos priorités disent aux recruteurs ce que vous cherchez vraiment.",
  7: 'Ajoutez les expériences qui comptent vraiment. Ce ne sont pas les plus nombreuses qui parlent le mieux de vous, mais les plus significatives.',
  8: 'Vos diplômes et formations complètent votre profil. Formations académiques, certifications, autoformations : tout ce qui a construit vos compétences a sa place ici.',
  9: "Vos compétences sont ce que vous apportez concrètement. Ajoutez-les, avec les langues que vous maîtrisez, pour que rien de ce que vous savez faire ne passe inaperçu.",
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
  { key: 'en_poste',    label: "En poste, à l'écoute",  desc: 'Vous étudiez les propositions qui vous intéressent' },
]

const LANGUES_LIST = [
  { key: 'Français'  },
  { key: 'Anglais'   },
  { key: 'Espagnol'  },
  { key: 'Allemand'  },
  { key: 'Italien'   },
  { key: 'Portugais' },
  { key: 'Arabe'     },
  { key: 'Chinois'   },
  { key: 'Autre'     },
]

const NIVEAUX_LANGUE = ['Natif', 'Courant', 'Intermédiaire', 'Débutant']

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function capitalizeFirst(v: string): string {
  if (!v) return v
  return v.charAt(0).toUpperCase() + v.slice(1)
}

// ─── Palette ──────────────────────────────────────────────────────────────────

// ─── Écran d'accueil ──────────────────────────────────────────────────────────

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div style={{ backgroundColor: C.bg, minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
      <style suppressHydrationWarning>{`
        @keyframes kv-onde  { 0%{transform:scale(.2);opacity:0} 10%{opacity:1} 100%{transform:scale(1);opacity:0} }
        @keyframes kv-osc   { 0%{transform:rotate(-55deg)} 45%{transform:rotate(16deg)} 70%{transform:rotate(-6deg)} 88%{transform:rotate(2deg)} 100%{transform:rotate(0)} }
        @keyframes kv-luit  { 0%,100%{opacity:.35} 50%{opacity:.8} }
        @keyframes kv-halo  { 0%{transform:scale(1);opacity:.9} 100%{transform:scale(3.4);opacity:0} }
        @keyframes kv-monte { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }

        .kv-onde  { fill:none; stroke:rgba(36,69,58,.35); stroke-width:1.2; transform-box:fill-box; transform-origin:center; animation:kv-onde 6s cubic-bezier(.2,.6,.3,1) infinite both }
        .kv-pt-cl { fill:rgba(36,69,58,.45); animation:kv-luit 4.5s ease-in-out infinite }
        .kv-halo  { fill:none; stroke:${C.orange}; stroke-width:1.5; transform-box:fill-box; transform-origin:center; animation:kv-halo 2.4s ease-out infinite }
        .kv-osc   { transform-box:fill-box; transform-origin:50% 70%; animation:kv-osc 1150ms cubic-bezier(.35,0,.25,1) 100ms both }

        .kv-etage > *              { animation:kv-monte .5s cubic-bezier(.2,.9,.3,1) both }
        .kv-etage > *:nth-child(2) { animation-delay:.06s }
        .kv-etage > *:nth-child(3) { animation-delay:.12s }
        .kv-etage > *:nth-child(4) { animation-delay:.18s }
        .kv-etage > *:nth-child(5) { animation-delay:.24s }

        .kv-atouts li              { animation:kv-monte .45s cubic-bezier(.2,.9,.3,1) both }
        .kv-atouts li:nth-child(2) { animation-delay:.08s }
        .kv-atouts li:nth-child(3) { animation-delay:.16s }

        .kv-visuel-bg { background:radial-gradient(closest-side at 60% 50%, #EAF0EC, rgba(234,240,236,0)) }

        .kv-btn-acc { transition:background-color .2s,transform .15s }
        .kv-btn-acc:hover { background-color:${C.orangeTexte} !important; transform:translateY(-1px) }

        @media (prefers-reduced-motion: reduce) {
          .kv-onde,.kv-pt-cl,.kv-halo,.kv-osc,.kv-etage > *,.kv-atouts li { animation:none !important }
        }
        @media (max-width: 640px) {
          .kv-visuel-onde { display:none !important }
          .kv-etage { padding:88px 24px 40px !important }
        }
      `}</style>

      {/* Logo top-left */}
      <div style={{ position:'absolute', top:22, left:28, zIndex:2, display:'inline-flex', alignItems:'center', gap:10 }}>
        <LogoKapolia variante="sombre" taille={24} avecTexte={false} />
        <span style={{ fontFamily:FONT_LOGO, fontWeight:600, fontSize:20, color:C.vert, lineHeight:1 }}>Kapolia</span>
      </div>

      {/* Visuel ondes — côté droit */}
      <div
        className="kv-visuel-onde kv-visuel-bg"
        aria-hidden="true"
        style={{ position:'absolute', top:0, right:0, bottom:0, width:'48%', pointerEvents:'none', overflow:'hidden' }}
      >
        <svg viewBox="0 0 600 600" style={{ position:'absolute', right:'-22%', top:'50%', transform:'translateY(-50%)', width:'125%', height:'auto' }}>
          <circle className="kv-onde" cx={300} cy={300} r={290} />
          <circle className="kv-onde" cx={300} cy={300} r={290} style={{ animationDelay:'1.5s' }} />
          <circle className="kv-onde" cx={300} cy={300} r={290} style={{ animationDelay:'3s' }} />
          <circle className="kv-onde" cx={300} cy={300} r={290} style={{ animationDelay:'4.5s' }} />
          {([[230,190,4,0],[420,440,4,1.2],[176,372,3.5,2.1],[372,58,3.5,.6],[470,210,3,2.8],[120,250,3,1.7],[250,500,3.5,3.4]] as [number,number,number,number][]).map(([cx,cy,r,d],i) => (
            <circle key={i} className="kv-pt-cl" cx={cx} cy={cy} r={r} style={{ animationDelay:`${d}s` }} />
          ))}
          <circle className="kv-halo" cx={300} cy={140} r={7} />
          <circle fill={C.orange} cx={300} cy={140} r={6} />
          <g transform="translate(300 300) scale(3.6) translate(-21 -21)">
            <g className="kv-osc">
              <path d="M14 29 L21 12 L28 29" fill="none" stroke={C.vert} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 29 L21 25 L28 29" fill="none" stroke={C.orange} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </g>
        </svg>
      </div>

      {/* Colonne texte */}
      <div className="kv-etage" style={{ position:'relative', zIndex:1, padding:'72px 64px 40px', display:'flex', flexDirection:'column', gap:22, maxWidth:640 }}>
        <h1 style={{ fontFamily:FONT_SANS, fontWeight:700, fontSize:54, lineHeight:1.02, color:C.dark, margin:0, letterSpacing:'-0.015em' }}>
          Bienvenue<br />sur Kapolia&#160;!
        </h1>
        <p style={{ margin:0, color:C.grey, fontSize:18, lineHeight:1.55, maxWidth:480 }}>
          Ici, aucun document à préparer ni à joindre. Vous créez votre profil une fois, puis vous postulez avec.
        </p>
        <ul className="kv-atouts" style={{ listStyle:'none', margin:'4px 0 6px', padding:0, display:'flex', flexDirection:'column', gap:14, maxWidth:500 }}>
          {([
            ['Postulez en un clic',          ' aux offres qui vous intéressent.'],
            ['Voyez ce qui vous correspond', ' : chaque offre affiche son degré de correspondance avec votre profil.'],
            ['Montrez qui vous êtes',        ', au-delà de vos diplômes : vos qualités, vos projets, ce que vous cherchez.'],
          ] as [string,string][]).map(([bold, rest], i) => (
            <li key={i} style={{ display:'flex', gap:12, alignItems:'flex-start', fontSize:16.5, lineHeight:1.45, color:C.dark }}>
              <span style={{ width:24, height:24, borderRadius:'50%', backgroundColor:C.orangeDoux, color:C.orangeTexte, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span><b style={{ fontWeight:600 }}>{bold}</b>{rest}</span>
            </li>
          ))}
        </ul>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <button
            onClick={onStart}
            className="kv-btn-acc"
            style={{ display:'inline-flex', alignSelf:'flex-start', backgroundColor:C.orange, color:C.white, border:'none', borderRadius:100, padding:'14px 28px', fontSize:16, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}
          >
            Commencer
          </button>
          <span style={{ fontSize:14, color:C.grey }}>Environ 10 minutes. Vos réponses sont enregistrées à chaque étape.</span>
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
  onProgress,
}: {
  userId:         string
  onComplete:     (done: boolean) => void
  forceEmpty?:    boolean
  writeDate?:     boolean
  onRefaireDone?: () => void
  onProgress?:    (answered: number) => void
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

  useEffect(() => { onProgress?.(answeredCount) }, [selections]) // eslint-disable-line react-hooks/exhaustive-deps

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
              <div key={r.qualite} className="kv-bloc kv-sel" style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', borderRadius: 24,
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
              aria-pressed={selected}
              className={`kv-bloc${selected ? ' kv-sel' : ''}${flashing ? ' kv-flash' : ''}`}
              style={{
                textAlign: 'left', padding: '13px 16px', borderRadius: 12,
                color: C.dark, fontSize: 14, lineHeight: 1.5, cursor: 'pointer',
                fontFamily: 'inherit', outline: 'none',
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
          className="kv-bloc"
          style={{
            flex: 1, padding: '12px 16px', borderRadius: 12,
            color: idx === 0 ? C.grey : C.dark,
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
  const [saveError, setFinalSaveError]  = useState(false)
  const pendingChoiceRef                = useRef<boolean | null>(null)
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
    pendingChoiceRef.current = value
    setSaving(true)
    setFinalSaveError(false)
    const { error } = await supabase.from('profils').update({
      visible_candidatheque: value,
      visible_candidatheque_maj_le: new Date().toISOString(),
    }).eq('user_id', userId)
    setSaving(false)
    if (error) { console.error(error); setFinalSaveError(true); return }
    setChosen(value)
  }

  return (
    <main style={{
      backgroundColor: C.bg,
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
        <LogoKapolia variante="sombre" taille={52} avecTexte={false} />
      </div>

      {/* Titre */}
      <h1 className="final-title" style={{
        fontFamily: FONT_SANS, letterSpacing: '-0.005em',
        fontWeight: 700,
        lineHeight: 1.1,
        color: C.dark,
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
        color: C.grey,
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
          {saveError && (
            <div role="alert" style={{
              backgroundColor: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            }}>
              <span style={{ fontSize: 13, color: '#22312B', lineHeight: 1.5 }}>
                L'enregistrement n'a pas abouti. Vérifiez votre connexion, puis réessayez.
              </span>
              <button
                onClick={() => pendingChoiceRef.current !== null && handleChoice(pendingChoiceRef.current)}
                style={{
                  background: 'none', border: 'none', fontSize: 13, fontWeight: 600,
                  color: C.terracotta, cursor: 'pointer', padding: '4px 0', flexShrink: 0,
                  fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px',
                }}>
                Réessayer
              </button>
            </div>
          )}
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
                color: invitHover ? C.dark : C.grey,
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

function QuestionLabel({ text, sub, optional }: { text: string; sub?: string; optional?: boolean }) {
  return (
    <>
      {optional && (
        <span style={{
          display: 'inline-block', fontSize: 13, fontWeight: 600,
          color: C.grey, backgroundColor: C.chip, borderRadius: 6,
          padding: '2px 8px', marginBottom: 10,
        }}>
          Facultatif
        </span>
      )}
      <h1
        id="titre-etape"
        tabIndex={-1}
        style={{
          fontFamily: FONT_SANS, letterSpacing: '-0.005em',
          fontSize: 'clamp(24px, 3.5vw, 30px)',
          color: C.dark, lineHeight: 1.15,
          margin: sub ? '0 0 8px' : '0 0 28px',
          fontWeight: 700, outline: 'none',
        }}
      >
        {text}
      </h1>
      {sub && (
        <p style={{ fontSize: 15.5, color: C.grey, lineHeight: 1.55, margin: '0 0 26px', maxWidth: 540 }}>
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
      aria-pressed={selected}
      className={`kv-bloc${selected ? ' kv-sel' : ''}`}
      style={{
        width: '100%', textAlign: 'left', padding: '14px 18px',
        borderRadius: 14,
        cursor: disabled ? 'default' : 'pointer',
        marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <span style={{
        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${selected ? C.terracotta : '#C3CAC5'}`,
        position: 'relative', transition: 'border-color 0.15s',
      }}>
        {selected && (
          <span style={{
            position: 'absolute', inset: 3, borderRadius: '50%',
            backgroundColor: C.terracotta,
          }} />
        )}
      </span>
      <span style={{ flex: 1 }}>
        <span style={{ fontSize: 15.5, fontWeight: 600, color: C.dark, display: 'block' }}>
          {label}
        </span>
        {desc && (
          <span style={{ fontSize: 14, color: C.grey, marginTop: 1, display: 'block' }}>
            {desc}
          </span>
        )}
      </span>
    </button>
  )
}

function StyledInput({ value, onChange, placeholder, autoFocus, label }: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; label?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <label style={{ fontSize: 14, fontWeight: 600, color: C.dark }}>{label}</label>}
      <input
        type="text"
        value={value}
        onChange={e => onChange(capitalizeFirst(e.target.value))}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="kv-field"
        style={{
          width: '100%', padding: '13px 16px', fontSize: 16,
          borderRadius: 12, border: '1.5px solid transparent',
          backgroundColor: C.white, color: C.dark, outline: 'none',
          boxSizing: 'border-box', fontFamily: 'inherit',
        }}
      />
    </div>
  )
}

function StyledTextArea({ value, onChange, placeholder, rows = 5, label }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; label?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <label style={{ fontSize: 14, fontWeight: 600, color: C.dark }}>{label}</label>}
      <textarea
        value={value}
        onChange={e => onChange(capitalizeFirst(e.target.value))}
        placeholder={placeholder}
        rows={rows}
        className="kv-field"
        style={{
          width: '100%', padding: '13px 16px', fontSize: 15,
          borderRadius: 12, border: '1.5px solid transparent',
          backgroundColor: C.white, color: C.dark, outline: 'none',
          boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.65,
          fontFamily: 'inherit',
        }}
      />
    </div>
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
        onChange={e => onChange(capitalizeFirst(e.target.value))}
        placeholder={placeholder}
        rows={rows}
        className="kv-field"
        style={{
          width: '100%', padding: '13px 16px',
          paddingBottom: supported ? '46px' : '13px',
          fontSize: 15,
          borderRadius: 12, border: '1.5px solid transparent',
          backgroundColor: C.white, color: C.dark, outline: 'none',
          boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.65,
          fontFamily: 'inherit',
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
          className="kv-field"
          style={{
            width: '100%', padding: '13px 16px', fontSize: 15,
            borderRadius: 12, border: '1.5px solid transparent',
            backgroundColor: C.white, color: C.dark, outline: 'none',
            boxSizing: 'border-box', fontFamily: 'inherit',
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
          className="kv-field"
          style={{
            width: '100%', padding: '13px 16px', fontSize: 14,
            borderRadius: 12, border: '1.5px solid transparent',
            backgroundColor: C.white, color: C.dark, outline: 'none',
            boxSizing: 'border-box', fontFamily: 'inherit',
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
  const [step3Complete, setStep3Complete] = useState(false)
  const [data, setData] = useState<FormData>({
    prenom: '', nom: '', domaine: '', experience: '', parcours: '',
    projet: '', projet_titre: '', passions: [],
    disponibilite: '', dispo_date: '',
    typePoste: [], lieu: '', ville: '', permis: [], priorite: [],
    experiences: [], diplomes: [], competences_acquises: [], langues: [],
  })
  const [saving,           setSaving]           = useState(false)
  const [saveError,        setSaveError]        = useState(false)
  const [savedOk,          setSavedOk]          = useState(false)
  const [loadingResume,    setLoadingResume]    = useState(true)
  const [userId,           setUserId]           = useState('')
  const [emailConfirme,    setEmailConfirme]    = useState(true)
  const [qualitesProgress, setQualitesProgress] = useState(0)
  // Ref pour le step max atteint — ne régresse jamais, même si l'utilisateur revient en arrière.
  // Stocke la valeur DB (101–109), pas le numéro d'écran (1–9).
  const maxStepRef       = useRef(screenToStep(1))
  const savedOkTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

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
          .select('prenom, nom, domaine, experience, signature, type_entreprise, valeur, projet_phare, projet_titre, passions, type_poste, mode_travail, ville, permis, priorites, disponibilite, dispo_date, experiences, diplomes, competences_acquises, langues, onboarding_step')
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('test_qualites')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
      ])

      const allTestDone = (testCount ?? 0) >= SITUATIONS[CURRENT_VERSION].length
      if (allTestDone) setStep3Complete(true)

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
          permis:               Array.isArray(p.permis) ? p.permis as string[] : [],
          priorite:             Array.isArray(p.priorites) ? p.priorites as string[] : [],
          disponibilite:        (p.disponibilite as string) || '',
          dispo_date:           (p.dispo_date as string)   || '',
          experiences:          Array.isArray(p.experiences) ? p.experiences as Experience[] : [],
          diplomes:             Array.isArray(p.diplomes) ? p.diplomes as Diplome[] : [],
          competences_acquises: Array.isArray(p.competences_acquises) ? p.competences_acquises as string[] : [],
          langues:              Array.isArray(p.langues) ? p.langues as string[] : [],
        }
        // Reprend exactement au step enregistré, avec firstIncompleteStep en filet de sécurité
        const savedStep    = typeof p.onboarding_step === 'number' ? p.onboarding_step : 0
        const convertedScreen = savedStep > 1 ? convertSavedStep(savedStep) : 1
        const resumeAt     = Math.min(convertedScreen, firstIncompleteStep(filled, allTestDone))
        maxStepRef.current = Math.max(screenToStep(resumeAt), screenToStep(1))
        setData(filled)
        setStep(resumeAt)
        setShowWelcome(false)
      }

      setLoadingResume(false)
    }
    resumeIfNeeded()
  }, [])

  useEffect(() => {
    document.getElementById('titre-etape')?.focus()
  }, [step])

  const blockIndex = BLOCKS.findIndex(b => b.steps.includes(step))

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  function isValid(): boolean {
    switch (step) {
      case 1: return data.prenom.trim().length > 0 && data.nom.trim().length > 0
      case 2: return data.domaine.length > 0 && data.experience.length > 0
      case 3: return step3Complete
      case 4: {
        const hasDesc = data.projet.trim().length > 0
        return !hasDesc || data.projet_titre.trim().length > 0
      }
      case 5: return (
        data.typePoste.length > 0 &&
        data.lieu.length > 0 &&
        data.disponibilite.length > 0 &&
        (data.disponibilite !== 'a_partir_de' || data.dispo_date.length > 0)
      )
      case 6:  return true
      case 7:  return true
      case 8:  return true
      case 9:  return true
      default: return false
    }
  }

  // Sauvegarde progressive : persiste l'étape courante dans profils et met à jour le max atteint.
  async function saveStep(currentStep: number): Promise<boolean> {
    const payload = buildStepPayload(currentStep, data, maxStepRef.current)
    if (!payload) return true
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { error } = await supabase.from('profils').upsert(
      { user_id: user.id, ...payload },
      { onConflict: 'user_id' }
    )
    if (error) { console.error(error); return false }
    return true
  }

  async function handleNext() {
    if (saving) return
    if (step < TOTAL) {
      const nextScreen = step + 1
      maxStepRef.current = Math.max(maxStepRef.current, screenToStep(nextScreen))
      setSaving(true)
      setSaveError(false)
      const ok = await saveStep(step)
      setSaving(false)
      if (!ok) { setSaveError(true); return }
      if (savedOkTimerRef.current) clearTimeout(savedOkTimerRef.current)
      setSavedOk(true)
      savedOkTimerRef.current = setTimeout(() => setSavedOk(false), 2000)
      setStep(nextScreen)
      return
    }
    // Écran final (9) : upsert complet + onboarding_completed = true
    setSaving(true)
    setSaveError(false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error()
      const { error } = await supabase.from('profils').upsert({
        user_id: user.id,
        type_compte: 'candidat',
        prenom: data.prenom,
        nom: data.nom,
        domaine: data.domaine,
        experience: data.experience,
        projet_phare: data.projet,
        projet_titre: data.projet_titre || null,
        passions: data.passions,
        type_poste: data.typePoste,
        mode_travail: data.lieu,
        ville: data.ville || null,
        permis: data.permis,
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
      console.error(err)
      setSaveError(true)
      setSaving(false)
    }
  }

  function handleBack() {
    if (step > 1) setStep(s => s - 1)
    // Pas de save : le retour arrière ne modifie pas la progression en base
  }

  function handleSkip() {
    if (step < TOTAL) {
      const nextScreen = step + 1
      maxStepRef.current = Math.max(maxStepRef.current, screenToStep(nextScreen))
      setStep(nextScreen)
    } else {
      handleNext()
    }
  }

  function renderStep() {
    switch (step) {
      case 1:
        return (
          <>
            <QuestionLabel text="Comment vous appelez-vous ?" sub={MICRO_TEXTS[1]} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <StyledInput value={data.prenom} onChange={v => set('prenom', v)} placeholder="Prénom" autoFocus />
              <StyledInput value={data.nom}    onChange={v => set('nom', v)}    placeholder="Nom" />
            </div>
          </>
        )

      case 2:
        return (
          <>
            <QuestionLabel text="Votre domaine et votre expérience" sub={MICRO_TEXTS[2]} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px' }}>
              {DOMAINES.map(d => (
                <button key={d} onClick={() => set('domaine', d)}
                  aria-pressed={data.domaine === d}
                  className={`kv-bloc${data.domaine === d ? ' kv-sel' : ''}`}
                  style={{
                    padding: '10px 18px', borderRadius: 24, fontFamily: 'inherit',
                    color: data.domaine === d ? C.orangeTexte : C.dark,
                    fontSize: 14, fontWeight: data.domaine === d ? 600 : 400,
                    cursor: 'pointer',
                  }}>
                  {d}
                </button>
              ))}
            </div>
            <p style={{ fontSize: '12px', fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              Niveau d'expérience
            </p>
            {EXPERIENCES.map(e => (
              <ChoiceCard key={e.key} label={e.key} desc={e.desc}
                selected={data.experience === e.key} onClick={() => set('experience', e.key)} />
            ))}
          </>
        )

      case 3:
        return (
          <>
            <QuestionLabel text="Vos qualités" sub={MICRO_TEXTS[3]} />
            <QualitesCarousel
              userId={userId}
              onComplete={done => setStep3Complete(done)}
              onProgress={n => setQualitesProgress(n)}
            />
          </>
        )

      case 4:
        return (
          <>
            <QuestionLabel text="Votre projet phare et vos passions" sub={MICRO_TEXTS[4]} optional />
            <input
              type="text"
              value={data.projet_titre}
              onChange={e => {
                const v = e.target.value
                if (v.length <= MAX_PROJET_TITRE || v.length < data.projet_titre.length) set('projet_titre', v)
              }}
              placeholder="Titre du projet (facultatif)"
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
            <div style={{ height: 24 }} />
            <p style={{ fontSize: '12px', fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              Centres d'intérêt
            </p>
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

      case 5: {
        const showDate   = data.disponibilite === 'a_partir_de'
        const allPermis  = [...PERMIS, ...PERMIS_AUTRES]
        const togglePermis = (val: string) => {
          if (val === 'aucun') { set('permis', ['aucun']); return }
          const without = data.permis.filter(v => v !== 'aucun' && v !== val)
          if (data.permis.includes(val)) set('permis', without)
          else set('permis', [...without, val])
        }
        return (
          <>
            <QuestionLabel text="Vos préférences de recherche" sub={MICRO_TEXTS[5]} />

            <p style={{ fontSize: '12px', fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              Type de contrat
            </p>
            <p style={{ fontSize: '13px', color: C.grey, marginBottom: '12px', marginTop: 0 }}>
              Vous pouvez en sélectionner plusieurs.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px' }}>
              {TYPES_POSTE.map(t => {
                const selected = data.typePoste.includes(t.key)
                return (
                  <button key={t.key} onClick={() => {
                    if (selected) set('typePoste', data.typePoste.filter(k => k !== t.key))
                    else set('typePoste', [...data.typePoste, t.key])
                  }}
                    aria-pressed={selected}
                    className={`kv-bloc${selected ? ' kv-sel' : ''}`}
                    style={{
                      padding: '11px 22px', borderRadius: 24, fontFamily: 'inherit',
                      color: selected ? C.orangeTexte : C.dark,
                      fontSize: 14, fontWeight: selected ? 600 : 400,
                      cursor: 'pointer',
                    }}>
                    {t.label}
                  </button>
                )
              })}
            </div>

            <p style={{ fontSize: '12px', fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              Lieu de travail
            </p>
            {LIEUX.map(l => (
              <ChoiceCard key={l.key} label={l.label} desc={l.description}
                selected={data.lieu === l.key} onClick={() => set('lieu', l.key)} />
            ))}
            <div style={{ marginTop: 4, marginBottom: 24 }}>
              <StyledInput
                value={data.ville}
                onChange={v => set('ville', v)}
                placeholder="Votre ville, région ou zone géographique"
                label="Ville ou région"
              />
            </div>

            <p style={{ fontSize: '12px', fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              Disponibilité
            </p>
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
                  className="kv-field"
                  style={{
                    width: '100%', padding: '13px 16px', fontSize: 16,
                    borderRadius: 12, border: '1.5px solid transparent',
                    backgroundColor: C.white, color: C.dark, outline: 'none',
                    boxSizing: 'border-box', fontFamily: 'inherit',
                  }}
                />
              </div>
            )}

            <div style={{ marginTop: '24px' }}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                Permis & habilitations (facultatif)
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                {allPermis.map(p => {
                  const sel = data.permis.includes(p.value)
                  return (
                    <button key={p.value} onClick={() => togglePermis(p.value)}
                      aria-pressed={sel}
                      className={`kv-bloc${sel ? ' kv-sel' : ''}`}
                      style={{
                        padding: '8px 16px', borderRadius: 24, fontFamily: 'inherit',
                        color: sel ? C.orangeTexte : C.dark,
                        fontSize: 14, fontWeight: sel ? 600 : 400,
                        cursor: 'pointer',
                      }}>
                      {p.label}
                    </button>
                  )
                })}
                <button onClick={() => togglePermis('aucun')}
                  aria-pressed={data.permis.includes('aucun')}
                  className={`kv-bloc${data.permis.includes('aucun') ? ' kv-sel' : ''}`}
                  style={{
                    padding: '8px 16px', borderRadius: 24, fontFamily: 'inherit',
                    color: data.permis.includes('aucun') ? C.orangeTexte : C.dark,
                    fontSize: 14, fontWeight: data.permis.includes('aucun') ? 600 : 400,
                    cursor: 'pointer',
                  }}>
                  Aucun
                </button>
              </div>
            </div>
          </>
        )
      }

      case 6: {
        const maxReached = data.priorite.length >= 3
        return (
          <>
            <QuestionLabel text="Qu'est-ce qui compte le plus dans votre prochain poste ?" sub={MICRO_TEXTS[6]} optional />
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
                  }}
                    aria-pressed={selected}
                    disabled={disabled}
                    className={`kv-bloc${selected ? ' kv-sel' : ''}`}
                    style={{
                      padding: '10px 18px', borderRadius: 24, fontFamily: 'inherit',
                      color: selected ? C.orangeTexte : C.dark,
                      fontSize: 14, fontWeight: selected ? 600 : 400,
                      cursor: disabled ? 'default' : 'pointer',
                      opacity: disabled ? 0.4 : 1,
                    }}>
                    {p}
                  </button>
                )
              })}
            </div>
          </>
        )
      }

      case 7: {
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
            <QuestionLabel text="Vos expériences professionnelles" sub={MICRO_TEXTS[7]} optional />
            {data.experiences.map((exp, i) => (
              <div key={i} className="kv-fiche" style={{
                backgroundColor: C.white, borderRadius: 14,
                boxShadow: '0 1px 2px rgba(27,48,38,.06), 0 6px 16px rgba(27,48,38,.07)',
                padding: 16, marginBottom: 12,
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
                  onChange={v => updateExp(i, { missions: capitalizeFirst(v) })}
                  rows={3}
                  textareaStyle={{
                    width: '100%', padding: '13px 16px', fontSize: 15,
                    borderRadius: 12, border: '1.5px solid transparent',
                    color: C.dark, outline: 'none',
                    boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.65,
                    fontFamily: 'inherit',
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
            <button onClick={addExp} className="kv-ajouter" style={{
              width: '100%', padding: '13px', borderRadius: 12,
              color: C.orangeTexte, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              + Ajouter une expérience
            </button>
          </>
        )
      }

      case 8: {
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
            <QuestionLabel text="Vos diplômes et formations" sub={MICRO_TEXTS[8]} optional />
            {data.diplomes.map((d, i) => (
              <div key={i} className="kv-fiche" style={{
                backgroundColor: C.white, borderRadius: 14,
                boxShadow: '0 1px 2px rgba(27,48,38,.06), 0 6px 16px rgba(27,48,38,.07)',
                padding: 16, marginBottom: 12,
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
            <button onClick={addDiplome} className="kv-ajouter" style={{
              width: '100%', padding: '13px', borderRadius: 12,
              color: C.orangeTexte, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              + Ajouter un diplôme
            </button>
          </>
        )
      }

      case 9:
        return (
          <>
            <QuestionLabel text="Compétences et langues" sub={MICRO_TEXTS[9]} />

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
              {LANGUES_LIST.map(({ key }) => {
                const selected = data.langues.some(l => l.startsWith(key + ' — '))
                return (
                  <button key={key} onClick={() => {
                    if (selected) set('langues', data.langues.filter(l => !l.startsWith(key + ' — ')))
                    else set('langues', [...data.langues, `${key} — Natif`])
                  }}
                    aria-pressed={selected}
                    className={`kv-bloc${selected ? ' kv-sel' : ''}`}
                    style={{
                      padding: '8px 16px', borderRadius: 24, fontFamily: 'inherit',
                      color: selected ? C.orangeTexte : C.dark,
                      fontSize: 14, fontWeight: selected ? 600 : 400,
                      cursor: 'pointer',
                    }}>
                    {key}
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
                  return (
                    <div key={langName} className="kv-bloc" style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      backgroundColor: C.white, borderRadius: 12,
                      padding: '10px 14px',
                    }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: C.dark, flex: 1 }}>{langName}</span>
                      <select
                        value={niveau}
                        onChange={e => set('langues', data.langues.map(l =>
                          l.startsWith(langName + ' — ') ? `${langName} — ${e.target.value}` : l
                        ))}
                        className="kv-field"
                        style={{
                          padding: '6px 10px', borderRadius: 8, fontFamily: 'inherit',
                          border: '1.5px solid transparent', backgroundColor: C.white,
                          color: C.dark, fontSize: 13, cursor: 'pointer', outline: 'none',
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
  const transition = TRANSITIONS[step]

  return (
    <main style={{ backgroundColor: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <style suppressHydrationWarning>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes kapolia-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(194, 97, 31,.45); }
          50%       { box-shadow: 0 0 0 7px rgba(194, 97, 31,0); }
        }
        /* Blocs sans contour — ombre légère, survol soulevé, sélectionné pêche */
        .kv-bloc {
          border: 0 !important;
          background: #FFFFFF;
          box-shadow: 0 1px 2px rgba(27,48,38,.06), 0 6px 16px rgba(27,48,38,.07);
          transition: box-shadow .2s, background-color .15s, transform .15s;
        }
        .kv-bloc:hover:not(:disabled) {
          box-shadow: 0 1px 2px rgba(27,48,38,.07), 0 10px 22px rgba(27,48,38,.10);
          transform: translateY(-1px);
        }
        .kv-bloc.kv-sel, .kv-bloc[aria-pressed="true"] {
          background: #FBEDE3 !important;
          box-shadow: 0 1px 2px rgba(194,97,31,.10), 0 6px 16px rgba(194,97,31,.12) !important;
        }
        .kv-bloc.kv-flash { background: rgba(194,97,31,.12) !important; }
        /* Bouton Ajouter */
        .kv-ajouter {
          border: 0 !important;
          background: #FFFFFF;
          box-shadow: 0 1px 2px rgba(27,48,38,.06), 0 6px 16px rgba(27,48,38,.07);
          transition: box-shadow .2s, transform .15s;
        }
        .kv-ajouter:hover { box-shadow: 0 1px 2px rgba(27,48,38,.07), 0 10px 22px rgba(27,48,38,.10); transform: translateX(2px); }
        /* Champs sans contour — ombre sur fond gris */
        .kv-field {
          border: 1.5px solid transparent !important;
          box-shadow: 0 1px 2px rgba(27,48,38,.06), 0 6px 16px rgba(27,48,38,.07) !important;
        }
        .kv-field:focus {
          border-color: #C2611F !important;
          box-shadow: 0 0 0 3px rgba(194,97,31,.14) !important;
          outline: none !important;
        }
        /* Champs dans les cartes blanches */
        .kv-fiche .kv-field,
        .kv-fiche input[type=text], .kv-fiche input[type=date],
        .kv-fiche select, .kv-fiche textarea {
          background: #F2F4F2 !important;
          box-shadow: none !important;
          border: 1.5px solid transparent !important;
        }
        .kv-fiche .kv-field:focus,
        .kv-fiche input[type=text]:focus, .kv-fiche input[type=date]:focus,
        .kv-fiche select:focus, .kv-fiche textarea:focus {
          background: #FFFFFF !important;
          border-color: #C2611F !important;
          box-shadow: 0 0 0 3px rgba(194,97,31,.14) !important;
          outline: none !important;
        }
        #titre-etape:focus { outline: none; }
      `}</style>

      {/* En-tête */}
      <header style={{
        padding: '14px clamp(20px, 5%, 48px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${C.sable}`,
        backgroundColor: C.bg,
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <LogoKapolia variante="sombre" taille={24} avecTexte={false} />
          <span style={{ fontFamily: FONT_LOGO, fontWeight: 600, fontSize: 20, color: C.vert, lineHeight: 1 }}>
            Kapolia
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.succes,
            opacity: savedOk ? 1 : 0, transition: 'opacity 0.3s',
          }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M2 7l3.5 3.5 5.5-6" stroke={C.succes} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Enregistré
          </span>
          <span style={{ fontSize: 13.5, color: C.grey, fontVariantNumeric: 'tabular-nums' }}>
            Étape <strong style={{ color: C.dark }}>{step}</strong> sur {TOTAL}
          </span>
        </div>
      </header>

      {/* Barre de progression — 5 blocs côte à côte */}
      <div style={{ padding: '14px clamp(20px, 5%, 48px) 0', display: 'flex', gap: 6 }}>
        {BLOCKS.map(b => {
          const isDone    = b.steps[b.steps.length - 1] < step
          const isCurrent = b.steps.includes(step)
          let fillPct = 0
          if (isDone) {
            fillPct = 100
          } else if (isCurrent) {
            fillPct = b.label === 'Vos qualités'
              ? (qualitesProgress / TOTAL_SITUATIONS) * 100
              : (b.steps.indexOf(step) / b.steps.length) * 100
          }
          return (
            <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
              <div style={{ height: 4, borderRadius: 2, backgroundColor: C.sable }}>
                <div style={{
                  height: '100%', borderRadius: 2, backgroundColor: C.orange,
                  width: `${fillPct}%`, transition: 'width 0.7s cubic-bezier(.3,.9,.3,1)',
                }} />
              </div>
              <span style={{
                fontSize: 12.5, color: isCurrent ? C.dark : C.grey,
                fontWeight: isCurrent ? 600 : 400,
                display: 'flex', alignItems: 'center', gap: 5,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                transition: 'color 0.3s',
              }}>
                {isDone && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <path d="M2 6l3 3 5-5" stroke={C.succes} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {b.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Contenu de l'étape */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '24px clamp(20px, 5%, 48px) 32px', overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: 600 }}>
          {saveError && (
            <div role="alert" style={{
              backgroundColor: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)',
              borderRadius: 10, padding: '12px 16px', marginBottom: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <span style={{ fontSize: '14px', color: C.dark, lineHeight: '1.5' }}>
                L'enregistrement n'a pas abouti. Vérifiez votre connexion, puis réessayez.
              </span>
              <button onClick={handleNext} style={{
                background: 'none', border: 'none', fontSize: '13px', fontWeight: '600',
                color: C.terracotta, cursor: 'pointer', padding: '4px 0', flexShrink: 0,
                fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px',
              }}>
                Réessayer
              </button>
            </div>
          )}
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

      {/* Pied fixe */}
      <footer style={{
        padding: '14px clamp(20px, 5%, 48px)',
        borderTop: `1px solid ${C.sable}`,
        backgroundColor: C.bg,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={handleBack} disabled={saving} style={{
            background: 'none', border: 'none', padding: '10px 0', fontSize: 15,
            color: C.grey, cursor: saving ? 'default' : 'pointer',
            fontFamily: 'inherit',
            visibility: step === 1 ? 'hidden' : 'visible',
          }}>
            Retour
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {isOpt && !saving && (
              <button onClick={handleSkip} style={{
                background: 'none', border: 'none', padding: '10px 0',
                fontSize: 14.5, color: C.grey, cursor: 'pointer',
                fontFamily: 'inherit', fontWeight: 400,
                textDecoration: 'underline', textUnderlineOffset: 3,
              }}>
                Passer
              </button>
            )}
            <button onClick={handleNext} disabled={!isValid() || saving} style={{
              backgroundColor: isValid() && !saving ? C.terracotta : C.sable,
              color: isValid() && !saving ? 'white' : C.grey,
              border: 'none', borderRadius: '12px',
              padding: '12px 28px', fontSize: '15px', fontWeight: '500',
              cursor: isValid() && !saving ? 'pointer' : 'default',
              transition: 'background-color 0.2s, color 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              minWidth: '120px', fontFamily: 'inherit',
            }}>
              {saving && (
                <span style={{
                  width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0,
                  border: '2px solid rgba(255,255,255,0.35)', borderTopColor: 'white',
                  display: 'inline-block', animation: 'spin 0.7s linear infinite',
                }} />
              )}
              {step === TOTAL ? 'Terminer' : 'Suivant'}
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
