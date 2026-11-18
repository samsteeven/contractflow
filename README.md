# ContractFlow : créer, faire valider et suivre ses contrats

Plateforme SaaS de gestion des contrats en **AdonisJS 7**, **Inertia** et **React 19**, sur PostgreSQL. Une organisation y rédige ses contrats et définit ses circuits de validation (juridique, puis direction, puis propriétaire…). Elle fait ensuite valider chaque contrat étape par étape, sur un texte qui ne change plus, avec un journal de tout ce qui s'est passé.

> **État : incrément 5.** Organisations, rôles, contrats versionnés, circuits configurables, décisions, comparaison de versions, journal, modèles à variables, commentaires, PDF archivés sur S3, **signature électronique (bac à sable) par webhook signé et contrat signé figé**, **durée, obligations, reconduction et rappels par e-mail via une file Redis**, **invitations par e-mail, pièces jointes analysées par antivirus, politique de contenu (CSP) et tests de bout en bout Cypress**. Voir [la feuille de route](#feuille-de-route).

## Le parcours qui fonctionne

1. **Inscription** : le compte et son organisation sont créés ensemble, et la personne en devient la propriétaire.
2. **Équipe** : un administrateur ajoute des comptes avec un rôle : juridique, direction, rédacteur, lecteur…
3. **Circuits** : un administrateur définit des circuits, c'est-à-dire des suites d'étapes confiées chacune à un rôle.
4. **Contrats** : un rédacteur crée un contrat (version 1), le révise (versions 2, 3…) et compare deux versions ligne à ligne.
5. **Soumission** : il soumet le contrat à un circuit. Les étapes sont copiées et attachées à la version soumise.
6. **Validation** : chaque approbateur voit sur son tableau de bord les contrats dont l'étape active attend son rôle. Il valide, ou rejette en motivant sa décision.
7. **Rejet et révision** : un rejet renvoie le contrat au rédacteur, qui le révise et le soumet à nouveau (nouveau tour).
8. **Fin du circuit** : la dernière validation approuve le contrat. Le journal garde chaque action, avec son auteur, sa date et la version concernée.
9. **Modèles** : un rédacteur enregistre un texte avec des variables (`{{prestataire}}`, `{{montant}}`…) ; créer un contrat depuis ce modèle demande une valeur par variable.
10. **Commentaires** : les membres qui rédigent commentent le contrat, rattaché à la version qu'ils lisent.
11. **PDF** : un contrat approuvé s'archive en PDF (texte, dossier de validation, empreinte), stocké sur S3 et téléchargé par une URL pré-signée de cinq minutes.
12. **Signature** : la direction envoie le PDF à un à cinq signataires. Le contrat passe en signature et ne peut plus être modifié. Les signatures reviennent par un webhook signé ; quand tous ont signé, le contrat est **signé**, figé par la base, et la preuve est archivée. Un refus ou une annulation le rend à l'état approuvé.
13. **Durée et échéances** : sur un contrat signé, la direction ou un rédacteur définit la durée (début, fin, reconduction, préavis). L'échéance de non-reconduction se crée toute seule. On ajoute des obligations (paiement, livraison, rapport, revue) avec un responsable. La direction reconduit ou met fin ; le responsable clôt son obligation. La page **Échéances** liste tout, la plus proche en premier.
14. **Rappels** : chaque jour, une tâche de fond prévient le responsable par e-mail à 30 jours, 7 jours, 1 jour, le jour même et en cas de retard, une seule fois par palier.
15. **Invitations** : un administrateur invite une adresse avec un rôle ; la personne reçoit un lien valable sept jours, à usage unique. Elle crée son compte (ou se connecte si elle en a un) et rejoint l'organisation. L'administrateur voit les invitations en attente, les renvoie ou les retire.
16. **Pièces jointes** : un rédacteur joint des annexes (PDF, PNG, JPEG, DOCX, XLSX, 10 Mo) à un contrat. Chaque fichier est analysé par ClamAV avant d'être gardé ; un fichier infecté, d'un type trompeur ou non analysable est refusé et rien n'est stocké.

## Règles tenues

| Règle | Comment elle est tenue |
|---|---|
| Une étape ne se décide qu'à son tour | Seule la première étape en attente du tour courant est active |
| Une seule fois, par le bon rôle | Vérifié sous le verrou du contrat ; quatre décisions simultanées : une retenue, trois refusées ([ADR-004](docs/architecture/adr/0004-decisions-sous-verrou.md)) |
| Pas de validation de son propre texte | L'auteur de la version soumise ne peut pas la valider |
| Un rejet est motivé | Commentaire obligatoire |
| Le texte validé ne change plus | Pas de révision pendant une validation ; réviser un contrat approuvé le remet en brouillon |
| Versions et journal immuables | Un déclencheur PostgreSQL refuse `UPDATE` et `DELETE` ([ADR-005](docs/architecture/adr/0005-immuabilite-en-base.md)) |
| Un circuit modifié ne change pas une validation en cours | Les étapes sont copiées à la soumission ([ADR-003](docs/architecture/adr/0003-circuit-copie-a-la-soumission.md)) |
| Un PDF atteste d'une version approuvée | Produit seulement pour un contrat approuvé, un par version, idempotent sous verrou, ligne immuable ; fichier jamais public ([ADR-007](docs/architecture/adr/0007-modeles-pdf-et-stockage-s3.md)) |
| Un contrat n'a pas de trou | Un modèle ne se remplit que si chaque variable a une valeur ; une variable mal écrite est refusée à la création du modèle |
| Un événement de signature est authentique | Signature HMAC du corps brut vérifiée à temps constant avant toute lecture, fenêtre de cinq minutes ; un événement mal signé n'a aucun effet ([ADR-008](docs/architecture/adr/0008-signature-par-webhook-signe.md)) |
| Un événement ne compte qu'une fois | Identifiant d'événement unique, traité sous le verrou du contrat ; trois livraisons simultanées : une appliquée, deux `duplicate` |
| Un contrat signé ne change plus | Déclencheur PostgreSQL sur `contracts` (aucun UPDATE ni DELETE) ; modification refusée aussi côté service |
| Un rappel ne part pas deux fois par palier | Une ligne unique par (obligation, palier), tâche d'identifiant fixe, état relu à l'envoi ; au moins une livraison, jamais zéro ([ADR-009](docs/architecture/adr/0009-echeances-et-rappels-par-file.md)) |
| Une obligation close n'envoie plus rien | Le rappel est relu à l'envoi : obligation close, rappel `skipped` |
| Une reconduction ne double pas l'échéance | Sous le verrou du contrat, plus un index unique partiel ; deux reconductions simultanées : une échéance ouverte |
| Un lien d'invitation ne sert qu'une fois, à son destinataire | Jeton aléatoire dont seule l'empreinte est stockée, délai de sept jours, acceptation sous verrou, adresse fixée par l'invitation, jamais par le formulaire ; une autre adresse connectée est refusée ([ADR-010](docs/architecture/adr/0010-invitations-par-jeton.md)) |
| Aucun fichier non analysé n'est gardé | Antivirus injoignable, absent ou muet : fichier refusé. Type et contenu vérifiés, nom aléatoire, téléchargement forcé par URL pré-signée ([ADR-011](docs/architecture/adr/0011-pieces-jointes-antivirus-et-csp.md)) |
| Un script injecté ne s'exécute pas | CSP avec jeton renouvelé à chaque réponse, pas de `unsafe-inline` ni `unsafe-eval` pour les scripts ; un titre piégé s'affiche comme du texte |
| Les organisations ne se voient pas | L'organisation vient de l'appartenance, jamais de la requête ; une ressource d'une autre organisation répond 404 ([ADR-006](docs/architecture/adr/0006-organisation-par-appartenance.md)) |

## Ce qui est vérifié, et ce qui ne l'est pas

| Élément | Vérifié | Pas vérifié |
|---|---|---|
| Règles métier | 162 tests Japa contre un vrai PostgreSQL : versions, circuit, tours, rejeu, rôles, auto-validation, isolation, droits par rôle, parcours HTTP complet, rendu des données des pages ; modèles et variables, commentaires, PDF et téléchargement signé, signatures (demande, webhook, rejeu, concurrence, refus, annulation, figement), durée, obligations, reconduction, paliers de rappel, envoi, panne d'envoi, file Redis réelle, invitations (jeton, expiration, rejeu, concurrence, mauvais compte), pièces jointes (types, antivirus, panne, contrat figé), en-têtes de sécurité, isolation entre organisations | |
| Les tests protègent vraiment | 15 garde-fous cassés volontairement un par un (verrou, étape active, rôle, rejeu, motif, auteur, révision en validation, réouverture, filtres d'organisation, droits du lecteur, nomination d'un propriétaire, deux déclencheurs) : chaque casse fait échouer un test | |
| Mêmes tests sur S3 | Les 26 tests de modèles, commentaires et PDF passent aussi sur un S3 local (S3Mock), pas seulement sur le disque | Un vrai bucket AWS ; le refus d'une URL sans signature (S3Mock ne contrôle pas les signatures) |
| Les tests de l'incrément 2 protègent vraiment | 8 garde-fous cassés un par un (variable manquante, contrat non approuvé, un PDF par version, organisation du modèle, écriture du fichier, variable mal écrite, droit de générer, organisation du PDF) : chaque casse fait échouer un test | |
| Les tests de l'incrément 3 protègent vraiment | 14 garde-fous cassés un par un : 12 casses détectées (comparaison de la signature, fenêtre de temps, rejeu, état de la demande, état final, tous les signataires, retour à approuvé, écriture de la preuve, modification d'un contrat signé ou en signature, rôles, exception CSRF du webhook) ; 2 casses non détectées car doublées par un autre garde-fou (contrôle d'approbation de la demande, filtre de la preuve) | |
| Les tests de l'incrément 4 protègent vraiment | 8 garde-fous cassés un par un (contrat signé exigé, durée terminée, préavis, durée de reconduction, obligation close, limite du palier 7 jours, rappel déjà traité, délai de remise en file) : chaque casse fait échouer un test | |
| File et e-mails | Un test passe par BullMQ et un vrai Redis (parcours, tâche, worker, un seul e-mail) ; un e-mail réel a été reçu dans Mailpit depuis `node ace queue:work` | Un fournisseur d'e-mail réel ; le comportement sous forte charge ou après une panne de Redis longue |
| Les tests de l'incrément 5 protègent vraiment | 18 garde-fous cassés un par un (invitation réutilisable, mauvais compte, compte existant, rôle élevé, expiration, membre réinvité ; fichier infecté, contenu non vérifié, antivirus absent, contrat signé, taille, panne prise pour « sain » ; script sans jeton, CSP désactivée, objets, intégration en cadre, politique de référent) : 17 détectées, 1 non détectée (le verrou de l'acceptation, doublé par l'unicité de l'adresse en base) | |
| Antivirus réel | Un vrai ClamAV (Docker) : EICAR reconnu, y compris dans un `.docx` ; le protocole `INSTREAM` aussi testé contre un faux démon (cadrage des blocs, panne, silence, réponse inattendue) | Autre chose qu'EICAR : un antivirus ne trouve que ce qu'il connaît ; la signature EICAR n'est détectée qu'en début de fichier, pas dans un PDF qui la contient plus loin |
| Un vrai prestataire | | **Aucun prestataire extérieur n'a été branché** : le bac à sable émet des événements signés avec le même secret, vérifiés par le même code |
| Concurrence | Quatre décisions simultanées, cinq exécutions avec et sans verrou : sans verrou le test échoue 5 fois sur 5 | Sous forte charge |
| Interface | Toutes les pages parcourues (échéances et suivi de contrat compris : reconduction exécutée dans le navigateur) dans un navigateur sur les données de démonstration, sans erreur dans la console : tableau de bord, liste filtrée, création, détail avec comparaison, décision (refus d'un rejet non motivé, validation commentée), circuits, équipe | Les styles en ligne restent permis par la CSP ; pas de test d'accessibilité automatisé |
| Bout en bout | **Cypress, 15 scénarios dans 5 fichiers**, contre l'application complète (PostgreSQL, Mailpit, ClamAV) : parcours rédaction, rejet motivé, validation par deux rôles ; invitation lue dans la vraie boîte de réception, puis compte créé et lien rejeté la seconde fois ; pièces jointes saines, infectées et trompeuses ; échéances et reconduction ; en-têtes et XSS | La CSP ne se voit pas dans le navigateur de Cypress (il la retire) : elle est vérifiée par requêtes directes. Un seul navigateur (Electron) |
| Types | Compilation TypeScript stricte du serveur et du front ; données des pages et routes nommées typées de bout en bout | |

## Architecture

Monolithe AdonisJS ([ADR-001](docs/architecture/adr/0001-adonisjs-monolithe.md)). Les pages React reçoivent leurs données des contrôleurs par Inertia, sans API REST séparée ([ADR-002](docs/architecture/adr/0002-inertia-react.md)).

```
React (inertia/pages) ◄── Inertia ── contrôleurs : valident (VineJS), autorisent (Bouncer), appellent
                                          │
                                          ▼
                        services : règles métier, transactions, verrou du contrat, journal
                                          │
                                          ▼
                     Lucid ─► PostgreSQL : CHECK, clés étrangères, déclencheurs d'immuabilité
```

| Dossier | Contenu |
|---|---|
| `app/services` | `contract_service` (créer, réviser, soumettre), `approval_service` (décider), `template_service` (variables, rendu), `comment_service`, `document_service` (PDF, stockage), `signature_service` (demande, annulation), `signature_webhook_service` (événements du prestataire), `webhook_signature` (HMAC), `signature_provider` (port et bac à sable), `obligation_service` (durée, obligations, reconduction), `reminder_service` (paliers, parcours, envoi), `reminder_queue` (BullMQ), `invitation_service` (jeton, acceptation), `attachment_service` et `virus_scanner` (analyse ClamAV), `organization_service`, `workflow_service`, `audit`, `text_diff` |
| `app/mails`, `commands` | E-mail de rappel ; `queue:work` (processus de la file) et `reminders:scan` (parcours manuel) |
| `app/controllers` | Une page ou un formulaire par action ; aucune règle métier |
| `app/policies` | Droits par rôle (Bouncer) |
| `app/middleware/organization_middleware.ts` | Organisation courante et rôle, depuis l'appartenance |
| `database/migrations` | Schéma, contraintes et déclencheurs ; `database/schema.ts` en est régénéré |
| `cypress` | Scénarios de bout en bout (`e2e`), commandes (`support`), lanceur de l'application de test (`serve.mjs`) |
| `inertia/pages` | Tableau de bord, contrats (liste, création, détail), circuits, équipe, connexion |
| `tests` | `unit` (différence de textes, empreinte) et `functional` (services et HTTP, contre PostgreSQL) |

La vision complète est décrite dans [docs/architecture/vision.md](docs/architecture/vision.md).

## Démarrer

Prérequis : Node 24, Docker.

```bash
docker compose up -d postgres s3 redis mailpit clamav   # PostgreSQL 18 (5438), S3 local (9008), Redis (6389), Mailpit (SMTP 1035, interface 8035), ClamAV (3310, une à deux minutes au premier démarrage)
cp .env.example .env
node ace generate:key
npm install
node ace migration:run
node ace db:seed --files database/seeders/demo_seeder.ts   # facultatif : données de démonstration
npm run dev                              # http://localhost:3333
node ace queue:work                      # autre terminal : file des rappels (parcours quotidien à 07:00 UTC)
node ace reminders:scan                  # facultatif : lancer le parcours tout de suite
```

Les données de démonstration créent l'organisation « Atelier Nova » : un contrat approuvé après un rejet, un en signature, un signé avec sa durée et trois obligations (dont une en retard), deux en validation, un brouillon et deux circuits. Les e-mails de rappel se lisent dans Mailpit (http://localhost:8035). Il y a un compte par rôle, `<prénom>@atelier-nova.test`, avec le mot de passe `contractflow-demo` : olivia (propriétaire), adrien (administrateur), lea (juridique), marc (direction), remi (rédacteur), vera (lecteur).

## Tests et qualité

```bash
npm test             # Japa, contre la base contractflow_test
npm run lint
npm run typecheck
npm run build

# Bout en bout (deux terminaux ; ne pas lancer en même temps que npm test : même base)
npm run e2e:serve    # l'application en environnement test, port 3334
npm run e2e          # Cypress en ligne de commande (ou npm run e2e:open)
```

Sans `CLAMAV_TEST_HOST=127.0.0.1`, trois tests contre un vrai clamd sont ignorés ; la CI les exécute.

## Limites actuelles

- **Prestataire de signature fictif** : un bac à sable intégré joue le rôle du prestataire ; un adaptateur réel reste à écrire, ainsi qu'une réconciliation avec les demandes que le prestataire connaîtrait sans nous.
- **Pas d'e-mail aux signataires** : l'adresse de signature s'affiche sur la page du contrat. Les e-mails ne partent que pour les rappels d'échéance, aux membres de l'organisation.
- **Rappels au moins une fois** : une coupure entre l'envoi et l'écriture de l'état peut produire un doublon, jamais un oubli ; paliers fixes, jour UTC, pas de réglage par organisation.
- **Redis requis pour les rappels** : sans le processus `queue:work`, ils attendent et se rattrapent au démarrage.
- **Obligations sans pièces ni récurrence** : une obligation est une date et un responsable ; pas de série (« tous les trimestres »).
- **Signatures en parallèle** : pas d'ordre de signature, pas d'expiration d'une demande.
- **Pas de prévisualisation des pièces jointes** : téléchargement seulement.
- **Modèles non modifiables** : on en crée un nouveau ; pas de versions de modèle ni de conditions (`si`).
- **PDF sobre** : polices standard, pas de logo, pas de signature visuelle ; caractères hors Latin-1 non garantis.
- **Pas de nettoyage des fichiers orphelins** après un arrêt brutal entre l'écriture S3 et la base.
- **Invitations** : pas de limitation d'envoi, pas de vérification de l'adresse au-delà de la réception du lien, pas de sélecteur d'organisation pour qui en a plusieurs.
- **Antivirus** : un fichier accepté n'est pas rescanné quand les signatures évoluent ; le fichier entier est lu en mémoire (10 Mo au plus) ; ClamAV demande environ 1,5 Go.
- **Pas de téléversement direct vers S3** : le fichier passe par le serveur, à cause de l'analyse.
- **Une seule organisation par utilisateur** dans l'interface : rien n'empêche d'appartenir à deux organisations, mais aucun écran ne permet de choisir.
- **Circuits linéaires** : pas d'étapes parallèles ni de conditions (montant, type de contrat).
- **Pas de suppression** : un contrat, une version ou une trace ne s'effacent pas.

## Feuille de route

| Incrément | Contenu | État |
|---|---|---|
| 1 | Organisations, rôles, contrats versionnés, circuits configurables, décisions sous verrou, comparaison de versions, journal | **fait** |
| 2 | Modèles de contrats et variables, PDF générés et stockés sur S3 (URL pré-signées), commentaires | **fait** |
| 3 | Signature électronique via un prestataire (bac à sable), webhooks entrants signés, preuves archivées, contrat signé gelé | **fait** |
| 4 | Obligations, échéances et renouvellements, rappels par tâches de fond (BullMQ, Redis), e-mails | **fait** |
| 5 | Invitations, tests de bout en bout (Cypress), sécurité (CSP, antivirus sur les fichiers) | **fait** |
| 6 | Docker, Terraform, déploiement AWS | à faire |
