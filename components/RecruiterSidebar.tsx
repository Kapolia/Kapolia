'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  terracotta: '#C4673A',
  vert:       '#2C4A3E',
  sable:      '#E8D5B7',
  white:      '#FFFFFF',
  grey:       '#6B6B6B',
  dark:       '#1A1A1A',
}

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV: {
  id: string
  label: string
  badge?: number
  href: string
  activeExact?: boolean
}[] = [
  { id: 'messages', label: 'Messages',           href: '/recruteur/messages',      badge: 3 },
  { id: 'offres',   label: 'Mes offres',          href: '/recruteur/offres',        activeExact: true },
  { id: 'publier',  label: 'Publier une offre',   href: '/recruteur/offres/publier' },
  { id: 'stats',    label: 'Statistiques',        href: '/recruteur/statistiques' },
  { id: 'marque',   label: 'Marque employeur',    href: '/recruteur/entreprise' },
]

// ─── Icon ─────────────────────────────────────────────────────────────────────

function NavIcon({ id, active }: { id: string; active: boolean }) {
  const s = active ? C.terracotta : 'rgba(255,255,255,0.5)'
  const p = {
    width: 17, height: 17, viewBox: '0 0 24 24',
    fill: 'none' as const, stroke: s,
    strokeWidth: '1.8', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  }
  switch (id) {
    case 'messages': return <svg {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
    case 'offres':   return <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14,2 14,8 20,8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
    case 'publier':  return <svg {...p}><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
    case 'stats':    return <svg {...p}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
    case 'marque':   return <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
    default:         return null
  }
}

// ─── User avatar dropdown ─────────────────────────────────────────────────────

function UserAvatarMenu({ prenom }: { prenom: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref  = useRef<HTMLDivElement>(null)
  const initial = prenom?.[0]?.toUpperCase() || '?'

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  async function handleSignOut() {
    setOpen(false)
    await supabase.auth.signOut()
    router.replace('/')
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title={prenom || 'Mon compte'}
        style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          backgroundColor: C.terracotta,
          border: open ? '2px solid rgba(255,255,255,0.4)' : '2px solid transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: C.white, fontSize: 15, fontWeight: 700,
          cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
          transition: 'border-color 0.15s',
        }}
      >
        {initial}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 10px)',
          left: 0,
          backgroundColor: C.white,
          border: `1px solid ${C.sable}`,
          borderRadius: 14,
          padding: 6,
          minWidth: 190,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
          zIndex: 100,
          animation: 'kavio-up 0.13s ease',
        }}>
          <style suppressHydrationWarning>{`
            @keyframes kavio-up {
              from { opacity: 0; transform: translateY(6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {/* Header */}
          <div style={{ padding: '10px 12px 10px', borderBottom: `1px solid ${C.sable}`, marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>
              {prenom || 'Mon compte'}
            </div>
          </div>

          <DropItem label="Mon profil"      onClick={() => { setOpen(false); router.push('/parametres') }} />
          <DropItem label="Paramètres"      onClick={() => { setOpen(false); router.push('/parametres') }} />
          <div style={{ height: 1, backgroundColor: C.sable, margin: '4px 0' }} />
          <DropItem label="Se déconnecter" onClick={handleSignOut} danger />
        </div>
      )}
    </div>
  )
}

function DropItem({ label, onClick, danger = false }: { label: string; onClick: () => void; danger?: boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '9px 12px', border: 'none', borderRadius: 8,
        backgroundColor: hov ? (danger ? '#FDECEA' : '#F7F2EB') : 'transparent',
        color: danger ? '#C0392B' : C.dark,
        fontSize: 13, fontWeight: 500, cursor: 'pointer',
        transition: 'background-color 0.12s', fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export const SIDEBAR_WIDTH = 220

export default function RecruiterSidebar({
  entrepriseNom = 'Mon entreprise',
  plan = 'Pro',
  initiale = '?',
  prenom = '',
}: {
  entrepriseNom?: string
  plan?: string
  initiale?: string
  prenom?: string
}) {
  const router   = useRouter()
  const pathname = usePathname()

  function isActive(item: typeof NAV[number]) {
    if (item.activeExact) return pathname === item.href
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0,
      width: SIDEBAR_WIDTH, height: '100vh',
      backgroundColor: C.vert,
      display: 'flex', flexDirection: 'column',
      zIndex: 40, overflowY: 'auto',
    }}>

      {/* Logo */}
      <div
        onClick={() => router.push('/recruteur')}
        style={{
          padding: '22px 18px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <img src="/logo-kavio.png" alt="Kavio" style={{ height: '48px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        <span style={{
          display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.35)',
          marginTop: '2px', letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          Recruteur
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px' }}>
        {NAV.map(item => {
          const active = isActive(item)
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', borderRadius: '10px', border: 'none',
                backgroundColor: active ? 'rgba(196,103,58,0.18)' : 'transparent',
                color: active ? C.terracotta : 'rgba(255,255,255,0.62)',
                fontSize: '13px', fontWeight: active ? '600' : '400',
                cursor: 'pointer', textAlign: 'left', marginBottom: '2px',
                transition: 'background-color 0.12s, color 0.12s',
                fontFamily: 'inherit',
              }}
            >
              <NavIcon id={item.id} active={active} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge !== undefined && (
                <span style={{
                  fontSize: '10px', fontWeight: '700', minWidth: '18px', textAlign: 'center',
                  padding: '1px 5px', borderRadius: '20px',
                  backgroundColor: active ? C.terracotta : 'rgba(255,255,255,0.12)',
                  color: active ? C.white : 'rgba(255,255,255,0.6)',
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* User avatar + company footer */}
      <div style={{ padding: '12px 14px 0', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>

        {/* Avatar row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <UserAvatarMenu prenom={prenom} />
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: C.white,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {prenom || 'Mon compte'}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
              Recruteur
            </div>
          </div>
        </div>

        {/* Company info */}
        <div
          onClick={() => router.push('/parametres')}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            cursor: 'pointer', borderRadius: 10, padding: '8px 4px 14px',
            transition: 'background-color 0.12s',
          }}
          title="Paramètres"
        >
          <div style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            backgroundColor: 'rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: C.white,
          }}>
            {initiale}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: C.white,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {entrepriseNom}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              Plan {plan} · Paramètres
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
