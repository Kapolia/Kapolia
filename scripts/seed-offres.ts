/**
 * Seed 20 offres de test dans Supabase.
 * Usage : SEED_PASSWORD=xxx npx tsx scripts/seed-offres.ts
 *
 * Les IDs créés sont sauvegardés dans scripts/.seed-ids.json
 * pour pouvoir les supprimer proprement via scripts/clean-offres.ts
 */

import './env'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SEED_EMAIL    = 'PaulQuiquet@gmail.com'
const SEED_IDS_PATH = join(__dirname, '.seed-ids.json')

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Variables Supabase introuvables dans .env.local.')
  console.error('    Vérifiez que .env.local contient NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function authenticate(): Promise<void> {
  const password = process.env.SEED_PASSWORD
  if (!password) {
    console.error('❌  Variable SEED_PASSWORD manquante.')
    console.error('    Lancez : SEED_PASSWORD=xxx npx tsx scripts/seed-offres.ts')
    process.exit(1)
  }

  console.log(`🔐  Connexion en tant que ${SEED_EMAIL}…`)
  const { data, error } = await sb.auth.signInWithPassword({ email: SEED_EMAIL, password })
  if (error || !data.user) {
    console.error(`❌  Échec de l'authentification : ${error?.message ?? 'réponse vide'}`)
    process.exit(1)
  }
  console.log(`✅  Connecté — user_id : ${data.user.id}\n`)
}

// ─── Recruiter ID ──────────────────────────────────────────────────────────────

async function getRecruteurId(): Promise<string> {
  const { data: { user } } = await sb.auth.getUser()
  if (user?.id) return user.id

  // Fallback: first recruteur profile
  const { data: profils } = await sb
    .from('profils')
    .select('user_id')
    .eq('type_compte', 'recruteur')
    .limit(1)
  if (profils?.[0]?.user_id) return profils[0].user_id

  throw new Error('Impossible de déterminer le recruteur_id après connexion.')
}

// ─── Date helpers ──────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString()
}

// ─── Offres data ───────────────────────────────────────────────────────────────

