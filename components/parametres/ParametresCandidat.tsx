'use client'

import { useRef, useEffect, useState, useCallback, useLayoutEffect } from 'react'
import { C, CARD_SHADOW, CARD_RADIUS } from '@/lib/colors'
import { FONT_SANS } from '@/lib/typography'
import { reduitMouvement } from '@/lib/motion'
import { AUTH_STYLES } from '@/components/auth/auth-styles'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Bandeau, type BandeauHandle } from '@/components/Bandeau'
import AuthField from '@/components/auth/AuthField'
import BarreRobustesse from '@/components/auth/BarreRobustesse'
import ErreurDepliable from '@/components/auth/ErreurDepliable'
import { evaluerMotDePasse, NIVEAU_MIN_MOT_DE_PASSE } from '@/lib/robustesse-mot-de-passe'
import { isValidEmail } from '@/lib/validation'
import CarteReglages from './CarteReglages'
import LienAction from './LienAction'
import Interrupteur from './Interrupteur'

// ─── TOC ──────────────────────────────────────────────────────────────────────

type SectionId = 'compte' | 'securite' | 'visibilite' | 'notifications' | 'donnees'

const SECTIONS: { id: SectionId; label: string; titre: string; sous: string }[] = [
  { id: 'compte',        label: 'Compte',               titre: 'Compte',               sous: "Les coordonnées qui vous permettent de vous connecter et d'être joint." },
  { id: 'securite',      label: 'Connexion et sécurité', titre: 'Connexion et sécurité', sous: 'Votre mot de passe et les appareils connectés à votre compte.' },
  { id: 'visibilite',    label: 'Visibilité',            titre: 'Visibilité',            sous: 'Qui peut voir votre profil.' },
  { id: 'notifications', label: 'Notifications',         titre: 'Notifications',         sous: 'Les e-mails que Kapolia vous envoie. Tout ce qui arrive reste visible dans votre espace.' },
  { id: 'donnees',       label: 'Données personnelles',  titre: 'Données personnelles',  sous: 'Vos droits sur ce que Kapolia garde à votre sujet.' },
]

const SCROLL_OFFSET  = 200
const MOBILE_BREAK   = 900
const LINK_PADDING_V = 8
const LINK_PADDING_H = 12
const PILL_V_INSET       = 8

const PHRASE_SUPPRESSION = 'supprimer mon compte'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findScrollContainer(el: HTMLElement | null): HTMLElement | null {
  let cur = el?.parentElement ?? null
  while (cur && cur !== document.body) {
    const oy = getComputedStyle(cur).overflowY
    if (oy === 'auto' || oy === 'scroll') return cur
    cur = cur.parentElement
  }
  return null
}

function formaterTelephone(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('33') && digits.length > 2) digits = '0' + digits.slice(2)
  digits = digits.slice(0, 10)
  return (digits.match(/.{1,2}/g) ?? []).join(' ')
}

// Durée de validité d'un lien e-mail sur ce projet Supabase (Email OTP expiration, 3600 s). Changer les deux ensemble.
const DUREE_LIEN_CHANGEMENT_MS = 60 * 60 * 1000

function adresseEnAttente(user: { new_email?: string; email_change_sent_at?: string }): string {
  if (!user.new_email || !user.email_change_sent_at) return ''
  if (Date.now() - Date.parse(user.email_change_sent_at) >= DUREE_LIEN_CHANGEMENT_MS) return ''
  return user.new_email
}

