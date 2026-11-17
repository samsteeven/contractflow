import Field from '~/components/field'
import Page from '~/components/page'
import Section from '~/components/section'
import StatusBadge from '~/components/status_badge'
import AppLayout from '~/layouts/app'
import { auditLabel, formatDate, ROLE_LABELS, TYPE_LABELS } from '~/lib/labels'
import { type InertiaProps } from '~/types'
import { type Data } from '@generated/data'
import { Form, Link } from '@adonisjs/inertia/react'
import { useRef } from 'react'

type DiffLine = { kind: 'same' | 'added' | 'removed'; text: string }

type Props = InertiaProps<{
  contract: Data.Contract
  versions: Data.ContractVersion[]
  selectedVersion: number
  diff: DiffLine[] | null
  approvals: Data.Approval[]
  audit: Data.AuditLog[]
  comments: Data.Comment[]
  document: { versionId: number; sizeBytes: number } | null
  workflows: { id: number; name: string; steps: string[] }[]
  can: {
    revise: boolean
    submit: boolean
    comment: boolean
    generateDocument: boolean
    downloadDocument: boolean
    decideApprovalId: number | null
  }
}>

const DIFF_MARK = { same: ' ', added: '+', removed: '−' }
const DIFF_LABEL = { same: '', added: 'Ligne ajoutée : ', removed: 'Ligne retirée : ' }

