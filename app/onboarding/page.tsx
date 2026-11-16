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
  MAX_MISSIONS,
  screenToStep,
  convertSavedStep,
  firstIncompleteStep,
  buildStepPayload,
} from '@/lib/onboarding-utils'
import type { Experience, Diplome, OnboardingFormData as FormData } from '@/lib/onboarding-utils'
import { lireMoisAnnee, preparerExperiencePourEnregistrement } from '@/lib/parcours'
import {
  SITUATIONS,
  CURRENT_VERSION,
  QUALITE_LABELS,
  calculerQualites,
} from '@/lib/test-qualites'
import type { TestAnswer } from '@/lib/test-qualites'
import { LANGUES } from '@/lib/langues'
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
  7: 'Les plus significatives suffisent. Vous pourrez en ajouter depuis votre profil.',
  8: 'Diplômes, certifications, formations courtes : tout ce qui a construit vos compétences.',
  9: "Vos compétences comptent dans la correspondance avec les offres.",
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

const LANGUES_COURANTES = ['Français', 'Anglais', 'Espagnol', 'Allemand', 'Italien', 'Portugais', 'Arabe', 'Chinois']

const NIVEAUX_LANGUE = ['Natif', 'Courant', 'Intermédiaire', 'Débutant']

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function capitalizeFirst(v: string): string {
  if (!v) return v
  return v.charAt(0).toUpperCase() + v.slice(1)
}

// ─── Dates pour expériences ───────────────────────────────────────────────────

