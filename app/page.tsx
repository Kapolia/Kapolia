'use client'

import { useState } from 'react'
import LogoKapolia from '@/components/LogoKapolia'

// ── Palette ───────────────────────────────────────────────────────────────────

const C = {
  vert:       '#2C4A3E',
  vertFonce:  '#1A2E24',
  terracotta: '#C4673A',
  sable:      '#E8D5B7',
  creme:      '#F7F2EB',
  texte:      '#22312B',
  gris:       '#6B7280',
  blanc:      '#FFFFFF',
  bordure:    '#E2D9CC',
  erreur:     '#C0392B',
}

const LORA  = 'Lora, Georgia, serif'
const INTER = 'Inter, system-ui, sans-serif'

// ── WaitlistForm ──────────────────────────────────────────────────────────────

type TypeCompte = 'candidat' | 'recruteur' | null
type Statut     = 'idle' | 'chargement' | 'succes' | 'erreur'

function WaitlistForm({ sombre = false }: { sombre?: boolean }) {
  const [email,     setEmail]     = useState('')
  const [type,      setType]      = useState<TypeCompte>(null)
  const [consent,   setConsent]   = useState(false)
  const [statut,    setStatut]    = useState<Statut>('idle')

  const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const valide      = emailValide && type !== null && consent

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valide || statut === 'chargement') return
    setStatut('chargement')
    try {
      const res = await fetch('/api/liste-attente', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim(), type_compte: type }),
      })
      setStatut(res.ok ? 'succes' : 'erreur')
    } catch {
      setStatut('erreur')
    }
  }

  if (statut === 'succes') {
    return (
      <div role="status" aria-live="polite" style={{ padding: '8px 0', textAlign: 'center' }}>
        <p style={{ fontFamily: LORA, fontSize: '20px', fontWeight: 600, color: sombre ? C.blanc : C.vert, margin: '0 0 8px' }}>
          Votre inscription est confirmee.
        </p>
        <p style={{ fontFamily: INTER, fontSize: '14px', color: sombre ? C.sable : C.gris, margin: 0, lineHeight: 1.6 }}>
          Nous vous ecrirons a l'ouverture de Kapolia. Une seule fois.
        </p>
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width:           '100%',
    padding:         '12px 16px',
    fontSize:        '15px',
    borderRadius:    '10px',
    border:          `1.5px solid ${C.bordure}`,
    backgroundColor: C.blanc,
    color:           C.texte,
    outline:         'none',
    fontFamily:      INTER,
    boxSizing:       'border-box',
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      <label htmlFor="kap-email" className="kap-sr-only">Adresse e-mail</label>
      <input
        id="kap-email"
        type="email"
        value={email}
        onChange={e => { setEmail(e.target.value); if (statut === 'erreur') setStatut('idle') }}
        placeholder="Votre adresse e-mail"
        required
        autoComplete="email"
        style={inputStyle}
      />

      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend className="kap-sr-only">Vous etes</legend>
        <div className="kap-types" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {([
            ['candidat',  'Je cherche un poste'],
            ['recruteur', 'Je recrute'],
          ] as const).map(([val, label]) => {
            const actif = type === val
            return (
              <button
                key={val}
                type="button"
                onClick={() => setType(val)}
                aria-pressed={actif}
                style={{
                  padding:         '11px 8px',
                  borderRadius:    '10px',
                  border:          `2px solid ${actif ? C.terracotta : C.bordure}`,
                  backgroundColor: actif ? `${C.terracotta}18` : C.blanc,
                  color:           actif ? C.terracotta : C.texte,
                  fontSize:        '14px',
                  fontWeight:      actif ? 700 : 400,
                  fontFamily:      INTER,
                  cursor:          'pointer',
                  transition:      'all 0.15s',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </fieldset>

      <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={consent}
          onChange={e => setConsent(e.target.checked)}
          style={{ marginTop: '2px', accentColor: C.terracotta, width: '15px', height: '15px', flexShrink: 0 }}
        />
        <span style={{ fontFamily: INTER, fontSize: '12px', color: C.gris, lineHeight: 1.6 }}>
          J'accepte de recevoir un message lors de l'ouverture de Kapolia. Mon adresse ne sera
          utilisee que pour cela et je peux me desinscrire a tout moment.
        </span>
      </label>

      <button
        type="submit"
        disabled={!valide || statut === 'chargement'}
        aria-busy={statut === 'chargement'}
        style={{
          padding:         '13px',
          borderRadius:    '10px',
          border:          'none',
          backgroundColor: valide ? C.terracotta : '#D4CFC9',
          color:           valide ? C.blanc : '#9CA3AF',
          fontSize:        '15px',
          fontWeight:      600,
          fontFamily:      INTER,
          cursor:          valide ? 'pointer' : 'default',
          transition:      'background-color 0.2s',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          gap:             '8px',
        }}
      >
        {statut === 'chargement' && (
          <span aria-hidden="true" style={{
            display:        'inline-block',
            width:          '14px',
            height:         '14px',
            borderRadius:   '50%',
            border:         '2px solid rgba(255,255,255,0.35)',
            borderTopColor: '#fff',
            animation:      'k-spin 0.7s linear infinite',
            flexShrink:     0,
          }} />
        )}
        {statut === 'chargement' ? 'Envoi en cours...' : 'Me prevenir'}
      </button>

      {statut === 'erreur' && (
        <p role="alert" style={{ margin: 0, fontSize: '13px', color: C.erreur, fontFamily: INTER }}>
          Une erreur est survenue. Merci de reessayer dans quelques instants.
        </p>
      )}
    </form>
  )
}

// ── Chiffre cle ───────────────────────────────────────────────────────────────

function ChiffreCle({ valeur, texte }: { valeur: string; texte: string }) {
  return (
    <div style={{
      backgroundColor: C.blanc,
      borderRadius:    '16px',
      padding:         '28px 24px',
      flex:            '1 1 200px',
    }}>
      <div style={{ fontFamily: LORA, fontSize: '38px', fontWeight: 700, color: C.terracotta, marginBottom: '10px' }}>
        {valeur}
      </div>
      <p style={{ fontFamily: INTER, fontSize: '14px', color: C.texte, lineHeight: 1.6, margin: 0 }}>
        {texte}
      </p>
    </div>
  )
}

// ── Puce ─────────────────────────────────────────────────────────────────────

function Puce({ texte }: { texte: string }) {
  return (
    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
      <span style={{
        display:         'block',
        width:           '6px',
        height:          '6px',
        borderRadius:    '50%',
        backgroundColor: C.terracotta,
        flexShrink:      0,
        marginTop:       '10px',
      }} />
      <p style={{ fontFamily: INTER, fontSize: '16px', color: C.texte, lineHeight: 1.75, margin: 0 }}>
        {texte}
      </p>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <main style={{ color: C.texte }}>
      <style suppressHydrationWarning>{`
        @keyframes k-spin { to { transform: rotate(360deg); } }

        .kap-wrap    { max-width: 1120px; margin: 0 auto; padding: 0 48px; }
        .kap-deux    { display: grid; grid-template-columns: 1fr 1fr; gap: 72px; align-items: center; }
        .kap-haut    { grid-template-columns: 55fr 45fr; }
        .kap-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

        @media (max-width: 768px) {
          .kap-wrap  { padding: 0 24px; }
          .kap-deux  { grid-template-columns: 1fr; gap: 36px; }
          .kap-haut  { grid-template-columns: 1fr; }
        }
        @media (max-width: 480px) {
          .kap-types { grid-template-columns: 1fr; }
        }
      `}</style>


      {/* ── 1. BARRE SUPERIEURE ──────────────────────────────────────────────── */}
      <div style={{ backgroundColor: C.vert }}>
        <div className="kap-wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0' }}>
          <LogoKapolia variante="contour" taille={28} />
          <span style={{ fontFamily: INTER, fontSize: '13px', color: C.sable, letterSpacing: '0.02em' }}>
            Bientot disponible
          </span>
        </div>
      </div>


      {/* ── 2. EN-TETE ───────────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: C.vert, padding: '72px 0 96px' }}>
        <div className="kap-wrap">
          <div className="kap-deux kap-haut" style={{ alignItems: 'start' }}>

            {/* Texte */}
            <div>
              <h1 style={{
                fontFamily:   LORA,
                fontSize:     'clamp(30px, 3.8vw, 52px)',
                fontWeight:   700,
                color:        C.blanc,
                lineHeight:   1.2,
                margin:       '0 0 28px',
              }}>
                Et si votre prochain poste ne dependait plus de votre CV ?
              </h1>
              <p style={{ fontFamily: INTER, fontSize: '18px', color: C.sable, lineHeight: 1.75, margin: 0 }}>
                Kapolia propose aux candidats de se presenter tels qu'ils sont : leurs valeurs, leur facon
                de travailler, leurs aspirations. Les recruteurs reperent les profils qui correspondent
                vraiment a leur equipe. L'application ouvre prochainement en France.
              </p>
            </div>

            {/* Carte formulaire */}
            <div style={{
              backgroundColor: C.blanc,
              borderRadius:    '20px',
              padding:         '36px',
              boxShadow:       '0 8px 40px rgba(0,0,0,0.2)',
            }}>
              <h2 style={{ fontFamily: LORA, fontSize: '20px', fontWeight: 600, color: C.texte, margin: '0 0 6px' }}>
                Etre prevenu en premier
              </h2>
              <p style={{ fontFamily: INTER, fontSize: '13px', color: C.gris, margin: '0 0 24px', lineHeight: 1.5 }}>
                Un seul message, a l'ouverture.
              </p>
              <WaitlistForm />
            </div>

          </div>
        </div>
      </section>


      {/* ── 3. LE CONSTAT ────────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: C.creme, padding: '96px 0' }}>
        <div className="kap-wrap">
          <h2 style={{
            fontFamily:   LORA,
            fontSize:     'clamp(24px, 3vw, 38px)',
            fontWeight:   700,
            color:        C.texte,
            maxWidth:     '640px',
            lineHeight:   1.3,
            margin:       '0 0 48px',
          }}>
            Le CV trie sur ce qui est facile a mesurer, pas sur ce qui fait reussir.
          </h2>

          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <ChiffreCle
              valeur="43,8 %"
              texte="des projets de recrutement juges difficiles en 2026"
            />
            <ChiffreCle
              valeur="84 %"
              texte="des entreprises citent le profil inadequat des candidats comme principale difficulte"
            />
            <ChiffreCle
              valeur="61 %"
              texte="evoquent un manque de motivation, chose qu'aucun CV ne montre"
            />
          </div>

          <p style={{ fontFamily: INTER, fontSize: '12px', color: C.gris, marginTop: '28px', lineHeight: 1.5 }}>
            Source : enquete Besoins en main-d'oeuvre 2026, France Travail.
          </p>
        </div>
      </section>


      {/* ── 4. COTE CANDIDAT ─────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: C.blanc, padding: '112px 0' }}>
        <div className="kap-wrap" style={{ maxWidth: '640px' }}>
          <p style={{ fontFamily: INTER, fontSize: '12px', fontWeight: 600, color: C.terracotta, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 16px' }}>
            Pour les candidats
          </p>
          <h2 style={{ fontFamily: LORA, fontSize: 'clamp(24px, 2.8vw, 36px)', fontWeight: 700, color: C.texte, lineHeight: 1.3, margin: '0 0 40px' }}>
            Un profil vivant, pas une liste de dates.
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Puce texte="Vos valeurs et votre facon de travailler comptent autant que votre parcours." />
            <Puce texte="Mettez en avant un projet dont vous etes fier, et detaillez ce qui ne tient jamais dans un CV." />
            <Puce texte="Un parcours guide, plutot qu'une page blanche a remplir." />
            <Puce texte="Candidature en un clic." />
          </div>
        </div>
      </section>


      {/* ── 5. COTE RECRUTEUR ────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: C.creme, padding: '112px 0' }}>
        <div className="kap-wrap" style={{ maxWidth: '640px' }}>
          <p style={{ fontFamily: INTER, fontSize: '12px', fontWeight: 600, color: C.terracotta, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 16px' }}>
            Pour les recruteurs
          </p>
          <h2 style={{ fontFamily: LORA, fontSize: 'clamp(24px, 2.8vw, 36px)', fontWeight: 700, color: C.texte, lineHeight: 1.3, margin: '0 0 24px' }}>
            Reperez les bons profils, pas les bons CV.
          </h2>
          <p style={{ fontFamily: INTER, fontSize: '17px', color: C.texte, lineHeight: 1.8, margin: '0 0 40px' }}>
            Les candidats Kapolia se presentent au-dela de leur parcours : leurs valeurs,
            leur facon de travailler, ce qui les motive. Vous identifiez ceux qui
            correspondent a votre equipe sur des criteres concrets, avant meme un entretien.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Puce texte="Des candidatures classees par correspondance avec votre offre, sur des criteres que vous choisissez." />
            <Puce texte="Une candidatheque de profils volontaires, a explorer meme sans offre en cours." />
            <Puce texte="Une page de marque employeur rattachee a vos offres." />
            <Puce texte="De la publication de l'offre au premier contact, tout se passe au meme endroit." />
          </div>
        </div>
      </section>


      {/* ── 6. LE PORTRAIT KAPOLIA ───────────────────────────────────────────── */}
      <section style={{ backgroundColor: C.blanc, padding: '112px 0' }}>
        <div className="kap-wrap" style={{ maxWidth: '640px' }}>
          <p style={{ fontFamily: INTER, fontSize: '12px', fontWeight: 600, color: C.terracotta, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 16px' }}>
            Le Portrait Kapolia
          </p>
          <h2 style={{ fontFamily: LORA, fontSize: 'clamp(24px, 2.8vw, 36px)', fontWeight: 700, color: C.texte, lineHeight: 1.3, margin: '0 0 28px' }}>
            Votre profil, en une page, quand un document reste attendu.
          </h2>
          <p style={{ fontFamily: INTER, fontSize: '17px', color: C.texte, lineHeight: 1.8, margin: 0 }}>
            En entretien ou pour postuler ailleurs, on vous demandera toujours un support ecrit.
            Kapolia le genere a partir de votre profil, en quelques secondes. Une page soignee,
            qui contient vos qualites et ce qui compte pour vous, et pas seulement la liste de
            vos postes.
          </p>
        </div>
      </section>



      {/* ── 8. RAPPEL DU FORMULAIRE ──────────────────────────────────────────── */}
      <section style={{ backgroundColor: C.vert, padding: '96px 0' }}>
        <div className="kap-wrap" style={{ maxWidth: '520px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: LORA, fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 700, color: C.blanc, lineHeight: 1.3, margin: '0 0 12px' }}>
            Rejoindre la liste d'attente
          </h2>
          <p style={{ fontFamily: INTER, fontSize: '16px', color: C.sable, lineHeight: 1.7, margin: '0 0 40px' }}>
            Un seul message, a l'ouverture. Pas de relance, pas de newsletter.
          </p>
          <div style={{
            backgroundColor: C.blanc,
            borderRadius:    '20px',
            padding:         '36px',
            textAlign:       'left',
          }}>
            <WaitlistForm />
          </div>
        </div>
      </section>


      {/* ── 9. PIED DE PAGE ──────────────────────────────────────────────────── */}
      <footer style={{ backgroundColor: C.vertFonce, padding: '28px 0' }}>
        <div className="kap-wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <LogoKapolia variante="clair" taille={24} />
            <span style={{ fontFamily: INTER, fontSize: '13px', color: C.sable }}>· 2026</span>
          </span>
          <div style={{ display: 'flex', gap: '28px' }}>
            {[
              ['Mentions legales',  '/mentions-legales'],
              ['Confidentialite',   '/confidentialite'],
              ['Contact',           'mailto:contact@kapolia.com'],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                style={{ fontFamily: INTER, fontSize: '13px', color: C.sable, textDecoration: 'none', opacity: 0.7 }}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </footer>

    </main>
  )
}
