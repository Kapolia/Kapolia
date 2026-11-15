// Source unique des référentiels partagés entre l'onboarding candidat,
// le formulaire de publication et lib/matching.ts.
// Ne jamais redéfinir ces listes localement ailleurs.

// Domaines — labels longs canoniques
export const DOMAINES = [
  'Tech & Ingénierie',
  'Design & Créativité',
  'Marketing & Com',
  'Finance & Compta',
  'RH & Recrutement',
  'Commerce & Vente',
  'Opérations & Logistique',
  'Conseil & Stratégie',
  'Santé',
  'Droit',
  'Éducation',
  'Hôtellerie & Restauration',
  'Industrie & Production',
  'Autre',
]

// Niveaux d'expérience — cinq niveaux, granularité offre, utilisés des deux côtés
export const EXPERIENCES = [
  'Sans expérience',
  '1-2 ans',
  '3-5 ans',
  '5-10 ans',
  '+10 ans',
]

// Types de contrat — labels stockés dans offres.type_contrat
export const TYPES_CONTRAT = ['CDI', 'CDD', 'Freelance', 'Alternance', 'Stage', 'Intérim', 'Saisonnier']

// Mapping valeurs DB mode_travail → libellés d'affichage (rétrocompatible)
export const TELETRAVAIL: Record<string, string> = {
  '100% remote':     'Télétravail complet',
  'Hybride':         'Télétravail partiel',
  'Occasionnel':     'Télétravail occasionnel',
  '100% présentiel': 'Pas de télétravail',
}

// Préférences de télétravail candidat — clés stockées dans profils.mode_travail
export const PREFERENCES_TELETRAVAIL: { key: string; label: string; description: string }[] = [
  { key: 'remote',      label: 'Télétravail complet',    description: 'Entièrement à distance' },
  { key: 'hybride',     label: 'Télétravail partiel',    description: 'Une partie de la semaine à distance' },
  { key: 'occasionnel', label: 'Télétravail occasionnel', description: 'Quelques jours par mois à distance' },
  { key: 'presentiel',  label: 'Pas de télétravail',     description: 'Tous les jours sur le lieu de travail' },
  { key: 'flexible',    label: 'Sans préférence',        description: "Le télétravail n'est pas un critère pour moi" },
]

// Options mode_travail ordonnées, avec label court et label long
export const TELETRAVAIL_OPTIONS: { value: string; label: string; labelLong: string }[] = [
  { value: '100% remote',     label: 'Complet',           labelLong: 'Télétravail complet' },
  { value: 'Hybride',         label: 'Partiel',           labelLong: 'Télétravail partiel' },
  { value: 'Occasionnel',     label: 'Occasionnel',       labelLong: 'Télétravail occasionnel' },
  { value: '100% présentiel', label: 'Pas de télétravail', labelLong: 'Pas de télétravail' },
]

// Renvoie true si le mode_travail implique au moins du télétravail.
// Remplacera à terme la colonne offres.teletravail (que le formulaire n'écrit jamais).
export function offreAvecTeletravail(mode_travail: string | null | undefined): boolean {
  return mode_travail === '100% remote' || mode_travail === 'Hybride' || mode_travail === 'Occasionnel'
}

// Durées de CDD — valeur stockée en base + libellé d'affichage
export const DUREES_CONTRAT: { value: string; label: string }[] = [
  { value: 'moins_3', label: 'Moins de 3 mois' },
  { value: '3_6',     label: '3 à 6 mois' },
  { value: '6_12',    label: '6 à 12 mois' },
  { value: 'plus_12', label: 'Plus de 12 mois' },
]

// Temps de travail — valeur stockée en base + libellé d'affichage
export const TEMPS_TRAVAIL: { value: string; label: string }[] = [
  { value: 'temps_plein',    label: 'Temps plein' },
  { value: 'temps_partiel',  label: 'Temps partiel' },
]

// Horaires — valeur stockée en base + libellé d'affichage
export const HORAIRES: { value: string; label: string }[] = [
  { value: 'journee',  label: 'Travail en journée' },
  { value: 'nuit',     label: 'Travail de nuit' },
  { value: 'week_end', label: 'Le week-end' },
  { value: 'equipes',  label: 'En équipes alternées' },
]

// Permis et habilitations — valeur stockée en base + libellé d'affichage
export const PERMIS: { value: string; label: string }[] = [
  { value: 'B',     label: 'Permis B' },
  { value: 'C_CE',  label: 'Permis C ou CE' },
  { value: 'D',     label: 'Permis D' },
  { value: 'CACES', label: 'CACES' },
]

