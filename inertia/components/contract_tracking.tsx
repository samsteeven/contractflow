import Field from '~/components/field'
import Section from '~/components/section'
import { formatDay, KIND_LABELS } from '~/lib/labels'
import { Form } from '@adonisjs/inertia/react'

export type Tracking = {
  term: {
    startsOn: string
    endsOn: string
    autoRenew: boolean
    noticeDays: number
    renewalMonths: number | null
    status: 'active' | 'terminated'
  } | null
  obligations: {
    id: number
    title: string
    kind: string
    status: 'open' | 'done' | 'cancelled'
    dueOn: string
    daysLeft: number
    assignee: string
    notes: string | null
    canComplete: boolean
    canCancel: boolean
  }[]
  members: { id: number; name: string }[]
}

type Props = {
  contractId: number
  tracking: Tracking
  can: { manageTracking: boolean; engageTerm: boolean }
}

export function DeadlineBadge({ daysLeft }: { daysLeft: number }) {
  const label =
    daysLeft < 0
      ? `En retard de ${-daysLeft} j`
      : daysLeft === 0
        ? "Aujourd'hui"
        : daysLeft === 1
          ? 'Demain'
          : `Dans ${daysLeft} j`
  const state = daysLeft < 0 ? 'rejected' : daysLeft <= 7 ? 'in_review' : 'draft'
  return (
    <span className="badge" data-status={state}>
      {label}
    </span>
  )
}

const STATUS = { open: 'Ouverte', done: 'Close', cancelled: 'Annulée' }

