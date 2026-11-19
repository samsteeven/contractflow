# Deux rôles distincts, comme toujours sur ECS :
#   - le rôle d'EXÉCUTION appartient à ECS : tirer l'image, écrire les journaux, lire les secrets
#     pour les injecter au démarrage ;
#   - le rôle de TÂCHE appartient à l'application : ce que le code peut faire une fois lancé.

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${local.name}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "execution_secrets" {
  statement {
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      aws_secretsmanager_secret.app.arn,
      aws_db_instance.main.master_user_secret[0].secret_arn,
    ]
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  name   = "lire-les-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets.json
}

resource "aws_iam_role" "task" {
  name               = "${local.name}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

# L'application n'a accès qu'à son bucket, et seulement aux objets : ni création de bucket,
# ni lecture d'un autre, ni changement de politique. Aucune clé d'accès n'existe : les droits
# viennent du rôle, renouvelés automatiquement.
data "aws_iam_policy_document" "task_documents" {
  statement {
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.documents.arn}/*"]
  }

  statement {
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.documents.arn]
  }
}

resource "aws_iam_role_policy" "task_documents" {
  name   = "documents"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task_documents.json
}
