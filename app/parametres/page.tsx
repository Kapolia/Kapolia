'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { C, CARD_RADIUS, CARD_SHADOW } from '@/lib/colors'
import { FONT_SANS } from '@/lib/typography'
import ParametresRecruteur from '@/components/parametres/ParametresRecruteur'
import ParametresCandidat from '@/components/parametres/ParametresCandidat'

type TypeCompte = 'candidat' | 'recruteur'
type Status = { kind: 'loading' } | { kind: 'ready'; type: TypeCompte }

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBlock({ w, h, radius = 6 }: { w: number | string; h: number; radius?: number }) {
  return (
    <div style={{
      width: w,
      height: h,
      borderRadius: radius,
      backgroundColor: C.chip,
      flexShrink: 0,
    }} />
  )
}

function SqueletteCandidat() {
  const tocLabels = [120, 160, 80, 100, 140]
  const sectionTitles = [80, 150, 70, 100, 130]

  return (
    <div style={{
      display: 'flex',
      gap: 40,
      maxWidth: 1040,
      margin: '0 auto',
      padding: '40px 32px',
      paddingBottom: 420,
      boxSizing: 'border-box' as const,
      fontFamily: FONT_SANS,
    }}>
      {/* TOC sidebar skeleton */}
      <div style={{ width: 200, flexShrink: 0, paddingTop: 4 }}>
        <SkeletonBlock w={100} h={28} radius={6} />
        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tocLabels.map((w, i) => (
            <SkeletonBlock key={i} w={w} h={30} radius={9} />
          ))}
        </div>
      </div>

      {/* Content skeleton */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 58 }}>
        {sectionTitles.map((tw, i) => (
          <div key={i} style={{ marginBottom: 36 }}>
            <SkeletonBlock w={tw} h={22} radius={6} />
            <SkeletonBlock w={tw * 2.2} h={14} radius={6} />
            <div style={{
              marginTop: 14,
              backgroundColor: C.white,
              borderRadius: CARD_RADIUS,
              boxShadow: CARD_SHADOW,
              padding: '18px 22px',
            }}>
              <SkeletonBlock w="60%" h={14} radius={6} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default function ParametresPage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>({ kind: 'loading' })

  useEffect(() => {
    async function identify() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/connexion'); return }

      const { data } = await supabase
        .from('profils')
        .select('type_compte')
        .eq('user_id', user.id)
        .single()

      const type: TypeCompte = data?.type_compte === 'recruteur' ? 'recruteur' : 'candidat'
      setStatus({ kind: 'ready', type })
    }
    identify()
  }, [router])

  if (status.kind === 'loading') {
    // Render an approximate skeleton; we don't yet know the type.
    // Default to the candidat skeleton (more modern, matches CandidatPanneauLayout).
    return <SqueletteCandidat />
  }

  if (status.type === 'recruteur') return <ParametresRecruteur />
  return <ParametresCandidat />
}
