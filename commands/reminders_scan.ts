import { BullReminderQueue } from '#services/reminder_queue'
import ReminderService from '#services/reminder_service'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'

export default class RemindersScan extends BaseCommand {
  static commandName = 'reminders:scan'
  static description = 'Lance le parcours des échéances et met les rappels dans la file'
  static options: CommandOptions = { startApp: true }

  @flags.string({
    description: 'Jour simulé, au format AAAA-MM-JJ (par défaut : aujourd’hui, UTC)',
  })
  declare date?: string

  async run() {
    const today = this.date ? DateTime.fromISO(this.date, { zone: 'utc' }) : DateTime.utc()
    if (!today.isValid) {
      this.logger.error('Date invalide')
      this.exitCode = 1
      return
    }
    const queue = new BullReminderQueue()
    try {
      const result = await new ReminderService(queue).scan(today)
      this.logger.info(`${result.created} rappel(s) créé(s), ${result.requeued} remis dans la file`)
    } finally {
      await queue.close()
    }
  }
}
