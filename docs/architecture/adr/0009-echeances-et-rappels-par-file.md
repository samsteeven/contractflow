# ADR-009 : échéances et rappels, tâches de fond par file Redis

**État** : acceptée.

## Contexte

Un contrat signé ne change plus ([ADR-008](0008-signature-par-webhook-signe.md)), mais sa vie continue : une durée, un préavis de non-reconduction, des paiements, des livraisons, des revues. Il faut les suivre et **prévenir la bonne personne à temps**, sans l'inonder, sans oublier, sans envoyer deux fois. Un e-mail envoyé ne se reprend pas ; un rappel perdu non plus.

## Décision

- **Le suivi vit dans d'autres tables que le contrat**, qui reste figé : `contract_terms` (début, fin, reconduction, préavis), `obligations` (titre, nature, date, responsable, état), `reminders` (un rappel par obligation et par palier). Rien ne touche à la ligne du contrat signé.
- **La durée engendre son échéance.** Définir la durée crée une obligation `renewal_notice` datée de la fin moins le préavis. Reconduire repousse la fin, clôt l'échéance en cours et en crée une nouvelle ; mettre fin à la durée l'annule. Un index unique partiel interdit deux échéances de préavis ouvertes pour une même date. Toutes ces actions passent sous le verrou du contrat ([ADR-004](0004-decisions-sous-verrou.md)) : deux reconductions simultanées s'appliquent l'une après l'autre.
- **Des jours calendaires, pas des instants.** Les dates d'échéance sont des dates, les écarts se comptent en jours UTC (`daysUntil`) : un rappel ne change pas selon l'heure de l'analyse.
- **Cinq paliers** : 30 jours, 7 jours, 1 jour, le jour même, en retard. Le parcours quotidien choisit le palier *atteint* : après une interruption de trois jours il envoie le palier à jour, pas les paliers manqués. Le texte de l'e-mail donne les jours réellement restants.
- **Un rappel = une ligne, unique par (obligation, palier)** : `INSERT … ON CONFLICT DO NOTHING`. Relancer le parcours dix fois ne crée rien de plus.
- **File Redis (BullMQ)** pour l'envoi. Le parcours est lui-même une tâche répétée chaque jour à 07:00 UTC (planificateur BullMQ). Chaque envoi est une tâche d'identifiant `reminder-<id>` : le même rappel mis deux fois dans la file ne donne qu'une tâche. Cinq tentatives, délai exponentiel à partir de 30 s.
- **Livraison au moins une fois, rendue sûre par l'état.** Au moment d'envoyer, le service relit le rappel : déjà `sent` ou `skipped` → `already_handled` ; obligation close entre-temps → `skipped`. L'état passe à `sent` après l'envoi. Un échec est noté (`attempts`, `last_error`) puis relancé par la file. Les rappels restés `queued` plus de 60 minutes (file vidée, Redis redémarré) sont remis dans la file par le parcours suivant.
- **E-mail** par `@adonisjs/mail` (SMTP ; Mailpit en local). Le HTML échappe le titre saisi par les utilisateurs.
- **Droits** : écrire (durée, obligation) pour les rôles de rédaction ; reconduire ou mettre fin pour la direction (`engage`) ; clore pour le responsable ou un administrateur ; annuler pour le créateur ou un administrateur.

## Conséquences

- **Au moins une fois, pas exactement une.** Si le processus s'arrête entre l'envoi SMTP et l'écriture de `sent`, le rappel peut partir deux fois. C'est le choix assumé : mieux vaut un doublon qu'un oubli.
- Redis devient une dépendance d'exécution (processus `node ace queue:work` à côté du serveur). Sans lui, les rappels attendent : ils se rattrapent au démarrage suivant, grâce à l'état en base et non à celui de la file.
- Les paliers sont fixes ; pas de réglage par organisation ni de destinataire en copie.
- Pas de fuseau horaire par utilisateur : le jour est UTC.
- Rien n'est envoyé à une adresse extérieure : seuls les membres de l'organisation sont destinataires. Aucun fournisseur d'e-mail réel n'a été branché ; la configuration SMTP est vérifiée contre Mailpit.
