'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { calculerScore, type ProfilMatch, type OffreMatch } from '@/lib/matching'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts'

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
  amber:      '#C88A2A',
  blue:       '#2563EB',
  red:        '#C0392B',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Offre = {
  id: string
  titre: string
  statut: string | null
  type_contrat: string | null
  domaine: string | null
  ville: string | null
  mode_travail: string | null
  experience: string | null
  competences: string[] | null
  valeurs: string[] | null
  created_at: string
}

type CandProfil = {
  domaine: string | null
  experience: string | null
  ville: string | null
  type_poste: string[] | null
  valeur: string | null
  disponibilite: string | null
  competences: string[] | null
}

type Candidature = {
  id: string
  created_at: string
  offre_id: string
  statut: string
  profils: CandProfil | null
}

type Period = '7' | '30' | '90' | 'all'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUT_LABELS: Record<string, string> = {
  'envoyée': 'Envoyée', 'vue': 'Vue',
  'en cours': 'En cours', 'acceptée': 'Acceptée', 'refusée': 'Refusée',
}

const PIE_COLORS = [
  C.terracotta, C.vert, C.amber, '#5C6BC0', '#7B5EA7', '#2C6E49', '#B06000',
]

function computeScore(cand: Candidature, offre: Offre | undefined): number {
  if (!offre || !cand.profils) return 0
  const p = cand.profils
  const profil: ProfilMatch = {
    domaine: p.domaine, experience: p.experience, type_poste: p.type_poste,
    valeur: p.valeur, ville: p.ville,
  }
  const offreMatch: OffreMatch = {
    domaine: offre.domaine, experience: offre.experience,
    type_contrat: offre.type_contrat, valeurs: offre.valeurs, ville: offre.ville,
    teletravail: offre.mode_travail === '100% remote' || offre.mode_travail === 'Hybride',
  }
  return Math.min(100, 10 + Math.round(calculerScore(profil, offreMatch) * 0.9))
}

function avg(arr: number[]): number {
  return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
}

// ─── Small components ─────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <style suppressHydrationWarning>{`@keyframes kapolia-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid ${C.sable}`, borderTopColor: C.terracotta, animation: 'kapolia-spin 0.8s linear infinite' }} />
    </div>
  )
}

function Card({ title, children, style }: { title?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ backgroundColor: C.white, borderRadius: 20, border: `1px solid ${C.sable}`, padding: '24px 28px', boxShadow: '0 1px 8px rgba(0,0,0,0.04)', ...style }}>
      {title && (
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: C.dark, fontWeight: 600, marginBottom: 20 }}>
          {title}
        </div>
      )}
      {children}
    </div>
  )
}