export default function ContractsShow(props: Props) {
  const {
    contract,
    versions,
    selectedVersion,
    diff,
    approvals,
    audit,
    comments,
    document,
    workflows,
    can,
  } = props
  const latest = versions[0]
  const selected = versions.find((version) => version.number === selectedVersion) ?? latest
  const rounds = [...new Set(approvals.map((approval) => approval.round))].sort((a, b) => b - a)
  const decision = useRef<HTMLInputElement>(null)

  return (
    <Page
      title={contract.title}
      description={
        <>
          {contract.counterparty} · {TYPE_LABELS[contract.type]} ·{' '}
          <StatusBadge status={contract.status} />
        </>
      }
    >
      <div className="split">
        <div className="split__main">
          <Section
            title={`Version ${selected.number}${selected.number === latest.number ? ' (dernière)' : ''}`}
            description={`${selected.author}, ${formatDate(selected.createdAt)}${
              selected.changeNote ? ` : ${selected.changeNote}` : ''
            }`}
          >
            <nav className="filters" aria-label="Versions">
              {versions.map((version) => (
                <Link
                  key={version.id}
                  route="contracts.show"
                  routeParams={{ id: contract.id }}
                  qs={{ version: version.number }}
                  className="filter"
                  aria-current={version.number === selected.number ? 'true' : undefined}
                  preserveScroll
                >
                  v{version.number}
                </Link>
              ))}
            </nav>

            {diff ? (
              <>
                <p className="muted">
                  Comparée à la version {selected.number - 1} : lignes ajoutées (+) et retirées (−).
                </p>
                <pre className="diff" data-testid="diff">
                  {diff.map((line, index) => (
                    <span key={index} className="diff__line" data-kind={line.kind}>
                      <span aria-hidden="true">{DIFF_MARK[line.kind]} </span>
                      <span className="sr-only">{DIFF_LABEL[line.kind]}</span>
                      {line.text}
                      {'\n'}
                    </span>
                  ))}
                </pre>
              </>
            ) : (
              <pre className="diff" data-testid="body">
                {selected.body}
              </pre>
            )}
            <p className="muted mono checksum">SHA-256 {selected.checksum}</p>
          </Section>

          {can.revise && (
            <Section
              title="Réviser"
              description={
                contract.status === 'draft'
                  ? 'Chaque enregistrement crée une nouvelle version.'
                  : 'Réviser remet le contrat en brouillon : il devra être validé à nouveau.'
              }
            >
              <Form
                route="contracts.revise"
                routeParams={{ id: contract.id }}
                resetOnSuccess={['changeNote']}
              >
                {({ errors, processing }) => (
                  <div className="form">
                    <Field id="body" label="Texte" error={errors.body}>
                      <textarea
                        id="body"
                        name="body"
                        className="field__input field__input--text"
                        rows={12}
                        defaultValue={latest.body}
                        key={latest.id}
                        required
                      />
                    </Field>
                    <Field
                      id="changeNote"
                      label="Ce qui change (facultatif)"
                      error={errors.changeNote}
                    >
                      <input id="changeNote" name="changeNote" className="field__input" />
                    </Field>
                    <div className="form__actions">
                      <button type="submit" className="btn btn--secondary" disabled={processing}>
                        Enregistrer une nouvelle version
                      </button>
                    </div>
                  </div>
                )}
              </Form>
            </Section>
          )}
        </div>

        <aside className="split__side">
          {can.submit && (
            <Section title="Soumettre à validation">
              {workflows.length === 0 ? (
                <p className="muted">
                  Aucun circuit de validation.{' '}
                  <Link route="workflows.index" className="il">
                    En créer un
                  </Link>
                </p>
              ) : (
                <Form route="contracts.submit" routeParams={{ id: contract.id }}>
                  {({ errors, processing }) => (
                    <div className="form">
                      <Field id="workflowId" label="Circuit" error={errors.workflowId}>
                        <select id="workflowId" name="workflowId" className="field__input">
                          {workflows.map((workflow) => (
                            <option key={workflow.id} value={workflow.id}>
                              {workflow.name} : {workflow.steps.length} étape(s)
                            </option>
                          ))}
                        </select>
                      </Field>
                      <button
                        type="submit"
                        className="btn btn--primary btn--block"
                        disabled={processing}
                      >
                        Soumettre la version {latest.number}
                      </button>
                    </div>
                  )}
                </Form>
              )}
            </Section>
          )}

          {(can.generateDocument || can.downloadDocument) && (
            <Section title="Document PDF">
              {can.downloadDocument && document && (
                <p>
                  <a
                    href={`/contracts/${contract.id}/document`}
                    className="btn btn--secondary btn--sm"
                  >
                    Télécharger le PDF ({Math.max(1, Math.round(document.sizeBytes / 1024))} Ko)
                  </a>
                </p>
              )}
              {can.generateDocument && (
                <Form route="documents.store" routeParams={{ id: contract.id }}>
                  {({ processing }) => (
                    <button
                      type="submit"
                      className="btn btn--primary btn--block"
                      disabled={processing}
                    >
                      Archiver le PDF de la version {latest.number}
                    </button>
                  )}
                </Form>
              )}
            </Section>
          )}

          <Section title="Validation">
            {rounds.length === 0 && <p className="muted">Ce contrat n’a pas encore été soumis.</p>}
            {rounds.map((round) => (
              <div key={round} className="round">
                <h3 className="round__title">
                  Tour {round}
                  {round === contract.reviewRound ? '' : ' (clos)'}
                </h3>
                <ol className="steps" data-testid={`round-${round}`}>
                  {approvals
                    .filter((approval) => approval.round === round)
                    .map((approval) => (
                      <li key={approval.id} className="step">
                        <div className="step__head">
                          <strong>{approval.stepName}</strong>
                          <StatusBadge status={approval.status} step />
                        </div>
                        <div className="muted">
                          {ROLE_LABELS[approval.approverRole]}
                          {approval.decider &&
                            ` · ${approval.decider}, ${formatDate(approval.decidedAt)}`}
                        </div>
                        {approval.comment && (
                          <p className="step__comment">« {approval.comment} »</p>
                        )}

                        {can.decideApprovalId === approval.id && (
                          <Form
                            route="approvals.decide"
                            routeParams={{ id: contract.id, approvalId: approval.id }}
                          >
                            {({ errors, processing }) => (
                              <div className="form form--tight">
                                {/* Le bouton cliqué écrit sa décision ici juste avant l'envoi. */}
                                <input
                                  type="hidden"
                                  name="decision"
                                  defaultValue="approve"
                                  ref={decision}
                                />
                                <Field
                                  id="comment"
                                  label="Commentaire"
                                  hint="Obligatoire pour rejeter."
                                  error={errors.comment}
                                >
                                  <textarea
                                    id="comment"
                                    name="comment"
                                    className="field__input field__input--text"
                                    rows={3}
                                  />
                                </Field>
                                <div className="form__actions">
                                  <button
                                    type="submit"
                                    className="btn btn--primary btn--sm"
                                    disabled={processing}
                                    onClick={() => (decision.current!.value = 'approve')}
                                  >
                                    Valider
                                  </button>
                                  <button
                                    type="submit"
                                    className="btn btn--secondary btn--sm"
                                    disabled={processing}
                                    onClick={() => (decision.current!.value = 'reject')}
                                  >
                                    Rejeter
                                  </button>
                                </div>
                              </div>
                            )}
                          </Form>
                        )}
                      </li>
                    ))}
                </ol>
              </div>
            ))}
          </Section>

          <Section title="Commentaires">
            {can.comment && (
              <Form route="comments.store" routeParams={{ id: contract.id }} resetOnSuccess>
                {({ errors, processing }) => (
                  <div className="form form--tight">
                    <Field id="comment-body" label="Votre commentaire" error={errors.body}>
                      <textarea
                        id="comment-body"
                        name="body"
                        className="field__input field__input--text"
                        rows={3}
                        required
                      />
                    </Field>
                    <button
                      type="submit"
                      className="btn btn--secondary btn--sm"
                      disabled={processing}
                    >
                      Commenter
                    </button>
                  </div>
                )}
              </Form>
            )}
            {comments.length === 0 ? (
              <p className="muted">Aucun commentaire.</p>
            ) : (
              <ol className="journal" data-testid="comments">
                {comments.map((comment) => (
                  <li key={comment.id}>
                    <span>{comment.body}</span>
                    <span className="muted">
                      {comment.author}, {formatDate(comment.createdAt)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section title="Journal">
            <ol className="journal" data-testid="journal">
              {audit.map((entry) => (
                <li key={entry.id}>
                  <span>{auditLabel(entry.action, entry.metadata)}</span>
                  <span className="muted">
                    {entry.actor}, {formatDate(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        </aside>
      </div>
    </Page>
  )
}

ContractsShow.layout = [AppLayout]
