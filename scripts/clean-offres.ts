/**
 * Supprime les offres créées par le script de seed.
 * Usage : npx tsx scripts/clean-offres.ts
 *
 * Lit scripts/.seed-ids.json et supprime les entrées correspondantes dans Supabase.
 */

import './env'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SEED_IDS_PATH = join(__dirname, '.seed-ids.json')

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Variables Supabase introuvables dans .env.local.')
  console.error('    Vérifiez que .env.local contient NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
  if (!existsSync(SEED_IDS_PATH)) {
    console.error('❌  Aucun fichier .seed-ids.json trouvé.')
    console.error('    Lancez d\'abord : npx tsx scripts/seed-offres.ts')
    process.exit(1)
  }

  let ids: string[]
  try {
    ids = JSON.parse(readFileSync(SEED_IDS_PATH, 'utf-8'))
  } catch {
    console.error('❌  Impossible de lire .seed-ids.json (JSON invalide).')
    process.exit(1)
  }

  if (ids.length === 0) {
    console.log('ℹ️   Aucun ID à supprimer (fichier vide).')
    process.exit(0)
  }

  console.log(`🧹  Suppression de ${ids.length} offre(s) de test…\n`)

  const BATCH = 20
  let deleted = 0
  const errors: string[] = []

  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH)
    const { error, count } = await sb
      .from('offres')
      .delete({ count: 'exact' })
      .in('id', batch)

    if (error) {
      errors.push(error.message)
      console.error(`  ❌  Batch ${Math.floor(i / BATCH) + 1} : ${error.message}`)
    } else {
      deleted += count ?? batch.length
      console.log(`  ✓  Batch ${Math.floor(i / BATCH) + 1} : ${count ?? batch.length} offre(s) supprimée(s)`)
    }
  }

  // Vider le fichier
  if (errors.length === 0) {
    writeFileSync(SEED_IDS_PATH, JSON.stringify([]))
    console.log('\n✅  ' + deleted + ' offre(s) supprimée(s)')
    console.log('📄  .seed-ids.json réinitialisé')
  } else {
    console.log(`\n⚠️   ${deleted} supprimée(s), ${errors.length} erreur(s)`)
    console.log('    .seed-ids.json non modifié')
  }
}

main()
