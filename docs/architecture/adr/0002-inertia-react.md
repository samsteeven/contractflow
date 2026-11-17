# ADR-002 : Inertia et React plutôt qu'une API REST et un front séparé

**État** : acceptée. Remplace le choix initial de Vue 3.

## Contexte

Le blueprint prévoyait Vue 3, que DevPulse montre déjà. ContractFlow sert surtout des écrans liés à une session : listes, formulaires, détail d'un contrat. Une API REST ne servirait qu'à alimenter ces écrans.

## Décision

- React 19 et TypeScript, reliés à AdonisJS par Inertia : un contrôleur rend une page et lui passe ses données (`inertia.render('contracts/show', {...})`).
- Le routage reste côté serveur : pas de React Router, pas d'API dédiée aux pages.
- Les formulaires sont envoyés par le composant `Form` d'Inertia ; les erreurs de validation VineJS reviennent champ par champ.
- Les données passées aux pages sont typées de bout en bout : les transformers (`app/transformers`) génèrent les types `Data.*` utilisés par les pages, et les routes nommées sont vérifiées à la compilation.
- Sessions par cookie, protection CSRF d'AdonisJS Shield active.

## Conséquences

- Le contrôle d'accès est toujours fait côté serveur : une page reçoit déjà ce que l'utilisateur peut faire (`can.revise`, `can.decideApprovalId`), elle ne le devine pas.
- Une règle métier refusée renvoie l'utilisateur sur sa page avec un message ; un client qui demande du JSON reçoit le statut HTTP et la raison (`RuleViolation`).
- Une API publique (intégrations, webhooks) reste possible plus tard, à côté des pages.
