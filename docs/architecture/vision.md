# Vision et architecture cible

Ce document résume le blueprint du projet : ce que ContractFlow doit devenir, et dans quel ordre. Ce qui existe déjà est indiqué dans le [README](../../README.md).

## Le produit

Une plateforme SaaS où une entreprise crée, fait valider, signe et suit ses contrats depuis un espace centralisé : contrats de prestation, fournisseurs, sous-traitance, accords de confidentialité, partenariats.

L'intérêt technique est le **cycle de vie du contrat** : plusieurs intervenants, des validations successives, des versions, des échéances, des signatures et une traçabilité complète.

## Les cinq domaines fonctionnels

| Domaine | Contenu |
|---|---|
| Contrats | Création depuis des modèles, variables, documents PDF, catégories, métadonnées |
| Moteur de validation | Circuit configurable : rédacteur, juridique, manager, approbateur final |
| Versions | Historique, comparaison, commentaires, conflits de révision |
| Signature électronique | Demande de signature, suivi des signataires, webhooks, archivage des preuves par un prestataire spécialisé |
| Suivi | Alertes d'expiration, renouvellements à anticiper, obligations contractuelles, calendrier |

Une signature juridiquement opposable passe par un prestataire spécialisé, dont on conserve les preuves : une case à cocher n'est pas une signature électronique.

## Règles métier

- Un contrat signé ne se modifie plus directement.
- Chaque modification crée une nouvelle version.
- Un approbateur n'agit que lorsque son étape est active.
- Une validation déjà prise ne se rejoue pas.
- Une notification peut être retentée sans être envoyée deux fois.
- Les actions sensibles sont auditables.

## Pile technique

| Couche | Choix |
|---|---|
| Backend | AdonisJS 7, TypeScript |
| Front | **Inertia.js + React 19** (pas d'API REST séparée pour les pages), Vite |
| Interface | CSS du kit officiel AdonisJS, Lucide ; Tailwind et shadcn/ui envisagés |
| ORM et base | Lucid, PostgreSQL |
| Validation | VineJS |
| Authentification et droits | AdonisJS Auth (sessions), Bouncer (policies) |
| Tâches de fond | AdonisJS Queue (encore expérimental : version figée et fiabilité à vérifier) ou BullMQ |
| Cache | Redis |
| Documents | S3, URL pré-signées |
| E-mails | Resend ou AWS SES |
| Tests | Japa |
| Infrastructure | Docker, AWS, Terraform |

Le front était prévu en Vue 3 ; il a été remplacé par React avec Inertia avant toute ligne de code ([ADR-002](adr/0002-inertia-react.md)).

## Modèle de données

`Organization`, `User`, `Membership` ; `Contract`, `ContractVersion`, `ContractTemplate` ; `Workflow`, `WorkflowStep`, `Approval` ; `SignatureRequest`, `SignatureEvidence` ; `Document` ; `Obligation`, `Reminder` ; `AuditLog` ; `OutboxEvent`.

## Les défis qui font la différence

1. **Moteur de validation** configurable plutôt qu'un circuit codé en dur.
2. **Versions** : auteurs, dates, différences, rien ne s'écrase.
3. **Permissions** selon l'organisation, le contrat et l'étape du circuit.
4. **Fiabilité des événements** : outbox, idempotence, reprises, webhooks signés.
5. **Documents** : URL pré-signées S3, contrôle d'accès, antivirus, audit des téléchargements.

## Place dans le portfolio

| Projet | Ce qu'il démontre |
|---|---|
| DevPulse (.NET) | Architecture distribuée, observabilité, cloud |
| EvalForge (Python) | IA, évaluation, automatisation |
| StockPilot (NestJS) | Transactions, concurrence, backend métier |
| ContractFlow (AdonisJS) | Moteur de validation, versions, sécurité, SaaS full-stack |

Ce qui n'est pas refait en profondeur ici, parce que les autres projets le montrent déjà : l'outbox et les webhooks (DevPulse, EvalForge), l'observabilité OpenTelemetry (DevPulse, EvalForge), la concurrence sur un stock (StockPilot).

## Feuille de route (10 à 12 semaines, MVP vers la semaine 6)

| Incrément | Contenu |
|---|---|
| 1 | Organisations, rôles, contrats versionnés, circuits de validation configurables, décisions sous verrou, comparaison de versions, journal |
| 2 | Modèles de contrats et variables, documents PDF générés et stockés (S3, URL pré-signées), commentaires |
| 3 | Signature électronique via un prestataire (bac à sable), webhooks entrants signés, preuves archivées, contrat signé gelé |
| 4 | Obligations, échéances et renouvellements ; rappels par tâches de fond ; e-mails |
| 5 | Invitations par e-mail, tests de bout en bout, sécurité (CSP, antivirus sur les fichiers) |
| 6 | Docker, Terraform, déploiement AWS |