const ANNEE_MIN_EXP = 1960
const ANNEE_MAX_EXP = new Date().getFullYear()
const ANNEES_EXP = Array.from({ length: ANNEE_MAX_EXP - ANNEE_MIN_EXP + 1 }, (_, i) => ANNEE_MAX_EXP - i)
const MOIS_EXP = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const SEL_S: React.CSSProperties = {
  fontSize: 13, padding: '6px 8px', border: `1px solid ${C.sable}`,
  borderRadius: 8, fontFamily: 'inherit', color: C.dark, backgroundColor: C.white, cursor: 'pointer',
}
const LABEL_S: React.CSSProperties = { fontSize: 12.5, fontWeight: 500, color: C.grey, marginBottom: 4, display: 'block' }
const ETIQ_S:  React.CSSProperties = { fontSize: 15, fontWeight: 600, color: C.dark }

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
                <span key={r.qualite} className="kv-qual-badge" style={{
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
        <div className="kv-selon-vous">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>Selon vous</span>
            <small style={{ fontSize: 12, color: C.grey, fontWeight: 400 }}>facultatif, jusqu'à 5</small>
          </div>
          <p style={{ fontSize: 13, color: C.grey, margin: '0 0 12px', lineHeight: 1.55 }}>
            Une qualité que vous vous reconnaissez et qui n'est pas ressortie ? Ajoutez-la.
          </p>
          <ChampSuggestions
            avecMotion
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
        <div className="kv-proche-card" style={{ backgroundColor: C.white, borderRadius: CARD_RADIUS, padding: '20px', boxShadow: CARD_SHADOW }}>
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
                <div className="kv-invit-lien">
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
          className="kv-btn-p"
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

function FinalScreen({ onGoToProfile, userId, emailConfirme, prenom }: { onGoToProfile: () => void; userId: string; emailConfirme: boolean; prenom: string }) {
  const [visCss,  setVisCss]      = useState<'oui' | 'non' | null>(null)
  const [chosen,  setChosen]      = useState<boolean | null>(null)
  const [saving,  setSaving]      = useState(false)
  const [saveError, setFinalSaveError] = useState(false)
  const pendingChoiceRef          = useRef<boolean | null>(null)
  const chosenOnceRef             = useRef(false)
  const profBtnRef                = useRef<HTMLButtonElement>(null)

  async function handleChoice(value: boolean) {
    if (saving) return
    setVisCss(value ? 'oui' : 'non')
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
    if (!chosenOnceRef.current && profBtnRef.current && typeof window !== 'undefined') {
      chosenOnceRef.current = true
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        profBtnRef.current.animate(
          [{ boxShadow: '0 0 0 0 rgba(194,97,31,.5)' }, { boxShadow: '0 0 0 16px rgba(194,97,31,0)' }],
          { duration: 500, easing: 'ease-out' },
        )
      }
    }
  }

  const PTS: [number, number][] = [
    [150,170],[460,140],[505,330],[420,500],
    [180,470],[95,320],[300,70],[330,540],[230,250],[400,250],
  ]

  return (
    <main
      className={`kv-fn4${visCss ? ` vis-${visCss}` : ''}`}
      style={{ display:'flex', flexDirection:'row', minHeight:'100vh', backgroundColor:C.bg, position:'relative', overflow:'hidden' }}
    >
      <style suppressHydrationWarning>{`
        /* ── Halos ── */
        @keyframes kv-fn4-onde { 0%{transform:scale(.15);opacity:0} 10%{opacity:1} 100%{transform:scale(1);opacity:0} }
        .kv-fn4-pulse { fill:url(#kv-fn4-g-pulse); transform-box:fill-box; transform-origin:center; opacity:0; animation:kv-fn4-onde 6s cubic-bezier(.2,.6,.3,1) infinite both; }
        .kv-fn4-pulse.b { animation-delay:2s; }
        .kv-fn4-pulse.c { animation-delay:4s; }
        .vis-oui .kv-fn4-pulse { fill:url(#kv-fn4-g-pulse-o); animation-duration:3.6s; }
        .vis-oui .kv-fn4-pulse.b { animation-delay:1.2s; }
        .vis-oui .kv-fn4-pulse.c { animation-delay:2.4s; }
        .vis-non .kv-fn4-pulse { animation:none; opacity:0; }
        /* ── Dots ── */
        @keyframes kv-fn4-luit { 0%,100%{opacity:.35} 50%{opacity:.8} }
        .kv-fn4-pt { fill:${C.vert}70; transform-box:fill-box; transform-origin:center; animation:kv-fn4-luit 4.5s ease-in-out infinite; transition:transform 1.4s cubic-bezier(.3,.7,.2,1),fill .6s; }
        .vis-oui .kv-fn4-pt { fill:${C.orange}; transform:translate(var(--dx),var(--dy)) scale(1.25); }
        .vis-non .kv-fn4-pt { fill:${C.vert}38; transform:translate(calc(var(--dx) * -0.6),calc(var(--dy) * -0.6)); }
        /* ── Needle ── */
        @keyframes kv-fn4-osc { 0%{transform:rotate(-55deg)} 45%{transform:rotate(16deg)} 70%{transform:rotate(-6deg)} 88%{transform:rotate(2deg)} 100%{transform:rotate(0)} }
        @keyframes kv-fn4-aig-part { to{opacity:0} }
        @keyframes kv-fn4-cible2 { 0%{transform:translateY(0)} 100%{transform:translateY(116px);opacity:0} }
        .kv-fn4-osc { transform-box:fill-box; transform-origin:50% 70%; animation:kv-fn4-osc 1150ms cubic-bezier(.35,0,.25,1) 100ms both; }
        .kv-fn4-aig { animation:kv-fn4-aig-part .5s 1.9s ease-in forwards; }
        .kv-fn4-cible { fill:${C.orange}; transform-box:fill-box; transform-origin:center; animation:kv-fn4-cible2 .9s 1.2s cubic-bezier(.6,0,.3,1) forwards; }
        /* ── Card arrival ── */
        @keyframes kv-fn4-carte-nait { from{opacity:0;transform:scale(.8) translateY(10px)} to{opacity:1;transform:none} }
        .kv-fn4-sq { position:relative; z-index:1; width:280px; background:${C.white}; border-radius:16px; padding:20px; display:flex; flex-direction:column; gap:16px; box-shadow:0 2px 4px rgba(27,48,38,.05),0 16px 40px rgba(27,48,38,.12); animation:kv-fn4-carte-nait .7s 2.05s cubic-bezier(.2,.8,.2,1.15) both; transition:box-shadow .6s; overflow:visible; }
        .kv-fn4-sq .sq-id { display:flex; align-items:center; gap:14px; }
        .kv-fn4-sq .sq-av { width:48px; height:58px; border-radius:10px; background:${C.orange}; flex:none; transition:background-color .6s; }
        .kv-fn4-sq .sq-l { display:flex; flex-direction:column; gap:9px; flex:1; }
        .kv-fn4-sq .sq-l i { display:block; height:9px; border-radius:5px; background:#E9ECEA; }
        .kv-fn4-sq .sq-id .sq-l i:first-child { height:11px; background:#DCE2DE; }
        .kv-fn4-sq .sq-pills { display:flex; gap:8px; }
        .kv-fn4-sq .sq-pills i { display:block; height:24px; width:64px; border-radius:999px; background:#FBEDE3; transition:background-color .6s; }
        .kv-fn4-sq .sq-pills i:nth-child(2) { width:52px; }
        .kv-fn4-sq .sq-pills i:nth-child(3) { width:58px; }
        .kv-fn4-sq .sq-pile { position:absolute; inset:0; border-radius:16px; }
        .kv-fn4-sq>*:not(.sq-pile) { position:relative; }
        .kv-fn4-sq .sq-pile::before,.kv-fn4-sq .sq-pile::after { content:""; position:absolute; inset:0; z-index:-1; border-radius:16px; background:#FBFCFB; box-shadow:0 2px 8px rgba(27,48,38,.08); transform:rotate(-7deg) translate(-26px,10px); transition:transform .8s cubic-bezier(.3,.7,.2,1),opacity .6s; }
        .kv-fn4-sq .sq-pile::after { transform:rotate(6deg) translate(28px,14px); background:#F7F9F8; }
        .vis-oui .kv-fn4-sq { box-shadow:0 0 0 1.5px rgba(194,97,31,.35),0 16px 40px rgba(194,97,31,.20); }
        .vis-oui .kv-fn4-sq .sq-pile::before { transform:rotate(-12deg) translate(-70px,26px); opacity:.6; }
        .vis-oui .kv-fn4-sq .sq-pile::after { transform:rotate(11deg) translate(74px,30px); opacity:.6; }
        .vis-non .kv-fn4-sq { box-shadow:0 1px 3px rgba(27,48,38,.08); }
        .vis-non .kv-fn4-sq .sq-av { background:#BFC8C2; }
        .vis-non .kv-fn4-sq .sq-pills i { background:#EEF0EE; }
        .vis-non .kv-fn4-sq .sq-pile::before,.vis-non .kv-fn4-sq .sq-pile::after { transform:none; }
        /* ── Choice options ── */
        .kv-fn4-opt { display:flex; align-items:center; gap:14px; width:100%; text-align:left; border:0; background:${C.white}; border-radius:12px; padding:14px 16px; cursor:pointer; font:inherit; color:${C.dark}; box-shadow:0 1px 2px rgba(27,48,38,.06),0 6px 16px rgba(27,48,38,.07); transition:box-shadow .2s,transform .15s; }
        .kv-fn4-opt:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 2px 4px rgba(27,48,38,.06),0 10px 22px rgba(27,48,38,.10); }
        .kv-fn4-opt.on { background:#FBEDE3; box-shadow:0 0 0 1.5px ${C.orange},0 6px 16px rgba(194,97,31,.12); }
        .kv-fn4-ic { width:40px; height:40px; border-radius:10px; background:#F2F4F2; color:${C.vert}; display:grid; place-items:center; flex:none; transition:background-color .15s,color .15s; }
        .kv-fn4-opt.on .kv-fn4-ic { background:${C.white}; color:${C.orange}; }
        .kv-fn4-radio { width:20px; height:20px; border-radius:50%; box-shadow:inset 0 0 0 2px #C9CFCB; flex:none; transition:box-shadow .2s; margin-left:auto; }
        .kv-fn4-opt.on .kv-fn4-radio { box-shadow:inset 0 0 0 6px ${C.orange}; }
        /* ── Layout ── */
        .kv-fn4-txt { flex:0 0 auto; display:flex; flex-direction:column; gap:18px; padding:60px 48px 48px 56px; max-width:600px; min-width:460px; position:relative; z-index:1; }
        .kv-fn4-scene { flex:1; position:relative; display:grid; place-items:center; min-height:100vh; overflow:hidden; }
        .kv-fn4-scene>svg { position:absolute; width:118%; max-width:none; left:50%; top:50%; transform:translate(-50%,-50%); }
        /* ── Mobile ── */
        @media (max-width:640px) {
          .kv-fn4 { flex-direction:column !important; }
          .kv-fn4-txt { padding:52px 20px 24px !important; gap:12px !important; min-width:0 !important; max-width:100% !important; }
          .kv-fn4-scene { position:relative !important; order:2; min-height:0 !important; height:330px; overflow:hidden; margin-top:-70px; z-index:0; pointer-events:none; mask-image:linear-gradient(to bottom,transparent 0,#000 30%); -webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 30%); }
          .kv-fn4-scene>svg { width:440px !important; }
          .kv-fn4-sq { scale:.74; margin-top:40px; }
          .kv-fn4-txt h1 { font-size:28px !important; }
        }
        /* ── Reduced motion ── */
        @media (prefers-reduced-motion:reduce) {
          .kv-fn4-pulse { animation:none !important; opacity:1 !important; }
          .kv-fn4-osc,.kv-fn4-cible,.kv-fn4-aig { animation:none !important; transform:none !important; opacity:1 !important; }
          .kv-fn4-sq { animation:none !important; opacity:1 !important; transform:none !important; }
        }
      `}</style>

      {/* ── Texte ── */}
      <div className="kv-fn4-txt">
        <div>
          <LogoKapolia variante="sombre" taille={36} avecTexte={false} />
        </div>

        <h1 style={{ fontFamily:FONT_SANS, letterSpacing:'-0.012em', fontSize:'clamp(28px,3.4vw,38px)', fontWeight:700, lineHeight:1.1, color:C.dark, margin:0 }}>
          Votre profil est prêt,&#160;{prenom}&#160;!
        </h1>
        <p style={{ fontSize:15.5, color:C.grey, lineHeight:1.55, margin:0, maxWidth:420 }}>
          Vous avez trouvé votre cap. Dernière question avant de découvrir votre profil.
        </p>

        {/* ── Radiogroup ── */}
        <div role="radiogroup" aria-labelledby="kv-fn4-q" style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <p id="kv-fn4-q" style={{ fontWeight:700, fontSize:16, color:C.dark, margin:0 }}>
            Les recruteurs peuvent-ils vous trouver sans que vous postuliez&#160;?
          </p>

          <button
            role="radio"
            aria-checked={visCss === 'oui'}
            onClick={() => handleChoice(true)}
            className={`kv-fn4-opt${visCss === 'oui' ? ' on' : ''}`}
          >
            <span className="kv-fn4-ic" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </span>
            <span style={{ display:'flex', flexDirection:'column', gap:2, flex:1 }}>
              <b style={{ fontSize:15.5 }}>Oui, rendre mon profil visible</b>
              <span style={{ fontSize:14, color:C.grey, lineHeight:1.45 }}>Les recruteurs inscrits peuvent le découvrir et vous proposer un échange.</span>
            </span>
            <span className="kv-fn4-radio" aria-hidden="true"/>
          </button>

          <button
            role="radio"
            aria-checked={visCss === 'non'}
            onClick={() => handleChoice(false)}
            className={`kv-fn4-opt${visCss === 'non' ? ' on' : ''}`}
          >
            <span className="kv-fn4-ic" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="11" width="16" height="10" rx="2"/>
                <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
              </svg>
            </span>
            <span style={{ display:'flex', flexDirection:'column', gap:2, flex:1 }}>
              <b style={{ fontSize:15.5 }}>Pas pour le moment</b>
              <span style={{ fontSize:14, color:C.grey, lineHeight:1.45 }}>Seuls les recruteurs des offres où vous postulez voient votre profil.</span>
            </span>
            <span className="kv-fn4-radio" aria-hidden="true"/>
          </button>
        </div>

        <p style={{ fontSize:13.5, color:C.grey, margin:0 }}>
          Vous pourrez changer d&apos;avis à tout moment dans vos paramètres.
        </p>

        {!emailConfirme && visCss === 'oui' && (
          <p style={{ fontSize:14, background:'#FBF3E6', borderRadius:8, padding:'10px 12px', lineHeight:1.45, color:C.dark, margin:0 }}>
            Votre profil deviendra visible dès que vous aurez confirmé votre adresse e-mail. Le lien vous a été envoyé à l&apos;inscription.
          </p>
        )}

        {saveError && (
          <div role="alert" style={{ backgroundColor:'rgba(220,38,38,0.06)', border:'1px solid rgba(220,38,38,0.2)', borderRadius:8, padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
            <span style={{ fontSize:13, color:C.dark, lineHeight:1.5 }}>L&apos;enregistrement n&apos;a pas abouti. Vérifiez votre connexion.</span>
            <button
              onClick={() => pendingChoiceRef.current !== null && handleChoice(pendingChoiceRef.current)}
              style={{ background:'none', border:'none', fontSize:13, fontWeight:600, color:C.terracotta, cursor:'pointer', padding:'4px 0', flexShrink:0, fontFamily:'inherit', textDecoration:'underline', textUnderlineOffset:'2px' }}
            >
              Réessayer
            </button>
          </div>
        )}

        <div>
          <button
            ref={profBtnRef}
            onClick={onGoToProfile}
            disabled={chosen === null}
            className="kv-btn-p"
            style={{ backgroundColor:C.orange, color:C.white, border:'none', borderRadius:100, padding:'14px 32px', fontSize:15, fontWeight:600, cursor:chosen !== null ? 'pointer' : 'default', fontFamily:'inherit', opacity:chosen !== null ? 1 : 0.4, transition:'opacity .2s' }}
          >
            Voir mon profil
          </button>
        </div>
      </div>

      {/* ── Animation ── */}
      <div className="kv-fn4-scene" aria-hidden="true">
        <svg viewBox="0 0 600 600">
          <defs>
            <radialGradient id="kv-fn4-g-pulse">
              <stop offset="0" stopColor={C.vert} stopOpacity="0"/>
              <stop offset=".55" stopColor={C.vert} stopOpacity=".05"/>
              <stop offset=".85" stopColor={C.vert} stopOpacity=".09"/>
              <stop offset="1" stopColor={C.vert} stopOpacity="0"/>
            </radialGradient>
            <radialGradient id="kv-fn4-g-pulse-o">
              <stop offset="0" stopColor={C.orange} stopOpacity="0"/>
              <stop offset=".55" stopColor={C.orange} stopOpacity=".07"/>
              <stop offset=".85" stopColor={C.orange} stopOpacity=".16"/>
              <stop offset="1" stopColor={C.orange} stopOpacity="0"/>
            </radialGradient>
            <radialGradient id="kv-fn4-g-coeur">
              <stop offset="0" stopColor={C.white} stopOpacity="1"/>
              <stop offset=".6" stopColor={C.white} stopOpacity=".85"/>
              <stop offset="1" stopColor={C.white} stopOpacity="0"/>
            </radialGradient>
          </defs>

          <circle className="kv-fn4-pulse a" cx="300" cy="300" r="290"/>
          <circle className="kv-fn4-pulse b" cx="300" cy="300" r="290"/>
          <circle className="kv-fn4-pulse c" cx="300" cy="300" r="290"/>
          <circle fill="url(#kv-fn4-g-coeur)" cx="300" cy="300" r="120" opacity=".9"/>

          {PTS.map(([cx, cy], i) => {
            const dx = Math.round((300 - cx) * 0.28)
            const dy = Math.round((300 - cy) * 0.28)
            return (
              <circle
                key={i}
                className="kv-fn4-pt"
                cx={cx} cy={cy} r={i % 3 ? 4 : 5}
                style={{ '--dx': `${dx}px`, '--dy': `${dy}px`, animationDelay: `${(i * 0.37).toFixed(2)}s` } as React.CSSProperties}
              />
            )
          })}

          <g className="kv-fn4-aig" transform="translate(300 300) scale(3.6) translate(-21 -21)">
            <g className="kv-fn4-osc">
              <path d="M14 29 L21 12 L28 29" fill="none" stroke={C.vert} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 29 L21 25 L28 29" fill="none" stroke={C.orange} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"/>
            </g>
          </g>
          <circle className="kv-fn4-cible" cx="300" cy="140" r="7"/>
        </svg>

        <div className="kv-fn4-sq">
          <div className="sq-pile" aria-hidden="true"/>
          <div className="sq-id">
            <span className="sq-av"/>
            <span className="sq-l">
              <i style={{ width:'62%' }}/>
              <i style={{ width:'40%' }}/>
            </span>
          </div>
          <div className="sq-pills"><i/><i/><i/></div>
          <div className="sq-l">
            <i style={{ width:'88%' }}/>
            <i style={{ width:'70%' }}/>
          </div>
        </div>
      </div>
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

function ChoiceCard({ label, desc, selected, onClick, disabled = false, tapped = false }: {
  label: string; desc?: string; selected: boolean; onClick: () => void; disabled?: boolean; tapped?: boolean
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`kv-bloc${selected ? ' kv-sel' : ''}${tapped ? ' kv-tap' : ''}`}
      style={{
        width: '100%', textAlign: 'left', padding: '14px 18px',
        borderRadius: 14,
        cursor: disabled ? 'default' : 'pointer',
        marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <span className="kv-rond" style={{
        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${selected ? C.terracotta : '#C3CAC5'}`,
        position: 'relative', transition: 'border-color 0.15s',
      }} />
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


function VoiceMissionsArea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [supported,  setSupported]  = useState(false)
  const [listening,  setListening]  = useState(false)
  const [permError,  setPermError]  = useState(false)
  const [interim,    setInterim]    = useState('')
  const recogRef = useRef<any>(null)
  const valueRef = useRef(value)
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
    recog.onend = () => { setListening(false); setInterim(''); recogRef.current = null }
    recogRef.current = recog
    try { recog.start(); setListening(true); setPermError(false) }
    catch { setListening(false) }
  }

  function stop() {
    recogRef.current?.stop(); recogRef.current = null
    setListening(false); setInterim('')
  }

  const nonEmpty = value.split('\n').filter(l => l.trim()).length

  return (
    <>
      <div style={{ position: 'relative' }}>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && nonEmpty >= MAX_MISSIONS) e.preventDefault() }}
          placeholder={`Missions principales, une par ligne, ${MAX_MISSIONS} au maximum`}
          rows={MAX_MISSIONS}
          className="kv-field"
          style={{
            width: '100%', paddingTop: '13px', paddingLeft: '16px', paddingRight: '16px',
            paddingBottom: supported ? '46px' : '13px',
            fontSize: 14, borderRadius: 12, border: '1.5px solid transparent',
            backgroundColor: C.white, color: C.dark, outline: 'none',
            boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.65, fontFamily: 'inherit',
          }}
        />
        {interim && (
          <p style={{
            fontSize: 13, color: C.terracotta, fontStyle: 'italic',
            position: 'absolute', bottom: 48, left: 16, right: 48,
            margin: 0, lineHeight: 1.4, pointerEvents: 'none',
            backgroundColor: 'rgba(247,242,235,0.9)', borderRadius: 4, padding: '2px 4px',
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
        <p style={{ fontSize: 12, color: C.erreur, marginTop: 6 }}>
          Accès au microphone refusé. Vérifiez les permissions dans votre navigateur.
        </p>
      )}
      <span style={{ fontSize: 11, color: nonEmpty > MAX_MISSIONS ? C.orange : C.grey, marginTop: 4, display: 'block' }}>
        {nonEmpty} / {MAX_MISSIONS}
      </span>
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
  const [input,       setInput]       = useState('')
  const [open,        setOpen]        = useState(false)
  const [hIdx,        setHIdx]        = useState(-1)
  const [showOther,   setShowOther]   = useState(false)
  const [otherDomain, setOtherDomain] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const nrm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  const myItems    = (COMP_REF[domain] ?? []).map(s => ({ label: s, hint: null as string | null }))
  const otherItems = DOMAINES
    .filter(d => d !== domain && !!COMP_REF[d])
    .flatMap(d => (COMP_REF[d] ?? []).map(s => ({ label: s, hint: d })))
  const allItems = [...myItems, ...otherItems]

  const trim       = input.trim()
  const normTrim   = nrm(trim)
  const exactMatch = trim ? (allItems.find(it => nrm(it.label) === normTrim) ?? null) : null
  const filtered   = trim
    ? allItems.filter(it => nrm(it.label).includes(normTrim) && !tags.includes(it.label)).slice(0, 8)
    : []
  const showAjouter = !!trim && !exactMatch
  const totalOpts   = (showAjouter ? 1 : 0) + filtered.length
  const full        = tags.length >= maxTags

  function doAdd(val: string) {
    if (full) return
    const match = allItems.find(it => nrm(it.label) === nrm(val.trim()))
    const toAdd = match ? match.label : capitalizeFirst(val.trim())
    if (!toAdd || tags.includes(toAdd)) return
    onAdd(toAdd); setInput(''); setOpen(false); setHIdx(-1)
    inputRef.current?.focus()
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setOpen(true); setHIdx(i => Math.min(i + 1, totalOpts - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setHIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Escape') {
      setOpen(false); setHIdx(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (!trim) return
      if (hIdx === -1) {
        if (exactMatch) doAdd(exactMatch.label); else doAdd(trim)
      } else if (showAjouter && hIdx === 0) {
        doAdd(trim)
      } else {
        const fi = showAjouter ? hIdx - 1 : hIdx
        if (filtered[fi]) doAdd(filtered[fi].label)
      }
    }
  }

  const domSugs   = (COMP_REF[domain] ?? []).filter(s => !tags.includes(s)).slice(0, 10)
  const otherDoms = DOMAINES.filter(d => d !== domain && !!COMP_REF[d])

  return (
    <div>
      {/* Pastilles sélectionnées */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {tags.map(tag => (
            <span key={tag} className="kv-tag-nait" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, backgroundColor: `${C.vert}12`, color: C.vert, border: `1.5px solid ${C.vert}30`, fontSize: 13, fontWeight: 500 }}>
              {tag}
              <button onClick={() => onRemove(tag)} style={{ background: 'none', border: 'none', color: C.grey, cursor: 'pointer', padding: 0, fontSize: 15, lineHeight: 1 }}>&#215;</button>
            </span>
          ))}
        </div>
      )}

      {/* Champ de recherche */}
      {!full && (
        <div style={{ position: 'relative', marginBottom: 4 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); setOpen(true); setHIdx(-1) }}
            onFocus={() => { if (input) setOpen(true) }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={handleKey}
            placeholder="Écrivez une compétence, par exemple Gestion des conflits"
            className="kv-field"
            style={{ width: '100%', padding: '12px 16px', fontSize: 14, borderRadius: 12, border: '1.5px solid transparent', backgroundColor: C.white, color: C.dark, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
          {open && trim && totalOpts > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, backgroundColor: C.white, border: `1px solid ${C.sable}`, borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,.08)', marginTop: 4, overflow: 'hidden' }}>
              {showAjouter && (
                <div
                  onMouseDown={() => doAdd(trim)}
                  onMouseEnter={() => setHIdx(0)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', cursor: 'pointer', backgroundColor: hIdx === 0 ? C.bg : `${C.vert}08`, color: C.vert, fontSize: 13.5, fontWeight: 600, borderBottom: filtered.length > 0 ? `1px solid ${C.sable}` : undefined }}
                >
                  <span>Ajouter &laquo;&nbsp;{trim}&nbsp;&raquo;</span>
                  <span style={{ fontSize: 11.5, color: C.grey, border: `1px solid ${C.sable}`, borderRadius: 5, padding: '1px 6px', flexShrink: 0 }}>Entrée</span>
                </div>
              )}
              {filtered.map((it, fi) => {
                const idx = showAjouter ? fi + 1 : fi
                return (
                  <div key={it.label}
                    onMouseDown={() => doAdd(it.label)}
                    onMouseEnter={() => setHIdx(idx)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', fontSize: 13.5, cursor: 'pointer', backgroundColor: hIdx === idx ? C.bg : C.white, color: C.dark, transition: 'background-color 150ms' }}
                  >
                    <span>{it.label}</span>
                    {it.hint && <span style={{ fontSize: 11.5, color: C.grey, marginLeft: 8, flexShrink: 0 }}>{it.hint}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <p style={{ fontSize: 11.5, color: full ? C.orange : C.grey, marginBottom: 16 }}>{tags.length} sur {maxTags}</p>

      {/* Courantes dans le domaine */}
      {domSugs.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: C.grey, marginBottom: 8 }}>Courantes en {domain}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {domSugs.map(s => (
              <button key={s} type="button" onClick={() => !full && onAdd(s)}
                style={{ padding: '6px 13px', borderRadius: 20, fontSize: 13, border: `1.5px solid ${C.sable}`, backgroundColor: C.white, color: full ? '#C0C0C0' : C.dark, cursor: full ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Autres domaines */}
      <button type="button"
        onClick={() => { setShowOther(v => !v); if (showOther) setOtherDomain(null) }}
        style={{ fontSize: 13, color: C.orangeTexte, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontWeight: 500, marginBottom: showOther ? 10 : 0 }}>
        {showOther ? 'Masquer les autres domaines' : "Voir les compétences d'autres domaines"}
      </button>

      {showOther && (
        <div>
          <select
            value={otherDomain ?? ''}
            onChange={e => setOtherDomain(e.target.value || null)}
            style={{ ...SEL_S, width: '100%', marginBottom: 10 }}
          >
            <option value="">Choisir un domaine&#8230;</option>
            {otherDoms.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {otherDomain && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {(COMP_REF[otherDomain] ?? []).map((s, si) => {
                const added = tags.includes(s)
                return (
                  <button key={s} type="button"
                    onClick={() => { if (added) onRemove(s); else if (!full) onAdd(s) }}
                    className="kv-autre-sugg"
                    style={{ padding: '6px 13px', borderRadius: 20, fontSize: 13, border: `1.5px solid ${added ? C.vert : C.sable}`, backgroundColor: added ? `${C.vert}12` : C.white, color: added ? C.vert : (full && !added) ? '#C0C0C0' : C.dark, cursor: (full && !added) ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', animationDelay: `${(si * 0.04).toFixed(2)}s` }}>
                    {added ? `✓ ${s}` : s}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LangueSearchInput({ onAdd, chosen }: { onAdd: (nom: string) => void; chosen: string[] }) {
  const [input, setInput] = useState('')
  const [open,  setOpen]  = useState(false)
  const [hIdx,  setHIdx]  = useState(-1)

  const nrm      = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const trim     = input.trim()
  const filtered = trim ? LANGUES.filter(l => nrm(l.nom).includes(nrm(trim)) && !chosen.includes(l.nom)).slice(0, 8) : []
  const noMatch  = !!trim && filtered.length === 0

  function doAdd(nom: string) { onAdd(nom); setInput(''); setOpen(false); setHIdx(-1) }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setOpen(true); setHIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setHIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Escape') {
      setOpen(false); setHIdx(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (hIdx >= 0 && filtered[hIdx]) doAdd(filtered[hIdx].nom)
      else if (filtered.length === 1) doAdd(filtered[0].nom)
    }
  }

  return (
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <input
        value={input}
        onChange={e => { setInput(e.target.value); setOpen(true); setHIdx(-1) }}
        onFocus={() => { if (input) setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKey}
        placeholder="Une autre langue ? Tapez son nom"
        className="kv-field"
        style={{ width: '100%', padding: '12px 16px', fontSize: 14, borderRadius: 12, border: '1.5px solid transparent', backgroundColor: C.white, color: C.dark, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
      />
      {open && trim && (noMatch || filtered.length > 0) && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, backgroundColor: C.white, border: `1px solid ${C.sable}`, borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,.08)', marginTop: 4, overflow: 'hidden' }}>
          {noMatch ? (
            <div style={{ padding: '10px 12px', fontSize: 13.5, color: C.grey }}>Aucune langue trouvée. Vérifiez l'orthographe.</div>
          ) : filtered.map((l, i) => (
            <div key={l.code}
              onMouseDown={() => doAdd(l.nom)}
              onMouseEnter={() => setHIdx(i)}
              style={{ padding: '9px 12px', fontSize: 13.5, cursor: 'pointer', backgroundColor: hIdx === i ? C.bg : C.white, color: C.dark, transition: 'background-color 150ms' }}>
              {l.nom}
            </div>
          ))}
        </div>
      )}
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
  const slideDirRef      = useRef<'fwd' | 'back'>('fwd')
  const prevBlockRef     = useRef(-1)
  const wasValidRef      = useRef(false)
  const suivantBtnRef    = useRef<HTMLButtonElement>(null)
  const [needleKey,  setNeedleKey]  = useState(0)
  const [tappedId,   setTappedId]   = useState<string | null>(null)
  const [swellingBlock, setSwellingBlock] = useState<string | null>(null)

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
          experiences:          Array.isArray(p.experiences) ? (p.experiences as Experience[]).map(e => {
            if (e.debut_annee != null) return e
            const debut = lireMoisAnnee(e.date_debut ?? '')
            const fin   = lireMoisAnnee(e.date_fin ?? '')
            return { ...e, debut_annee: debut?.annee ?? null, debut_mois: debut?.mois ?? null, fin_annee: fin?.annee ?? null, fin_mois: fin?.mois ?? null }
          }) : [],
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

  useEffect(() => {
    const bi = BLOCKS.findIndex(b => b.steps.includes(step))
    if (prevBlockRef.current !== -1 && bi !== prevBlockRef.current) {
      setNeedleKey(k => k + 1)
      const justDone = BLOCKS[prevBlockRef.current]
      if (justDone) {
        setSwellingBlock(justDone.label)
        setTimeout(() => setSwellingBlock(null), 1500)
      }
    }
    prevBlockRef.current = bi
  }, [step])

  useEffect(() => {
    const v = isValid()
    if (v && !wasValidRef.current && suivantBtnRef.current && typeof window !== 'undefined') {
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        suivantBtnRef.current.animate(
          [{ boxShadow: '0 0 0 0 rgba(194,97,31,.5)' }, { boxShadow: '0 0 0 16px rgba(194,97,31,0)' }],
          { duration: 500, easing: 'ease-out' },
        )
      }
    }
    wasValidRef.current = v
  })

  const blockIndex = BLOCKS.findIndex(b => b.steps.includes(step))

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  function tap(id: string) {
    setTappedId(id)
    setTimeout(() => setTappedId(null), 320)
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
      slideDirRef.current = 'fwd'
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
        experiences: data.experiences.map(preparerExperiencePourEnregistrement),
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
    slideDirRef.current = 'back'
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
            <p style={{ ...ETIQ_S, marginBottom: 10 }}>Domaine</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px' }}>
              {DOMAINES.map(d => (
                <button key={d} onClick={() => { tap('dom-' + d); set('domaine', d) }}
                  aria-pressed={data.domaine === d}
                  className={`kv-bloc${data.domaine === d ? ' kv-sel' : ''}${tappedId === 'dom-' + d ? ' kv-tap' : ''}`}
                  style={{
                    padding: '10px 18px', borderRadius: 24, fontFamily: 'inherit',
                    color: data.domaine === d ? C.orangeTexte : C.dark,
                    fontSize: 14, fontWeight: data.domaine === d ? 600 : 400,
                    cursor: 'pointer',
                  }}>
                  <svg className="kv-coche" viewBox="0 0 12 12" fill="none" aria-hidden="true" width="12" height="12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>{d}
                </button>
              ))}
            </div>
            <p style={{ ...ETIQ_S, marginBottom: 10 }}>Expérience dans ce domaine</p>
            {EXPERIENCES.map(e => (
              <ChoiceCard key={e.key} label={e.key} desc={e.desc}
                selected={data.experience === e.key} tapped={tappedId === 'exp-' + e.key} onClick={() => { tap('exp-' + e.key); set('experience', e.key) }} />
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
            <p style={{ ...ETIQ_S, marginBottom: 10 }}>Le projet dont vous êtes fier</p>
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
            <p style={{ ...ETIQ_S, marginBottom: 10 }}>
              Vos passions <small style={{ fontWeight: 400, color: C.grey, fontSize: 14, marginLeft: 6 }}>jusqu'à 5</small>
            </p>
            <ChampSuggestions
              avecMotion
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
            <p style={{ ...ETIQ_S, marginBottom: 8 }}>
              Contrat <small style={{ fontWeight: 400, color: C.grey, fontSize: 14, marginLeft: 6 }}>plusieurs choix possibles</small>
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px' }}>
              {TYPES_POSTE.map(t => {
                const selected = data.typePoste.includes(t.key)
                return (
                  <button key={t.key} onClick={() => { tap('cont-' + t.key); toggleContrat(t.key) }}
                    aria-pressed={selected}
                    className={`kv-bloc${selected ? ' kv-sel' : ''}${tappedId === 'cont-' + t.key ? ' kv-tap' : ''}`}
                    style={{
                      padding: '10px 18px', borderRadius: 24, fontFamily: 'inherit',
                      color: selected ? C.orangeTexte : C.dark,
                      fontSize: 14, fontWeight: selected ? 600 : 400,
                      cursor: 'pointer',
                    }}>
                    <svg className="kv-coche" viewBox="0 0 12 12" fill="none" aria-hidden="true" width="12" height="12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>{t.label}
                  </button>
                )
              })}
            </div>

            {/* Télétravail */}
            <p style={{ ...ETIQ_S, marginBottom: 8 }}>
              Télétravail
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px' }}>
              {LIEUX.map(l => {
                const selected = data.lieu === l.key
                return (
                  <button key={l.key} onClick={() => { tap('lieu-' + l.key); set('lieu', l.key) }}
                    aria-pressed={selected}
                    className={`kv-bloc${selected ? ' kv-sel' : ''}${tappedId === 'lieu-' + l.key ? ' kv-tap' : ''}`}
                    style={{
                      padding: '10px 18px', borderRadius: 24, fontFamily: 'inherit',
                      color: selected ? C.orangeTexte : C.dark,
                      fontSize: 14, fontWeight: selected ? 600 : 400,
                      cursor: 'pointer',
                    }}>
                    <svg className="kv-coche" viewBox="0 0 12 12" fill="none" aria-hidden="true" width="12" height="12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>{l.label}
                  </button>
                )
              })}
            </div>

            {/* Ville */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ ...ETIQ_S, display: 'block', marginBottom: 8 }}>
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
            <p style={{ ...ETIQ_S, marginBottom: 8 }}>
              Permis et habilitations <small style={{ fontWeight: 400, color: C.grey, fontSize: 14, marginLeft: 6 }}>plusieurs choix possibles</small>
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              {permisVis.map(p => {
                const sel = data.permis.includes(p.value)
                return (
                  <button key={p.value} onClick={() => { tap('perm-' + p.value); togglePermis(p.value) }}
                    aria-pressed={sel}
                    className={`kv-bloc${sel ? ' kv-sel' : ''}${tappedId === 'perm-' + p.value ? ' kv-tap' : ''}`}
                    style={{
                      padding: '8px 16px', borderRadius: 24, fontFamily: 'inherit',
                      color: sel ? C.orangeTexte : C.dark,
                      fontSize: 14, fontWeight: sel ? 600 : 400, cursor: 'pointer',
                    }}>
                    <svg className="kv-coche" viewBox="0 0 12 12" fill="none" aria-hidden="true" width="12" height="12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>{p.label}
                  </button>
                )
              })}
              <button onClick={() => { tap('perm-aucun'); togglePermis('aucun') }}
                aria-pressed={data.permis.includes('aucun')}
                className={`kv-bloc${data.permis.includes('aucun') ? ' kv-sel' : ''}${tappedId === 'perm-aucun' ? ' kv-tap' : ''}`}
                style={{
                  padding: '8px 16px', borderRadius: 24, fontFamily: 'inherit',
                  color: data.permis.includes('aucun') ? C.orangeTexte : C.dark,
                  fontSize: 14, fontWeight: data.permis.includes('aucun') ? 600 : 400, cursor: 'pointer',
                }}>
                <svg className="kv-coche" viewBox="0 0 12 12" fill="none" aria-hidden="true" width="12" height="12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>Aucun permis
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
            <p style={{ ...ETIQ_S, marginBottom: 8 }}>
              Disponibilité
            </p>
            {DISPOS.map(d => (
              <ChoiceCard key={d.key} label={d.label} desc={d.desc}
                selected={data.disponibilite === d.key} tapped={tappedId === 'dispo-' + d.key} onClick={() => { tap('dispo-' + d.key); set('disponibilite', d.key) }} />
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
                    if (selected) { tap('prio-' + p); set('priorite', data.priorite.filter(x => x !== p)) }
                    else if (!maxReached) { tap('prio-' + p); set('priorite', [...data.priorite, p]) }
                  }}
                    aria-pressed={selected}
                    className={`kv-bloc${selected ? ' kv-sel' : ''}${tappedId === 'prio-' + p ? ' kv-tap' : ''}`}
                    style={{
                      padding: '10px 18px', borderRadius: 24, fontFamily: 'inherit',
                      color: selected ? C.orangeTexte : C.dark,
                      fontSize: 14, fontWeight: selected ? 600 : 400,
                      cursor: disabled ? 'default' : 'pointer',
                      opacity: disabled ? 0.4 : 1,
                    }}>
                    <svg className="kv-coche" viewBox="0 0 12 12" fill="none" aria-hidden="true" width="12" height="12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>{p}
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
          { poste: '', entreprise: '', en_poste: false, missions: '', debut_annee: null, debut_mois: null, fin_annee: null, fin_mois: null },
        ])
        const removeExp = (i: number) =>
          set('experiences', data.experiences.filter((_, idx) => idx !== i))
        const updateExp = (i: number, patch: Partial<Experience>) =>
          set('experiences', data.experiences.map((e, idx) => idx === i ? { ...e, ...patch } : e))
        return (
          <>
            <QuestionLabel text="Vos expériences" sub={MICRO_TEXTS[7]} optional />
            {data.experiences.map((exp, i) => (
              <div key={i} className="kv-fiche" style={{
                backgroundColor: C.white, borderRadius: 14,
                boxShadow: '0 1px 2px rgba(27,48,38,.06), 0 6px 16px rgba(27,48,38,.07)',
                padding: 16, marginBottom: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.grey }}>Expérience {i + 1}</span>
                  <button onClick={() => removeExp(i)} style={{
                    background: 'none', border: 'none', color: C.erreur,
                    fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                  }}>Retirer</button>
                </div>
                <div className="kv-nom-row" style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={LABEL_S}>Poste</label>
                    <StyledInput value={exp.poste} onChange={v => updateExp(i, { poste: v })} placeholder="Ex : Chargé de clientèle" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={LABEL_S}>Entreprise</label>
                    <StyledInput value={exp.entreprise} onChange={v => updateExp(i, { entreprise: v })} placeholder="Ex : Carrefour" />
                  </div>
                </div>
                <div className="kv-exp-row" style={{ marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={LABEL_S}>Début</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select value={exp.debut_mois ?? ''} onChange={e => updateExp(i, { debut_mois: e.target.value ? Number(e.target.value) : null })} style={SEL_S}>
                        <option value="">Mois</option>
                        {MOIS_EXP.map((m, mi) => <option key={mi} value={mi + 1}>{m}</option>)}
                      </select>
                      <select value={exp.debut_annee ?? ''} onChange={e => updateExp(i, { debut_annee: e.target.value ? Number(e.target.value) : null })} style={SEL_S}>
                        <option value="">Année</option>
                        {ANNEES_EXP.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  </div>
                  {!exp.en_poste && (
                    <div style={{ flex: 1 }}>
                      <label style={LABEL_S}>Fin</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select value={exp.fin_mois ?? ''} onChange={e => updateExp(i, { fin_mois: e.target.value ? Number(e.target.value) : null })} style={SEL_S}>
                          <option value="">Mois</option>
                          {MOIS_EXP.map((m, mi) => <option key={mi} value={mi + 1}>{m}</option>)}
                        </select>
                        <select value={exp.fin_annee ?? ''} onChange={e => updateExp(i, { fin_annee: e.target.value ? Number(e.target.value) : null })} style={SEL_S}>
                          <option value="">Année</option>
                          {ANNEES_EXP.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: C.dark, cursor: 'pointer', marginBottom: 12, fontFamily: 'inherit' }}>
                  <input type="checkbox" checked={exp.en_poste}
                    onChange={e => updateExp(i, { en_poste: e.target.checked, ...(e.target.checked ? { fin_mois: null, fin_annee: null } : {}) })} />
                  {"J’occupe ce poste actuellement"}
                </label>
                <label style={LABEL_S}>Missions principales</label>
                <VoiceMissionsArea value={exp.missions} onChange={v => updateExp(i, { missions: v })} />
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
          { intitule: '', ecole: '', annee: '', en_cours: false },
        ])
        const removeDiplome = (i: number) =>
          set('diplomes', data.diplomes.filter((_, idx) => idx !== i))
        const updateDiplome = (i: number, patch: Partial<Diplome>) =>
          set('diplomes', data.diplomes.map((d, idx) => idx === i ? { ...d, ...patch } : d))
        return (
          <>
            <QuestionLabel text="Vos formations" sub={MICRO_TEXTS[8]} optional />
            {data.diplomes.map((d, i) => (
              <div key={i} className="kv-fiche" style={{
                backgroundColor: C.white, borderRadius: 14,
                boxShadow: '0 1px 2px rgba(27,48,38,.06), 0 6px 16px rgba(27,48,38,.07)',
                padding: 16, marginBottom: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.grey }}>Formation {i + 1}</span>
                  <button onClick={() => removeDiplome(i)} style={{
                    background: 'none', border: 'none', color: C.erreur,
                    fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                  }}>Retirer</button>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={LABEL_S}>Intitulé</label>
                  <StyledInput value={d.intitule} onChange={v => updateDiplome(i, { intitule: v })}
                    placeholder="Ex : BTS Commerce, Master Marketing…" />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={LABEL_S}>École ou organisme</label>
                  <StyledInput value={d.ecole} onChange={v => updateDiplome(i, { ecole: v })}
                    placeholder="Ex : Université Lyon 2" />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={LABEL_S}>{"Année d’obtention"}</label>
                  <select value={d.annee} onChange={e => updateDiplome(i, { annee: e.target.value })}
                    style={{ ...SEL_S, width: '100%' }} disabled={!!d.en_cours}>
                    <option value="">Choisir…</option>
                    {ANNEES_EXP.map(a => <option key={a} value={String(a)}>{a}</option>)}
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: C.dark, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <input type="checkbox" checked={!!d.en_cours}
                    onChange={e => updateDiplome(i, { en_cours: e.target.checked, annee: e.target.checked ? '' : d.annee })} />
                  Formation en cours
                </label>
              </div>
            ))}
            <button onClick={addDiplome} className="kv-ajouter" style={{
              width: '100%', padding: '13px', borderRadius: 12,
              color: C.orangeTexte, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              + Ajouter une formation
            </button>
          </>
        )
      }

      case 9: {
        const chosenNames  = data.langues.map(e => { const i = e.indexOf(' — '); return i >= 0 ? e.slice(0, i) : e })
        const extraLangues = chosenNames.filter(n => !LANGUES_COURANTES.includes(n))
        const getNiveau    = (entry: string) => { const i = entry.indexOf(' — '); return i >= 0 ? entry.slice(i + 3) : 'Courant' }
        const toggleLangue = (nom: string) => {
          if (chosenNames.includes(nom)) set('langues', data.langues.filter(l => !l.startsWith(nom + ' — ') && l !== nom))
          else set('langues', [...data.langues, `${nom} — Courant`])
        }
        const setNiveau = (nom: string, niveau: string) =>
          set('langues', data.langues.map(l => (l.startsWith(nom + ' — ') || l === nom) ? `${nom} — ${niveau}` : l))
        return (
          <>
            <QuestionLabel text="Compétences et langues" sub={MICRO_TEXTS[9]} />

            <p style={{ ...ETIQ_S, marginBottom: 8 }}>
              Compétences
            </p>
            <p style={{ fontSize: 13.5, color: C.grey, lineHeight: 1.6, marginBottom: 14 }}>
              Écrivez-les avec vos mots. Les suggestions sont là pour aller plus vite, pas pour vous limiter.
            </p>
            <CompRefTagInput
              domain={data.domaine}
              tags={data.competences_acquises}
              onAdd={tag => set('competences_acquises', [...data.competences_acquises, tag])}
              onRemove={tag => set('competences_acquises', data.competences_acquises.filter(t => t !== tag))}
              maxTags={15}
            />

            <div style={{ height: 28 }} />

            <p style={{ ...ETIQ_S, marginBottom: 12 }}>
              Langues
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {[...LANGUES_COURANTES, ...extraLangues].map(nom => {
                const selected = chosenNames.includes(nom)
                return (
                  <button key={nom} onClick={() => { tap('lang-' + nom); toggleLangue(nom) }}
                    aria-pressed={selected}
                    className={`kv-bloc${selected ? ' kv-sel' : ''}${tappedId === 'lang-' + nom ? ' kv-tap' : ''}`}
                    style={{ padding: '8px 16px', borderRadius: 24, fontFamily: 'inherit', color: selected ? C.orangeTexte : C.dark, fontSize: 14, fontWeight: selected ? 600 : 400, cursor: 'pointer' }}>
                    <svg className="kv-coche" viewBox="0 0 12 12" fill="none" aria-hidden="true" width="12" height="12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>{nom}
                  </button>
                )
              })}
            </div>
            <LangueSearchInput
              onAdd={nom => set('langues', [...data.langues, `${nom} — Courant`])}
              chosen={chosenNames}
            />
            {data.langues.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                {data.langues.map(entry => {
                  const sep  = entry.indexOf(' — ')
                  const nom  = sep >= 0 ? entry.slice(0, sep) : entry
                  const niv  = getNiveau(entry)
                  return (
                    <div key={nom} className="kv-bloc kv-langue-row kv-tag-nait" style={{ backgroundColor: C.white, borderRadius: 12, padding: '10px 14px' }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: C.dark, flex: 1 }}>{nom}</span>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {NIVEAUX_LANGUE.map(n => (
                          <button key={n} type="button" onClick={() => { tap('niv-' + nom + n); setNiveau(nom, n) }}
                            className={tappedId === 'niv-' + nom + n ? 'kv-tap' : ''}
                            style={{
                              padding: '4px 9px', borderRadius: 7, fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer',
                              border: `1.5px solid ${n === niv ? C.terracotta : C.sable}`,
                              backgroundColor: n === niv ? `${C.terracotta}12` : C.white,
                              color: n === niv ? C.terracotta : C.grey,
                              fontWeight: n === niv ? 600 : 400, transition: 'all 0.12s',
                            }}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )
      }

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
  if (showFinal)   return <FinalScreen   onGoToProfile={() => router.push(readPostSignupNext() ?? '/profil')} userId={userId} emailConfirme={emailConfirme} prenom={data.prenom} />

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
        .kv-exp-row { display:flex; gap:10px }
        .kv-langue-row { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
        @media (max-width:640px) { .kv-nom-row { flex-direction:column } .kv-exp-row { flex-direction:column } }
        /* Blocs sans contour — ombre légère, survol soulevé, sélectionné pêche */
        .kv-bloc {
          border: 0 !important;
          background: ${C.white};
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
          background: ${C.white};
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
          border-color: ${C.terracotta} !important;
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
          background: ${C.white} !important;
          border-color: ${C.terracotta} !important;
          box-shadow: 0 0 0 3px rgba(194,97,31,.14) !important;
          outline: none !important;
        }
        #titre-etape:focus { outline: none; }
        /* ── Motion ── */
        @keyframes kv-slide-fwd  { from{opacity:0;transform:translateX(28px)} to{opacity:1;transform:none} }
        @keyframes kv-slide-back { from{opacity:0;transform:translateX(-28px)} to{opacity:1;transform:none} }
        .kv-slide-fwd  { animation:kv-slide-fwd  150ms cubic-bezier(.2,.9,.3,1) }
        .kv-slide-back { animation:kv-slide-back 150ms cubic-bezier(.2,.9,.3,1) }
        @keyframes kv-num-monte { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        .kv-num-monte { animation:kv-num-monte 0.2s ease-out }
        @keyframes kv-tag-nait { from{opacity:0;transform:scale(.7)} to{opacity:1;transform:scale(1)} }
        .kv-tag-nait { animation:kv-tag-nait 0.22s cubic-bezier(.2,.9,.3,1) both }
        @keyframes kv-tap { 0%{transform:scale(1)} 35%{transform:scale(.94)} 65%{transform:scale(1.04)} 100%{transform:scale(1)} }
        .kv-tap { animation:kv-tap 0.28s ease-out !important; }
        @keyframes kv-osc-logo { 0%{transform:rotate(-55deg)} 45%{transform:rotate(16deg)} 70%{transform:rotate(-6deg)} 88%{transform:rotate(2deg)} 100%{transform:rotate(0)} }
        .kv-logo-osc { animation:kv-osc-logo 1150ms cubic-bezier(.35,0,.25,1) both; }
        @keyframes kv-reflet { from{background-position:-100% center} to{background-position:300% center} }
        @keyframes kv-pointe-puls { 0%,100%{opacity:.5;transform:scale(.7)} 50%{opacity:1;transform:scale(1.15)} }
        .kv-prog-fill { position:relative; }
        .kv-prog-fill.cur { overflow:hidden; }
        .kv-prog-fill.cur::before { content:""; position:absolute; inset:0; background:linear-gradient(90deg,transparent,rgba(255,255,255,.45) 50%,transparent); background-size:200% 100%; animation:kv-reflet 2.4s ease-in-out .3s infinite; }
        .kv-prog-dot { width:6px; height:6px; border-radius:50%; background:${C.orange}; animation:kv-pointe-puls 1.4s ease-in-out infinite; position:absolute; top:-1px; }
        .kv-coche-path { stroke-dasharray:1; animation:kv-coche-trace .3s ease-out both; }
        @keyframes kv-coche-trace { from{stroke-dashoffset:1} to{stroke-dashoffset:0} }
        .kv-fiche { transition:box-shadow .2s,transform .15s; }
        .kv-fiche:hover { box-shadow:0 2px 4px rgba(27,48,38,.07),0 10px 24px rgba(27,48,38,.12) !important; transform:translateY(-1px) !important; }
        .kv-btn-p { transition:box-shadow .2s,transform .15s; }
        .kv-btn-p:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 4px 12px rgba(194,97,31,.2); }
        @keyframes kv-cascade-nait { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        .kv-autre-sugg { animation:kv-cascade-nait .22s ease-out both; }
        .kv-invit-lien { animation:kv-cascade-nait .3s ease-out both; }
        .kv-qual-badge { animation:kv-tag-nait .25s cubic-bezier(.2,.9,.3,1) both; }
        .kv-qual-badge:nth-child(2) { animation-delay:.1s; }
        .kv-qual-badge:nth-child(3) { animation-delay:.2s; }
        @keyframes kv-gonfle { 0%,100%{transform:scaleY(1)} 40%{transform:scaleY(2.2)} }
        .kv-prog-track-swell { animation:kv-gonfle .5s ease-out .55s both; }
        .kv-coche-done { stroke-dasharray:1; stroke-dashoffset:0; }
        .kv-coche-delayed { stroke-dasharray:1; stroke-dashoffset:1; animation:kv-coche-trace .4s .7s ease-out forwards; }
        .kv-bloc .kv-coche { display:none; color:inherit; vertical-align:-2px; margin-right:4px; }
        .kv-bloc[aria-pressed="true"] .kv-coche { display:inline; }
        .kv-bloc.kv-tap[aria-pressed="true"] .kv-coche path { stroke-dasharray:1; stroke-dashoffset:1; animation:kv-coche-trace .3s .05s ease-out both; }
        .kv-rond::after { content:''; display:block; position:absolute; inset:3px; border-radius:50%; background:${C.terracotta}; transform:scale(0); transition:transform .2s ease; }
        .kv-sel .kv-rond::after { transform:scale(1); }
        .kv-tap.kv-sel .kv-rond::after { animation:kv-dot-pop .22s .05s ease-out forwards; }
        @keyframes kv-dot-pop { from{transform:scale(0)} to{transform:scale(1)} }
        .kv-selon-vous { animation:kv-cascade-nait .3s ease-out .35s both; }
        .kv-proche-card { animation:kv-cascade-nait .3s ease-out .5s both; }
        @media (hover:none) { .kv-bloc:hover,.kv-ajouter:hover,.kv-fiche:hover,.kv-btn-p:hover { transform:none !important; box-shadow:inherit !important; } }
        @media (prefers-reduced-motion:reduce) {
          .kv-slide-fwd,.kv-slide-back,.kv-tap,.kv-num-monte,.kv-tag-nait,.kv-logo-osc { animation:none !important; opacity:1 !important; transform:none !important; }
          .kv-prog-fill.cur::before,.kv-prog-dot { animation:none !important; display:none !important; }
          .kv-coche-path { animation:none !important; stroke-dashoffset:0 !important; }
          .kv-autre-sugg,.kv-invit-lien,.kv-qual-badge { animation:none !important; opacity:1 !important; transform:none !important; }
          .kv-fiche:hover,.kv-btn-p:hover { transform:none !important; }
          .kv-prog-track-swell,.kv-coche-delayed,.kv-selon-vous,.kv-proche-card { animation:none !important; transform:none !important; opacity:1 !important; }
          .kv-coche-delayed { stroke-dashoffset:0 !important; }
          .kv-rond::after { transition:none !important; animation:none !important; }
          .kv-bloc .kv-coche path { stroke-dashoffset:0 !important; animation:none !important; }
        }
      `}</style>

      {/* En-tête */}
      <header style={{
        padding: '14px clamp(20px, 5%, 48px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${C.sable}`,
        backgroundColor: C.bg,
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <LogoKapolia key={needleKey} variante="sombre" taille={24} avecTexte={false} needleClassName="kv-logo-osc" />
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
            Étape <strong key={step} className="kv-num-monte" style={{ color: C.dark }}>{step}</strong> sur {TOTAL}
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
              <div style={{ height: 4, borderRadius: 2, backgroundColor: C.sable, position: 'relative' }} className={swellingBlock === b.label ? 'kv-prog-track-swell' : undefined}>
                <div
                  className={`kv-prog-fill${isCurrent ? ' cur' : ''}`}
                  style={{ height: '100%', borderRadius: 2, backgroundColor: C.orange, width: `${fillPct}%`, transition: 'width 0.7s cubic-bezier(.3,.9,.3,1)' }}
                />
                {isCurrent && fillPct > 0 && (
                  <div className="kv-prog-dot" style={{ left: `calc(${fillPct}% - 3px)`, transition: 'left 0.7s cubic-bezier(.3,.9,.3,1)' }} />
                )}
              </div>
              <span style={{
                fontSize: 12.5, color: isCurrent ? C.dark : C.grey,
                fontWeight: isCurrent ? 600 : 400,
                display: 'flex', alignItems: 'center', gap: 5,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                fontVariationSettings: isCurrent ? "'wght' 600" : "'wght' 400",
                transition: 'color 0.3s, font-variation-settings 0.3s',
              }}>
                {isDone && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <path d="M2 6l3 3 5-5" stroke={C.succes} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" pathLength="1" className={swellingBlock === b.label ? 'kv-coche-delayed' : 'kv-coche-done'}/>
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
        <div key={step} className={`kv-slide-${slideDirRef.current}`} style={{ width: '100%', maxWidth: 600 }}>
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
            <button ref={suivantBtnRef} onClick={handleNext} disabled={!isValid() || saving} className="kv-btn-p" style={{
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
