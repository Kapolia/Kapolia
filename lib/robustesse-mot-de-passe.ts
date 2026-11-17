export interface ResultatEvaluation {
  niveau: -1 | 0 | 1 | 2 | 3 | 4
  conseil: string
}

export const NIVEAU_MIN_MOT_DE_PASSE = 2 as const

const COURANTS = new Set([
  'motdepasse', 'azerty', 'azertyuiop', 'qwerty',
  '123456', '12345678', '123456789',
  'password', 'soleil', 'marseille', 'doudou', 'loulou', 'chouchou',
  'kapolia', 'bonjour', 'nicolas', 'julien', 'camille',
  'motdepasse1', 'azerty123', 'soleil123', 'password1',
])

const SUITES = ['0123', '1234', '2345', 'abcd', 'azer', 'qwer']

export function evaluerMotDePasse(motDePasse: string, email?: string): ResultatEvaluation {
  const len = motDePasse.length

  if (len === 0) {
    return {
      niveau: -1,
      conseil: 'Une courte phrase de plusieurs mots est sûre et facile à retenir.',
    }
  }

  const mdpMin = motDePasse.toLowerCase()

  const aMinuscule = /[a-z]/.test(motDePasse)
  const aMajuscule = /[A-Z]/.test(motDePasse)
  const aChiffre   = /[0-9]/.test(motDePasse)
  const aAutre     = /[^a-zA-Z0-9]/.test(motDePasse)
  const types = [aMinuscule, aMajuscule, aChiffre, aAutre].filter(Boolean).length

  const exact = COURANTS.has(mdpMin)

  const lettresSeulement = mdpMin.replace(/[^a-z]/g, '')
  const courant = exact ||
    (lettresSeulement.length >= 4 && COURANTS.has(lettresSeulement) && len < 14)

  const repete =
    new Set(motDePasse).size === 1 ||
    (SUITES.some(s => mdpMin.startsWith(s)) && len < 12)

  let contientEmail = false
  if (email) {
    const local = email.split('@')[0] ?? ''
    if (local.length >= 4) {
      contientEmail = mdpMin.includes(local.toLowerCase())
    }
  }

  let niveau: -1 | 0 | 1 | 2 | 3 | 4

  if (len < 8 || courant || repete || contientEmail) {
    niveau = 0
  } else {
    niveau = 1
    if (len >= 10 && types >= 3) niveau = 2
    if (len >= 12 && types >= 3) niveau = 3
    if (len >= 16 && types >= 2 && niveau < 3) niveau = 3
    if ((len >= 14 && types === 4) || len >= 20) niveau = 4
  }

  let conseil: string

  if (len < 8) {
    const manque = 8 - len
    conseil = `Encore ${manque} caractère${manque > 1 ? 's' : ''} au minimum.`
  } else if (exact) {
    conseil = 'Ce mot de passe fait partie des plus utilisés.'
  } else if (courant) {
    conseil = 'Il repose sur un mot très courant.'
  } else if (contientEmail) {
    conseil = "Évitez d'y reprendre votre adresse e-mail."
  } else if (repete) {
    conseil = 'Évitez les suites et les répétitions.'
  } else if (niveau < 2 && types < 3) {
    conseil = 'Ajoutez un chiffre, une majuscule ou un symbole.'
  } else if (niveau < 3) {
    conseil = 'Allongez-le pour le rendre plus solide.'
  } else if (niveau === 3) {
    conseil = 'Quelques caractères de plus et il sera très solide.'
  } else {
    conseil = 'Parfait.'
  }

  return { niveau, conseil }
}

/*
Cas de test attendus :
  evaluerMotDePasse('soleil')                        → 0  (longueur < 8)
  evaluerMotDePasse('Soleil2024')                    → 0  (lettres = 'soleil', courant, len < 14)
  evaluerMotDePasse('azerty123')                     → 0  (exact dans COURANTS)
  evaluerMotDePasse('aaaaaaaaaa')                    → 0  (un seul caractère répété)
  evaluerMotDePasse('Lechat-dort3')                  → 3  (len=12, types=4, len>=12 && types>=3)
  evaluerMotDePasse('Le-chat-dort-sur-3-coussins')   → 4  (len=27, types=4, len>=14 && types=4)
*/
