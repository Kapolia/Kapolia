'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const C = {
  terracotta: '#C4673A',
  vert:       '#2C4A3E',
  sable:      '#E8D5B7',
  creme:      '#F7F2EB',
  dark:       '#1A1A1A',
  grey:       '#6B6B6B',
  white:      '#FFFFFF',
  amber:      '#C88A2A',
}

type DashData = {
  offresActives:         number
  offresBrouillons:      number
  offresSansCand:        number
  totalCandidatures:     number
  candidaturesEnAttente: number
  messagesNonLus:        number
  candidathequeCount:    number
}

// ─── Composants locaux ────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        border: `3px solid ${C.sable}`, borderTopColor: C.terracotta,
        animation: 'kapolia-spin 0.8s linear infinite',
      }} />
    </div>
  )
}

function ActionCard({ label, count, detail, color, icon, onClick }: {
  label: string; count: number; detail: string
  color: string; icon: ReactNode; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '20px 22px', borderRadius: 16,
        border: `1.5px solid ${color}35`,
        backgroundColor: `${color}08`,
        cursor: 'pointer', textAlign: 'left',
        width: '100%', fontFamily: 'inherit',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        outline: 'none',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `${color}70`
        e.currentTarget.style.boxShadow   = `0 2px 14px ${color}18`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = `${color}35`
        e.currentTarget.style.boxShadow   = 'none'
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        backgroundColor: `${color}14`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, color,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>
          {count}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.dark, marginTop: 4 }}>{label}</div>
        <div style={{ fontSize: 11, color: C.grey, marginTop: 2 }}>{detail}</div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.4 }}>
        <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
      </svg>
    </button>
  )
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div style={{
      backgroundColor: C.white, borderRadius: 16,
      border: `1px solid ${C.sable}`, padding: '22px 24px',
    }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 34, fontWeight: 400, color: C.dark, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.dark, marginTop: 10 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.grey, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecruteurDashboard() {
  const router = useRouter()

  const [data, setData]       = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setHasError(false)

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (!user || authError) {
        console.error('[dashboard] auth', authError)
        setHasError(true); setLoading(false); return
      }
      const uid = user.id

      const [offresRes, candAttenteRes, convRes, candidathequeRes] = await Promise.all([
        supabase
          .from('offres')
          .select('statut, candidatures(count)')
          .eq('recruteur_id', uid),
        supabase
          .from('candidatures')
          .select('id', { count: 'exact', head: true })
          .eq('statut', 'envoyée'),
        supabase
          .from('conversations')
          .select('non_lu_recruteur')
          .eq('recruteur_id', uid)
          .eq('masquee_recruteur', false),
        supabase
          .from('profils')
          .select('user_id', { count: 'exact', head: true })
          .eq('visible_candidatheque', true)
          .eq('type_compte', 'candidat'),
      ])

      if (offresRes.error) {
        console.error('[dashboard] offres', offresRes.error)
        setHasError(true); setLoading(false); return
      }
      if (candAttenteRes.error) {
        console.error('[dashboard] candidatures en attente', candAttenteRes.error)
        setHasError(true); setLoading(false); return
      }
      if (convRes.error) {
        console.error('[dashboard] conversations', convRes.error)
        setHasError(true); setLoading(false); return
      }
      if (candidathequeRes.error) {
        console.error('[dashboard] candidatheque', candidathequeRes.error)
        setHasError(true); setLoading(false); return
      }

      const offres = offresRes.data ?? []
      function candCount(o: typeof offres[number]) {
        return (o.candidatures as { count: number }[])[0]?.count ?? 0
      }

      const offresActives     = offres.filter(o => o.statut !== 'brouillon' && o.statut !== 'archivée').length
      const offresBrouillons  = offres.filter(o => o.statut === 'brouillon').length
      const offresSansCand    = offres.filter(o =>
        o.statut !== 'brouillon' && o.statut !== 'archivée' && candCount(o) === 0
      ).length
      const totalCandidatures  = offres.reduce((s, o) => s + candCount(o), 0)
      const candidaturesEnAttente = candAttenteRes.count ?? 0
      const messagesNonLus     = (convRes.data ?? []).reduce(
        (s, r) => s + (r.non_lu_recruteur ?? 0), 0
      )
      const candidathequeCount = candidathequeRes.count ?? 0

      setData({
        offresActives, offresBrouillons, offresSansCand, totalCandidatures,
        candidaturesEnAttente, messagesNonLus, candidathequeCount,
      })
      setLoading(false)
    }
    load()
  }, [])

  // ── Cartes d'action ──────────────────────────────────────────────────────────

  const actionCards: { label: string; count: number; detail: string; color: string; href: string; icon: ReactNode }[] = []

  if (data) {
    if (data.candidaturesEnAttente > 0) actionCards.push({
      label:  `Candidature${data.candidaturesEnAttente > 1 ? 's' : ''} en attente`,
      count:  data.candidaturesEnAttente,
      detail: `Statut « envoyée », pas encore traitée${data.candidaturesEnAttente > 1 ? 's' : ''}`,
      color:  C.terracotta,
      href:   '/recruteur/offres',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
        </svg>
      ),
    })

    if (data.messagesNonLus > 0) actionCards.push({
      label:  `Message${data.messagesNonLus > 1 ? 's' : ''} non lu${data.messagesNonLus > 1 ? 's' : ''}`,
      count:  data.messagesNonLus,
      detail: 'Réponse attendue',
      color:  C.vert,
      href:   '/recruteur/messages',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
    })

    if (data.offresBrouillons > 0) actionCards.push({
      label:  `Brouillon${data.offresBrouillons > 1 ? 's' : ''} non publié${data.offresBrouillons > 1 ? 's' : ''}`,
      count:  data.offresBrouillons,
      detail: `Offre${data.offresBrouillons > 1 ? 's' : ''} en attente de publication`,
      color:  C.amber,
      href:   '/recruteur/offres',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
      ),
    })

    if (data.offresSansCand > 0) actionCards.push({
      label:  `Offre${data.offresSansCand > 1 ? 's' : ''} sans candidature`,
      count:  data.offresSansCand,
      detail: `Active${data.offresSansCand > 1 ? 's' : ''}, aucun profil reçu`,
      color:  C.grey,
      href:   '/recruteur/offres',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      ),
    })
  }

  // ── Rendu ────────────────────────────────────────────────────────────────────

  return (
    <main style={{ minHeight: '100vh', backgroundColor: C.creme, padding: '48px 40px' }}>
      <style suppressHydrationWarning>{`@keyframes kapolia-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 400, color: C.dark, marginBottom: 40 }}>
          Tableau de bord
        </h1>

        {loading && <Spinner />}

        {hasError && (
          <div style={{
            backgroundColor: C.white, borderRadius: 16,
            border: `1px solid ${C.sable}`, padding: '40px 32px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 13, color: C.grey, marginBottom: 16 }}>
              Une erreur est survenue lors du chargement des données.
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '9px 20px', borderRadius: 10,
                border: `1px solid ${C.sable}`, backgroundColor: 'transparent',
                color: C.dark, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Réessayer
            </button>
          </div>
        )}

        {data && (
          <>
            {/* Bloc À traiter */}
            <section style={{ marginBottom: 40 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: C.grey,
                textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 16,
              }}>
                À traiter
              </div>

              {actionCards.length === 0 ? (
                <div style={{
                  backgroundColor: C.white, borderRadius: 16,
                  border: `1px solid ${C.sable}`, padding: '28px 24px',
                  display: 'flex', alignItems: 'center', gap: 16,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    backgroundColor: `${C.vert}14`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.dark }}>Tout est à jour.</div>
                    <div style={{ fontSize: 12, color: C.grey, marginTop: 2 }}>Aucune action en attente.</div>
                  </div>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: actionCards.length === 1 ? '1fr' : 'repeat(2, 1fr)',
                  gap: 12,
                }}>
                  {actionCards.map(card => (
                    <ActionCard
                      key={card.label}
                      label={card.label}
                      count={card.count}
                      detail={card.detail}
                      color={card.color}
                      icon={card.icon}
                      onClick={() => router.push(card.href)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Bloc Vue d'ensemble */}
            <section>
              <div style={{
                fontSize: 11, fontWeight: 700, color: C.grey,
                textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 16,
              }}>
                Vue d'ensemble
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <StatCard
                  label="Offres actives"
                  value={data.offresActives}
                />
                <StatCard
                  label="Candidatures reçues"
                  value={data.totalCandidatures}
                />
                <StatCard
                  label="Candidats dans la candidathèque"
                  value={data.candidathequeCount}
                  sub="Profils visibles"
                />
                <StatCard
                  label="Messages non lus"
                  value={data.messagesNonLus}
                />
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
