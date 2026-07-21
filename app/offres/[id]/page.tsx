'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { OffreDetail, type OffreData } from '@/components/OffreDetail'

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  terracotta: '#C4673A',
  sable:      '#E8D5B7',
  creme:      '#F7F2EB',
  dark:       '#1A1A1A',
  grey:       '#6B6B6B',
  white:      '#FFFFFF',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Offre = OffreData & {
  active?: boolean
  statut_publication?: string
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: `3px solid ${C.sable}`, borderTopColor: C.terracotta,
        animation: 'kavio-spin 0.8s linear infinite',
      }} />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OffreDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id     = params.id as string

  const [offre, setOffre]             = useState<Offre | null>(null)
  const [loading, setLoading]         = useState(true)
  const [notFound, setNotFound]       = useState(false)
  const [applied, setApplied]         = useState(false)
  const [appliedDate, setAppliedDate] = useState<string | null>(null)
  const [applying, setApplying]       = useState(false)
  const [saved, setSaved]             = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [userId, setUserId]           = useState<string | null>(null)

  // localStorage saved state
  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('kavio_saved_offers') : null
    if (raw) setSaved((JSON.parse(raw) as string[]).includes(id))
  }, [id])

  // Data load
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setIsConnected(!!user)
      setUserId(user?.id ?? null)

      const [offreRes, candRes] = await Promise.all([
        supabase.from('offres').select('*').eq('id', id).single(),
        user
          ? supabase.from('candidatures').select('id, created_at').eq('candidat_id', user.id).eq('offre_id', id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])

      const o = offreRes.data as Offre | null
      if (offreRes.error || !o || !o.active || o.statut_publication !== 'publiée') {
        setNotFound(true)
        setLoading(false)
        return
      }

      setOffre(o)
      setApplied(!!candRes.data)
      setAppliedDate((candRes.data as { created_at?: string } | null)?.created_at ?? null)
      setLoading(false)
    }
    load()
  }, [id])

  async function handleApply() {
    if (!isConnected) { router.push('/connexion'); return }
    if (applied || applying || !userId) return
    setApplying(true)
    const { error } = await supabase.from('candidatures').insert({
      candidat_id: userId,
      offre_id:    id,
      statut:      'envoyée',
    })
    if (!error) { setApplied(true); setAppliedDate(new Date().toISOString()) }
    setApplying(false)
  }

  function toggleSave() {
    const raw  = typeof window !== 'undefined' ? localStorage.getItem('kavio_saved_offers') : null
    const list = raw ? (JSON.parse(raw) as string[]) : []
    const next = saved ? list.filter(s => s !== id) : [...list, id]
    localStorage.setItem('kavio_saved_offers', JSON.stringify(next))
    setSaved(!saved)
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ backgroundColor: C.creme, minHeight: '100vh', marginLeft: 64 }}>
        <style suppressHydrationWarning>{`@keyframes kavio-spin { to { transform: rotate(360deg); } }`}</style>
        <Spinner />
      </div>
    )
  }

  // ── Not found ────────────────────────────────────────────────────────────

  if (notFound || !offre) {
    return (
      <div style={{
        backgroundColor: C.creme, minHeight: '100vh', marginLeft: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: 52, marginBottom: 20 }}>📭</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: C.dark, margin: '0 0 10px', fontWeight: 600 }}>
            Offre indisponible
          </h1>
          <p style={{ fontSize: 14, color: C.grey, margin: '0 0 28px', lineHeight: 1.65 }}>
            Cette offre n'existe plus ou a été retirée.
          </p>
          <button
            onClick={() => router.push('/offres')}
            style={{
              backgroundColor: C.terracotta, color: C.white, border: 'none',
              borderRadius: 12, padding: '12px 28px', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ← Voir toutes les offres
          </button>
        </div>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ backgroundColor: C.creme, minHeight: '100vh', marginLeft: 64 }}>
      <style suppressHydrationWarning>{`
        @keyframes kavio-spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>
      <OffreDetail
        offre={offre}
        applied={applied}
        appliedDate={appliedDate}
        applying={applying}
        saved={saved}
        isConnected={isConnected}
        onApply={handleApply}
        onToggleSave={toggleSave}
        mode="page"
        onBack={() => router.push('/offres')}
      />
    </div>
  )
}
