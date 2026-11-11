function escapeIcs(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function toIcsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export function genererIcs(params: {
  rdvId:         string
  type:          'telephonique' | 'entretien'
  dureeMinutes:  number
  entrepriseNom: string
  recruteurNom:  string
  offreTitre:    string
  contactInfo:   string | null
  debutUtc:      string
}): string {
  const { rdvId, type, dureeMinutes, entrepriseNom, recruteurNom, offreTitre, contactInfo, debutUtc } = params
  const dtstamp  = toIcsDate(new Date().toISOString())
  const dtstart  = toIcsDate(debutUtc)
  const summary  = type === 'telephonique'
    ? `Appel, ${entrepriseNom}`
    : `Entretien, ${entrepriseNom}`
  const descParts = [
    offreTitre  ? escapeIcs(offreTitre) + '.'       : '',
    recruteurNom ? `Avec ${escapeIcs(recruteurNom)}.` : '',
    'https://kapolia.com/dashboard/rendez-vous',
  ].filter(Boolean)
  const description = descParts.join(' ')

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kapolia//FR',
    'BEGIN:VEVENT',
    `UID:${rdvId}@kapolia.com`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DURATION:PT${dureeMinutes}M`,
    `SUMMARY:${escapeIcs(summary)}`,
  ]
  if (type === 'entretien' && contactInfo) {
    lines.push(`LOCATION:${escapeIcs(contactInfo)}`)
  }
  if (description) lines.push(`DESCRIPTION:${description}`)
  lines.push('END:VEVENT')
  lines.push('END:VCALENDAR')

  return lines.join('\r\n') + '\r\n'
}
