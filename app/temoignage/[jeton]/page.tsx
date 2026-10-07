'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import LogoKapolia from '@/components/LogoKapolia'
import { FONT_SERIF } from '@/lib/typography'

const INTER = "'Inter', system-ui, sans-serif"

const C = {
  vert:       '#2C4A3E',
  sable:      '#E8D5B7',
  creme:      '#F7F2EB',
  terracotta: '#C4673A',
  dark:       '#22312B',
  grey:       '#8A9A92',
  border:     '#D4C4A8',
  white:      '#FFFFFF',
  red:        '#C0392B',
}

type Etat = 'chargement' | 'invalide' | 'formulaire' | 'envoi' | 'erreur' | 'succes'

const MAX_CITATION = 400

const inputStyle: React.CSSProperties = {
  width:        '100%',
  boxSizing:    'border-box',
  padding:      '12px 14px',
  borderRadius: 8,
  border:       `1px solid ${C.border}`,
  fontSize:     16,
  fontFamily:   INTER,
  color:        C.dark,
  background:   C.white,
  outline:      'none',
  appearance:   'none' as 'none',
}

const labelStyle: React.CSSProperties = {
  display:       'block',
  fontSize:      13,
  fontWeight:    600,
  color:         C.dark,
  marginBottom:  6,
  letterSpacing: '0.02em',
}

