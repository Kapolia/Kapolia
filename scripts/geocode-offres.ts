/**
 * Géocode les offres via l'API officielle geo.api.gouv.fr.
 *
 * SQL — à exécuter dans le SQL Editor Supabase AVANT ce script :
 *
 *   ALTER TABLE public.offres ADD COLUMN IF NOT EXISTS latitude  numeric;
 *   ALTER TABLE public.offres ADD COLUMN IF NOT EXISTS longitude numeric;
 *
 * Usage :
 *   SEED_PASSWORD=xxx npx tsx scripts/geocode-offres.ts           # offres sans coords
 *   SEED_PASSWORD=xxx npx tsx scripts/geocode-offres.ts --force   # toutes les offres
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = 'https://twglalraitxmauyltmfp.supabase.co'
const SUPABASE_KEY  = 'sb_publishable_HMQlUq0szDNQzgqDxH-s8A_51DLlTtq'
const SEED_EMAIL    = 'PaulQuiquet@gmail.com'

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

type GeoCommune = {
  nom:        string
  population?: number
  centre?:    { coordinates: [number, number] }
}

const FORCE = process.argv.includes('--force')

// ─── City name cleanup ────────────────────────────────────────────────────────

function normalizeVille(raw: string): string {
  return raw
    .replace(/^\d{5}\s+/, '')          // "75011 Paris" → "Paris"
    .replace(/\s+\d+(e|er|ème|eme)\s*$/i, '')  // "Paris 11e" → "Paris"
    .trim()
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function authenticate(): Promise<void> {
  const password = process.env.SEED_PASSWORD
  if (!password) {
    console.error('❌  Variable SEED_PASSWORD manquante.')
    console.error('    Lancez : SEED_PASSWORD=xxx npx tsx scripts/geocode-offres.ts')
    process.exit(1)
  }
  console.log(`🔐  Connexion en tant que ${SEED_EMAIL}…`)
  const { data, error } = await sb.auth.signInWithPassword({ email: SEED_EMAIL, password })
  if (error || !data.user) {
    console.error(`❌  Échec : ${error?.message ?? 'réponse vide'}`)
    process.exit(1)
  }
  console.log(`✅  Connecté — user_id : ${data.user.id}\n`)
}

// ─── Geocoding ────────────────────────────────────────────────────────────────

async function geocode(rawVille: string): Promise<{ lat: number; lng: number; nom: string } | null> {
  const ville = normalizeVille(rawVille)
  try {
    const url  = `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(ville)}&fields=centre,population&boost=population&limit=5`
    const res  = await fetch(url)
    const data = await res.json() as GeoCommune[]
    if (!data.length) return null

    const lower = ville.toLowerCase()

    // Priorité : correspondance exacte de nom (insensible à la casse)
    const exact = data.find(c => c.nom.toLowerCase() === lower)
    const best  = exact ?? data.reduce((a, b) => (b.population ?? 0) > (a.population ?? 0) ? b : a)

    if (!best.centre) return null
    const [lng, lat] = best.centre.coordinates
    return { lat, lng, nom: best.nom }
  } catch {
    return null
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🌍  Démarrage du géocodage${FORCE ? ' (--force : toutes les offres)' : ''}…\n`)
  await authenticate()

  let query = sb.from('offres').select('id, ville').not('ville', 'is', null)
  if (!FORCE) query = query.is('latitude', null)

  const { data: offres, error } = await query

  if (error) {
    console.error('❌  Erreur de récupération :', error.message)
    process.exit(1)
  }

  const total = offres?.length ?? 0
  console.log(`📦  ${total} offre(s) à traiter\n`)

  let ok = 0, notFound = 0, errs = 0

  for (const offre of offres ?? []) {
    if (!offre.ville) { notFound++; continue }

    const result = await geocode(offre.ville)

    if (!result) {
      console.warn(`  ⚠   "${offre.ville}" — non trouvé`)
      notFound++
      continue
    }

    const { error: upErr } = await sb
      .from('offres')
      .update({ latitude: result.lat, longitude: result.lng })
      .eq('id', offre.id)

    if (upErr) {
      console.error(`  ❌  "${offre.ville}" — ${upErr.message}`)
      errs++
    } else {
      const match = result.nom.toLowerCase() === normalizeVille(offre.ville).toLowerCase()
      const flag  = match ? '✓' : '≈'
      console.log(`  ${flag}  "${offre.ville}" → ${result.nom} (${result.lat.toFixed(4)}, ${result.lng.toFixed(4)})`)
      ok++
    }

    await new Promise(r => setTimeout(r, 60))
  }

  await sb.auth.signOut()

  console.log('\n─────────────────────────────────────────────────────')
  console.log(`✅  ${ok} géocodé(s)`)
  if (notFound) console.log(`⚠   ${notFound} non trouvé(s)`)
  if (errs)     console.log(`❌  ${errs} erreur(s) de mise à jour`)
}

main()
