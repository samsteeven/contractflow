import ReminderMail from '#mails/reminder_mail'
import Obligation from '#models/obligation'
import Reminder from '#models/reminder'
import type { ReminderStage } from '#services/vocabulary'
import mail from '@adonisjs/mail/services/main'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

/** Le départ d'un rappel vers la file de tâches. Séparé de la file pour tester sans Redis. */
export interface ReminderQueue {
  enqueue(reminderId: number): Promise<void>
}

/** Au-delà de ce délai, un rappel encore « à envoyer » est remis dans la file. */
export const STALE_AFTER_MINUTES = 60

/** Palier atteint pour un nombre de jours restants ; rien tant que l'échéance est lointaine. */
export function stageFor(days: number): ReminderStage | null {
  if (days < 0) return 'overdue'
  if (days === 0) return 'd0'
  if (days <= 1) return 'd1'
  if (days <= 7) return 'd7'
  if (days <= 30) return 'd30'
  return null
}

export function daysUntil(dueOn: DateTime, today: DateTime) {
  return Math.round(dueOn.startOf('day').diff(today.startOf('day'), 'days').days)
}

export default class ReminderService {
  constructor(protected queue: ReminderQueue) {}

  /**
   * Parcours quotidien. Pour chaque obligation ouverte dont l'échéance approche, on retient le
   * palier **atteint** (30 jours, 7, 1, le jour même, en retard), pas le palier du jour : si
   * le parcours n'a pas tourné pendant trois jours, il envoie le palier à jour sans inonder.
   * Un rappel par obligation et par palier, garanti par une contrainte unique : relancer le
   * parcours ne double rien. Les rappels restés « à envoyer » trop longtemps (la file était
   * injoignable) sont remis dans la file, dont l'identifiant de tâche évite les doublons.
   */
  async scan(today: DateTime, now: DateTime = DateTime.utc()) {
    const horizon = today.startOf('day').plus({ days: 30 })
    const obligations = await Obligation.query()
      .where('status', 'open')
      .where('due_on', '<=', horizon.toSQLDate()!)

    const created: number[] = []
    for (const obligation of obligations) {
      const stage = stageFor(daysUntil(obligation.dueOn, today))
      if (!stage) continue
      const inserted = await db
        .table('reminders')
        .insert({
          obligation_id: obligation.id,
          stage,
          recipient_id: obligation.assigneeId,
          status: 'queued',
          attempts: 0,
          queued_at: now.toSQL({ includeOffset: false }),
        })
        .onConflict(['obligation_id', 'stage'])
        .ignore()
        .returning('id')
      if (inserted[0]) created.push(inserted[0].id)
    }

    const stale = await Reminder.query()
      .where('status', 'queued')
      .where(
        'queued_at',
        '<',
        now.minus({ minutes: STALE_AFTER_MINUTES }).toSQL({ includeOffset: false })!
      )
      .whereNotIn('id', created.length > 0 ? created : [0])
    const requeued = stale.map((reminder) => reminder.id)

    for (const id of [...created, ...requeued]) await this.queue.enqueue(id)
    return { created: created.length, requeued: requeued.length }
  }

  /**
   * Envoie un rappel. Sans effet s'il l'a déjà été (la file livre au moins une fois) ; abandonné
   * si l'obligation s'est fermée depuis. Une erreur d'envoi est notée puis relancée pour que la
   * file réessaie avec un délai croissant.
   * Livraison au moins une fois : un arrêt entre l'envoi et l'écriture de `sent` peut produire
   * un second e-mail, jamais zéro.
   */
  async send(reminderId: number, today: DateTime = DateTime.utc(), now: DateTime = DateTime.utc()) {
    const reminder = await Reminder.query()
      .where('id', reminderId)
      .preload('recipient')
      .preload('obligation', (query) => query.preload('contract'))
      .firstOrFail()
    if (reminder.status !== 'queued') return 'already_handled' as const

    const { obligation, recipient } = reminder
    if (obligation.status !== 'open') {
      reminder.status = 'skipped'
      await reminder.save()
      return 'skipped' as const
    }

    reminder.attempts += 1
    try {
      await mail.send(
        new ReminderMail({
          to: { email: recipient.email, name: recipient.fullName },
          stage: reminder.stage,
          title: obligation.title,
          contractId: obligation.contractId,
          contractTitle: obligation.contract.title,
          counterparty: obligation.contract.counterparty,
          dueOn: obligation.dueOn.toISODate()!,
          daysLeft: daysUntil(obligation.dueOn, today),
        })
      )
    } catch (error) {
      reminder.lastError = String((error as Error).message).slice(0, 500)
      await reminder.save()
      throw error
    }
    reminder.merge({ status: 'sent', sentAt: now, lastError: null })
    await reminder.save()
    return 'sent' as const
  }
}
