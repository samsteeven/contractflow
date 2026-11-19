# Les secrets de l'application sont générés ici et rangés dans Secrets Manager. ECS les injecte
# dans les conteneurs au démarrage : ils ne figurent dans aucune définition de tâche en clair.
#
# Ils existent aussi dans l'état Terraform. L'état est donc chiffré et à accès restreint (voir
# le README) ; c'est la limite connue de cette approche.

resource "random_password" "app_key" {
  length  = 48
  special = false
}

resource "random_password" "webhook" {
  length  = 48
  special = false
}

# Jeton ElastiCache : 16 à 128 caractères imprimables, sans « @ », « " » ni « / ».
resource "random_password" "redis" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${local.name}/app"
  description             = "Secrets de l'application ContractFlow"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id

  secret_string = jsonencode({
    APP_KEY                  = random_password.app_key.result
    SIGNATURE_WEBHOOK_SECRET = random_password.webhook.result
    REDIS_PASSWORD           = random_password.redis.result
    SMTP_USERNAME            = aws_iam_access_key.smtp.id
    SMTP_PASSWORD            = aws_iam_access_key.smtp.ses_smtp_password_v4
  })
}
