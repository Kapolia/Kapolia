export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@supabase/supabase-js'
import { BASE_SCALE, scaleDown, makeDocument } from '@/components/PortraitKapolia'
import type { ProfilPDF, ScaleCfg } from '@/components/PortraitKapolia'

const PROFIL_COLUMNS = [
  'prenom', 'nom', 'domaine', 'experience', 'ville', 'signature',
  'experiences', 'diplomes', 'competences_acquises', 'langues',
  'projet_phare', 'projet_titre', 'valeur', 'qualites', 'passions',
  'type_poste', 'disponibilite', 'telephone',
  'avatar_url', 'avatar_type',
].join(', ')

function sanitize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
}

function countPages(buf: Buffer): number {
  const matches = buf.toString('latin1').match(/\/Type\s*\/Page\b/g)
  return matches?.length ?? 1
}

// Réduit le profil : limite les missions par expérience, tronque la présentation.
// Garde les premières missions (les plus importantes). Pas d'ellipse.
function limitProfil(p: ProfilPDF, maxMissions: number, maxSignatureChars?: number): ProfilPDF {
  const experiences = p.experiences?.map(exp => {
    if (!exp.missions) return exp
    const lines = exp.missions.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length <= maxMissions) return exp
    return { ...exp, missions: lines.slice(0, maxMissions).join('\n') }
  })

  let signature = p.signature
  if (maxSignatureChars && signature && signature.length > maxSignatureChars) {
    const cut       = signature.slice(0, maxSignatureChars)
    const lastSpace = cut.lastIndexOf(' ')
    signature = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()
  }

  return { ...p, experiences, signature }
}

