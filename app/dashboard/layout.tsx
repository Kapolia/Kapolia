'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const C = {
  terracotta: '#C4673A',
  sable:      '#E8D5B7',
  dark:       '#1A1A1A',
  grey:       '#9B9B9B',
}

function BandeauEmailNonVerifie() {
  const [cooldown, setCooldown] = useState(0)
  const [envoi, setEnvoi]       = useState(false)
  const [envoye, setEnvoye]     = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  async function renvoyer() {
    if (cooldown > 0 || envoi) return
    setEnvoi(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      await supabase.auth.resend({ type: 'signup', email: user.email })
    }
    setEnvoi(false)
    setEnvoye(true)
    setCooldown(60)
  }

  const btnLabel = envoi            ? 'envoi…'
                : envoye && cooldown > 0 ? `lien envoyé (${cooldown} s)`
                : 'renvoyer le lien'

  return (
    <div style={{
      backgroundColor: '#FEF4EE',
      borderBottom: `1px solid ${C.sable}`,
      padding: '11px clamp(24px, 5vw, 60px)',
    }}>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: C.dark }}>
        <strong>Confirmez votre adresse e-mail</strong> pour pouvoir apparaître dans la
        candidathèque et recevoir des messages de recruteurs.
        {' '}Consultez votre boîte de réception, ou{' '}
        <button
          onClick={renvoyer}
          disabled={cooldown > 0 || envoi}
          style={{
            background: 'none', border: 'none', padding: 0, margin: 0,
            color: cooldown > 0 ? C.grey : C.terracotta,
            fontSize: 13, fontWeight: 600,
            cursor: cooldown > 0 || envoi ? 'default' : 'pointer',
            fontFamily: 'inherit', textDecoration: 'underline',
          }}
        >
          {btnLabel}
        </button>
        .
      </p>
    </div>
  )
}

type Status = 'loading' | 'ok' | 'redirect'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [status, setStatus]               = useState<Status>('loading')
  const [emailConfirme, setEmailConfirme] = useState(true)

  useEffect(() => {
    async function guard() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setStatus('redirect')
        router.replace('/connexion')
        return
      }

      const { data: profil } = await supabase
        .from('profils')
        .select('type_compte')
        .eq('user_id', user.id)
        .single()

      if (profil?.type_compte === 'recruteur') {
        setStatus('redirect')
        router.replace('/recruteur')
        return
      }

      setEmailConfirme(!!user.email_confirmed_at)
      setStatus('ok')
    }
    guard()
  }, [router])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email_confirmed_at) setEmailConfirme(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (status === 'loading' || status === 'redirect') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#F7F2EB',
      }}>
        <style suppressHydrationWarning>{`@keyframes kapolia-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '3px solid #E8D5B7', borderTopColor: '#C4673A',
          animation: 'kapolia-spin 0.8s linear infinite',
        }} />
      </div>
    )
  }

  return (
    <div style={{ marginLeft: 64, flex: 1, minWidth: 0 }}>
      {!emailConfirme && <BandeauEmailNonVerifie />}
      {children}
    </div>
  )
}
