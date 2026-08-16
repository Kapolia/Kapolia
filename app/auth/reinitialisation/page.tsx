'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ─── Palette ──────────────────────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

type Status =
  | 'checking'          // attente de la réponse auth (échange de code en cours)
  | 'ready'             // session PASSWORD_RECOVERY confirmée — formulaire actif
  | 'invalid'           // pas de session de récupération valide (lien expiré/inexistant)
  | 'already_connected' // l'utilisateur a une session normale — pas de lien de récup valide
  | 'saving'            // updateUser en cours
  | 'success'           // mot de passe mis à jour

// ─── Sub-components ───────────────────────────────────────────────────────────

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={C.grey} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={C.grey} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
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
        {children}
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

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ReinitialisationPage() {
  const router  = useRouter()
  const [status,       setStatus]       = useState<Status>('checking')
  const [password,     setPassword]     = useState('')
  const [confirm,      setConfirm]      = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [serverError,  setServerError]  = useState('')

  useEffect(() => {
    // Y a-t-il un code de récupération dans l'URL ?
    // Si oui : Supabase échange le code → attend l'event PASSWORD_RECOVERY.
    // Si non : INITIAL_SESSION suffit à déterminer l'état.
    const hasCode = new URLSearchParams(window.location.search).has('code')

    // Stocke la session reçue dans INITIAL_SESSION pour le timeout handler
    let initialSessionPresent = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Session de récupération valide — afficher le formulaire
        if (timeoutId) clearTimeout(timeoutId)
        setStatus('ready')
      } else if (event === 'INITIAL_SESSION') {
        initialSessionPresent = Boolean(session)
        if (!hasCode) {
          // Pas de code dans l'URL : la session actuelle est la réponse définitive
          setStatus(session ? 'already_connected' : 'invalid')
        }
        // Si hasCode : on attend PASSWORD_RECOVERY ou le timeout
      }
    })

    // Timeout de sécurité : si l'échange de code échoue (lien expiré, réseau…),
    // PASSWORD_RECOVERY ne viendra jamais — on montre l'état invalide après 5 s.
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    if (hasCode) {
      timeoutId = setTimeout(() => {
        setStatus(s =>
          s === 'checking'
            ? (initialSessionPresent ? 'already_connected' : 'invalid')
            : s
        )
      }, 5000)
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status !== 'ready') return
    if (password.length < 8 || password !== confirm) return

    setStatus('saving')
    setServerError('')

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setServerError(error.message || 'Une erreur est survenue. Réessayez.')
      setStatus('ready')
      return
    }

    // On déconnecte après le changement : l'utilisateur se reconnecte avec le nouveau mdp.
    await supabase.auth.signOut()
    setStatus('success')
    setTimeout(() => router.replace('/connexion'), 2500)
  }

  const passwordOk = password.length >= 8
  const confirmOk  = confirm === password && passwordOk
  const canSubmit  = status === 'ready' && confirmOk

  // ── Spinner (attente échange de code) ─────────────────────────────────────

  if (status === 'checking') {
    return (
      <Shell>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            border: `3px solid ${C.sable}`, borderTopColor: C.terracotta,
            animation: 'kavio-spin 0.8s linear infinite',
          }} />
        </div>
      </Shell>
    )
  }

  // ── Lien invalide / expiré ────────────────────────────────────────────────

  if (status === 'invalid') {
    return (
      <Shell>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          backgroundColor: '#fdf2f2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '20px',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke={C.error} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 style={{
          fontFamily: 'Georgia, serif',
          fontSize: 'clamp(20px, 3.5vw, 26px)',
          color: C.dark, fontWeight: '400',
          margin: '0 0 12px',
        }}>
          Lien invalide ou expiré
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: '14px', color: C.grey, lineHeight: 1.7 }}>
          Ce lien de réinitialisation est invalide ou a expiré.
          Les liens de réinitialisation sont valables pendant 1 heure.
        </p>
        <a
          href="/mot-de-passe-oublie"
          style={{
            display: 'block',
            width: '100%',
            padding: '13px',
            borderRadius: '14px',
            border: 'none',
            backgroundColor: C.terracotta,
            color: C.white,
            fontSize: '14px',
            fontWeight: '600',
            textAlign: 'center',
            textDecoration: 'none',
            boxSizing: 'border-box',
          }}
        >
          Demander un nouveau lien
        </a>
        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: C.grey }}>
          <a href="/connexion" style={{ color: C.terracotta, fontWeight: '600', textDecoration: 'none' }}>
            Retour à la connexion
          </a>
        </p>
      </Shell>
    )
  }

  // ── Déjà connecté (session normale, pas de récupération) ─────────────────

  if (status === 'already_connected') {
    return (
      <Shell>
        <h1 style={{
          fontFamily: 'Georgia, serif',
          fontSize: 'clamp(20px, 3.5vw, 26px)',
          color: C.dark, fontWeight: '400',
          margin: '0 0 12px',
        }}>
          Vous êtes déjà connecté
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: '14px', color: C.grey, lineHeight: 1.7 }}>
          Vous avez une session active. Ce lien de réinitialisation n'est pas applicable à votre session actuelle.
          Si vous souhaitez changer votre mot de passe, rendez-vous dans vos paramètres.
        </p>
        <a
          href="/profil"
          style={{
            display: 'block',
            width: '100%',
            padding: '13px',
            borderRadius: '14px',
            border: 'none',
            backgroundColor: C.terracotta,
            color: C.white,
            fontSize: '14px',
            fontWeight: '600',
            textAlign: 'center',
            textDecoration: 'none',
            boxSizing: 'border-box',
          }}
        >
          Aller à mon espace
        </a>
      </Shell>
    )
  }

  // ── Succès ────────────────────────────────────────────────────────────────

  if (status === 'success') {
    return (
      <Shell>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          backgroundColor: `${C.vert}14`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
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
          color: C.dark, fontWeight: '400',
          margin: '0 0 12px',
        }}>
          Mot de passe mis à jour
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: C.grey, lineHeight: 1.7 }}>
          Votre mot de passe a bien été modifié. Vous allez être redirigé vers la page de connexion…
        </p>
      </Shell>
    )
  }

  // ── Formulaire (status === 'ready' | 'saving') ────────────────────────────

  return (
    <Shell>
      <h1 style={{
        fontFamily: 'Georgia, serif',
        fontSize: 'clamp(22px, 4vw, 28px)',
        color: C.dark, fontWeight: '400',
        margin: '0 0 10px',
      }}>
        Nouveau mot de passe
      </h1>
      <p style={{ margin: '0 0 28px', fontSize: '14px', color: C.grey, lineHeight: 1.65 }}>
        Choisissez un mot de passe d'au moins 8 caractères.
      </p>

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Nouveau mot de passe */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: C.dark, letterSpacing: '0.02em' }}>
            Nouveau mot de passe
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setServerError('') }}
              placeholder="••••••••"
              autoFocus
              autoComplete="new-password"
              style={{
                width: '100%',
                padding: '12px 44px 12px 14px',
                fontSize: '15px',
                borderRadius: '12px',
                border: `1.5px solid ${password && !passwordOk ? C.error : password ? C.sable : C.lightGrey}`,
                backgroundColor: C.white,
                color: C.dark,
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                transition: 'border-color 0.15s',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
              aria-label={showPassword ? 'Masquer' : 'Afficher'}
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
          {password && !passwordOk && (
            <span style={{ fontSize: '12px', color: C.error }}>8 caractères minimum</span>
          )}
        </div>

        {/* Confirmation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: C.dark, letterSpacing: '0.02em' }}>
            Confirmer le mot de passe
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setServerError('') }}
              placeholder="••••••••"
              autoComplete="new-password"
              style={{
                width: '100%',
                padding: '12px 44px 12px 14px',
                fontSize: '15px',
                borderRadius: '12px',
                border: `1.5px solid ${confirm && confirm !== password ? C.error : confirm ? C.sable : C.lightGrey}`,
                backgroundColor: C.white,
                color: C.dark,
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                transition: 'border-color 0.15s',
              }}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(s => !s)}
              style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
              aria-label={showConfirm ? 'Masquer' : 'Afficher'}
            >
              <EyeIcon open={showConfirm} />
            </button>
          </div>
          {confirm && confirm !== password && (
            <span style={{ fontSize: '12px', color: C.error }}>Les mots de passe ne correspondent pas</span>
          )}
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
            marginTop: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontFamily: 'inherit',
          }}
        >
          {status === 'saving' && (
            <span style={{
              display: 'inline-block',
              width: '16px', height: '16px',
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.35)',
              borderTopColor: '#fff',
              animation: 'kavio-spin 0.7s linear infinite',
              flexShrink: 0,
            }} />
          )}
          {status === 'saving' ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
        </button>

      </form>
    </Shell>
  )
}
