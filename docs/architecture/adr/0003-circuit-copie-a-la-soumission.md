# ADR-003 : un circuit est une donnée, copiée dans le contrat à chaque soumission

**État** : acceptée.

## Contexte

Le moteur de validation doit être configurable : chaque organisation définit ses circuits (« juridique puis direction », « engagement important » avec le propriétaire en dernier…). Mais un circuit peut changer pendant qu'un contrat est en cours de validation.

## Décision

- Un circuit (`workflows`) est une suite ordonnée d'étapes (`workflow_steps`), chacune confiée à un rôle approbateur.
- À la soumission, ses étapes sont **copiées** dans `approvals`, avec leur nom, leur rôle et la version du contrat soumise. Chaque soumission ouvre un **tour** numéroté.
- L'étape active d'un tour est sa première étape encore en attente. Un rejet clôt le tour : les étapes suivantes passent « annulées » et le contrat revient au rédacteur.
- Réviser un contrat approuvé ou rejeté le remet en brouillon : une approbation vaut pour une version, pas pour les suivantes.

## Conséquences

- Modifier un circuit n'a aucun effet sur les validations en cours (vérifié par un test).
- L'historique garde tous les tours, avec qui a décidé quoi, sur quelle version.
- Pas encore d'étapes parallèles ni de conditions (montant, type de contrat) : un circuit est une suite simple.
