import { BullReminderQueue, startWorker } from '#services/reminder_queue'
import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class QueueWork extends BaseCommand {
  static commandName = 'queue:work'
  static description =
    'Traite la file des rappels (envoi des e-mails et parcours quotidien à 07:00 UTC)'
  static options: CommandOptions = { startApp: true, staysAlive: true }

  async run() {
    const queue = new BullReminderQueue()
    await queue.scheduleDailyScan()
    const worker = startWorker(queue)
    worker.on('failed', (job, error) =>
      this.logger.error(`tâche ${job?.name} ${job?.id} en échec : ${error.message}`)
    )
    worker.on('completed', (job) => this.logger.info(`tâche ${job.name} ${job.id} terminée`))

    const stop = async () => {
      await worker.close()
      await queue.close()
      await this.terminate()
    }
    this.app.terminating(stop)
    this.logger.info('file des rappels en écoute')
  }
}
