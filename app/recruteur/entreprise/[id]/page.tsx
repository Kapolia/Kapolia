'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  EntrepriseVitrineContenu,
  type EntrepriseProfil,
  type Offre,
  PROFIL_SELECT,
} from '@/components/EntrepriseVitrine'
import { SIDEBAR_WIDTH } from '@/components/RecruiterSidebar'

const C = {
  creme: '#F7F2EB', sable: '#E8D5B7', terracotta: '#C4673A',
  dark: '#1A1A1A', grey: '#6B6B6B', white: '#FFFFFF',
}

function Spinner() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style suppressHydrationWarning>{`@keyframes kapolia-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${C.sable}`, borderTopColor: C.terracotta, animation: 'kapolia-spin 0.8s linear infinite' }} />
    </div>
  )
}

export default function RecruteurEntreprisePage() {
  const params = useParams()
  const router = useRouter()
  const id     = params.id as string

  const [ep,       setEp]       = useState<EntrepriseProfil | null>(null)
  const [offres,   setOffres]   = useState<Offre[]>([])
  const [loading,  setLoading]  = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let annule = false

    async function load() {
      const { data: rawData, error } = await supabase
        .from('profils').select(PROFIL_SELECT).eq('user_id', id).single()

      if (error) {
        if (!annule) { setNotFound(true); setLoading(false) }
        return
      }

      const profilData = rawData as unknown as EntrepriseProfil | null
      if (!profilData?.entreprise_nom) {
        if (!annule) { setNotFound(true); setLoading(false) }
        return
      }

      if (!annule) setEp(profilData)

      const { data: offresData } = await supabase
        .from('offres')
        .select('id, titre, type_contrat, ville, mode_travail, domaine, experience, salaire_min, salaire_max, periode_salaire, valeurs, created_at')
        .eq('recruteur_id', id).eq('statut_publication', 'publiée').eq('active', true)
        .order('created_at', { ascending: false })

      if (!annule) {
        setOffres((offresData ?? []) as Offre[])
        setLoading(false)
      }
    }

    load()
    return () => { annule = true }
  }, [id])

  function retour() {
    const vientDeLApp = document.referrer && document.referrer.startsWith(window.location.origin)
    if (vientDeLApp) router.back()
    else router.replace('/recruteur/offres')
  }

  if (loading) return <Spinner />

  if (notFound || !ep) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, minHeight: '60vh', padding: 40 }}>
      <p style={{ color: C.grey, fontSize: 14, margin: 0, textAlign: 'center' }}>Cette page entreprise est introuvable.</p>
      <button
        onClick={() => router.push('/recruteur/offres')}
        style={{ padding: '10px 24px', borderRadius: 12, border: 'none', backgroundColor: C.terracotta, color: C.white, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        Retour aux offres
      </button>
    </div>
  )

  return (
    <>
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

      <EntrepriseVitrineContenu
        ep={ep}
        offres={offres}
        candidatProfil={null}
        isConnected={true}
        contexteRecruteur={true}
      />
    </>
  )
}