export default function TemoignagePage() {
  const params = useParams<{ jeton: string }>()
  const jeton  = params?.jeton ?? ''

  const [etat,          setEtat]          = useState<Etat>('chargement')
  const [entrepriseNom, setEntrepriseNom] = useState('')
  const [poste,         setPoste]         = useState('')
  const [citation,      setCitation]      = useState('')
  const [focusCitation, setFocusCitation] = useState(false)

  useEffect(() => {
    if (!jeton) { setEtat('invalide'); return }

    supabase
      .rpc('get_invitation_temoignage_info', { p_jeton: jeton })
      .then(({ data, error }) => {
        const rows = data as Array<{ entreprise_nom: string }> | null
        if (error || !rows || rows.length === 0) {
          setEtat('invalide')
          return
        }
        setEntrepriseNom(rows[0].entreprise_nom ?? '')
        setEtat('formulaire')
      })
  }, [jeton])

  const actif       = etat === 'formulaire' || etat === 'erreur'
  const peutEnvoyer = actif && poste.trim().length > 0 && citation.trim().length > 0

  async function envoyer() {
    if (!peutEnvoyer) return
    setEtat('envoi')

    const { error } = await supabase.rpc('soumettre_temoignage', {
      p_jeton:    jeton,
      p_poste:    poste.trim(),
      p_citation: citation.trim(),
    })

    if (error) { setEtat('erreur'); return }
    setEtat('succes')
  }

  return (
    <div style={{
      minHeight:     '100vh',
      background:    C.creme,
      fontFamily:    INTER,
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      padding:       '24px 24px 64px',
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        <header style={{ marginBottom: 40, paddingTop: 8 }}>
          <Link href="/" style={{ display: 'inline-block', lineHeight: 0 }}>
            <LogoKapolia variante="sombre" taille={32} avecTexte />
          </Link>
        </header>

        {/* Lien invalide */}
        {etat === 'invalide' && (
          <p style={{ fontSize: 16, color: C.grey, lineHeight: 1.6, margin: 0 }}>
            Ce lien n'est plus disponible.
          </p>
        )}

        {/* Chargement */}
        {etat === 'chargement' && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
            <style suppressHydrationWarning>{`@keyframes kapolia-spin{to{transform:rotate(360deg)}}`}</style>
            <div style={{
              width:         28,
              height:        28,
              borderRadius:  '50%',
              border:        `2.5px solid ${C.sable}`,
              borderTopColor: C.terracotta,
              animation:     'kapolia-spin 0.8s linear infinite',
            }} />
          </div>
        )}

        {/* Formulaire */}
        {(actif || etat === 'envoi') && (
          <div>
            {/* Surtitre */}
            <div style={{
              fontSize:      11,
              fontWeight:    700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color:         C.terracotta,
              marginBottom:  10,
            }}>
              Témoignage
            </div>

            {/* Nom de l'entreprise */}
            <h1 style={{
              fontFamily: FONT_SERIF,
              fontSize:   'clamp(22px, 6vw, 30px)',
              fontWeight: 600,
              color:      C.vert,
              margin:     '0 0 18px',
              lineHeight: 1.2,
            }}>
              {entrepriseNom}
            </h1>

            {/* Explication */}
            <p style={{
              fontSize:   15,
              lineHeight: 1.7,
              color:      C.dark,
              margin:     '0 0 36px',
            }}>
              {entrepriseNom} vous a transmis ce lien pour recueillir votre regard.
              Votre témoignage sera lu par des candidats qui envisagent de la rejoindre.
              Quelques phrases sincères suffisent.
            </p>

            {/* Champ poste */}
            <div style={{ marginBottom: 24 }}>
              <label htmlFor="poste" style={labelStyle}>Votre poste</label>
              <input
                id="poste"
                type="text"
                autoComplete="organization-title"
                placeholder="Ex. : Développeuse senior, Chef de projet, Comptable..."
                value={poste}
                onChange={e => setPoste(e.target.value)}
                disabled={etat === 'envoi'}
                style={inputStyle}
              />
            </div>

            {/* Champ témoignage */}
            <div style={{ marginBottom: 28 }}>
              <label htmlFor="citation" style={labelStyle}>Votre témoignage</label>
              <textarea
                id="citation"
                rows={5}
                placeholder="Ce que vous diriez à quelqu'un qui hésite à postuler..."
                value={citation}
                onChange={e => setCitation(e.target.value.slice(0, MAX_CITATION))}
                onFocus={() => setFocusCitation(true)}
                disabled={etat === 'envoi'}
                style={{
                  ...inputStyle,
                  resize:     'vertical',
                  lineHeight: 1.65,
                  minHeight:  120,
                }}
              />
              {focusCitation && (
                <div style={{
                  textAlign: 'right',
                  fontSize:  12,
                  color:     citation.length >= MAX_CITATION - 20 ? C.terracotta : C.grey,
                  marginTop: 4,
                }}>
                  {citation.length} / {MAX_CITATION}
                </div>
              )}
            </div>

            {/* Notice données personnelles */}
            <p style={{
              fontSize:        12,
              color:           C.grey,
              lineHeight:      1.65,
              margin:          '0 0 20px',
              padding:         '12px 14px',
              backgroundColor: C.white,
              borderRadius:    8,
              border:          `1px solid ${C.sable}`,
            }}>
              Ce témoignage pourra être publié sur la page de l'entreprise, consultée par
              des candidats en recherche d'emploi. Il sera signé de votre poste uniquement,
              sans votre nom. Dans une petite structure, le seul intitulé de poste peut
              toutefois suffire à identifier son auteur.
            </p>

            {/* Erreur soumission */}
            {etat === 'erreur' && (
              <p role="alert" style={{
                fontSize:   13,
                color:      C.red,
                margin:     '0 0 16px',
                lineHeight: 1.4,
              }}>
                Une erreur est survenue. Veuillez réessayer dans quelques instants.
              </p>
            )}

            {/* Bouton */}
            <button
              type="button"
              onClick={envoyer}
              disabled={!peutEnvoyer}
              style={{
                width:        '100%',
                padding:      '14px 24px',
                borderRadius: 8,
                border:       'none',
                background:   peutEnvoyer ? C.vert : C.sable,
                color:        peutEnvoyer ? C.white : C.grey,
                fontSize:     16,
                fontWeight:   600,
                fontFamily:   INTER,
                cursor:       peutEnvoyer ? 'pointer' : 'default',
                transition:   'background 0.15s, color 0.15s',
              }}
            >
              {etat === 'envoi' ? 'Envoi en cours...' : 'Envoyer mon témoignage'}
            </button>
          </div>
        )}

        {/* Succès */}
        {etat === 'succes' && (
          <div>
            <h1 style={{
              fontFamily: FONT_SERIF,
              fontSize:   32,
              fontWeight: 600,
              color:      C.vert,
              margin:     '0 0 16px',
              lineHeight: 1.1,
            }}>
              Merci pour votre témoignage.
            </h1>
            <p style={{
              fontSize:   16,
              lineHeight: 1.65,
              color:      C.dark,
              margin:     '0 0 40px',
            }}>
              Il a bien été reçu.
            </p>

            <div style={{ borderTop: `1px solid ${C.sable}`, paddingTop: 28 }}>
              <p style={{
                fontSize:   14,
                lineHeight: 1.65,
                color:      C.grey,
                margin:     '0 0 20px',
              }}>
                Kapolia aide les candidats à trouver un emploi qui leur correspond.
              </p>
              <Link href="/" style={{
                display:        'inline-block',
                fontSize:       14,
                fontWeight:     600,
                color:          C.vert,
                textDecoration: 'none',
              }}>
                Découvrir Kapolia →
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
