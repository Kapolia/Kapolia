'use client'

import { useState, useRef } from 'react'
import { flushSync } from 'react-dom'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/colors'
import { FONT_SANS } from '@/lib/typography'
import { reduitMouvement } from '@/lib/motion'
import { isValidEmail } from '@/lib/validation'
import AuthField from '@/components/auth/AuthField'
import { AuthButtonPrimary } from '@/components/auth/AuthButton'
import ErreurDepliable from '@/components/auth/ErreurDepliable'

export default function MotDePasseOubliePage() {
  const [email,       setEmail]       = useState('')
  const [sending,     setSending]     = useState(false)
  const [sent,        setSent]        = useState(false)
  const [serverError, setServerError] = useState('')

  const wrapRef     = useRef<HTMLDivElement | null>(null)
  const formWrapRef = useRef<HTMLDivElement | null>(null)

  const canSubmit = isValidEmail(email.trim()) && !sending

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
      setServerError('Une erreur est survenue. Vérifiez votre connexion et réessayez.')
      return
    }

    await playTransition()
  }

  async function playTransition() {
    if (reduitMouvement()) {
      setSent(true)
      return
    }

    const formEl = formWrapRef.current
    const wrapEl = wrapRef.current

    // Phase 1 : fondu de sortie du formulaire (140 ms)
    if (formEl) {
      formEl.style.transition = 'opacity 140ms ease, transform 140ms ease'
      void formEl.offsetWidth
      formEl.style.opacity   = '0'
      formEl.style.transform = 'translateX(-10px)'
    }
    await new Promise<void>(r => setTimeout(r, 140))

    if (!wrapEl) {
      setSent(true)
      return
    }

    // Hauteur avant le changement de contenu
    const startH = wrapEl.offsetHeight

    // Phase 2 : switch synchrone puis animation de la hauteur (280 ms)
    flushSync(() => setSent(true))
    const endH = wrapEl.offsetHeight

    if (startH !== endH) {
      wrapEl.style.height   = `${startH}px`
      wrapEl.style.overflow = 'hidden'
      void wrapEl.offsetWidth
      wrapEl.style.transition = 'height 280ms cubic-bezier(.2,.8,.2,1)'
      wrapEl.style.height     = `${endH}px`

      await new Promise<void>(r => setTimeout(r, 285))
      wrapEl.style.height     = ''
      wrapEl.style.overflow   = ''
      wrapEl.style.transition = ''
    }
  }

  return (
    <div ref={wrapRef}>
      {!sent ? (
        <div ref={formWrapRef}>
          <form
            onSubmit={handleSubmit}
            noValidate
            className="auth-stagger"
            style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
          >
            <h1 style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: 700,
              color: C.dark,
              fontFamily: FONT_SANS,
              letterSpacing: '-0.01em',
              lineHeight: 1.15,
            }}>
              Mot de passe oublié
            </h1>

            <p style={{ margin: 0, fontSize: '15px', color: C.grey, lineHeight: 1.5 }}>
              {'Indiquez l\'adresse e-mail de votre compte. Nous vous enverrons un lien pour choisir un nouveau mot de passe.'}
            </p>

            <AuthField
              label="Adresse e-mail"
              value={email}
              onChange={v => { setEmail(v); setServerError('') }}
              type="email"
              placeholder="vous@exemple.fr"
              autoComplete="email"
            />

            <ErreurDepliable message={serverError} />

            <AuthButtonPrimary type="submit" disabled={!canSubmit} loading={sending}>
              {sending ? 'Envoi' : 'Envoyer le lien'}
            </AuthButtonPrimary>

            <p style={{ margin: 0, textAlign: 'center', fontSize: '14px', color: C.grey }}>
              <Link
                href="/connexion"
                style={{ color: C.orangeTexte, fontWeight: 600, textDecoration: 'none' }}
              >
                Retour à la connexion
              </Link>
            </p>
          </form>
        </div>
      ) : (
        <div
          className="auth-stagger-delayed"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            textAlign: 'center',
          }}
        >
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
            <circle
              className="mdp-circle"
              cx="26" cy="26" r="22"
              stroke={C.succes}
              strokeWidth="2"
              fill="none"
              transform="rotate(-90 26 26)"
            />
            <path
              className="mdp-check"
              d="M14 27 L22 35 L38 18"
              stroke={C.succes}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>

          <h1 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 700,
            color: C.dark,
            fontFamily: FONT_SANS,
            letterSpacing: '-0.01em',
          }}>
            E-mail envoyé
          </h1>

          <p style={{ margin: 0, fontSize: '15px', color: C.grey, lineHeight: 1.5 }}>
            Si un compte existe avec cette adresse, vous recevrez un lien dans quelques instants.
            Pensez à vérifier vos courriers indésirables.
          </p>

          <p style={{ margin: 0, fontSize: '14px' }}>
            <Link
              href="/connexion"
              style={{ color: C.orangeTexte, fontWeight: 600, textDecoration: 'none' }}
            >
              Retour à la connexion
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}
