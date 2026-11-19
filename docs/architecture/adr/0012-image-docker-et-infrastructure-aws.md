# ADR-012 : image Docker de production et infrastructure AWS

**État** : acceptée pour l'image (construite et exécutée) ; **proposée pour l'infrastructure** (validée, jamais appliquée).

## Contexte

Jusqu'ici l'application ne tournait qu'en développement. La production ajoute des contraintes que le développement masque : un processus sans droits, des secrets qui ne sont pas dans un fichier, une base et un cache qui exigent le chiffrement, un répartiteur de charge devant l'application, un antivirus et un worker à faire vivre à côté du serveur.

## Décision

**Image**
- **Quatre étapes** (dépendances, compilation, dépendances d'exécution, image finale) : l'image finale ne contient ni les sources TypeScript, ni les dépendances de développement. Utilisateur `node`, jamais root. Une sonde de santé dans l'image.
- **Une seule image pour trois rôles** : web (`node bin/server.js`), worker (`node ace queue:work`), migration (`node ace migration:run --force`). Ce qui change est la commande.
- **`/health` vérifie la base** (`select 1`), sans session et sans rien révéler. Une tâche qui ne peut pas joindre la base sort de la rotation au lieu de renvoyer des erreurs.
- **Les migrations sont une tâche à part**, lancée avant le remplacement des services : si elles échouent, la version précédente continue de servir. Elles ne s'exécutent pas au démarrage du web (deux tâches qui migrent en même temps, ou une migration qui retarde la sonde).
- **Connexions chiffrées et vérifiées** : PostgreSQL avec le certificat de l'autorité RDS embarqué dans l'image, Redis en TLS avec jeton, SMTP en STARTTLS exigé quand il y a des identifiants. La régénération du schéma TypeScript est coupée en production.
- **Derrière l'ALB, on ne croit les en-têtes `X-Forwarded-*` que du saut direct**, et seulement si `TRUST_PROXY` est activé : sinon l'adresse d'un client serait forgeable.
- **Aucune clé AWS dans l'application** : en production les droits S3 viennent du rôle de la tâche. Le code ne passe des identifiants que s'il en existe (des identifiants vides cassaient la chaîne par défaut du SDK).

**Infrastructure**
- **Fargate** plutôt qu'EC2 ou Kubernetes : rien à patcher, rien à dimensionner côté machines. Deux services : web (2 tâches, avec ClamAV à côté) et worker (1 tâche, arrêtée avant d'être remplacée pour qu'il n'y en ait jamais deux).
- **ClamAV en conteneur auxiliaire** de la tâche web : joint sur `127.0.0.1`, jamais exposé, et l'application ne démarre qu'une fois l'antivirus prêt.
- **Réseau privé** : base, cache et tâches sans adresse publique ; seul l'ALB est exposé. Chaque groupe de sécurité ne laisse passer que le flux nommé, y compris en sortie (443, 587, base et cache).
- **Secrets générés par Terraform et lus par ECS au démarrage** (Secrets Manager) ; le mot de passe de la base est géré par RDS lui-même et n'apparaît pas dans l'état.
- **Droits au plus juste** : le rôle de la tâche n'accède qu'aux objets de son bucket ; le rôle de déploiement GitHub (OIDC, une branche d'un dépôt) ne peut qu'enregistrer des tâches, lancer la migration et mettre à jour deux services, pas toucher au réseau, à la base ni à IAM.
- **Terraform et déploiement séparés** : Terraform crée l'infrastructure ; le déploiement continu change l'image. Terraform ignore la révision de tâche en cours.
- **L'infrastructure est analysée** (Trivy) et validée à chaque envoi ; les exceptions sont écrites dans le code, avec leur raison.

## Conséquences

- **L'infrastructure n'a jamais tourné.** `validate` garantit la cohérence interne, pas qu'AWS acceptera chaque paramètre (versions de moteur disponibles, quotas, droits IAM suffisants), ni que ClamAV démarrera dans la mémoire prévue. Le premier `apply` révélera des corrections ; c'est dit ici pour qu'on ne lise pas « validé » comme « éprouvé ».
- **Le coût est réel** et fixe (NAT, RDS Multi-AZ, ElastiCache, Fargate), même sans utilisateur.
- **Une seule NAT** : une panne de sa zone coupe la sortie des tâches (envoi d'e-mails, signatures de l'antivirus) pour tout le monde.
- **Docker Hub pour ClamAV** : exposé à la limite de téléchargements anonymes tant que l'image n'est pas recopiée dans ECR.
- **Secrets dans l'état Terraform** : il faut le protéger comme eux.
- **Choix assumés, signalés par l'analyse** : clés S3 gérées par AWS plutôt que clé propre (KMS), authentification de la base par mot de passe plutôt que par IAM, journaux CloudWatch non chiffrés par clé propre.
- **Absent** : pare-feu applicatif (WAF), alarmes et tableau de bord, sauvegarde inter-régions, environnement de préproduction, domaine multiple, limitation du débit. Un fournisseur de signature réel reste à brancher (`SIGNATURE_PROVIDER` ne connaît que le bac à sable) : déployé tel quel, le bac à sable signerait pour de faux.
- Le déclencheur du déploiement est manuel : aucune mise en production automatique tant que l'infrastructure n'existe pas.
