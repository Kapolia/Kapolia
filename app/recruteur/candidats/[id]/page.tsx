'use client'

import { useParams, useRouter } from 'next/navigation'
import ProfilView from '@/components/ProfilView'
import { SIDEBAR_WIDTH } from '@/components/RecruiterSidebar'

const C = { sable: '#E7EAE8', creme: '#F6F7F6', dark: '#15201B', white: '#FFFFFF' }

export default function CandidatProfilPage() {
  const params = useParams()
  const router = useRouter()

  function retour() {
    if (window.history.length > 1) router.back()
    else router.replace('/recruteur/candidatheque')
  }

  return (
    <>
      {/* Bouton retour fixe, positionne apres la barre laterale */}
      <button
        onClick={retour}
        style={{
          position: 'fixed', top: 16, left: SIDEBAR_WIDTH + 16, zIndex: 100,
          padding: '7px 16px', borderRadius: 10,
          border: `1.5px solid ${C.sable}`,
          backgroundColor: C.white, color: C.dark,
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'inherit', boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
          transition: 'background-color 0.12s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = C.creme }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = C.white }}
      >
        Retour
      </button>

      <ProfilView
        userId={params.id as string}
        isOwner={false}
        sidebarOffset={0}
      />
    </>
  )
}
