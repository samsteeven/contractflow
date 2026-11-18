const MAILPIT = 'http://127.0.0.1:8035/api/v1'

type Message = { ID: string; To: { Address: string }[]; Subject: string }

/** Le lien d'invitation, lu dans la boîte de réception de développement. */
function invitationLink(to: string) {
  return cy
    .request<{ messages: Message[] }>(`${MAILPIT}/search?query=${encodeURIComponent(`to:${to}`)}`)
    .then(({ body }) => {
      expect(body.messages, 'un e-mail d’invitation').to.have.length(1)
      return cy.request<{ Text: string }>(`${MAILPIT}/message/${body.messages[0].ID}`)
    })
    .then(({ body }) => /https?:\/\/\S+\/invitations\/\S+/.exec(body.Text)![0])
}

describe('Invitation d’un nouveau membre', () => {
  const email = 'nina.invitee@exemple.test'

  before(() => {
    cy.task('reset')
    cy.request('DELETE', `${MAILPIT}/messages`)
  })

  it('un administrateur invite, la personne crée son compte par le lien, une seule fois', () => {
    cy.login('olivia')
    cy.visit('/members')
    cy.get('#email').type(email)
    cy.get('#role').select('Lecteur')
    cy.contains('button', 'Envoyer l’invitation').click()
    cy.get('[data-testid=invitations]').should('contain', email).and('contain', 'Lecteur')

    invitationLink(email).then((link) => {
      // Sans session : la personne n'a pas encore de compte.
      cy.clearAllCookies()
      cy.clearAllSessionStorage()
      cy.visit(link)
      cy.contains('h1', 'Rejoindre Atelier Nova')
      cy.contains(email)

      cy.get('#fullName').type('Nina Invitée')
      cy.get('#password').type('un-mot-de-passe-solide')
      cy.get('#passwordConfirmation').type('un-mot-de-passe-solide')
      cy.contains('button', 'Créer mon compte et rejoindre').click()

      cy.location('pathname').should('eq', '/dashboard')
      cy.get('[data-testid=whoami]').should('contain', 'Nina Invitée').and('contain', 'Lecteur')

      // Un lecteur ne gère pas l'équipe, et le lien ne sert plus.
      cy.visit('/members')
      cy.contains('Inviter quelqu’un').should('not.exist')
      cy.visit(link)
      cy.get('[data-testid=invitation-closed]').should('contain', 'déjà été utilisée')
    })
  })

  it('un lien inconnu mène à une page introuvable', () => {
    cy.request({ url: '/invitations/jeton-inconnu', failOnStatusCode: false })
      .its('status')
      .should('eq', 404)
  })
})
