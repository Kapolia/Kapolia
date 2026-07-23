'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type FavorisCtx = {
  favIds: Set<string>
  // undefined = pas encore chargé (évite le "0" qui clignote dans la sidebar)
  loaded: boolean
  toggleFav: (offreId: string) => Promise<void>
}

const FavorisContext = createContext<FavorisCtx>({
  favIds: new Set(),
  loaded: false,
  toggleFav: async () => {},
})

export function useFavoris() {
  return useContext(FavorisContext)
}

export function FavorisProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [favIds, setFavIds] = useState<Set<string>>(new Set())
  const [loaded, setLoaded]   = useState(false)
  const userIdRef = useRef<string | null>(null)

  async function loadFavs(uid: string) {
    const { data } = await supabase
      .from('offres_favorites')
      .select('offre_id')
      .eq('candidat_id', uid)
    setFavIds(new Set((data ?? []).map((r: { offre_id: string }) => r.offre_id)))
    setLoaded(true)
  }

  useEffect(() => {
    // Initial load
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoaded(true); return }
      userIdRef.current = user.id
      loadFavs(user.id)
    })

    // Keep in sync with auth changes (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        userIdRef.current = session.user.id
        loadFavs(session.user.id)
      }
      if (event === 'SIGNED_OUT') {
        userIdRef.current = null
        setFavIds(new Set())
        setLoaded(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const toggleFav = useCallback(async (offreId: string) => {
    const uid = userIdRef.current
    if (!uid) {
      router.push('/connexion')
      return
    }

    const wasFaved = favIds.has(offreId)

    // Optimistic update
    setFavIds(prev => {
      const next = new Set(prev)
      if (wasFaved) next.delete(offreId)
      else next.add(offreId)
      return next
    })

    if (wasFaved) {
      const { error } = await supabase
        .from('offres_favorites')
        .delete()
        .eq('candidat_id', uid)
        .eq('offre_id', offreId)
      if (error) {
        console.error('Erreur retrait favori:', error.message)
        setFavIds(prev => { const next = new Set(prev); next.add(offreId); return next })
      }
    } else {
      const { error } = await supabase
        .from('offres_favorites')
        .insert({ candidat_id: uid, offre_id: offreId })
      if (error) {
        console.error('Erreur ajout favori:', error.message)
        setFavIds(prev => { const next = new Set(prev); next.delete(offreId); return next })
      }
    }
  }, [favIds, router])

  return (
    <FavorisContext.Provider value={{ favIds, loaded, toggleFav }}>
      {children}
    </FavorisContext.Provider>
  )
}
