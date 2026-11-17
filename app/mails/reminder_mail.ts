import type { ReminderStage } from '#services/vocabulary'
import env from '#start/env'
import { BaseMail } from '@adonisjs/mail'

export type ReminderMailData = {
  to: { email: string; name: string | null }
  stage: ReminderStage
  title: string
  contractId: number
  contractTitle: string
  counterparty: string
  dueOn: string
  daysLeft: number
}

/** Le délai dit la vérité : « dans 28 jours », pas le nom du palier atteint. */
function whenLabel(data: ReminderMailData) {
  if (data.stage === 'overdue') return 'est dépassée'
  if (data.daysLeft <= 0) return "aujourd'hui"
  if (data.daysLeft === 1) return 'demain'
  return `dans ${data.daysLeft} jours`
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

/** Rappel d'une échéance à son responsable. Le texte seul est complet, le HTML le reprend. */
export default class ReminderMail extends BaseMail {
  constructor(private data: ReminderMailData) {
    super()
  }

  prepare() {
    const { data } = this
    const url = `${env.get('APP_URL', 'http://localhost:3333')}/contracts/${data.contractId}`
    const when = whenLabel(data)
    const headline =
      data.stage === 'overdue'
        ? `L'échéance « ${data.title} » est dépassée depuis ${Math.abs(data.daysLeft)} jour(s).`
        : `L'échéance « ${data.title} » tombe ${when} (${data.dueOn}).`
    const text = [
      `Bonjour ${data.to.name ?? ''}`.trim() + ',',
      '',
      headline,
      `Contrat : ${data.contractTitle} (${data.counterparty})`,
      `Ouvrir le contrat : ${url}`,
    ].join('\n')
    const html = [
      `<p>Bonjour ${escapeHtml(data.to.name ?? '')},</p>`,
      `<p>${escapeHtml(headline)}</p>`,
      `<p>Contrat : <a href="${escapeHtml(url)}">${escapeHtml(data.contractTitle)}</a> (${escapeHtml(data.counterparty)})</p>`,
    ].join('')

    this.message
      .to(data.to.email)
      .subject(
        data.stage === 'overdue' ? `[En retard] ${data.title}` : `[Échéance ${when}] ${data.title}`
      )
      .text(text)
      .html(html)
  }
}
