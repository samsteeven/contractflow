# Envoi des e-mails par Amazon SES, en SMTP (le code utilise nodemailer, aucune dépendance de plus).
#
# SES démarre en « bac à sable » : il n'envoie qu'à des adresses vérifiées, tant qu'AWS n'a pas
# accordé l'accès à la production. Cette demande se fait dans la console, pas dans Terraform.

resource "aws_ses_domain_identity" "main" {
  domain = var.domain_name
}

resource "aws_route53_record" "ses_verification" {
  zone_id = var.route53_zone_id
  name    = "_amazonses.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.main.verification_token]
}

# DKIM : les messages sont signés, sans quoi la plupart des boîtes les classent en indésirables.
resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

resource "aws_route53_record" "ses_dkim" {
  count   = 3
  zone_id = var.route53_zone_id
  name    = "${aws_ses_domain_dkim.main.dkim_tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.main.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

# Les identifiants SMTP de SES sont ceux d'un utilisateur IAM dont le mot de passe est dérivé de
# la clé d'accès. Cet utilisateur ne peut qu'envoyer, et seulement depuis ce domaine.
resource "aws_iam_user" "smtp" {
  name = "${local.name}-ses-smtp"
}

data "aws_iam_policy_document" "smtp" {
  statement {
    actions   = ["ses:SendRawEmail"]
    resources = [aws_ses_domain_identity.main.arn]
  }
}

resource "aws_iam_user_policy" "smtp" {
  name   = "envoi-ses"
  user   = aws_iam_user.smtp.name
  policy = data.aws_iam_policy_document.smtp.json
}

resource "aws_iam_access_key" "smtp" {
  user = aws_iam_user.smtp.name
}
