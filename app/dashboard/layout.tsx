'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Status = 'loading' | 'ok' | 'redirect'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('loading')

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

      setStatus('ok')
    }
    guard()
  }, [router])

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
      {children}
    </div>
  )
}
