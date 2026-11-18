/**
 * Cypress retire la politique de contenu et l'interdiction d'intégration des pages qu'il
 * affiche : ces en-têtes se vérifient donc par des requêtes directes, pas par l'interface.
 */
describe('Sécurité du navigateur', () => {
  before(() => {
    cy.task('reset')
  })

  it('chaque page envoie une politique de contenu avec un jeton par réponse', () => {
    cy.request('/login').then((first) => {
      const policy = first.headers['content-security-policy'] as string
      expect(policy).to.contain("default-src 'self'")
      expect(policy).to.match(/script-src 'self' 'nonce-[^']+'/)
      expect(policy).to.not.contain('unsafe-eval')
      expect(policy).to.contain("frame-ancestors 'none'")
      expect(first.headers['referrer-policy']).to.eq('same-origin')
      expect(first.headers['x-content-type-options']).to.eq('nosniff')

      const nonce = /'nonce-([^']+)'/.exec(policy)![1]
      for (const [, attributes] of first.body.matchAll(/<script\b([^>]*)>/g)) {
        if (!attributes.includes('application/json')) expect(attributes).to.contain(nonce)
      }
      cy.request('/login').then((second) => {
        expect(second.headers['content-security-policy']).to.not.contain(nonce)
      })
    })
  })

  it('une requête qui modifie sans jeton CSRF est refusée', () => {
    cy.request({
      method: 'POST',
      url: '/invitations',
      form: true,
      body: { email: 'pirate@exemple.test', role: 'admin' },
      failOnStatusCode: false,
      followRedirect: false,
    })
      .its('status')
      .should('not.eq', 200)
    cy.login('olivia')
    cy.visit('/members')
    cy.get('[data-testid=invitations]').should('not.exist')
  })

  it('une page protégée renvoie à la connexion', () => {
    cy.visit('/contracts')
    cy.location('pathname').should('eq', '/login')
  })

  it('un titre piégé s’affiche comme du texte, il ne s’exécute pas', () => {
    const title = '<img src=x onerror="window.__xss=1">'
    cy.login('remi')
    cy.visit('/contracts/new')
    cy.get('#title').type(title, { parseSpecialCharSequences: false })
    cy.get('#counterparty').type('Zeta')
    cy.get('#body').type('Article 1 - Objet\nTexte.')
    cy.contains('button', 'Créer le brouillon').click()

    cy.contains('h1', title)
    cy.get('h1 img').should('not.exist')
    cy.window().its('__xss').should('not.exist')
  })
})
