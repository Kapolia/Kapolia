'use client'

/*
  SQL — Supabase SQL Editor (migrations) :

  ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS piece_jointe_url  text,
    ADD COLUMN IF NOT EXISTS piece_jointe_nom  text,
    ADD COLUMN IF NOT EXISTS piece_jointe_type text,
    ADD COLUMN IF NOT EXISTS reply_to_id       uuid references public.messages(id) on delete set null;

  CREATE TABLE IF NOT EXISTS public.reactions (
    id         uuid primary key default gen_random_uuid(),
    message_id uuid references public.messages(id)  on delete cascade,
    user_id    uuid references auth.users(id)        on delete cascade,
    emoji      text not null,
    UNIQUE(message_id, user_id, emoji)
  );
  ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Accès reactions" ON public.reactions
    FOR ALL USING (true) WITH CHECK (auth.uid() = user_id);

  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
*/

import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { KeyboardEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import GlobalAvatar, { type AvatarProfil } from '@/components/Avatar'

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  terracotta: '#C4673A',
  sable:      '#E8D5B7',
  creme:      '#F7F2EB',
  vert:       '#2C4A3E',
  dark:       '#1A1A1A',
  grey:       '#6B6B6B',
  lightGrey:  '#C8C8C8',
  white:      '#FFFFFF',
}

const IMAGE_EXTS  = new Set(['jpg','jpeg','png','gif','webp','bmp','svg'])
const MAX_BYTES   = 10 * 1024 * 1024
const QUICK_EMOJIS = ['👍','❤️','😄','🎉','👏','✅']

