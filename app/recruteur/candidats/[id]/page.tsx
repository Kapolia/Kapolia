'use client'

import { useParams } from 'next/navigation'
import ProfilView from '@/components/ProfilView'

export default function CandidatProfilPage() {
  const params = useParams()
  return (
    <ProfilView
      userId={params.id as string}
      isOwner={false}
      sidebarOffset={0}
    />
  )
}