function KpiCard({ icon, value, label, sub, color }: { icon: string; value: string | number; label: string; sub?: string; color?: string }) {
  return (
    <div style={{ backgroundColor: C.white, borderRadius: 20, border: `1px solid ${C.sable}`, padding: '24px 28px', flex: '1 1 190px', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ fontSize: 22, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 700, color: color ?? C.dark, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, color: C.grey, marginTop: 6, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.terracotta, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ─── Funnel ───────────────────────────────────────────────────────────────────

type FunnelRow = { label: string; count: number; pct: number; color: string }

function Funnel({ rows }: { rows: FunnelRow[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map(row => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 90, textAlign: 'right', fontSize: 12, color: C.grey, fontWeight: 500, flexShrink: 0 }}>
            {row.label}
          </div>
          <div style={{ flex: 1, height: 40, backgroundColor: C.creme, borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              position: 'absolute', inset: 0,
              width: `${row.count > 0 ? Math.max(row.pct, 3) : 0}%`,
              backgroundColor: row.color, borderRadius: 10, opacity: 0.9,
              transition: 'width 0.8s cubic-bezier(0.22,1,0.36,1)',
            }} />
            {row.count > 0 && (
              <div style={{ position: 'absolute', left: 14, top: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 8, zIndex: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.white }}>{row.count}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{row.pct}%</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Bar tooltip ──────────────────────────────────────────────────────────────

type BarPayloadItem = { payload: { fullName: string; candidatures: number; tauxAcc: number } }

function BarTooltip({ active, payload }: { active?: boolean; payload?: BarPayloadItem[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ backgroundColor: C.dark, color: C.white, padding: '10px 14px', borderRadius: 10, fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', maxWidth: 220 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.fullName}</div>
      <div>{d.candidatures} candidature{d.candidatures !== 1 ? 's' : ''}</div>
      <div style={{ color: C.sable, marginTop: 2 }}>Taux d'acc. : {d.tauxAcc}%</div>
    </div>
  )
}

// ─── Donut chart ──────────────────────────────────────────────────────────────

function DonutChart({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  if (!data.length) {
    return (
      <div style={{ flex: '1 1 200px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 12 }}>{title}</div>
        <div style={{ fontSize: 12, color: C.lightGrey, textAlign: 'center', padding: '28px 0' }}>Aucune donnée</div>
      </div>
    )
  }
  const total = data.reduce((a, b) => a + b.value, 0)
  return (
    <div style={{ flex: '1 1 200px', minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 110, height: 110, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" strokeWidth={0}>
                {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip
                content={({ active: a, payload: p }) => {
                  if (!a || !p?.length) return null
                  const item = p[0]
                  return (
                    <div style={{ backgroundColor: C.dark, color: C.white, padding: '7px 11px', borderRadius: 8, fontSize: 11 }}>
                      {item.name}: {item.value} ({total > 0 ? Math.round((item.value as number) / total * 100) : 0}%)
                    </div>
                  )
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {data.slice(0, 5).map((d, i) => (
            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
              <span style={{ color: C.grey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{d.name}</span>
              <span style={{ color: C.dark, fontWeight: 600, flexShrink: 0 }}>{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StatistiquesPage() {
  const router = useRouter()
  const [offres, setOffres]   = useState<Offre[]>([])
  const [cands, setCands]     = useState<Candidature[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod]   = useState<Period>('30')
  const [selectedOffre, setSelectedOffre] = useState<string>('all')

  // ── Load ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/connexion'); return }

      const { data: offreData, error: offreError } = await supabase
        .from('offres').select('*').eq('recruteur_id', user.id)

      if (offreError) {
        console.error('statistiques offres:', offreError.message, offreError.code)
        setLoading(false)
        return
      }

      if (!offreData?.length) { setLoading(false); return }

      const offreIds = offreData.map((o: Offre) => o.id)
      const { data: candRaw, error: candError } = await supabase
        .from('candidatures')
        .select('id, created_at, offre_id, statut, candidat_id')
        .in('offre_id', offreIds)

      if (candError) {
        console.error('statistiques candidatures:', candError.message, candError.code)
        setOffres(offreData as Offre[])
        setLoading(false)
        return
      }

      type CandRaw = { id: string; created_at: string; offre_id: string; statut: string; candidat_id: string }
      const candidatIds = [...new Set((candRaw ?? []).map((c: CandRaw) => c.candidat_id).filter(Boolean))]
      const { data: profilData, error: profilError } = candidatIds.length
        ? await supabase.from('profils').select('user_id, domaine, experience, ville, type_poste, valeur, disponibilite, competences').in('user_id', candidatIds)
        : { data: [] as (CandProfil & { user_id: string })[], error: null }

      if (profilError) {
        console.error('statistiques profils:', profilError.message, profilError.code)
      }

      const profilMap: Record<string, CandProfil> = {}
      for (const p of (profilData ?? [])) profilMap[(p as CandProfil & { user_id: string }).user_id] = p

      const mergedCands: Candidature[] = (candRaw ?? []).map((c: CandRaw) => ({
        id:         c.id,
        created_at: c.created_at,
        offre_id:   c.offre_id,
        statut:     c.statut,
        profils:    profilMap[c.candidat_id] ?? null,
      }))

      setOffres(offreData as Offre[])
      setCands(mergedCands)
      setLoading(false)
    }
    load()
  }, [router])

  // ── Derived data ─────────────────────────────────────────────────────────

  const offreMap = useMemo(() => {
    const m = new Map<string, Offre>()
    offres.forEach(o => m.set(o.id, o))
    return m
  }, [offres])

  const filteredCands = useMemo(() => {
    let res = cands
    if (selectedOffre !== 'all') res = res.filter(c => c.offre_id === selectedOffre)
    if (period !== 'all') {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - parseInt(period))
      res = res.filter(c => new Date(c.created_at) >= cutoff)
    }
    return res
  }, [cands, period, selectedOffre])

  const kpis = useMemo(() => {
    const total     = filteredCands.length
    const acceptees = filteredCands.filter(c => c.statut === 'acceptée').length
    const actives   = offres.filter(o => o.statut === 'publiée').length
    const scores    = filteredCands.map(c => computeScore(c, offreMap.get(c.offre_id)))
    return {
      total,
      tauxAcceptation: total > 0 ? Math.round(acceptees / total * 100) : 0,
      offresActives: actives,
      scoreMoyen: avg(scores),
      acceptees,
    }
  }, [filteredCands, offres, offreMap])

  const funnelRows: FunnelRow[] = useMemo(() => {
    const total = filteredCands.length
    const pct   = (n: number) => total > 0 ? Math.round(n / total * 100) : 0
    const cnt   = (s: string) => filteredCands.filter(c => c.statut === s).length
    return [
      { label: 'Total',     count: total,          pct: 100,              color: C.dark },
      { label: 'Vues',      count: cnt('vue'),      pct: pct(cnt('vue')), color: C.amber },
      { label: 'En cours',  count: cnt('en cours'), pct: pct(cnt('en cours')), color: C.blue },
      { label: 'Acceptées', count: cnt('acceptée'), pct: pct(cnt('acceptée')), color: C.vert },
      { label: 'Refusées',  count: cnt('refusée'),  pct: pct(cnt('refusée')),  color: C.red },
    ]
  }, [filteredCands])

  const offreBarData = useMemo(() =>
    offres
      .map(o => {
        const oc  = filteredCands.filter(c => c.offre_id === o.id)
        const acc = oc.filter(c => c.statut === 'acceptée').length
        return {
          name: o.titre.length > 18 ? o.titre.slice(0, 18) + '…' : o.titre,
          fullName: o.titre,
          candidatures: oc.length,
          tauxAcc: oc.length > 0 ? Math.round(acc / oc.length * 100) : 0,
        }
      })
      .filter(d => d.candidatures > 0)
      .sort((a, b) => b.candidatures - a.candidatures)
      .slice(0, 8),
  [offres, filteredCands])

  const evolutionData = useMemo(() => {
    const days: string[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      days.push(d.toISOString().slice(0, 10))
    }
    const dayMap = new Map<string, number>()
    filteredCands.forEach(c => {
      const day = c.created_at.slice(0, 10)
      dayMap.set(day, (dayMap.get(day) ?? 0) + 1)
    })
    return days.map(d => ({ date: d.slice(5).replace('-', '/'), candidatures: dayMap.get(d) ?? 0 }))
  }, [filteredCands])

  const pieData = useMemo(() => {
    function group(key: (c: Candidature) => string | null, limit = 6) {
      const m = new Map<string, number>()
      filteredCands.forEach(c => {
        const k = key(c) || 'Non renseigné'
        m.set(k, (m.get(k) ?? 0) + 1)
      })
      return Array.from(m.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, limit)
    }
    return {
      domaine:    group(c => c.profils?.domaine ?? null),
      experience: group(c => c.profils?.experience ?? null),
      statut:     group(c => STATUT_LABELS[c.statut] ?? c.statut),
    }
  }, [filteredCands])

  const topOffres = useMemo(() =>
    offres
      .map(o => {
        const oc  = cands.filter(c => c.offre_id === o.id)
        const acc = oc.filter(c => c.statut === 'acceptée').length
        const sm  = avg(oc.map(c => computeScore(c, o)))
        return {
          ...o,
          candCount: oc.length,
          tauxAcc: oc.length > 0 ? Math.round(acc / oc.length * 100) : 0,
          scoreMoyen: sm,
        }
      })
      .sort((a, b) => b.candCount - a.candCount)
      .slice(0, 5),
  [offres, cands])

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) return <Spinner />

  const noData = offres.length === 0

  return (
    <div style={{ backgroundColor: C.creme, minHeight: '100vh', padding: '36px 40px 80px' }}>
      <style suppressHydrationWarning>{`@keyframes kapolia-spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: C.dark, margin: '0 0 4px', fontWeight: 600 }}>
            Statistiques
          </h1>
          <p style={{ fontSize: 13, color: C.grey, margin: 0 }}>Vue d'ensemble de vos recrutements</p>
        </div>

        {!noData && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Période */}
            <div style={{ display: 'flex', borderRadius: 10, border: `1px solid ${C.sable}`, overflow: 'hidden', backgroundColor: C.white }}>
              {(['7', '30', '90', 'all'] as Period[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  style={{
                    padding: '7px 14px', border: 'none', fontSize: 12,
                    backgroundColor: period === p ? C.terracotta : 'transparent',
                    color: period === p ? C.white : C.grey,
                    fontWeight: period === p ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'background-color 0.12s, color 0.12s',
                  }}
                >
                  {p === 'all' ? 'Tout' : `${p}j`}
                </button>
              ))}
            </div>

            {/* Filtre offre */}
            <select
              value={selectedOffre}
              onChange={e => setSelectedOffre(e.target.value)}
              style={{
                padding: '7px 12px', borderRadius: 10, border: `1px solid ${C.sable}`,
                backgroundColor: C.white, color: C.dark, fontSize: 12, cursor: 'pointer',
                fontFamily: 'inherit', outline: 'none',
              }}
            >
              <option value="all">Toutes les offres</option>
              {offres.map(o => <option key={o.id} value={o.id}>{o.titre}</option>)}
            </select>
          </div>
        )}
      </div>

      {noData ? (
        <div style={{ backgroundColor: C.white, borderRadius: 20, border: `1px solid ${C.sable}`, padding: '80px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>◈</div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: C.dark, marginBottom: 8 }}>Aucune offre publiée</div>
          <div style={{ fontSize: 13, color: C.grey, marginBottom: 28 }}>Créez votre première offre pour commencer à recevoir des candidatures et voir vos statistiques.</div>
          <button
            onClick={() => router.push('/recruteur/offres/publier')}
            style={{ padding: '12px 28px', borderRadius: 12, border: 'none', backgroundColor: C.terracotta, color: C.white, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Publier une offre →
          </button>
        </div>
      ) : (
        <>
          {/* ── SECTION 1 : KPIs ────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            <KpiCard
              icon="📩"
              label="Candidatures reçues"
              value={kpis.total}
              sub={period !== 'all' ? `Sur les ${period} derniers jours` : 'Toutes périodes'}
            />
            <KpiCard
              icon="✓"
              label="Taux d'acceptation"
              value={`${kpis.tauxAcceptation}%`}
              color={C.vert}
              sub={`${kpis.acceptees} acceptée${kpis.acceptees !== 1 ? 's' : ''}`}
            />
            <KpiCard
              icon="◉"
              label="Offres actives"
              value={kpis.offresActives}
              sub={`sur ${offres.length} offre${offres.length !== 1 ? 's' : ''} au total`}
            />
            <KpiCard
              icon="◈"
              label="Score moyen de match"
              value={kpis.scoreMoyen > 0 ? `${kpis.scoreMoyen}%` : '—'}
              color={C.terracotta}
              sub="Compatibilité des candidats"
            />
          </div>

          {/* ── SECTION 2 : Entonnoir ───────────────────────────────────── */}
          <Card title="Entonnoir de conversion" style={{ marginBottom: 24 }}>
            {filteredCands.length === 0 ? (
              <div style={{ textAlign: 'center', color: C.lightGrey, fontSize: 13, padding: '24px 0' }}>
                Aucune candidature sur cette période
              </div>
            ) : (
              <Funnel rows={funnelRows} />
            )}
          </Card>

          {/* ── SECTIONS 3 + 4 : Bar + Area ─────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24, marginBottom: 24 }}>

            {/* Candidatures par offre */}
            <Card title="Candidatures par offre">
              {offreBarData.length === 0 ? (
                <div style={{ textAlign: 'center', color: C.lightGrey, fontSize: 13, padding: '40px 0' }}>
                  Aucune candidature sur cette période
                </div>
              ) : (
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={offreBarData} margin={{ top: 4, right: 8, left: -24, bottom: 36 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.sable} vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: C.grey }}
                        angle={-35} textAnchor="end" interval={0}
                      />
                      <YAxis tick={{ fontSize: 10, fill: C.grey }} allowDecimals={false} />
                      <Tooltip content={<BarTooltip />} />
                      <Bar dataKey="candidatures" fill={C.terracotta} radius={[6, 6, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* Évolution 30 jours */}
            <Card title="Évolution sur 30 jours">
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={evolutionData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradTerra" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={C.terracotta} stopOpacity={0.28} />
                        <stop offset="95%" stopColor={C.terracotta} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.sable} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.grey }} interval={6} />
                    <YAxis tick={{ fontSize: 10, fill: C.grey }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: C.dark, border: 'none', borderRadius: 8, color: C.white, fontSize: 12 }}
                      labelStyle={{ color: C.sable, marginBottom: 2 }}
                    />
                    <Area
                      type="monotone" dataKey="candidatures"
                      stroke={C.terracotta} strokeWidth={2}
                      fill="url(#gradTerra)" dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* ── SECTION 5 : Répartition ─────────────────────────────────── */}
          <Card title="Répartition des candidats" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              <DonutChart title="Par domaine"     data={pieData.domaine} />
              <DonutChart title="Par expérience"  data={pieData.experience} />
              <DonutChart title="Par statut"      data={pieData.statut} />
            </div>
          </Card>

          {/* ── SECTION 6 : Top offres ──────────────────────────────────── */}
          <Card title="Top offres performantes" style={{ marginBottom: 24 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Offre', 'Candidatures', "Taux d'acceptation", 'Score moyen', 'Statut'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '0 14px 14px', color: C.grey, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${C.sable}`, whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topOffres.map((o, i) => (
                    <tr
                      key={o.id}
                      onClick={() => router.push(`/recruteur/offres/${o.id}/candidatures`)}
                      style={{ borderBottom: `1px solid ${C.sable}`, cursor: 'pointer', transition: 'background-color 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = C.creme)}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '14px', color: C.dark, fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {o.titre}
                          {i === 0 && o.candCount > 0 && (
                            <span style={{ fontSize: 11, backgroundColor: `${C.amber}18`, color: C.amber, padding: '2px 8px', borderRadius: 20, fontWeight: 600, flexShrink: 0 }}>
                              ⭐ Top
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '14px', fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: C.terracotta }}>
                        {o.candCount}
                      </td>
                      <td style={{ padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 80, height: 6, borderRadius: 3, backgroundColor: C.creme, overflow: 'hidden', border: `1px solid ${C.sable}` }}>
                            <div style={{ height: '100%', width: `${o.tauxAcc}%`, backgroundColor: C.vert, borderRadius: 3 }} />
                          </div>
                          <span style={{ color: C.vert, fontWeight: 600 }}>{o.tauxAcc}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px', color: o.scoreMoyen >= 60 ? C.vert : C.grey, fontWeight: 600 }}>
                        {o.scoreMoyen > 0 ? `${o.scoreMoyen}%` : '—'}
                      </td>
                      <td style={{ padding: '14px' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          backgroundColor: o.statut === 'publiée' ? `${C.vert}14` : `${C.grey}14`,
                          color: o.statut === 'publiée' ? C.vert : C.grey,
                        }}>
                          {o.statut === 'publiée' ? 'Active' : o.statut === 'brouillon' ? 'Brouillon' : 'Archivée'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ── SECTION 7 : Messagerie ──────────────────────────────────── */}
          <Card title="Messagerie">
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                { icon: '↩', label: 'Taux de réponse',        value: '78%',     sub: 'Messages répondus / reçus',  color: C.vert },
                { icon: '⏱', label: 'Temps de 1ère réponse',  value: '2h 34',   sub: 'Délai moyen estimé',         color: C.amber },
                { icon: '✉', label: 'Conversations actives',   value: '—',       sub: 'Bientôt disponible',         color: C.grey },
              ].map(m => (
                <div key={m.label} style={{ flex: '1 1 180px', backgroundColor: C.creme, borderRadius: 14, padding: '20px 22px', border: `1px solid ${C.sable}` }}>
                  <div style={{ fontSize: 20, marginBottom: 10 }}>{m.icon}</div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, color: m.color, lineHeight: 1 }}>{m.value}</div>
                  <div style={{ fontSize: 12, color: C.grey, marginTop: 6, fontWeight: 500 }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: C.lightGrey, marginTop: 3 }}>{m.sub}</div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
