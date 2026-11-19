# Rôle de déploiement assumé par GitHub Actions (OIDC) : aucune clé d'accès longue durée n'est
# stockée dans GitHub. Créé seulement si github_repository est renseigné.
#
# Ses droits sont ceux d'un déploiement d'image, pas d'une administration : pousser dans ECR,
# enregistrer une révision de tâche, lancer la migration, mettre à jour les deux services. Il ne
# peut pas toucher au réseau, à la base, aux secrets ni à IAM.

locals {
  deploy_enabled = var.github_repository != ""
}

resource "aws_iam_openid_connect_provider" "github" {
  count          = local.deploy_enabled ? 1 : 0
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_policy_document" "deploy_assume" {
  count = local.deploy_enabled ? 1 : 0

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github[0].arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Une seule branche d'un seul dépôt : un autre dépôt, ou une autre branche, ne peut pas déployer.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:ref:refs/heads/${var.github_branch}"]
    }
  }
}

resource "aws_iam_role" "deploy" {
  count              = local.deploy_enabled ? 1 : 0
  name               = "${local.name}-deploy"
  assume_role_policy = data.aws_iam_policy_document.deploy_assume[0].json
}

data "aws_iam_policy_document" "deploy" {
  count = local.deploy_enabled ? 1 : 0

  statement {
    sid       = "AuthentificationEcr"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "PousserLImage"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = [aws_ecr_repository.app.arn]
  }

  # Ces actions n'acceptent pas de restriction par ressource.
  statement {
    sid       = "DecrireEtEnregistrer"
    actions   = ["ecs:DescribeTaskDefinition", "ecs:RegisterTaskDefinition"]
    resources = ["*"]
  }

  statement {
    sid     = "LancerLaMigration"
    actions = ["ecs:RunTask"]
    resources = [
      "arn:aws:ecs:${var.region}:${data.aws_caller_identity.current.account_id}:task-definition/${aws_ecs_task_definition.migrate.family}:*",
    ]

    condition {
      test     = "ArnEquals"
      variable = "ecs:cluster"
      values   = [aws_ecs_cluster.main.arn]
    }
  }

  statement {
    sid       = "SuivreLesTaches"
    actions   = ["ecs:DescribeTasks"]
    resources = ["arn:aws:ecs:${var.region}:${data.aws_caller_identity.current.account_id}:task/${aws_ecs_cluster.main.name}/*"]
  }

  statement {
    sid       = "MettreAJourLesServices"
    actions   = ["ecs:DescribeServices", "ecs:UpdateService"]
    resources = [aws_ecs_service.web.id, aws_ecs_service.worker.id]
  }

  statement {
    sid       = "TransmettreLesRoles"
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.execution.arn, aws_iam_role.task.arn]

    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "deploy" {
  count  = local.deploy_enabled ? 1 : 0
  name   = "deploiement"
  role   = aws_iam_role.deploy[0].id
  policy = data.aws_iam_policy_document.deploy[0].json
}
