'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import RecruiterSidebar, { SIDEBAR_WIDTH } from '@/components/RecruiterSidebar'

type Status = 'loading' | 'ok' | 'redirect'

export default function RecruteurLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [status, setStatus]         = useState<Status>('loading')
  const [entrepriseNom, setNom]     = useState('Mon entreprise')
  const [plan]                      = useState('Pro')
  const [initiale, setInitiale]     = useState('?')
  const [prenom, setPrenom]         = useState('')

  useEffect(() => {
    async function guard() {
      // ── 1. Check auth ──────────────────────────────────────────────────────
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      console.log('[recruteur/layout] user:', user?.id ?? null, 'authError:', authError?.message ?? null)

      if (!user) {
        console.log('[recruteur/layout] → not logged in, redirect /connexion')
        setStatus('redirect')
        router.replace('/connexion')
        return
      }

      // ── 2. Fetch profil ────────────────────────────────────────────────────
      const { data: profil, error: profilError } = await supabase
        .from('profils')
        .select('type_compte, prenom, nom, entreprise_nom')
        .eq('user_id', user.id)
        .single()

      console.log('[recruteur/layout] type_compte:', profil?.type_compte ?? null, 'profilError:', profilError?.message ?? null)

      // ── 3. Route by type ───────────────────────────────────────────────────
      if (profilError || !profil) {
        // Can't determine type — let them through rather than loop
        console.warn('[recruteur/layout] profil not found or error — allowing access')
        setStatus('ok')
        return
      }

      if (profil.type_compte === 'candidat') {
        console.log('[recruteur/layout] → candidat, redirect /dashboard')
        setStatus('redirect')
        router.replace('/dashboard')
        return
      }

      if (profil.type_compte !== 'recruteur') {
        // Unknown type — allow rather than loop
        console.warn('[recruteur/layout] unknown type_compte:', profil.type_compte, '— allowing access')
      }

      // ── 4. OK — show layout ────────────────────────────────────────────────
      const companyName = profil.entreprise_nom || [profil.prenom, profil.nom].filter(Boolean).join(' ') || 'Mon entreprise'
      setNom(companyName)
      setInitiale(companyName?.[0]?.toUpperCase() ?? '?')
      setPrenom(profil.prenom ?? '')
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
        <style suppressHydrationWarning>{`@keyframes kavio-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          border: '3px solid #E8D5B7', borderTopColor: '#C4673A',
          animation: 'kavio-spin 0.8s linear infinite',
        }} />
      </div>
    )
  }

  const isFullHeight = pathname === '/recruteur/messages' || pathname.includes('/candidatures')

  return (
    <div style={{
      display: 'flex',
      height: isFullHeight ? '100vh' : 'auto',
      overflow: isFullHeight ? 'hidden' : 'visible',
      backgroundColor: '#F7F2EB',
    }}>
      <RecruiterSidebar
        entrepriseNom={entrepriseNom}
        plan={plan}
        initiale={initiale}
        prenom={prenom}
      />
      <div style={{
        marginLeft: SIDEBAR_WIDTH,
        flex: 1,
        minWidth: 0,
        height: isFullHeight ? '100%' : 'auto',
        overflow: isFullHeight ? 'hidden' : 'auto',
      }}>
        {children}
      </div>
    </div>
  )
}
