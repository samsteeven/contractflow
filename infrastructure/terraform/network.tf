data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name = "${var.project}-${var.environment}"
  azs  = slice(data.aws_availability_zones.available.names, 0, 2)
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = local.name }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = local.name }
}

# Deux zones. Sous-réseaux publics : répartiteur de charge et passerelle NAT seulement.
# Sous-réseaux privés : tâches, base et cache, sans adresse publique.
resource "aws_subnet" "public" {
  count                   = length(local.azs)
  vpc_id                  = aws_vpc.main.id
  availability_zone       = local.azs[count.index]
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  map_public_ip_on_launch = false
  tags                    = { Name = "${local.name}-public-${local.azs[count.index]}" }
}

resource "aws_subnet" "private" {
  count             = length(local.azs)
  vpc_id            = aws_vpc.main.id
  availability_zone = local.azs[count.index]
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  tags              = { Name = "${local.name}-private-${local.azs[count.index]}" }
}

# Une seule passerelle NAT : compromis de coût. Si sa zone tombe, les tâches des deux zones
# perdent la sortie vers Internet (SES, ECR) jusqu'à son retour.
resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = { Name = "${local.name}-nat" }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  tags          = { Name = local.name }
  depends_on    = [aws_internet_gateway.main]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.name}-public" }

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.name}-private" }

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# Le trafic vers S3 (pièces et PDF) ne passe pas par la passerelle NAT : moins cher, et il
# ne quitte pas le réseau d'AWS.
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]
  tags              = { Name = "${local.name}-s3" }
}

# --- Groupes de sécurité : chaque flux est nommé, rien d'autre n'entre. ---

resource "aws_security_group" "alb" {
  name_prefix = "${local.name}-alb-"
  description = "Repartiteur de charge : HTTP et HTTPS depuis Internet"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${local.name}-alb" }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP, uniquement pour rediriger vers HTTPS"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "alb_to_app" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Vers les taches web"
  ip_protocol                  = "tcp"
  from_port                    = 3333
  to_port                      = 3333
  referenced_security_group_id = aws_security_group.app.id
}

resource "aws_security_group" "app" {
  name_prefix = "${local.name}-app-"
  description = "Taches web et worker"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${local.name}-app" }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "app_from_alb" {
  security_group_id            = aws_security_group.app.id
  description                  = "Depuis le repartiteur de charge"
  ip_protocol                  = "tcp"
  from_port                    = 3333
  to_port                      = 3333
  referenced_security_group_id = aws_security_group.alb.id
}

# Sortie des tâches, port par port. HTTPS : ECR, Secrets Manager, CloudWatch, S3, mises à jour
# des signatures de l'antivirus. 587 : SES (STARTTLS). Base et cache : le réseau privé seulement.
# La résolution DNS passe par le résolveur du VPC, que les groupes de sécurité ne filtrent pas.
resource "aws_vpc_security_group_egress_rule" "app_https" {
  security_group_id = aws_security_group.app.id
  description       = "HTTPS : AWS et signatures de l'antivirus"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0" # trivy:ignore:AWS-0104 les services AWS et clamav.net n'ont pas d'adresses fixes
}

resource "aws_vpc_security_group_egress_rule" "app_smtp" {
  security_group_id = aws_security_group.app.id
  description       = "SMTP vers SES (STARTTLS)"
  ip_protocol       = "tcp"
  from_port         = 587
  to_port           = 587
  cidr_ipv4         = "0.0.0.0/0" # trivy:ignore:AWS-0104 les adresses de SES changent
}

resource "aws_vpc_security_group_egress_rule" "app_to_db" {
  security_group_id            = aws_security_group.app.id
  description                  = "PostgreSQL"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.db.id
}

resource "aws_vpc_security_group_egress_rule" "app_to_redis" {
  security_group_id            = aws_security_group.app.id
  description                  = "Redis"
  ip_protocol                  = "tcp"
  from_port                    = 6379
  to_port                      = 6379
  referenced_security_group_id = aws_security_group.redis.id
}

# Journaux de flux : qui a parlé à qui, accepté ou refusé. Indispensable pour comprendre un incident.
resource "aws_cloudwatch_log_group" "flow" {
  name              = "/vpc/${local.name}/flow"
  retention_in_days = var.log_retention_days
}

data "aws_iam_policy_document" "flow_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["vpc-flow-logs.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "flow_write" {
  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"]
    resources = ["${aws_cloudwatch_log_group.flow.arn}:*"]
  }
}

resource "aws_iam_role" "flow" {
  name               = "${local.name}-vpc-flow"
  assume_role_policy = data.aws_iam_policy_document.flow_assume.json
}

resource "aws_iam_role_policy" "flow" {
  name   = "ecrire-les-journaux"
  role   = aws_iam_role.flow.id
  policy = data.aws_iam_policy_document.flow_write.json
}

resource "aws_flow_log" "main" {
  vpc_id          = aws_vpc.main.id
  traffic_type    = "ALL"
  log_destination = aws_cloudwatch_log_group.flow.arn
  iam_role_arn    = aws_iam_role.flow.arn
}

resource "aws_security_group" "db" {
  name_prefix = "${local.name}-db-"
  description = "PostgreSQL : uniquement depuis les taches"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${local.name}-db" }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "db_from_app" {
  security_group_id            = aws_security_group.db.id
  description                  = "PostgreSQL depuis les taches"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.app.id
}

resource "aws_security_group" "redis" {
  name_prefix = "${local.name}-redis-"
  description = "Redis : uniquement depuis les taches"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${local.name}-redis" }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "redis_from_app" {
  security_group_id            = aws_security_group.redis.id
  description                  = "Redis depuis les taches"
  ip_protocol                  = "tcp"
  from_port                    = 6379
  to_port                      = 6379
  referenced_security_group_id = aws_security_group.app.id
}