export const PERMIS_AUTRES: { value: string; label: string }[] = [
  { value: 'A',                 label: 'Permis A' },
  { value: 'BE',                label: 'Permis BE' },
  { value: 'C1',                label: 'Permis C1' },
  { value: 'FIMO_FCO',          label: 'FIMO / FCO' },
  { value: 'HABILITATION_ELEC', label: 'Habilitation électrique' },
  { value: 'VTC_TAXI',          label: 'Carte VTC ou taxi' },
]

// Renvoie le label d'une valeur dans un référentiel, ou null si inconnue.
// Accepte un tableau de chaînes (TYPES_CONTRAT), un tableau { value, label }
// ou un objet clé → label (TELETRAVAIL).
export function labelDe(
  constante: string[] | { value: string; label: string }[] | Record<string, string>,
  value: string,
): string | null {
  if (Array.isArray(constante)) {
    if (constante.length === 0) return null
    if (typeof constante[0] === 'string') {
      return (constante as string[]).includes(value) ? value : null
    }
    const found = (constante as { value: string; label: string }[]).find(e => e.value === value)
    return found?.label ?? null
  }
  return (constante as Record<string, string>)[value] ?? null
}

// Date de la migration qui a ajouté les colonnes permis/horaires/etc.
// Avant cette date, un tableau permis vide signifie « non renseigné ».
export const DATE_MIGRATION_CRITERES = Date.parse('2026-11-05T00:11:00Z')

// Normalise date_debut vers un code interne pour le filtre prise de poste.
// today est injecté en paramètre pour permettre les tests unitaires.
export function normaliserDebut(
  date_debut: string | null | undefined,
  today?: Date,
): 'immediat' | 'mois' | 'trois_mois' | 'plus_tard' | null {
  if (!date_debut) return null
  const val = date_debut.trim()

  // 'immediat' / 'Immédiat' et variantes (sans casse ni accents)
  const norm = val.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (norm === 'immediat') return 'immediat'

  // Valeurs texte connues
  if (val === 'Dans le mois') return 'mois'
  if (val === 'Dans 3 mois')  return 'trois_mois'

  // Date ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const date = new Date(val + 'T00:00:00')
    if (isNaN(date.getTime())) return null
    const ref = today ?? new Date()
    ref.setHours(0, 0, 0, 0)
    const diffDays = (date.getTime() - ref.getTime()) / 86400000
    if (diffDays <= 0)  return 'immediat'
    if (diffDays <= 30) return 'mois'
    if (diffDays <= 90) return 'trois_mois'
    return 'plus_tard'
  }

  return null
}

// Types de poste candidat — clés stockées dans profils.type_poste (text[])
export const TYPES_POSTE: { key: string; label: string }[] = [
  { key: 'cdi',        label: 'CDI' },
  { key: 'cdd',        label: 'CDD' },
  { key: 'freelance',  label: 'Freelance / Mission' },
  { key: 'alternance', label: 'Alternance / Stage' },
  { key: 'ouvert',     label: 'Ouvert(e) à tout' },
]

