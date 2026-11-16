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
import ChampSuggestions from '@/components/profil/ChampSuggestions'
import { PASSIONS_SUGGESTIONS } from '@/components/profil/IconesPassions'
import SignatureCounter from '@/components/SignatureCounter'
import { MAX_SIGNATURE, MAX_PROJET_TITRE, MAX_PROJET_DESC } from '@/lib/constants'
import { COMP_REF, PREFERENCES_TELETRAVAIL, PERMIS, PERMIS_AUTRES } from '@/lib/referentiels'
import { C, CARD_SHADOW, CARD_RADIUS } from '@/lib/colors'
import { SUGGESTIONS_QUALITES } from '@/lib/qualites'

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
  1: "C'est ainsi que les recruteurs verront votre nom sur votre profil.",
  2: 'Ces deux réponses orientent les offres que nous vous proposons.',
  3: "Neuf situations de travail, quatre réponses chacune. Choisissez les deux qui vous ressemblent le plus.",
  4: 'Une réalisation concrète et ce que vous aimez en dehors du travail. Les recruteurs y trouvent souvent des points communs.',
  5: "Nous ne vous présentons que les offres qui correspondent à votre situation.",
  6: "Choisissez jusqu'à trois priorités. Elles disent aux recruteurs ce que vous cherchez vraiment.",
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
    <div className="kv-acc3-wrap" style={{ backgroundColor: C.bg, minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
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
          .kv-acc3-wrap { flex-direction:column !important; align-items:stretch !important; justify-content:flex-start !important; overflow-x:hidden }
          .kv-visuel-onde { position:relative !important; top:auto !important; right:auto !important; bottom:auto !important; left:auto !important; width:100% !important; height:320px; flex:none; order:2; margin-top:-90px; overflow:hidden; -webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 34%); mask-image:linear-gradient(to bottom,transparent 0,#000 34%) }
          .kv-visuel-onde svg { right:auto !important; left:50% !important; top:58% !important; transform:translate(-50%,-50%) !important; width:380px !important; height:auto !important }
          .kv-etage { padding:72px 20px 0 !important; gap:18px !important; z-index:1 }
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
  const [idx,              setIdx]              = useState(0)
  const [selections,       setSelections]       = useState<Record<number, (1|2|3|4)[]>>({})
  const [savingIdx,        setSavingIdx]        = useState<number | null>(null)
  const [phase,            setPhase]            = useState<'intro' | 'quiz' | 'done'>('intro')
  const [flashId,          setFlashId]          = useState<number | null>(null)
  const [loading,          setLoading]          = useState(true)
  const [updateError,      setUpdateError]      = useState('')
  const [qualitesDecl,     setQualitesDecl]     = useState<string[]>([])
  const [invitModalOpen,   setInvitModalOpen]   = useState(false)
  const [invitActiveCount, setInvitActiveCount] = useState(0)
  const [invitLien,        setInvitLien]        = useState<string | null>(null)
  const [invitCopie,       setInvitCopie]       = useState(false)
  const [declSaveError,    setDeclSaveError]    = useState(false)
  const [declSaved,        setDeclSaved]        = useState(false)

  // Charge les réponses existantes
  useEffect(() => {
    if (!userId) return
    if (forceEmpty) { setPhase('quiz'); setLoading(false); return }
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
            const situations = SITUATIONS[CURRENT_VERSION]
            const firstUnanswered = situations.findIndex(s => !loaded[s.id])
            setIdx(firstUnanswered >= 0 ? firstUnanswered : 0)
            setPhase('quiz')
          }
        }
        setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Charge qualitesDecl et activeInvitations quand le résultat est affiché
  useEffect(() => {
    if (phase !== 'done' || !userId) return
    supabase.from('profils').select('qualites').eq('user_id', userId).single()
      .then(({ data }) => { if (data?.qualites) setQualitesDecl(data.qualites as string[]) })
    const now = new Date().toISOString()
    supabase.from('invitations_proches').select('id', { count: 'exact', head: true })
      .eq('candidat_id', userId).gt('expire_at', now).is('used_at', null)
      .then(({ count }) => setInvitActiveCount(count ?? 0))
  }, [phase, userId])

  function handleSelect(reponseId: 1|2|3|4) {
    const sitId = SITUATIONS[CURRENT_VERSION][idx].id
    const current = selections[sitId] ?? []
    if (current.includes(reponseId)) {
      setSelections(prev => ({ ...prev, [sitId]: current.filter(r => r !== reponseId) }))
      return
    }
    if (current.length < 2) {
      setSelections(prev => ({ ...prev, [sitId]: [...current, reponseId] }))
      return
    }
    // LIFO : un 3e clic remplace la 2e sélection
    const replaced = current[1]
    setFlashId(replaced)
    setTimeout(() => setFlashId(null), 300)
    setSelections(prev => ({ ...prev, [sitId]: [current[0], reponseId] }))
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
          user_id:      userId,
          situation_id: situation.id,
          reponse_1:    sel[0],
          reponse_2:    sel[1],
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

  async function handleRefaire() {
    await supabase.from('test_qualites').delete().eq('user_id', userId)
    await supabase.from('profils').update({ qualites_test: null }).eq('user_id', userId)
    setSelections({})
    setIdx(0)
    setPhase('intro')
    onComplete(false)
  }

  async function handleQualitesDeclChange(vals: string[]) {
    setQualitesDecl(vals)
    setDeclSaveError(false)
    setDeclSaved(false)
    const { error } = await supabase.from('profils').update({ qualites: vals }).eq('user_id', userId)
    if (error) {
      console.error('[profils.qualites] update error:', error)
      setDeclSaveError(true)
    } else {
      setDeclSaved(true)
      setTimeout(() => setDeclSaved(false), 2000)
    }
  }

  function handleCopierLien() {
    if (!invitLien) return
    navigator.clipboard.writeText(invitLien).then(() => {
      setInvitCopie(true)
      setTimeout(() => setInvitCopie(false), 2500)
    }).catch(() => {})
  }

  if (loading) return null

  const situations    = SITUATIONS[CURRENT_VERSION]
  const answeredCount = Object.keys(selections).filter(k => (selections[Number(k)] ?? []).length === 2).length

  useEffect(() => { onProgress?.(answeredCount) }, [selections]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Intro ──────────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <style suppressHydrationWarning>{`
          .kv-iq-n {
            display: inline-flex; align-items: center; justify-content: center;
            width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
            background: ${C.orange}; color: #fff; font-size: 12px; font-weight: 700;
          }
        `}</style>
        <p style={{ fontSize: 14.5, color: C.dark, lineHeight: 1.7, margin: 0 }}>
          Un recruteur veut savoir ce que vous savez faire, mais aussi comment vous travaillez. Plutôt que de vous demander de vous décrire, Kapolia vous propose neuf situations de travail. Vos réactions font ressortir vos qualités.
        </p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span className="kv-iq-n">1</span>
            <span style={{ fontSize: 14, color: C.dark, lineHeight: 1.6 }}>
              <b>Pour chaque situation, choisissez deux réactions</b>, celles qui vous ressemblent le plus.
            </span>
          </li>
          <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span className="kv-iq-n">2</span>
            <span style={{ fontSize: 14, color: C.dark, lineHeight: 1.6 }}>
              <b>Il n'y a pas de bonne réponse.</b> Répondez ce que vous feriez vraiment, pas ce qui semble attendu.
            </span>
          </li>
          <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span className="kv-iq-n">3</span>
            <span style={{ fontSize: 14, color: C.dark, lineHeight: 1.6 }}>
              <b>Vos qualités s'affichent sur votre profil.</b> Elles montrent aux recruteurs comment vous travaillez et vous distinguent des profils au parcours proche.
            </span>
          </li>
        </ul>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
          <button
            onClick={() => setPhase('quiz')}
            style={{
              padding: '12px 28px', borderRadius: 100, border: 'none',
              backgroundColor: C.orange, color: C.white,
              fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Commencer le questionnaire
          </button>
          <span style={{ fontSize: 13, color: C.grey }}>Environ 4 minutes</span>
        </div>
      </div>
    )
  }

  // ── Résultat ───────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const answers = situations
      .map(s => {
        const r = selections[s.id]
        if (!r || r.length < 2) return null
        return { situation_id: s.id, reponse_1: r[0], reponse_2: r[1], version_test: CURRENT_VERSION } as TestAnswer
      })
      .filter((a): a is TestAnswer => a !== null)
    const resultats         = calculerQualites(answers)
    const testQualiteLabels = resultats.map(r => QUALITE_LABELS[r.qualite] ?? r.qualite)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <style suppressHydrationWarning>{`
          .kv-proche-lien { display: flex; align-items: center; gap: 10; flex-wrap: wrap; }
          @media (max-width: 640px) { .kv-proche-lien { flex-direction: column; align-items: flex-start; } }
        `}</style>

        {/* Ce qui ressort de vos réponses */}
        <div style={{ backgroundColor: C.white, borderRadius: CARD_RADIUS, padding: '20px', boxShadow: CARD_SHADOW }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: C.dark, margin: '0 0 14px', lineHeight: 1.3 }}>
            Ce qui ressort de vos réponses
          </h3>
          {resultats.length === 0 ? (
            <p style={{ fontSize: 14, color: C.grey, margin: '0 0 12px', lineHeight: 1.6 }}>
              Aucune qualité n'est apparue deux fois ou plus.
            </p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {resultats.map(r => (
                <span key={r.qualite} style={{
                  padding: '5px 14px', borderRadius: 100,
                  backgroundColor: `${C.vert}18`, color: C.vert,
                  fontSize: 13.5, fontWeight: 600, border: `1px solid ${C.vert}30`,
                }}>
                  {QUALITE_LABELS[r.qualite] ?? r.qualite}
                </span>
              ))}
            </div>
          )}
          <p style={{ fontSize: 13, color: C.grey, margin: '0 0 14px', lineHeight: 1.55 }}>
            Ces qualités s'afficheront sur votre profil.
          </p>
          <button
            onClick={handleRefaire}
            style={{
              background: 'none', border: 'none', padding: 0, fontFamily: 'inherit',
              fontSize: 13, color: C.grey, textDecoration: 'underline', cursor: 'pointer',
            }}
          >
            Recommencer le questionnaire
          </button>
        </div>

        {/* Selon vous */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>Selon vous</span>
            <small style={{ fontSize: 12, color: C.grey, fontWeight: 400 }}>facultatif, jusqu'à 5</small>
          </div>
          <p style={{ fontSize: 13, color: C.grey, margin: '0 0 12px', lineHeight: 1.55 }}>
            Une qualité que vous vous reconnaissez et qui n'est pas ressortie ? Ajoutez-la.
          </p>
          <ChampSuggestions
            valeurs={qualitesDecl}
            onChange={handleQualitesDeclChange}
            suggestions={SUGGESTIONS_QUALITES}
            max={5}
            placeholder="Écrivez une qualité, par exemple Fiabilité"
            libre
            sortStartsWith
            griseesExternes={{ valeurs: testQualiteLabels, label: 'déjà dans vos résultats' }}
          />
          {declSaveError && (
            <div role="alert" style={{
              marginTop: 10, backgroundColor: 'rgba(220,38,38,0.06)',
              border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8,
              padding: '9px 14px', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: 10,
            }}>
              <span style={{ fontSize: 13, color: C.dark, lineHeight: 1.5 }}>
                L'enregistrement n'a pas abouti. Vérifiez votre connexion, puis réessayez.
              </span>
              <button
                onClick={() => handleQualitesDeclChange(qualitesDecl)}
                style={{
                  background: 'none', border: 'none', fontSize: 13, fontWeight: 600,
                  color: C.terracotta, cursor: 'pointer', padding: '4px 0', flexShrink: 0,
                  fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px',
                }}
              >
                Réessayer
              </button>
            </div>
          )}
          {declSaved && !declSaveError && (
            <p style={{ fontSize: 12.5, color: C.succes, margin: '8px 0 0' }}>Enregistré</p>
          )}
        </div>

        {/* Et selon vos proches ? */}
        <div style={{ backgroundColor: C.white, borderRadius: CARD_RADIUS, padding: '20px', boxShadow: CARD_SHADOW }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ color: C.vert, flexShrink: 0, marginTop: 2 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="8" r="3.5"/>
                <path d="M2.5 20a6.5 6.5 0 0 1 13 0"/>
                <path d="M19 8v6M16 11h6"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: 15, color: C.dark, display: 'block', marginBottom: 8, lineHeight: 1.3 }}>
                Et selon vos proches ?
              </b>
              <p style={{ fontSize: 13, color: C.grey, margin: '0 0 6px', lineHeight: 1.55 }}>
                Un regard extérieur rend vos qualités plus crédibles aux yeux d'un recruteur.
              </p>
              <p style={{ fontSize: 13, color: C.grey, margin: '0 0 16px', lineHeight: 1.55 }}>
                Envoyez un lien à un collègue, un ami ou un proche. Il choisit en une minute les qualités qu'il vous reconnaît.
              </p>
              {invitLien ? (
                <div>
                  <div className="kv-proche-lien" style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: C.dark, wordBreak: 'break-all', flex: 1 }}>
                      {invitLien}
                    </span>
                    <button
                      onClick={handleCopierLien}
                      style={{
                        flexShrink: 0, padding: '7px 16px', borderRadius: 100,
                        border: `1.5px solid ${C.sable}`, backgroundColor: C.white,
                        color: C.dark, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {invitCopie ? 'Copié !' : 'Copier le lien'}
                    </button>
                  </div>
                  <span style={{ fontSize: 12, color: C.grey, lineHeight: 1.5, display: 'block' }}>
                    Vous pourrez retrouver ce lien et en envoyer d'autres depuis votre profil.
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => setInvitModalOpen(true)}
                  style={{
                    padding: '9px 20px', borderRadius: 100,
                    border: `1.5px solid ${C.sable}`, backgroundColor: C.white,
                    color: C.dark, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Créer un lien d'invitation
                </button>
              )}
            </div>
          </div>
          <InvitationModal
            open={invitModalOpen}
            onClose={() => setInvitModalOpen(false)}
            candidatId={userId}
            activeCount={invitActiveCount}
            onCreated={inv => {
              setInvitActiveCount(prev => prev + 1)
              if (inv.jeton) setInvitLien(`${window.location.origin}/repondre/${inv.jeton}`)
            }}
          />
        </div>
      </div>
    )
  }

  // ── Quiz ──────────────────────────────────────────────────────────────────
  const situation = situations[idx]
  const sel       = selections[situation?.id] ?? []
  const selCount  = sel.length
  const canAdvance = selCount === 2 && savingIdx === null
  const isSaving   = savingIdx === idx

  return (
    <div>
      <style suppressHydrationWarning>{`
        .kv-sit-nav {
          display: flex; justify-content: space-between; align-items: center;
          gap: 12px; margin-top: 20px;
        }
        @media (max-width: 640px) {
          .kv-sit-nav {
            position: sticky; bottom: 0; z-index: 10;
            background: ${C.bg}; padding: 12px 0 8px; margin-top: 16px;
          }
          .kv-sit-reponse { width: 100%; }
        }
      `}</style>

      {/* Pastilles de progression */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 16, alignItems: 'center' }}>
        {situations.map((s, i) => {
          const done    = (selections[s.id] ?? []).length === 2
          const current = i === idx
          return (
            <div key={s.id} style={{
              width: current ? 10 : 8, height: current ? 10 : 8,
              borderRadius: '50%', flexShrink: 0,
              backgroundColor: done || current ? C.terracotta : C.sable,
              transition: 'all 0.2s',
            }} />
          )
        })}
      </div>

      {/* Compteur */}
      <p style={{ fontSize: 13, color: C.grey, margin: '0 0 16px' }}>
        Situation {idx + 1} sur {TOTAL_SITUATIONS}
      </p>

      {/* Texte de la situation */}
      <p style={{
        fontFamily: FONT_SANS, letterSpacing: '-0.005em', fontSize: 18, color: C.dark,
        margin: '0 0 10px', lineHeight: 1.5, fontWeight: 700,
      }}>
        {situation.texte}
      </p>

      {/* Consigne dynamique */}
      <p style={{ fontSize: 13, color: selCount === 2 ? C.terracotta : C.grey, margin: '0 0 16px', fontWeight: selCount === 2 ? 600 : 400, transition: 'color 0.2s' }}>
        {selCount === 0
          ? 'Choisissez la réaction la plus proche de la vôtre.'
          : selCount === 1
          ? 'Puis une deuxième.'
          : "Vous pouvez encore changer d'avis avant de continuer."}
      </p>

      {/* Cartes de réponse */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 8 }}>
        {situation.reponses.map(r => {
          const rankIdx  = sel.indexOf(r.id)
          const rank     = rankIdx >= 0 ? rankIdx + 1 : null
          const selected = rank !== null
          const flashing = flashId === r.id
          return (
            <button
              key={r.id}
              className={`kv-sit-reponse kv-bloc${selected ? ' kv-sel' : ''}${flashing ? ' kv-flash' : ''}`}
              onClick={() => handleSelect(r.id)}
              aria-pressed={selected}
              style={{
                textAlign: 'left', padding: '13px 16px', borderRadius: 12,
                color: C.dark, fontSize: 14, lineHeight: 1.5, cursor: 'pointer',
                fontFamily: 'inherit', outline: 'none',
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}
            >
              <span style={{
                flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                backgroundColor: rank ? C.terracotta : C.sable,
                color: rank ? C.white : C.grey,
                marginTop: 1, transition: 'background-color 0.15s',
              }}>
                {rank ?? ''}
              </span>
              <span>{r.texte}</span>
            </button>
          )
        })}
      </div>

      {updateError && (
        <p style={{ fontSize: 13, color: C.erreur, margin: '8px 0 0', textAlign: 'center' }}>{updateError}</p>
      )}

      {/* Navigation */}
      <div className="kv-sit-nav">
        {idx > 0 ? (
          <button
            onClick={() => setIdx(i => i - 1)}
            style={{
              background: 'none', border: 'none', padding: '4px 0',
              fontSize: 13, color: C.grey, textDecoration: 'underline',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Situation précédente
          </button>
        ) : <span />}
        <button
          onClick={handleAdvance}
          disabled={!canAdvance}
          style={{
            padding: '12px 24px', borderRadius: 100, border: 'none',
            backgroundColor: canAdvance ? C.orange : C.sable,
            color: canAdvance ? C.white : C.grey,
            fontSize: 14, fontWeight: 600,
            cursor: canAdvance ? 'pointer' : 'default',
            fontFamily: 'inherit', transition: 'background-color 0.15s',
          }}
        >
          {isSaving ? 'Enregistrement...'
            : idx < TOTAL_SITUATIONS - 1 ? 'Situation suivante'
            : 'Voir mes qualités'}
        </button>
      </div>
    </div>
  )
}

// ─── Écran final ──────────────────────────────────────────────────────────────

function FinalScreen({ onGoToProfile, userId, emailConfirme }: { onGoToProfile: () => void; userId: string; emailConfirme: boolean }) {
  const [chosen, setChosen]             = useState<boolean | null>(null)
  const [saving, setSaving]             = useState(false)
  const [saveError, setFinalSaveError]  = useState(false)
  const pendingChoiceRef                = useRef<boolean | null>(null)
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
        </div>
      )}
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

function StyledInput({ value, onChange, placeholder, autoFocus, label, autoComplete, onEnterKey }: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean
  label?: string; autoComplete?: string; onEnterKey?: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
      {label && <label style={{ fontSize: 14, fontWeight: 600, color: C.dark }}>{label}</label>}
      <input
        type="text"
        value={value}
        onChange={e => onChange(capitalizeFirst(e.target.value))}
        onKeyDown={e => { if (e.key === 'Enter') onEnterKey?.() }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
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

function VoiceTextArea({ value, onChange, placeholder, rows = 4 }: {
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

  return (
    <>
      <div style={{ position: 'relative' }}>
        <textarea
          value={value}
          onChange={e => onChange(capitalizeFirst(e.target.value))}
          placeholder={placeholder}
          rows={rows}
          className="kv-field"
          style={{
            width: '100%', paddingTop: '13px', paddingLeft: '16px', paddingRight: '16px',
            paddingBottom: supported ? '46px' : '13px',
            fontSize: 15, borderRadius: 12, border: '1.5px solid transparent',
            backgroundColor: C.white, color: C.dark, outline: 'none',
            boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.65, fontFamily: 'inherit',
          }}
        />
        {interim && (
          <p style={{
            fontSize: '13px', color: C.terracotta, fontStyle: 'italic',
            position: 'absolute', bottom: '48px', left: '16px', right: '48px',
            margin: 0, lineHeight: '1.4', pointerEvents: 'none',
            backgroundColor: 'rgba(247,242,235,0.9)', borderRadius: '4px', padding: '2px 4px',
          }}>
            {interim}…
          </p>
        )}
        {supported && (
          <button
            type="button"
            aria-pressed={listening}
            onClick={listening ? stop : start}
            style={{
              position: 'absolute', bottom: 10, right: 10,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 32, padding: '0 12px 0 10px',
              border: 0, borderRadius: 999,
              backgroundColor: listening ? C.orange : C.chip,
              color: listening ? C.white : C.dark,
              fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              animation: listening ? 'kv-micro-p 1.6s ease-out infinite' : 'none',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="9" y="2" width="6" height="12" rx="3"/>
              <path d="M5 10a7 7 0 0014 0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
              <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
              <line x1="8"  y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            {listening ? 'Arrêter' : 'Dicter'}
          </button>
        )}
      </div>
      {listening && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: C.orangeTexte, marginTop: 6 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, height: 16 }}>
            {[0, .15, .3, .45, .6].map((delay, i) => (
              <span key={i} style={{ width: 3, height: '100%', background: C.orange, borderRadius: 2, display: 'inline-block', animation: `kv-voix .9s ease-in-out ${delay}s infinite` }} />
            ))}
          </span>
          Je vous écoute, parlez naturellement.
        </div>
      )}
      {permError && (
        <p style={{ fontSize: '12px', color: C.erreur, marginTop: '6px' }}>
          Accès au microphone refusé. Vérifiez les permissions dans votre navigateur.
        </p>
      )}
    </>
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
  const [autresPermis,     setAutresPermis]     = useState(false)
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
            <div className="kv-nom-row">
              <StyledInput value={data.prenom} onChange={v => set('prenom', v)} placeholder="Prénom" autoFocus autoComplete="given-name" onEnterKey={isValid() ? handleNext : undefined} />
              <StyledInput value={data.nom}    onChange={v => set('nom', v)}    placeholder="Nom"    autoComplete="family-name" onEnterKey={isValid() ? handleNext : undefined} />
            </div>
          </>
        )

      case 2:
        return (
          <>
            <QuestionLabel text={`Votre métier, ${data.prenom || ''}`} sub={MICRO_TEXTS[2]} />
            <p style={{ fontSize: '12px', fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Domaine</p>
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
            <p style={{ fontSize: '12px', fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Expérience dans ce domaine</p>
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
            <QuestionLabel text="Ce qui vous anime" sub={MICRO_TEXTS[4]} optional />
            <p style={{ fontSize: '12px', fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Le projet dont vous êtes fier</p>
            <input
              type="text"
              value={data.projet_titre}
              onChange={e => {
                const v = e.target.value
                if (v.length <= MAX_PROJET_TITRE || v.length < data.projet_titre.length) set('projet_titre', v)
              }}
              placeholder="Titre du projet"
              className="kv-field"
              style={{
                width: '100%', boxSizing: 'border-box' as const,
                padding: '12px 16px', borderRadius: 12,
                border: '1.5px solid transparent', fontSize: 15,
                fontFamily: 'inherit', outline: 'none',
                backgroundColor: C.white, color: C.dark,
              }}
            />
            <SignatureCounter count={data.projet_titre.length} max={MAX_PROJET_TITRE} theme="light" />
            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: C.dark, display: 'block', marginBottom: 6 }}>Ce que vous avez fait</label>
              <VoiceTextArea
                value={data.projet}
                onChange={v => {
                  if (v.length <= MAX_PROJET_DESC || v.length < data.projet.length) set('projet', v)
                }}
                placeholder="Professionnel, personnel ou associatif. Vous pouvez aussi le dire à voix haute."
              />
              <span style={{ fontSize: 12.5, color: C.grey, display: 'block', marginTop: 4 }}>{data.projet.length} sur {MAX_PROJET_DESC}</span>
            </div>
            <div style={{ height: 24 }} />
            <p style={{ fontSize: '12px', fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Vos passions <small style={{ textTransform: 'none', fontWeight: 400, fontSize: 12, letterSpacing: 0 }}>jusqu'à 5</small>
            </p>
            <ChampSuggestions
              valeurs={data.passions}
              onChange={v => set('passions', v)}
              suggestions={PASSIONS_SUGGESTIONS}
              max={5}
              placeholder="Écrivez une passion"
              libre={true}
              sortStartsWith={true}
              libreSeulementSiAucunMatch={true}
              libreTexte={s => `Pas dans la liste ? Ajouter « ${s} »`}
              fullMessage="Vous avez choisi 5 passions. Retirez-en une pour en changer."
              dropdownInFlow={true}
            />
          </>
        )
      case 5: {
        const showDate = data.disponibilite === 'a_partir_de'
        const toggleContrat = (key: string) => {
          if (key === 'ouvert') { set('typePoste', ['ouvert']); return }
          const without = data.typePoste.filter(k => k !== 'ouvert' && k !== key)
          if (data.typePoste.includes(key)) set('typePoste', without)
          else set('typePoste', [...without, key])
        }
        const togglePermis = (val: string) => {
          if (val === 'aucun') { set('permis', ['aucun']); return }
          const without = data.permis.filter(v => v !== 'aucun' && v !== val)
          if (data.permis.includes(val)) set('permis', without)
          else set('permis', [...without, val])
        }
        const permisVis = autresPermis ? [...PERMIS, ...PERMIS_AUTRES] : PERMIS
        return (
          <>
            <QuestionLabel text="Ce que vous cherchez" sub={MICRO_TEXTS[5]} />

            {/* Contrat */}
            <p style={{ fontSize: '12px', fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              Contrat <small style={{ textTransform: 'none', fontWeight: 400, fontSize: 12, letterSpacing: 0 }}>plusieurs choix possibles</small>
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px' }}>
              {TYPES_POSTE.map(t => {
                const selected = data.typePoste.includes(t.key)
                return (
                  <button key={t.key} onClick={() => toggleContrat(t.key)}
                    aria-pressed={selected}
                    className={`kv-bloc${selected ? ' kv-sel' : ''}`}
                    style={{
                      padding: '10px 18px', borderRadius: 24, fontFamily: 'inherit',
                      color: selected ? C.orangeTexte : C.dark,
                      fontSize: 14, fontWeight: selected ? 600 : 400,
                      cursor: 'pointer',
                    }}>
                    {t.label}
                  </button>
                )
              })}
            </div>

            {/* Télétravail */}
            <p style={{ fontSize: '12px', fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              Télétravail
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px' }}>
              {LIEUX.map(l => {
                const selected = data.lieu === l.key
                return (
                  <button key={l.key} onClick={() => set('lieu', l.key)}
                    aria-pressed={selected}
                    className={`kv-bloc${selected ? ' kv-sel' : ''}`}
                    style={{
                      padding: '10px 18px', borderRadius: 24, fontFamily: 'inherit',
                      color: selected ? C.orangeTexte : C.dark,
                      fontSize: 14, fontWeight: selected ? 600 : 400,
                      cursor: 'pointer',
                    }}>
                    {l.label}
                  </button>
                )
              })}
            </div>

            {/* Ville */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
                Ville ou zone de recherche
              </label>
              <input
                type="text"
                value={data.ville}
                onChange={e => set('ville', e.target.value)}
                placeholder="Par exemple : Alençon, ou Normandie"
                className="kv-field"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '13px 16px', fontSize: 15,
                  borderRadius: 12, border: '1.5px solid transparent',
                  backgroundColor: C.white, color: C.dark, outline: 'none', fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Permis */}
            <p style={{ fontSize: '12px', fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              Permis et habilitations <small style={{ textTransform: 'none', fontWeight: 400, fontSize: 12, letterSpacing: 0 }}>plusieurs choix possibles</small>
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              {permisVis.map(p => {
                const sel = data.permis.includes(p.value)
                return (
                  <button key={p.value} onClick={() => togglePermis(p.value)}
                    aria-pressed={sel}
                    className={`kv-bloc${sel ? ' kv-sel' : ''}`}
                    style={{
                      padding: '8px 16px', borderRadius: 24, fontFamily: 'inherit',
                      color: sel ? C.orangeTexte : C.dark,
                      fontSize: 14, fontWeight: sel ? 600 : 400, cursor: 'pointer',
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
                  fontSize: 14, fontWeight: data.permis.includes('aucun') ? 600 : 400, cursor: 'pointer',
                }}>
                Aucun permis
              </button>
            </div>
            <button
              onClick={() => setAutresPermis(v => !v)}
              style={{
                background: 'none', border: 'none', padding: '4px 0',
                fontSize: 14, color: C.orangeTexte, cursor: 'pointer',
                fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px',
                display: 'inline-block', marginBottom: 24, whiteSpace: 'nowrap',
              }}
            >
              {autresPermis ? 'Moins de choix' : 'Autres permis et habilitations'}
            </button>

            {/* Disponibilité */}
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
                    width: '100%', boxSizing: 'border-box', padding: '13px 16px', fontSize: 16,
                    borderRadius: 12, border: '1.5px solid transparent',
                    backgroundColor: C.white, color: C.dark, outline: 'none', fontFamily: 'inherit',
                  }}
                />
              </div>
            )}
          </>
        )
      }

      case 6: {
        const maxReached = data.priorite.length >= 3
        return (
          <>
            <QuestionLabel text="Ce qui compte le plus pour vous" sub={MICRO_TEXTS[6]} optional />
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
            <p style={{ fontSize: '14px', color: C.grey, marginTop: '14px', marginBottom: 0 }} aria-live="polite">
              {data.priorite.length} sur 3
            </p>
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
        @keyframes kv-micro-p { 0%{box-shadow:0 0 0 0 rgba(194,97,31,.45)} 100%{box-shadow:0 0 0 10px rgba(194,97,31,0)} }
        @keyframes kv-voix { 0%,100%{transform:scaleY(.3)} 50%{transform:scaleY(1)} }
        .kv-nom-row { display:flex; gap:12px }
        @media (max-width:640px) { .kv-nom-row { flex-direction:column } }
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
