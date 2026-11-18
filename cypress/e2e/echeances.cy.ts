describe('Échéances et reconduction', () => {
  before(() => {
    cy.task('reset')
  })

  it('la page des échéances liste les obligations ouvertes, les miennes à part', () => {
    cy.login('marc')
    cy.visit('/deadlines')
    cy.get('[data-testid=deadlines]')
      .should('contain', 'Payer la facture trimestrielle')
      .and('contain', 'Recevoir le rapport de disponibilité')
      .and('contain', 'En retard')

    cy.contains('a', 'Les miennes').click()
    cy.get('[data-testid=deadlines]')
      .should('contain', 'Payer la facture trimestrielle')
      .and('not.contain', 'Recevoir le rapport de disponibilité')
  })

  it('la direction reconduit : la fin recule et une nouvelle échéance est créée', () => {
    cy.login('marc')
    cy.visit('/contracts')
    cy.contains('a', 'Hébergement et infogérance').click()
    cy.get('[data-testid=term]')
      .invoke('text')
      .then((before) => {
        cy.contains('button', 'Reconduire de 12 mois').click()
        cy.get('[data-testid=term]').invoke('text').should('not.eq', before)
      })
    cy.get('[data-testid=obligations]').should('contain', 'Close')
  })

  it('un rédacteur ne reconduit pas', () => {
    cy.login('remi')
    cy.visit('/contracts')
    cy.contains('a', 'Hébergement et infogérance').click()
    cy.get('[data-testid=term]').should('exist')
    cy.contains('button', 'Reconduire').should('not.exist')
  })
})
