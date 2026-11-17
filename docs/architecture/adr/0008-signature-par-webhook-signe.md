# ADR-008 : signature électronique par prestataire, événements par webhook signé

**État** : acceptée.

## Contexte

Un contrat approuvé doit être signé par des personnes extérieures. L'application n'a pas à fabriquer une signature : elle délègue à un prestataire et doit être sûre de ce qu'il lui dit. Un webhook est une porte ouverte sur Internet, sans session : n'importe qui peut y envoyer « le contrat est signé ». Les prestataires rejouent aussi leurs livraisons, parfois en double et en même temps.

## Décision

- **Un port, un adaptateur.** `SignatureProvider` (créer une demande, l'annuler, donner l'adresse de signature) isole le prestataire. L'adaptateur fourni est un **bac à sable intégré** : il émet de vrais événements signés avec le secret partagé et sert une page de signature. Un prestataire réel (Yousign, Docusign) s'ajoute avec un autre adaptateur ; **aucun n'est branché ni vérifié ici**.
- **Les événements arrivent par webhook, jamais par un retour d'appel.** `POST /webhooks/signature`, hors session et hors CSRF, authentifié uniquement par `X-ContractFlow-Signature: t=<secondes>,v1=<HMAC-SHA256 de "t.corps">` calculé sur le **corps brut**. La signature est vérifiée (comparaison à temps constant) et l'horodatage doit tenir dans une fenêtre de cinq minutes **avant** de lire le moindre champ du corps.
- **Tout se passe sous le verrou du contrat** ([ADR-004](0004-decisions-sous-verrou.md)) : l'identifiant d'événement déjà vu renvoie `duplicate` ; un événement qui ne correspond plus à l'état (demande annulée, refusée, signataire déjà décidé) est archivé avec le résultat `ignored` et n'a aucun effet.
- **Cycle du contrat** : `approved` → `signing` (modification impossible, une seule demande ouverte, imposé par un index unique partiel) → `signed` (tous ont signé) ou retour à `approved` (refus, annulation).
- **Un contrat signé est figé par la base** : un déclencheur refuse tout `UPDATE` ou `DELETE` d'une ligne `contracts` dont l'état est `signed`. Les événements et la preuve sont en ajout seul ([ADR-005](0005-immuabilite-en-base.md)).
- **Preuve archivée** à la fin : JSON (version, empreinte du texte, signataires, horodatages, identifiants d'événements) stocké comme le PDF ([ADR-007](0007-modeles-pdf-et-stockage-s3.md)), avec son empreinte, téléchargé par URL pré-signée.

## Conséquences

- L'appel au prestataire se fait **dans** la transaction de la demande : s'il échoue, rien n'est enregistré. Si la validation de la transaction échoue après un appel réussi, une demande orpheline subsiste chez le prestataire ; une réconciliation périodique reste à écrire.
- Dans le bac à sable, la page de signature remet l'événement au même service que le webhook public, en mémoire. Le point d'entrée HTTP est vérifié par ses propres tests (signature, rejeu, fenêtre de temps, corps invalide, demande inconnue), mais aucun prestataire extérieur n'a encore envoyé un événement réel.
- Le secret du webhook se change sans migration ; une rotation avec deux secrets valides en même temps n'est pas gérée.
- La preuve atteste de ce que l'application a reçu, pas d'une signature qualifiée : la valeur juridique dépend du prestataire choisi.