// Référentiel de compétences par domaine — source unique partagée entre le formulaire
// recruteur, le parcours candidat et le moteur de matching.
// Libellés canoniques : c'est la valeur stockée, sans exemples ni parenthèses de marque.
// Un même libellé peut figurer dans plusieurs domaines (ex. "Lean management" dans
// Opérations, Conseil et Industrie) — c'est intentionnel pour le cross-matching.
export const COMP_REF: Record<string, string[]> = {
  'Tech & Ingénierie': [
    'JavaScript', 'TypeScript', 'React', 'Vue.js', 'Angular', 'Node.js', 'Python',
    'SQL', 'Git', 'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure',
    'REST API', 'GraphQL', 'CI/CD', 'Tests automatisés', 'Architecture logicielle',
    'Sécurité applicative', 'Machine learning', 'Linux', 'Scripting Shell',
    'Next.js', 'Nuxt.js', 'PostgreSQL', 'MongoDB', 'Microservices', 'DevOps',
    'Algorithmique', 'Méthodes agiles', 'Scrum',
    'Java', 'PHP', 'Cybersécurité', 'Administration système',
    'Data engineering', 'Terraform',
  ],
  'Design & Créativité': [
    'Figma', 'Adobe XD', 'Sketch', 'Adobe Photoshop', 'Adobe Illustrator',
    'Adobe Premiere Pro', 'After Effects', 'InDesign', 'Prototypage', 'Wireframing',
    'UX Research', 'Tests utilisateurs', 'Design system', 'Direction artistique',
    'Identité visuelle', 'Motion design', 'Typographie', 'UI design',
    'Accessibilité numérique', 'Webdesign',
    'Illustration', 'Photographie', 'UX Writing', 'Modélisation 3D',
  ],
  'Marketing & Com': [
    'SEO', 'SEA', 'Stratégie de contenu', 'Email marketing', 'Marketing automation',
    'CRM', 'Google Analytics', 'Réseaux sociaux', 'Community management',
    'Rédaction web', 'Relations presse', 'Brand content', 'Inbound marketing',
    'Growth hacking', 'A/B testing', 'Gestion de budget médias',
    'Création de campagnes', 'Veille concurrentielle', 'Copywriting',
    'Influence et partenariats', 'Planification éditoriale', 'Veille média',
    'Stratégie média', 'E-réputation', 'Achat d\'espace',
    'Études marketing', 'Marketing produit', 'Événementiel',
  ],
  'Finance & Compta': [
    'Comptabilité générale', 'Contrôle de gestion', 'Gestion de trésorerie',
    'Reporting financier', 'Analyse financière', 'Consolidation', 'Audit interne',
    'Fiscalité', 'Excel', 'Power BI', 'ERP', 'Gestion budgétaire',
    'IFRS', 'Normes comptables', 'Modélisation financière', 'Due diligence',
    'Clôture des comptes', 'Prévisions financières', 'Gestion des risques financiers',
    'Business plan', 'Tableaux de bord', 'Gestion de la paie',
    'Comptabilité analytique', 'Comptabilité fournisseurs', 'Comptabilité clients',
    'Liasse fiscale', 'Levée de fonds',
  ],
  'RH & Recrutement': [
    // Recrutement
    'Sourcing', 'Chasse de têtes', "Rédaction d'annonces", 'Stratégie de recrutement',
    'Sélection de candidats', "Conduite d'entretiens", 'Gestion des talents',
    'ATS', 'Marque employeur', 'Onboarding',
    // Entretiens et évaluation
    'Entretiens annuels', 'Évaluation de la performance',
    // Rémunération et paie
    'Gestion de la paie', 'Politique de rémunération', 'Avantages sociaux',
    'Négociation salariale', 'Déclarations sociales',
    // Formation
    'Gestion de la formation', 'Plan de développement des compétences',
    'Ingénierie de formation', 'Évaluation des formations', 'Partenariats de formation',
    // Gestion des carrières
    'GPEC', 'Gestion des carrières', 'Mobilité interne', 'Bilan de compétences', 'Coaching',
    // Administration RH
    'Gestion administrative du personnel', 'Gestion des absences',
    'Bilan social', 'Reporting RH', 'Tableaux de bord RH',
    // Droit et conformité
    'Droit du travail', 'Veille réglementaire',
    // Relations sociales
    'Dialogue social', 'Négociation collective',
    // Conseil et stratégie RH
    'Développement RH', 'Politique RH', 'Analyse des besoins RH',
    'Conseil aux managers', 'Processus RH', 'SIRH', 'Digitalisation RH',
    // Bien-être et conditions de travail
    'Diversité et inclusion', 'Qualité de vie au travail',
    'Prévention des risques psychosociaux', 'Conditions de travail',
    'Aménagement de poste', 'Climat social',
    // Communication
    'Gestion des conflits', 'Communication interne',
  ],
  'Commerce & Vente': [
    'Prospection commerciale', 'Négociation', 'Account management', 'CRM', 'Closing',
    'Vente B2B', 'Vente B2C', 'Développement commercial', 'Analyse du pipeline',
    "Gestion des appels d'offres", 'Présentation commerciale', 'Fidélisation client',
    'Gestion des objections', 'Reporting commercial', 'Business development',
    'Partenariats stratégiques', 'Upsell', 'Cross-sell', 'Social selling',
    'Outbound sales', 'Analyse de marché',
    'Stratégie commerciale', 'Animation commerciale', 'Administration des ventes',
    'Avant-vente', 'Analyse des besoins clients', 'Service après-vente', 'Management commercial',
  ],
  'Opérations & Logistique': [
    'Gestion de la supply chain', 'Planification S&OP', 'Gestion des stocks',
    'Transport et distribution', 'Achats', 'Relations fournisseurs',
    'Optimisation des flux', "Gestion d'entrepôt", 'ERP', 'Lean management',
    'Amélioration continue', 'Gestion des risques opérationnels',
    'Douane', 'Commerce international', 'Coordination multi-sites',
    'Sourcing fournisseurs', "Gestion des appels d'offres", 'Pilotage KPIs',
    'Import', 'Export', 'Gestion des retours', 'Gestion de projet',
    'Contrats fournisseurs',
    'Approvisionnement', 'WMS', 'Gestion de la qualité',
    'Six Sigma', 'Planification de production',
  ],
  'Conseil & Stratégie': [
    'Diagnostic stratégique', 'Analyse de marché', 'Business plan',
    'Conduite du changement', 'Gestion de projet', "Animation d'ateliers",
    'Modélisation financière', 'Due diligence', 'Transformation organisationnelle',
    'Présentation dirigeants', 'Structuration de mission', 'Analyse de données',
    'Benchmarking', 'Stratégie de croissance', 'Fusions-acquisitions',
    'Lean management', 'Six Sigma', 'Gestion des parties prenantes', 'Facilitation',
    'Rédaction de livrables', 'Pilotage de la performance',
    'RSE', 'Design thinking', 'Intelligence économique', 'Audit organisationnel',
  ],
  'Santé': [
    'Soins infirmiers', 'Soins de plaies', 'Pharmacologie', 'Bloc opératoire',
    'Urgences', 'SAMU', 'Réanimation', 'ECG', 'Prise en charge de la douleur',
    'Dossier patient informatisé', 'Hygiène hospitalière',
    'Gestion des risques cliniques', 'Pédiatrie', 'Gériatrie', 'Psychiatrie',
    'Médecine du travail', 'Consultation médicale', 'Coordination de soins',
    'Éducation thérapeutique', 'Prescription médicale',
    'Kinésithérapie', 'Biologie médicale', 'Radiologie', 'Chirurgie', 'Soins palliatifs',
  ],
  'Droit': [
    'Droit des contrats', 'Droit du travail', 'Droit des sociétés', 'Droit fiscal',
    'Contentieux', 'Négociation de contrats', "Rédaction d'actes juridiques",
    'Fusions-acquisitions', 'Propriété intellectuelle', 'Droit de la concurrence',
    'Conformité', 'Droit pénal des affaires', 'Arbitrage et médiation',
    'RGPD', 'Droit immobilier', 'Droit international',
    'Restructuration', 'Insolvabilité', 'Conseil juridique', 'LBO',
    "Financement d'acquisition", 'Droit public', 'Droit administratif',
    'Droit commercial', 'Droit de la famille', 'Marchés publics', 'Droit de l\'environnement',
  ],
  'Éducation': [
    'Conception pédagogique', 'Ingénierie de formation', 'Animation de formation',
    'E-learning', 'Évaluation des apprentissages', 'Différenciation pédagogique',
    'Gestion de classe', 'Accompagnement individualisé',
    'Formation professionnelle continue', 'Création de contenus pédagogiques',
    'Tutorat et mentorat', 'Bilan de compétences', 'Qualiopi',
    'Outils numériques éducatifs', 'Pédagogie active', 'Pédagogie inversée',
    'Référentiel de compétences', 'Parcours blended', "Gestion d'un CFA",
    'Analyse des besoins en formation', 'Accompagnement VAE',
    'Enseignement supérieur', 'FLE',
  ],
  'Hôtellerie & Restauration': [
    'Cuisine', 'Pâtisserie', 'Service en salle', 'Sommellerie',
    'HACCP', 'Accueil client', 'Gestion des stocks alimentaires', "Gestion d'équipe",
    'Revenue management', 'PMS', 'Gestion des événements', 'Banquets',
    'Bar et cocktails', 'Housekeeping', 'Gestion des coûts',
    'Relations fournisseurs', 'Gestion de caisse', 'Expérience client',
    'Room service', 'ISO 22000',
    'Réception hôtelière', 'Gestion des réservations', 'Boulangerie',
  ],
  'Industrie & Production': [
    'Lean management', 'Amélioration continue', 'Gestion de production',
    'Contrôle qualité', 'Maintenance préventive', 'Maintenance curative', 'GMAO',
    'Automatisation', 'Robotique', 'Approvisionnement', 'HSE', 'CAO',
    'Métrologie', 'Planification de production', 'Six Sigma',
    'TRS', 'Normes ISO',
    'Lecture de plans techniques', 'Gestion des non-conformités',
    'Supply chain industrielle', 'Électrotechnique', 'Mécanique industrielle',
    'Soudure', 'Habilitations électriques', 'AMDEC', 'Hydraulique', 'Pneumatique',
  ],
  'Autre': [
    'Gestion de projet', "Management d'équipe", 'Communication',
    'Conduite du changement', 'Analyse de données', 'Excel', 'Suite Microsoft Office',
    'Service client', 'Rédaction professionnelle', 'Organisation et priorisation',
    'Négociation', 'Gestion budgétaire',
    'Présentation orale', 'Coordination inter-services', 'Reporting',
    'Veille et recherche', 'Animation de formation', 'Gestion administrative',
    'Résolution de problèmes', 'Gestion de la relation client', 'RSE', 'RGPD',
    'Power BI', 'ERP', 'Analyse de marché', 'Facilitation',
    'Google Workspace', 'Gestion de crise',
  ],
}
