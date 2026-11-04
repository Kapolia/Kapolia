'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import LogoKapolia from '@/components/LogoKapolia'

import { FONT_SERIF, FONT_SANS } from '@/lib/typography'
import { C as _C } from '@/lib/colors'
const C = { ..._C, dark: '#22312B' as const, grey: '#8A9A92' as const, border: '#D4C4A8' as const }

type Etat = 'chargement' | 'invalide' | 'formulaire' | 'envoi' | 'erreur' | 'succes'

const inputStyle: React.CSSProperties = {
  width:        '100%',
  boxSizing:    'border-box',
  padding:      '12px 14px',
  borderRadius: 8,
  border:       `1px solid ${C.border}`,
  fontSize:     16,
  fontFamily:   FONT_SANS,
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

export default function RepondrePage() {
  const params = useParams<{ jeton: string }>()
  const jeton  = params?.jeton ?? ''

  const [etat,         setEtat]         = useState<Etat>('chargement')
  const [prenomCand,   setPrenomCand]   = useState('')
  const [prenomProche, setPrenomProche] = useState('')
  const [q1, setQ1] = useState('')
  const [q2, setQ2] = useState('')
  const [q3, setQ3] = useState('')

  useEffect(() => {
    if (!jeton) { setEtat('invalide'); return }

    supabase
      .rpc('get_invitation_info', { p_jeton: jeton })
      .then(({ data, error }) => {
        const rows = data as Array<{ candidat_prenom: string }> | null
        if (error || !rows || rows.length === 0) {
          setEtat('invalide')
          return
        }
        setPrenomCand(rows[0].candidat_prenom ?? '')
        setEtat('formulaire')
      })
  }, [jeton])

  const actif       = etat === 'formulaire' || etat === 'erreur'
  const peutEnvoyer = actif && prenomProche.trim().length > 0 && q1.trim().length > 0

  async function envoyer() {
    if (!peutEnvoyer) return
    setEtat('envoi')

    const qualites = [q1, q2, q3].map(q => q.trim()).filter(Boolean)

    const { error } = await supabase.rpc('soumettre_reponse_proche', {
      p_jeton:    jeton,
      p_prenom:   prenomProche.trim(),
      p_qualites: qualites,
    })

    if (error) { setEtat('erreur'); return }
    setEtat('succes')

    void fetch('/api/notif/reponse-proche', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ jeton }),
    })
  }

  const boutonActif = peutEnvoyer

  return (
    <div style={{
      minHeight:     '100vh',
      background:    C.bg,
      fontFamily:    FONT_SANS,
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

        {/* Formulaire */}
        {(actif || etat === 'envoi') && (
          <div>
            <h1 style={{
              fontFamily: FONT_SERIF, letterSpacing: '-0.005em',
              fontSize:   'clamp(20px, 5vw, 26px)',
              fontWeight: 600,
              color:      C.vert,
              margin:     '0 0 16px',
              lineHeight: 1.25,
            }}>
              Comment décririez-vous {prenomCand} ?
            </h1>

            <p style={{
              fontSize:   15,
              lineHeight: 1.65,
              color:      C.dark,
              margin:     '0 0 32px',
            }}>
              {prenomCand} vous a transmis ce lien pour recueillir votre regard.
              <br /><br />
              Écrivez une, deux ou trois qualités que vous lui reconnaissez.{' '}
              {prenomCand} recevra vos mots directement et pourra en afficher jusqu'à
              trois sur son profil Kapolia, que consultent des recruteurs, tels que
              vous les avez écrits.
            </p>

            {/* Prénom du répondant */}
            <div style={{ marginBottom: 28 }}>
              <label htmlFor="prenom-proche" style={labelStyle}>Votre prénom</label>
              <input
                id="prenom-proche"
                type="text"
                autoComplete="given-name"
                value={prenomProche}
                onChange={e => setPrenomProche(e.target.value)}
                disabled={etat === 'envoi'}
                style={inputStyle}
              />
            </div>

            {/* Qualités */}
            <div style={{ marginBottom: 28 }}>
              <div style={labelStyle}>Les qualités que vous lui reconnaissez</div>
              <p style={{
                fontSize:   13,
                color:      C.grey,
                margin:     '0 0 14px',
                lineHeight: 1.5,
              }}>
                Au moins une est nécessaire. Les deux suivantes sont facultatives.
              </p>

              <div style={{ marginBottom: 10 }}>
                <input
                  id="q1"
                  type="text"
                  value={q1}
                  onChange={e => setQ1(e.target.value.slice(0, 30))}
                  disabled={etat === 'envoi'}
                  style={inputStyle}
                />
                <div style={{
                  textAlign: 'right',
                  fontSize:  11,
                  color:     q1.length >= 28 ? C.terracotta : C.grey,
                  marginTop: 3,
                }}>
                  {q1.length}/30
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <input
                  id="q2"
                  type="text"
                  placeholder="Deuxième qualité (facultative)"
                  value={q2}
                  onChange={e => setQ2(e.target.value.slice(0, 30))}
                  disabled={etat === 'envoi'}
                  style={inputStyle}
                />
                {q2.length > 0 && (
                  <div style={{
                    textAlign: 'right',
                    fontSize:  11,
                    color:     q2.length >= 28 ? C.terracotta : C.grey,
                    marginTop: 3,
                  }}>
                    {q2.length}/30
                  </div>
                )}
              </div>

              <div>
                <input
                  id="q3"
                  type="text"
                  placeholder="Troisième qualité (facultative)"
                  value={q3}
                  onChange={e => setQ3(e.target.value.slice(0, 30))}
                  disabled={etat === 'envoi'}
                  style={inputStyle}
                />
                {q3.length > 0 && (
                  <div style={{
                    textAlign: 'right',
                    fontSize:  11,
                    color:     q3.length >= 28 ? C.terracotta : C.grey,
                    marginTop: 3,
                  }}>
                    {q3.length}/30
                  </div>
                )}
              </div>
            </div>

            {/* Mention données personnelles */}
            <p style={{
              fontSize:   12,
              color:      C.grey,
              lineHeight: 1.55,
              margin:     '0 0 16px',
            }}>
              Votre prénom est recueilli uniquement pour que {prenomCand} sache qui a
              répondu. Il ne sera jamais affiché publiquement et sera supprimé avec
              son compte.{' '}
              <Link
                href="/confidentialite"
                style={{ color: C.grey, textDecoration: 'underline' }}
              >
                Politique de confidentialité
              </Link>
            </p>

            {etat === 'erreur' && (
              <p role="alert" style={{
                fontSize:   13,
                color:      C.erreur,
                margin:     '0 0 12px',
                lineHeight: 1.4,
              }}>
                Une erreur s'est produite. Veuillez réessayer.
              </p>
            )}

            <button
              type="button"
              onClick={envoyer}
              disabled={!boutonActif}
              style={{
                width:        '100%',
                padding:      '14px 24px',
                borderRadius: 8,
                border:       'none',
                background:   boutonActif ? C.vert : C.sable,
                color:        boutonActif ? C.white : C.grey,
                fontSize:     16,
                fontWeight:   600,
                fontFamily:   FONT_SANS,
                cursor:       boutonActif ? 'pointer' : 'default',
                transition:   'background 0.15s, color 0.15s',
              }}
            >
              {etat === 'envoi' ? 'Envoi en cours...' : 'Envoyer ma réponse'}
            </button>
          </div>
        )}

        {/* Ecran de confirmation */}
        {etat === 'succes' && (
          <div>
            <h1 style={{
              fontFamily: FONT_SERIF, letterSpacing: '-0.005em',
              fontSize:   32,
              fontWeight: 600,
              color:      C.vert,
              margin:     '0 0 16px',
              lineHeight: 1.1,
            }}>
              Merci.
            </h1>
            <p style={{
              fontSize:   16,
              lineHeight: 1.65,
              color:      C.dark,
              margin:     '0 0 40px',
            }}>
              {prenomCand} a bien reçu vos mots.
            </p>

            <div style={{
              borderTop:  `1px solid ${C.sable}`,
              paddingTop: 28,
            }}>
              <p style={{
                fontSize:   14,
                lineHeight: 1.65,
                color:      C.grey,
                margin:     '0 0 20px',
              }}>
                Kapolia aide les candidats à se présenter tels qu'ils sont, à travers
                leurs propres mots et ceux des personnes qui les connaissent bien.
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
