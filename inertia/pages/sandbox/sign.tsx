import FlashToasts from '~/components/flash_toasts'
import Logo from '~/components/logo'
import Page from '~/components/page'
import Section from '~/components/section'
import { type InertiaProps } from '~/types'
import { Form } from '@adonisjs/inertia/react'

type Props = InertiaProps<{
  signerId: string
  signer: { name: string; status: 'pending' | 'signed' | 'declined' }
  requestStatus: 'pending' | 'completed' | 'declined' | 'cancelled'
  contract: { title: string; counterparty: string }
  version: { number: number; body: string; checksum: string }
}>

const SIGNER_LABEL = {
  pending: 'En attente de votre signature',
  signed: 'Vous avez signé',
  declined: 'Vous avez refusé de signer',
}

/**
 * Page de signature du bac à sable : elle imite celle d'un prestataire extérieur. Elle ne sert
 * qu'à exercer le circuit complet (événement signé, webhook) sans compte chez un prestataire.
 */
export default function SandboxSign({ signerId, signer, requestStatus, contract, version }: Props) {
  const open = requestStatus === 'pending' && signer.status === 'pending'

  return (
    <>
      <header className="header header--bar">
        <div className="header__inner">
          <Logo size={24} />
          <span className="muted">Bac à sable de signature : aucune valeur juridique</span>
        </div>
      </header>
      <main className="app-main">
        <Page
          title={contract.title}
          description={`${signer.name}, vous êtes invité(e) à signer ce contrat avec ${contract.counterparty}.`}
        >
          <Section title={`Texte de la version ${version.number}`}>
            <pre className="diff" data-testid="body">
              {version.body}
            </pre>
            <p className="muted mono checksum">SHA-256 {version.checksum}</p>
          </Section>

          <Section title="Votre décision">
            <p data-testid="signer-status">
              {open
                ? SIGNER_LABEL.pending
                : requestStatus !== 'pending' && signer.status === 'pending'
                  ? 'Cette demande n’est plus ouverte.'
                  : SIGNER_LABEL[signer.status]}
            </p>
            {open && (
              <Form route="sandbox.decide" routeParams={{ signerId }}>
                {({ processing }) => (
                  <div className="form__actions">
                    <button
                      type="submit"
                      name="decision"
                      value="sign"
                      className="btn btn--primary"
                      disabled={processing}
                    >
                      Signer
                    </button>
                    <button
                      type="submit"
                      name="decision"
                      value="decline"
                      className="btn btn--secondary"
                      disabled={processing}
                    >
                      Refuser
                    </button>
                  </div>
                )}
              </Form>
            )}
          </Section>
        </Page>
      </main>
      <FlashToasts />
    </>
  )
}
