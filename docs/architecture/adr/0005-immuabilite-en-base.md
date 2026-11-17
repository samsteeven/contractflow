# ADR-005 : versions et journal immuables, garantis par la base

**État** : acceptée.

## Contexte

Une approbation porte sur un texte précis ; le journal doit dire qui a fait quoi. Si une version ou une trace peut être réécrite, ni l'une ni l'autre ne prouve rien. Une règle tenue seulement par le code applicatif cède au premier script de maintenance ou à la première erreur.

## Décision

- Un déclencheur PostgreSQL (`forbid_change`) refuse `UPDATE` et `DELETE` sur `contract_versions` et sur `audit_logs`.
- Chaque version porte l'empreinte SHA-256 de son texte (fins de ligne et espaces finaux normalisés) : on sait quel texte exact a été validé, et un texte identique ne crée pas de nouvelle version.
- Chaque trace est écrite dans la transaction de l'action qu'elle décrit : pas d'action sans trace, pas de trace d'une action annulée.
- Les listes fermées (rôles, types, états) sont aussi des contraintes `CHECK` : une valeur inconnue est refusée même hors de l'application.

## Conséquences

- La suppression d'un contrat entier (cascade) reste bloquée par le déclencheur ; un vrai besoin d'effacement (RGPD, purge) demandera une procédure explicite, à concevoir.
- Les tests vident les tables par `TRUNCATE`, que le déclencheur n'empêche pas.
