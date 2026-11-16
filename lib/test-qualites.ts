// ─── Types ────────────────────────────────────────────────────────────────────

export type Reponse = {
  id:      1 | 2 | 3 | 4
  texte:   string
  qualite: string
}

export type Situation = {
  id:       number
  texte:    string
  reponses: [Reponse, Reponse, Reponse, Reponse]
}

export type QualiteTest = {
  qualite: string
  count:   number
}

export type TestAnswer = {
  situation_id:  number
  reponse_1:     1 | 2 | 3 | 4
  reponse_2:     1 | 2 | 3 | 4
  version_test:  number
}

// ─── Version courante ────────────────────────────────────────────────────────
//
// Incrémenter uniquement si le contenu change de façon incompatible (qualités
// renommées, situations retirées). Une reformulation de texte ne nécessite pas
// de changement de version.
// Le calcul utilise toujours SITUATIONS[row.version_test], jamais CURRENT_VERSION.

export const CURRENT_VERSION = 1

// ─── Libellés d'affichage ─────────────────────────────────────────────────────

export const QUALITE_LABELS: Record<string, string> = {
  ecoute:        'Écoute',
  initiative:    'Initiative',
  rigueur:       'Rigueur',
  adaptabilite:  'Adaptabilité',
  serenite:      'Sérénité',
  pedagogie:     'Pédagogie',
  solidarite:    'Solidarité',
  creativite:    'Créativité',
  perseverance:  'Persévérance',
  franchise:     'Franchise',
  organisation:  'Organisation',
  curiosite:     'Curiosité',
}

// ─── Situations ───────────────────────────────────────────────────────────────

export const SITUATIONS: Record<number, Situation[]> = {
  1: [
    {
      id: 1,
      texte: "Un nouveau collègue arrive dans l'équipe.",
      reponses: [
        { id: 1, texte: "Vous prenez le temps de lui montrer comment les choses fonctionnent", qualite: 'pedagogie' },
        { id: 2, texte: "Vous lui demandez d'où il vient et ce qu'il a fait avant", qualite: 'curiosite' },
        { id: 3, texte: "Vous l'intégrez au groupe, aux pauses, aux échanges", qualite: 'solidarite' },
        { id: 4, texte: "Vous cadrez ses premiers jours pour qu'il sache où il va", qualite: 'organisation' },
      ],
    },
    {
      id: 2,
      texte: "Une consigne change au dernier moment.",
      reponses: [
        { id: 1, texte: "Vous réorganisez votre journée sans en faire une histoire", qualite: 'adaptabilite' },
        { id: 2, texte: "Vous demandez pourquoi, pour comprendre la logique", qualite: 'curiosite' },
        { id: 3, texte: "Vous vérifiez ce que cela change concrètement avant de repartir", qualite: 'rigueur' },
        { id: 4, texte: "Vous dites ce que ce changement va coûter", qualite: 'franchise' },
      ],
    },
    {
      id: 3,
      texte: "Vous repérez une erreur dans un travail déjà validé.",
      reponses: [
        { id: 1, texte: "Vous la signalez tout de suite, même si c'est gênant", qualite: 'franchise' },
        { id: 2, texte: "Vous la corrigez avant que quelqu'un s'en aperçoive", qualite: 'initiative' },
        { id: 3, texte: "Vous cherchez d'où elle vient pour qu'elle ne revienne pas", qualite: 'rigueur' },
        { id: 4, texte: "Vous prévenez la personne concernée en privé", qualite: 'ecoute' },
      ],
    },
    {
      id: 4,
      texte: "La charge augmente et tout devient urgent.",
      reponses: [
        { id: 1, texte: "Vous listez et vous traitez dans l'ordre", qualite: 'organisation' },
        { id: 2, texte: "Vous gardez le rythme sans vous laisser gagner par la tension", qualite: 'serenite' },
        { id: 3, texte: "Vous allez aider ceux qui sont le plus en difficulté", qualite: 'solidarite' },
        { id: 4, texte: "Vous continuez jusqu'à ce que ce soit terminé", qualite: 'perseverance' },
      ],
    },
    {
      id: 5,
      texte: "Une méthode en place depuis longtemps ne fonctionne plus très bien.",
      reponses: [
        { id: 1, texte: "Vous proposez une autre façon de faire", qualite: 'creativite' },
        { id: 2, texte: "Vous la changez à votre niveau sans attendre", qualite: 'initiative' },
        { id: 3, texte: "Vous vous adaptez à l'existant en attendant mieux", qualite: 'adaptabilite' },
        { id: 4, texte: "Vous allez voir comment d'autres font ailleurs", qualite: 'curiosite' },
      ],
    },
    {
      id: 6,
      texte: "Un désaccord s'installe dans l'équipe.",
      reponses: [
        { id: 1, texte: "Vous écoutez les deux points de vue avant de vous prononcer", qualite: 'ecoute' },
        { id: 2, texte: "Vous dites clairement ce que vous pensez", qualite: 'franchise' },
        { id: 3, texte: "Vous gardez votre calme et vous ramenez au sujet", qualite: 'serenite' },
        { id: 4, texte: "Vous cherchez une solution qui convienne à tout le monde", qualite: 'solidarite' },
      ],
    },
    {
      id: 7,
      texte: "Une tâche longue et répétitive vous est confiée.",
      reponses: [
        { id: 1, texte: "Vous la menez jusqu'au bout sans en bâcler la fin", qualite: 'perseverance' },
        { id: 2, texte: "Vous vérifiez chaque étape pour qu'il n'y ait rien à reprendre", qualite: 'rigueur' },
        { id: 3, texte: "Vous trouvez un moyen de la rendre moins pénible", qualite: 'creativite' },
        { id: 4, texte: "Vous vous fixez un déroulé et vous vous y tenez", qualite: 'organisation' },
      ],
    },
    {
      id: 8,
      texte: "Quelqu'un vous demande de lui expliquer ce que vous faites.",
      reponses: [
        { id: 1, texte: "Vous montrez en faisant, pas à pas", qualite: 'pedagogie' },
        { id: 2, texte: "Vous demandez d'abord ce qu'il a déjà compris", qualite: 'ecoute' },
        { id: 3, texte: "Vous simplifiez, quitte à y revenir plus tard", qualite: 'adaptabilite' },
        { id: 4, texte: "Vous reprenez depuis le début même si c'est long", qualite: 'perseverance' },
      ],
    },
    {
      id: 9,
      texte: "Un imprévu bloque tout et personne ne sait quoi faire.",
      reponses: [
        { id: 1, texte: "Vous prenez les choses en main", qualite: 'initiative' },
        { id: 2, texte: "Vous gardez la tête froide et vous évaluez la situation", qualite: 'serenite' },
        { id: 3, texte: "Vous trouvez une solution de contournement", qualite: 'creativite' },
        { id: 4, texte: "Vous expliquez aux autres ce qu'il faut faire", qualite: 'pedagogie' },
      ],
    },
  ],
}