export async function GET(req: NextRequest) {
  // ── Authentification ─────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  const token      = authHeader?.replace(/^Bearer\s+/, '').trim()

  if (!token) {
    return new NextResponse('Non autorise', { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    console.error('[portrait] auth error', authError)
    return new NextResponse('Token invalide', { status: 401 })
  }

  // ── Options de génération ────────────────────────────────────────────────────
  const url        = new URL(req.url)
  const title      = url.searchParams.get('title') ?? undefined
  const withPhoto  = url.searchParams.get('withPhoto') === 'true'
  const showEmail  = url.searchParams.get('showEmail')  !== 'false'
  const showPhone  = url.searchParams.get('showPhone')  !== 'false'

  // ── Lecture du profil ────────────────────────────────────────────────────────
  const { data: profil, error: profilError } = await supabase
    .from('profils')
    .select(PROFIL_COLUMNS)
    .eq('user_id', user.id)
    .single()

  if (profilError || !profil) {
    const isPgrst116 = profilError?.code === 'PGRST116'
    console.error('[portrait] profil error', profilError)
    return new NextResponse(
      isPgrst116 ? 'Profil introuvable' : `Erreur base de données: ${profilError?.message}`,
      { status: isPgrst116 ? 404 : 500 },
    )
  }

  const email = user.email ?? ''
  const p     = profil as unknown as ProfilPDF

  // ── Photo avatar (optionnelle, timeout 3 s) ───────────────────────────────────
  let avatarData: string | undefined
  if (withPhoto && p.avatar_type === 'photo' && p.avatar_url) {
    try {
      const ctrl = new AbortController()
      const tid  = setTimeout(() => ctrl.abort(), 3000)
      const imgRes = await fetch(p.avatar_url, { signal: ctrl.signal })
      clearTimeout(tid)

      if (!imgRes.ok) {
        console.warn('[portrait] avatar: réponse non-ok', { status: imgRes.status, url: p.avatar_url })
      } else {
        const buf  = await imgRes.arrayBuffer()
        const mime = imgRes.headers.get('content-type') ?? ''

        if (buf.byteLength === 0) {
          console.warn('[portrait] avatar: réponse vide (0 octets)', { url: p.avatar_url })
        } else if (!mime.startsWith('image/')) {
          console.warn('[portrait] avatar: type MIME inattendu', { mime, url: p.avatar_url })
        } else {
          avatarData = `data:${mime};base64,${Buffer.from(buf).toString('base64')}`
        }
      }
    } catch (err) {
      console.warn('[portrait] avatar: échec du chargement', { error: String(err), url: p.avatar_url })
    }
  }

  // ── Génération PDF ────────────────────────────────────────────────────────────
  // Cascade en 4 étapes, arrêt dès qu'une page unique est obtenue.
  // La fusion Centres d'intérêt + Langues (mode A) est active dès l'étape 1.
  const REDUCTION_SCALES: ScaleCfg[] = [
    scaleDown(BASE_SCALE, 0.80),
    scaleDown(BASE_SCALE, 0.64),
    scaleDown(BASE_SCALE, 0.512),
    scaleDown(BASE_SCALE, 0.4096),
  ]
  const TIGHTEST = REDUCTION_SCALES[3]

  let finalBuffer!: Buffer
  try {
    let finalScale:         ScaleCfg = BASE_SCALE
    let activeP:            ProfilPDF = p
    let finalForceTruncate: boolean   = false
    let found = false

    // ── Étape 1 : fusion CI + Langues, espacement de base ─────────────────────
    {
      const buf   = await renderToBuffer(makeDocument({ profil: p, email, title, withPhoto, avatarData, scale: BASE_SCALE, mergeMode: 'A', showEmail, showPhone }))
      const pages = countPages(buf)
      console.info(`[portrait] étape 1 · fusion A · base · ${pages} page${pages > 1 ? 's' : ''}`, { user_id: user.id, octets: buf.length })
      if (pages === 1) { finalBuffer = buf; found = true }
    }

    // ── Étape 2 : 4 crans de réduction d'espacement, fusion conservée ─────────
    if (!found) {
      for (let i = 0; i < REDUCTION_SCALES.length; i++) {
        const buf   = await renderToBuffer(makeDocument({ profil: p, email, title, withPhoto, avatarData, scale: REDUCTION_SCALES[i], mergeMode: 'A', showEmail, showPhone }))
        const pages = countPages(buf)
        console.info(`[portrait] étape 2 · fusion A · cran ${i + 1} · ${pages} page${pages > 1 ? 's' : ''}`, { user_id: user.id, octets: buf.length })
        if (pages === 1) {
          finalBuffer = buf
          finalScale  = REDUCTION_SCALES[i]
          found       = true
          break
        }
      }
    }

    // ── Étape 3 : réduction missions (5→4→3→2), fusion + cran le plus serré ──
    if (!found) {
      for (const maxMissions of [5, 4, 3, 2]) {
        const reduced = limitProfil(p, maxMissions)
        const buf     = await renderToBuffer(makeDocument({ profil: reduced, email, title, withPhoto, avatarData, scale: TIGHTEST, mergeMode: 'A', showEmail, showPhone }))
        const pages   = countPages(buf)
        console.info(`[portrait] étape 3 · fusion A · cran 4 · ${maxMissions} missions · ${pages} page${pages > 1 ? 's' : ''}`, { user_id: user.id, octets: buf.length })
        if (pages === 1) {
          finalBuffer = buf
          finalScale  = TIGHTEST
          activeP     = reduced
          found       = true
          break
        }
      }
    }

    // ── Étape 4 : troncature en dernier recours ───────────────────────────────
    if (!found) {
      const buf   = await renderToBuffer(makeDocument({ profil: p, email, title, withPhoto, avatarData, scale: TIGHTEST, forceTruncate: true, mergeMode: 'A', showEmail, showPhone }))
      const pages = countPages(buf)
      console.warn(`[portrait] étape 4 · forceTruncate · fusion A · cran 4 · ${pages} page${pages > 1 ? 's' : ''}`, { user_id: user.id, octets: buf.length })
      finalBuffer        = buf
      finalScale         = TIGHTEST
      finalForceTruncate = true
    }

    // ── Remplissage : augmente cardGap jusqu'au seuil de débordement ─────────
    // cardPadV reste fixe — seul cardGap est augmenté.
    {
      const MAX_GAP  = 14
      let bestBuffer = finalBuffer
      let bestGap    = finalScale.cardGap

      if (bestGap < MAX_GAP) {
        const maxBuf = await renderToBuffer(
          makeDocument({ profil: activeP, email, title, withPhoto, avatarData, scale: { ...finalScale, cardGap: MAX_GAP }, mergeMode: 'A', forceTruncate: finalForceTruncate, showEmail, showPhone })
        )
        if (countPages(maxBuf) === 1) {
          bestBuffer = maxBuf
          bestGap    = MAX_GAP
        } else {
          let lo = bestGap
          let hi = MAX_GAP
          while (hi - lo > 1.5) {
            const mid    = (lo + hi) / 2
            const midBuf = await renderToBuffer(
              makeDocument({ profil: activeP, email, title, withPhoto, avatarData, scale: { ...finalScale, cardGap: mid }, mergeMode: 'A', forceTruncate: finalForceTruncate, showEmail, showPhone })
            )
            if (countPages(midBuf) === 1) {
              lo         = mid
              bestBuffer = midBuf
              bestGap    = mid
            } else {
              hi = mid
            }
          }
        }
      }

      if (Math.abs(bestGap - finalScale.cardGap) > 0.1) {
        console.info('[portrait] remplissage : cardGap', finalScale.cardGap.toFixed(2), '→', bestGap.toFixed(2))
      }
      finalBuffer = bestBuffer
    }

  } catch (err) {
    console.error('[portrait] erreur génération PDF', err)
    return new NextResponse('Erreur génération PDF', { status: 500 })
  }

  // ── Réponse ──────────────────────────────────────────────────────────────────
  const filename = `${sanitize(p.prenom)}_${sanitize(p.nom)}_portrait.pdf`

  return new NextResponse(new Uint8Array(finalBuffer), {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-store',
    },
  })
}
