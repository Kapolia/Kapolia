const TZ = { timeZone: 'Europe/Paris' } as const

export function formatCreneauParis(utc: string): string {
  const d  = new Date(utc)
  const wd  = d.toLocaleDateString('fr-FR', { weekday: 'short', ...TZ })
  const day = d.toLocaleDateString('fr-FR', { day: 'numeric',   ...TZ })
  const mo  = d.toLocaleDateString('fr-FR', { month: 'short',   ...TZ })
  const hm  = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', ...TZ })
              .replace(':', ' h ')
  const moStr = mo.endsWith('.') ? mo : mo + '.'
  return `${wd.charAt(0).toUpperCase() + wd.slice(1)} ${day} ${moStr}, ${hm}`
}

export function formatJourLong(utc: string): string {
  const d       = new Date(utc)
  const rdvYear = Number(d.toLocaleDateString('fr-FR', { year: 'numeric', ...TZ }))
  const nowYear = Number(new Date().toLocaleDateString('fr-FR', { year: 'numeric', ...TZ }))
  const opts: Intl.DateTimeFormatOptions = rdvYear === nowYear
    ? { weekday: 'long', day: 'numeric', month: 'long', ...TZ }
    : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', ...TZ }
  return d.toLocaleDateString('fr-FR', opts)
}

export function formatHeure(utc: string): string {
  return new Date(utc)
    .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', ...TZ })
    .replace(':', ' h ')
}

export function formatJourCourt(utc: string): string {
  const d  = new Date(utc)
  const wd  = d.toLocaleDateString('fr-FR', { weekday: 'short', ...TZ })
  const day = d.toLocaleDateString('fr-FR', { day: 'numeric',   ...TZ })
  const mo  = d.toLocaleDateString('fr-FR', { month: 'short',   ...TZ })
  const wdStr = wd.endsWith('.') ? wd : wd + '.'
  const moStr = mo.endsWith('.') ? mo : mo + '.'
  return `${wdStr.charAt(0).toUpperCase() + wdStr.slice(1)} ${day} ${moStr}`
}

export function delaiRelatif(utc: string): string | null {
  const toMs = (s: string) => { const [d, m, y] = s.split('/'); return Date.UTC(+y, +m - 1, +d) }
  const opts = { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' } as const
  const maintStr = new Date().toLocaleDateString('fr-FR', opts)
  const cibleStr = new Date(utc).toLocaleDateString('fr-FR', opts)
  const jours = Math.round((toMs(cibleStr) - toMs(maintStr)) / 86400000)
  if (jours < 0)   return null
  if (jours === 0) return "Aujourd'hui"
  if (jours === 1) return 'Demain'
  if (jours < 7)   return `Dans ${jours} jours`
  const sem = Math.round(jours / 7)
  return `Dans ${sem} semaine${sem > 1 ? 's' : ''}`
}
