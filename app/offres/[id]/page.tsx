'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  terracotta: '#C4673A',
  sable:      '#E8D5B7',
  creme:      '#F7F2EB',
  vert:       '#2C4A3E',
  dark:       '#1A1A1A',
  grey:       '#6B6B6B',
  lightGrey:  '#D0D0D0',
  white:      '#FFFFFF',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Offre = {
  id: string
  titre: string
  entreprise_nom?: string
  type_contrat?: string
  domaine?: string
  experience?: string
  salaire_min?: number
  salaire_max?: number
  periode_salaire?: string
  mode_travail?: string
  ville?: string
  description?: string
  competences?: string[]
  valeurs?: string[]
  avantages?: string[]
  date_debut?: string
  created_at: string
  active?: boolean
  statut_publication?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d === 0) return "aujourd'hui"
  if (d === 1) return 'il y a 1 jour'
  return `il y a ${d} jours`
}

function formatSalaire(min?: number, max?: number, periode?: string): string | null {
  if (!min && !max) return null
  const fmt = (n: number) => n.toLocaleString('fr-FR')
  const range = min && max ? `${fmt(min)} – ${fmt(max)} €` : `${fmt(min || max!)} €`
  const per = periode === 'mensuel' ? '/mois' : '/an'
  return range + per
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style suppressHydrationWarning>{`@keyframes kavio-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: `3px solid ${C.sable}`, borderTopColor: C.terracotta,
        animation: 'kavio-spin 0.8s linear infinite',
      }} />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: C.white, borderRadius: 20, border: `1px solid ${C.sable}`, padding: '28px 32px' }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: C.dark, margin: '0 0 18px', fontWeight: 600 }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function ApplyButton({ applied, applying, onApply, isConnected }: {
  applied: boolean; applying: boolean; onApply: () => void; isConnected: boolean
}) {
  if (applied) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        backgroundColor: `${C.vert}10`, color: C.vert,
        border: `1px solid ${C.vert}30`, padding: '11px 22px',
        borderRadius: 12, fontSize: 14, fontWeight: 600,
      }}>
        <svg width="14" height="12" viewBox="0 0 12 10" fill="none">
          <path d="M1 5L4 8L11 1" stroke={C.vert} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Candidature envoyée
      </div>
    )
  }
  return (
    <button
      onClick={onApply}
      disabled={applying}
      style={{
        backgroundColor: applying ? C.sable : C.terracotta, color: C.white,
        border: 'none', borderRadius: 12, padding: '11px 26px',
        fontSize: 14, fontWeight: 700, cursor: applying ? 'default' : 'pointer',
        fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
        transition: 'background-color 0.15s',
      }}
    >
      {applying ? (
        <>
          <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: C.white, animation: 'kavio-spin 0.7s linear infinite' }} />
          Envoi…
        </>
      ) : isConnected ? 'Postuler' : 'Se connecter pour postuler'}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OffreDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id     = params.id as string

  const [offre, setOffre]           = useState<Offre | null>(null)
  const [loading, setLoading]       = useState(true)
  const [notFound, setNotFound]     = useState(false)
  const [applied, setApplied]       = useState(false)
  const [applying, setApplying]     = useState(false)
  const [saved, setSaved]           = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [userId, setUserId]         = useState<string | null>(null)

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
          ? supabase.from('candidatures').select('id').eq('candidat_id', user.id).eq('offre_id', id).maybeSingle()
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
    if (!error) setApplied(true)
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

  const salaire    = formatSalaire(offre.salaire_min, offre.salaire_max, offre.periode_salaire)
  const entreprise = offre.entreprise_nom || 'Entreprise'

  return (
    <div style={{ backgroundColor: C.creme, minHeight: '100vh', marginLeft: 64 }}>
      <style suppressHydrationWarning>{`
        @keyframes kavio-spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: C.white, borderBottom: `1px solid ${C.sable}`, padding: '28px 40px 32px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>

          {/* Back link */}
          <button
            onClick={() => router.push('/offres')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, color: C.grey, background: 'none', border: 'none',
              cursor: 'pointer', padding: 0, marginBottom: 22, fontFamily: 'inherit',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Retour aux offres
          </button>

          {/* Title row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{
                fontFamily: 'Georgia, serif',
                fontSize: 'clamp(22px, 3vw, 30px)',
                color: C.dark, margin: '0 0 8px', lineHeight: 1.2, fontWeight: 700,
              }}>
                {offre.titre}
              </h1>
              <div style={{ fontSize: 15, color: C.grey }}>
                <span style={{ fontWeight: 600, color: C.dark }}>{entreprise}</span>
                {offre.ville && <span> · {offre.ville}</span>}
                <span style={{ marginLeft: 14, fontSize: 12, color: C.lightGrey }}>
                  Publié {daysSince(offre.created_at)}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
              <button
                onClick={toggleSave}
                title={saved ? 'Retirer des favoris' : 'Sauvegarder'}
                style={{
                  width: 44, height: 44,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 12,
                  border: `1px solid ${saved ? '#F59E0B50' : C.sable}`,
                  backgroundColor: saved ? '#FEF3C720' : C.white,
                  cursor: 'pointer', fontSize: 22, transition: 'all 0.15s',
                }}
              >
                {saved ? '★' : '☆'}
              </button>
              <ApplyButton
                applied={applied}
                applying={applying}
                onApply={handleApply}
                isConnected={isConnected}
              />
            </div>
          </div>

          {/* Badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {offre.type_contrat && (
              <span style={{ fontSize: 12, fontWeight: 600, backgroundColor: `${C.terracotta}14`, color: C.terracotta, padding: '4px 13px', borderRadius: 20 }}>
                {offre.type_contrat}
              </span>
            )}
            {offre.mode_travail && (
              <span style={{
                fontSize: 12, fontWeight: 600, padding: '4px 13px', borderRadius: 20,
                backgroundColor: offre.mode_travail === '100% remote' ? `${C.vert}14` : offre.mode_travail === 'Hybride' ? '#7B5EA714' : `${C.dark}0A`,
                color: offre.mode_travail === '100% remote' ? C.vert : offre.mode_travail === 'Hybride' ? '#7B5EA7' : C.grey,
              }}>
                {offre.mode_travail}
              </span>
            )}
            {offre.experience && (
              <span style={{ fontSize: 12, fontWeight: 500, backgroundColor: C.creme, color: C.grey, padding: '4px 13px', borderRadius: 20, border: `1px solid ${C.sable}` }}>
                {offre.experience}
              </span>
            )}
            {salaire && (
              <span style={{ fontSize: 12, fontWeight: 600, backgroundColor: '#F0FDF4', color: '#16A34A', padding: '4px 13px', borderRadius: 20 }}>
                💰 {salaire}
              </span>
            )}
          </div>

        </div>
      </div>

      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 40px 80px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Description */}
          {offre.description && (
            <Section title="Description du poste">
              <p style={{ fontSize: 14, color: C.grey, margin: 0, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                {offre.description}
              </p>
            </Section>
          )}

          {/* Compétences */}
          {(offre.competences?.length ?? 0) > 0 && (
            <Section title="Compétences recherchées">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {offre.competences!.map(s => (
                  <span key={s} style={{
                    fontSize: 13, fontWeight: 500,
                    backgroundColor: C.creme, border: `1px solid ${C.sable}`,
                    color: C.dark, padding: '5px 14px', borderRadius: 8,
                  }}>
                    {s}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Valeurs */}
          {(offre.valeurs?.length ?? 0) > 0 && (
            <Section title="Nos valeurs">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {offre.valeurs!.map(v => (
                  <span key={v} style={{
                    fontSize: 13, fontWeight: 600,
                    backgroundColor: `${C.vert}10`, color: C.vert,
                    border: `1px solid ${C.vert}20`, padding: '5px 14px', borderRadius: 20,
                  }}>
                    {v}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Avantages */}
          {(offre.avantages?.length ?? 0) > 0 && (
            <Section title="Avantages">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {offre.avantages!.map(a => (
                  <span key={a} style={{
                    fontSize: 13, fontWeight: 500,
                    backgroundColor: `${C.terracotta}0A`, color: C.terracotta,
                    border: `1px solid ${C.terracotta}20`, padding: '5px 14px', borderRadius: 20,
                  }}>
                    {a}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* CTA bas de page */}
          <div style={{
            backgroundColor: C.white, borderRadius: 20, border: `1px solid ${C.sable}`,
            padding: '28px 32px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 20, flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 600, color: C.dark, marginBottom: 5 }}>
                Ce poste vous intéresse ?
              </div>
              <div style={{ fontSize: 13, color: C.grey }}>
                {isConnected
                  ? 'Postulez en un clic — votre profil sera transmis au recruteur.'
                  : 'Connectez-vous pour postuler rapidement avec votre profil Kavio.'}
              </div>
            </div>
            <ApplyButton
              applied={applied}
              applying={applying}
              onApply={handleApply}
              isConnected={isConnected}
            />
          </div>

        </div>
      </div>
    </div>
  )
}