function isImage(nom: string) {
  return IMAGE_EXTS.has(nom.split('.').pop()?.toLowerCase() ?? '')
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ReactionData = { emoji: string; count: number; mine: boolean }
type ReplyRef     = { id: string; contenu: string; fromMe: boolean }

type LocalConv = {
  id: string; recruteurId?: string
  nom: string; initiales: string; avatarBg: string
  entreprise: string; offreTitre: string; offreId?: string
  dernierMsg: string; derniereHeure: string
  nonLu: number; epinglee: boolean
}

type LocalMsg = {
  id: string; fromMe: boolean; contenu: string; heure: string; lu: boolean
  pjUrl?: string; pjNom?: string; pjType?: string
  replyToId?: string; replyToContenu?: string
  reactions: ReactionData[]
}

// ─── Fictitious data ──────────────────────────────────────────────────────────

const FICT_CONVS: LocalConv[] = [
  { id: 'fc1', nom: 'Julien Renard',  initiales: 'AS', avatarBg: C.vert,    entreprise: 'Acme Studio',       offreTitre: 'Lead UX Designer',        dernierMsg: "Jeudi 10h me convient parfaitement !", derniereHeure: '10:42', nonLu: 0, epinglee: true  },
  { id: 'fc2', nom: 'Clara Fontaine', initiales: 'MF', avatarBg: '#7B5EA7', entreprise: 'Méta France',        offreTitre: 'Product Manager Senior',  dernierMsg: "Avez-vous des disponibilités ?",       derniereHeure: 'Hier',  nonLu: 2, epinglee: false },
  { id: 'fc3', nom: 'Pierre Morel',   initiales: 'LD', avatarBg: '#5A6E7B', entreprise: 'Lighthouse Digital', offreTitre: 'Développeur React Senior', dernierMsg: "Votre profil est excellent !",         derniereHeure: 'Jeu.',  nonLu: 1, epinglee: false },
  { id: 'fc4', nom: 'Nadia Benali',   initiales: 'SB', avatarBg: '#8E6E5A', entreprise: 'StartupBuilder',     offreTitre: 'CTO Co-Fondateur',        dernierMsg: "Bientôt disponible…",                 derniereHeure: 'Lun.',  nonLu: 0, epinglee: false },
]

const FICT_MSGS: Record<string, LocalMsg[]> = {
  'fc1': [
    { id: 'f1m1', fromMe: false, lu: true,  heure: '09:15', contenu: "Bonjour ! Votre profil correspond exactement à notre poste de Lead UX Designer.", reactions: [{ emoji:'👍', count:1, mine:true }] },
    { id: 'f1m2', fromMe: true,  lu: true,  heure: '09:30', contenu: "Bonjour Julien, merci beaucoup ! Acme Studio est une entreprise que j'admire vraiment.", reactions: [] },
    { id: 'f1m3', fromMe: false, lu: true,  heure: '10:00', contenu: "Seriez-vous disponible pour un entretien cette semaine ?", reactions: [] },
    { id: 'f1m4', fromMe: true,  lu: true,  heure: '10:25', contenu: "Oui bien sûr ! Jeudi ou vendredi matin, selon vos préférences.", reactions: [] },
    { id: 'f1m5', fromMe: false, lu: true,  heure: '10:38', contenu: "Jeudi 10h en visio avec notre CPO — 45 minutes. Ça vous convient ?", replyToId: 'f1m4', replyToContenu: "Oui bien sûr ! Jeudi ou vendredi matin, selon vos préférences.", reactions: [] },
    { id: 'f1m6', fromMe: true,  lu: false, heure: '10:42', contenu: "Jeudi 10h me convient parfaitement ! Merci, à jeudi !", reactions: [{ emoji:'🎉', count:1, mine:false }] },
  ],
  'fc2': [
    { id: 'f2m1', fromMe: false, lu: true,  heure: 'Hier 11:30', contenu: "Bonjour, je me permets de vous contacter suite à la lecture de votre profil.", reactions: [] },
    { id: 'f2m2', fromMe: false, lu: false, heure: 'Hier 11:32', contenu: "Avez-vous des disponibilités pour échanger la semaine prochaine ?", reactions: [] },
  ],
  'fc3': [
    { id: 'f3m1', fromMe: false, lu: true,  heure: 'Jeu. 08:50', contenu: "Votre profil est excellent — la combinaison React + accessibilité est très rare !", reactions: [{ emoji:'🎉', count:1, mine:false }] },
    { id: 'f3m2', fromMe: true,  lu: true,  heure: 'Jeu. 09:00', contenu: "Merci Pierre ! Je serais ravi d'en savoir plus sur Lighthouse Digital.", reactions: [] },
    { id: 'f3m3', fromMe: false, lu: false, heure: 'Jeu. 10:12', contenu: "Votre profil est excellent ! Je vous envoie une invitation sous 24h.", reactions: [] },
  ],
  'fc4': [
    { id: 'f4m1', fromMe: false, lu: true,  heure: 'Lun. 14:00', contenu: "Bonjour ! Nous construisons quelque chose d'unique, j'aimerais vous en parler.", reactions: [] },
    { id: 'f4m2', fromMe: true,  lu: true,  heure: 'Lun. 15:00', contenu: "Intéressant ! Dites m'en plus sur le projet.", reactions: [] },
    { id: 'f4m3', fromMe: false, lu: true,  heure: 'Lun. 15:30', contenu: "Je reviens vers vous avec plus de détails bientôt.", reactions: [] },
  ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowHeure() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function initEntreprise(nom: string): string {
  if (!nom) return '?'
  const words = nom.trim().split(/\s+/)
  if (words.length === 1) return nom.slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

// ─── ConvAvatar (recruteur) ───────────────────────────────────────────────────

function ConvAvatar({ i, bg, s = 38 }: { i: string; bg: string; s?: number }) {
  return (
    <div style={{ width: s, height: s, borderRadius: '50%', backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', fontSize: s * 0.33, color: C.white, flexShrink: 0 }}>
      {i}
    </div>
  )
}

// ─── Double checkmarks ────────────────────────────────────────────────────────

function Checks({ lu }: { lu: boolean }) {
  const col = lu ? C.terracotta : C.lightGrey
  return (
    <svg width="18" height="11" viewBox="0 0 18 11" fill="none" style={{ flexShrink: 0 }}>
      <polyline points="1,6 4,9 9,2"  stroke={col} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="6,6 9,9 14,2" stroke={col} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── File bubble ──────────────────────────────────────────────────────────────

function FileBubble({ nom, url, type, fromMe }: { nom: string; url?: string; type?: string; fromMe: boolean }) {
  if ((type === 'image' || isImage(nom)) && url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" style={{ display: 'block', maxWidth: 220, borderRadius: 12, overflow: 'hidden' }}>
        <img src={url} alt={nom} style={{ width: '100%', display: 'block' }} />
      </a>
    )
  }
  return (
    <a href={url ?? '#'} target="_blank" rel="noreferrer"
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, backgroundColor: fromMe ? 'rgba(255,255,255,0.15)' : C.creme, border: `1px solid ${fromMe ? 'rgba(255,255,255,0.2)' : C.sable}`, textDecoration: 'none', maxWidth: 260, cursor: url ? 'pointer' : 'default' }}>
      <span style={{ fontSize: 20 }}>📄</span>
      <span style={{ fontSize: 12, color: fromMe ? 'rgba(255,255,255,0.9)' : C.dark, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nom}</span>
      {url && <span style={{ fontSize: 11, color: fromMe ? 'rgba(255,255,255,0.7)' : C.terracotta, fontWeight: 600, flexShrink: 0 }}>Télécharger</span>}
    </a>
  )
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator({ nom }: { nom: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 8px' }}>
      <div style={{ display: 'flex', gap: 3 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: C.grey, animation: `kavio-bounce 1.2s ${i * 0.2}s infinite` }} />
        ))}
      </div>
      <span style={{ fontSize: 12, color: C.grey, fontStyle: 'italic' }}>{nom} est en train d'écrire…</span>
    </div>
  )
}

// ─── Action btn (hover) ───────────────────────────────────────────────────────

function ActionBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ width: 26, height: 26, borderRadius: 8, border: 'none', backgroundColor: h ? C.sable : C.creme, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
      {children}
    </button>
  )
}

// ─── Reply preview bar ────────────────────────────────────────────────────────

function ReplyBar({ reply, nom, onCancel }: { reply: ReplyRef; nom: string; onCancel: () => void }) {
  return (
    <div style={{ padding: '8px 14px', borderTop: `1px solid ${C.sable}`, borderLeft: `3px solid ${C.terracotta}`, backgroundColor: `${C.terracotta}08`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: C.terracotta, fontWeight: 700, marginBottom: 2 }}>
          ↩ Répondre à {reply.fromMe ? 'votre message' : nom}
        </div>
        <div style={{ fontSize: 12, color: C.grey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {reply.contenu || '📎 Pièce jointe'}
        </div>
      </div>
      <button onClick={onCancel} style={{ border: 'none', backgroundColor: 'transparent', color: C.grey, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 2 }}>✕</button>
    </div>
  )
}

// ─── Reaction picker ──────────────────────────────────────────────────────────

function ReactionPicker({ pos, onPick, onClose }: { pos: { top: number; left: number }; onPick: (e: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])
  return (
    <div ref={ref} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 350, backgroundColor: C.white, border: `1px solid ${C.sable}`, borderRadius: 14, padding: '6px 8px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', display: 'flex', gap: 2, animation: 'kavio-dd 0.1s ease' }}>
      {QUICK_EMOJIS.map(emoji => {
        const [h, setH] = useState(false)
        return (
          <button key={emoji} onClick={() => { onPick(emoji); onClose() }}
            onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
            style={{ border: 'none', backgroundColor: h ? C.creme : 'transparent', fontSize: 20, cursor: 'pointer', padding: '4px 5px', borderRadius: 8, transition: 'background-color 0.1s' }}>
            {emoji}
          </button>
        )
      })}
    </div>
  )
}

// ─── Reactions bar ────────────────────────────────────────────────────────────

function ReactionsBar({ reactions, onToggle }: { reactions: ReactionData[]; onToggle: (e: string) => void }) {
  if (!reactions.length) return null
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
      {reactions.filter(r => r.count > 0).map(r => (
        <button key={r.emoji} onClick={() => onToggle(r.emoji)}
          style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 10, border: `1px solid ${r.mine ? C.terracotta : C.sable}`, backgroundColor: r.mine ? `${C.terracotta}15` : C.white, cursor: 'pointer', fontSize: 13 }}>
          <span>{r.emoji}</span>
          <span style={{ fontSize: 11, color: r.mine ? C.terracotta : C.grey, fontWeight: r.mine ? 700 : 400 }}>{r.count}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Context menu ─────────────────────────────────────────────────────────────

function ContextMenu({ pos, pinned, onPin, onDelete, onClose }: {
  pos: { top: number; right: number }; pinned: boolean
  onPin: () => void; onDelete: () => void; onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])
  return (
    <div ref={ref} style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 300, backgroundColor: C.white, border: `1px solid ${C.sable}`, borderRadius: 12, padding: 5, boxShadow: '0 8px 24px rgba(0,0,0,0.10)', minWidth: 160, animation: 'kavio-dd 0.12s ease' }}>
      <CMI label={pinned ? '📌 Désépingler' : '📌 Épingler'} onClick={() => { onPin(); onClose() }} />
      <div style={{ height: 1, backgroundColor: C.sable, margin: '4px 0' }} />
      <CMI label="Supprimer" danger onClick={() => { onDelete(); onClose() }} />
    </div>
  )
}

function CMI({ label, onClick, danger = false }: { label: string; onClick: () => void; danger?: boolean }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', borderRadius: 8, backgroundColor: h ? (danger ? '#FDECEA' : C.creme) : 'transparent', color: danger ? '#C0392B' : C.dark, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'background-color 0.1s', whiteSpace: 'nowrap' }}>
      {label}
    </button>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 280 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: C.dark, marginBottom: 8 }}>Aucun message pour le moment</div>
        <div style={{ fontSize: 14, color: C.grey, marginBottom: 24, lineHeight: 1.6 }}>Les recruteurs intéressés par votre profil vous contacteront ici.</div>
        <button onClick={onBrowse} style={{ padding: '10px 22px', borderRadius: 12, border: 'none', backgroundColor: C.terracotta, color: C.white, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Découvrir les offres →
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CandidatMessagesPage() {
  const router = useRouter()

  const [userProfil, setUserProfil]   = useState<AvatarProfil>({})
  const [convs, setConvs]             = useState<LocalConv[]>([])
  const [activeId, setActiveId]       = useState('')
  const [msgCache, setMsgCache]       = useState<Record<string, LocalMsg[]>>({})
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [input, setInput]             = useState('')
  const [sending, setSending]         = useState(false)
  const [uploading, setUploading]     = useState(false)
  const [menuId, setMenuId]           = useState<string | null>(null)
  const [menuPos, setMenuPos]         = useState<{ top: number; right: number } | null>(null)
  const [hovConvId, setHovConvId]     = useState<string | null>(null)
  const [hovMsgId, setHovMsgId]       = useState<string | null>(null)
  // Étape 3
  const [isTyping, setIsTyping]       = useState(false)
  // Étape 4
  const [replyingTo, setReplyingTo]   = useState<ReplyRef | null>(null)
  // Étape 5
  const [reactPickId, setReactPickId]   = useState<string | null>(null)
  const [reactPickPos, setReactPickPos] = useState<{ top: number; left: number } | null>(null)

  const endRef        = useRef<HTMLDivElement>(null)
  const textaRef      = useRef<HTMLTextAreaElement>(null)
  const fileRef       = useRef<HTMLInputElement>(null)
  const userIdRef     = useRef<string | null>(null)
  const realtimeRef   = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const typingTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingRef = useRef<number>(0)

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      userIdRef.current = user.id

      const { data: profilData } = await supabase
        .from('profils')
        .select('prenom, nom, avatar_url, avatar_type')
        .eq('user_id', user.id)
        .single()
      if (profilData) setUserProfil(profilData as AvatarProfil)

      const { data: convsRaw, error } = await supabase
        .from('conversations')
        .select('id, recruteur_id, offre_id, dernier_message, derniere_activite, non_lu, epinglee, offres(titre)')
        .eq('candidat_id', user.id)
        .order('derniere_activite', { ascending: false })

      if (error) { console.error('conversations:', error.message, error.code); setLoadingConvs(false); return }
      if (!convsRaw?.length) { setLoadingConvs(false); return }

      const recruteurIds = [...new Set(convsRaw.map(r => r.recruteur_id).filter(Boolean))]
      const { data: rData } = recruteurIds.length
        ? await supabase.from('profils').select('user_id, prenom, nom').in('user_id', recruteurIds)
        : { data: [] as { user_id: string; prenom?: string; nom?: string }[] }

      const profilMap: Record<string, { prenom?: string; nom?: string }> = {}
      for (const r of (rData ?? [])) profilMap[r.user_id] = r

      const loaded: LocalConv[] = convsRaw.map(row => {
        const p   = profilMap[row.recruteur_id]
        const nom = [p?.prenom, p?.nom].filter(Boolean).join(' ') || 'Recruteur'
        return {
          id: row.id, recruteurId: row.recruteur_id,
          nom, initiales: nom.split(' ').map((s: string) => s[0]).join('').toUpperCase().slice(0, 2),
          avatarBg: '#4A7C6E', entreprise: '',
          offreTitre: (row.offres as { titre?: string } | null)?.titre ?? '',
          offreId: row.offre_id ?? undefined,
          dernierMsg: row.dernier_message ?? '',
          derniereHeure: row.derniere_activite
            ? new Date(row.derniere_activite).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
            : '',
          nonLu: row.non_lu ?? 0, epinglee: row.epinglee ?? false,
        }
      })
      setConvs(loaded)
      if (loaded.length) setActiveId(loaded[0].id)
      setLoadingConvs(false)
    }
    init()
    return () => {
      if (realtimeRef.current) supabase.removeChannel(realtimeRef.current)
      if (typingTimer.current) clearTimeout(typingTimer.current)
    }
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgCache, activeId])

  // ── Derived ───────────────────────────────────────────────────────────────

  const activeConv  = convs.find(c => c.id === activeId) ?? null
  const activeMsgs  = msgCache[activeId] ?? []
  const totalUnread = convs.reduce((n, c) => n + c.nonLu, 0)
  const sortedConvs = [...convs].sort((a, b) =>
    a.epinglee !== b.epinglee ? (a.epinglee ? -1 : 1) : 0
  )

  // ── Realtime channel ──────────────────────────────────────────────────────

  function subscribeToConv(convId: string) {
    if (realtimeRef.current) { supabase.removeChannel(realtimeRef.current); realtimeRef.current = null }
    setIsTyping(false)
    if (!convId) return

    realtimeRef.current = supabase
      .channel(`conv-${convId}`)

      // ── Nouveaux messages ─────────────────────────────────────────────
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
        payload => {
          const m = payload.new as {
            id: string; expediteur_id: string; contenu: string; created_at: string; lu: boolean
            piece_jointe_url?: string; piece_jointe_nom?: string; piece_jointe_type?: string; reply_to_id?: string
          }
          if (m.expediteur_id === userIdRef.current) return
          setMsgCache(prev => ({
            ...prev,
            [convId]: [...(prev[convId] ?? []), {
              id: m.id, fromMe: false, lu: false, contenu: m.contenu,
              heure: new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              pjUrl: m.piece_jointe_url, pjNom: m.piece_jointe_nom, pjType: m.piece_jointe_type,
              replyToId: m.reply_to_id, replyToContenu: undefined, reactions: [],
            }],
          }))
          setConvs(prev => prev.map(c =>
            c.id === convId ? { ...c, dernierMsg: m.contenu || (m.piece_jointe_nom ?? ''), nonLu: c.nonLu + 1 } : c
          ))
        }
      )

      // ── Lecture (flèches orange) ──────────────────────────────────────
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
        payload => {
          const m = payload.new as { id: string; lu: boolean }
          setMsgCache(prev => {
            const msgs = prev[convId]
            if (!msgs) return prev
            return { ...prev, [convId]: msgs.map(msg => msg.id === m.id ? { ...msg, lu: m.lu } : msg) }
          })
        }
      )

      // ── Réactions INSERT (skip ses propres événements — update optimiste déjà appliqué)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' }, payload => {
        const r = payload.new as { message_id: string; user_id: string; emoji: string }
        if (r.user_id === userIdRef.current) return
        setMsgCache(prev => {
          const msgs = prev[convId]
          if (!msgs?.some(m => m.id === r.message_id)) return prev
          return {
            ...prev,
            [convId]: msgs.map(msg => {
              if (msg.id !== r.message_id) return msg
              const ex = msg.reactions.find(x => x.emoji === r.emoji)
              if (ex) return { ...msg, reactions: msg.reactions.map(x => x.emoji === r.emoji ? { ...x, count: x.count + 1 } : x) }
              return { ...msg, reactions: [...msg.reactions, { emoji: r.emoji, count: 1, mine: false }] }
            }),
          }
        })
      })

      // ── Réactions DELETE (nécessite REPLICA IDENTITY FULL sur reactions)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reactions' }, payload => {
        console.log('[RT reactions DELETE candidat] payload.old =', payload.old)
        const r = payload.old as { message_id: string; user_id: string; emoji: string }
        if (r.user_id === userIdRef.current) return
        setMsgCache(prev => {
          const msgs = prev[convId]
          if (!msgs?.some(m => m.id === r.message_id)) return prev
          return {
            ...prev,
            [convId]: msgs.map(msg => {
              if (msg.id !== r.message_id) return msg
              return {
                ...msg,
                reactions: msg.reactions
                  .map(x => x.emoji === r.emoji ? { ...x, count: x.count - 1 } : x)
                  .filter(x => x.count > 0),
              }
            }),
          }
        })
      })

      // ── Typing ────────────────────────────────────────────────────────
      .on('broadcast', { event: 'typing' }, () => {
        setIsTyping(true)
        if (typingTimer.current) clearTimeout(typingTimer.current)
        typingTimer.current = setTimeout(() => setIsTyping(false), 3000)
      })
      .subscribe()
  }

  function sendTypingSignal() {
    if (activeId.startsWith('f') || !realtimeRef.current) return
    const now = Date.now()
    if (now - lastTypingRef.current < 1000) return
    lastTypingRef.current = now
    realtimeRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId: userIdRef.current } }).catch(() => {})
  }

  // ── Select conversation ────────────────────────────────────────────────────

  async function selectConv(id: string) {
    setActiveId(id); setMenuId(null); setReplyingTo(null)
    setConvs(prev => prev.map(c => c.id === id ? { ...c, nonLu: 0 } : c))
    subscribeToConv(id)
    if (id.startsWith('f')) return

    const { data } = await supabase
      .from('messages')
      .select('*, reply:reply_to_id(id, contenu)')
      .eq('conversation_id', id)
      .order('created_at')

    if (data?.length) {
      const { data: reacts } = await supabase
        .from('reactions')
        .select('emoji, user_id, message_id')
        .in('message_id', data.map(m => m.id))

      const reactMap: Record<string, ReactionData[]> = {}
      if (reacts) {
        for (const r of reacts) {
          if (!reactMap[r.message_id]) reactMap[r.message_id] = []
          const ex = reactMap[r.message_id].find(x => x.emoji === r.emoji)
          if (ex) { ex.count++; if (r.user_id === userIdRef.current) ex.mine = true }
          else reactMap[r.message_id].push({ emoji: r.emoji, count: 1, mine: r.user_id === userIdRef.current })
        }
      }

      setMsgCache(prev => ({
        ...prev,
        [id]: data.map(m => ({
          id: m.id,
          fromMe: m.expediteur_id === userIdRef.current,
          lu: m.lu ?? false,
          contenu: m.contenu,
          heure: new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          pjUrl: m.piece_jointe_url, pjNom: m.piece_jointe_nom, pjType: m.piece_jointe_type,
          replyToId: m.reply_to_id,
          replyToContenu: (m.reply as { contenu?: string } | null)?.contenu,
          reactions: reactMap[m.id] ?? [],
        })),
      }))
    }

    if (userIdRef.current) {
      supabase.from('messages')
        .update({ lu: true })
        .eq('conversation_id', id)
        .neq('expediteur_id', userIdRef.current)
        .then()
    }
    supabase.from('conversations').update({ non_lu: 0 }).eq('id', id).then()
  }

  // ── Send message ──────────────────────────────────────────────────────────

  async function send(contenu: string, pjNom?: string, pjUrl?: string, pjType?: string) {
    if (!contenu.trim() && !pjNom) return
    if (!activeConv) return

    const heure = nowHeure()
    const msg: LocalMsg = {
      id: `tmp-${Date.now()}`, fromMe: true, lu: false, contenu: contenu.trim(), heure,
      pjUrl, pjNom, pjType,
      replyToId: replyingTo?.id, replyToContenu: replyingTo?.contenu,
      reactions: [],
    }
    setMsgCache(prev => ({ ...prev, [activeId]: [...(prev[activeId] ?? []), msg] }))
    setConvs(prev => prev.map(c => c.id === activeId ? { ...c, dernierMsg: contenu || (pjNom ?? ''), derniereHeure: heure } : c))
    setInput(''); setReplyingTo(null)
    if (textaRef.current) textaRef.current.style.height = 'auto'

    if (userIdRef.current && activeId) {
      setSending(true)
      const tmpId = msg.id
      const { data: inserted } = await supabase.from('messages').insert({
        expediteur_id: userIdRef.current,
        conversation_id: activeId,
        contenu: contenu.trim() || (pjNom ?? ''),
        piece_jointe_url: pjUrl ?? null,
        piece_jointe_nom: pjNom ?? null,
        piece_jointe_type: pjType ?? null,
        reply_to_id: replyingTo?.id ?? null,
      }).select('id').single()
      if (inserted) {
        setMsgCache(prev => ({
          ...prev,
          [activeId]: (prev[activeId] ?? []).map(m => m.id === tmpId ? { ...m, id: inserted.id } : m),
        }))
      }
      setSending(false)
    }
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  function adjustTA() {
    const el = textaRef.current; if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  // ── File upload ───────────────────────────────────────────────────────────

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = ''
    if (file.size > MAX_BYTES) { alert('Fichier trop volumineux (maximum 10 Mo).'); return }
    setUploading(true)
    const path = `${activeId}/${Date.now()}-${file.name}`
    const { data: up, error } = await supabase.storage.from('pieces-jointes').upload(path, file)
    const url = (!error && up)
      ? supabase.storage.from('pieces-jointes').getPublicUrl(path).data.publicUrl
      : undefined
    const type = isImage(file.name) ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'file'
    if (error) console.warn('[upload]', error.message)
    setUploading(false)
    await send('', file.name, url, type)
  }

  // ── Reactions ─────────────────────────────────────────────────────────────

  function openReactionPicker(e: React.MouseEvent<HTMLButtonElement>, msgId: string) {
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    setReactPickId(msgId); setReactPickPos({ top: r.top - 52, left: r.left - 80 })
  }

  async function toggleReaction(msgId: string, emoji: string) {
    const msg = (msgCache[activeId] ?? []).find(m => m.id === msgId)
    if (!msg) return
    const existing = msg.reactions.find(r => r.emoji === emoji && r.mine)

    const update = (reactions: ReactionData[]): ReactionData[] => {
      const r = reactions.find(x => x.emoji === emoji)
      if (existing) {
        return r
          ? reactions.map(x => x.emoji === emoji ? { ...x, count: x.count - 1, mine: false } : x).filter(x => x.count > 0)
          : reactions
      }
      if (r) return reactions.map(x => x.emoji === emoji ? { ...x, count: x.count + 1, mine: true } : x)
      return [...reactions, { emoji, count: 1, mine: true }]
    }

    setMsgCache(prev => ({
      ...prev,
      [activeId]: (prev[activeId] ?? []).map(m => m.id === msgId ? { ...m, reactions: update(m.reactions) } : m),
    }))

    if (!msgId.startsWith('f') && userIdRef.current) {
      if (existing) {
        await supabase.from('reactions').delete().eq('message_id', msgId).eq('user_id', userIdRef.current).eq('emoji', emoji)
      } else {
        await supabase.from('reactions').insert({ message_id: msgId, user_id: userIdRef.current, emoji })
      }
    }
  }

  // ── Conv management ───────────────────────────────────────────────────────

  function openMenu(e: React.MouseEvent<HTMLButtonElement>, id: string) {
    e.stopPropagation()
    if (menuId === id) { setMenuId(null); setMenuPos(null); return }
    const r = e.currentTarget.getBoundingClientRect()
    setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right }); setMenuId(id)
  }

  const pinConv = useCallback((id: string) => {
    setConvs(prev => prev.map(c => c.id === id ? { ...c, epinglee: !c.epinglee } : c))
    if (!id.startsWith('f')) {
      const cur = convs.find(c => c.id === id)?.epinglee
      supabase.from('conversations').update({ epinglee: !cur }).eq('id', id).then()
    }
  }, [convs])

  const deleteConv = useCallback((id: string) => {
    const conv = convs.find(c => c.id === id)
    if (!conv || !confirm(`Supprimer la conversation avec ${conv.entreprise || conv.nom} ?`)) return
    setConvs(prev => prev.filter(c => c.id !== id))
    if (activeId === id) {
      const next = convs.find(c => c.id !== id)
      setActiveId(next?.id ?? '')
    }
    if (!id.startsWith('f')) supabase.from('conversations').delete().eq('id', id).then()
  }, [convs, activeId])

  // ── Render ────────────────────────────────────────────────────────────────

  const menuConv = menuId ? convs.find(c => c.id === menuId) : null

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: C.creme }}>
      <style suppressHydrationWarning>{`
        @keyframes kavio-dd     { from{opacity:0;transform:translateY(-4px)}  to{opacity:1;transform:translateY(0)} }
        @keyframes kavio-sp     { to{transform:rotate(360deg)} }
        @keyframes kavio-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-4px)} }
        .dk-conv-row:hover .dk-cmb { opacity:1 !important; }
      `}</style>

      {menuId && menuPos && menuConv && (
        <ContextMenu
          pos={menuPos} pinned={menuConv.epinglee}
          onPin={() => pinConv(menuId)} onDelete={() => deleteConv(menuId)}
          onClose={() => { setMenuId(null); setMenuPos(null) }}
        />
      )}
      {reactPickId && reactPickPos && (
        <ReactionPicker pos={reactPickPos} onPick={e => toggleReaction(reactPickId, e)} onClose={() => { setReactPickId(null); setReactPickPos(null) }} />
      )}
      <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFile} />

      {/* ── LEFT COLUMN ──────────────────────────────────────────────────── */}
      <div style={{ width: 280, flexShrink: 0, height: '100%', backgroundColor: C.white, borderRight: `1px solid ${C.sable}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${C.sable}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: C.dark }}>Mes messages</span>
            {totalUnread > 0 && (
              <span style={{ padding: '1px 7px', borderRadius: 10, backgroundColor: C.terracotta, color: C.white, fontSize: 11, fontWeight: 700 }}>
                {totalUnread}
              </span>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <input type="text" placeholder="Rechercher…"
              style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: 8, border: `1.5px solid ${C.sable}`, backgroundColor: C.creme, fontSize: 13, color: C.dark, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.grey} strokeWidth="2" strokeLinecap="round"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingConvs ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: C.grey, fontSize: 13 }}>Chargement…</div>
          ) : sortedConvs.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: C.grey, fontSize: 13 }}>Aucune conversation</div>
          ) : sortedConvs.map(conv => {
            const isActive = conv.id === activeId
            return (
              <div key={conv.id} className="dk-conv-row"
                onMouseEnter={() => setHovConvId(conv.id)}
                onMouseLeave={() => setHovConvId(null)}
                style={{ position: 'relative' }}>
                <button onClick={() => selectConv(conv.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 36px 12px 14px', border: 'none', borderBottom: `1px solid ${C.sable}`, borderLeft: `3px solid ${isActive ? C.terracotta : conv.epinglee ? C.vert : 'transparent'}`, backgroundColor: isActive ? `${C.terracotta}08` : 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.1s' }}>
                  <ConvAvatar i={conv.initiales} bg={conv.avatarBg} s={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {conv.epinglee && <span style={{ fontSize: 10 }}>📌</span>}
                        {conv.entreprise || conv.nom}
                      </span>
                      <span style={{ fontSize: 10, color: C.grey, flexShrink: 0, marginLeft: 4 }}>{conv.derniereHeure}</span>
                    </div>
                    {/* Recruiter name + offre */}
                    <div style={{ fontSize: 11, color: C.grey, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conv.nom}{conv.offreTitre ? ` · ${conv.offreTitre}` : ''}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 12, color: conv.nonLu > 0 ? C.dark : C.grey, fontWeight: conv.nonLu > 0 ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {conv.dernierMsg}
                      </span>
                      {conv.nonLu > 0 && (
                        <span style={{ width: 17, height: 17, borderRadius: '50%', flexShrink: 0, backgroundColor: C.terracotta, color: C.white, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {conv.nonLu}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                <button className="dk-cmb" onClick={e => openMenu(e, conv.id)}
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 22, height: 22, borderRadius: 6, border: 'none', backgroundColor: menuId === conv.id ? C.creme : 'transparent', color: C.grey, fontSize: 14, fontWeight: 700, letterSpacing: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (hovConvId === conv.id || menuId === conv.id) ? 1 : 0, transition: 'opacity 0.15s', zIndex: 1, lineHeight: 1 }}
                  title="Options">···</button>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── CENTER COLUMN ────────────────────────────────────────────────── */}
      {!loadingConvs && convs.length === 0 ? (
        <EmptyState onBrowse={() => router.push('/offres')} />
      ) : activeConv ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ padding: '12px 22px', backgroundColor: C.white, borderBottom: `1px solid ${C.sable}`, display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
            <ConvAvatar i={activeConv.initiales} bg={activeConv.avatarBg} s={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.dark }}>{activeConv.entreprise || activeConv.nom}</div>
              <div style={{ fontSize: 12, color: C.grey, marginTop: 2 }}>{activeConv.nom}</div>
              {activeConv.offreTitre && (
                <div style={{ display: 'inline-flex', alignItems: 'center', marginTop: 4, padding: '2px 10px', borderRadius: 20, backgroundColor: `${C.terracotta}15`, border: `1px solid ${C.terracotta}30` }}>
                  <span style={{ fontSize: 11, color: C.terracotta, fontWeight: 600 }}>{activeConv.offreTitre}</span>
                </div>
              )}
            </div>
            {activeConv.offreId && (
              <button onClick={() => router.push(`/recruteur/offres/${activeConv.offreId}`)}
                style={{ padding: '7px 14px', borderRadius: 9, border: `1.5px solid ${C.sable}`, backgroundColor: 'transparent', color: C.dark, fontSize: 13, fontWeight: 500, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>
                Voir l'offre →
              </button>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeMsgs.map((msg, i) => {
              const prevSame = i > 0 && activeMsgs[i-1].fromMe === msg.fromMe
              return (
                <div key={msg.id}
                  onMouseEnter={() => setHovMsgId(msg.id)}
                  onMouseLeave={() => setHovMsgId(null)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: msg.fromMe ? 'flex-end' : 'flex-start', marginTop: prevSame ? -4 : 0 }}>

                  {/* Reply quote */}
                  {msg.replyToId && (
                    <div style={{ maxWidth: '58%', padding: '5px 10px', borderRadius: '8px 8px 0 0', borderLeft: `3px solid ${C.sable}`, backgroundColor: `${C.sable}50`, marginBottom: 2, fontSize: 12, color: C.grey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      ↩ {msg.replyToContenu ?? activeMsgs.find(m => m.id === msg.replyToId)?.contenu ?? '…'}
                    </div>
                  )}

                  {/* Bubble + hover actions */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexDirection: msg.fromMe ? 'row-reverse' : 'row' }}>
                    {msg.pjNom
                      ? <FileBubble nom={msg.pjNom} url={msg.pjUrl} type={msg.pjType} fromMe={msg.fromMe} />
                      : (
                        <div style={{ maxWidth: '60%', padding: '10px 14px', borderRadius: msg.fromMe ? '18px 18px 5px 18px' : '18px 18px 18px 5px', backgroundColor: msg.fromMe ? C.terracotta : C.white, border: msg.fromMe ? 'none' : `1.5px solid ${C.sable}`, color: msg.fromMe ? C.white : C.dark, fontSize: 14, lineHeight: '1.55', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                          {msg.contenu}
                        </div>
                      )
                    }
                    <div style={{ display: 'flex', gap: 3, opacity: hovMsgId === msg.id ? 1 : 0, transition: 'opacity 0.15s', flexShrink: 0 }}>
                      <ActionBtn title="Répondre" onClick={() => setReplyingTo({ id: msg.id, contenu: msg.contenu || (msg.pjNom ?? ''), fromMe: msg.fromMe })}>↩</ActionBtn>
                      <ActionBtn title="Réagir" onClick={e => openReactionPicker(e, msg.id)}>😊</ActionBtn>
                    </div>
                  </div>

                  {/* Time + checks */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, paddingInline: 4 }}>
                    <span style={{ fontSize: 11, color: C.grey }}>{msg.heure}</span>
                    {msg.fromMe && <Checks lu={msg.lu} />}
                  </div>

                  {/* Reactions */}
                  <div style={{ paddingInline: 4 }}>
                    <ReactionsBar reactions={msg.reactions} onToggle={e => toggleReaction(msg.id, e)} />
                  </div>
                </div>
              )
            })}

            {isTyping && <TypingIndicator nom={activeConv.nom.split(' ')[0]} />}
            <div ref={endRef} />
          </div>

          {/* Reply bar */}
          {replyingTo && (
            <ReplyBar reply={replyingTo} nom={activeConv.nom.split(' ')[0]} onCancel={() => setReplyingTo(null)} />
          )}

          {/* Input bar */}
          <div style={{ padding: '10px 18px', backgroundColor: C.white, borderTop: `1px solid ${C.sable}`, display: 'flex', gap: 10, alignItems: 'flex-end', flexShrink: 0 }}>
            <div style={{ marginBottom: 4, flexShrink: 0 }}>
              <GlobalAvatar profil={userProfil} size="sm" />
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} title="Joindre un fichier"
              style={{ width: 38, height: 38, borderRadius: 10, border: 'none', backgroundColor: C.creme, cursor: uploading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: uploading ? 0.5 : 1 }}>
              {uploading
                ? <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${C.sable}`, borderTopColor: C.terracotta, animation: 'kavio-sp 0.7s linear infinite' }} />
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.grey} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
              }
            </button>

            <textarea ref={textaRef} value={input}
              onChange={e => { setInput(e.target.value); adjustTA(); sendTypingSignal() }}
              onKeyDown={handleKey}
              placeholder={`Écrire à ${activeConv.nom.split(' ')[0]}…`}
              rows={1}
              style={{ flex: 1, padding: '9px 14px', borderRadius: 12, border: `1.5px solid ${input ? C.terracotta : C.sable}`, backgroundColor: C.creme, fontSize: 14, color: C.dark, outline: 'none', fontFamily: 'inherit', resize: 'none', lineHeight: '1.5', overflowY: 'hidden', transition: 'border-color 0.15s' }}
            />

            <button onClick={() => send(input)} disabled={!input.trim() || sending}
              style={{ height: 38, padding: '0 18px', borderRadius: 12, border: 'none', backgroundColor: input.trim() && !sending ? C.terracotta : C.sable, color: input.trim() && !sending ? C.white : C.grey, fontSize: 14, fontWeight: 600, cursor: input.trim() && !sending ? 'pointer' : 'default', transition: 'all 0.15s', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              {sending ? 'Envoi…' : (
                <>Envoyer <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg></>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: C.grey }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>💬</div>
            <div style={{ fontSize: 15 }}>Sélectionnez une conversation</div>
          </div>
        </div>
      )}
    </div>
  )
}
