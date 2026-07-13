'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  terracotta: '#C4673A',
  sable: '#E8D5B7',
  creme: '#F7F2EB',
  vert: '#2C4A3E',
  dark: '#1A1A1A',
  grey: '#6B6B6B',
  lightGrey: '#E0D8CC',
  white: '#FFFFFF',
  amber: '#C88A2A',
}

// ─── Static data — Acme SAS ───────────────────────────────────────────────────

const ENTREPRISE = {
  nom: 'Acme SAS',
  initiales: 'AC',
  initialesBg: C.terracotta,
  secteur: 'Tech & SaaS B2B',
  ville: 'Lyon, France',
  taille: '50–200 salariés',
  site: 'acme.io',
  linkedin: 'linkedin.com/company/acme-sas',
  description: [
    'Acme SAS est une startup tech lyonnaise fondée en 2018, spécialisée dans les outils de collaboration SaaS pour les équipes distribuées. Nous avons accompagné plus de 1 200 entreprises dans leur transformation digitale.',
    "Notre obsession : simplifier le travail en équipe sans sacrifier la profondeur. Nous construisons des produits qui disparaissent dans le workflow — et c'est exactement ce que nos clients adorent.",
    'En 2024, nous avons levé 12 M€ en Série A pour accélérer notre expansion en Europe du Sud. Nous recrutons des profils qui veulent construire quelque chose qui dure.',
  ],
  valeurs: [
    {
      icon: '◎',
      titre: 'Clarté avant tout',
      desc: "On dit ce qu'on fait, on fait ce qu'on dit. La transparence n'est pas une valeur d'affichage — c'est notre façon de travailler au quotidien.",
    },
    {
      icon: '⬡',
      titre: 'Impact mesurable',
      desc: "Chaque fonctionnalité, chaque décision est évaluée à l'aune d'un impact réel et mesurable pour nos clients et nos équipes.",
    },
    {
      icon: '✦',
      titre: 'Craft & excellence',
      desc: "Nous croyons que bien faire les choses prend du temps — et que ça vaut la peine. Qualité > vitesse pour tout ce qu'on livre.",
    },
  ],
  vie: [
    { icon: '🌿', titre: 'Télétravail', desc: 'Hybride par défaut : 2 jours au bureau, le reste depuis là où vous êtes le plus efficace.' },
    { icon: '◷', titre: 'Ambiance', desc: 'Petite équipe soudée, humour assumé, réunions courtes. On déjeune ensemble le jeudi.' },
    { icon: '⬡', titre: 'Évolution', desc: 'Budget formation annuel de 1 500 €, revue de carrière tous les 6 mois, montée en lead encouragée.' },
    { icon: '✦', titre: 'Avantages', desc: 'Tickets resto, mutuelle premium, MacBook Pro M3, 10 jours de RTT, team offsite 2× par an.' },
  ],
  equipe: [
    {
      initiales: 'ML',
      bg: '#4A7C6E',
      nom: 'Marie Leconte',
      role: 'Head of People',
      phrase: "\"Je cherche des gens curieux, pas des CV parfaits. Ce qui m'intéresse, c'est ce qui vous anime vraiment.\"",
    },
    {
      initiales: 'TD',
      bg: '#8B6E4E',
      nom: 'Thomas Dupont',
      role: 'Engineering Manager',
      phrase: "\"On recrute des engineers qui savent dire non — et expliquer pourquoi. L'opinion compte autant que le code.\"",
    },
    {
      initiales: 'CF',
      bg: C.terracotta,
      nom: 'Camille Faure',
      role: 'Talent Acquisition',
      phrase: '"Mon objectif : que vous sachiez exactement dans quoi vous mettez les pieds. Aucune surprise côté Acme."',
    },
  ],
  offres: [
    {
      id: 1,
      titre: 'Product Designer Senior',
      type: 'CDI',
      ville: 'Lyon (hybride)',
      date: 'Il y a 3 jours',
      score: 87,
    },
    {
      id: 2,
      titre: 'Software Engineer – Backend',
      type: 'CDI',
      ville: 'Full remote',
      date: 'Il y a 1 semaine',
      score: 74,
    },
    {
      id: 3,
      titre: 'Growth Marketing Manager',
      type: 'CDI',
      ville: 'Lyon',
      date: 'Il y a 2 semaines',
      score: 61,
    },
  ],
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const RADIUS = 22
const CIRC = 2 * Math.PI * RADIUS

function ScoreRing({ score, delay = 0 }: { score: number; delay?: number }) {
  const [go, setGo] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setGo(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  const offset = go ? CIRC * (1 - score / 100) : CIRC
  const color = score >= 80 ? C.terracotta : score >= 65 ? C.amber : C.grey

  return (
    <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
      <svg width={56} height={56} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={28} cy={28} r={RADIUS} fill="none" stroke={C.sable} strokeWidth={6} />
        <circle cx={28} cy={28} r={RADIUS} fill="none" stroke={color} strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: '11px', fontWeight: '700', color, lineHeight: 1 }}>{score}%</span>
      </div>
    </div>
  )
}

