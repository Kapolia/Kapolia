'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FONT_SERIF } from '@/lib/typography'
import { scoreBreakdownCandidat, type ProfilMatch } from '@/lib/matching'
import {
  EntrepriseVitrineContenu,
  type EntrepriseProfil,
  type Offre,
  PROFIL_SELECT,
} from '@/components/EntrepriseVitrine'

const C = {
  creme: '#F6F7F6', sable: '#E7EAE8', terracotta: '#C4673A',
  dark: '#15201B', grey: '#687069', white: '#FFFFFF',
}

export default function EntrepriseVitrinePage() {
  const params = useParams()
  const id     = params.id as string

  const [ep,             setEp]             = useState<EntrepriseProfil | null>(null)
  const [offres,         setOffres]         = useState<Offre[]>([])
  const [loading,        setLoading]        = useState(true)
  const [notFound,       setNotFound]       = useState(false)
  const [fetchError,     setFetchError]     = useState(false)
  const [isConnected,    setIsConnected]    = useState(false)
  const [candidatProfil, setCandidatProfil] = useState<ProfilMatch | null>(null)

  useEffect(() => {
    let annule = false

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!annule) setIsConnected(!!user)

      const { data: rawData, error: profilError } = await supabase
        .from('profils_vue_publique').select(PROFIL_SELECT).eq('user_id', id).single()

      if (profilError) {
        if (!annule) {
          if (profilError.code === 'PGRST116') setNotFound(true)
          else {
            console.error('[vitrine]', profilError.message, profilError.code, profilError.details, profilError.hint)
            setFetchError(true)
          }
          setLoading(false)
        }
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
        .select('id, titre, type_contrat, ville, mode_travail, domaine, experience, salaire_min, salaire_max, periode_salaire, valeurs, langues, competences, competences_bonus, created_at')
        .eq('recruteur_id', id).eq('statut_publication', 'publiée').eq('active', true).gt('expire_at', new Date().toISOString())
        .order('created_at', { ascending: false })

      const raw = (offresData ?? []) as Offre[]

      if (user) {
        const { data: p } = await supabase.from('profils')
          .select('domaine, experience, type_poste, valeur, disponibilite, ville, mode_travail, langues, competences_acquises')
          .eq('user_id', user.id).single()
        if (p) {
          if (!annule) setCandidatProfil(p as ProfilMatch)
          if (!annule) setOffres(raw.map(o => {
            const bd = scoreBreakdownCandidat(p as ProfilMatch, o as Parameters<typeof scoreBreakdownCandidat>[1])
            return { ...o, score: bd.total ?? undefined, breakdown: bd }
          }))
        } else if (!annule) setOffres(raw)
      } else if (!annule) setOffres(raw)

      if (!annule) setLoading(false)
    }

    load()
    return () => { annule = true }
  }, [id])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: C.creme }}>
      <style suppressHydrationWarning>{`@keyframes kapolia-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${C.sable}`, borderTopColor: C.terracotta, animation: 'kapolia-spin 0.8s linear infinite' }} />
    </div>
  )

  if (fetchError) return (
    <div style={{ minHeight: '100vh', backgroundColor: C.creme, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: isConnected ? 'var(--kapolia-sidebar-w)' : 0 }}>
      <div style={{ textAlign: 'center', padding: '60px 24px' }}>
        <p style={{ fontFamily: FONT_SERIF, fontSize: 17, color: C.dark, margin: '0 0 8px' }}>Une erreur est survenue</p>
        <p style={{ fontSize: 14, color: C.grey, margin: 0 }}>Impossible de charger cette page. Veuillez réessayer dans quelques instants.</p>
      </div>
    </div>
  )

  if (notFound || !ep) return (
    <div style={{ minHeight: '100vh', backgroundColor: C.creme, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: isConnected ? 'var(--kapolia-sidebar-w)' : 0 }}>
      <div style={{ textAlign: 'center', padding: '60px 24px' }}>
        <h1 style={{ fontFamily: FONT_SERIF, fontSize: 24, color: C.dark, margin: '0 0 10px' }}>Entreprise introuvable</h1>
        <p style={{ fontSize: 14, color: C.grey, margin: '0 0 24px' }}>Cette page n'existe pas ou l'entreprise n'a pas encore configuré son profil.</p>
        <a href="/offres" style={{ padding: '11px 24px', borderRadius: 12, border: 'none', backgroundColor: C.terracotta, color: C.white, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', display: 'inline-block' }}>Voir les offres</a>
      </div>
    </div>
  )

  return (
    <EntrepriseVitrineContenu
      ep={ep}
      offres={offres}
      candidatProfil={candidatProfil}
      isConnected={isConnected}
    />
  )
}
