describe('Pièces jointes et antivirus', () => {
  before(() => {
    cy.task('reset')
  })

  const upload = (contents: Cypress.FileReferenceObject['contents'], fileName: string) => {
    cy.get('#attachment-file').selectFile({ contents, fileName }, { force: true })
    cy.contains('button', 'Envoyer').click()
  }

  beforeEach(() => {
    cy.login('remi')
    cy.visit('/contracts')
    cy.contains('a', 'Partenariat de distribution').click()
  })

  it('un PDF sain est analysé puis listé', () => {
    upload(Cypress.Buffer.from('%PDF-1.4\nannexe de test\n%%EOF'), 'annexe.pdf')

    cy.get('[data-testid=attachments]', { timeout: 20000 }).should('contain', 'annexe.pdf')
  })

  it('un .docx contenant un virus est refusé et rien n’est listé', () => {
    cy.task<string>('docx', true).then((base64) => {
      upload(Cypress.Buffer.from(base64, 'base64'), 'contrat.docx')
    })

    cy.contains('programme malveillant', { timeout: 20000 })
    cy.get('[data-testid=attachments]').should('not.contain', 'contrat.docx')
  })

  it('un vrai .docx sain passe, un exécutable déguisé est refusé', () => {
    cy.task<string>('docx', false).then((base64) => {
      upload(Cypress.Buffer.from(base64, 'base64'), 'propre.docx')
    })
    cy.get('[data-testid=attachments]', { timeout: 20000 }).should('contain', 'propre.docx')

    upload(Cypress.Buffer.from('MZ\u0090\u0000programme'), 'faux.pdf')
    cy.contains('Type de fichier refusé', { timeout: 20000 })
    cy.get('[data-testid=attachments]').should('not.contain', 'faux.pdf')
  })

  it('le fichier se télécharge par une adresse temporaire', () => {
    cy.get('[data-testid=attachments] a')
      .first()
      .invoke('attr', 'href')
      .then((href) => {
        cy.request({ url: href!, followRedirect: false }).then((response) => {
          expect(response.status).to.eq(302)
          expect(response.redirectedToUrl ?? response.headers.location).to.match(/signature=/i)
        })
      })
  })
})