// ─── Calcul ───────────────────────────────────────────────────────────────────
//
// Utilise row.version_test pour choisir le contenu, jamais CURRENT_VERSION.
// Retourne les qualités apparues dans au moins deux situations,
// triées par count décroissant.

export function calculerQualites(answers: TestAnswer[]): QualiteTest[] {
  const counts = new Map<string, number>()

  for (const answer of answers) {
    const situations = SITUATIONS[answer.version_test]
    if (!situations) continue
    const situation = situations.find(s => s.id === answer.situation_id)
    if (!situation) continue

    const q1 = situation.reponses.find(r => r.id === answer.reponse_1)?.qualite
    const q2 = situation.reponses.find(r => r.id === answer.reponse_2)?.qualite

    if (q1) counts.set(q1, (counts.get(q1) ?? 0) + 1)
    if (q2) counts.set(q2, (counts.get(q2) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([qualite, count]) => ({ qualite, count }))
}

// Clés des 3 qualités les mieux classées du test.
// Critères de tri : count décroissant → fois choisie en reponse_1 décroissant → ordre de QUALITE_LABELS.
// Seulement les qualités choisies ≥ 2 fois → peut renvoyer moins de 3 éléments.
export function qualitesPrincipales(answers: TestAnswer[]): string[] {
  const counts    = new Map<string, number>()
  const firstPick = new Map<string, number>()
  const keyOrder  = Object.keys(QUALITE_LABELS)

  for (const answer of answers) {
    const situations = SITUATIONS[answer.version_test]
    if (!situations) continue
    const situation = situations.find(s => s.id === answer.situation_id)
    if (!situation) continue

    const q1 = situation.reponses.find(r => r.id === answer.reponse_1)?.qualite
    const q2 = situation.reponses.find(r => r.id === answer.reponse_2)?.qualite

    if (q1) {
      counts.set(q1, (counts.get(q1) ?? 0) + 1)
      firstPick.set(q1, (firstPick.get(q1) ?? 0) + 1)
    }
    if (q2) counts.set(q2, (counts.get(q2) ?? 0) + 1)
  }

  return Array.from(counts.keys())
    .filter(k => (counts.get(k) ?? 0) >= 2)
    .sort((a, b) => {
      const diff = (counts.get(b) ?? 0) - (counts.get(a) ?? 0)
      if (diff !== 0) return diff
      const fp = (firstPick.get(b) ?? 0) - (firstPick.get(a) ?? 0)
      if (fp !== 0) return fp
      return keyOrder.indexOf(a) - keyOrder.indexOf(b)
    })
    .slice(0, 3)
}

// Clés à afficher sur le profil : qualitesPrincipales s'il est rempli,
// sinon les 3 premières clés de qualitesTest (count décroissant, puis ordre QUALITE_LABELS).
// Aucune qualité déclarée (profils.qualites) n'entre ici.
export function troisPremieres(
  qualitesPrincipales: string[] | null,
  qualitesTest: Record<string, number> | null,
): string[] {
  if (qualitesPrincipales && qualitesPrincipales.length > 0) return qualitesPrincipales
  if (!qualitesTest) return []
  const keyOrder = Object.keys(QUALITE_LABELS)
  return Object.entries(qualitesTest)
    .sort(([a, ca], [b, cb]) => {
      const diff = cb - ca
      if (diff !== 0) return diff
      return keyOrder.indexOf(a) - keyOrder.indexOf(b)
    })
    .slice(0, 3)
    .map(([k]) => k)
}
