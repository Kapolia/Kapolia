/**
 * Charge .env.local dans process.env au démarrage du script.
 * Import en première ligne de chaque script : import './env'
 * N'écrase pas les variables déjà définies dans le shell.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

try {
  const lines = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8').split('\n')
  for (const line of lines) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 0) continue
    const key = t.slice(0, eq).trim()
    const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !(key in process.env)) process.env[key] = val
  }
} catch {
  // .env.local absent — les variables doivent venir de l'environnement
}
