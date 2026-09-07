'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Avatar from '@/components/Avatar'

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
  red:        '#C0392B',
  redBg:      '#FDECEA',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'compte' | 'confidentialite'

type Privacy = {
  messages_recruteurs:   boolean
  visible_candidatheque: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initiales(prenom: string, nom: string) {
  return `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase() || 'K'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <main style={{ minHeight: '100vh', backgroundColor: C.creme, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style suppressHydrationWarning>{`@keyframes kapolia-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${C.sable}`, borderTopColor: C.terracotta, animation: 'kapolia-spin 0.8s linear infinite' }} />
    </main>
  )
}

function Toast({ msg, visible }: { msg: string; visible: boolean }) {
  const isError = msg.toLowerCase().includes('erreur')
  return (
    <div style={{
      position: 'fixed', bottom: 28, left: '50%',
      transform: `translateX(-50%) translateY(${visible ? '0' : '14px'})`,
      opacity: visible ? 1 : 0, transition: 'opacity 0.22s ease, transform 0.22s ease',
      pointerEvents: 'none', zIndex: 100,
      backgroundColor: isError ? C.red : C.vert, color: C.white,
      padding: '11px 22px', borderRadius: 28, fontSize: 14, fontWeight: 600,
      boxShadow: '0 4px 20px rgba(0,0,0,0.16)',
      display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' as const,
    }}>
      {!isError && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {msg}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: C.dark, margin: '0 0 6px', fontWeight: 400 }}>{children}</h2>
}

function SectionSub({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, color: C.grey, margin: '0 0 28px', lineHeight: 1.5 }}>{children}</p>
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: C.dark, letterSpacing: '0.04em', textTransform: 'uppercase' as const, marginBottom: 8 }}>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, readOnly, type = 'text' }: {
  value: string; onChange?: (v: string) => void; placeholder?: string; readOnly?: boolean; type?: string
}) {
  return (
    <input
      type={type} value={value} readOnly={readOnly}
      onChange={e => onChange?.(e.target.value)} placeholder={placeholder}
      autoComplete={type === 'password' ? 'current-password' : undefined}
      style={{
        width: '100%', padding: '11px 14px', fontSize: 14, borderRadius: 10,
        border: `1.5px solid ${readOnly ? '#EBEBEB' : C.sable}`,
        backgroundColor: readOnly ? '#F9F9F9' : C.white,
        color: readOnly ? C.grey : C.dark,
        outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit',
        cursor: readOnly ? 'default' : 'text', transition: 'border-color 0.15s',
      }}
    />
  )
}

function SaveBtn({ loading, onClick, label = 'Sauvegarder les modifications' }: { loading: boolean; onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} style={{
      backgroundColor: C.terracotta, color: C.white, border: 'none', borderRadius: 12,
      padding: '12px 24px', fontSize: 14, fontWeight: 600,
      cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.65 : 1,
      transition: 'opacity 0.15s', display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {loading && <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', animation: 'kapolia-spin 0.7s linear infinite' }} />}
      {loading ? 'Sauvegarde…' : label}
    </button>
  )
}

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, cursor: 'pointer',
      padding: '14px 18px', borderRadius: 12,
      backgroundColor: checked ? `${C.vert}08` : C.white,
      border: `1px solid ${checked ? C.vert + '30' : C.sable}`, transition: 'all 0.15s',
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.dark }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: C.grey, marginTop: 2 }}>{desc}</div>}
      </div>
      <div onClick={() => onChange(!checked)} style={{
        width: 42, height: 24, borderRadius: 12,
        backgroundColor: checked ? C.vert : C.lightGrey,
        position: 'relative', flexShrink: 0, transition: 'background-color 0.2s', cursor: 'pointer',
      }}>
        <div style={{
          position: 'absolute', top: 3, left: checked ? 21 : 3,
          width: 18, height: 18, borderRadius: '50%', backgroundColor: C.white,
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s',
        }} />
      </div>
    </label>
  )
}

function Divider() {
  return <div style={{ height: 1, backgroundColor: C.sable, margin: '8px 0' }} />
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ParametresPage() {
  const router = useRouter()

  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<Tab>('compte')
  const [email, setEmail]       = useState('')
  const [prenom, setPrenom]     = useState('')
  const [nom, setNom]           = useState('')
  const [avatarUrl, setAvatarUrl]   = useState('')
  const [avatarType, setAvatarType] = useState('')
  const [toastMsg, setToastMsg] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const [savingPwd, setSavingPwd]       = useState(false)
  const [savingPrivacy, setSavingPrivacy] = useState(false)
  const [deleting, setDeleting]         = useState(false)

  const [pwdOld, setPwdOld]         = useState('')
  const [pwdNew, setPwdNew]         = useState('')
  const [pwdConfirm, setPwdConfirm] = useState('')
  const [pwdError, setPwdError]     = useState('')

  const [privacy, setPrivacy] = useState<Privacy>({
    messages_recruteurs: false, visible_candidatheque: false,
  })
  const [origVisibleCandidatheque, setOrigVisibleCandidatheque] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/connexion'); return }
      setEmail(user.email ?? '')
      const { data } = await supabase.from('profils').select('prenom,nom,avatar_url,avatar_type,messages_recruteurs,visible_candidatheque').eq('user_id', user.id).single()
      if (data) {
        setPrenom(data.prenom ?? '')
        setNom(data.nom ?? '')
        setAvatarUrl(data.avatar_url ?? '')
        setAvatarType(data.avatar_type ?? '')
        const vc = data.visible_candidatheque ?? false
        setOrigVisibleCandidatheque(vc)
        setPrivacy({
          messages_recruteurs: data.messages_recruteurs ?? false,
          visible_candidatheque: vc,
        })
      }
      setLoading(false)
    }
    load()
  }, [router])

  function showToast(msg: string) {
    setToastMsg(msg); setToastVisible(true)
    setTimeout(() => setToastVisible(false), 3000)
  }

  async function savePassword() {
    setPwdError('')
    if (pwdNew !== pwdConfirm) { setPwdError('Les mots de passe ne correspondent pas.'); return }
    if (pwdNew.length < 8) { setPwdError('8 caractères minimum.'); return }
    setSavingPwd(true)
    const { error } = await supabase.auth.updateUser({ password: pwdNew })
    setSavingPwd(false)
    if (error) { setPwdError(error.message) } else {
      setPwdOld(''); setPwdNew(''); setPwdConfirm('')
      showToast('Mot de passe mis à jour !')
    }
  }

  async function deleteAccount() {
    if (!confirm('Supprimer définitivement votre compte ? Cette action est irréversible.')) return
    setDeleting(true)
    await supabase.auth.signOut()
    router.replace('/')
  }

  async function savePrivacy() {
    setSavingPrivacy(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const payload: Record<string, unknown> = { ...privacy }
      if (privacy.visible_candidatheque !== origVisibleCandidatheque) {
        payload.visible_candidatheque_maj_le = new Date().toISOString()
        setOrigVisibleCandidatheque(privacy.visible_candidatheque)
      }
      const { error, count } = await supabase.from('profils').update(payload, { count: 'exact' }).eq('user_id', user.id)
      if (error || count === 0) {
        console.error('[savePrivacy] update failed', error, { count })
        setSavingPrivacy(false)
        showToast('Erreur : impossible de sauvegarder.')
        return
      }
    }
    setSavingPrivacy(false)
    showToast('Préférences sauvegardées !')
  }

  if (loading) return <Spinner />

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'compte',          label: 'Compte',          icon: '⬡' },
    { id: 'confidentialite', label: 'Confidentialité', icon: '◷' },
  ]

  return (
    <main style={{ minHeight: '100vh', backgroundColor: C.creme, marginLeft: 64 }}>
      <style suppressHydrationWarning>{`@keyframes kapolia-spin { to { transform: rotate(360deg); } }`}</style>
      <Toast msg={toastMsg} visible={toastVisible} />

      {/* ── NAVBAR ──────────────────────────────────────────────────────────── */}
      <nav style={{
        backgroundColor: C.white, borderBottom: `1px solid ${C.sable}`,
        padding: '0 40px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div onClick={() => router.push('/')} style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: C.dark, cursor: 'pointer' }}>
          Kapolia
        </div>
        <button onClick={() => router.push('/profil')} style={{
          backgroundColor: C.terracotta, color: C.white, border: 'none', borderRadius: 10,
          padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          Mon profil
        </button>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px 80px', display: 'flex', gap: 28, alignItems: 'flex-start' }}>

        {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
        <aside style={{ width: 220, flexShrink: 0, position: 'sticky', top: 80 }}>
          <div style={{
            backgroundColor: C.white, border: `1px solid ${C.sable}`,
            borderRadius: 18, padding: 24, textAlign: 'center' as const, marginBottom: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <Avatar
                profil={{ prenom, nom, avatar_url: avatarUrl || undefined, avatar_type: avatarType || undefined }}
                size="lg"
              />
            </div>
            <div style={{ fontWeight: 600, fontSize: 15, color: C.dark, marginBottom: 4 }}>
              {prenom ? `${prenom} ${nom}` : 'Mon compte'}
            </div>
            <div style={{ fontSize: 12, color: C.grey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
              {email}
            </div>
          </div>

          <div style={{ backgroundColor: C.white, border: `1px solid ${C.sable}`, borderRadius: 18, padding: 8 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                width: '100%', textAlign: 'left' as const, padding: '10px 14px', borderRadius: 12,
                marginBottom: 2, border: 'none',
                backgroundColor: tab === t.id ? C.creme : 'transparent',
                color: tab === t.id ? C.terracotta : C.grey,
                fontSize: 13, fontWeight: tab === t.id ? 700 : 400, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.15s',
              }}>
                <span style={{ fontSize: 14, opacity: tab === t.id ? 1 : 0.6 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </aside>

        {/* ── CONTENT ─────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ backgroundColor: C.white, border: `1px solid ${C.sable}`, borderRadius: 20, padding: 'clamp(24px, 4%, 40px)' }}>

            {/* ─── COMPTE ─────────────────────────────────────────────────── */}
            {tab === 'compte' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                <div>
                  <SectionTitle>Compte</SectionTitle>
                  <SectionSub>Gérez vos identifiants de connexion.</SectionSub>
                </div>

                <div>
                  <FieldLabel>Adresse e-mail</FieldLabel>
                  <TextInput value={email} readOnly />
                  <div style={{ fontSize: 12, color: C.grey, marginTop: 6 }}>
                    Pour changer votre email, contactez le support Kapolia.
                  </div>
                </div>

                <Divider />

                <div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: C.dark, marginBottom: 16 }}>
                    Changer le mot de passe
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <FieldLabel>Ancien mot de passe</FieldLabel>
                      <TextInput type="password" value={pwdOld} onChange={setPwdOld} placeholder="••••••••" />
                    </div>
                    <div>
                      <FieldLabel>Nouveau mot de passe</FieldLabel>
                      <TextInput type="password" value={pwdNew} onChange={setPwdNew} placeholder="••••••••" />
                    </div>
                    <div>
                      <FieldLabel>Confirmer le nouveau mot de passe</FieldLabel>
                      <TextInput type="password" value={pwdConfirm} onChange={setPwdConfirm} placeholder="••••••••" />
                    </div>
                    {pwdError && (
                      <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: C.redBg, border: `1px solid ${C.red}30`, color: C.red, fontSize: 13 }}>
                        {pwdError}
                      </div>
                    )}
                    <SaveBtn loading={savingPwd} onClick={savePassword} label="Mettre à jour le mot de passe" />
                  </div>
                </div>

                <Divider />

                <div style={{ padding: '20px 22px', borderRadius: 14, backgroundColor: C.redBg, border: `1px solid ${C.red}25` }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: C.red, marginBottom: 6 }}>Zone de danger</div>
                  <p style={{ fontSize: 13, color: C.grey, margin: '0 0 16px', lineHeight: 1.5 }}>
                    La suppression de votre compte est permanente. Toutes vos données, candidatures et profil seront effacés.
                  </p>
                  <button onClick={deleteAccount} disabled={deleting} style={{
                    backgroundColor: C.red, color: C.white, border: 'none', borderRadius: 10,
                    padding: '10px 20px', fontSize: 13, fontWeight: 600,
                    cursor: deleting ? 'default' : 'pointer', opacity: deleting ? 0.6 : 1,
                  }}>
                    {deleting ? 'Suppression…' : 'Supprimer mon compte'}
                  </button>
                </div>
              </div>
            )}

            {/* ─── CONFIDENTIALITÉ ────────────────────────────────────────── */}
            {tab === 'confidentialite' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ marginBottom: 8 }}>
                  <SectionTitle>Confidentialité</SectionTitle>
                  <SectionSub>Contrôlez qui peut voir votre profil et vous contacter.</SectionSub>
                </div>
                <Toggle
                  checked={privacy.messages_recruteurs}
                  onChange={v => setPrivacy(p => ({ ...p, messages_recruteurs: v }))}
                  label="Recevoir des messages de recruteurs"
                  desc="Les recruteurs peuvent vous envoyer des messages directs."
                />
                <Toggle
                  checked={privacy.visible_candidatheque}
                  onChange={v => setPrivacy(p => ({ ...p, visible_candidatheque: v }))}
                  label="Souhaitez-vous être visible par les recruteurs ?"
                  desc="Les recruteurs inscrits sur Kapolia pourront consulter votre profil et vous contacter, même si vous n'avez postulé à aucune de leurs offres."
                />
                <div style={{ marginTop: 8 }}>
                  <SaveBtn loading={savingPrivacy} onClick={savePrivacy} />
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </main>
  )
}
