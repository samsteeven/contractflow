# ADR-007 : modèles remplis une fois, PDF archivé par version, stockage S3 par URL pré-signée

**État** : acceptée.

## Contexte

Les organisations rédigent souvent le même contrat avec d'autres noms et d'autres montants. Un contrat approuvé doit aussi pouvoir sortir en PDF, avec la preuve de ce qui a été validé. Ces fichiers n'ont pas leur place dans la base, et ne doivent jamais être publics.

## Décision

- **Modèles** : un texte avec des variables `{{nom}}` (minuscules, chiffres, tirets bas). Créer un contrat depuis un modèle remplit le texte **une fois** ; le contrat ne suit pas les modifications ultérieures du modèle. Le rendu se fait en une seule passe (une valeur qui ressemble à `{{x}}` n'est pas réinterprétée) et refuse toute variable sans valeur. Une accolade mal écrite (`{{ Nom }}`) est refusée à la création du modèle plutôt que d'atteindre un contrat.
- **PDF** : produit seulement pour un contrat **approuvé**, pour sa dernière version, avec le dossier de validation (étapes, auteurs, dates, commentaires) et l'empreinte SHA-256 du texte. Un seul PDF par version (contrainte d'unicité) ; l'appel est idempotent et se fait sous le verrou du contrat ([ADR-004](0004-decisions-sous-verrou.md)). Les lignes `contract_documents` sont immuables ([ADR-005](0005-immuabilite-en-base.md)), comme les commentaires.
- **Stockage** : AdonisJS Drive. Le fichier est écrit **avant** la ligne en base ; si l'insertion échoue, il est supprimé. Le disque `s3` vise AWS (ou un S3 local via `S3_ENDPOINT`), le disque `fs` sert aux tests et au développement sans conteneur.
- **Téléchargement** : l'application contrôle l'accès (organisation, appartenance) puis redirige vers une URL pré-signée de cinq minutes. Aucun fichier public.

## Conséquences

- Réviser un contrat approuvé le remet en brouillon : l'ancien PDF reste archivé, un nouveau ne sera produit qu'après une nouvelle approbation.
- Le même fichier de tests passe sur les deux disques. La vérification qu'une URL **sans** signature est refusée n'est faite que sur `fs` : S3Mock, utilisé en local, ne contrôle pas les signatures, AWS le fait.
- Si l'écriture du fichier réussit et que la transaction échoue après l'insertion (arrêt brutal), un fichier orphelin peut subsister. Il est sans conséquence (clé unique par version) mais un nettoyage périodique reste à prévoir.
- La mise en page est volontairement sobre (polices PDF standard, pas de logo ni de signature visuelle) ; la signature électronique est l'objet de l'incrément 3.