function buildOffres(recruteurId: string) {
  return [
    // ── 1 · Tech ──────────────────────────────────────────────────────────────
    {
      recruteur_id:       recruteurId,
      titre:              'Développeur Frontend React / TypeScript',
      domaine:            'Tech',
      type_contrat:       'CDI',
      ville:              'Paris',
      mode_travail:       'Hybride',
      jours_remote:       2,
      experience:         '3-5 ans',
      salaire_min:        45000,
      salaire_max:        55000,
      periode_salaire:    'annuel',
      entreprise_nom:     'NovaCraft Studio',
      description:        "NovaCraft Studio est une agence product-centric qui construit des interfaces web et mobiles pour des clients SaaS en Europe. Nous valorisons la qualité du code, la culture de design et l'autonomie.\n\nEn tant que Développeur Frontend, vous intégrerez l'équipe produit (5 personnes) et prendrez en charge le développement de nouvelles fonctionnalités, la refonte de composants existants et l'amélioration des performances.\n\nVous travaillerez en étroite collaboration avec les designers et le backend, dans un cycle Agile court (sprints de 2 semaines) avec des revues de code systématiques.\n\nPoste en hybride : 3 jours au bureau Paris 11e, 2 jours en remote.",
      missions:           ['Développer et maintenir des composants React réutilisables', 'Contribuer à la design system interne (Storybook)', 'Optimiser les performances (Core Web Vitals)', 'Participer aux revues de code et à la définition technique'],
      profil_recherche:   "3 ans minimum d'expérience en React.\nMaîtrise de TypeScript.\nBonne compréhension du CSS moderne (Tailwind ou CSS-in-JS).\nExpérience avec des outils de test (Vitest, Testing Library).\nSens du détail et appétence pour le design.",
      competences:        ['React', 'TypeScript', 'Storybook', 'Tailwind CSS', 'Vite'],
      competences_bonus:  ['Next.js', 'Figma', 'Cypress'],
      valeurs:            ['Qualité', 'Autonomie', 'Design'],
      avantages:          ['Tickets restaurant', 'Mutuelle premium', 'Remboursement transport 100%', 'Budget formation 1 500 €/an'],
      process_recrutement:['Appel RH 30 min', 'Test technique (2h, à faire chez soi)', 'Entretien technique + code review', 'Rencontre équipe'],
      date_debut:         'Dans le mois',
      deplacements:       'Jamais',
      teletravail:        true,
      pays:               'France',
      langues:            ['fr'],
      active:             true,
      statut:             'publiée',
      statut_publication: 'publiée',
      created_at:         daysAgo(1),
    },

    // ── 2 · Tech ──────────────────────────────────────────────────────────────
    {
      recruteur_id:       recruteurId,
      titre:              'Data Scientist — NLP & Machine Learning',
      domaine:            'Tech',
      type_contrat:       'CDI',
      ville:              'Lyon',
      mode_travail:       '100% remote',
      jours_remote:       5,
      experience:         '3-5 ans',
      salaire_min:        50000,
      salaire_max:        65000,
      periode_salaire:    'annuel',
      entreprise_nom:     'DataPulse',
      description:        "DataPulse est une scale-up lyonnaise qui développe une plateforme d'analyse de sentiment et de veille médiatique pour les équipes communication de grands groupes.\n\nNous cherchons un Data Scientist pour renforcer notre équipe R&D (8 personnes). Vous travaillerez sur des modèles de traitement du langage naturel, l'amélioration de nos pipelines de données et l'expérimentation de nouveaux algorithmes.\n\nToute la stack est dans le cloud (AWS). Les livrables sont intégrés directement dans notre produit SaaS par l'équipe Engineering.",
      missions:           ["Entraîner et évaluer des modèles NLP (classification, extraction d'entités)", 'Construire et maintenir des pipelines MLOps (MLflow, Airflow)', 'Analyser les données clients pour générer des insights produit', "Collaborer avec l'équipe Engineering pour l'industrialisation des modèles"],
      profil_recherche:   "Formation Bac+5 en informatique, statistiques ou domaine connexe.\n3 ans d'expérience en machine learning appliqué.\nMaîtrise de Python (scikit-learn, HuggingFace, PyTorch).\nBonne connaissance SQL et des bases de données colonnaires.\nAnglais professionnel requis.",
      competences:        ['Python', 'PyTorch', 'HuggingFace', 'MLflow', 'AWS SageMaker', 'SQL'],
      competences_bonus:  ['Spark', 'dbt', 'LLM fine-tuning'],
      valeurs:            ['Innovation', 'Rigueur', 'Impact'],
      avantages:          ['100% remote', 'Matériel au choix (budget 2 500 €)', 'Stock options', 'Mutuelle Alan', 'Séminaire annuel en présentiel'],
      process_recrutement:['Entretien RH visio', 'Study case technique (take-home)', "Soutenance du study case avec l'équipe"],
      date_debut:         'Immédiat',
      deplacements:       'Jamais',
      teletravail:        true,
      pays:               'France',
      langues:            ['fr', 'en'],
      active:             true,
      statut:             'publiée',
      statut_publication: 'publiée',
      created_at:         daysAgo(3),
    },

    // ── 3 · Tech ──────────────────────────────────────────────────────────────
    {
      recruteur_id:       recruteurId,
      titre:              'Ingénieur DevOps / SRE',
      domaine:            'Tech',
      type_contrat:       'CDI',
      ville:              'Nantes',
      mode_travail:       'Hybride',
      jours_remote:       3,
      experience:         '3-5 ans',
      salaire_min:        55000,
      salaire_max:        70000,
      periode_salaire:    'annuel',
      entreprise_nom:     'InfraBridge',
      description:        "InfraBridge accompagne des entreprises industrielles dans leur transformation cloud. Nous gérons des infrastructures critiques pour des clients dans l'énergie, la logistique et la santé.\n\nNous recrutons un Ingénieur DevOps / SRE pour rejoindre notre équipe Infrastructure (6 personnes). Vous serez responsable de la fiabilité, de la performance et de la sécurité de nos environnements de production.\n\nVous participerez également à l'évangélisation des bonnes pratiques DevOps auprès des équipes de développement clients.",
      missions:           ['Maintenir et améliorer les pipelines CI/CD (GitLab CI, ArgoCD)', "Gérer les clusters Kubernetes (EKS) et l'infrastructure Terraform", 'Mettre en place la supervision (Prometheus, Grafana, alerting)', 'Participer aux astreintes et aux post-mortems', "Accompagner les équipes dev sur les sujets d'infrastructure"],
      profil_recherche:   "Expérience significative sur Kubernetes et l'écosystème cloud (AWS ou GCP).\nMaîtrise de l'IaC (Terraform, Pulumi).\nBonne connaissance des outils CI/CD modernes.\nRigueur, sens de la documentation et esprit d'équipe.",
      competences:        ['Kubernetes', 'Terraform', 'GitLab CI', 'Prometheus', 'AWS', 'Docker'],
      competences_bonus:  ['ArgoCD', 'Vault', 'eBPF'],
      valeurs:            ['Fiabilité', 'Collaboration', 'Amélioration continue'],
      avantages:          ['RTT (10 jours/an)', 'Tickets restaurant Swile', 'Intéressement', 'Remboursement transport 50%', 'Télétravail 3j/semaine'],
      process_recrutement:['Screening RH', 'Entretien technique (1h) avec le lead SRE', 'Entretien de culture fit avec le CTO'],
      date_debut:         'Dans le mois',
      deplacements:       'Occasionnels',
      teletravail:        true,
      pays:               'France',
      langues:            ['fr', 'en'],
      active:             true,
      statut:             'publiée',
      statut_publication: 'publiée',
      created_at:         daysAgo(5),
    },

    // ── 4 · Tech ──────────────────────────────────────────────────────────────
    {
      recruteur_id:       recruteurId,
      titre:              'Chef de Projet Digital',
      domaine:            'Tech',
      type_contrat:       'CDI',
      ville:              'Caen',
      mode_travail:       'Hybride',
      jours_remote:       2,
      experience:         '3-5 ans',
      salaire_min:        40000,
      salaire_max:        50000,
      periode_salaire:    'annuel',
      entreprise_nom:     'NormandieNum',
      description:        "NormandieNum est une agence de transformation digitale installée à Caen depuis 2018. Nous accompagnons des collectivités locales, des PME normandes et quelques grands comptes dans leurs projets web, e-commerce et digitalisation interne.\n\nNous recrutons un Chef de Projet Digital pour piloter un portefeuille de 4 à 6 projets simultanément, du cadrage à la livraison.\n\nVous serez l'interlocuteur principal du client, en charge de la coordination des équipes techniques et créatives (développeurs, designers, intégrateurs).",
      missions:           ['Cadrer et rédiger les spécifications fonctionnelles', 'Planifier les projets et suivre les budgets', 'Animer les réunions de suivi client (hebdomadaires)', 'Coordonner les équipes techniques et assurer la livraison dans les délais', 'Identifier et gérer les risques projet'],
      profil_recherche:   "3 ans d'expérience en gestion de projets digitaux (web, appli, e-commerce).\nCapacité à comprendre les enjeux techniques sans forcément coder.\nExcellentes qualités rédactionnelles et relationnelles.\nMaîtrise d'outils type Notion, Jira, Figma.",
      competences:        ['Gestion de projet Agile', 'Rédaction de specs', 'Jira', 'Figma (lecture)', 'Relation client'],
      competences_bonus:  ['Notions HTML/CSS', 'Hubspot', 'Google Analytics'],
      valeurs:            ['Proximité client', 'Rigueur', 'Territoire'],
      avantages:          ['Tickets restaurant', 'Mutuelle', 'Remboursement vélo/transport', '2j télétravail/semaine'],
      process_recrutement:['Entretien RH', 'Entretien avec le DG et un chef de projet senior', "Rencontre de l'équipe"],
      date_debut:         'Dans 3 mois',
      deplacements:       'Occasionnels',
      teletravail:        true,
      pays:               'France',
      langues:            ['fr'],
      active:             true,
      statut:             'publiée',
      statut_publication: 'publiée',
      created_at:         daysAgo(8),
    },

    // ── 5 · Tech — Stage ──────────────────────────────────────────────────────
    {
      recruteur_id:       recruteurId,
      titre:              'Développeur Backend Python — Stage 6 mois',
      domaine:            'Tech',
      type_contrat:       'Stage',
      ville:              'Paris',
      mode_travail:       '100% remote',
      jours_remote:       5,
      experience:         'Sans expérience',
      salaire_min:        null,
      salaire_max:        null,
      periode_salaire:    null,
      entreprise_nom:     'Clarix AI',
      description:        "Clarix AI développe des outils d'automatisation basés sur les LLMs pour les équipes juridiques et RH. Start-up de 12 personnes fondée en 2024, nous sommes en pleine construction de notre plateforme.\n\nNous ouvrons un stage de 6 mois pour un(e) développeur(euse) backend Python enthousiaste qui veut toucher à l'IA appliquée dans un contexte réel.\n\nVous travaillerez directement avec les fondateurs et l'équipe technique. Le stage est 100% remote avec des points d'équipe hebdomadaires en visio.",
      missions:           ["Développer des endpoints FastAPI pour l'API principale", "Intégrer des APIs LLM (OpenAI, Anthropic) pour les workflows d'automatisation", 'Écrire des tests et documenter le code', 'Participer aux sprints et aux code reviews'],
      profil_recherche:   "Étudiant(e) Bac+4/5 en informatique ou école d'ingénieurs.\nBonnes bases en Python (POO, asyncio).\nCuriosité pour les LLMs et l'IA générative.\nCapacité à travailler de manière autonome en remote.",
      competences:        ['Python', 'FastAPI', 'PostgreSQL', 'Git'],
      competences_bonus:  ['Docker', 'LangChain', 'Pydantic'],
      valeurs:            ['Innovation', 'Curiosité', 'Impact'],
      avantages:          ['100% remote', 'Mentoring direct par les fondateurs', 'Gratification légale', 'Équipement fourni'],
      process_recrutement:['Entretien en visio avec un fondateur', 'Petit exercice technique (1h)'],
      date_debut:         'Immédiat',
      deplacements:       'Jamais',
      teletravail:        true,
      pays:               'France',
      langues:            ['fr'],
      active:             true,
      statut:             'publiée',
      statut_publication: 'publiée',
      created_at:         daysAgo(2),
    },

    // ── 6 · Design ────────────────────────────────────────────────────────────
    {
      recruteur_id:       recruteurId,
      titre:              'UX/UI Designer Product',
      domaine:            'Design',
      type_contrat:       'CDI',
      ville:              'Rouen',
      mode_travail:       'Hybride',
      jours_remote:       2,
      experience:         '3-5 ans',
      salaire_min:        38000,
      salaire_max:        46000,
      periode_salaire:    'annuel',
      entreprise_nom:     'Agence Pixel & Cie',
      description:        "Agence Pixel & Cie est une agence digitale rouennaise spécialisée dans le design d'interfaces et le développement web pour des clients retail, santé et services publics.\n\nNous cherchons un(e) UX/UI Designer pour intégrer notre équipe design (3 designers, 1 motion). Vous concevrez des parcours utilisateurs et des interfaces pour des projets variés : sites web, applications mobiles et outils internes.\n\nVous maîtrisez Figma, appréciez les tests utilisateurs et savez argumenter vos choix de design face à des clients.",
      missions:           ['Mener des workshops de découverte et des audits UX', 'Concevoir des wireframes, prototypes et maquettes dans Figma', 'Préparer et animer des tests utilisateurs', "Collaborer avec les développeurs lors de l'intégration", 'Contribuer à la design system partagée'],
      profil_recherche:   "3 ans d'expérience en design produit ou en agence.\nPortfolio solide incluant des projets web et mobile.\nMaîtrise de Figma et des principes d'accessibilité.\nCapacité à travailler sur plusieurs projets simultanément.",
      competences:        ['Figma', 'Prototypage', 'Tests utilisateurs', 'Design system', 'Accessibilité RGAA'],
      competences_bonus:  ['Framer', 'Adobe Illustrator', 'Animation UI'],
      valeurs:            ['Créativité', 'Empathie utilisateur', 'Qualité'],
      avantages:          ['Tickets restaurant', 'Mutuelle', '2j télétravail', 'Budget conférences'],
      process_recrutement:['Entretien RH + revue portfolio', 'Brief design en live (2h)', "Rencontre avec l'équipe"],
      date_debut:         'Dans le mois',
      deplacements:       'Occasionnels',
      teletravail:        true,
      pays:               'France',
      langues:            ['fr'],
      active:             true,
      statut:             'publiée',
      statut_publication: 'publiée',
      created_at:         daysAgo(6),
    },

    // ── 7 · Design — Freelance ────────────────────────────────────────────────
    {
      recruteur_id:       recruteurId,
      titre:              'Graphiste / Directeur Artistique',
      domaine:            'Design',
      type_contrat:       'Freelance',
      ville:              'Paris',
      mode_travail:       '100% remote',
      jours_remote:       5,
      experience:         '3-5 ans',
      salaire_min:        null,
      salaire_max:        null,
      periode_salaire:    null,
      entreprise_nom:     'Studio Manon',
      description:        "Studio Manon est un studio de branding indépendant qui accompagne des marques challenger dans leur identité visuelle, leur packaging et leurs supports de communication.\n\nNous cherchons un(e) graphiste freelance pour une mission longue durée (6 à 12 mois, renouvelable) dans le cadre d'un pic d'activité. Vous travaillerez sur 3 à 4 marques simultanément en coordination avec la DA du studio.\n\nMission 100% remote, tarif journalier à négocier selon profil.",
      missions:           ['Créer des identités visuelles (logo, charte graphique)', 'Décliner la charte sur les supports print et digital', 'Préparer les fichiers pour impression (offset, sérigraphie)', 'Participer aux briefs clients et aux présentations'],
      profil_recherche:   "Portfolio exigé (branding, identité visuelle).\nMaîtrise de la suite Adobe (Illustrator, InDesign, Photoshop).\nSens aigu de la typographie et de la couleur.\nCapacité à respecter des deadlines serrées.",
      competences:        ['Adobe Illustrator', 'InDesign', 'Photoshop', 'Branding', 'Print & digital'],
      competences_bonus:  ['Motion design', 'After Effects', 'Packaging'],
      valeurs:            ['Exigence', 'Créativité', 'Esthétique'],
      avantages:          ['Remote total', 'Flexibilité horaires', 'Projets variés et stimulants'],
      process_recrutement:['Envoi du portfolio + TJM', 'Échange en visio avec la DA'],
      date_debut:         'Immédiat',
      deplacements:       'Jamais',
      teletravail:        true,
      pays:               'France',
      langues:            ['fr'],
      active:             true,
      statut:             'publiée',
      statut_publication: 'publiée',
      created_at:         daysAgo(10),
    },

    // ── 8 · Commerce ──────────────────────────────────────────────────────────
    {
      recruteur_id:       recruteurId,
      titre:              'Commercial Grands Comptes B2B',
      domaine:            'Commerce',
      type_contrat:       'CDI',
      ville:              'Paris',
      mode_travail:       'Hybride',
      jours_remote:       2,
      experience:         '3-5 ans',
      salaire_min:        42000,
      salaire_max:        55000,
      periode_salaire:    'annuel',
      entreprise_nom:     'BizForce Solutions',
      description:        "BizForce Solutions est un éditeur de logiciels RH (SIRH, paie, gestion des temps) qui compte 350 clients en France dont plusieurs ETI et grands groupes.\n\nNous recrutons un Commercial Grands Comptes pour développer notre portefeuille sur les entreprises de 500 à 5 000 salariés en Île-de-France.\n\nLe package comprend un fixe attractif + une variable déplafonnée. Voiture de fonction ou indemnité kilométrique selon préférence.\n\nVous rejoindrez une équipe commerciale de 12 personnes avec un onboarding structuré de 4 semaines.",
      missions:           ['Prospecter et qualifier des leads sur le segment ETI/Grands Comptes', 'Conduire des rendez-vous de découverte et des démos produit', 'Rédiger et négocier les propositions commerciales', 'Assurer le suivi et la fidélisation du portefeuille existant', "Atteindre un objectif annuel de chiffre d'affaires"],
      profil_recherche:   "3 ans minimum d'expérience en vente B2B complexe (cycle long).\nExpérience dans le SaaS ou les services aux entreprises appréciée.\nCapacité d'écoute, aisance à l'oral et sens de la négociation.\nPermis B obligatoire.",
      competences:        ['Vente B2B complexe', "Gestion d'un pipeline CRM", 'Négociation', 'Démonstration produit'],
      competences_bonus:  ['Salesforce', 'Connaissance du secteur RH', "Gestion d'appels d'offres"],
      valeurs:            ['Performance', 'Ambition', 'Éthique'],
      avantages:          ['Variable déplafonné', 'Voiture de fonction', 'Tickets restaurant', 'Mutuelle famille', "Plan d'intéressement"],
      process_recrutement:['Entretien RH', 'Jeu de rôle commercial avec le Directeur Commercial', 'Rencontre DG'],
      date_debut:         'Dans le mois',
      deplacements:       'Fréquents',
      teletravail:        true,
      pays:               'France',
      langues:            ['fr', 'en'],
      active:             true,
      statut:             'publiée',
      statut_publication: 'publiée',
      created_at:         daysAgo(4),
    },

    // ── 9 · Commerce ──────────────────────────────────────────────────────────
    {
      recruteur_id:       recruteurId,
      titre:              'Chargé d\'Affaires — BTP & Construction',
      domaine:            'Commerce',
      type_contrat:       'CDI',
      ville:              'Alençon',
      mode_travail:       'Hybride',
      jours_remote:       1,
      experience:         '1-2 ans',
      salaire_min:        32000,
      salaire_max:        42000,
      periode_salaire:    'annuel',
      entreprise_nom:     'Normandie Construct',
      description:        "Normandie Construct est une entreprise familiale de construction et de rénovation implantée dans l'Orne depuis 1987. Nous réalisons des projets pour des maîtres d'ouvrage privés (particuliers, promoteurs) et publics (collectivités).\n\nNous recrutons un(e) Chargé d'Affaires pour gérer un portefeuille de chantiers en cours et développer de nouveaux clients sur le département de l'Orne et la Sarthe.\n\nPoste terrain (1 à 2 visites de chantier par semaine) et commercial (prospection, devis, négociation).",
      missions:           ["Prospecter et répondre aux appels d'offres publics et privés", 'Établir les devis et propositions commerciales', "Piloter les chantiers en coordination avec les chefs d'équipe", 'Assurer le suivi client de la signature à la réception', "Contribuer à la réputation locale de l'entreprise"],
      profil_recherche:   "Formation Bac+2 à Bac+5 en BTP, génie civil ou commerce.\nPremière expérience en vente ou gestion de projets dans le secteur du bâtiment.\nAutonomie, sens des responsabilités et bon relationnel.\nPermis B indispensable.",
      competences:        ['Lecture de plans', 'Chiffrage / devis', 'Relation client', 'Suivi de chantier'],
      competences_bonus:  ['AutoCAD', 'Marchés publics', 'Gestion sous-traitants'],
      valeurs:            ['Terrain', 'Fiabilité', 'Ancrage local'],
      avantages:          ['Voiture de fonction', 'Téléphone professionnel', 'Primes sur objectifs', 'Mutuelle PME'],
      process_recrutement:['Entretien avec le Directeur', 'Visite de chantier avec le responsable technique'],
      date_debut:         'Dans le mois',
      deplacements:       'Fréquents',
      teletravail:        false,
      pays:               'France',
      langues:            ['fr'],
      active:             true,
      statut:             'publiée',
      statut_publication: 'publiée',
      created_at:         daysAgo(12),
    },

    // ── 10 · RH ───────────────────────────────────────────────────────────────
    {
      recruteur_id:       recruteurId,
      titre:              'Chargé(e) de Recrutement',
      domaine:            'RH',
      type_contrat:       'CDI',
      ville:              'Rouen',
      mode_travail:       'Hybride',
      jours_remote:       2,
      experience:         '1-2 ans',
      salaire_min:        28000,
      salaire_max:        35000,
      periode_salaire:    'annuel',
      entreprise_nom:     'TalentNormandie',
      description:        "TalentNormandie est un cabinet de recrutement et de conseil RH basé à Rouen, spécialisé dans les profils techniques, commerciaux et tertiaires en Normandie.\n\nNous cherchons un(e) Chargé(e) de Recrutement pour rejoindre notre équipe de 8 consultants. Vous gérerez un portefeuille de missions en recrutement permanent (CDI/CDD) et en chasse de tête pour des clients PME et ETI.\n\nVous aurez votre propre portefeuille client dès 6 mois et participerez aux actions de développement commercial.",
      missions:           ['Analyser les besoins clients et rédiger les annonces', 'Sourcer des candidats (jobboards, LinkedIn, CVthèque)', 'Conduire les entretiens de qualification téléphoniques et en présentiel', "Présenter les candidats aux clients et gérer le suivi jusqu'à l'intégration", 'Contribuer au développement du portefeuille client'],
      profil_recherche:   "Première expérience en recrutement (cabinet, intérim ou RH interne).\nCuriosité, écoute active et sens de la relation humaine.\nOrganisation et rigueur pour gérer plusieurs missions simultanément.\nGoût pour le challenge commercial.",
      competences:        ['Sourcing LinkedIn', "Conduite d'entretiens", "Rédaction d'annonces", 'Relation client'],
      competences_bonus:  ['ATS (Beetween, Taleez)', 'Chasseur de têtes', 'Secteur industriel'],
      valeurs:            ['Écoute', 'Confiance', 'Performance'],
      avantages:          ['Variable mensuel sur objectifs', 'Tickets restaurant', 'Mutuelle', '2j remote/semaine', 'Séminaire annuel'],
      process_recrutement:['Entretien RH', 'Entretien avec un consultant senior', 'Jeu de rôle recrutement'],
      date_debut:         'Immédiat',
      deplacements:       'Occasionnels',
      teletravail:        true,
      pays:               'France',
      langues:            ['fr'],
      active:             true,
      statut:             'publiée',
      statut_publication: 'publiée',
      created_at:         daysAgo(7),
    },

    // ── 11 · RH ───────────────────────────────────────────────────────────────
    {
      recruteur_id:       recruteurId,
      titre:              'Responsable Ressources Humaines',
      domaine:            'RH',
      type_contrat:       'CDI',
      ville:              'Nantes',
      mode_travail:       'Hybride',
      jours_remote:       2,
      experience:         '5-10 ans',
      salaire_min:        48000,
      salaire_max:        58000,
      periode_salaire:    'annuel',
      entreprise_nom:     'Groupe Ventura',
      description:        "Groupe Ventura est un groupe familial de distribution et de services (4 entités, 320 collaborateurs) basé à Nantes. Nous sommes en pleine structuration de notre fonction RH groupe et créons ce poste pour accompagner notre croissance.\n\nEn tant que Responsable RH, vous serez l'interlocuteur(trice) RH de référence pour les managers et les collaborateurs. Vous piloterez les projets RH transverses (GPEC, développement des compétences, qualité de vie au travail) et superviserez les opérations quotidiennes (paie, contrats, disciplinaire).\n\nPoste avec forte autonomie, reporting direct au DG.",
      missions:           ['Superviser la paie et les obligations sociales (en lien avec le cabinet externe)', 'Piloter le recrutement (10 à 20 postes/an)', 'Déployer le plan de formation annuel', 'Gérer les IRP (CSE) et les relations sociales', 'Conduire des projets RH transverses (SIRH, QVT, marque employeur)'],
      profil_recherche:   "Bac+5 en RH ou droit social.\n5 ans minimum d'expérience RH généraliste, idéalement dans une structure multi-sites.\nMaîtrise du droit du travail français.\nLeadership, pédagogie et capacité à gérer des sujets conflictuels.",
      competences:        ['Droit du travail', 'Relations sociales / IRP', 'Gestion de la paie', 'Développement RH', 'GPEC'],
      competences_bonus:  ['SIRH (Lucca, Eurécia)', 'Marque employeur', 'RSE'],
      valeurs:            ['Bienveillance', 'Exemplarité', 'Terrain'],
      avantages:          ['RTT (12 jours/an)', 'Mutuelle famille', 'Intéressement groupe', 'Tickets restaurant', 'Voiture de service pour déplacements inter-sites'],
      process_recrutement:['Entretien RH', 'Entretien DG + présentation cas pratique', 'Rencontre des managers'],
      date_debut:         'Dans 3 mois',
      deplacements:       'Occasionnels',
      teletravail:        true,
      pays:               'France',
      langues:            ['fr'],
      active:             true,
      statut:             'publiée',
      statut_publication: 'publiée',
      created_at:         daysAgo(15),
    },

    // ── 12 · Marketing — Alternance ───────────────────────────────────────────
    {
      recruteur_id:       recruteurId,
      titre:              'Community Manager — Alternance',
      domaine:            'Marketing',
      type_contrat:       'Alternance',
      ville:              'Paris',
      mode_travail:       'Hybride',
      jours_remote:       2,
      experience:         'Sans expérience',
      salaire_min:        null,
      salaire_max:        null,
      periode_salaire:    null,
      entreprise_nom:     'BuzzFactory Agency',
      description:        "BuzzFactory Agency est une agence social media spécialisée dans les marques de grande consommation et le secteur lifestyle. Nous gérons les comptes de 25 marques actives sur Instagram, TikTok et LinkedIn.\n\nNous cherchons un(e) alternant(e) Community Manager pour rejoindre notre équipe de 6 personnes, idéalement dès septembre.\n\nVous prendrez en charge la gestion de 3 à 4 comptes clients (animation, planification, reporting) sous la supervision d'un(e) Social Media Manager.",
      missions:           ['Créer et planifier les contenus (textes, visuels, vidéos courtes)', 'Animer les communautés et gérer les interactions', 'Mettre en place et suivre les campagnes payantes (Meta Ads, TikTok Ads)', 'Produire des reportings mensuels avec analyse des KPIs', 'Faire une veille concurrentielle et tendancielle'],
      profil_recherche:   "Étudiant(e) en école de commerce, communication ou licence marketing.\nVrai appétit pour les réseaux sociaux et les tendances du moment.\nSens créatif, plume agile et rigueur dans le planning.\nMaîtrise de Canva ou d'outils de création basique.",
      competences:        ['Instagram', 'TikTok', 'LinkedIn', 'Canva', 'Planification éditoriale'],
      competences_bonus:  ['Meta Ads', 'Montage vidéo (CapCut, Premiere)', 'Notion'],
      valeurs:            ['Créativité', 'Réactivité', 'Culture pop'],
      avantages:          ['Remboursement Navigo 50%', 'Tickets restaurant', 'Ambiance startup'],
      process_recrutement:['Test créatif (1 semaine de brief fictif)', 'Entretien avec la Social Media Manager', 'Rencontre de la directrice'],
      date_debut:         'Dans 3 mois',
      deplacements:       'Jamais',
      teletravail:        true,
      pays:               'France',
      langues:            ['fr'],
      active:             true,
      statut:             'publiée',
      statut_publication: 'publiée',
      created_at:         daysAgo(9),
    },

    // ── 13 · Marketing ────────────────────────────────────────────────────────
    {
      recruteur_id:       recruteurId,
      titre:              'Chef de Projet Marketing Digital',
      domaine:            'Marketing',
      type_contrat:       'CDI',
      ville:              'Lyon',
      mode_travail:       'Hybride',
      jours_remote:       3,
      experience:         '3-5 ans',
      salaire_min:        40000,
      salaire_max:        50000,
      periode_salaire:    'annuel',
      entreprise_nom:     'LeadFlow Marketing',
      description:        "LeadFlow Marketing est une agence de performance digitale qui accompagne des marques B2B et B2C dans leur acquisition en ligne. Nous gérons des budgets d'acquisition de 50 k€ à 2 M€/an pour une vingtaine de clients actifs.\n\nNous recrutons un(e) Chef de Projet Marketing Digital pour prendre en charge un portefeuille de 4 à 6 clients, superviser les campagnes SEO/SEA/Social Ads et être force de proposition stratégique.\n\nVous managerez un(e) traffic manager junior et collaborerez avec l'équipe créa.",
      missions:           ["Définir et piloter la stratégie d'acquisition digitale des clients", 'Superviser et optimiser les campagnes Google Ads, Meta Ads et LinkedIn Ads', 'Suivre les KPIs et produire des reportings clients mensuels', 'Coordonner les actions SEO avec le pôle éditorial', 'Manager un(e) traffic manager junior'],
      profil_recherche:   "3 ans d'expérience en marketing digital (agence ou annonceur).\nMaîtrise des plateformes Google Ads, Meta Ads et des outils analytics (GA4, Looker Studio).\nCapacité à analyser des données et à proposer des optimisations argumentées.\nAnglais professionnel (clients internationaux ponctuels).",
      competences:        ['Google Ads', 'Meta Ads', 'SEO', 'GA4 / Looker Studio', 'Management'],
      competences_bonus:  ['LinkedIn Ads', 'HubSpot', 'A/B testing'],
      valeurs:            ['Performance', 'Data-driven', 'Transparence'],
      avantages:          ['3j remote/semaine', 'Prime semestrielle sur résultats', 'Tickets restaurant', 'Mutuelle', 'Budget formation certifications Google/Meta'],
      process_recrutement:['Entretien RH + questionnaire', "Analyse d'un compte Google Ads fourni (45 min)", "Entretien avec la directrice de l'agence"],
      date_debut:         'Dans le mois',
      deplacements:       'Occasionnels',
      teletravail:        true,
      pays:               'France',
      langues:            ['fr', 'en'],
      active:             true,
      statut:             'publiée',
      statut_publication: 'publiée',
      created_at:         daysAgo(11),
    },

    // ── 14 · Finance ──────────────────────────────────────────────────────────
    {
      recruteur_id:       recruteurId,
      titre:              'Contrôleur de Gestion Senior',
      domaine:            'Finance',
      type_contrat:       'CDI',
      ville:              'Paris',
      mode_travail:       'Hybride',
      jours_remote:       2,
      experience:         '5-10 ans',
      salaire_min:        52000,
      salaire_max:        65000,
      periode_salaire:    'annuel',
      entreprise_nom:     'Groupe Clareo',
      description:        "Groupe Clareo est un groupe de services professionnels (audit, conseil, formation) qui compte 800 collaborateurs en France. Le groupe est en forte croissance (+20%/an) et structure sa direction financière.\n\nNous recrutons un(e) Contrôleur de Gestion Senior pour prendre en charge le reporting mensuel du groupe, le budget, les prévisions et l'amélioration des outils de pilotage.\n\nVous travaillerez en lien direct avec le DAF et les directeurs d'activité. Le poste offre une vision large sur la performance globale du groupe.",
      missions:           ['Coordonner la clôture mensuelle et produire le reporting groupe (P&L, tableaux de bord)', 'Animer le processus budgétaire annuel (budget, forecast)', 'Analyser les écarts budget/réel et formuler des recommandations', 'Améliorer et automatiser les outils de reporting (Excel, Power BI)', 'Accompagner les managers opérationnels dans la lecture des KPIs'],
      profil_recherche:   "Bac+5 finance / école de commerce.\n5 ans minimum en contrôle de gestion, idéalement dans un groupe multi-entités.\nExcellente maîtrise d'Excel / Power BI.\nRigueur analytique, pédagogie et capacité à travailler sous pression.",
      competences:        ['Contrôle de gestion', 'Reporting financier', 'Excel avancé', 'Power BI', 'Budgeting & Forecast'],
      competences_bonus:  ['SAP Business One', 'Power Query', 'DAX', 'Analyse RSE'],
      valeurs:            ['Rigueur', 'Fiabilité', 'Partage'],
      avantages:          ['RTT (10 jours/an)', 'Intéressement groupe', 'Mutuelle famille', 'Tickets restaurant', 'Remboursement transport 75%'],
      process_recrutement:['Entretien RH', 'Test technique Excel/Power BI (1h)', 'Entretien DAF', 'Rencontre DG'],
      date_debut:         'Dans 3 mois',
      deplacements:       'Jamais',
      teletravail:        true,
      pays:               'France',
      langues:            ['fr', 'en'],
      active:             true,
      statut:             'publiée',
      statut_publication: 'publiée',
      created_at:         daysAgo(14),
    },

    // ── 15 · Logistique ───────────────────────────────────────────────────────
    {
      recruteur_id:       recruteurId,
      titre:              'Responsable Supply Chain',
      domaine:            'Logistique',
      type_contrat:       'CDI',
      ville:              'Le Mans',
      mode_travail:       '100% présentiel',
      jours_remote:       0,
      experience:         '5-10 ans',
      salaire_min:        45000,
      salaire_max:        55000,
      periode_salaire:    'annuel',
      entreprise_nom:     'LogiSud Distribution',
      description:        "LogiSud Distribution est une PME de distribution de matériaux de construction (CA 60 M€, 180 collaborateurs) avec 3 dépôts régionaux. Nous fournissons des artisans, des négoces et des distributeurs sur tout le Grand Ouest.\n\nNous recrutons un(e) Responsable Supply Chain pour piloter les flux d'approvisionnement, la gestion des stocks et la relation avec nos transporteurs.\n\nVous managerez une équipe de 5 personnes (approvisionneurs, gestionnaires de stocks) et rapporterez au Directeur Opérations.",
      missions:           ['Planifier et optimiser les approvisionnements (MRP, gestion des réassorts)', 'Piloter les indicateurs de performance (taux de service, rotation des stocks, OTD)', 'Négocier avec les transporteurs et optimiser les coûts logistiques', "Manager l'équipe approvisionnement (5 personnes)", 'Coordonner les flux inter-dépôts et les retours fournisseurs'],
      profil_recherche:   "Bac+5 logistique/supply chain ou expérience équivalente.\n5 ans minimum en gestion de la supply chain dans un environnement industriel ou de distribution.\nMaîtrise d'un ERP (SAP, Sage ou équivalent) et d'Excel.\nLeadership opérationnel et sens des priorités.",
      competences:        ['Supply chain management', 'Gestion des stocks', 'Planification MRP', "Management d'équipe", 'ERP'],
      competences_bonus:  ['SAP', 'Lean management', 'EDI', 'Incoterms'],
      valeurs:            ['Efficacité', 'Terrain', 'Fiabilité'],
      avantages:          ['Prime semestrielle', 'Mutuelle', 'Tickets restaurant', 'Participation', 'Voiture de service'],
      process_recrutement:['Entretien RH', 'Entretien Directeur Opérations + visite du dépôt', 'Rencontre DG'],
      date_debut:         'Dans le mois',
      deplacements:       'Occasionnels',
      teletravail:        false,
      pays:               'France',
      langues:            ['fr'],
      active:             true,
      statut:             'publiée',
      statut_publication: 'publiée',
      created_at:         daysAgo(18),
    },

    // ── 16 · Communication ────────────────────────────────────────────────────
    {
      recruteur_id:       recruteurId,
      titre:              'Chargé(e) de Communication & Relations Presse',
      domaine:            'Communication',
      type_contrat:       'CDI',
      ville:              'Paris',
      mode_travail:       'Hybride',
      jours_remote:       2,
      experience:         '1-2 ans',
      salaire_min:        null,
      salaire_max:        null,
      periode_salaire:    null,
      entreprise_nom:     'Communis PR',
      description:        "Communis PR est une agence de relations publiques et de communication corporate fondée en 2016. Nous accompagnons des marques tech, des institutions culturelles et des ONG dans leur stratégie de communication et de relations médias.\n\nNous cherchons un(e) Chargé(e) de Communication polyvalent(e) pour rejoindre notre équipe de 10 personnes. Vous prendrez en charge la production de contenus (communiqués de presse, newsletters, posts LinkedIn), la gestion du planning éditorial et le suivi des relations presse.\n\nRémunération selon profil, à discuter en entretien.",
      missions:           ['Rédiger des communiqués de presse, dossiers et kits médias', 'Gérer le planning éditorial multi-canal (LinkedIn, newsletter, site web)', 'Établir et entretenir les contacts avec les journalistes', 'Organiser et coordonner des événements médias et conférences de presse', 'Monitorer les retombées presse et produire des bilans'],
      profil_recherche:   "Bac+4/5 en communication, journalisme ou sciences politiques.\nPremière expérience en agence RP ou en communication d'entreprise.\nExcellente plume (français irréprochable) et sensibilité aux enjeux médiatiques.\nRéactivité, sens de l'organisation et curiosité intellectuelle.",
      competences:        ['Rédaction RP', 'Relations médias', 'Planification éditoriale', 'LinkedIn', 'Veille presse'],
      competences_bonus:  ['Meltwater / Cision', 'Adobe InDesign', 'Anglais avancé'],
      valeurs:            ['Plume', 'Engagement', 'Créativité'],
      avantages:          ['Remboursement Navigo 50%', 'Tickets restaurant', 'Mutuelle', 'Accès à des événements culturels'],
      process_recrutement:["Envoi d'un texte d'actualité réécrit en communiqué de presse", 'Entretien avec la directrice associée'],
      date_debut:         'Immédiat',
      deplacements:       'Occasionnels',
      teletravail:        true,
      pays:               'France',
      langues:            ['fr', 'en'],
      active:             true,
      statut:             'publiée',
      statut_publication: 'publiée',
      created_at:         daysAgo(20),
    },

    // ── 17 · Production / Artisanat ───────────────────────────────────────────
    {
      recruteur_id:       recruteurId,
      titre:              'Menuisier-Ébéniste',
      domaine:            'Production',
      type_contrat:       'CDI',
      ville:              'Alençon',
      mode_travail:       '100% présentiel',
      jours_remote:       0,
      experience:         '1-2 ans',
      salaire_min:        1900,
      salaire_max:        2400,
      periode_salaire:    'mensuel',
      entreprise_nom:     'Ateliers Lebrun',
      description:        "Les Ateliers Lebrun sont une menuiserie artisanale basée à Alençon depuis 1963. Nous fabriquons sur mesure des meubles, des agencements et des escaliers en bois massif pour des particuliers et des architectes d'intérieur.\n\nNous recrutons un(e) Menuisier-Ébéniste pour renforcer notre atelier (8 compagnons). Vous réaliserez des pièces en bois massif du tracé jusqu'à la finition.\n\nNous proposons un environnement de travail sain, des horaires fixes (7h30-16h30) et une ambiance de compagnonnage.",
      missions:           ['Lire et interpréter les plans et fiches techniques', 'Débiter, usiner et assembler les pièces en bois massif', 'Réaliser les finitions (ponçage, teinte, vernissage, peinture)', 'Poser les ouvrages chez les clients (déplacements ponctuels locaux)', "Participer à l'entretien des machines et de l'atelier"],
      profil_recherche:   "CAP Menuisier ou BEP Bois avec expérience de 2 ans minimum.\nMaîtrise des machines d'atelier (toupie, défonceuse, tour à bois).\nSens du détail, soin du travail bien fait et amour du bois.\nPermis B apprécié (pose chez clients).",
      competences:        ['Usinage bois massif', 'Lecture de plans', 'Finitions (peinture, vernissage)', 'Assemblage traditionnel'],
      competences_bonus:  ['Tournage sur bois', 'Marqueterie', 'Restauration de meubles anciens'],
      valeurs:            ['Savoir-faire', 'Précision', 'Fierté du travail'],
      avantages:          ['Horaires fixes et stables', "Mutuelle d'entreprise", "Prime de fin d'année", 'Équipements et EPI fournis'],
      process_recrutement:["Entretien avec le chef d'atelier", "Test pratique d'une demi-journée en atelier"],
      date_debut:         'Immédiat',
      deplacements:       'Occasionnels',
      teletravail:        false,
      pays:               'France',
      langues:            ['fr'],
      active:             true,
      statut:             'publiée',
      statut_publication: 'publiée',
      created_at:         daysAgo(22),
    },

    // ── 18 · Production / Industrie ───────────────────────────────────────────
    {
      recruteur_id:       recruteurId,
      titre:              'Technicien de Maintenance Industrielle',
      domaine:            'Production',
      type_contrat:       'CDI',
      ville:              'Caen',
      mode_travail:       '100% présentiel',
      jours_remote:       0,
      experience:         '1-2 ans',
      salaire_min:        2200,
      salaire_max:        2700,
      periode_salaire:    'mensuel',
      entreprise_nom:     'Calvados Industrie',
      description:        "Calvados Industrie est un équipementier de précision (pièces aéronautiques et automobile) implanté à Caen depuis 1991. Nos 240 collaborateurs produisent des composants à haute valeur ajoutée pour des donneurs d'ordres internationaux.\n\nNous recrutons un(e) Technicien de Maintenance pour assurer la disponibilité et la fiabilité de notre parc machines (centres d'usinage CNC, robots de soudure, presses hydrauliques).\n\nVous intégrez une équipe maintenance de 6 techniciens, avec astreinte tournante (1 semaine sur 6).",
      missions:           ['Diagnostiquer et réparer les pannes électriques, mécaniques et pneumatiques', 'Réaliser la maintenance préventive selon les gammes définies', "Rédiger les fiches d'intervention dans la GMAO", 'Proposer et mettre en œuvre des améliorations pour réduire les arrêts machines', "Participer à l'installation et à la mise en service de nouveaux équipements"],
      profil_recherche:   "Bac+2 en maintenance industrielle (BTS MEI, MSMA ou équivalent).\nPremière expérience en milieu industriel (alternance acceptée).\nCompétences en électrotechnique, mécanique et automatisme.\nRigueur, réactivité et esprit d'équipe.",
      competences:        ['Électrotechnique', 'Mécanique industrielle', 'Pneumatique / hydraulique', 'Lecture de schémas', 'GMAO'],
      competences_bonus:  ['Habilitation électrique BR/BC', 'Automates Siemens/Schneider', 'Soudure TIG'],
      valeurs:            ['Sécurité', 'Réactivité', 'Équipe'],
      avantages:          ["Prime d'astreinte", 'Prime de panier', 'Mutuelle', 'Intéressement', 'Formation constructeur régulière'],
      process_recrutement:['Entretien RH', 'Entretien technique avec le responsable maintenance', "Visite de l'atelier"],
      date_debut:         'Immédiat',
      deplacements:       'Jamais',
      teletravail:        false,
      pays:               'France',
      langues:            ['fr'],
      active:             true,
      statut:             'publiée',
      statut_publication: 'publiée',
      created_at:         daysAgo(25),
    },

    // ── 19 · Hôtellerie-restauration ──────────────────────────────────────────
    {
      recruteur_id:       recruteurId,
      titre:              'Chef de Partie — Cuisine Gastronomique',
      domaine:            'Hôtellerie-restauration',
      type_contrat:       'CDI',
      ville:              'Lisieux',
      mode_travail:       '100% présentiel',
      jours_remote:       0,
      experience:         '1-2 ans',
      salaire_min:        2200,
      salaire_max:        2700,
      periode_salaire:    'mensuel',
      entreprise_nom:     'Hôtel-Restaurant Le Clos Normand',
      description:        "L'Hôtel-Restaurant Le Clos Normand est un établissement 4 étoiles de 32 chambres situé à Lisieux, en plein cœur du pays d'Auge. Nous proposons une cuisine de tradition normande revisitée, valorisant les producteurs locaux.\n\nNous recrutons un(e) Chef de Partie confirmé(e) pour renforcer notre brigade de 6 personnes sous la direction du Chef Xavier Leblanc.\n\nNous mettons un point d'honneur sur la qualité des produits (circuits courts, saisons) et l'ambiance de brigade. Le poste est en CDI avec 2 jours de repos consécutifs.",
      missions:           ['Assurer la préparation et la réalisation des plats de votre partie (entrées froides / chaudes selon profil)', 'Superviser un commis et un apprenti', "Participer à l'élaboration des menus saisonniers avec le Chef", "Garantir l'hygiène et le respect des normes HACCP", 'Gérer les stocks et limiter les pertes de votre partie'],
      profil_recherche:   "CAP ou BEP Cuisine avec expérience de 2 ans minimum en restauration gastronomique ou bistronomique.\nRigueur, créativité et respect des produits.\nCapacité à travailler en brigade et à gérer la pression du service.\nPassion pour la cuisine de terroir normande appréciée.",
      competences:        ['Cuisine gastronomique', "Gestion d'une partie", 'HACCP', 'Fiches techniques', 'Travail en brigade'],
      competences_bonus:  ['Pâtisserie de restaurant', 'Cuisine végétarienne', 'Fermentation'],
      valeurs:            ['Passion', 'Terroir', 'Rigueur'],
      avantages:          ['2 jours de repos consécutifs', 'Repas du personnel', 'Mutuelle', 'Logement possible à prix négocié', 'Prime de fin de saison'],
      process_recrutement:['Entretien téléphonique', "Stage de découverte d'une journée (rémunéré)"],
      date_debut:         'Immédiat',
      deplacements:       'Jamais',
      teletravail:        false,
      pays:               'France',
      langues:            ['fr'],
      active:             true,
      statut:             'publiée',
      statut_publication: 'publiée',
      created_at:         daysAgo(27),
    },

    // ── 20 · Hôtellerie-restauration — CDD ───────────────────────────────────
    {
      recruteur_id:       recruteurId,
      titre:              'Réceptionniste d\'Hôtel — CDD Saison',
      domaine:            'Hôtellerie-restauration',
      type_contrat:       'CDD',
      ville:              'Caen',
      mode_travail:       '100% présentiel',
      jours_remote:       0,
      experience:         'Sans expérience',
      salaire_min:        1850,
      salaire_max:        2100,
      periode_salaire:    'mensuel',
      entreprise_nom:     'Appart\'City Caen Centre',
      description:        "Appart'City Caen Centre est un résidence hôtelière 3 étoiles de 82 appartements idéalement située à deux pas du château de Caen. Nous accueillons aussi bien des voyageurs d'affaires que des touristes.\n\nDans le cadre de la saison estivale (juin à septembre), nous recrutons un(e) Réceptionniste pour renforcer notre équipe front-office.\n\nPoste en CDD du 1er juin au 30 septembre, avec possibilité de renouvellement ou de CDI selon l'activité.",
      missions:           ['Accueillir et enregistrer les clients à leur arrivée (check-in / check-out)', 'Répondre aux demandes par téléphone, e-mail et en direct', "Gérer les réservations via le PMS de l'hôtel", 'Encaisser les paiements et clôturer la caisse', "Assurer la coordination avec le service d'étage et le petit-déjeuner"],
      profil_recherche:   "BTS Tourisme, Hébergement ou expérience en hôtellerie/restauration.\nSourire, sens de l'accueil et présentation soignée.\nAnglais conversationnel obligatoire.\nFlexibilité horaire (matin 7h-15h, soir 15h-23h, week-ends en roulement).",
      competences:        ['Accueil client', 'Gestion des réservations', 'Encaissement', 'Anglais', 'Travail en équipe'],
      competences_bonus:  ['PMS (Fols, Opera)', 'Espagnol ou allemand', 'Upselling'],
      valeurs:            ['Accueil', 'Sourire', 'Adaptabilité'],
      avantages:          ['Repas pris en charge', 'Uniforme fourni', 'Mutuelle', 'Transports remboursés à 50%'],
      process_recrutement:["Entretien avec la directrice de l'hôtel (30 min)"],
      date_debut:         'Dans 3 mois',
      deplacements:       'Jamais',
      teletravail:        false,
      pays:               'France',
      duree_contrat:      '3–6 mois',
      langues:            ['fr', 'en', 'de'],
      active:             true,
      statut:             'publiée',
      statut_publication: 'publiée',
      created_at:         daysAgo(29),
    },
  ]
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱  Démarrage du seed Supabase…\n')

  // 1. S'authentifier (RLS requires auth.uid())
  await authenticate()

  // 2. Récupérer le recruteur_id (= l'utilisateur connecté)
  let recruteurId: string
  try {
    recruteurId = await getRecruteurId()
    console.log(`👤  recruteur_id : ${recruteurId}`)
  } catch (err) {
    console.error('❌  Impossible de déterminer le recruteur_id :', (err as Error).message)
    await sb.auth.signOut()
    process.exit(1)
  }

  // 3. Construire les offres
  const offres = buildOffres(recruteurId)
  console.log(`📦  ${offres.length} offres à insérer…\n`)

  // 4. Insérer une par une pour avoir un message d'erreur précis si ça plante
  const insertedIds: string[] = []
  const errors: Array<{ index: number; titre: string; code: string; message: string; details: string }> = []

  for (let i = 0; i < offres.length; i++) {
    const offre = offres[i]
    const { data, error } = await sb
      .from('offres')
      .insert(offre)
      .select('id, titre')
      .single()

    if (error) {
      errors.push({
        index:   i + 1,
        titre:   offre.titre,
        code:    error.code    ?? '—',
        message: error.message ?? '—',
        details: (error as unknown as { details?: string }).details ?? '—',
      })
      console.error(
        `  ❌  [${String(i + 1).padStart(2)}] ${offre.titre}\n` +
        `       code=${error.code}  msg=${error.message}`
      )
    } else if (data) {
      insertedIds.push(data.id)
      console.log(`  ✓  [${insertedIds.length.toString().padStart(2)}] ${data.titre}`)
    } else {
      // data null sans erreur — ne devrait pas arriver mais on le trace
      errors.push({ index: i + 1, titre: offre.titre, code: '?', message: 'data=null sans erreur', details: '—' })
      console.error(`  ⚠️   [${String(i + 1).padStart(2)}] ${offre.titre} — data null sans erreur Supabase`)
    }
  }

  // 5. Sauvegarder les IDs pour le clean
  if (insertedIds.length > 0) {
    let existing: string[] = []
    try {
      existing = JSON.parse(
        existsSync(SEED_IDS_PATH) ? readFileSync(SEED_IDS_PATH, 'utf-8') : '[]'
      )
    } catch { /* first run */ }
    writeFileSync(SEED_IDS_PATH, JSON.stringify([...existing, ...insertedIds], null, 2))
  }

  // 6. Vérification par SELECT count
  const { count } = await sb
    .from('offres')
    .select('*', { count: 'exact', head: true })

  // 7. Se déconnecter
  await sb.auth.signOut()
  console.log('\n🔓  Déconnecté.')

  // 8. Récapitulatif final
  console.log('\n─────────────────────────────────────────────────────')
  if (errors.length === 0) {
    console.log(`✅  ${insertedIds.length} / ${offres.length} offres créées avec succès`)
  } else {
    console.log(`⚠️   ${insertedIds.length} créée(s), ${errors.length} échec(s) :`)
    errors.forEach(e =>
      console.log(`    [${e.index}] ${e.titre}\n        code=${e.code} | ${e.message} | details=${e.details}`)
    )
  }
  console.log(`📊  Total offres en base : ${count ?? '?'}`)
  if (insertedIds.length > 0) {
    console.log(`📄  IDs sauvegardés dans scripts/.seed-ids.json`)
    console.log(`🧹  Pour nettoyer : npx tsx scripts/clean-offres.ts`)
  }

  if (errors.length > 0) process.exit(1)
}

main()
