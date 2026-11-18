describe('Du brouillon à l’approbation', () => {
  before(() => {
    cy.task('reset')
  })

  it('un rédacteur crée et soumet, la juriste puis la direction valident', () => {
    const title = 'Contrat de test e2e'

    cy.login('remi')
    cy.visit('/contracts/new')
    cy.get('#title').type(title)
    cy.get('#counterparty').type('Delta Services')
    cy.get('#body').type('Article 1 - Objet\nLe prestataire livre une prestation de test.')
    cy.contains('button', 'Créer le brouillon').click()
    cy.contains('h1', title)
    cy.contains('Brouillon')

    cy.get('#workflowId').select('Juridique puis direction : 2 étape(s)')
    cy.contains('button', 'Soumettre la version 1').click()
    cy.contains('En validation')

    // Un rédacteur ne valide pas son propre texte : aucune décision possible pour lui.
    cy.contains('button', 'Valider').should('not.exist')

    cy.login('lea')
    cy.visit('/dashboard')
    cy.get('[data-testid=waiting]').contains(title).click()
    cy.get('#comment').type('Clauses conformes.')
    cy.contains('button', 'Valider').click()

    // La direction n'a pas encore la main tant que le juridique n'a pas décidé : c'est fait.
    cy.login('marc')
    cy.visit('/dashboard')
    cy.get('[data-testid=waiting]').contains(title).click()
    cy.contains('button', 'Valider').click()

    cy.contains('Approuvé')
    cy.get('[data-testid=journal]').should('contain', 'Contrat approuvé')
  })

  it('un rejet exige un motif', () => {
    cy.login('remi')
    cy.visit('/contracts/new')
    cy.get('#title').type('Contrat à rejeter')
    cy.get('#counterparty').type('Epsilon')
    cy.get('#body').type('Article 1 - Objet\nTexte à rejeter.')
    cy.contains('button', 'Créer le brouillon').click()
    cy.get('#workflowId').select('Juridique puis direction : 2 étape(s)')
    cy.contains('button', 'Soumettre la version 1').click()

    cy.login('lea')
    cy.visit('/dashboard')
    cy.get('[data-testid=waiting]').contains('Contrat à rejeter').click()
    cy.contains('button', 'Rejeter').click()
    cy.contains('Un rejet doit être motivé', { matchCase: false })

    cy.get('#comment').type('Durée trop courte.')
    cy.contains('button', 'Rejeter').click()
    cy.contains('Rejeté')
  })
})
