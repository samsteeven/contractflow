# ContractFlow : créer, faire valider et suivre ses contrats

Plateforme SaaS de gestion des contrats en **AdonisJS 7**, **Inertia** et **React 19**, sur PostgreSQL. Une organisation y rédige ses contrats et définit ses circuits de validation (juridique, puis direction, puis propriétaire…). Elle fait ensuite valider chaque contrat étape par étape, sur un texte qui ne change plus, avec un journal de tout ce qui s'est passé.

> **État : incrément 2.** Organisations, rôles, contrats versionnés, circuits configurables, décisions, comparaison de versions, journal, **modèles à variables, commentaires et PDF archivés sur S3**. Pas encore de signature électronique ni d'échéances : voir [la feuille de route](#feuille-de-route).

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
| Les organisations ne se voient pas | L'organisation vient de l'appartenance, jamais de la requête ; une ressource d'une autre organisation répond 404 ([ADR-006](docs/architecture/adr/0006-organisation-par-appartenance.md)) |

## Ce qui est vérifié, et ce qui ne l'est pas

| Élément | Vérifié | Pas vérifié |
|---|---|---|
| Règles métier | 59 tests Japa contre un vrai PostgreSQL : versions, circuit, tours, rejeu, rôles, auto-validation, isolation, droits par rôle, parcours HTTP complet, rendu des données des pages ; modèles et variables, commentaires, PDF et téléchargement signé, isolation entre organisations | |
| Les tests protègent vraiment | 15 garde-fous cassés volontairement un par un (verrou, étape active, rôle, rejeu, motif, auteur, révision en validation, réouverture, filtres d'organisation, droits du lecteur, nomination d'un propriétaire, deux déclencheurs) : chaque casse fait échouer un test | |
| Mêmes tests sur S3 | Les 26 tests de modèles, commentaires et PDF passent aussi sur un S3 local (S3Mock), pas seulement sur le disque | Un vrai bucket AWS ; le refus d'une URL sans signature (S3Mock ne contrôle pas les signatures) |
| Les tests de l'incrément 2 protègent vraiment | 8 garde-fous cassés un par un (variable manquante, contrat non approuvé, un PDF par version, organisation du modèle, écriture du fichier, variable mal écrite, droit de générer, organisation du PDF) : chaque casse fait échouer un test | |
| Concurrence | Quatre décisions simultanées, cinq exécutions avec et sans verrou : sans verrou le test échoue 5 fois sur 5 | Sous forte charge |
| Interface | Toutes les pages parcourues dans un navigateur sur les données de démonstration, sans erreur dans la console : tableau de bord, liste filtrée, création, détail avec comparaison, décision (refus d'un rejet non motivé, validation commentée), circuits, équipe | **Pas de tests de bout en bout automatisés** (prévus avec Cypress) |
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
| `app/services` | `contract_service` (créer, réviser, soumettre), `approval_service` (décider), `template_service` (variables, rendu), `comment_service`, `document_service` (PDF, stockage), `organization_service`, `workflow_service`, `audit`, `text_diff` |
| `app/controllers` | Une page ou un formulaire par action ; aucune règle métier |
| `app/policies` | Droits par rôle (Bouncer) |
| `app/middleware/organization_middleware.ts` | Organisation courante et rôle, depuis l'appartenance |
| `database/migrations` | Schéma, contraintes et déclencheurs ; `database/schema.ts` en est régénéré |
| `inertia/pages` | Tableau de bord, contrats (liste, création, détail), circuits, équipe, connexion |
| `tests` | `unit` (différence de textes, empreinte) et `functional` (services et HTTP, contre PostgreSQL) |

La vision complète est décrite dans [docs/architecture/vision.md](docs/architecture/vision.md).

## Démarrer

Prérequis : Node 24, Docker.

```bash
docker compose up -d postgres s3         # PostgreSQL 18 (5438, bases contractflow et contractflow_test) et un S3 local (9008)
cp .env.example .env
node ace generate:key
npm install
node ace migration:run
node ace db:seed --files database/seeders/demo_seeder.ts   # facultatif : données de démonstration
npm run dev                              # http://localhost:3333
```

Les données de démonstration créent l'organisation « Atelier Nova » : un contrat approuvé après un rejet, deux en validation, un brouillon et deux circuits. Il y a un compte par rôle, `<prénom>@atelier-nova.test`, avec le mot de passe `contractflow-demo` : olivia (propriétaire), adrien (administrateur), lea (juridique), marc (direction), remi (rédacteur), vera (lecteur).

## Tests et qualité

```bash
npm test             # Japa, contre la base contractflow_test
npm run lint
npm run typecheck
npm run build
```

## Limites actuelles

- **Pas de pièces jointes** : le texte est saisi en clair ou rempli depuis un modèle.
- **Modèles non modifiables** : on en crée un nouveau ; pas de versions de modèle ni de conditions (`si`).
- **PDF sobre** : polices standard, pas de logo, pas de signature visuelle ; caractères hors Latin-1 non garantis.
- **Pas de nettoyage des fichiers orphelins** après un arrêt brutal entre l'écriture S3 et la base.
- **Pas de signature électronique** : un contrat approuvé n'est pas signé.
- **Pas d'invitation par e-mail** : un administrateur ajoute un compte qui existe déjà.
- **Une seule organisation par utilisateur** dans l'interface : rien n'empêche d'appartenir à deux organisations, mais aucun écran ne permet de choisir.
- **Circuits linéaires** : pas d'étapes parallèles ni de conditions (montant, type de contrat).
- **Pas de suppression** : un contrat, une version ou une trace ne s'effacent pas.

## Feuille de route

| Incrément | Contenu | État |
|---|---|---|
| 1 | Organisations, rôles, contrats versionnés, circuits configurables, décisions sous verrou, comparaison de versions, journal | **fait** |
| 2 | Modèles de contrats et variables, PDF générés et stockés sur S3 (URL pré-signées), commentaires | **fait** |
| 3 | Signature électronique via un prestataire (bac à sable), webhooks entrants signés, preuves archivées, contrat signé gelé | à faire |
| 4 | Obligations, échéances et renouvellements, rappels par tâches de fond, e-mails | à faire |
| 5 | Invitations, tests de bout en bout (Cypress), sécurité (CSP, antivirus sur les fichiers) | à faire |
| 6 | Docker, Terraform, déploiement AWS | à faire |