/** Durée du contrat signé et obligations à suivre. Les règles sont côté serveur ; ici, l'affichage. */
export default function ContractTracking({ contractId, tracking, can }: Props) {
  const { term, obligations, members } = tracking

  return (
    <Section
      title="Suivi du contrat"
      description="Un contrat signé ne change plus, mais sa durée et ses obligations se suivent ici."
    >
      {term ? (
        <div data-testid="term">
          <p>
            Du {formatDay(term.startsOn)} au <strong>{formatDay(term.endsOn)}</strong>
            {term.status === 'terminated' && ' · terminé'}
          </p>
          <p className="muted">
            {term.autoRenew
              ? `Reconduction automatique de ${term.renewalMonths} mois, préavis de ${term.noticeDays} jour(s).`
              : `Pas de reconduction automatique, décision ${term.noticeDays} jour(s) avant la fin.`}
          </p>
          {can.engageTerm && (
            <div className="form__actions">
              {term.renewalMonths && (
                <Form route="terms.renew" routeParams={{ id: contractId }}>
                  {({ processing }) => (
                    <button
                      type="submit"
                      className="btn btn--secondary btn--sm"
                      disabled={processing}
                    >
                      Reconduire de {term.renewalMonths} mois
                    </button>
                  )}
                </Form>
              )}
              <Form route="terms.terminate" routeParams={{ id: contractId }}>
                {({ processing }) => (
                  <button
                    type="submit"
                    className="btn btn--secondary btn--sm"
                    disabled={processing}
                  >
                    Mettre fin au contrat
                  </button>
                )}
              </Form>
            </div>
          )}
        </div>
      ) : (
        can.manageTracking && (
          <Form route="terms.store" routeParams={{ id: contractId }}>
            {({ errors, processing }) => (
              <div className="form form--tight">
                <p className="muted">
                  Indiquez la durée : l’échéance de fin est créée et rappelée à son responsable.
                </p>
                <div className="form__row">
                  <Field id="startsOn" label="Début" error={errors.startsOn}>
                    <input
                      id="startsOn"
                      name="startsOn"
                      type="date"
                      className="field__input"
                      required
                    />
                  </Field>
                  <Field id="endsOn" label="Fin" error={errors.endsOn}>
                    <input
                      id="endsOn"
                      name="endsOn"
                      type="date"
                      className="field__input"
                      required
                    />
                  </Field>
                </div>
                <div className="form__row">
                  <Field id="noticeDays" label="Préavis (jours)" error={errors.noticeDays}>
                    <input
                      id="noticeDays"
                      name="noticeDays"
                      type="number"
                      min={0}
                      max={365}
                      defaultValue={30}
                      className="field__input"
                      required
                    />
                  </Field>
                  <Field
                    id="renewalMonths"
                    label="Reconduction (mois)"
                    hint="Facultatif sans reconduction automatique."
                    error={errors.renewalMonths}
                  >
                    <input
                      id="renewalMonths"
                      name="renewalMonths"
                      type="number"
                      min={1}
                      max={60}
                      className="field__input"
                    />
                  </Field>
                </div>
                <label className="check">
                  <input type="checkbox" name="autoRenew" value="true" /> Reconduction automatique
                </label>
                <Field id="assigneeId" label="Responsable de l’échéance" error={errors.assigneeId}>
                  <select id="assigneeId" name="assigneeId" className="field__input">
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <button type="submit" className="btn btn--primary" disabled={processing}>
                  Enregistrer la durée
                </button>
              </div>
            )}
          </Form>
        )
      )}

      <h3 className="round__title">Obligations</h3>
      {obligations.length === 0 ? (
        <p className="muted">Aucune obligation.</p>
      ) : (
        <ul className="rows" data-testid="obligations">
          {obligations.map((obligation) => (
            <li key={obligation.id} data-status={obligation.status}>
              <div>
                <strong>{obligation.title}</strong>{' '}
                <span className="muted">
                  {KIND_LABELS[obligation.kind]} · {formatDay(obligation.dueOn)} ·{' '}
                  {obligation.assignee}
                </span>{' '}
                {obligation.status === 'open' ? (
                  <DeadlineBadge daysLeft={obligation.daysLeft} />
                ) : (
                  <span
                    className="badge"
                    data-status={obligation.status === 'done' ? 'approved' : 'skipped'}
                  >
                    {STATUS[obligation.status]}
                  </span>
                )}
                {obligation.notes && <p className="muted">{obligation.notes}</p>}
              </div>
              {(obligation.canComplete || obligation.canCancel) && (
                <div className="form__actions">
                  {obligation.canComplete && (
                    <Form
                      route="obligations.complete"
                      routeParams={{ id: contractId, obligationId: obligation.id }}
                    >
                      {({ processing }) => (
                        <button
                          type="submit"
                          className="btn btn--primary btn--sm"
                          disabled={processing}
                        >
                          Clore
                        </button>
                      )}
                    </Form>
                  )}
                  {obligation.canCancel && (
                    <Form
                      route="obligations.cancel"
                      routeParams={{ id: contractId, obligationId: obligation.id }}
                    >
                      {({ processing }) => (
                        <button
                          type="submit"
                          className="btn btn--secondary btn--sm"
                          disabled={processing}
                        >
                          Annuler
                        </button>
                      )}
                    </Form>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {can.manageTracking && (
        <Form route="obligations.store" routeParams={{ id: contractId }} resetOnSuccess>
          {({ errors, processing }) => (
            <div className="form form--tight">
              <h3 className="round__title">Ajouter une obligation</h3>
              <Field id="obl-title" label="Intitulé" error={errors.title}>
                <input id="obl-title" name="title" className="field__input" required />
              </Field>
              <div className="form__row">
                <Field id="obl-kind" label="Nature" error={errors.kind}>
                  <select id="obl-kind" name="kind" className="field__input" defaultValue="payment">
                    {Object.entries(KIND_LABELS)
                      .filter(([value]) => value !== 'renewal_notice')
                      .map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field id="obl-due" label="Échéance" error={errors.dueOn}>
                  <input id="obl-due" name="dueOn" type="date" className="field__input" required />
                </Field>
              </div>
              <Field id="obl-assignee" label="Responsable" error={errors.assigneeId}>
                <select id="obl-assignee" name="assigneeId" className="field__input">
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </Field>
              <button type="submit" className="btn btn--secondary" disabled={processing}>
                Ajouter l’obligation
              </button>
            </div>
          )}
        </Form>
      )}
    </Section>
  )
}
