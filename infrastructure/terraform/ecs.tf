resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${local.name}"
  retention_in_days = var.log_retention_days
}

resource "aws_ecs_cluster" "main" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

locals {
  app_image = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"

  # Configuration commune au web, au worker et à la migration. Rien de secret ici.
  app_environment = {
    NODE_ENV           = "production"
    HOST               = "0.0.0.0"
    PORT               = "3333"
    LOG_LEVEL          = "info"
    APP_URL            = "https://${var.domain_name}"
    TRUST_PROXY        = "true"
    SESSION_DRIVER     = "cookie"
    DB_HOST            = aws_db_instance.main.address
    DB_PORT            = tostring(aws_db_instance.main.port)
    DB_DATABASE        = aws_db_instance.main.db_name
    DB_USER            = aws_db_instance.main.username
    DB_SSL             = "true"
    REDIS_HOST         = aws_elasticache_replication_group.main.primary_endpoint_address
    REDIS_PORT         = "6379"
    REDIS_TLS          = "true"
    SMTP_HOST          = "email-smtp.${var.region}.amazonaws.com"
    SMTP_PORT          = "587"
    MAIL_MAILER        = "smtp"
    MAIL_FROM_NAME     = "ContractFlow"
    MAIL_FROM_ADDRESS  = "contrats@${var.domain_name}"
    DRIVE_DISK         = "s3"
    S3_BUCKET          = aws_s3_bucket.documents.bucket
    AWS_REGION         = var.region
    CLAMAV_HOST        = "127.0.0.1"
    CLAMAV_PORT        = "3310"
    SIGNATURE_PROVIDER = "sandbox"
  }

  # Valeurs lues dans Secrets Manager au démarrage de chaque conteneur (`arn:clé::` désigne
  # une clé du secret JSON).
  app_secrets = {
    APP_KEY                  = "${aws_secretsmanager_secret.app.arn}:APP_KEY::"
    SIGNATURE_WEBHOOK_SECRET = "${aws_secretsmanager_secret.app.arn}:SIGNATURE_WEBHOOK_SECRET::"
    REDIS_PASSWORD           = "${aws_secretsmanager_secret.app.arn}:REDIS_PASSWORD::"
    SMTP_USERNAME            = "${aws_secretsmanager_secret.app.arn}:SMTP_USERNAME::"
    SMTP_PASSWORD            = "${aws_secretsmanager_secret.app.arn}:SMTP_PASSWORD::"
    DB_PASSWORD              = "${aws_db_instance.main.master_user_secret[0].secret_arn}:password::"
  }

  environment_list = [for name, value in local.app_environment : { name = name, value = value }]
  secrets_list     = [for name, value in local.app_secrets : { name = name, valueFrom = value }]

  log_options = {
    "awslogs-group"  = aws_cloudwatch_log_group.app.name
    "awslogs-region" = var.region
  }
}

# --- Web : l'application et, à côté, l'antivirus ---
#
# Les deux conteneurs partagent l'interface réseau de la tâche : l'application joint ClamAV sur
# 127.0.0.1:3310, rien n'est exposé. L'application ne démarre qu'une fois ClamAV prêt (il charge
# ses signatures pendant une à deux minutes), sans quoi les premiers dépôts seraient refusés.
resource "aws_ecs_task_definition" "web" {
  family                   = "${local.name}-web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.web_cpu
  memory                   = var.web_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = "clamav"
      image     = var.clamav_image
      essential = true

      healthCheck = {
        command     = ["CMD", "/usr/local/bin/clamdcheck.sh"]
        interval    = 15
        timeout     = 5
        retries     = 20
        startPeriod = 120
      }

      logConfiguration = {
        logDriver = "awslogs"
        options   = merge(local.log_options, { "awslogs-stream-prefix" = "clamav" })
      }
    },
    {
      name      = "app"
      image     = local.app_image
      essential = true

      portMappings = [{ containerPort = 3333, protocol = "tcp" }]
      environment  = local.environment_list
      secrets      = local.secrets_list

      dependsOn = [{ containerName = "clamav", condition = "HEALTHY" }]

      logConfiguration = {
        logDriver = "awslogs"
        options   = merge(local.log_options, { "awslogs-stream-prefix" = "web" })
      }
    }
  ])
}

# --- Worker : envoi des rappels (BullMQ). Pas de port, pas de répartiteur. ---
resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = "app"
      image     = local.app_image
      essential = true
      command   = ["node", "ace", "queue:work"]

      environment = local.environment_list
      secrets     = local.secrets_list

      logConfiguration = {
        logDriver = "awslogs"
        options   = merge(local.log_options, { "awslogs-stream-prefix" = "worker" })
      }
    }
  ])
}

# --- Migration : tâche ponctuelle, lancée par le déploiement avant de remplacer les services ---
resource "aws_ecs_task_definition" "migrate" {
  family                   = "${local.name}-migrate"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = "app"
      image     = local.app_image
      essential = true
      command   = ["node", "ace", "migration:run", "--force"]

      environment = local.environment_list
      secrets     = local.secrets_list

      logConfiguration = {
        logDriver = "awslogs"
        options   = merge(local.log_options, { "awslogs-stream-prefix" = "migrate" })
      }
    }
  ])
}

# Terraform crée les services mais ne les met pas à jour à chaque version : le déploiement
# continu enregistre une nouvelle révision de tâche et la déploie (voir .github/workflows/deploy.yml).
# `ignore_changes` empêche Terraform de revenir à la révision qu'il connaît.
resource "aws_ecs_service" "web" {
  name            = "web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.web_desired_count
  launch_type     = "FARGATE"

  # ClamAV met jusqu'à deux minutes à répondre : le répartiteur ne juge pas la tâche pendant ce temps.
  health_check_grace_period_seconds  = 240
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "app"
    container_port   = 3333
  }

  depends_on = [aws_lb_listener.https]

  lifecycle {
    ignore_changes = [task_definition]
  }
}

resource "aws_ecs_service" "worker" {
  name            = "worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  # Un seul worker : on arrête l'ancien avant de lancer le nouveau, sans quoi deux processus
  # traiteraient la file en même temps pendant un déploiement.
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = false
  }

  lifecycle {
    ignore_changes = [task_definition]
  }
}
