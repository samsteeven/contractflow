output "url" {
  description = "Adresse de l'application."
  value       = "https://${var.domain_name}"
}

output "ecr_repository_url" {
  description = "Où pousser l'image."
  value       = aws_ecr_repository.app.repository_url
}

output "ecs_cluster" {
  value = aws_ecs_cluster.main.name
}

output "documents_bucket" {
  value = aws_s3_bucket.documents.bucket
}

output "database_endpoint" {
  value = aws_db_instance.main.address
}

output "deploy_role_arn" {
  description = "À renseigner dans la variable AWS_DEPLOY_ROLE_ARN de GitHub (vide si github_repository n'est pas défini)."
  value       = local.deploy_enabled ? aws_iam_role.deploy[0].arn : null
}
