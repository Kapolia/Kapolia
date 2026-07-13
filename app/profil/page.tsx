'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ProfilView from '@/components/ProfilView'

function ProfilPageInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [state, setState] = useState<{ targetId: string; isOwner: boolean } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/inscription'); return }
      const id = searchParams.get('id') ?? user.id
      setState({ targetId: id, isOwner: id === user.id })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!state) return null

  return (
    <ProfilView
      userId={state.targetId}
      isOwner={state.isOwner}
      initialEditMode={state.isOwner && searchParams.get('edit') === 'true'}
      notFoundRedirect={state.isOwner ? '/onboarding' : undefined}
      sidebarOffset={64}
    />
  )
}

export default function ProfilPage() {
  return (
    <Suspense>
      <ProfilPageInner />
    </Suspense>
  )
}