function Avatar({
  initiales, bg, size = 52,
}: {
  initiales: string; bg: string; size?: number
}) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      backgroundColor: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: C.white, fontWeight: '700',
      fontSize: size > 60 ? '22px' : size > 48 ? '16px' : '13px',
      letterSpacing: '0.03em',
    }}>
      {initiales}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontFamily: 'Georgia, serif',
      fontSize: 'clamp(22px, 3vw, 28px)',
      color: C.dark,
      margin: '0 0 6px',
      lineHeight: 1.2,
    }}>
      {children}
    </h2>
  )
}

function SectionSub({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '14px', color: C.grey, margin: '0 0 28px' }}>
      {children}
    </p>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EntreprisePage() {
  const router = useRouter()
  const [suivre, setSuivre] = useState(false)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setConnected(Boolean(user))
    })
  }, [])

  const e = ENTREPRISE

  return (
    <main style={{ backgroundColor: C.creme, minHeight: '100vh' }}>

      {/* ── NAVBAR ────────────────────────────────────────────────────────── */}
      <nav style={{
        backgroundColor: C.white,
        borderBottom: `1px solid ${C.sable}`,
        padding: '0 40px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}>
        <div
          onClick={() => router.push('/')}
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: '20px',
            color: C.dark,
            cursor: 'pointer',
            letterSpacing: '-0.02em',
          }}
        >
          Kavio
        </div>
        <button
          onClick={() => router.push(connected ? '/dashboard' : '/inscription')}
          style={{
            backgroundColor: 'transparent',
            border: `1px solid ${C.sable}`,
            borderRadius: '10px',
            padding: '7px 16px',
            fontSize: '13px',
            color: C.dark,
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          {connected ? 'Mon espace' : 'Se connecter'}
        </button>
      </nav>

      {/* ── HEADER ENTREPRISE ─────────────────────────────────────────────── */}
      <header style={{ backgroundColor: C.vert, padding: '56px 40px 48px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>

          {/* Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: C.terracotta,
            color: C.white,
            fontSize: '12px',
            fontWeight: '700',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '5px 14px',
            borderRadius: '20px',
            marginBottom: '28px',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: C.white, display: 'inline-block' }} />
            Recrute activement
          </div>

          {/* Logo + infos */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', flexWrap: 'wrap' }}>
            <Avatar initiales={e.initiales} bg={e.initialesBg} size={80} />

            <div style={{ flex: 1, minWidth: '220px' }}>
              <h1 style={{
                fontFamily: 'Georgia, serif',
                fontSize: 'clamp(28px, 5vw, 44px)',
                color: C.white,
                margin: '0 0 8px',
                lineHeight: 1.1,
              }}>
                {e.nom}
              </h1>

              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '16px',
                alignItems: 'center',
                marginBottom: '28px',
              }}>
                {[
                  { icon: '⬡', val: e.secteur },
                  { icon: '◎', val: e.ville },
                  { icon: '◷', val: e.taille },
                ].map(({ icon, val }) => (
                  <span key={val} style={{ fontSize: '14px', color: C.sable, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ opacity: 0.7 }}>{icon}</span>
                    {val}
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    const section = document.getElementById('offres')
                    section?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  style={{
                    backgroundColor: C.terracotta,
                    color: C.white,
                    border: 'none',
                    borderRadius: '12px',
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Voir les offres ({e.offres.length})
                </button>
                <button
                  onClick={() => setSuivre(s => !s)}
                  style={{
                    backgroundColor: suivre ? `${C.sable}30` : 'transparent',
                    color: C.sable,
                    border: `1px solid ${C.sable}60`,
                    borderRadius: '12px',
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {suivre ? '✓ Suivi' : '+ Suivre'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── CONTENU ───────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '56px 24px' }}>

        {/* ── QUI SOMMES-NOUS ──────────────────────────────────────────────── */}
        <section style={{ marginBottom: '64px' }}>
          <SectionTitle>Qui sommes-nous</SectionTitle>
          <SectionSub>Notre mission, notre histoire, notre raison d'être.</SectionSub>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px' }}>
            {e.description.map((para, i) => (
              <p key={i} style={{
                fontSize: '15px',
                color: '#3A3A3A',
                lineHeight: '1.75',
                margin: 0,
              }}>
                {para}
              </p>
            ))}
          </div>

          {/* Valeurs */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {e.valeurs.map((v) => (
              <div key={v.titre} style={{
                flex: '1 1 240px',
                backgroundColor: C.white,
                border: `1px solid ${C.sable}`,
                borderRadius: '16px',
                padding: '24px',
              }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  backgroundColor: `${C.terracotta}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '20px',
                  marginBottom: '14px',
                }}>
                  {v.icon}
                </div>
                <div style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: '17px',
                  color: C.dark,
                  fontWeight: '700',
                  marginBottom: '8px',
                }}>
                  {v.titre}
                </div>
                <div style={{ fontSize: '13px', color: C.grey, lineHeight: '1.6' }}>
                  {v.desc}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── LA VIE CHEZ NOUS ─────────────────────────────────────────────── */}
        <section style={{ marginBottom: '64px' }}>
          <SectionTitle>La vie chez nous</SectionTitle>
          <SectionSub>Ce que vivre chez Acme veut dire au quotidien.</SectionSub>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {e.vie.map((item) => (
              <div key={item.titre} style={{
                flex: '1 1 180px',
                backgroundColor: C.vert,
                borderRadius: '16px',
                padding: '24px 20px',
              }}>
                <div style={{ fontSize: '26px', marginBottom: '12px' }}>
                  {item.icon}
                </div>
                <div style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: '15px',
                  color: C.white,
                  fontWeight: '600',
                  marginBottom: '8px',
                }}>
                  {item.titre}
                </div>
                <div style={{ fontSize: '13px', color: C.sable, lineHeight: '1.55', opacity: 0.9 }}>
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── L'ÉQUIPE QUI RECRUTE ─────────────────────────────────────────── */}
        <section style={{ marginBottom: '64px' }}>
          <SectionTitle>L'équipe qui recrute</SectionTitle>
          <SectionSub>Des vraies personnes derrière chaque candidature.</SectionSub>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {e.equipe.map((rec) => (
              <div key={rec.nom} style={{
                flex: '1 1 240px',
                backgroundColor: C.white,
                border: `1px solid ${C.sable}`,
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <Avatar initiales={rec.initiales} bg={rec.bg} size={48} />
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '15px', color: C.dark }}>
                      {rec.nom}
                    </div>
                    <div style={{ fontSize: '12px', color: C.grey, marginTop: '2px' }}>
                      {rec.role}
                    </div>
                  </div>
                </div>
                <p style={{
                  fontFamily: 'Georgia, serif',
                  fontStyle: 'italic',
                  fontSize: '13px',
                  color: C.grey,
                  lineHeight: '1.65',
                  margin: 0,
                  borderLeft: `3px solid ${C.sable}`,
                  paddingLeft: '14px',
                }}>
                  {rec.phrase}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── NOS OFFRES ACTUELLES ─────────────────────────────────────────── */}
        <section id="offres" style={{ marginBottom: '64px' }}>
          <SectionTitle>Nos offres actuelles</SectionTitle>
          <SectionSub>
            {connected
              ? 'Score de compatibilité calculé selon votre profil Kavio.'
              : 'Connectez-vous pour voir votre score de compatibilité avec chaque offre.'}
          </SectionSub>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {e.offres.map((offre, i) => (
              <div key={offre.id} style={{
                backgroundColor: C.white,
                border: `1px solid ${C.sable}`,
                borderRadius: '16px',
                padding: '22px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                flexWrap: 'wrap',
              }}>
                {/* Score */}
                {connected && (
                  <ScoreRing score={offre.score} delay={i * 150} />
                )}

                {/* Infos offre */}
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <div style={{
                    fontFamily: 'Georgia, serif',
                    fontSize: '17px',
                    color: C.dark,
                    fontWeight: '600',
                    marginBottom: '6px',
                  }}>
                    {offre.titre}
                  </div>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '10px',
                    alignItems: 'center',
                  }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '700',
                      color: C.vert,
                      backgroundColor: `${C.vert}15`,
                      padding: '3px 10px',
                      borderRadius: '20px',
                    }}>
                      {offre.type}
                    </span>
                    <span style={{ fontSize: '13px', color: C.grey }}>
                      ◎ {offre.ville}
                    </span>
                    <span style={{ fontSize: '12px', color: C.lightGrey }}>
                      {offre.date}
                    </span>
                  </div>
                </div>

                {/* CTA */}
                <button
                  onClick={() => router.push(connected ? '/dashboard' : '/inscription')}
                  style={{
                    backgroundColor: C.terracotta,
                    color: C.white,
                    border: 'none',
                    borderRadius: '10px',
                    padding: '10px 20px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  Voir l'offre →
                </button>
              </div>
            ))}
          </div>

          {!connected && (
            <div style={{
              marginTop: '20px',
              padding: '18px 22px',
              backgroundColor: `${C.terracotta}0D`,
              border: `1px solid ${C.terracotta}30`,
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px',
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: C.dark, marginBottom: '3px' }}>
                  Votre score de compatibilité
                </div>
                <div style={{ fontSize: '13px', color: C.grey }}>
                  Créez votre profil Kavio pour savoir si ces offres vous correspondent vraiment.
                </div>
              </div>
              <button
                onClick={() => router.push('/inscription')}
                style={{
                  backgroundColor: C.terracotta,
                  color: C.white,
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Créer mon profil →
              </button>
            </div>
          )}
        </section>

      </div>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer style={{
        backgroundColor: C.dark,
        padding: '36px 40px',
        borderTop: `1px solid #2A2A2A`,
      }}>
        <div style={{
          maxWidth: '900px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Avatar initiales={e.initiales} bg={e.initialesBg} size={40} />
            <div>
              <div style={{
                fontFamily: 'Georgia, serif',
                fontSize: '16px',
                color: C.white,
                fontWeight: '600',
              }}>
                {e.nom}
              </div>
              <div style={{ fontSize: '12px', color: C.sable, marginTop: '2px', opacity: 0.7 }}>
                {e.taille} · {e.ville}
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '20px',
            alignItems: 'center',
          }}>
            <a
              href={`https://${e.site}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '13px',
                color: C.sable,
                textDecoration: 'none',
                opacity: 0.75,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              ◎ {e.site}
            </a>
            <a
              href={`https://${e.linkedin}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '13px',
                color: C.sable,
                textDecoration: 'none',
                opacity: 0.75,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              ⬡ LinkedIn
            </a>
            <div style={{ fontSize: '12px', color: C.sable, opacity: 0.5 }}>
              {e.offres.length} offres sur Kavio
            </div>
          </div>
        </div>
      </footer>

    </main>
  )
}
