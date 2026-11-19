variable "region" {
  description = "Région AWS. Paris par défaut ; SES, RDS, ElastiCache et Fargate y sont disponibles."
  type        = string
  default     = "eu-west-3"
}

variable "project" {
  description = "Préfixe des noms de ressources."
  type        = string
  default     = "contractflow"
}

variable "environment" {
  description = "Nom de l'environnement (prod, staging…)."
  type        = string
  default     = "prod"
}

variable "domain_name" {
  description = "Nom de domaine de l'application (par exemple contrats.exemple.fr). Le certificat, l'alias DNS et l'identité d'envoi SES en dépendent."
  type        = string
}

variable "route53_zone_id" {
  description = "Zone Route 53 qui porte domain_name. Elle doit déjà exister : Terraform y ajoute des enregistrements, il ne crée pas la zone."
  type        = string
}

variable "image_tag" {
  description = "Étiquette de l'image dans ECR utilisée à la création des définitions de tâche. Ensuite, le déploiement continu enregistre de nouvelles révisions : Terraform ne les écrase pas."
  type        = string
  default     = "initial"
}

variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}

variable "web_desired_count" {
  description = "Nombre de tâches web (deux au moins pour survivre à la perte d'une zone)."
  type        = number
  default     = 2
}

variable "web_cpu" {
  description = "UC Fargate de la tâche web (application + ClamAV)."
  type        = number
  default     = 1024
}

variable "web_memory" {
  description = "Mémoire Fargate de la tâche web, en Mo. ClamAV charge ses signatures en mémoire : moins de 3 Go est risqué."
  type        = number
  default     = 4096
}

variable "worker_cpu" {
  type    = number
  default = 256
}

variable "worker_memory" {
  type    = number
  default = 512
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.small"
}

variable "db_allocated_storage" {
  description = "Espace initial en Go ; il grandit seul jusqu'à db_max_allocated_storage."
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  type    = number
  default = 100
}

variable "db_multi_az" {
  description = "Réplique de secours dans une autre zone. À désactiver seulement pour un environnement jetable."
  type        = bool
  default     = true
}

variable "db_engine_version" {
  type    = string
  default = "18"
}

variable "db_deletion_protection" {
  description = "Empêche la suppression de la base (et exige un instantané final). À ne lever qu'en connaissance de cause."
  type        = bool
  default     = true
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "redis_replicas" {
  description = "Nombre de répliques en plus du primaire (0 : pas de basculement automatique)."
  type        = number
  default     = 0
}

variable "clamav_image" {
  description = "Image de l'antivirus, exécutée à côté de l'application. Voir le README : à recopier dans ECR pour ne pas dépendre de Docker Hub."
  type        = string
  default     = "clamav/clamav:stable"
}

variable "log_retention_days" {
  type    = number
  default = 90
}

variable "github_repository" {
  description = "Dépôt GitHub (propriétaire/nom) autorisé à déployer par OIDC. Vide : aucun rôle de déploiement n'est créé."
  type        = string
  default     = ""
}

variable "github_branch" {
  description = "Seule branche autorisée à assumer le rôle de déploiement."
  type        = string
  default     = "main"
}
