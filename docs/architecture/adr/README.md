# Décisions d'architecture

| ADR | Décision |
|---|---|
| [001](0001-adonisjs-monolithe.md) | AdonisJS en monolithe modulaire, à partir du kit officiel |
| [002](0002-inertia-react.md) | Inertia et React plutôt qu'une API REST et un front séparé |
| [003](0003-circuit-copie-a-la-soumission.md) | Un circuit est une donnée, copiée dans le contrat à chaque soumission |
| [004](0004-decisions-sous-verrou.md) | Toute action qui change un contrat passe par le verrou de sa ligne |
| [005](0005-immuabilite-en-base.md) | Versions et journal immuables, garantis par la base |
| [006](0006-organisation-par-appartenance.md) | L'organisation courante vient de l'appartenance, jamais de la requête |
| [007](0007-modeles-pdf-et-stockage-s3.md) | Modèles remplis une fois, PDF archivé par version, stockage S3 par URL pré-signée |
| [008](0008-signature-par-webhook-signe.md) | Signature par prestataire, événements par webhook signé, contrat signé figé par la base |
