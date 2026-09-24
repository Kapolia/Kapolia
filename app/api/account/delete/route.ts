export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL        = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY   = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function extractStoragePath(publicUrl: string, bucket: string): string | null {
  try {
    const u      = new URL(publicUrl)
    const marker = `/object/public/${bucket}/`
    const idx    = u.pathname.indexOf(marker)
    if (idx === -1) return null
    return decodeURIComponent(u.pathname.slice(idx + marker.length))
  } catch {
    return null
  }
}

export async function DELETE(req: NextRequest) {
  // ── Étape 1 : authentification depuis la session ─────────────────────────────
  const authHeader = req.headers.get('Authorization')
  const token      = authHeader?.replace(/^Bearer\s+/, '').trim()

  if (!token) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token)
  if (authError || !user) {
    console.error('[delete-account] étape 1 : auth', { message: authError?.message, code: authError?.code })
    return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
  }

  const userId = user.id
  console.info('[delete-account] étape 1 : auth ok', { userId })

  if (!SUPABASE_SERVICE_KEY) {
    console.error('[delete-account] SUPABASE_SERVICE_ROLE_KEY manquante')
    return NextResponse.json({ error: 'Configuration serveur incomplète' }, { status: 500 })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── Étape 2 : collecte des chemins de pièces jointes ─────────────────────────
  const { data: pjRows, error: pjError } = await admin
    .from('messages')
    .select('piece_jointe_url')
    .eq('expediteur_id', userId)
    .not('piece_jointe_url', 'is', null)

  if (pjError) {
    console.error('[delete-account] étape 2 : collecte pièces jointes', {
      message: pjError.message, code: pjError.code, details: pjError.details,
    })
    return NextResponse.json({ error: 'Échec collecte pièces jointes', step: 2 }, { status: 500 })
  }

  const pjPaths = (pjRows ?? [])
    .map(r => extractStoragePath(r.piece_jointe_url, 'pieces-jointes'))
    .filter((p): p is string => p !== null)

  console.info('[delete-account] étape 2 : chemins collectés', { count: pjPaths.length })

  // ── Étape 3 : suppression des fichiers dans les trois buckets ─────────────────

  // pieces-jointes — chemins extraits de messages.piece_jointe_url
  if (pjPaths.length > 0) {
    const { error: rmPjErr } = await admin.storage.from('pieces-jointes').remove(pjPaths)
    if (rmPjErr) {
      console.error('[delete-account] étape 3a : suppression pieces-jointes', {
        message: rmPjErr.message, paths: pjPaths,
      })
      return NextResponse.json({ error: 'Échec suppression pièces jointes', step: 3 }, { status: 500 })
    }
  }
  console.info('[delete-account] étape 3a : pieces-jointes supprimées', { count: pjPaths.length })

  // avatars — dossier userId/
  {
    const { data: avatarFiles, error: listErr } = await admin.storage.from('avatars').list(userId)
    if (listErr) {
      console.error('[delete-account] étape 3b : listage avatars', { message: listErr.message })
      return NextResponse.json({ error: 'Échec listage avatars', step: 3 }, { status: 500 })
    }
    const paths = (avatarFiles ?? []).map(f => `${userId}/${f.name}`)
    if (paths.length > 0) {
      const { error: rmErr } = await admin.storage.from('avatars').remove(paths)
      if (rmErr) {
        console.error('[delete-account] étape 3b : suppression avatars', { message: rmErr.message })
        return NextResponse.json({ error: 'Échec suppression avatars', step: 3 }, { status: 500 })
      }
    }
    console.info('[delete-account] étape 3b : avatars supprimés', { count: paths.length })
  }

  // projets-medias — dossier userId/
  {
    const { data: mediaFiles, error: listErr } = await admin.storage.from('projets-medias').list(userId)
    if (listErr) {
      console.error('[delete-account] étape 3c : listage projets-medias', { message: listErr.message })
      return NextResponse.json({ error: 'Échec listage projets-medias', step: 3 }, { status: 500 })
    }
    const paths = (mediaFiles ?? []).map(f => `${userId}/${f.name}`)
    if (paths.length > 0) {
      const { error: rmErr } = await admin.storage.from('projets-medias').remove(paths)
      if (rmErr) {
        console.error('[delete-account] étape 3c : suppression projets-medias', { message: rmErr.message })
        return NextResponse.json({ error: 'Échec suppression projets-medias', step: 3 }, { status: 500 })
      }
    }
    console.info('[delete-account] étape 3c : projets-medias supprimés', { count: paths.length })
  }

  // ── Étape 4 : suppression du compte auth ─────────────────────────────────────
  // La cascade ON DELETE CASCADE sur messages.expediteur_id supprime les
  // messages du candidat. La cascade ON DELETE SET NULL sur
  // conversations.candidat_id préserve les conversations côté recruteur.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) {
    console.error('[delete-account] étape 4 : deleteUser', {
      message: deleteError.message, status: deleteError.status, userId,
    })
    return NextResponse.json({ error: 'Échec suppression compte', step: 4 }, { status: 500 })
  }

  console.info('[delete-account] étape 4 : compte supprimé', { userId })
  return NextResponse.json({ ok: true })
}
