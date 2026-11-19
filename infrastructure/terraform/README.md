# Infrastructure AWS (Terraform)

Cette configuration décrit l'hébergement de ContractFlow sur AWS. **Elle n'a jamais été appliquée** : elle est vérifiée par `terraform fmt`, `terraform validate` et une analyse de configuration (Trivy), pas par un vrai déploiement. Voir [l'ADR-012](../../docs/architecture/adr/0012-image-docker-et-infrastructure-aws.md) pour les choix et leurs limites.

```
Internet ─► Route 53 ─► ALB (HTTPS, TLS 1.3/1.2, certificat ACM)
                          │ sous-réseaux publics (2 zones)
 ───────────────────────  ▼  ───────────────────────────────────────────────
                    ECS Fargate : web ×2        ECS Fargate : worker ×1
                    ├ app (Node)                └ node ace queue:work
                    └ clamav (sidecar, 127.0.0.1:3310)
                          │ sous-réseaux privés (2 zones)
              ┌───────────┼──────────────┬───────────────┐
              ▼           ▼              ▼               ▼
        RDS PostgreSQL  ElastiCache   S3 (documents)   SES (SMTP 587)
        chiffré, Multi-AZ  Redis TLS+jeton  privé, versionné   via la NAT
```

## Ce que crée Terraform

| Fichier | Ressources |
|---|---|
| `network.tf` | VPC, 2 sous-réseaux publics et 2 privés, une NAT, point d'accès S3, groupes de sécurité (un par rôle, flux nommés), journaux de flux |
| `data.tf` | RDS PostgreSQL (chiffré, sauvegardes 14 jours, protégé contre la suppression, mot de passe géré par RDS), ElastiCache Redis (TLS, jeton, `noeviction`), bucket S3 (privé, versionné, chiffré, HTTPS seul), dépôt ECR (étiquettes immuables, analyse à l'envoi) |
| `secrets.tf` | `APP_KEY`, secret du webhook, jeton Redis, identifiants SMTP : générés et rangés dans Secrets Manager |
| `mail.tf` | Identité SES du domaine (vérification et DKIM dans Route 53), utilisateur IAM d'envoi limité à `ses:SendRawEmail` |
| `iam.tf` | Rôle d'exécution (images, journaux, lecture des secrets) et rôle de tâche (objets de **son** bucket, rien d'autre) |
| `ecs.tf` | Cluster, tâches web (app + ClamAV), worker et migration, services (disjoncteur avec retour arrière) |
| `edge.tf` | Certificat ACM validé par DNS, ALB, redirection HTTP→HTTPS, enregistrement DNS |
| `deploy_role.tf` | Rôle GitHub Actions par OIDC, limité à une branche d'un dépôt (facultatif) |

## Avant le premier déploiement

1. **Un compte AWS** et des droits d'administration pour la première application. Une zone Route 53 pour le domaine.
2. **Le bucket d'état**, créé à la main (versionné, chiffré, accès public bloqué, accès restreint) : l'état contient les secrets générés. Copier `backend.hcl.example` en `backend.hcl`.
3. **L'image ClamAV**, de préférence recopiée dans ECR : Docker Hub limite les téléchargements anonymes, et une tâche qui ne peut pas démarrer parce que la limite est atteinte est un incident sans cause visible. Renseigner `clamav_image`.
4. **Une première image dans ECR.** Le dépôt est créé par Terraform : créer d'abord uniquement lui (`terraform apply -target=aws_ecr_repository.app`), pousser une image, puis tout appliquer avec `image_tag`.

```bash
cp backend.hcl.example backend.hcl                # à compléter
cp terraform.tfvars.example terraform.tfvars      # à compléter
terraform init -backend-config=backend.hcl
terraform plan -out=prod.tfplan                   # lire le plan avant d'appliquer
```

### Pas à pas (commandes, à lancer par toi, avec tes identifiants AWS)

```bash
# 0. Identité et région : vérifier que c'est bien le bon compte avant tout
aws sts get-caller-identity

# 1. Bucket d'état (nom unique au monde)
aws s3api create-bucket --bucket NOM-DU-BUCKET --region eu-west-3 \
  --create-bucket-configuration LocationConstraint=eu-west-3
aws s3api put-public-access-block --bucket NOM-DU-BUCKET --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-versioning --bucket NOM-DU-BUCKET --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket NOM-DU-BUCKET --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# 2. Le dépôt d'images seul, puis une première image (l'étiquette « initial » est celle par défaut)
terraform init -backend-config=backend.hcl
terraform apply -target=aws_ecr_repository.app
aws ecr get-login-password --region eu-west-3 | docker login --username AWS --password-stdin COMPTE.dkr.ecr.eu-west-3.amazonaws.com
docker build -t COMPTE.dkr.ecr.eu-west-3.amazonaws.com/contractflow-prod:initial ../..
docker push COMPTE.dkr.ecr.eu-west-3.amazonaws.com/contractflow-prod:initial

# 3. Tout le reste : lire le plan avant d'appliquer
terraform plan -out=prod.tfplan
terraform apply prod.tfplan
```

Le certificat attend la validation DNS, puis ClamAV met une à deux minutes à charger : les premières tâches web peuvent sembler en échec avant de passer. Après l'`apply`, demander à SES la sortie du bac à sable.

`terraform apply` crée des ressources facturées (NAT, RDS Multi-AZ, ElastiCache, Fargate : de l'ordre de 150 à 200 € par mois en configuration par défaut ; une estimation, pas une mesure).

## Déployer une version

`.github/workflows/deploy.yml` (déclenchement manuel) construit l'image, la pousse, enregistre de nouvelles révisions de tâche, **lance les migrations avant tout remplacement**, puis met à jour le web et le worker. Variables GitHub à définir : `AWS_REGION`, `AWS_DEPLOY_ROLE_ARN`, `ECR_REPOSITORY` (`contractflow-prod`), `ECS_CLUSTER` (sorties `deploy_role_arn` et `ecs_cluster`).

Terraform ne remet pas les services à la révision qu'il connaît (`ignore_changes` sur la définition de tâche) : l'infrastructure et les versions du logiciel ont chacune leur outil.

## Vérifier sans rien créer

```bash
terraform fmt -recursive -check
terraform init -backend=false
terraform validate
trivy config --severity HIGH,CRITICAL .
```

La CI le fait à chaque envoi.

## À savoir

- **SES démarre en bac à sable** : il n'écrit qu'à des adresses vérifiées. Demander l'accès à la production dans la console.
- **Une seule NAT** : si sa zone tombe, les tâches perdent la sortie (SES, ECR, signatures de l'antivirus).
- **Les secrets sont dans l'état Terraform** : le protéger comme un secret.
- **Pas de WAF, pas de sauvegarde inter-régions, pas d'alarmes** : voir les limites de l'ADR-012.
