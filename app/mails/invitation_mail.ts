import env from '#start/env'
import { ROLE_LABELS, type Role } from '#services/vocabulary'
import { BaseMail } from '@adonisjs/mail'

type InvitationMailData = {
  to: string
  organizationName: string
  inviterName: string
  role: Role
  token: string
  expiresOn: string
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

/** Invitation à rejoindre une organisation. Le lien contient le jeton, qui n'est valable qu'une fois. */
export default class InvitationMail extends BaseMail {
  constructor(private data: InvitationMailData) {
    super()
  }

  /** L'adresse du lien, pour les tests et pour un renvoi manuel. */
  get url() {
    return `${env.get('APP_URL', 'http://localhost:3333')}/invitations/${this.data.token}`
  }

  prepare() {
    const { data } = this
    const role = ROLE_LABELS[data.role]
    const headline = `${data.inviterName} vous invite à rejoindre « ${data.organizationName} » sur ContractFlow, avec le rôle ${role}.`
    const text = [
      'Bonjour,',
      '',
      headline,
      `Accepter l'invitation : ${this.url}`,
      '',
      `Ce lien est valable jusqu'au ${data.expiresOn} et ne sert qu'une fois.`,
      "Si vous n'attendiez pas ce message, ignorez-le.",
    ].join('\n')
    const html = [
      '<p>Bonjour,</p>',
      `<p>${escapeHtml(headline)}</p>`,
      `<p><a href="${escapeHtml(this.url)}">Accepter l'invitation</a></p>`,
      `<p>Ce lien est valable jusqu'au ${escapeHtml(data.expiresOn)} et ne sert qu'une fois. Si vous n'attendiez pas ce message, ignorez-le.</p>`,
    ].join('')

    this.message
      .to(data.to)
      .subject(`Invitation à rejoindre ${data.organizationName}`)
      .text(text)
      .html(html)
  }
}
