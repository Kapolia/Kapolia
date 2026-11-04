-- supabase/seed_test.sql
-- Données de test : 4 fiches entreprise + 50 offres d''emploi
-- creametier1 → Proxité RH (Rouen) | creametier2 → Maison Clémenceau (Paris)
-- creametier3 → Ateliers Morvan (Dijon) | creametier4 → Stacklab (Paris)
-- Apostrophes typographiques U+2019 dans tous les textes.

DO $seed$
DECLARE
  r1 uuid;
  r2 uuid;
  r3 uuid;
  r4 uuid;
BEGIN

  SELECT p.user_id INTO r1 FROM profils p JOIN auth.users u ON u.id = p.user_id WHERE u.email = 'creametier1@gmail.com';
  SELECT p.user_id INTO r2 FROM profils p JOIN auth.users u ON u.id = p.user_id WHERE u.email = 'creametier2@gmail.com';
  SELECT p.user_id INTO r3 FROM profils p JOIN auth.users u ON u.id = p.user_id WHERE u.email = 'creametier3@gmail.com';
  SELECT p.user_id INTO r4 FROM profils p JOIN auth.users u ON u.id = p.user_id WHERE u.email = 'creametier4@gmail.com';

  -- ═══════════════════════════════════════════════════════════════
  -- BLOC 1 — FICHES ENTREPRISE
  -- ═══════════════════════════════════════════════════════════════

  UPDATE profils SET
    entreprise_nom            = 'Proxité RH',
    entreprise_secteur        = 'RH & recrutement',
    entreprise_taille         = '11–50 salariés',
    entreprise_ville          = 'Rouen',
    entreprise_pays           = 'France',
    entreprise_site           = 'https://proxite-rh.fr',
    entreprise_mission        = 'Accompagner les entreprises normandes dans leurs recrutements et le développement de leurs politiques RH.',
    entreprise_description    = 'Proxité RH est un cabinet de conseil RH basé à Rouen. Fondé en 2011, il accompagne plus de 150 entreprises de la région Normandie dans leurs recrutements, la gestion des carrières et le développement des compétences. Notre équipe de consultants spécialisés intervient de l''audit RH jusqu''à la mise en œuvre opérationnelle.',
    entreprise_annee_creation = '2011',
    entreprise_effectif       = '35 collaborateurs'
  WHERE user_id = r1;

  UPDATE profils SET
    entreprise_nom            = 'Maison Clémenceau',
    entreprise_secteur        = 'Hôtellerie & Restauration',
    entreprise_taille         = '50–200 salariés',
    entreprise_ville          = 'Paris',
    entreprise_pays           = 'France',
    entreprise_site           = 'https://maison-clemenceau.fr',
    entreprise_mission        = 'Offrir une expérience gastronomique d''exception au cœur de Paris, en valorisant l''artisanat culinaire français.',
    entreprise_description    = 'Maison Clémenceau regroupe deux établissements parisiens : un restaurant gastronomique et un hôtel boutique 5 étoiles. Avec une brigade de 80 personnes, nous cultivons l''excellence du service et la créativité culinaire. Nos équipes évoluent dans un cadre bienveillant, exigeant et stimulant.',
    entreprise_annee_creation = '1998',
    entreprise_effectif       = '85 collaborateurs'
  WHERE user_id = r2;

  UPDATE profils SET
    entreprise_nom            = 'Ateliers Morvan',
    entreprise_secteur        = 'Industrie & manufacture',
    entreprise_taille         = '50–200 salariés',
    entreprise_ville          = 'Dijon',
    entreprise_pays           = 'France',
    entreprise_site           = 'https://ateliers-morvan.fr',
    entreprise_mission        = 'Concevoir et fabriquer des équipements industriels durables, au cœur de la Bourgogne.',
    entreprise_description    = 'Fondés en 1987, les Ateliers Morvan conçoivent et fabriquent des équipements mécaniques sur mesure pour l''industrie agroalimentaire et pharmaceutique. Implantés à Dijon, nous employons 120 personnes sur deux sites de production et investissons chaque année dans la modernisation de nos outils.',
    entreprise_annee_creation = '1987',
    entreprise_effectif       = '120 collaborateurs'
  WHERE user_id = r3;

  UPDATE profils SET
    entreprise_nom            = 'Stacklab',
    entreprise_secteur        = 'Tech & SaaS B2B',
    entreprise_taille         = '11–50 salariés',
    entreprise_ville          = 'Paris',
    entreprise_pays           = 'France',
    entreprise_site           = 'https://stacklab.io',
    entreprise_mission        = 'Construire des outils SaaS B2B robustes qui transforment la productivité des équipes techniques.',
    entreprise_description    = 'Stacklab développe une suite d''outils SaaS pour les équipes d''ingénierie : monitoring, CI/CD analytics et gestion des incidents. Fondée en 2019 à Paris, la startup compte 40 personnes et accompagne des clients dans 12 pays. Nous recrutons des profils passionnés, curieux et autonomes.',
    entreprise_annee_creation = '2019',
    entreprise_effectif       = '40 collaborateurs'
  WHERE user_id = r4;

  -- ═══════════════════════════════════════════════════════════════
  -- BLOC 2 — OFFRES PROXITÉ RH  R01–R13
  -- ═══════════════════════════════════════════════════════════════

  -- R01
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r1,'Chargé(e) de recrutement','RH & Recrutement','CDI','3-5 ans',35000,42000,'annuel','immediat','Rouen','France',49.4432,1.0993,'100% présentiel',NULL,'Occasionnels',
    'Vous rejoignez notre pôle recrutement pour accompagner nos clients PME et ETI dans l''identification et la sélection de leurs talents. Vous gérez l''ensemble du processus, de la définition du besoin à l''intégration du candidat.',
    ARRAY['Recueillir les besoins auprès des managers','Rédiger et diffuser les annonces sur les jobboards','Sourcer des candidats via LinkedIn et les CVthèques','Conduire les entretiens de qualification','Présenter une shortlist aux clients et assurer le suivi'],
    'Vous justifiez de 3 à 5 ans d''expérience en recrutement, idéalement en cabinet. Rigoureux(se), à l''écoute, maîtrise des outils de sourcing indispensable.',
    ARRAY['Sourcing','Conduite d''entretiens','ATS','Rédaction d''annonces','Chasse de têtes'],
    ARRAY['Marque employeur','Stratégie de recrutement'],
    ARRAY['Mutuelle','Tickets restaurant','RTT'],
    ARRAY['Entretien téléphonique 30 min','Rencontre avec le directeur associé','Prise de références'],
    'publiée','publiée',true,'2026-09-10T09:00:00Z','2027-03-10T09:00:00Z','2026-09-10T09:00:00Z');

  -- R02
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r1,'Consultant(e) RH','RH & Recrutement','CDI','3-5 ans',38000,46000,'annuel','immediat','Rouen','France',49.4432,1.0993,'Hybride',2,'Occasionnels',
    'En tant que consultant(e) RH, vous êtes l''interlocuteur(trice) privilégié(e) de nos clients sur l''ensemble des sujets RH. Vous les accompagnez aussi bien sur des missions de recrutement que de conseil en organisation.',
    ARRAY['Réaliser des diagnostics RH pour les clients','Conseiller les dirigeants sur la politique RH','Conduire des missions de recrutement cadres','Animer des ateliers de gestion des carrières','Rédiger les livrables et rapports de mission'],
    'Profil RH généraliste avec une solide expérience en cabinet ou en direction RH. Aisance relationnelle, sens du service client et autonomie requis.',
    ARRAY['Processus RH','Conduite d''entretiens','Politique RH','GPEC','Développement RH'],
    ARRAY['SIRH','Digitalisation RH'],
    ARRAY['Mutuelle','RTT','Tickets restaurant','Remboursement transport'],
    ARRAY['Entretien RH','Cas pratique','Entretien avec un associé'],
    'publiée','publiée',true,'2026-09-15T09:00:00Z','2027-03-15T09:00:00Z','2026-09-15T09:00:00Z');

  -- R03
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r1,'Chargé(e) de mission RH','RH & Recrutement','CDD','1-2 ans',28000,33000,'annuel','immediat','Le Havre','France',49.4938,0.1079,'100% présentiel',NULL,'Jamais',
    'CDD de 12 mois pour renforcer notre équipe du Havre. Vous intervenez sur des missions polyvalentes : recrutement opérateurs, gestion administrative et appui à la formation.',
    ARRAY['Traiter les candidatures et planifier les entretiens','Rédiger les contrats et avenants','Mettre à jour les dossiers du personnel','Participer aux réunions de suivi client','Contribuer aux tableaux de bord RH'],
    'Profil junior avec une première expérience en RH ou en stage significatif. Organisé(e), réactif(ve), à l''aise avec les outils bureautiques.',
    ARRAY['Gestion administrative du personnel','ATS','Reporting RH','Gestion des absences'],
    ARRAY['SIRH','Tableaux de bord RH'],
    ARRAY['Mutuelle','Tickets restaurant'],
    ARRAY['Entretien téléphonique','Entretien en présentiel avec la responsable de site'],
    'publiée','publiée',true,'2026-09-20T09:00:00Z','2027-03-20T09:00:00Z','2026-09-20T09:00:00Z');

  -- R04
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r1,'Responsable RH','RH & Recrutement','CDI','5-10 ans',48000,58000,'annuel','immediat','Rouen','France',49.4432,1.0993,'Hybride',2,'Occasionnels',
    'Proxité RH recherche un(e) Responsable RH pour piloter l''activité de conseil auprès d''un portefeuille de clients industriels normands. Vous encadrez une équipe de 3 consultants.',
    ARRAY['Manager et animer une équipe de consultants RH','Gérer un portefeuille de comptes clients','Superviser les missions de recrutement et de conseil','Contribuer au développement commercial','Assurer le reporting auprès de la direction'],
    'Expérience confirmée en management RH ou en cabinet, avec une bonne connaissance des enjeux industriels. Leadership, sens client et pédagogie sont vos atouts.',
    ARRAY['Politique RH','Développement RH','GPEC','Gestion des carrières','Droit du travail'],
    ARRAY['Mobilité interne','Dialogue social','Bilan social'],
    ARRAY['Mutuelle','RTT','Tickets restaurant','Véhicule de fonction'],
    ARRAY['Entretien RH','Entretien avec le DG','Présentation d''un cas client'],
    'publiée','publiée',true,'2026-09-25T09:00:00Z','2027-03-25T09:00:00Z','2026-09-25T09:00:00Z');

  -- R05
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r1,'Chargé(e) de formation','RH & Recrutement','CDI','3-5 ans',33000,38000,'annuel','immediat','Le Havre','France',49.4938,0.1079,'Hybride',1,'Occasionnels',
    'Vous pilotez les plans de formation de nos clients industriels et assurez le suivi des actions OPCO. Mission transversale au croisement du conseil RH et de l''ingénierie pédagogique.',
    ARRAY['Élaborer les plans de développement des compétences','Sélectionner les prestataires de formation','Gérer les dossiers OPCO et les financements','Suivre les évaluations post-formation','Réaliser des bilans formation auprès des RRH clients'],
    'Expérience en gestion de la formation ou en OPCO. Rigueur administrative, sens du relationnel et intérêt pour le développement des compétences.',
    ARRAY['Plan de développement des compétences','Gestion de la formation','Ingénierie de formation','Évaluation des formations','Partenariats de formation'],
    ARRAY['SIRH','Digitalisation RH'],
    ARRAY['Mutuelle','Tickets restaurant','RTT','Formation'],
    ARRAY['Entretien téléphonique','Entretien avec la responsable formation','Échange avec l''équipe'],
    'publiée','publiée',true,'2026-10-01T09:00:00Z','2027-04-01T09:00:00Z','2026-10-01T09:00:00Z');

  -- R06
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r1,'Assistant(e) RH','RH & Recrutement','CDD','Sans expérience',24000,28000,'annuel','immediat','Elbeuf','France',49.2839,1.0169,'100% présentiel',NULL,'Jamais',
    'Poste d''assistant(e) RH pour accompagner la montée en charge d''une mission chez un client logistique. CDD renouvelable. Idéal pour un profil en début de carrière.',
    ARRAY['Assister les consultants dans la gestion administrative','Saisir les données dans le SIRH client','Organiser les plannings d''entretiens','Classer et archiver les dossiers du personnel','Rédiger des courriers simples'],
    'Étudiant(e) ou jeune diplômé(e) en RH ou gestion. Dynamique, volontaire, rigoureux(se). Première expérience en stage bienvenue.',
    ARRAY['Gestion administrative du personnel','Gestion des absences','SIRH'],
    ARRAY['Reporting RH','Tableaux de bord RH'],
    ARRAY['Mutuelle','Tickets restaurant'],
    ARRAY['Entretien téléphonique','Entretien en présentiel'],
    'publiée','publiée',true,'2026-10-05T09:00:00Z','2027-04-05T09:00:00Z','2026-10-05T09:00:00Z');

  -- R07
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r1,'Gestionnaire de paie','RH & Recrutement','CDI','1-2 ans',30000,36000,'annuel','immediat','Rouen','France',49.4432,1.0993,'100% présentiel',NULL,'Jamais',
    'Vous prenez en charge la gestion de la paie d''un portefeuille de clients TPE/PME multi-conventions. Mission à forte valeur ajoutée au sein du pôle social de Proxité RH.',
    ARRAY['Établir les bulletins de paie (200 à 300 paies/mois)','Gérer les entrées et sorties de personnel','Effectuer les déclarations sociales (DSN)','Répondre aux questions des salariés sur leur paie','Assurer une veille sur les évolutions légales et conventionnelles'],
    'Titulaire d''un Titre Professionnel ou BTS Paie. Première expérience en cabinet social. Connaissance d''un logiciel de paie (Silae, Cegid) appréciée.',
    ARRAY['Gestion de la paie','Déclarations sociales','Droit du travail'],
    ARRAY['SIRH','Reporting RH'],
    ARRAY['Mutuelle','Tickets restaurant','RTT'],
    ARRAY['Test technique paie','Entretien avec le responsable pôle social'],
    'publiée','publiée',true,'2026-10-08T09:00:00Z','2027-04-08T09:00:00Z','2026-10-08T09:00:00Z');

  -- R08
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r1,'Business Partner RH','RH & Recrutement','CDI','5-10 ans',50000,60000,'annuel','immediat','Rouen','France',49.4432,1.0993,'Hybride',2,'Fréquents',
    'Rôle de Business Partner RH auprès d''un client industriel clé (800 salariés). Vous êtes le partenaire stratégique des managers opérationnels sur tous les sujets RH.',
    ARRAY['Conseiller et coacher les managers sur les problématiques RH','Piloter les recrutements de l''unité','Animer les entretiens annuels et les revues de talent','Participer aux négociations avec les représentants du personnel','Décliner la politique RH groupe au niveau local'],
    'HRBP expérimenté(e), vous maîtrisez tous les volets RH et avez évolué en milieu industriel. Capacité à influencer sans autorité hiérarchique.',
    ARRAY['Politique RH','Conseil aux managers','Entretiens annuels','Gestion des talents','Dialogue social'],
    ARRAY['GPEC','Mobilité interne','Bilan de compétences'],
    ARRAY['Mutuelle','RTT','Tickets restaurant','Véhicule de fonction','Formation'],
    ARRAY['Entretien RH','Business case','Entretien avec le DRH groupe'],
    'publiée','publiée',true,'2026-10-10T09:00:00Z','2027-04-10T09:00:00Z','2026-10-10T09:00:00Z');

  -- R09
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r1,'Chargé(e) de recrutement','RH & Recrutement','CDI','1-2 ans',28000,34000,'annuel','immediat','Caen','France',49.1829,-0.3707,'Hybride',1,'Jamais',
    'Nous ouvrons un poste de chargé(e) de recrutement sur notre antenne de Caen. Vous rejoignez une équipe dynamique et prenez en charge un portefeuille de clients du secteur tertiaire.',
    ARRAY['Qualifier les besoins en recrutement des clients','Rédiger et publier les offres d''emploi','Réaliser les entretiens de sélection','Assurer le suivi candidats et la fidélisation clients','Alimenter le reporting hebdomadaire'],
    'Première expérience en recrutement (stage ou alternance acceptés). Vous êtes autonome, curieux(se) et aimez la diversité des profils. Permis B apprécié.',
    ARRAY['Sourcing','Conduite d''entretiens','ATS','Sélection de candidats'],
    ARRAY['Marque employeur','Rédaction d''annonces'],
    ARRAY['Mutuelle','Tickets restaurant','Remboursement transport'],
    ARRAY['Échange téléphonique','Entretien sur site','Validation par le responsable'],
    'publiée','publiée',true,'2026-10-12T09:00:00Z','2027-04-12T09:00:00Z','2026-10-12T09:00:00Z');

  -- R10
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r1,'Chargé(e) GPEC','RH & Recrutement','CDI','3-5 ans',36000,44000,'annuel','immediat','Rouen','France',49.4432,1.0993,'Hybride',2,'Occasionnels',
    'Rattaché(e) au pôle conseil, vous accompagnez nos clients dans la mise en œuvre de leur démarche GPEC et de leurs politiques de développement des compétences.',
    ARRAY['Réaliser des cartographies de compétences','Conduire des entretiens de bilan de compétences','Élaborer des référentiels emplois-compétences','Animer des ateliers de mobilité interne','Produire des livrables de conseil pour les clients'],
    'Expérience en GPEC, développement RH ou conseil en organisation. Capacité d''analyse, aisance rédactionnelle et sens de l''accompagnement individuel.',
    ARRAY['GPEC','Gestion des carrières','Mobilité interne','Bilan de compétences','Développement RH'],
    ARRAY['Politique de rémunération','Entretiens annuels','Ingénierie de formation'],
    ARRAY['Mutuelle','RTT','Tickets restaurant','Formation'],
    ARRAY['Entretien téléphonique','Entretien avec la responsable conseil','Présentation d''une mission GPEC'],
    'publiée','publiée',true,'2026-10-14T09:00:00Z','2027-04-14T09:00:00Z','2026-10-14T09:00:00Z');

  -- R11
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r1,'Directeur(trice) des ressources humaines','RH & Recrutement','CDI','+10 ans',72000,92000,'annuel','2026-12-01','Rouen','France',49.4432,1.0993,'Hybride',2,'Fréquents',
    'Mission de DRH de transition pour un groupe industriel normand (1 200 salariés, 3 sites). Vous prenez la direction du service RH groupe et pilotez une équipe de 8 personnes.',
    ARRAY['Définir et déployer la stratégie RH groupe','Piloter les relations sociales et les NAO','Superviser la paie et l''administration du personnel','Accompagner les transformations organisationnelles','Représenter la DRH auprès du comité de direction'],
    'DRH expérimenté(e) avec une forte culture industrielle et une pratique confirmée du dialogue social. Expérience de restructurations ou transformations d''envergure.',
    ARRAY['Politique RH','Dialogue social','GPEC','Gestion des talents','Politique de rémunération','Bilan social'],
    ARRAY['Digitalisation RH','Communication interne','Entretiens annuels'],
    ARRAY['Mutuelle','RTT','Véhicule de fonction','Intéressement'],
    ARRAY['Entretien avec le cabinet','Entretien avec le PDG','Rencontre avec le comité de direction'],
    'publiée','publiée',true,'2026-10-16T09:00:00Z','2027-04-16T09:00:00Z','2026-10-16T09:00:00Z');

  -- R12 (brouillon)
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r1,'Consultant(e) en recrutement – Freelance','RH & Recrutement','Freelance','5-10 ans',NULL,NULL,'annuel',NULL,'Rouen','France',49.4432,1.0993,'Hybride',2,'Occasionnels',
    'Nous recherchons des consultants en recrutement freelance pour renforcer notre capacité sur des missions ponctuelles en Normandie.',
    ARRAY['Prendre en charge des mandats de recrutement cadres','Sourcer et qualifier les candidats','Assurer le reporting client'],
    'Consultant(e) indépendant(e) avec 5 ans minimum en recrutement. Réseau solide sur la région normande.',
    ARRAY['Sourcing','Chasse de têtes','Conduite d''entretiens','Stratégie de recrutement'],
    ARRAY[]::text[],ARRAY[]::text[],
    ARRAY['Appel de découverte','Rencontre avec un associé'],
    'brouillon','brouillon',false,NULL,NULL,'2026-10-18T09:00:00Z');

  -- R13 (brouillon)
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r1,'Chargé(e) de communication RH','RH & Recrutement','CDI','1-2 ans',28000,34000,'annuel',NULL,'Le Havre','France',49.4938,0.1079,'Hybride',2,'Jamais',
    'Nouveau poste : communication marque employeur pour nos clients du secteur maritime et logistique du Havre.',
    ARRAY['Créer des contenus RH pour les réseaux sociaux','Animer les pages carrières des clients','Organiser des événements recrutement'],
    'Profil communication avec sensibilité RH. Maîtrise des réseaux sociaux et outils de design.',
    ARRAY['Marque employeur','Communication interne','Digitalisation RH'],
    ARRAY[]::text[],
    ARRAY['Mutuelle','Tickets restaurant'],
    ARRAY['Entretien RH','Test créatif'],
    'brouillon','brouillon',false,NULL,NULL,'2026-10-20T09:00:00Z');

  -- ═══════════════════════════════════════════════════════════════
  -- BLOC 3 — OFFRES MAISON CLÉMENCEAU  H01–H13
  -- ═══════════════════════════════════════════════════════════════

  -- H01
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r2,'Chef de partie','Hôtellerie & Restauration','CDI','3-5 ans',30000,36000,'annuel','immediat','Paris','France',48.8566,2.3522,'100% présentiel',NULL,'Jamais',
    'Intégrez la brigade de Maison Clémenceau pour prendre en charge votre propre partie. Vous travaillez sous la direction du chef de cuisine dans un environnement gastronomique exigeant.',
    ARRAY['Assurer la production culinaire de votre partie','Encadrer les commis affectés à votre poste','Garantir le respect des normes HACCP','Participer à l''élaboration des fiches techniques','Contrôler les stocks et passer les commandes de votre partie'],
    'Chef de partie avec 3 à 5 ans d''expérience en restauration gastronomique. Rigueur, créativité et sens du collectif. CAP Cuisine ou Bac Pro exigé.',
    ARRAY['Cuisine','HACCP','Gestion des stocks alimentaires','Gestion d''équipe'],
    ARRAY['Pâtisserie','ISO 22000'],
    ARRAY['Mutuelle','Tickets restaurant','Remboursement transport'],
    ARRAY['Entretien téléphonique','Essai en cuisine','Rencontre avec le chef'],
    'publiée','publiée',true,'2026-09-05T09:00:00Z','2027-03-05T09:00:00Z','2026-09-05T09:00:00Z');

  -- H02
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r2,'Second de cuisine','Hôtellerie & Restauration','CDI','5-10 ans',38000,46000,'annuel','immediat','Paris','France',48.8566,2.3522,'100% présentiel',NULL,'Jamais',
    'Bras droit du chef de cuisine, vous gérez la brigade en son absence et êtes garant(e) de la qualité des préparations. Poste central dans notre organisation.',
    ARRAY['Seconder le chef de cuisine dans la direction de la brigade','Organiser et répartir les tâches entre les parties','Contrôler la qualité des plats avant l''envoi','Contribuer à l''élaboration des menus saisonniers','Assurer la formation des commis et stagiaires'],
    'Second de cuisine expérimenté(e), avec une forte culture gastronomique et un réel leadership. Solide maîtrise de toutes les techniques culinaires classiques et modernes.',
    ARRAY['Cuisine','Gestion d''équipe','HACCP','Gestion des coûts','Gestion des stocks alimentaires'],
    ARRAY['Pâtisserie','ISO 22000','Relations fournisseurs'],
    ARRAY['Mutuelle','Tickets restaurant','Formation'],
    ARRAY['Entretien avec le chef','Essai en cuisine','Validation par la direction'],
    'publiée','publiée',true,'2026-09-08T09:00:00Z','2027-03-08T09:00:00Z','2026-09-08T09:00:00Z');

  -- H03
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r2,'Réceptionniste','Hôtellerie & Restauration','CDI','1-2 ans',26000,30000,'annuel','immediat','Paris','France',48.8566,2.3522,'100% présentiel',NULL,'Jamais',
    'Vous êtes le premier contact de nos hôtes à Maison Clémenceau. Ambassadeur(drice) de notre image, vous assurez un accueil personnalisé et irréprochable à chaque arrivée.',
    ARRAY['Accueillir les clients à leur arrivée et gérer les check-in/check-out','Gérer les réservations via le PMS','Répondre aux demandes et réclamations des clients','Assurer la liaison entre les départements hébergement et restauration','Traiter les paiements et la caisse'],
    'Expérience en réception hôtelière, idéalement en hôtel 4 ou 5 étoiles. Excellente présentation, anglais courant, sens du service haut de gamme.',
    ARRAY['Accueil client','Réception hôtelière','PMS','Gestion des réservations','Gestion de caisse'],
    ARRAY['Expérience client','Revenue management'],
    ARRAY['Mutuelle','Tickets restaurant','Remboursement transport'],
    ARRAY['Entretien téléphonique','Entretien avec la responsable hébergement'],
    'publiée','publiée',true,'2026-09-12T09:00:00Z','2027-03-12T09:00:00Z','2026-09-12T09:00:00Z');

  -- H04
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r2,'Chef de rang','Hôtellerie & Restauration','CDD','1-2 ans',24000,28000,'annuel','immediat','Paris','France',48.8566,2.3522,'100% présentiel',NULL,'Jamais',
    'CDD de 8 mois pour renforcer notre équipe salle en vue de la haute saison. Vous assurez un service de table en accord avec les standards gastronomiques de Maison Clémenceau.',
    ARRAY['Assurer le service en salle de votre rang','Conseiller les clients sur la carte et les accords mets-vins','Coordonner le travail des commis de salle','Gérer la mise en place et le nettoyage de votre rang','Traiter les demandes spéciales des convives'],
    'Chef de rang avec une première expérience en restauration gastronomique. Présentation soignée, sens du service et anglais opérationnel.',
    ARRAY['Service en salle','Accueil client','Sommellerie'],
    ARRAY['Gestion des événements','Banquets'],
    ARRAY['Mutuelle','Tickets restaurant'],
    ARRAY['Entretien téléphonique','Mise en situation service'],
    'publiée','publiée',true,'2026-09-18T09:00:00Z','2027-03-18T09:00:00Z','2026-09-18T09:00:00Z');

  -- H05
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r2,'Maître d''hôtel','Hôtellerie & Restauration','CDI','5-10 ans',42000,50000,'annuel','immediat','Paris','France',48.8566,2.3522,'100% présentiel',NULL,'Jamais',
    'Vous supervisez l''ensemble du service en salle du restaurant gastronomique. Garant(e) de la qualité de l''expérience client, vous encadrez une équipe de 12 personnes.',
    ARRAY['Diriger et animer l''équipe salle','Accueillir les clients VIP et gérer les réservations importantes','Veiller au respect des standards de service','Participer à l''élaboration de la carte des vins','Gérer les plannings et la formation des équipes'],
    'Maître d''hôtel expérimenté(e), issu(e) d''une grande maison. Excellent leadership, culture gastronomique solide, maîtrise de l''anglais et d''une deuxième langue appréciée.',
    ARRAY['Service en salle','Gestion d''équipe','Sommellerie','Accueil client','Gestion des événements'],
    ARRAY['Revenue management','Banquets','Expérience client'],
    ARRAY['Mutuelle','RTT','Formation','Tickets restaurant'],
    ARRAY['Entretien avec la direction','Mise en situation management','Dégustation'],
    'publiée','publiée',true,'2026-09-22T09:00:00Z','2027-03-22T09:00:00Z','2026-09-22T09:00:00Z');

  -- H06
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r2,'Responsable hébergement','Hôtellerie & Restauration','CDI','3-5 ans',36000,44000,'annuel','immediat','Lyon','France',45.7640,4.8357,'100% présentiel',NULL,'Jamais',
    'Poste ouvert sur notre établissement lyonnais. Vous gérez l''ensemble des opérations hébergement : réception, housekeeping et relations clients.',
    ARRAY['Superviser les équipes réception et housekeeping','Optimiser le taux d''occupation et le RevPAR','Traiter les réclamations clients','Assurer le suivi des prestataires et fournisseurs','Produire les rapports d''activité hebdomadaires'],
    'Responsable hébergement avec 3 à 5 ans d''expérience en hôtel 4 ou 5 étoiles. Maîtrise d''un PMS, sens de l''organisation, leadership naturel.',
    ARRAY['Réception hôtelière','PMS','Housekeeping','Revenue management','Expérience client'],
    ARRAY['Gestion des réservations','Relations fournisseurs','Gestion de caisse'],
    ARRAY['Mutuelle','RTT','Tickets restaurant','Formation'],
    ARRAY['Entretien téléphonique','Entretien avec le directeur de l''établissement'],
    'publiée','publiée',true,'2026-09-28T09:00:00Z','2027-03-28T09:00:00Z','2026-09-28T09:00:00Z');

  -- H07
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r2,'Barman / Barmaid','Hôtellerie & Restauration','CDD','1-2 ans',22000,26000,'annuel','immediat','Paris','France',48.8566,2.3522,'100% présentiel',NULL,'Jamais',
    'CDD pour le bar de l''hôtel boutique. Vous proposez une carte de cocktails créatifs et veillez à l''excellence de chaque interaction client.',
    ARRAY['Réaliser les cocktails de la carte et les demandes personnalisées','Conseiller les clients sur les spiritueux et vins au verre','Assurer la mise en place et la propreté du bar','Gérer les stocks bar et passer les commandes','Clôturer la caisse en fin de service'],
    'Barman(Barmaid) avec une expérience en bar hôtelier ou lounge haut de gamme. Créativité, aisance relationnelle, parfaite maîtrise des techniques de barman.',
    ARRAY['Bar et cocktails','Accueil client','Gestion de caisse','Gestion des stocks alimentaires'],
    ARRAY['Sommellerie','Expérience client'],
    ARRAY['Mutuelle','Tickets restaurant'],
    ARRAY['Entretien téléphonique','Test de réalisation de cocktails'],
    'publiée','publiée',true,'2026-10-02T09:00:00Z','2027-04-02T09:00:00Z','2026-10-02T09:00:00Z');

  -- H08
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r2,'Commis de cuisine','Hôtellerie & Restauration','Alternance','Sans expérience',NULL,NULL,'annuel','immediat','Paris','France',48.8566,2.3522,'100% présentiel',NULL,'Jamais',
    'Rejoignez notre brigade en alternance et formez-vous aux côtés de chefs passionnés. Vous participerez à toutes les étapes de la préparation culinaire.',
    ARRAY['Préparer les ingrédients et les mises en place','Assister les chefs de partie dans leurs préparations','Apprendre les techniques culinaires de base','Respecter les règles d''hygiène et de sécurité alimentaire','Contribuer au nettoyage et à l''entretien des postes'],
    'Étudiant(e) en CAP ou Bac Pro Cuisine. Motivation, discipline et envie d''apprendre dans un environnement gastronomique exigeant.',
    ARRAY['Cuisine','HACCP'],
    ARRAY['Pâtisserie','Boulangerie'],
    ARRAY['Mutuelle','Tickets restaurant','Formation'],
    ARRAY['Entretien téléphonique','Rencontre avec le chef'],
    'publiée','publiée',true,'2026-10-06T09:00:00Z','2027-04-06T09:00:00Z','2026-10-06T09:00:00Z');

  -- H09
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r2,'Gouvernant(e) général(e)','Hôtellerie & Restauration','CDI','3-5 ans',28000,34000,'annuel','immediat','Paris','France',48.8566,2.3522,'100% présentiel',NULL,'Jamais',
    'Vous supervisez le service de housekeeping de notre hôtel boutique. Garant(e) de la propreté et de l''excellente tenue des chambres et des espaces communs.',
    ARRAY['Organiser et planifier le travail des équipes d''étage','Contrôler la qualité des chambres et espaces communs','Gérer les stocks de linge et de produits d''entretien','Assurer la liaison avec la réception sur les statuts des chambres','Former les nouvelles recrues aux standards de la maison'],
    'Expérience en housekeeping dans un hôtel haut de gamme. Rigueur, sens du détail, bonne maîtrise du français et notions d''anglais.',
    ARRAY['Housekeeping','Gestion des stocks alimentaires','Accueil client'],
    ARRAY['Gestion d''équipe','Expérience client'],
    ARRAY['Mutuelle','Tickets restaurant','Remboursement transport'],
    ARRAY['Entretien téléphonique','Visite des étages avec la responsable hébergement'],
    'publiée','publiée',true,'2026-10-09T09:00:00Z','2027-04-09T09:00:00Z','2026-10-09T09:00:00Z');

  -- H10
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r2,'Pâtissier(ère)','Hôtellerie & Restauration','CDI','3-5 ans',30000,36000,'annuel','immediat','Paris','France',48.8566,2.3522,'100% présentiel',NULL,'Jamais',
    'Rejoignez notre laboratoire de pâtisserie pour créer des desserts à la carte et la pâtisserie du service petit-déjeuner. Vous travaillez en étroite collaboration avec le chef de cuisine.',
    ARRAY['Réaliser les desserts à la carte et les mignardises','Préparer la viennoiserie et les pâtisseries du petit-déjeuner','Créer de nouvelles recettes en accord avec les saisons','Gérer les stocks matières premières de la pâtisserie','Former les commis affectés à la pâtisserie'],
    'Pâtissier(ère) avec 3 à 5 ans d''expérience en restauration gastronomique ou en pâtisserie de luxe. Créativité, précision et maîtrise des techniques de base.',
    ARRAY['Pâtisserie','Cuisine','HACCP','Gestion des stocks alimentaires'],
    ARRAY['Boulangerie','ISO 22000'],
    ARRAY['Mutuelle','Tickets restaurant','Formation'],
    ARRAY['Essai en laboratoire','Entretien avec le chef'],
    'publiée','publiée',true,'2026-10-13T09:00:00Z','2027-04-13T09:00:00Z','2026-10-13T09:00:00Z');

  -- H11
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r2,'Directeur(trice) de restaurant','Hôtellerie & Restauration','CDI','+10 ans',56000,70000,'annuel','2026-12-01','Paris','France',48.8566,2.3522,'100% présentiel',NULL,'Jamais',
    'Vous prenez la direction de notre restaurant gastronomique. Vous pilotez l''ensemble des opérations salle et participez à la stratégie de l''établissement.',
    ARRAY['Diriger et animer les équipes salle (15 personnes)','Définir et faire respecter les standards de service','Gérer les budgets et les coûts du restaurant','Développer les relations avec la presse et les guides','Participer aux recrutements et à la formation des équipes'],
    'Directeur(trice) de restaurant issu(e) d''une grande maison étoilée. Expérience de 10 ans minimum, excellent sens commercial et véritable culture gastronomique.',
    ARRAY['Service en salle','Gestion d''équipe','Gestion des coûts','Accueil client','Gestion des événements'],
    ARRAY['Revenue management','Sommellerie','Banquets'],
    ARRAY['Mutuelle','RTT','Intéressement','Formation'],
    ARRAY['Entretien avec la direction générale','Déjeuner de découverte','Présentation d''un plan d''action'],
    'publiée','publiée',true,'2026-10-17T09:00:00Z','2027-04-17T09:00:00Z','2026-10-17T09:00:00Z');

  -- H12 (brouillon)
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r2,'Chef de cuisine','Hôtellerie & Restauration','CDI','5-10 ans',50000,65000,'annuel',NULL,'Marseille','France',43.2965,5.3698,'100% présentiel',NULL,'Jamais',
    'Poste en cours de définition pour notre ouverture à Marseille. Chef de cuisine pour un restaurant bistronomique.',
    ARRAY['Concevoir la carte et les menus','Diriger la brigade de cuisine','Gérer les coûts matières'],
    'Chef de cuisine créatif avec une expérience bistronomique solide.',
    ARRAY['Cuisine','Gestion d''équipe','HACCP','Gestion des coûts'],
    ARRAY[]::text[],ARRAY[]::text[],
    ARRAY['Entretien avec la direction'],
    'brouillon','brouillon',false,NULL,NULL,'2026-10-19T09:00:00Z');

  -- H13 (brouillon)
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r2,'Responsable F&B','Hôtellerie & Restauration','CDI','5-10 ans',50000,65000,'annuel',NULL,'Paris','France',48.8566,2.3522,'100% présentiel',NULL,'Jamais',
    'Responsable Food & Beverage pour piloter l''ensemble de l''offre restauration de nos deux établissements parisiens.',
    ARRAY['Superviser les équipes restauration et bar','Optimiser les revenus F&B','Élaborer les offres banquets et événements'],
    'Profil F&B avec expérience en hôtellerie haut de gamme et maîtrise des outils de gestion.',
    ARRAY['Gestion des événements','Banquets','Gestion des coûts','Revenue management'],
    ARRAY[]::text[],ARRAY[]::text[],
    ARRAY['Entretien avec la direction générale'],
    'brouillon','brouillon',false,NULL,NULL,'2026-10-21T09:00:00Z');

  -- ═══════════════════════════════════════════════════════════════
  -- BLOC 4 — OFFRES ATELIERS MORVAN  N01–N12
  -- ═══════════════════════════════════════════════════════════════

  -- N01
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r3,'Technicien(ne) de maintenance','Industrie & Production','CDI','1-2 ans',28000,34000,'annuel','immediat','Dijon','France',47.3220,5.0415,'100% présentiel',NULL,'Jamais',
    'Vous intervenez sur la maintenance préventive et curative des équipements de production de notre site dijonnais. Vous travaillez en équipe 2×8.',
    ARRAY['Réaliser les opérations de maintenance préventive planifiées','Diagnostiquer et réparer les pannes sur les équipements','Renseigner les interventions dans la GMAO','Proposer des améliorations pour réduire les arrêts machine','Respecter les consignes HSE et les habilitations requises'],
    'BTS Maintenance industrielle ou électrotechnique. Première expérience en milieu industriel. Lecture de plans techniques, habilitations électriques appréciées.',
    ARRAY['Maintenance préventive','Maintenance curative','GMAO','Électrotechnique','Lecture de plans techniques'],
    ARRAY['Mécanique industrielle','Habilitations électriques'],
    ARRAY['Mutuelle','Tickets restaurant','RTT'],
    ARRAY['Entretien téléphonique','Entretien technique sur site','Visite des ateliers'],
    'publiée','publiée',true,'2026-09-06T09:00:00Z','2027-03-06T09:00:00Z','2026-09-06T09:00:00Z');

  -- N02
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r3,'Opérateur(trice) de production','Industrie & Production','CDI','Sans expérience',22000,26000,'annuel','immediat','Dijon','France',47.3220,5.0415,'100% présentiel',NULL,'Jamais',
    'Vous intégrez une ligne de production sur notre site de Dijon. Formation interne assurée. Poste accessible aux débutants motivés.',
    ARRAY['Alimenter et surveiller les machines de production','Effectuer les contrôles qualité en cours de fabrication','Signaler toute anomalie au chef d''équipe','Respecter les cadences et les instructions de production','Participer aux opérations de nettoyage des postes'],
    'Débutant(e) accepté(e). Sérieux(se), ponctuel(le), à l''aise en environnement industriel. Travail en équipe 2×8 ou 3×8.',
    ARRAY['Contrôle qualité','Normes ISO'],
    ARRAY['Lean management','Amélioration continue'],
    ARRAY['Mutuelle','Tickets restaurant','Intéressement'],
    ARRAY['Entretien téléphonique','Entretien avec le chef de production'],
    'publiée','publiée',true,'2026-09-10T09:00:00Z','2027-03-10T09:00:00Z','2026-09-10T09:00:00Z');

  -- N03
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r3,'Responsable de production','Industrie & Production','CDI','5-10 ans',48000,58000,'annuel','immediat','Dijon','France',47.3220,5.0415,'100% présentiel',NULL,'Occasionnels',
    'Vous prenez la responsabilité d''un atelier de 40 personnes sur notre site de Dijon. Objectifs : productivité, qualité, sécurité et développement des équipes.',
    ARRAY['Piloter la production en respectant les objectifs QCD','Manager et animer une équipe de 40 opérateurs','Analyser les indicateurs TRS et mettre en place des plans d''amélioration','Garantir le respect des normes qualité et HSE','Participer aux chantiers d''amélioration continue'],
    'Ingénieur(e) ou technicien(ne) supérieur(e) avec expérience en management de production industrielle. Maîtrise du Lean, leadership affirmé.',
    ARRAY['Gestion de production','Lean management','Amélioration continue','TRS','Planification de production'],
    ARRAY['Six Sigma','AMDEC','Normes ISO'],
    ARRAY['Mutuelle','RTT','Véhicule de fonction','Intéressement'],
    ARRAY['Entretien téléphonique','Entretien avec le directeur industriel','Visite du site'],
    'publiée','publiée',true,'2026-09-16T09:00:00Z','2027-03-16T09:00:00Z','2026-09-16T09:00:00Z');

  -- N04
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r3,'Ingénieur(e) qualité','Industrie & Production','CDI','3-5 ans',40000,48000,'annuel','immediat','Beaune','France',47.0262,4.8396,'100% présentiel',NULL,'Occasionnels',
    'Vous pilotez le système qualité de notre site secondaire de Beaune. Vous êtes référent(e) des audits internes et externes et animez la démarche d''amélioration continue.',
    ARRAY['Maintenir et améliorer le système de management qualité','Piloter les audits internes et préparer les audits clients','Traiter les non-conformités et piloter les actions correctives','Former les équipes aux outils qualité','Assurer la veille réglementaire et normative'],
    'Ingénieur(e) qualité avec expérience en industrie. Maîtrise des normes ISO 9001, des outils AMDEC et 8D. Rigueur, pédagogie et capacité d''influence.',
    ARRAY['Contrôle qualité','Normes ISO','Gestion des non-conformités','AMDEC','Métrologie'],
    ARRAY['Six Sigma','Lean management'],
    ARRAY['Mutuelle','RTT','Tickets restaurant','Formation'],
    ARRAY['Entretien téléphonique','Entretien technique','Rencontre avec le directeur qualité'],
    'publiée','publiée',true,'2026-09-23T09:00:00Z','2027-03-23T09:00:00Z','2026-09-23T09:00:00Z');

  -- N05
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r3,'Technicien(ne) HSE','Industrie & Production','CDI','3-5 ans',35000,42000,'annuel','immediat','Dijon','France',47.3220,5.0415,'100% présentiel',NULL,'Jamais',
    'Vous assurez la mise en œuvre et le suivi du système HSE sur notre site de Dijon. Vous êtes en première ligne pour prévenir les risques et accompagner les équipes.',
    ARRAY['Réaliser les évaluations des risques (DUERP)','Animer les causeries sécurité et formations HSE','Gérer les incidents et les accidents du travail','Suivre les indicateurs HSE et produire les rapports réglementaires','Assurer la veille réglementaire en matière de sécurité'],
    'Technicien(ne) HSE avec expérience en milieu industriel. Connaissance des réglementations, sens du terrain et aptitude à convaincre sans autorité.',
    ARRAY['HSE','Normes ISO'],
    ARRAY['Lean management','Amélioration continue'],
    ARRAY['Mutuelle','RTT','Tickets restaurant'],
    ARRAY['Entretien téléphonique','Visite du site','Entretien avec le responsable HSE groupe'],
    'publiée','publiée',true,'2026-09-29T09:00:00Z','2027-03-29T09:00:00Z','2026-09-29T09:00:00Z');

  -- N06
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r3,'Responsable maintenance','Industrie & Production','CDI','5-10 ans',46000,56000,'annuel','immediat','Dijon','France',47.3220,5.0415,'100% présentiel',NULL,'Jamais',
    'Vous pilotez le service maintenance du site de Dijon (équipe de 8 techniciens). Vous définissez et optimisez la politique de maintenance préventive et assurez la disponibilité des équipements.',
    ARRAY['Manager l''équipe de techniciens de maintenance','Définir et piloter le plan de maintenance préventive','Optimiser le parc machines et planifier les investissements','Analyser les défaillances et déployer des plans de fiabilisation','Gérer le budget maintenance et les relations fournisseurs'],
    'Ingénieur(e) ou technicien(ne) supérieur(e) avec expérience en responsable maintenance industrielle. Maîtrise de la GMAO, leadership et sens de l''organisation.',
    ARRAY['Maintenance préventive','Maintenance curative','GMAO','Amélioration continue','Lean management'],
    ARRAY['Automatisation','Hydraulique','Pneumatique'],
    ARRAY['Mutuelle','RTT','Véhicule de fonction','Intéressement'],
    ARRAY['Entretien téléphonique','Entretien technique','Rencontre avec le directeur industriel'],
    'publiée','publiée',true,'2026-10-03T09:00:00Z','2027-04-03T09:00:00Z','2026-10-03T09:00:00Z');

  -- N07
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r3,'Chef d''atelier','Industrie & Production','CDI','3-5 ans',40000,48000,'annuel','immediat','Chalon-sur-Saône','France',46.7869,4.8555,'100% présentiel',NULL,'Jamais',
    'Vous animez et encadrez l''atelier de fabrication de notre site de Chalon-sur-Saône (15 opérateurs). Vous êtes le garant des objectifs de productivité et de qualité.',
    ARRAY['Animer et encadrer l''équipe de 15 opérateurs','Ordonnancer la production selon le planning','Assurer le respect des standards qualité et des délais','Participer aux chantiers Lean et d''amélioration continue','Assurer le reporting hebdomadaire auprès du responsable de production'],
    'Technicien(ne) supérieur(e) ou BTS avec expérience en encadrement d''équipe en milieu industriel. Rigueur, sens du terrain et aptitude au management.',
    ARRAY['Gestion de production','Lean management','Contrôle qualité','Planification de production'],
    ARRAY['Amélioration continue','Six Sigma','TRS'],
    ARRAY['Mutuelle','Tickets restaurant','RTT'],
    ARRAY['Entretien téléphonique','Entretien avec le responsable de site','Visite de l''atelier'],
    'publiée','publiée',true,'2026-10-07T09:00:00Z','2027-04-07T09:00:00Z','2026-10-07T09:00:00Z');

  -- N08
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r3,'Opérateur(trice) soudeur','Industrie & Production','CDD','1-2 ans',24000,28000,'annuel','immediat','Dijon','France',47.3220,5.0415,'100% présentiel',NULL,'Jamais',
    'CDD de 6 mois pour faire face à un pic d''activité. Vous réalisez des opérations de soudure sur des structures métalliques selon les plans techniques fournis.',
    ARRAY['Réaliser les soudures MIG/MAG et TIG selon les plans','Contrôler la conformité des soudures','Préparer les pièces avant soudage (dégraissage, meulage)','Renseigner les documents de traçabilité','Respecter les consignes de sécurité et HSE'],
    'Opérateur soudeur avec expérience MIG/MAG. Lecture de plans techniques. Qualification soudeur appréciée.',
    ARRAY['Soudure','Lecture de plans techniques','Mécanique industrielle'],
    ARRAY['Habilitations électriques','Contrôle qualité'],
    ARRAY['Mutuelle','Tickets restaurant'],
    ARRAY['Entretien téléphonique','Test pratique soudure'],
    'publiée','publiée',true,'2026-10-11T09:00:00Z','2027-04-11T09:00:00Z','2026-10-11T09:00:00Z');

  -- N09
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r3,'Logisticien(ne)','Industrie & Production','CDI','1-2 ans',26000,32000,'annuel','immediat','Dijon','France',47.3220,5.0415,'100% présentiel',NULL,'Jamais',
    'Vous gérez les flux logistiques du site de Dijon : approvisionnements, gestion des stocks et expéditions. Vous travaillez en lien direct avec la production et les fournisseurs.',
    ARRAY['Gérer les approvisionnements et les commandes fournisseurs','Assurer la réception, le contrôle et le rangement des matières','Préparer les expéditions et les documents de transport','Maintenir un niveau de stock optimal','Participer aux inventaires périodiques'],
    'BTS Logistique ou Supply Chain. Première expérience en logistique industrielle. À l''aise avec un ERP, rigoureux(se) et organisé(e).',
    ARRAY['Approvisionnement','Supply chain industrielle'],
    ARRAY['Lean management','Planification de production'],
    ARRAY['Mutuelle','Tickets restaurant','Intéressement'],
    ARRAY['Entretien téléphonique','Entretien sur site'],
    'publiée','publiée',true,'2026-10-15T09:00:00Z','2027-04-15T09:00:00Z','2026-10-15T09:00:00Z');

  -- N10
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r3,'Technicien(ne) en automatisme','Industrie & Production','CDI','3-5 ans',36000,44000,'annuel','immediat','Dijon','France',47.3220,5.0415,'100% présentiel',NULL,'Jamais',
    'Vous assurez la programmation, la mise en service et la maintenance des automates et systèmes de supervision de notre parc machines.',
    ARRAY['Programmer et configurer les automates (Siemens, Schneider)','Développer et maintenir les interfaces SCADA','Diagnostiquer et résoudre les défaillances automatisme','Rédiger la documentation technique','Participer aux projets d''amélioration et de modernisation'],
    'Technicien(ne) en automatisme industrielle, maîtrise de la programmation automate (Step 7, TIA Portal). Connaissances en réseaux industriels appréciées.',
    ARRAY['Automatisation','Électrotechnique','Mécanique industrielle'],
    ARRAY['Robotique','GMAO'],
    ARRAY['Mutuelle','RTT','Tickets restaurant','Formation'],
    ARRAY['Entretien téléphonique','Test technique','Entretien sur site'],
    'publiée','publiée',true,'2026-10-18T09:00:00Z','2027-04-18T09:00:00Z','2026-10-18T09:00:00Z');

  -- N11
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r3,'Chargé(e) méthodes','Industrie & Production','Alternance','Sans expérience',NULL,NULL,'annuel','immediat','Dijon','France',47.3220,5.0415,'100% présentiel',NULL,'Jamais',
    'Alternance de 2 ans au sein du service méthodes. Vous participez à l''optimisation des processus de fabrication et à la mise à jour de la documentation technique.',
    ARRAY['Participer à l''analyse et à l''optimisation des gammes de fabrication','Rédiger et mettre à jour les instructions de travail','Contribuer aux chantiers d''amélioration continue','Réaliser des études de temps et de capacité','Travailler en lien avec les équipes production et qualité'],
    'Étudiant(e) en BTS Conception de Produits Industriels ou DUT GMP. Curiosité technique, rigueur et sens du terrain.',
    ARRAY['Lecture de plans techniques','Amélioration continue'],
    ARRAY['CAO','Lean management'],
    ARRAY['Mutuelle','Tickets restaurant','Formation'],
    ARRAY['Entretien téléphonique','Entretien avec le responsable méthodes'],
    'publiée','publiée',true,'2026-10-21T09:00:00Z','2027-04-21T09:00:00Z','2026-10-21T09:00:00Z');

  -- N12 (brouillon)
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r3,'Ingénieur(e) procédés','Industrie & Production','CDI','3-5 ans',42000,50000,'annuel',NULL,'Mâcon','France',46.3063,4.8281,'100% présentiel',NULL,'Occasionnels',
    'Poste en cours de validation. Ingénieur(e) procédés pour notre nouveau site de Mâcon.',
    ARRAY['Définir et optimiser les procédés de fabrication','Assurer le transfert industriel des nouveaux produits','Piloter les qualifications de procédés'],
    'Ingénieur(e) procédés avec expérience en industrie. Maîtrise des outils d''analyse et de résolution de problèmes.',
    ARRAY['Gestion de production','Normes ISO','Contrôle qualité','Amélioration continue'],
    ARRAY[]::text[],ARRAY[]::text[],
    ARRAY['Entretien avec le directeur industriel'],
    'brouillon','brouillon',false,NULL,NULL,'2026-10-23T09:00:00Z');

  -- ═══════════════════════════════════════════════════════════════
  -- BLOC 5 — OFFRES STACKLAB  S01–S12
  -- ═══════════════════════════════════════════════════════════════

  -- S01
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r4,'Développeur(se) Full Stack','Tech & Ingénierie','CDI','3-5 ans',48000,58000,'annuel','immediat','Paris','France',48.8566,2.3522,'Hybride',3,'Jamais',
    'Vous rejoignez l''équipe produit de Stacklab pour contribuer au développement de notre plateforme SaaS. Vous travaillez sur l''ensemble de la stack, du front React au back Node.js.',
    ARRAY['Développer de nouvelles fonctionnalités produit en TypeScript','Maintenir et améliorer les APIs REST','Écrire des tests unitaires et d''intégration','Participer aux revues de code et à l''architecture','Contribuer à l''amélioration continue des pratiques DevOps'],
    'Développeur(se) Full Stack avec 3 à 5 ans d''expérience, maîtrise de TypeScript, React et Node.js. À l''aise en environnement Agile, rigueur et curiosité.',
    ARRAY['TypeScript','React','Node.js','PostgreSQL','Git','Docker','Tests automatisés','REST API'],
    ARRAY['Next.js','CI/CD','Méthodes agiles'],
    ARRAY['Mutuelle','RTT','Stock options','Formation','Remboursement transport'],
    ARRAY['Entretien RH 30 min','Test technique en ligne','Entretien technique avec l''équipe','Offre'],
    'publiée','publiée',true,'2026-09-03T09:00:00Z','2027-03-03T09:00:00Z','2026-09-03T09:00:00Z');

  -- S02
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r4,'Développeur(se) Back-end Node.js','Tech & Ingénierie','CDI','3-5 ans',50000,60000,'annuel','immediat','Paris','France',48.8566,2.3522,'Hybride',3,'Jamais',
    'Vous renforcez l''équipe back-end pour concevoir et maintenir les APIs et les services critiques de notre infrastructure SaaS.',
    ARRAY['Concevoir et développer des APIs RESTful et GraphQL','Optimiser les requêtes et les performances base de données','Participer à la conception de l''architecture microservices','Mettre en place des tests automatisés robustes','Assurer la sécurité applicative des services'],
    'Expert(e) Node.js et TypeScript avec une solide expérience en architecture back-end. Connaissance PostgreSQL, maîtrise des patterns microservices.',
    ARRAY['Node.js','TypeScript','PostgreSQL','REST API','GraphQL','Docker','Microservices','Tests automatisés'],
    ARRAY['Kubernetes','AWS','Sécurité applicative'],
    ARRAY['Mutuelle','RTT','Stock options','Formation','Remboursement transport'],
    ARRAY['Entretien RH','Test technique','Review de code live','Offre'],
    'publiée','publiée',true,'2026-09-08T09:00:00Z','2027-03-08T09:00:00Z','2026-09-08T09:00:00Z');

  -- S03
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r4,'DevOps Engineer','Tech & Ingénierie','CDI','3-5 ans',52000,64000,'annuel','immediat','Lyon','France',45.7640,4.8357,'Hybride',2,'Jamais',
    'Vous rejoignez notre équipe infra depuis Lyon pour fiabiliser et automatiser nos pipelines de déploiement et notre infrastructure cloud.',
    ARRAY['Maintenir et améliorer notre infrastructure AWS','Développer et optimiser les pipelines CI/CD','Mettre en place et gérer les solutions de monitoring et d''alerting','Participer aux astreintes et traiter les incidents de production','Documenter l''infrastructure et former l''équipe aux bonnes pratiques'],
    'DevOps avec expérience AWS, Kubernetes et CI/CD. Solides compétences en scripting. Culture SRE appréciée.',
    ARRAY['AWS','Docker','Kubernetes','CI/CD','Linux','Scripting Shell','Terraform'],
    ARRAY['GCP','Azure','Microservices'],
    ARRAY['Mutuelle','RTT','Stock options','Formation','Remboursement transport'],
    ARRAY['Entretien RH','Test technique infra','Entretien avec le CTO'],
    'publiée','publiée',true,'2026-09-14T09:00:00Z','2027-03-14T09:00:00Z','2026-09-14T09:00:00Z');

  -- S04
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r4,'Data Engineer','Tech & Ingénierie','CDI','3-5 ans',50000,62000,'annuel','immediat','Paris','France',48.8566,2.3522,'Hybride',3,'Jamais',
    'Vous construisez et maintenez notre infrastructure de données pour alimenter les tableaux de bord produit et les analyses business.',
    ARRAY['Concevoir et maintenir les pipelines de données','Modéliser les entrepôts et datamart','Garantir la qualité et la cohérence des données','Mettre en place des outils de monitoring des flux','Collaborer avec les équipes produit et business sur les besoins analytiques'],
    'Data Engineer avec expérience en Python, SQL et outils de pipeline. Maîtrise d''un outil d''orchestration (Airflow, Prefect). Rigueur et sens de la documentation.',
    ARRAY['Python','SQL','PostgreSQL','Data engineering','Git','Docker'],
    ARRAY['AWS','Machine learning','Terraform'],
    ARRAY['Mutuelle','RTT','Stock options','Formation'],
    ARRAY['Entretien RH','Test technique data','Entretien avec le lead data'],
    'publiée','publiée',true,'2026-09-19T09:00:00Z','2027-03-19T09:00:00Z','2026-09-19T09:00:00Z');

  -- S05
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r4,'Product Designer','Tech & Ingénierie','CDI','3-5 ans',44000,52000,'annuel','immediat','Paris','France',48.8566,2.3522,'Hybride',3,'Jamais',
    'Vous concevez les interfaces de notre plateforme SaaS en centrant chaque décision sur l''expérience utilisateur. Vous travaillez en binôme avec les product managers.',
    ARRAY['Réaliser des recherches utilisateurs et des tests','Créer des wireframes et prototypes dans Figma','Concevoir les flows et les composants du design system','Collaborer avec les développeurs pour garantir l''implémentation fidèle','Contribuer à la roadmap UX du produit'],
    'Product Designer avec expérience en SaaS B2B. Maîtrise de Figma, sensibilité aux problèmes d''accessibilité. Capacité à travailler en équipe pluridisciplinaire.',
    ARRAY['Figma','UX Research','Prototypage','Wireframing','Design system','Tests utilisateurs'],
    ARRAY['UI design','Accessibilité numérique'],
    ARRAY['Mutuelle','RTT','Stock options','Formation'],
    ARRAY['Entretien RH','Présentation de portfolio','Entretien avec le PM et un dev'],
    'publiée','publiée',true,'2026-09-24T09:00:00Z','2027-03-24T09:00:00Z','2026-09-24T09:00:00Z');

  -- S06
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r4,'Tech Lead','Tech & Ingénierie','CDI','5-10 ans',68000,82000,'annuel','immediat','Paris','France',48.8566,2.3522,'Hybride',3,'Jamais',
    'Vous prenez la tête technique d''une squad produit de 4 développeurs. Vous êtes garant(e) de la qualité du code, des choix d''architecture et de la montée en compétences de l''équipe.',
    ARRAY['Définir les standards techniques et les bonnes pratiques','Conduire les revues de code et les sessions d''architecture','Mentorer les développeurs junior et intermédiaire','Contribuer activement au développement (50 % du temps)','Participer aux décisions produit et aux rituels Agile'],
    'Tech Lead avec expérience en développement Full Stack et en leadership technique. TypeScript, React, Node.js. Pédagogie, vision système et goût pour le feedback.',
    ARRAY['TypeScript','React','Node.js','Architecture logicielle','Git','Docker','CI/CD','Méthodes agiles','Scrum'],
    ARRAY['Microservices','PostgreSQL','Tests automatisés'],
    ARRAY['Mutuelle','RTT','Stock options','Formation','Salle de sport'],
    ARRAY['Entretien RH','Test technique','System design','Entretien CTO'],
    'publiée','publiée',true,'2026-09-30T09:00:00Z','2027-03-30T09:00:00Z','2026-09-30T09:00:00Z');

  -- S07
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r4,'Développeur(se) Front-end React','Tech & Ingénierie','CDI','1-2 ans',38000,46000,'annuel','immediat','Nantes','France',47.2184,-1.5536,'Hybride',2,'Jamais',
    'Poste front-end depuis Nantes. Vous contribuez au développement de l''interface de notre produit en React et TypeScript.',
    ARRAY['Développer des composants React réutilisables','Implémenter les designs fournis par l''équipe UX','Écrire des tests unitaires et de bout en bout','Participer aux revues de code','Optimiser les performances de l''application'],
    'Développeur(se) front-end avec une première expérience significative en React. TypeScript, Git, curiosité pour l''accessibilité.',
    ARRAY['React','TypeScript','JavaScript','Git','Tests automatisés'],
    ARRAY['Next.js','Figma','Accessibilité numérique'],
    ARRAY['Mutuelle','RTT','Remboursement transport','Formation'],
    ARRAY['Entretien RH','Test technique front','Entretien avec l''équipe'],
    'publiée','publiée',true,'2026-10-04T09:00:00Z','2027-04-04T09:00:00Z','2026-10-04T09:00:00Z');

  -- S08
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r4,'QA Engineer','Tech & Ingénierie','CDI','1-2 ans',35000,44000,'annuel','immediat','Paris','France',48.8566,2.3522,'Hybride',2,'Jamais',
    'Vous rejoignez l''équipe qualité pour mettre en place et maintenir la stratégie de tests automatisés de Stacklab.',
    ARRAY['Écrire et maintenir les tests end-to-end et d''intégration','Identifier et documenter les bugs','Collaborer avec les développeurs pour améliorer la couverture de tests','Participer à la définition des critères d''acceptation','Contribuer à l''amélioration du pipeline CI/CD'],
    'QA Engineer avec expérience en tests automatisés. Maîtrise d''un framework de test (Playwright, Cypress). Rigueur, sens du détail et esprit analytique.',
    ARRAY['Tests automatisés','Git','CI/CD'],
    ARRAY['JavaScript','TypeScript','Docker'],
    ARRAY['Mutuelle','RTT','Remboursement transport','Formation'],
    ARRAY['Entretien RH','Test technique QA','Entretien avec le lead'],
    'publiée','publiée',true,'2026-10-09T09:00:00Z','2027-04-09T09:00:00Z','2026-10-09T09:00:00Z');

  -- S09
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r4,'Architecte logiciel','Tech & Ingénierie','CDI','+10 ans',82000,100000,'annuel','immediat','Paris','France',48.8566,2.3522,'100% remote',NULL,'Jamais',
    'Poste entièrement remote. Vous définissez l''architecture technique de Stacklab, guidez les équipes dans leurs choix et préparez le passage à l''échelle.',
    ARRAY['Définir la vision et les standards d''architecture','Identifier et résoudre les problèmes de scalabilité','Accompagner les Tech Leads dans leurs décisions techniques','Produire des ADR (Architecture Decision Records)','Être le garant de la dette technique et de la qualité globale'],
    'Architecte logiciel avec 10 ans minimum d''expérience, maîtrise des patterns distribués, microservices et cloud-native. Excellent communicant(e), pédagogue.',
    ARRAY['Architecture logicielle','Microservices','Docker','Kubernetes','AWS','PostgreSQL','CI/CD','Sécurité applicative'],
    ARRAY['Terraform','GCP','Data engineering'],
    ARRAY['Mutuelle','RTT','Stock options','Formation','Télétravail'],
    ARRAY['Entretien RH','System design (2h)','Entretien CTO','Offre'],
    'publiée','publiée',true,'2026-10-13T09:00:00Z','2027-04-13T09:00:00Z','2026-10-13T09:00:00Z');

  -- S10
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r4,'Développeur(se) Full Stack','Tech & Ingénierie','Alternance','Sans expérience',NULL,NULL,'annuel','immediat','Paris','France',48.8566,2.3522,'Hybride',3,'Jamais',
    'Alternance de 12 à 24 mois pour rejoindre notre équipe produit. Vous serez immergé(e) dans notre stack TypeScript / React / Node.js dès le premier jour.',
    ARRAY['Contribuer au développement de nouvelles fonctionnalités','Participer aux revues de code','Écrire des tests pour vos développements','Assister aux rituels Agile (standup, sprint planning, rétro)','Apprendre en binôme avec un développeur senior'],
    'Étudiant(e) en école d''ingénieurs ou master informatique. Bases solides en JavaScript ou TypeScript. Curiosité, autonomie et envie d''apprendre.',
    ARRAY['JavaScript','TypeScript','Git'],
    ARRAY['React','Node.js','Algorithmique'],
    ARRAY['Mutuelle','Tickets restaurant','Formation'],
    ARRAY['Entretien RH','Test technique court','Entretien avec un dev senior'],
    'publiée','publiée',true,'2026-10-17T09:00:00Z','2027-04-17T09:00:00Z','2026-10-17T09:00:00Z');

  -- S11
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r4,'CTO / Directeur(trice) technique','Tech & Ingénierie','CDI','+10 ans',105000,130000,'annuel','2027-01-01','Paris','France',48.8566,2.3522,'Hybride',3,'Jamais',
    'Stacklab cherche son futur CTO pour accompagner la phase d''hypercroissance. Vous pilotez une équipe de 15 ingénieurs et portez la vision technique à 3 ans.',
    ARRAY['Définir et exécuter la roadmap technique','Recruter, manager et développer l''équipe engineering','Travailler en étroite collaboration avec le CEO et les PM','Piloter l''architecture et les choix d''infrastructure','Représenter la tech auprès des investisseurs et des clients clés'],
    'CTO ou VP Engineering avec expérience en startup SaaS en hypercroissance. Excellents skills en management et en communication. Vision produit-tech affirmée.',
    ARRAY['Architecture logicielle','CI/CD','Docker','Kubernetes','AWS','Méthodes agiles','Scrum'],
    ARRAY['Machine learning','Data engineering','Sécurité applicative'],
    ARRAY['Mutuelle','RTT','Stock options','Intéressement','Formation'],
    ARRAY['Appel de découverte avec le CEO','Entretien board','Présentation vision technique','Offre'],
    'publiée','publiée',true,'2026-10-22T09:00:00Z','2027-04-22T09:00:00Z','2026-10-22T09:00:00Z');

  -- S12 (brouillon)
  INSERT INTO offres (recruteur_id,titre,domaine,type_contrat,experience,salaire_min,salaire_max,periode_salaire,date_debut,ville,pays,latitude,longitude,mode_travail,jours_remote,deplacements,description,missions,profil_recherche,competences,competences_bonus,avantages,process_recrutement,statut,statut_publication,active,published_at,expire_at,created_at)
  VALUES (r4,'Développeur(se) Mobile React Native','Tech & Ingénierie','CDI','3-5 ans',48000,60000,'annuel',NULL,'Paris','France',48.8566,2.3522,'Hybride',3,'Jamais',
    'Poste en cours de validation. Nous envisageons de créer une application mobile compagnon pour notre produit SaaS.',
    ARRAY['Développer l''application React Native iOS et Android','Intégrer les APIs existantes','Mettre en place les tests mobiles'],
    'Développeur(se) React Native avec expérience iOS/Android. Connaissance de l''écosystème mobile.',
    ARRAY['React','TypeScript','JavaScript','Git'],
    ARRAY[]::text[],
    ARRAY['Mutuelle','RTT','Stock options'],
    ARRAY['Entretien RH','Test technique mobile'],
    'brouillon','brouillon',false,NULL,NULL,'2026-10-25T09:00:00Z');

END $seed$;
