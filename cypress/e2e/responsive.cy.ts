/**
 * Aucune page ne doit élargir l'écran d'un téléphone : un défilement horizontal de la page
 * entière rend le texte minuscule et les boutons hors d'atteinte. (Les tableaux ont leur propre
 * défilement, dans leur cadre.)
 */
const PAGES = [
  '/dashboard',
  '/contracts',
  '/contracts/new',
  '/deadlines',
  '/templates',
  '/workflows',
  '/members',
]

describe('Affichage sur téléphone', () => {
  before(() => {
    cy.task('reset')
  })

  beforeEach(() => {
    cy.viewport(375, 812)
    cy.login('olivia')
  })

  for (const page of PAGES) {
    it(`${page} tient dans la largeur de l'écran`, () => {
      cy.visit(page)
      cy.get('main').should('be.visible')
      cy.document().then((doc) => {
        expect(doc.documentElement.scrollWidth, 'largeur du contenu').to.be.at.most(375)
      })
    })
  }

  it('un contrat signé tient dans la largeur de l’écran', () => {
    cy.visit('/contracts')
    cy.contains('a', 'Hébergement et infogérance').click()
    cy.get('[data-testid=obligations]').should('be.visible')
    cy.document().then((doc) => {
      expect(doc.documentElement.scrollWidth).to.be.at.most(375)
    })
  })

  it('la navigation défile dans son cadre et reste atteignable', () => {
    cy.visit('/dashboard')
    cy.contains('a.subnav__item', 'Équipe').scrollIntoView().should('be.visible').click()
    cy.location('pathname').should('eq', '/members')
  })
})
