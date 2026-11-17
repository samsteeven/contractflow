# ADR-001 : AdonisJS en monolithe modulaire, à partir du kit officiel

**État** : acceptée.

## Contexte

Le portfolio montre déjà NestJS (StockPilot), .NET (DevPulse) et Python (EvalForge). ContractFlow doit apprendre AdonisJS là où ses briques intégrées servent vraiment : Lucid et ses transactions, l'authentification par session, VineJS, Bouncer, Japa.

## Décision

- Application AdonisJS 7 créée avec le kit officiel React (`npm create adonisjs@latest -- --kit=react`), sans configuration manuelle de React ni d'Inertia.
- Un seul déployable. Le code est rangé par rôle technique, comme le veut AdonisJS (`app/models`, `app/services`, `app/controllers`, `app/policies`, `app/validators`) ; la logique métier vit dans les services, les contrôleurs ne font que valider, autoriser et appeler.
- PostgreSQL à la place de la base SQLite du kit : les verrous de ligne, les contraintes `CHECK` et les déclencheurs font partie du modèle (ADR-004, ADR-005).
- Les colonnes des modèles ne sont jamais déclarées à la main : `database/schema.ts` est régénéré par Lucid à chaque migration, et chaque modèle l'étend.

## Conséquences

- Les tests (Japa) tournent contre un vrai PostgreSQL, dans une base séparée (`contractflow_test`).
- Pas de dossier `domains/` comme dans le blueprint : on garde les conventions du framework, que les outils (`node ace make:*`, génération des index) supposent.
