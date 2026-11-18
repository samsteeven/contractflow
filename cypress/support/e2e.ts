/// <reference types="cypress" />

const PASSWORD = 'contractflow-demo'

declare global {
  namespace Cypress {
    interface Chainable {
      /** Se connecte avec un compte de démonstration (olivia, adrien, lea, marc, remi, vera). */
      login(user: string): Chainable<void>
    }
  }
}

Cypress.Commands.add('login', (user: string) => {
  cy.session(
    user,
    () => {
      cy.visit('/login')
      cy.get('#email').type(`${user}@atelier-nova.test`)
      cy.get('#password').type(PASSWORD, { log: false })
      cy.contains('button', 'Se connecter').click()
      cy.location('pathname').should('eq', '/dashboard')
    },
    { cacheAcrossSpecs: false }
  )
})

export {}
