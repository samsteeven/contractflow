# ADR-010 : invitations par jeton à usage unique

**État** : acceptée.

## Contexte

Jusqu'ici un administrateur ne pouvait ajouter qu'un compte déjà inscrit. Inviter quelqu'un par e-mail ouvre une porte publique : un lien qui crée un compte et donne un rôle dans une organisation. Ce lien circule par e-mail, peut être transféré, rejoué, ouvert depuis un autre compte, ou arriver après son expiration.

## Décision

- **Un jeton de 32 octets aléatoires, jamais stocké.** Seule son empreinte SHA-256 l'est (`token_hash`, unique). Une fuite de la base ne donne aucun lien utilisable. Le jeton ne passe que dans l'e-mail.
- **Une invitation ouverte par adresse et par organisation**, imposée par un index unique partiel. Réinviter la même adresse fait un `INSERT … ON CONFLICT DO UPDATE` : nouveau jeton, nouveau délai, l'ancien lien cesse de marcher. Trois invitations simultanées donnent une seule ligne.
- **Sept jours de validité, usage unique.** L'acceptation relit l'invitation sous `SELECT … FOR UPDATE`, vérifie qu'elle est ouverte (ni expirée, ni utilisée, ni retirée), puis crée le compte et l'appartenance dans la même transaction.
- **L'adresse vient de l'invitation, jamais du formulaire.** Le formulaire ne demande que le nom et le mot de passe ; recevoir le lien prouve la possession de l'adresse. Les adresses sont normalisées en minuscules (contrainte `CHECK` en base).
- **Trois cas à l'acceptation** : pas de compte, il est créé ; compte existant et personne non connectée, refus (« connectez-vous puis rouvrez le lien ») : on n'écrase jamais un mot de passe ; personne connectée avec une autre adresse, refus. Un lien d'une autre organisation que la sienne reste utilisable par un compte existant : l'organisation devient la courante de la session.
- **Mêmes règles de rôle que l'ajout direct** (`assertGrantable`) : seul un propriétaire invite un administrateur ou un propriétaire.
- **L'e-mail part après l'enregistrement.** S'il échoue, l'invitation existe, l'administrateur le voit (502) et la renvoie. Un jeton inconnu répond 404, sans rien dire de plus.
- **Un lien d'e-mail ne fuit pas vers d'autres sites** : en-tête `Referrer-Policy: same-origin` ([ADR-011](0011-pieces-jointes-antivirus-et-csp.md)).

## Conséquences

- Pas de limitation du nombre d'essais sur la page du lien : un jeton de 256 bits ne se devine pas, mais un envoi en masse d'invitations par un administrateur n'est pas freiné.
- Pas de vérification de l'adresse au-delà de la réception du lien ; un lien transféré à quelqu'un d'autre donne accès à son porteur.
- Le verrou de l'acceptation est doublé en base par l'unicité de l'adresse et de l'appartenance : la casse du verrou seul n'est pas détectée par les tests, une double acceptation simultanée échouerait quand même sur une contrainte, avec une erreur moins claire.
- Un utilisateur dans plusieurs organisations n'a pas de sélecteur : l'organisation de la dernière invitation acceptée est retenue pour la session, sinon la première.