const GOOGLE_LOGO = (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

// ─── Component ────────────────────────────────────────────────────────────────

export default function ParametresCandidat() {
  const router = useRouter()

  // ── Layout/nav ──────────────────────────────────────────────────────────────
  const containerRef      = useRef<HTMLDivElement>(null)
  const sectionRefs       = useRef<Record<SectionId, HTMLElement | null>>({ compte: null, securite: null, visibilite: null, notifications: null, donnees: null })
  const scrollContainerRef = useRef<HTMLElement | null>(null)
  const tocRef            = useRef<HTMLDivElement>(null)
  const animatedRef       = useRef(false)
  const hashNavigatedRef  = useRef(false)

  const [activeId,   setActiveId]   = useState<SectionId>('compte')
  const [pillTop,    setPillTop]    = useState(0)
  const [pillHeight, setPillHeight] = useState(0)
  const [isMobile,   setIsMobile]   = useState(false)

  // ── Data ────────────────────────────────────────────────────────────────────
  const [email,         setEmail]         = useState('')
  const [emailConfirme, setEmailConfirme] = useState(true) // default true: no flash before data loads
  const [telephone,              setTelephone]              = useState('')
  const [telephoneCandidatures,  setTelephoneCandidatures]  = useState(false)
  const [chargement,             setChargement]             = useState(true)
  const emailConfirmeRef = useRef(true)
  const emailRef         = useRef('')

  // ── Email change ─────────────────────────────────────────────────────────────
  const [emailFormOpen,              setEmailFormOpen]              = useState(false)
  const [emailNew,                   setEmailNew]                   = useState('')
  const [emailNewError,              setEmailNewError]              = useState('')
  const [emailNewShake,              setEmailNewShake]              = useState(0)
  const [emailPwdInput,              setEmailPwdInput]              = useState('')
  const [emailPwdError,              setEmailPwdError]              = useState('')
  const [emailPwdShake,              setEmailPwdShake]              = useState(0)
  const [emailChangeSaving,          setEmailChangeSaving]          = useState(false)
  const [emailPendingNew,            setEmailPendingNew]            = useState('')
  const [emailChangeResend,          setEmailChangeResend]          = useState(false)
  const [emailChangeResendCooldown,  setEmailChangeResendCooldown]  = useState(0)

  // ── Unconfirmed banner ───────────────────────────────────────────────────────
  const bannerRef              = useRef<HTMLDivElement>(null)
  const [bannerHidden, setBannerHidden] = useState(false)

  // ── Pill bounce ─────────────────────────────────────────────────────────────
  const [pillBouncing, setPillBouncing] = useState(false)

  // ── Resend email ────────────────────────────────────────────────────────────
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendEnvoi,    setResendEnvoi]    = useState(false)

  // ── Phone form ──────────────────────────────────────────────────────────────
  const [phoneOpen,   setPhoneOpen]   = useState(false)
  const [phoneInput,  setPhoneInput]  = useState('')
  const [phoneError,  setPhoneError]  = useState('')
  const [phoneShake,  setPhoneShake]  = useState(false)
  const [phoneSaving, setPhoneSaving] = useState(false)

  // ── Security section ────────────────────────────────────────────────────────
  const [isGoogle,          setIsGoogle]          = useState(false)
  const [pwdFormOpen,       setPwdFormOpen]       = useState(false)
  const [pwdOld,            setPwdOld]            = useState('')
  const [pwdNew,            setPwdNew]            = useState('')
  const [pwdConfirm,        setPwdConfirm]        = useState('')
  const [pwdSaving,         setPwdSaving]         = useState(false)
  const [pwdOldError,       setPwdOldError]       = useState('')
  const [pwdNewError,       setPwdNewError]       = useState('')
  const [pwdConfirmError,   setPwdConfirmError]   = useState('')
  const [pwdOldShake,       setPwdOldShake]       = useState(0)
  const [pwdNewShake,       setPwdNewShake]       = useState(0)
  const [pwdConfirmShake,   setPwdConfirmShake]   = useState(0)
  const [signoutSaving,     setSignoutSaving]     = useState(false)

  // ── Bandeau ─────────────────────────────────────────────────────────────────
  const bandeauRef      = useRef<BandeauHandle>(null)
  const bandeauTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [bandeauMsg, setBandeauMsg] = useState('')
  const [bandeauKey, setBandeauKey] = useState(0)

  // ── Visibilité ──────────────────────────────────────────────────────────────
  const bandeauVisRef = useRef<BandeauHandle>(null)
  const [visibleCandidatheque, setVisibleCandidatheque] = useState(false)
  const [bandeauVisMsg,        setBandeauVisMsg]        = useState('')
  const [bandeauVisKey,        setBandeauVisKey]        = useState(0)
  const [bandeauVisAction,     setBandeauVisAction]     = useState<{ libelle: string; onClick: () => void } | null>(null)

  // ── Notifications ───────────────────────────────────────────────────────────
  const [emailNotifications, setEmailNotifications] = useState(true)

  // ── Données personnelles ─────────────────────────────────────────────────────
  const [suppressionModalOuverte, setSuppressionModalOuverte] = useState(false)
  const suppressionFenetreRef = useRef<HTMLDivElement>(null)
  const suppressionVoileRef   = useRef<HTMLDivElement>(null)
  const suppressionOuvreurRef = useRef<HTMLButtonElement>(null)
  const suppressionInputRef   = useRef<HTMLInputElement>(null)
  const [confirmationSuppression, setConfirmationSuppression] = useState('')
  const [suppressionEnCours,      setSuppressionEnCours]      = useState(false)
  const [suppressionErreur,       setSuppressionErreur]       = useState('')
  const [notifRdv,           setNotifRdv]           = useState(true)
  const [notifRappelRdv,     setNotifRappelRdv]     = useState(true)
  const [notifCandidature,   setNotifCandidature]   = useState(true)
  const [notifProche,        setNotifProche]        = useState(true)
  const [rappelsFavoris,     setRappelsFavoris]     = useState(true)

  // ── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => () => { if (bandeauTimerRef.current) clearTimeout(bandeauTimerRef.current) }, [])

  useEffect(() => { scrollContainerRef.current = findScrollContainer(containerRef.current) }, [])

  useEffect(() => {
    if (hashNavigatedRef.current) return
    hashNavigatedRef.current = true
    const hash = window.location.hash.slice(1)
    if (!SECTIONS.some(s => s.id === hash)) return
    const id = hash as SectionId
    const sc = scrollContainerRef.current
    const el = sectionRefs.current[id]
    if (!sc || !el) return
    sc.scrollTop = el.offsetTop - 24
    setActiveId(id)
  }, [])

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < MOBILE_BREAK) }
    check()
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAK - 1}px)`)
    mq.addEventListener('change', check)
    return () => mq.removeEventListener('change', check)
  }, [])

  useEffect(() => {
    if (animatedRef.current || reduitMouvement()) return
    animatedRef.current = true
    SECTIONS.forEach((s, i) => {
      const el = sectionRefs.current[s.id]
      if (!el) return
      el.style.opacity = '0'
      el.style.transform = 'translateY(8px)'
      el.style.transition = 'none'
      setTimeout(() => {
        el.style.transition = `opacity 380ms cubic-bezier(.3,.7,.4,1) ${i * 50}ms, transform 380ms cubic-bezier(.3,.7,.4,1) ${i * 50}ms`
        el.style.opacity = '1'
        el.style.transform = 'translateY(0)'
      }, 16)
    })
  }, [])

  useEffect(() => {
    async function charger() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const changementAdresse = new URLSearchParams(window.location.search).get('adresse') === 'modifiee'
      if (changementAdresse) history.replaceState(null, '', window.location.pathname)
      const confirmed = !!user.email_confirmed_at
      emailRef.current = user.email ?? ''
      setEmail(user.email ?? '')
      setEmailConfirme(confirmed)
      emailConfirmeRef.current = confirmed
      setIsGoogle(!user.identities?.some(ident => ident.provider === 'email'))
      setEmailPendingNew(adresseEnAttente(user))
      const { data } = await supabase.from('profils').select('telephone,telephone_candidatures,visible_candidatheque,email_notifications,rappels_favoris,notif_rdv,notif_rappel_rdv,notif_candidature,notif_proche').eq('user_id', user.id).single()
      setTelephone(data?.telephone ?? '')
      setTelephoneCandidatures(data?.telephone_candidatures ?? false)
      setVisibleCandidatheque(data?.visible_candidatheque ?? false)
      setEmailNotifications(data?.email_notifications ?? true)
      setRappelsFavoris(data?.rappels_favoris ?? true)
      setNotifRdv(data?.notif_rdv ?? true)
      setNotifRappelRdv(data?.notif_rappel_rdv ?? true)
      setNotifCandidature(data?.notif_candidature ?? true)
      setNotifProche(data?.notif_proche ?? true)
      setChargement(false)
      if (changementAdresse && !user.new_email) {
        showBandeau('Votre adresse e-mail a été modifiée.')
      }
    }
    charger()
  }, [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'USER_UPDATED' && session?.user) {
        const updatedEmail = session.user.email ?? ''
        const wasChanged = updatedEmail !== emailRef.current && emailRef.current !== ''
        emailRef.current = updatedEmail
        setEmail(updatedEmail)
        setEmailPendingNew(adresseEnAttente(session.user))
        if (wasChanged && !session.user.new_email) {
          showBandeau('Votre adresse e-mail a été modifiée.')
        }
        return
      }
      if (!session?.user?.email_confirmed_at || emailConfirmeRef.current) return
      emailConfirmeRef.current = true
      setEmailConfirme(true)

      // Collapse banner
      const el = bannerRef.current
      if (reduitMouvement() || !el) {
        setBannerHidden(true)
      } else {
        const h = el.scrollHeight
        el.style.height = `${h}px`
        el.style.overflow = 'hidden'
        requestAnimationFrame(() => requestAnimationFrame(() => {
          el.style.transition = 'height 240ms ease, opacity 240ms ease, margin-bottom 240ms ease'
          el.style.height = '0'
          el.style.opacity = '0'
          el.style.marginBottom = '0'
          setTimeout(() => setBannerHidden(true), 245)
        }))
      }

      // Pill bounce
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setPillBouncing(true)
        setTimeout(() => setPillBouncing(false), 450)
      }))

      showBandeau('Votre adresse e-mail est confirmée.')
    })
    return () => subscription.unsubscribe()
  }, []) // only stable refs and setters used

  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(id)
  }, [resendCooldown])

  useEffect(() => {
    if (emailChangeResendCooldown <= 0) return
    const id = setTimeout(() => setEmailChangeResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(id)
  }, [emailChangeResendCooldown])

  const updatePill = useCallback((id: SectionId) => {
    if (!tocRef.current || isMobile) return
    const links = tocRef.current.querySelectorAll<HTMLElement>('[data-toc-link]')
    for (const link of links) {
      if (link.dataset.tocLink === id) {
        setPillTop(link.offsetTop + PILL_V_INSET)
        setPillHeight(link.offsetHeight - PILL_V_INSET * 2)
        break
      }
    }
  }, [isMobile])

  useEffect(() => { updatePill(activeId) }, [activeId, isMobile, updatePill])

  useEffect(() => {
    const sc = scrollContainerRef.current
    if (!sc) return
    function onScroll() {
      const st = sc!.scrollTop
      const clientH = sc!.clientHeight
      const scrollH = sc!.scrollHeight
      if (st + clientH >= scrollH - 2) { setActiveId(SECTIONS[SECTIONS.length - 1].id); return }
      let found: SectionId = SECTIONS[0].id
      for (const s of SECTIONS) {
        const el = sectionRefs.current[s.id]
        if (el && el.offsetTop - st <= SCROLL_OFFSET) found = s.id
      }
      setActiveId(found)
    }
    sc.addEventListener('scroll', onScroll, { passive: true })
    return () => sc.removeEventListener('scroll', onScroll)
  }, [])

  useLayoutEffect(() => {
    if (!suppressionModalOuverte) return
    const fen   = suppressionFenetreRef.current
    const voile = suppressionVoileRef.current
    if (!fen || !voile || reduitMouvement()) return
    voile.animate([{ opacity: '0' }, { opacity: '1' }], { duration: 200, fill: 'forwards' })
    fen.animate(
      [
        { opacity: '0', transform: 'translateY(12px) scale(.98)' },
        { opacity: '1', transform: 'translateY(0) scale(1)' },
      ],
      { duration: 250, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' },
    )
  }, [suppressionModalOuverte])

  useEffect(() => {
    if (!suppressionModalOuverte) return
    const delay = reduitMouvement() ? 0 : 260
    const timer = setTimeout(() => suppressionInputRef.current?.focus(), delay)
    return () => clearTimeout(timer)
  }, [suppressionModalOuverte])

  // ── Actions ──────────────────────────────────────────────────────────────────

  function showBandeau(msg: string) {
    if (bandeauTimerRef.current) clearTimeout(bandeauTimerRef.current)
    setBandeauMsg(msg)
    setBandeauKey(k => k + 1)
    bandeauTimerRef.current = setTimeout(() => {
      bandeauRef.current?.animateOut(() => setBandeauMsg(''))
    }, 3500)
  }

  function scrollTo(id: SectionId) {
    const el = sectionRefs.current[id]
    const sc = scrollContainerRef.current
    if (!el || !sc) return
    sc.scrollTo({ top: el.offsetTop - 24, behavior: 'smooth' })
    history.replaceState(null, '', `#${id}`)
    setActiveId(id)
  }

  async function renvoyerConfirmation() {
    if (resendCooldown > 0 || resendEnvoi || !email) return
    setResendEnvoi(true)
    await supabase.auth.resend({ type: 'signup', email })
    setResendEnvoi(false)
    setResendCooldown(60)
  }

  async function enregistrerTelephone(valeurBrute: string) {
    const rawDigits = valeurBrute.replace(/\s/g, '')
    if (rawDigits.length > 0 && rawDigits.length !== 10) {
      setPhoneError('Un numéro français compte 10 chiffres.')
      setPhoneShake(false)
      requestAnimationFrame(() => { setPhoneShake(true); setTimeout(() => setPhoneShake(false), 400) })
      return
    }
    setPhoneSaving(true)
    setPhoneError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPhoneSaving(false); return }
    const valeur = rawDigits.length === 0 ? null : valeurBrute.trim()
    const { error, count } = await supabase.from('profils').update({ telephone: valeur }, { count: 'exact' }).eq('user_id', user.id)
    if (error || count !== 1) {
      console.error('[ParametresCandidat] échec enregistrement téléphone', { error, count })
      setPhoneError("Votre numéro n'a pas pu être enregistré. Veuillez réessayer.")
      setPhoneSaving(false)
      return
    }
    setTelephone(valeur ?? '')
    setPhoneOpen(false)
    setPhoneInput('')
    setPhoneError('')
    setPhoneSaving(false)
    showBandeau(rawDigits.length === 0 ? 'Numéro retiré.' : 'Numéro enregistré.')
  }

  async function envoyerChangementEmail() {
    setEmailNewError(''); setEmailPwdError('')
    const nouvelleAdresse = emailNew.trim()
    if (!nouvelleAdresse || !isValidEmail(nouvelleAdresse)) {
      setEmailNewError('Saisissez une adresse e-mail valide.')
      setEmailNewShake(n => n + 1)
      return
    }
    if (nouvelleAdresse.toLowerCase() === email.toLowerCase()) {
      setEmailNewError("C'est déjà votre adresse actuelle.")
      setEmailNewShake(n => n + 1)
      return
    }
    if (!isGoogle) {
      if (!emailPwdInput) {
        setEmailPwdError('Saisissez votre mot de passe actuel.')
        setEmailPwdShake(n => n + 1)
        return
      }
      setEmailChangeSaving(true)
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: emailPwdInput })
      if (signInError) {
        const c = (signInError as { code?: string }).code
        setEmailPwdError(
          c === 'invalid_credentials'       ? 'Mot de passe incorrect.'
          : c === 'over_request_rate_limit' ? 'Trop de tentatives. Réessayez dans quelques minutes.'
          : 'La vérification n\'a pas abouti. Veuillez réessayer.'
        )
        setEmailPwdShake(n => n + 1)
        setEmailChangeSaving(false)
        return
      }
    } else {
      setEmailChangeSaving(true)
    }
    const { error } = await supabase.auth.updateUser(
      { email: nouvelleAdresse },
      { emailRedirectTo: window.location.origin + '/parametres?adresse=modifiee' }
    )
    if (error) {
      console.error('[ParametresCandidat] échec changement e-mail', error)
      const code = (error as { code?: string }).code
      if (code === 'email_exists' || code === 'user_already_exists') {
        setEmailNewError('Cette adresse est déjà utilisée par un autre compte.')
        setEmailNewShake(n => n + 1)
      } else if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') {
        setEmailNewError('Trop de tentatives. Réessayez dans quelques minutes.')
      } else {
        setEmailNewError("Le changement n'a pas pu être lancé. Veuillez réessayer.")
      }
      setEmailChangeSaving(false)
      return
    }
    setEmailPendingNew(nouvelleAdresse)
    setEmailFormOpen(false)
    setEmailNew('')
    setEmailPwdInput('')
    setEmailChangeSaving(false)
  }

  async function renvoyerChangementEmail() {
    if (emailChangeResendCooldown > 0 || emailChangeResend || !emailPendingNew) return
    setEmailChangeResend(true)
    const { error: resendError } = await supabase.auth.updateUser(
      { email: emailPendingNew },
      { emailRedirectTo: window.location.origin + '/parametres?adresse=modifiee' }
    )
    setEmailChangeResend(false)
    if (resendError) {
      const c = (resendError as { code?: string }).code
      showBandeau(
        c === 'over_request_rate_limit' || c === 'over_email_send_rate_limit'
          ? 'Trop de tentatives. Réessayez dans quelques minutes.'
          : "Le lien n'a pas pu être renvoyé. Veuillez réessayer."
      )
      return
    }
    setEmailChangeResendCooldown(60)
  }

  function resetPwdForm() {
    setPwdOld(''); setPwdNew(''); setPwdConfirm('')
    setPwdOldError(''); setPwdNewError(''); setPwdConfirmError('')
  }

  async function modifierMotDePasse() {
    setPwdOldError(''); setPwdNewError(''); setPwdConfirmError('')

    if (!isGoogle && !pwdOld) {
      setPwdOldError('Saisissez votre mot de passe actuel.')
      setPwdOldShake(n => n + 1)
      return
    }
    if (pwdNew !== pwdConfirm) {
      setPwdConfirmError('Les deux mots de passe ne correspondent pas.')
      setPwdConfirmShake(n => n + 1)
      return
    }

    const wasGoogle = isGoogle
    setPwdSaving(true)

    if (!isGoogle) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: pwdOld })
      if (signInError) {
        const c = (signInError as { code?: string }).code
        setPwdOldError(
          c === 'invalid_credentials'    ? 'Mot de passe incorrect.'
          : c === 'over_request_rate_limit' ? 'Trop de tentatives. Réessayez dans quelques minutes.'
          : 'La vérification n\'a pas abouti. Veuillez réessayer.'
        )
        setPwdOldShake(n => n + 1)
        setPwdSaving(false)
        return
      }
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: pwdNew })
    if (updateError) {
      if ((updateError as { code?: string }).code === 'same_password') {
        setPwdNewError("Le nouveau mot de passe doit être différent de l'actuel.")
        setPwdNewShake(n => n + 1)
      } else {
        setPwdConfirmError("Le mot de passe n'a pas pu être modifié. Veuillez réessayer.")
      }
      setPwdSaving(false)
      return
    }

    if (wasGoogle) setIsGoogle(false)
    setPwdSaving(false)
    setPwdFormOpen(false)
    resetPwdForm()
    showBandeau(wasGoogle ? 'Mot de passe ajouté.' : 'Mot de passe mis à jour.')
  }

  async function deconnecterAutresAppareils() {
    setSignoutSaving(true)
    const { error } = await supabase.auth.signOut({ scope: 'others' })
    setSignoutSaving(false)
    if (error) {
      showBandeau("La déconnexion n'a pas abouti. Veuillez réessayer.")
      return
    }
    showBandeau('Les autres appareils ont été déconnectés.')
  }

  function showBandeauVis(msg: string, action?: { libelle: string; onClick: () => void }) {
    setBandeauVisKey(k => k + 1)
    setBandeauVisMsg(msg)
    setBandeauVisAction(action ?? null)
  }

  async function sauvegarderVisibilite(val: boolean) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('no user')
    const { error, count } = await supabase.from('profils').update({
      visible_candidatheque: val,
      visible_candidatheque_maj_le: new Date().toISOString(),
    }, { count: 'exact' }).eq('user_id', user.id)
    if (error || count !== 1) {
      console.error('[sauvegarderVisibilite] update failed', error, { count })
      throw new Error('update failed')
    }
  }

  async function annulerMasquage() {
    bandeauVisRef.current?.animateOut(() => setBandeauVisMsg(''))
    setVisibleCandidatheque(true)
    try {
      await sauvegarderVisibilite(true)
    } catch {
      setVisibleCandidatheque(false)
      showBandeau("La réactivation n'a pas abouti. Veuillez réessayer.")
      return
    }
    showBandeau('Vous apparaissez de nouveau dans la candidathèque.')
  }

  async function changerVisibilite(val: boolean) {
    setVisibleCandidatheque(val)
    try {
      await sauvegarderVisibilite(val)
    } catch {
      setVisibleCandidatheque(!val)
      throw new Error('save failed')
    }
    if (!val) {
      showBandeauVis("Vous n'apparaissez plus dans la candidathèque.", {
        libelle: 'Annuler',
        onClick: annulerMasquage,
      })
    }
  }

  async function sauvegarderNotif(col: string, val: boolean) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('no user')
    const { error, count } = await supabase.from('profils').update(
      { [col]: val },
      { count: 'exact' }
    ).eq('user_id', user.id)
    if (error || count !== 1) {
      console.error('[sauvegarderNotif] update failed', error, { col, count })
      throw new Error('update failed')
    }
  }

  function saveNotif(col: string, val: boolean, setter: (v: boolean) => void): Promise<void> {
    setter(val)
    return sauvegarderNotif(col, val).catch(() => {
      setter(!val)
      throw new Error('save failed')
    })
  }

  function fermerSuppressionModal() {
    const fen   = suppressionFenetreRef.current
    const voile = suppressionVoileRef.current
    function cleanup() {
      setSuppressionModalOuverte(false)
      setConfirmationSuppression('')
      setSuppressionErreur('')
      requestAnimationFrame(() => suppressionOuvreurRef.current?.focus())
    }
    if (!fen || !voile || reduitMouvement()) { cleanup(); return }
    voile.getAnimations().forEach(a => a.cancel())
    fen.getAnimations().forEach(a => a.cancel())
    voile.animate([{ opacity: '1' }, { opacity: '0' }], { duration: 180, easing: 'ease-in' })
    const anim = fen.animate(
      [
        { opacity: '1', transform: 'translateY(0) scale(1)' },
        { opacity: '0', transform: 'translateY(8px) scale(1)' },
      ],
      { duration: 180, easing: 'ease-in' },
    )
    anim.onfinish = cleanup
  }

  function piegerFocusSuppression(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === 'Escape') { fermerSuppressionModal(); return }
    if (e.key !== 'Tab') return
    const sel = 'button:not([disabled]),input,[href],[tabindex]:not([tabindex="-1"])'
    const focusables = Array.from(
      suppressionFenetreRef.current?.querySelectorAll<HTMLElement>(sel) ?? []
    )
    if (focusables.length === 0) return
    const first = focusables[0] as HTMLElement
    const last  = focusables[focusables.length - 1] as HTMLElement
    if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
      e.preventDefault()
      ;(e.shiftKey ? last : first).focus()
    }
  }

  async function supprimerCompte() {
    setSuppressionErreur('')
    setSuppressionEnCours(true)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) {
      setSuppressionErreur("La suppression n'a pas abouti. Veuillez réessayer ou écrire à contact@kapolia.com.")
      setSuppressionEnCours(false)
      return
    }
    try {
      const res = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error('[ParametresCandidat] suppression compte', body)
        setSuppressionErreur("La suppression n'a pas abouti. Veuillez réessayer ou écrire à contact@kapolia.com.")
        setSuppressionEnCours(false)
        return
      }
    } catch (err) {
      console.error('[ParametresCandidat] suppression compte réseau', err)
      setSuppressionErreur("La suppression n'a pas abouti. Veuillez réessayer ou écrire à contact@kapolia.com.")
      setSuppressionEnCours(false)
      return
    }
    await supabase.auth.signOut()
    router.replace('/')
  }

  // ── Desktop TOC sidebar ───────────────────────────────────────────────────────

  const tocSidebar = !isMobile && (
    <div ref={tocRef} style={{ width: 200, flexShrink: 0, position: 'sticky', top: 40, alignSelf: 'flex-start' }}>
      <h1 style={{ margin: '0 0 22px', fontSize: 28, fontWeight: 700, color: C.dark, fontFamily: FONT_SANS, letterSpacing: '-0.01em', lineHeight: 1.15 }}>
        Paramètres
      </h1>
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, top: pillTop, height: pillHeight,
          backgroundColor: C.white, borderRadius: 9, boxShadow: CARD_SHADOW,
          borderLeft: `3px solid ${C.orange}`,
          transition: 'top 250ms cubic-bezier(.3,.7,.4,1), height 250ms cubic-bezier(.3,.7,.4,1)',
          pointerEvents: 'none', zIndex: 0,
        }} />
        {SECTIONS.map(s => (
          <button key={s.id} type="button" data-toc-link={s.id} onClick={() => scrollTo(s.id)} style={{
            display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
            padding: `${LINK_PADDING_V}px ${LINK_PADDING_H}px`, borderRadius: 9, fontSize: 14.5,
            fontWeight: activeId === s.id ? 600 : 500, color: activeId === s.id ? C.dark : C.grey,
            cursor: 'pointer', fontFamily: FONT_SANS, position: 'relative', zIndex: 1, transition: 'color 180ms',
          }}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )

  // ── Mobile TOC bar ────────────────────────────────────────────────────────────

  const mobileTocBar = isMobile && (
    <div style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: C.bg, paddingBottom: 8 }}>
      <h1 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 700, color: C.dark, fontFamily: FONT_SANS, letterSpacing: '-0.01em' }}>
        Paramètres
      </h1>
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
        {SECTIONS.map(s => (
          <button key={s.id} type="button" onClick={() => scrollTo(s.id)} style={{
            flexShrink: 0, background: activeId === s.id ? C.white : 'transparent', border: 'none',
            borderRadius: 9, boxShadow: activeId === s.id ? CARD_SHADOW : undefined,
            padding: '7px 12px', fontSize: 13.5,
            fontWeight: activeId === s.id ? 600 : 500, color: activeId === s.id ? C.dark : C.grey,
            cursor: 'pointer', fontFamily: FONT_SANS, whiteSpace: 'nowrap', transition: 'background 180ms, color 180ms',
          }}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )

  // ── Section Compte ────────────────────────────────────────────────────────────

  const LIEN_GRIS: React.CSSProperties = {
    background: 'none', border: 'none', fontSize: 14, fontWeight: 500,
    color: C.grey, cursor: 'pointer', fontFamily: FONT_SANS, padding: 0,
  }
  const BTN_PRINCIPAL: React.CSSProperties = {
    backgroundColor: C.orange, color: C.white, border: 'none', borderRadius: 10,
    padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FONT_SANS,
  }
  const BTN_SECONDAIRE: React.CSSProperties = {
    backgroundColor: C.white, color: C.dark, border: `1.5px solid ${C.sable}`,
    borderRadius: 10, padding: '9px 16px', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: FONT_SANS, whiteSpace: 'nowrap',
  }

  const { niveau: niveauMdp, conseil: conseilMdp } = evaluerMotDePasse(pwdNew, email)
  const pwdDisabled = niveauMdp < NIVEAU_MIN_MOT_DE_PASSE || pwdSaving

  const compteContent = (
    <CarteReglages>

      {/* ── Email ── */}
      <div style={{ padding: '18px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: C.dark, fontFamily: FONT_SANS }}>
                Adresse e-mail
              </span>
              {!chargement && (
                <span style={{
                  fontSize: 12.5, fontWeight: 600,
                  color:           emailConfirme ? C.succes : C.attenteTexte,
                  backgroundColor: emailConfirme ? C.succesBgPale : C.attenteBgPale,
                  borderRadius: 7, padding: '2px 8px',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  animation: pillBouncing
                    ? 'kapolia-pill-bounce 400ms cubic-bezier(.3,1.6,.5,1) forwards'
                    : undefined,
                }}>
                  {emailConfirme && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {emailConfirme ? 'Confirmée' : 'Non confirmée'}
                </span>
              )}
            </div>
            {chargement
              ? <div style={{ height: 16, width: 180, borderRadius: 4, backgroundColor: C.chip }} />
              : <div style={{ fontSize: 14.5, color: C.dark }}>{email}</div>
            }

            {/* Encadré changement en attente */}
            {!chargement && emailPendingNew && !emailFormOpen && (
              <div style={{ marginTop: 12, backgroundColor: C.salaire, borderRadius: 10, padding: '12px 14px', fontSize: 14, color: C.dark, lineHeight: 1.5 }}>
                {"Un lien a été envoyé à "}
                <span style={{ fontWeight: 600, color: C.dark }}>{emailPendingNew}</span>
                {". Cliquez dessus pour valider le changement. Votre adresse actuelle reste active d'ici là."}
                <div style={{ marginTop: 8, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  {emailChangeResendCooldown > 0 || emailChangeResend ? (
                    <span style={{ fontSize: 13.5, color: C.grey }}>
                      {emailChangeResend
                        ? 'Envoi en cours…'
                        : `Lien envoyé · nouvel envoi dans ${emailChangeResendCooldown} s`}
                    </span>
                  ) : (
                    <LienAction onClick={renvoyerChangementEmail}>Renvoyer le lien</LienAction>
                  )}
                  <LienAction onClick={() => {
                    setEmailNew(''); setEmailNewError('')
                    setEmailPwdInput(''); setEmailPwdError('')
                    setEmailFormOpen(true)
                  }}>
                    Utiliser une autre adresse
                  </LienAction>
                </div>
              </div>
            )}
          </div>

          {!emailFormOpen && !emailPendingNew && !chargement && (
            <LienAction onClick={() => {
              setEmailNew(''); setEmailNewError('')
              setEmailPwdInput(''); setEmailPwdError('')
              setEmailFormOpen(true)
            }}>
              Modifier
            </LienAction>
          )}
        </div>

        {/* Formulaire de changement d'adresse */}
        {emailFormOpen && (
          <div ref={el => {
            if (!el || el.dataset.entered) return
            el.dataset.entered = '1'
            if (reduitMouvement()) return
            el.style.opacity = '0'
            el.style.transform = 'translateY(-4px)'
            requestAnimationFrame(() => {
              el.style.transition = 'opacity 220ms, transform 220ms'
              el.style.opacity = '1'
              el.style.transform = 'translateY(0)'
            })
          }} style={{ marginTop: 16 }}>
            <div style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <AuthField
                label="Nouvelle adresse e-mail"
                type="email"
                value={emailNew}
                onChange={v => { setEmailNew(v); setEmailNewError('') }}
                autoComplete="email"
                error={!!emailNewError}
                shake={emailNewShake}
              >
                <ErreurDepliable message={emailNewError} />
              </AuthField>
              {!isGoogle && (
                <AuthField
                  label="Votre mot de passe actuel"
                  type="password"
                  value={emailPwdInput}
                  onChange={v => { setEmailPwdInput(v); setEmailPwdError('') }}
                  placeholder="Pour confirmer que c'est bien vous"
                  autoComplete="current-password"
                  error={!!emailPwdError}
                  shake={emailPwdShake}
                >
                  <ErreurDepliable message={emailPwdError} />
                </AuthField>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={emailChangeSaving}
                  onClick={envoyerChangementEmail}
                  style={{ ...BTN_PRINCIPAL, opacity: emailChangeSaving ? 0.65 : 1, cursor: emailChangeSaving ? 'default' : 'pointer' }}
                >
                  {emailChangeSaving ? 'Envoi…' : 'Envoyer le lien de confirmation'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailFormOpen(false)
                    setEmailNew(''); setEmailNewError('')
                    setEmailPwdInput(''); setEmailPwdError('')
                  }}
                  style={LIEN_GRIS}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ height: 1, backgroundColor: C.sable, margin: '0 22px' }} />

      {/* ── Téléphone ── */}
      <div style={{ padding: '18px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.dark, fontFamily: FONT_SANS }}>
              Numéro de téléphone
            </div>
            <div style={{ fontSize: 13.5, color: C.grey, lineHeight: 1.5, marginTop: 2 }}>
              {"Facultatif. Vous choisissez de l'afficher ou non sur votre Portrait PDF au moment de l'export. Il n'apparaît jamais dans la candidathèque."}
            </div>
            {!phoneOpen && !chargement && (
              <div style={{ fontSize: 14.5, color: telephone ? C.dark : C.grey, marginTop: 6 }}>
                {telephone || 'Aucun numéro'}
              </div>
            )}
          </div>
          {!phoneOpen && !chargement && (
            <LienAction onClick={() => {
              setPhoneInput(telephone)
              setPhoneOpen(true)
              setPhoneError('')
              setPhoneShake(false)
            }}>
              {telephone ? 'Modifier' : 'Ajouter'}
            </LienAction>
          )}
        </div>

        {phoneOpen && (
          <div ref={el => {
            if (!el || el.dataset.entered) return
            el.dataset.entered = '1'
            if (reduitMouvement()) return
            el.style.opacity = '0'
            el.style.transform = 'translateY(-4px)'
            requestAnimationFrame(() => {
              el.style.transition = 'opacity 220ms, transform 220ms'
              el.style.opacity = '1'
              el.style.transform = 'translateY(0)'
            })
          }} style={{ marginTop: 16 }}>
            <div style={{ maxWidth: 420 }}>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phoneInput}
                onChange={e => { setPhoneInput(formaterTelephone(e.target.value)); setPhoneError('') }}
                placeholder="06 12 34 56 78"
                style={{
                  width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 10,
                  border: `1.5px solid ${phoneError ? C.erreur : C.sable}`,
                  backgroundColor: C.white, color: C.dark, outline: 'none',
                  boxSizing: 'border-box', fontFamily: FONT_SANS, transition: 'border-color 150ms',
                  animation: phoneShake ? 'kapolia-shake 350ms ease' : undefined,
                }}
              />
              {phoneError && (
                <div style={{
                  marginTop: 6, padding: '8px 12px', borderRadius: 8,
                  backgroundColor: 'rgba(192,57,43,.08)', border: `1px solid ${C.erreur}30`,
                  color: C.erreur, fontSize: 13,
                }}>
                  {phoneError}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={phoneSaving}
                  onClick={() => enregistrerTelephone(phoneInput)}
                  style={{ ...BTN_PRINCIPAL, opacity: phoneSaving ? 0.65 : 1, cursor: phoneSaving ? 'default' : 'pointer' }}
                >
                  {phoneSaving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button
                  type="button"
                  onClick={() => { setPhoneOpen(false); setPhoneInput(''); setPhoneError('') }}
                  style={LIEN_GRIS}
                >
                  Annuler
                </button>
                {telephone && (
                  <button
                    type="button"
                    disabled={phoneSaving}
                    onClick={() => enregistrerTelephone('')}
                    style={{ ...LIEN_GRIS, marginLeft: 'auto' }}
                  >
                    Retirer le numéro
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Partage du numéro aux candidatures ── */}
      <div style={{ height: 1, backgroundColor: C.sable, margin: '0 22px' }} />
      <div style={{ padding: '18px 22px', opacity: telephone ? 1 : 0.45 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.dark, fontFamily: FONT_SANS }}>
              Joindre mon numéro à mes candidatures
            </div>
            <div style={{ fontSize: 13.5, color: C.grey, lineHeight: 1.5, marginTop: 2 }}>
              {telephone
                ? "Les entreprises où vous postulez le voient avec votre profil et peuvent vous appeler. Sinon, elles vous écrivent par la messagerie."
                : "Les entreprises où vous postulez le voient avec votre profil et peuvent vous appeler. Sinon, elles vous écrivent par la messagerie. Ajoutez d'abord un numéro."}
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <Interrupteur
              checked={telephoneCandidatures}
              onChange={val => saveNotif('telephone_candidatures', val, setTelephoneCandidatures)}
              disabled={!telephone}
            />
          </div>
        </div>
      </div>

    </CarteReglages>
  )

  // ── Section Connexion et sécurité ────────────────────────────────────────────

  const securiteContent = (
    <CarteReglages>

      {/* ── Mot de passe / Mode de connexion ── */}
      <div style={{ padding: '18px 22px' }}>
        {chargement ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ width: 110, height: 14, borderRadius: 4, backgroundColor: C.chip }} />
            <div style={{ width: 80, height: 13, borderRadius: 4, backgroundColor: C.chip }} />
          </div>
        ) : !isGoogle ? (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.dark, fontFamily: FONT_SANS }}>
                  Mot de passe
                </div>
                {!pwdFormOpen && (
                  <div style={{ letterSpacing: 2, color: C.grey, marginTop: 4, fontSize: 15 }}>
                    ••••••••••
                  </div>
                )}
              </div>
              {!pwdFormOpen && (
                <LienAction onClick={() => setPwdFormOpen(true)}>Modifier</LienAction>
              )}
            </div>

            {pwdFormOpen && (
              <div ref={el => {
                if (!el || el.dataset.entered) return
                el.dataset.entered = '1'
                if (reduitMouvement()) return
                el.style.opacity = '0'
                el.style.transform = 'translateY(-4px)'
                requestAnimationFrame(() => {
                  el.style.transition = 'opacity 220ms, transform 220ms'
                  el.style.opacity = '1'
                  el.style.transform = 'translateY(0)'
                })
              }} style={{ marginTop: 16 }}>
                <div style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <AuthField
                    label="Mot de passe actuel"
                    type="password"
                    value={pwdOld}
                    onChange={v => { setPwdOld(v); setPwdOldError('') }}
                    autoComplete="current-password"
                    error={!!pwdOldError}
                    shake={pwdOldShake}
                  >
                    <ErreurDepliable message={pwdOldError} />
                  </AuthField>
                  <AuthField
                    label="Nouveau mot de passe"
                    type="password"
                    value={pwdNew}
                    onChange={v => { setPwdNew(v); setPwdNewError('') }}
                    placeholder="8 caractères minimum"
                    autoComplete="new-password"
                    error={!!pwdNewError}
                    shake={pwdNewShake}
                  >
                    <BarreRobustesse niveau={niveauMdp} conseil={conseilMdp} />
                    <ErreurDepliable message={pwdNewError} />
                  </AuthField>
                  <AuthField
                    label="Confirmer le nouveau mot de passe"
                    type="password"
                    value={pwdConfirm}
                    onChange={v => { setPwdConfirm(v); setPwdConfirmError('') }}
                    autoComplete="new-password"
                    error={!!pwdConfirmError}
                    shake={pwdConfirmShake}
                  >
                    <ErreurDepliable message={pwdConfirmError} />
                  </AuthField>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={pwdDisabled}
                      onClick={modifierMotDePasse}
                      style={{ ...BTN_PRINCIPAL, opacity: pwdDisabled ? 0.4 : 1, cursor: pwdDisabled ? 'default' : 'pointer' }}
                    >
                      {pwdSaving ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPwdFormOpen(false); resetPwdForm() }}
                      style={LIEN_GRIS}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.dark, fontFamily: FONT_SANS }}>
                  Mode de connexion
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  {GOOGLE_LOGO}
                  <span style={{ fontSize: 14.5, color: C.dark }}>Google, {email}</span>
                </div>
                <div style={{ fontSize: 13.5, color: C.grey, lineHeight: 1.5, marginTop: 8 }}>
                  {"Vous vous connectez avec votre compte Google. Ajoutez un mot de passe si vous souhaitez aussi pouvoir vous connecter avec votre adresse e-mail."}
                </div>
              </div>
              {!pwdFormOpen && (
                <LienAction onClick={() => setPwdFormOpen(true)}>Ajouter un mot de passe</LienAction>
              )}
            </div>

            {pwdFormOpen && (
              <div ref={el => {
                if (!el || el.dataset.entered) return
                el.dataset.entered = '1'
                if (reduitMouvement()) return
                el.style.opacity = '0'
                el.style.transform = 'translateY(-4px)'
                requestAnimationFrame(() => {
                  el.style.transition = 'opacity 220ms, transform 220ms'
                  el.style.opacity = '1'
                  el.style.transform = 'translateY(0)'
                })
              }} style={{ marginTop: 16 }}>
                <div style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <AuthField
                    label="Nouveau mot de passe"
                    type="password"
                    value={pwdNew}
                    onChange={v => { setPwdNew(v); setPwdNewError('') }}
                    placeholder="8 caractères minimum"
                    autoComplete="new-password"
                    error={!!pwdNewError}
                    shake={pwdNewShake}
                  >
                    <BarreRobustesse niveau={niveauMdp} conseil={conseilMdp} />
                    <ErreurDepliable message={pwdNewError} />
                  </AuthField>
                  <AuthField
                    label="Confirmer le nouveau mot de passe"
                    type="password"
                    value={pwdConfirm}
                    onChange={v => { setPwdConfirm(v); setPwdConfirmError('') }}
                    autoComplete="new-password"
                    error={!!pwdConfirmError}
                    shake={pwdConfirmShake}
                  >
                    <ErreurDepliable message={pwdConfirmError} />
                  </AuthField>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={pwdDisabled}
                      onClick={modifierMotDePasse}
                      style={{ ...BTN_PRINCIPAL, opacity: pwdDisabled ? 0.4 : 1, cursor: pwdDisabled ? 'default' : 'pointer' }}
                    >
                      {pwdSaving ? 'Ajout en cours…' : 'Ajouter le mot de passe'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPwdFormOpen(false); resetPwdForm() }}
                      style={LIEN_GRIS}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ height: 1, backgroundColor: C.sable, margin: '0 22px' }} />

      {/* ── Appareils connectés ── */}
      <div style={{ padding: '18px 22px' }}>
        <div className="kap-devices-layout" style={{ display: 'flex', alignItems: 'flex-start', gap: 20, justifyContent: 'space-between' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.dark, fontFamily: FONT_SANS }}>
              Appareils connectés
            </div>
            <div style={{ fontSize: 13.5, color: C.grey, lineHeight: 1.5, marginTop: 2 }}>
              {"Si vous vous êtes connecté sur un appareil qui n'est pas le vôtre, vous pouvez fermer toutes les autres sessions. Vous resterez connecté ici."}
            </div>
          </div>
          <button
            type="button"
            className="kap-devices-btn"
            disabled={signoutSaving}
            onClick={deconnecterAutresAppareils}
            style={{ ...BTN_SECONDAIRE, opacity: signoutSaving ? 0.65 : 1, cursor: signoutSaving ? 'default' : 'pointer', flexShrink: 0 }}
          >
            {signoutSaving ? 'Déconnexion…' : 'Déconnecter les autres appareils'}
          </button>
        </div>
      </div>

    </CarteReglages>
  )

  // ── Section Visibilité ───────────────────────────────────────────────────────

  const visibiliteContent = (
    <CarteReglages>
      <div style={{ padding: '0 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 0' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.dark, fontFamily: FONT_SANS }}>
              Apparaître dans la candidathèque
            </div>
            <div style={{ fontSize: 13.5, color: C.grey, marginTop: 3, lineHeight: 1.5 }}>
              {visibleCandidatheque
                ? "Les recruteurs inscrits sur Kapolia peuvent vous trouver et vous contacter."
                : "Seuls les recruteurs que vous contactez en premier peuvent voir votre profil."}
            </div>
          </div>
          <Interrupteur
            checked={visibleCandidatheque}
            onChange={changerVisibilite}
            disabled={!emailConfirme}
          />
        </div>
      </div>
    </CarteReglages>
  )

  // ── Section Notifications ────────────────────────────────────────────────────

  const TITRE_GROUPE: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: C.grey, letterSpacing: '0.07em',
    textTransform: 'uppercase', padding: '16px 0 8px', fontFamily: FONT_SANS,
  }

  const notificationsContent = (
    <>
      <CarteReglages>
        <div style={{ padding: '0 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 0' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.dark, fontFamily: FONT_SANS }}>
                Recevoir des e-mails de Kapolia
              </div>
              <div style={{ fontSize: 13.5, color: C.grey, marginTop: 3, lineHeight: 1.5 }}>
                {"Désactivez pour ne plus rien recevoir, sauf les e-mails liés à la sécurité de votre compte."}
              </div>
            </div>
            <Interrupteur
              checked={emailNotifications}
              onChange={val => saveNotif('email_notifications', val, setEmailNotifications)}
            />
          </div>
        </div>
      </CarteReglages>

      <div style={{ marginTop: 14, opacity: emailNotifications ? 1 : 0.45, transition: 'opacity 200ms' }}>
        <CarteReglages>

          {/* Vos échanges */}
          <div style={{ padding: '0 22px' }}>
            <div style={TITRE_GROUPE}>Vos échanges</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 0' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.dark, fontFamily: FONT_SANS }}>Rendez-vous</div>
                <div style={{ fontSize: 13.5, color: C.grey, marginTop: 3, lineHeight: 1.5 }}>{"Proposition de créneaux, confirmation, annulation."}</div>
              </div>
              <Interrupteur checked={notifRdv} onChange={val => saveNotif('notif_rdv', val, setNotifRdv)} disabled={!emailNotifications} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 0' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.dark, fontFamily: FONT_SANS }}>{"Rappel la veille d'un rendez-vous"}</div>
              </div>
              <Interrupteur checked={notifRappelRdv} onChange={val => saveNotif('notif_rappel_rdv', val, setNotifRappelRdv)} disabled={!emailNotifications} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 0 16px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.dark, fontFamily: FONT_SANS }}>{"Réponse à une candidature"}</div>
                <div style={{ fontSize: 13.5, color: C.grey, marginTop: 3, lineHeight: 1.5 }}>{"Quand un recruteur retient ou ne retient pas votre candidature."}</div>
              </div>
              <Interrupteur checked={notifCandidature} onChange={val => saveNotif('notif_candidature', val, setNotifCandidature)} disabled={!emailNotifications} />
            </div>
          </div>

          <div style={{ height: 1, backgroundColor: C.sable }} />

          {/* Votre profil */}
          <div style={{ padding: '0 22px' }}>
            <div style={TITRE_GROUPE}>Votre profil</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 0 16px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.dark, fontFamily: FONT_SANS }}>{"Un proche a décrit vos qualités"}</div>
              </div>
              <Interrupteur checked={notifProche} onChange={val => saveNotif('notif_proche', val, setNotifProche)} disabled={!emailNotifications} />
            </div>
          </div>

          <div style={{ height: 1, backgroundColor: C.sable }} />

          {/* Votre recherche */}
          <div style={{ padding: '0 22px' }}>
            <div style={TITRE_GROUPE}>Votre recherche</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 0 16px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.dark, fontFamily: FONT_SANS }}>{"Rappels des offres en favori"}</div>
                <div style={{ fontSize: 13.5, color: C.grey, marginTop: 3, lineHeight: 1.5 }}>{"Le lendemain et trois jours après la mise en favori."}</div>
              </div>
              <Interrupteur checked={rappelsFavoris} onChange={val => saveNotif('rappels_favoris', val, setRappelsFavoris)} disabled={!emailNotifications} />
            </div>
          </div>

        </CarteReglages>
      </div>
    </>
  )

  // ── Section Données personnelles ─────────────────────────────────────────────

  const confirmationValide = confirmationSuppression.trim().toLowerCase() === PHRASE_SUPPRESSION

  const donneesContent = (
    <CarteReglages>

      {/* ── Vos droits ── */}
      <div style={{ padding: '0 22px' }}>
        <div style={{ padding: '18px 0' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.dark, fontFamily: FONT_SANS }}>
            Vos droits
          </div>
          <div style={{ fontSize: 13.5, color: C.grey, marginTop: 3, lineHeight: 1.5 }}>
            {'Vous pouvez consulter, corriger, faire effacer ou récupérer vos données. Corrigez-les directement depuis votre profil. Pour le reste, écrivez à '}
            <a
              href="mailto:contact@kapolia.com"
              style={{ color: C.dark, fontWeight: 600, textDecoration: 'none' }}
            >
              contact@kapolia.com
            </a>
            {' : vous recevrez une réponse sous un mois. Vous pouvez aussi saisir la CNIL.'}
          </div>
        </div>
      </div>

      <div style={{ height: 1, backgroundColor: C.sable }} />

      {/* ── Supprimer mon compte ── */}
      <div style={{ padding: '0 22px' }}>
        <div className="kap-delete-row" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 0' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.dark, fontFamily: FONT_SANS }}>
              Supprimer mon compte
            </div>
            <div style={{ fontSize: 13.5, color: C.grey, marginTop: 3, lineHeight: 1.5 }}>
              {'Votre profil, vos candidatures, vos messages et vos fichiers seront effacés définitivement.'}
            </div>
          </div>
          <button
            ref={suppressionOuvreurRef}
            type="button"
            onClick={() => setSuppressionModalOuverte(true)}
            style={{
              flexShrink: 0,
              backgroundColor: C.white,
              color: C.erreur,
              border: `1px solid rgba(192,57,43,.35)`,
              borderRadius: 10,
              padding: '9px 16px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: FONT_SANS,
              whiteSpace: 'nowrap',
            }}
          >
            Supprimer mon compte
          </button>
        </div>
      </div>

    </CarteReglages>
  )

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <style suppressHydrationWarning>{AUTH_STYLES}</style>
      <style suppressHydrationWarning>{`
        [data-parametres-toc-bar]::-webkit-scrollbar { display: none; }
        @keyframes kapolia-pill-bounce {
          from { transform: scale(.6); opacity: 0; }
          to   { transform: scale(1);  opacity: 1; }
        }
        @keyframes kapolia-shake {
          0%, 100% { transform: translateX(0);  }
          20%, 60% { transform: translateX(-5px); }
          40%, 80% { transform: translateX(5px);  }
        }
        @media (max-width: 480px) {
          .kap-banner-layout  { flex-wrap: wrap !important; }
          .kap-banner-btn     { width: 100% !important; margin-top: 8px; }
          .kap-devices-layout { flex-wrap: wrap !important; }
          .kap-devices-btn    { width: 100% !important; margin-top: 8px; }
        }
        @media (max-width: 375px) {
          .kap-delete-row { flex-wrap: wrap !important; }
        }
      `}</style>

      {bandeauMsg && (
        <Bandeau key={bandeauKey} ref={bandeauRef} message={bandeauMsg} fixe />
      )}
      {bandeauVisMsg && (
        <Bandeau
          key={bandeauVisKey}
          ref={bandeauVisRef}
          message={bandeauVisMsg}
          action={bandeauVisAction ?? undefined}
          duree={5000}
          onDismiss={() => setBandeauVisMsg('')}
          fixe
        />
      )}

      {suppressionModalOuverte && (
        <div
          ref={suppressionVoileRef}
          onClick={fermerSuppressionModal}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(21,32,27,.38)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 16px',
          }}
        >
          <div
            ref={suppressionFenetreRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="suppression-titre"
            onClick={e => e.stopPropagation()}
            onKeyDown={piegerFocusSuppression}
            tabIndex={-1}
            style={{
              backgroundColor: C.white,
              borderRadius: 12,
              padding: '26px 28px',
              width: '100%',
              maxWidth: 480,
              boxSizing: 'border-box',
              boxShadow: '0 20px 60px rgba(0,0,0,.18)',
              outline: 'none',
            }}
          >
            <h3
              id="suppression-titre"
              style={{
                margin: '0 0 16px',
                fontSize: 20,
                fontWeight: 700,
                color: C.dark,
                fontFamily: FONT_SANS,
                letterSpacing: '-0.01em',
              }}
            >
              {'Supprimer votre compte ?'}
            </h3>

            <p style={{ margin: '0 0 10px', fontSize: 14, color: C.dark, lineHeight: 1.6, fontFamily: FONT_SANS }}>
              {'Cette action est définitive. Seront effacés :'}
            </p>
            <ul style={{ margin: '0 0 8px', paddingLeft: 20, fontSize: 14, color: C.dark, lineHeight: 1.75, fontFamily: FONT_SANS }}>
              <li>votre profil et votre Portrait</li>
              <li>vos candidatures et vos favoris</li>
              <li>les messages et les fichiers que vous avez envoyés</li>
              <li>les qualités décrites par vos proches</li>
            </ul>
            <p style={{ margin: '0 0 20px', fontSize: 13.5, color: C.grey, lineHeight: 1.5, fontFamily: FONT_SANS }}>
              {'Les recruteurs avec qui vous avez échangé gardent leurs propres messages et rendez-vous, sans lien vers votre profil.'}
            </p>

            {visibleCandidatheque && (
              <div style={{
                backgroundColor: C.salaire,
                borderRadius: 10,
                padding: '12px 14px',
                marginBottom: 20,
                fontSize: 14,
                color: C.dark,
                lineHeight: 1.55,
                fontFamily: FONT_SANS,
              }}>
                {'Vous voulez seulement faire une pause dans votre recherche ? '}
                <button
                  type="button"
                  onClick={() => {
                    fermerSuppressionModal()
                    changerVisibilite(false).catch(() => {
                      showBandeau("Le réglage n'a pas pu être enregistré. Veuillez réessayer.")
                    })
                  }}
                  style={{
                    color: C.orangeTexte,
                    fontWeight: 600,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontFamily: FONT_SANS,
                    fontSize: 14,
                    textDecoration: 'underline',
                  }}
                >
                  {'Retirez-vous de la candidathèque'}
                </button>
                {' et gardez votre profil pour plus tard.'}
              </div>
            )}

            <label
              htmlFor="suppression-confirmation"
              style={{
                display: 'block',
                fontSize: 14,
                color: C.dark,
                marginBottom: 8,
                fontFamily: FONT_SANS,
                lineHeight: 1.4,
              }}
            >
              {`Pour confirmer, tapez « supprimer mon compte »`}
            </label>
            <input
              id="suppression-confirmation"
              ref={suppressionInputRef}
              type="text"
              value={confirmationSuppression}
              onChange={e => { setConfirmationSuppression(e.target.value); setSuppressionErreur('') }}
              onKeyDown={e => { if (e.key === 'Enter' && confirmationValide && !suppressionEnCours) supprimerCompte() }}
              disabled={suppressionEnCours}
              autoComplete="off"
              spellCheck={false}
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: 14,
                borderRadius: 10,
                border: `1.5px solid ${C.sable}`,
                backgroundColor: C.white,
                color: C.dark,
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: FONT_SANS,
              }}
            />

            {suppressionErreur && (
              <div style={{
                marginTop: 12,
                padding: '10px 14px',
                borderRadius: 8,
                backgroundColor: 'rgba(192,57,43,.08)',
                border: `1px solid rgba(192,57,43,.3)`,
                color: C.erreur,
                fontSize: 13.5,
                lineHeight: 1.4,
                fontFamily: FONT_SANS,
              }}>
                {suppressionErreur}
              </div>
            )}

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 12,
              marginTop: 20,
              flexWrap: 'wrap',
            }}>
              <button
                type="button"
                onClick={fermerSuppressionModal}
                disabled={suppressionEnCours}
                style={{
                  ...BTN_SECONDAIRE,
                  opacity: suppressionEnCours ? 0.65 : 1,
                  cursor: suppressionEnCours ? 'default' : 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!confirmationValide || suppressionEnCours}
                onClick={supprimerCompte}
                style={{
                  backgroundColor: C.erreur,
                  color: C.white,
                  border: 'none',
                  borderRadius: 10,
                  padding: '9px 20px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: confirmationValide && !suppressionEnCours ? 'pointer' : 'default',
                  fontFamily: FONT_SANS,
                  opacity: confirmationValide ? 1 : 0.45,
                  transition: 'opacity 150ms',
                }}
              >
                {suppressionEnCours ? 'Suppression …' : 'Supprimer définitivement'}
              </button>
            </div>

          </div>
        </div>
      )}

      <div ref={containerRef} style={{
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        gap: 40, maxWidth: 1040, margin: '0 auto',
        padding: isMobile ? '24px 16px' : '40px 32px', paddingBottom: 420,
        boxSizing: 'border-box', fontFamily: FONT_SANS,
      }}>
        {tocSidebar}
        {mobileTocBar}

        <div style={{ flex: 1, minWidth: 0, paddingTop: isMobile ? 0 : 58 }}>

          {/* Encadré email non confirmé */}
          {!chargement && !emailConfirme && !bannerHidden && (
            <div ref={bannerRef} style={{ marginBottom: 28 }}>
              <div style={{
                backgroundColor: C.white, boxShadow: CARD_SHADOW, borderRadius: CARD_RADIUS,
                borderLeft: `3px solid ${C.attente}`, padding: '16px 20px',
              }}>
                <div className="kap-banner-layout" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
                }}>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: C.dark, marginBottom: 4, fontFamily: FONT_SANS }}>
                      {"Votre adresse e-mail n'est pas confirmée."}
                    </div>
                    <div style={{ fontSize: 14.5, color: C.grey, lineHeight: 1.5 }}>
                      {"Tant qu'elle ne l'est pas, vous n'apparaissez pas dans la candidathèque et les recruteurs ne peuvent pas vous écrire."}
                    </div>
                  </div>
                  {resendCooldown > 0 || resendEnvoi ? (
                    <span style={{ fontSize: 14, color: C.grey, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {resendEnvoi
                        ? 'Envoi en cours…'
                        : `Lien envoyé, nouvel envoi possible dans ${resendCooldown} s`}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="kap-banner-btn"
                      onClick={renvoyerConfirmation}
                      style={{ ...BTN_PRINCIPAL, flexShrink: 0 }}
                    >
                      Renvoyer le lien
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {SECTIONS.map(s => (
            <section
              key={s.id}
              id={s.id}
              ref={el => { sectionRefs.current[s.id] = el }}
              style={{ marginBottom: 36, scrollMarginTop: 24 }}
            >
              <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: C.dark, fontFamily: FONT_SANS, letterSpacing: '-0.005em' }}>
                {s.titre}
              </h2>
              <p style={{ margin: '0 0 14px', fontSize: 14, color: C.grey, lineHeight: 1.5 }}>
                {s.sous}
              </p>
              {s.id === 'compte' ? compteContent
                : s.id === 'securite' ? securiteContent
                : s.id === 'visibilite' ? visibiliteContent
                : s.id === 'notifications' ? notificationsContent
                : donneesContent
              }
            </section>
          ))}

        </div>
      </div>
    </>
  )
}
