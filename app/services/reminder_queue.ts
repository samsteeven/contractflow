import ReminderService, { type ReminderQueue } from '#services/reminder_service'
import env from '#start/env'
import { Queue, Worker } from 'bullmq'
import { DateTime } from 'luxon'

export const QUEUE_NAME = 'reminders'

const connection = () => ({
  host: env.get('REDIS_HOST'),
  port: env.get('REDIS_PORT'),
  // Exigé par BullMQ pour les connexions du worker.
  maxRetriesPerRequest: null,
})

/**
 * File BullMQ des rappels. L'identifiant de tâche est celui du rappel : l'ajouter deux fois ne
 * crée qu'une tâche. Cinq essais, délai croissant à partir de 30 secondes.
 */
export class BullReminderQueue implements ReminderQueue {
  readonly queue: Queue

  constructor(name = QUEUE_NAME) {
    this.queue = new Queue(name, { connection: connection() })
  }

  async enqueue(reminderId: number) {
    await this.queue.add(
      'send',
      { reminderId },
      {
        jobId: `reminder-${reminderId}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      }
    )
  }

  /** Le parcours quotidien est une tâche répétée, déclarée une fois (idempotent). */
  async scheduleDailyScan() {
    await this.queue.upsertJobScheduler(
      'daily-scan',
      { pattern: '0 7 * * *', tz: 'UTC' },
      { name: 'scan', opts: { removeOnComplete: 30, removeOnFail: 100 } }
    )
  }

  async close() {
    await this.queue.close()
  }
}

/** Traite les tâches : `scan` (parcours) et `send` (un rappel). */
export function startWorker(queue: BullReminderQueue, name = QUEUE_NAME, concurrency = 4) {
  const reminders = new ReminderService(queue)
  return new Worker(
    name,
    async (job) => {
      if (job.name === 'scan') return reminders.scan(DateTime.utc())
      if (job.name === 'send') return reminders.send(Number(job.data.reminderId))
      throw new Error(`tâche inconnue : ${job.name}`)
    },
    { connection: connection(), concurrency }
  )
}
