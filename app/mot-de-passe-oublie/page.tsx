'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const C = {
  terracotta: '#C4673A',
  sable:      '#E8D5B7',
  creme:      '#F7F2EB',
  vert:       '#2C4A3E',
  dark:       '#1A1A1A',
  grey:       '#6B6B6B',
  lightGrey:  '#D0D0D0',
  white:      '#FFFFFF',
  error:      '#C0392B',
}

export default function MotDePasseOubliePage() {
  const router = useRouter()
  const [email,       setEmail]       = useState('')
  const [sending,     setSending]     = useState(false)
  const [sent,        setSent]        = useState(false)
  const [serverError, setServerError] = useState('')

  const canSubmit = email.trim().length > 0 && !sending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSending(true)
    setServerError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/reinitialisation`,
    })

    setSending(false)

    if (error) {
      // resetPasswordForEmail renvoie 200 même si l'email n'existe pas.
      // Une vraie erreur ici = problème technique (réseau, rate-limit…).
      setServerError('Une erreur est survenue. Vérifiez votre connexion et réessayez.')
      return
    }

    setSent(true)
  }

  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: C.creme,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: 'clamp(40px, 6%, 72px) clamp(20px, 5%, 40px)',
    }}>
      <style suppressHydrationWarning>
        {`@keyframes kavio-spin { to { transform: rotate(360deg); } }`}
      </style>

      <a href="/" style={{ marginBottom: '40px', textDecoration: 'none' }}>
        <img src="/logo-kavio.png" alt="Kavio" style={{ height: '64px', objectFit: 'contain' }} />
      </a>

      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: C.white,
        borderRadius: '24px',
        padding: 'clamp(28px, 5%, 44px)',
        boxShadow: '0 2px 24px rgba(26,26,26,0.07)',
      }}>

        {!sent ? (
          <>
            <h1 style={{
              fontFamily: 'Georgia, serif',
              fontSize: 'clamp(22px, 4vw, 28px)',
              color: C.dark,
              fontWeight: '400',
              margin: '0 0 10px',
            }}>
              Mot de passe oublié
            </h1>
            <p style={{ margin: '0 0 28px', fontSize: '14px', color: C.grey, lineHeight: 1.65 }}>
              Indiquez l'adresse e-mail de votre compte. Nous vous enverrons un lien pour choisir un nouveau mot de passe.
            </p>

            <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: C.dark, letterSpacing: '0.02em' }}>
                  Adresse e-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setServerError('') }}
                  placeholder="vous@exemple.fr"
                  autoFocus
                  autoComplete="email"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: '15px',
                    borderRadius: '12px',
                    border: `1.5px solid ${email ? C.sable : C.lightGrey}`,
                    backgroundColor: C.white,
                    color: C.dark,
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.15s',
                  }}
                />
              </div>

              {serverError && (
                <div style={{
                  padding: '11px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#fdf2f2',
                  border: `1px solid ${C.error}30`,
                  color: C.error,
                  fontSize: '13px',
                  lineHeight: 1.5,
                }}>
                  {serverError}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '14px',
                  border: 'none',
                  backgroundColor: canSubmit ? C.terracotta : C.sable,
                  color: canSubmit ? C.white : C.grey,
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: canSubmit ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontFamily: 'inherit',
                }}
              >
                {sending && (
                  <span style={{
                    display: 'inline-block',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.35)',
                    borderTopColor: '#fff',
                    animation: 'kavio-spin 0.7s linear infinite',
                    flexShrink: 0,
                  }} />
                )}
                {sending ? 'Envoi…' : 'Envoyer le lien'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: C.grey }}>
              <a href="/connexion" style={{ color: C.terracotta, fontWeight: '600', textDecoration: 'none' }}>
                ← Retour à la connexion
              </a>
            </p>
          </>
        ) : (
          <>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: `${C.vert}14`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke={C.vert} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>

            <h1 style={{
              fontFamily: 'Georgia, serif',
              fontSize: 'clamp(20px, 3.5vw, 26px)',
              color: C.dark,
              fontWeight: '400',
              margin: '0 0 12px',
            }}>
              Email envoyé
            </h1>
            <p style={{ margin: '0 0 28px', fontSize: '14px', color: C.grey, lineHeight: 1.7 }}>
              Si un compte existe avec cette adresse, vous recevrez un e-mail de réinitialisation dans quelques instants.
              Pensez à vérifier vos spams.
            </p>

            <button
              onClick={() => router.push('/connexion')}
              style={{
                background: 'none',
                border: 'none',
                color: C.terracotta,
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                padding: 0,
                fontFamily: 'inherit',
              }}
            >
              ← Retour à la connexion
            </button>
          </>
        )}
      </div>

      <p style={{
        marginTop: '32px',
        fontSize: '12px',
        color: C.lightGrey,
        fontFamily: 'Georgia, serif',
        fontStyle: 'italic',
        textAlign: 'center',
      }}>
        « Trouvez votre cap. »
      </p>
    </main>
  )
}
