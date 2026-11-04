'use client'

import { useRef, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/colors'

let sidebarCache: boolean | null = null

export function preloadSidebarCache(value: boolean) {
  sidebarCache = value
}

export default function CandidatPanneauLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hasSidebar, setHasSidebar] = useState(sidebarCache ?? true)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        sidebarCache = false
        setHasSidebar(false)
        return
      }
      const { data } = await supabase
        .from('profils')
        .select('type_compte, onboarding_completed')
        .eq('user_id', user.id)
        .maybeSingle()
      const result = data?.type_compte === 'candidat' && !!data?.onboarding_completed
      sidebarCache = result
      setHasSidebar(result)
    }

    if (sidebarCache === null) check()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        sidebarCache = null
        setHasSidebar(false)
      } else if (event === 'SIGNED_IN') {
        sidebarCache = null
        check()
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  if (!hasSidebar) return <>{children}</>

  return (
    <div style={{ paddingLeft: 'var(--kapolia-sidebar-w)', boxSizing: 'border-box', backgroundColor: C.vert, height: '100dvh', transition: 'padding-left 320ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
      <div style={{ marginLeft: 6, height: '100%', borderRadius: '20px 0 0 20px', overflow: 'hidden' }}>
        <div ref={scrollRef} style={{ height: '100%', overflowY: 'auto', backgroundColor: C.bg }}>
          {children}
        </div>
      </div>
    </div>
  )
}
