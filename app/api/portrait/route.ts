export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@supabase/supabase-js'
import { BASE_SCALE, scaleDown, makeDocument } from '@/components/PortraitKapolia'
import type { ProfilPDF, ScaleCfg } from '@/components/PortraitKapolia'

const PROFIL_COLUMNS = [
  'prenom', 'nom', 'domaine', 'experience', 'ville', 'signature',
  'experiences', 'diplomes', 'competences_acquises', 'langues',
  'projet_phare', 'valeur', 'qualites', 'passions',
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
  const url       = new URL(req.url)
  const title     = url.searchParams.get('title') ?? undefined
  const withPhoto = url.searchParams.get('withPhoto') === 'true'

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
  // Phase 1 : cascade de 4 crans (espacement réduit progressivement).
  // Phase 2 : réduction du contenu (missions, présentation) si la cascade échoue.
  // Phase 3 : forceTruncate en dernier recours.
  const SCALE_FACTOR = 0.8
  const SCALES: ScaleCfg[] = [
    BASE_SCALE,
    scaleDown(BASE_SCALE, SCALE_FACTOR),
    scaleDown(BASE_SCALE, SCALE_FACTOR ** 2),
    scaleDown(BASE_SCALE, SCALE_FACTOR ** 3),
  ]

  let finalBuffer!: Buffer
  try {
    let finalScale:     ScaleCfg            = BASE_SCALE
    let finalMergeMode: 'none' | 'A'       = 'none'
    let activeP:        ProfilPDF           = p
    let found = false

    // ── Phase 1 : cascade base → cran 3 ──────────────────────────────────────
    for (let i = 0; i < SCALES.length; i++) {
      const buf   = await renderToBuffer(makeDocument({ profil: activeP, email, title, withPhoto, avatarData, scale: SCALES[i] }))
      const pages = countPages(buf)
      console.info(`[portrait] phase 1 · cran ${i} · ${pages} page${pages > 1 ? 's' : ''}`, { user_id: user.id })
      if (pages === 1) {
        finalBuffer = buf
        finalScale  = SCALES[i]
        found       = true
        break
      }
    }

    // ── Phase 1.5 : fusion Centres d'intérêt + Langues (étape A) ────────────
    // Retente les 4 crans pour conserver l'espacement optimal.
    if (!found) {
      for (let i = 0; i < SCALES.length; i++) {
        const buf   = await renderToBuffer(
          makeDocument({ profil: activeP, email, title, withPhoto, avatarData, scale: SCALES[i], mergeMode: 'A' })
        )
        const pages = countPages(buf)
        console.info(`[portrait] phase 1.5 · fusion A · cran ${i} · ${pages} page${pages > 1 ? 's' : ''}`, { user_id: user.id })
        if (pages === 1) {
          finalBuffer    = buf
          finalScale     = SCALES[i]
          finalMergeMode = 'A'
          found          = true
          break
        }
      }
    }

    // ── Phase 2 : réduction missions + fusion A (cumul des deux gains) ────────
    // mergeMode 'A' conservé : réduire les missions tout en gardant la fusion
    // centres d'intérêt + langues cumule les deux économies de place.
    if (!found) {
      const STEPS = [
        { maxMissions: 5 },
        { maxMissions: 4 },
        { maxMissions: 3 },
        { maxMissions: 3, maxSignature: 400 },
        { maxMissions: 2 },
      ] as const

      for (let step = 0; step < STEPS.length; step++) {
        const { maxMissions, maxSignature } = STEPS[step] as { maxMissions: number; maxSignature?: number }
        const reduced   = limitProfil(p, maxMissions, maxSignature)
        const stepLabel = maxSignature !== undefined ? `${maxMissions}missions+sig` : `${maxMissions}missions`
        const buf       = await renderToBuffer(
          makeDocument({ profil: reduced, email, title, withPhoto, avatarData, scale: SCALES[3], mergeMode: 'A' })
        )
        const pages = countPages(buf)
        console.info(`[portrait] phase 2 · ${stepLabel} · fusion A · ${pages} page${pages > 1 ? 's' : ''}`, { user_id: user.id })
        if (pages === 1) {
          finalBuffer    = buf
          finalScale     = SCALES[3]
          finalMergeMode = 'A'
          activeP        = reduced
          found          = true
          break
        }
      }
    }

    // ── Phase 3 : dernier recours — forceTruncate + fusion A ─────────────────
    if (!found) {
      const buf   = await renderToBuffer(
        makeDocument({ profil: p, email, title, withPhoto, avatarData, scale: SCALES[3], forceTruncate: true, mergeMode: 'A' })
      )
      const pages = countPages(buf)
      console.warn(`[portrait] phase 3 · forceTruncate · fusion A · ${pages} page${pages > 1 ? 's' : ''}`, { user_id: user.id })
      finalBuffer    = buf
      finalScale     = SCALES[3]
      finalMergeMode = 'A'
    }

    // ── Remplissage : augmente cardGap jusqu'au seuil de débordement ─────────
    // cardPadV reste fixe — seul cardGap est augmenté.
    {
      const MAX_GAP  = 14
      let bestBuffer = finalBuffer
      let bestGap    = finalScale.cardGap

      if (bestGap < MAX_GAP) {
        const maxBuf = await renderToBuffer(
          makeDocument({ profil: activeP, email, title, withPhoto, avatarData, scale: { ...finalScale, cardGap: MAX_GAP }, mergeMode: finalMergeMode })
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
              makeDocument({ profil: activeP, email, title, withPhoto, avatarData, scale: { ...finalScale, cardGap: mid }, mergeMode: finalMergeMode })
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
