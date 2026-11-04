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
export const TYPES_CONTRAT = ['CDI', 'CDD', 'Freelance', 'Alternance', 'Stage', 'Intérim']

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
