# ADR-006 : l'organisation courante vient de l'appartenance, jamais de la requête

**État** : acceptée.

## Contexte

Toutes les données appartiennent à une organisation. Si l'organisation venait de l'URL ou d'un champ de formulaire, il suffirait de la changer pour lire les contrats d'une autre entreprise.

## Décision

- Un middleware (`organization`) établit l'organisation courante et le rôle de l'utilisateur à partir de son appartenance (`memberships`), relue à chaque requête.
- Chaque requête métier filtre sur `ctx.organization.id`, y compris dans le verrou du contrat. Une ressource d'une autre organisation répond 404, comme si elle n'existait pas.
- Le rôle décide de ce qu'on peut faire : rédiger (propriétaire, administrateur, juridique, direction, rédacteur), administrer les membres et les circuits (propriétaire, administrateur), lire seulement (lecteur). Seul un propriétaire accorde les rôles administrateur et propriétaire.
- Bouncer porte les droits liés au rôle ; les règles qui dépendent de l'état du circuit (étape active, auteur de la version) sont vérifiées dans le service, sous verrou.

## Conséquences

- Un membre retiré perd l'accès dès la requête suivante.
- Un utilisateur n'appartient pour l'instant qu'à une organisation utilisable : le choix d'organisation (déjà prévu dans la session) n'a pas encore d'écran.
- Pas encore d'invitation par e-mail : un administrateur ajoute un compte existant.
