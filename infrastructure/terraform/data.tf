data "aws_caller_identity" "current" {}

# --- PostgreSQL (RDS) ---

resource "aws_db_subnet_group" "main" {
  name       = local.name
  subnet_ids = aws_subnet.private[*].id
}

# L'authentification IAM de la base n'est pas activée : l'application se connecte avec le mot de
# passe géré par RDS (rotation possible dans Secrets Manager). Voir l'ADR-012.
# trivy:ignore:AWS-0176
resource "aws_db_instance" "main" {
  identifier     = local.name
  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  db_name  = "contractflow"
  username = "contractflow"

  # Le mot de passe est généré par RDS et rangé dans Secrets Manager : il n'apparaît ni dans le
  # code, ni dans les variables, ni dans l'état Terraform.
  manage_master_user_password = true

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  multi_az               = var.db_multi_az

  # rds.force_ssl est actif par défaut sur PostgreSQL 15 et plus : l'application se connecte
  # avec DB_SSL=true et vérifie le certificat (bundle RDS embarqué dans l'image).
  backup_retention_period = 14
  backup_window           = "02:00-03:00"
  maintenance_window      = "sun:03:30-sun:04:30"
  copy_tags_to_snapshot   = true

  deletion_protection       = var.db_deletion_protection
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name}-final"

  auto_minor_version_upgrade            = true
  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  enabled_cloudwatch_logs_exports       = ["postgresql", "upgrade"]
}

# --- Redis (ElastiCache) : la file des rappels ---

resource "aws_elasticache_subnet_group" "main" {
  name       = local.name
  subnet_ids = aws_subnet.private[*].id
}

# BullMQ exige qu'aucune clé ne soit évincée : avec la politique par défaut, une tâche en
# attente pourrait disparaître quand la mémoire se remplit.
resource "aws_elasticache_parameter_group" "queue" {
  name        = "${local.name}-queue"
  family      = "redis7"
  description = "File de taches : aucune eviction"

  parameter {
    name  = "maxmemory-policy"
    value = "noeviction"
  }
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = local.name
  description          = "File des rappels de ${local.name}"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  port                 = 6379

  num_cache_clusters         = 1 + var.redis_replicas
  automatic_failover_enabled = var.redis_replicas > 0
  multi_az_enabled           = var.redis_replicas > 0

  parameter_group_name = aws_elasticache_parameter_group.queue.name
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis.result

  snapshot_retention_limit = 3
  apply_immediately        = false
}

# --- Documents (S3) : contrats en PDF et pièces jointes ---

resource "aws_s3_bucket" "documents" {
  bucket = "${local.name}-documents-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket                  = aws_s3_bucket.documents.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Clés gérées par S3 (SSE-S3) : chiffrées au repos sans coût ni gestion de clé. Une clé KMS
# propre donnerait un journal d'usage et la révocation, au prix d'un coût par requête.
# trivy:ignore:AWS-0132
resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Les anciennes versions servent à récupérer une suppression ou un écrasement accidentels ;
# elles ne s'accumulent pas indéfiniment.
resource "aws_s3_bucket_lifecycle_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    id     = "anciennes-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  depends_on = [aws_s3_bucket_versioning.documents]
}

# Aucun accès en clair, même avec des droits valides.
data "aws_iam_policy_document" "documents_tls_only" {
  statement {
    sid       = "RefuserHttp"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.documents.arn, "${aws_s3_bucket.documents.arn}/*"]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "documents" {
  bucket = aws_s3_bucket.documents.id
  policy = data.aws_iam_policy_document.documents_tls_only.json

  depends_on = [aws_s3_bucket_public_access_block.documents]
}

# --- Images (ECR) ---

resource "aws_ecr_repository" "app" {
  name                 = local.name
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Garder les 30 dernieres images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 30
      }
      action = { type = "expire" }
    }]
  })
}
