import RuleViolation from '#exceptions/rule_violation'
import ContractTemplate from '#models/contract_template'
import { recordAudit } from '#services/audit'
import type { ContractType } from '#services/vocabulary'
import db from '@adonisjs/lucid/services/db'

const PLACEHOLDER = /\{\{\s*([a-z][a-z0-9_]{0,39})\s*\}\}/g

/** Variables d'un texte de modèle, dans l'ordre de première apparition, sans doublon. */
export function extractVariables(body: string) {
  return [...new Set([...body.matchAll(PLACEHOLDER)].map((match) => match[1]))]
}

/**
 * Remplit un modèle. Une seule passe : une valeur qui contiendrait elle-même `{{nom}}` est
 * insérée telle quelle, jamais réinterprétée. Toute variable sans valeur est refusée : un
 * contrat ne part pas avec un trou.
 */
export function renderTemplate(body: string, values: Record<string, string>) {
  const missing = extractVariables(body).filter((name) => !values[name]?.trim())
  if (missing.length > 0) {
    throw new RuleViolation('missing_variable', `Valeurs manquantes : ${missing.join(', ')}.`, 422)
  }
  return body.replace(PLACEHOLDER, (_, name: string) => values[name].trim())
}

export default class TemplateService {
  async create(
    organizationId: number,
    actorId: number,
    input: { name: string; type: ContractType; body: string }
  ) {
    // Une accolade qui n'est pas une variable valide est presque toujours une faute de frappe
    // (`{{ Nom }}`, `{{date-debut}}`) : mieux vaut la refuser que l'envoyer dans un contrat.
    if (/\{\{|\}\}/.test(input.body.replace(PLACEHOLDER, ''))) {
      throw new RuleViolation(
        'invalid_template',
        'Une variable est mal écrite : utilisez {{nom}} avec des minuscules, des chiffres et des tirets bas.',
        422
      )
    }

    return db.transaction(async (trx) => {
      const existing = await ContractTemplate.query({ client: trx })
        .where('organization_id', organizationId)
        .where('name', input.name)
        .first()
      if (existing) {
        throw new RuleViolation(
          'template_name_taken',
          'Un modèle porte déjà ce nom dans votre organisation.'
        )
      }
      const template = await ContractTemplate.create(
        { organizationId, createdBy: actorId, ...input },
        { client: trx }
      )
      await recordAudit(trx, {
        organizationId,
        actorId,
        action: 'template.created',
        subject: { type: 'template', id: template.id },
        metadata: { name: input.name, variables: extractVariables(input.body).length },
      })
      return template
    })
  }
}
