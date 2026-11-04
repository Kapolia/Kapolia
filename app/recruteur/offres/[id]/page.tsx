'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { OffreDetail, type OffreData } from '@/components/OffreDetail'
import { SIDEBAR_WIDTH } from '@/components/RecruiterSidebar'

const C = {
  terracotta: '#C4673A',
  sable:      '#E7EAE8',
  creme:      '#F6F7F6',
  dark:       '#15201B',
  grey:       '#687069',
  white:      '#FFFFFF',
}

// OffreData n'expose pas statut — on l'etend localement
type OffreAvecStatut = OffreData & { statut?: string | null }

function statutConfig(statut: string | null | undefined): { label: string; bg: string; color: string } {
  switch (statut) {
    case 'publiée':  return { label: 'Publiee',  bg: '#F0FDF4',         color: '#16A34A' }
    case 'archivée': return { label: 'Archivee', bg: `${C.dark}0A`,     color: C.grey    }
    default:         return { label: 'Brouillon', bg: `${C.sable}88`,   color: C.grey    }
  }
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <style suppressHydrationWarning>{`@keyframes kapolia-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        border: `3px solid ${C.sable}`, borderTopColor: C.terracotta,
        animation: 'kapolia-spin 0.8s linear infinite',
      }} />
    </div>
  )
}

export default function OffreRecruteurPage() {
  const params = useParams()
  const router = useRouter()
  const id     = params.id as string

  const [offre,          setOffre]          = useState<OffreAvecStatut | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [notFound,       setNotFound]       = useState(false)
  const [isAuteur,       setIsAuteur]       = useState(false)
  const [nbCandidatures, setNbCandidatures] = useState<number | null>(null)

  useEffect(() => {
    let annule = false

    async function charger() {
      // 1. Utilisateur connecte
      const { data: { user } } = await supabase.auth.getUser()

      // 2. Offre (sans filtre de publication — le recruteur voit tous ses statuts)
      const { data, error } = await supabase
        .from('offres')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        console.error('[offre recruteur fetch]', error?.message, error?.code, error?.details, error?.hint)
        if (!annule) { setNotFound(true); setLoading(false) }
        return
      }

      // Enrichir avec le profil entreprise
      if (data.recruteur_id) {
        const { data: ep } = await supabase
          .from('profils')
          .select('entreprise_nom, entreprise_logo_url')
          .eq('user_id', data.recruteur_id)
          .single()
        if (ep) {
          data.entreprise_nom = ep.entreprise_nom
          if (ep.entreprise_logo_url) data.entreprise_logo_url = ep.entreprise_logo_url
        }
      }

      const auteur = !!user && user.id === data.recruteur_id
      if (!annule) { setOffre(data as OffreAvecStatut); setIsAuteur(auteur) }

      // 3. Compteur de candidatures uniquement pour l'auteur
      if (auteur) {
        const { count, error: countErr } = await supabase
          .from('candidatures')
          .select('*', { count: 'exact', head: true })
          .eq('offre_id', id)
        if (countErr) {
          console.error('[offre recruteur count]', countErr.message, countErr.code, countErr.details, countErr.hint)
        } else if (!annule) {
          setNbCandidatures(count ?? 0)
        }
      }

      if (!annule) setLoading(false)
    }

    charger()
    return () => { annule = true }
  }, [id])

  function retour() {
    if (window.history.length > 1) router.back()
    else router.replace('/recruteur/offres')
  }

  if (loading) return <Spinner />

  if (notFound || !offre) {
    return (
      <div style={{ padding: '60px 40px', textAlign: 'center' }}>
        <p style={{ color: C.grey, fontSize: 14, marginBottom: 20 }}>
          Cette offre est introuvable.
        </p>
        <button
          onClick={() => router.push('/recruteur/offres')}
          style={{
            padding: '10px 24px', borderRadius: 12, border: 'none',
            backgroundColor: C.terracotta, color: C.white,
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Retour aux offres
        </button>
      </div>
    )
  }

  const stat = statutConfig(offre.statut)

  const actionsRecruteur = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>

      {/* Statut — visible pour tout recruteur */}
      <span style={{
        fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 20,
        backgroundColor: stat.bg, color: stat.color, whiteSpace: 'nowrap' as const,
      }}>
        {stat.label}
      </span>

      {/* Candidatures — auteur uniquement */}
      {isAuteur && nbCandidatures !== null && (
        <button
          onClick={() => router.push(`/recruteur/offres/${id}/candidatures`)}
          style={{
            height: 44, padding: '0 16px',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            borderRadius: 12,
            border: `1px solid ${C.sable}`,
            backgroundColor: C.white, color: C.dark,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', whiteSpace: 'nowrap' as const,
            transition: 'background-color 0.12s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = C.creme }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = C.white }}
        >
          {nbCandidatures} candidature{nbCandidatures !== 1 ? 's' : ''}
        </button>
      )}

      {/* Modifier — auteur uniquement */}
      {isAuteur && (
        <button
          onClick={() => router.push(`/recruteur/offres/publier?id=${id}`)}
          style={{
            height: 44, padding: '0 18px',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            borderRadius: 12, border: 'none',
            backgroundColor: C.terracotta, color: C.white,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', whiteSpace: 'nowrap' as const,
            transition: 'background-color 0.12s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#B35830' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = C.terracotta }}
        >
          Modifier l'offre
        </button>
      )}
    </div>
  )

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

      <OffreDetail
        offre={offre}
        applied={false}
        appliedDate={null}
        applying={false}
        saved={false}
        isConnected={false}
        similaires={[]}
        onApply={() => {}}
        onToggleSave={() => {}}
        mode="page"
        actionsRecruteur={actionsRecruteur}
        entrepriseLinkPrefix="/recruteur"
      />
    </>
  )
}
