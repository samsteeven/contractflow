/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| Pas d'API REST séparée : chaque route rend une page Inertia ou traite un
| formulaire puis redirige. Les routes métier passent par `organization`,
| qui établit l'organisation courante et le rôle de l'utilisateur.
|
*/

import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'

router.on('/').renderInertia('home', {}).as('home')

router
  .group(() => {
    router.get('signup', [controllers.NewAccount, 'create'])
    router.post('signup', [controllers.NewAccount, 'store'])

    router.get('login', [controllers.Session, 'create'])
    router.post('login', [controllers.Session, 'store'])
  })
  .use(middleware.guest())

/*
| Hors session : le webhook du prestataire (authentifié par la signature HMAC du corps)
| et la page de signature du bac à sable (adresse à identifiant aléatoire).
*/
router.post('webhooks/signature', [controllers.Webhooks, 'signature']).as('webhooks.signature')
router.get('sandbox/sign/:signerId', [controllers.Sandbox, 'show']).as('sandbox.show')
router.post('sandbox/sign/:signerId', [controllers.Sandbox, 'decide']).as('sandbox.decide')

router.post('logout', [controllers.Session, 'destroy']).use(middleware.auth())

router
  .group(() => {
    router.get('dashboard', [controllers.Dashboard, 'show']).as('dashboard')

    router.get('contracts', [controllers.Contracts, 'index']).as('contracts.index')
    router.get('contracts/new', [controllers.Contracts, 'create']).as('contracts.create')
    router.post('contracts', [controllers.Contracts, 'store']).as('contracts.store')
    router.get('contracts/:id', [controllers.Contracts, 'show']).as('contracts.show')
    router.post('contracts/:id/versions', [controllers.Contracts, 'revise']).as('contracts.revise')
    router
      .post('contracts/:id/submissions', [controllers.Contracts, 'submit'])
      .as('contracts.submit')
    router
      .post('contracts/:id/approvals/:approvalId/decision', [controllers.Approvals, 'decide'])
      .as('approvals.decide')

    router.post('contracts/:id/comments', [controllers.Comments, 'store']).as('comments.store')
    router.post('contracts/:id/document', [controllers.Documents, 'store']).as('documents.store')
    router.get('contracts/:id/document', [controllers.Documents, 'show']).as('documents.show')

    router.post('contracts/:id/signature', [controllers.Signatures, 'store']).as('signatures.store')
    router
      .post('contracts/:id/signature/cancel', [controllers.Signatures, 'cancel'])
      .as('signatures.cancel')
    router
      .get('contracts/:id/signature/proof', [controllers.Signatures, 'proof'])
      .as('signatures.proof')

    router.get('templates', [controllers.Templates, 'index']).as('templates.index')
    router.get('templates/new', [controllers.Templates, 'create']).as('templates.create')
    router.post('templates', [controllers.Templates, 'store']).as('templates.store')

    router.get('workflows', [controllers.Workflows, 'index']).as('workflows.index')
    router.post('workflows', [controllers.Workflows, 'store']).as('workflows.store')

    router.get('members', [controllers.Members, 'index']).as('members.index')
    router.post('members', [controllers.Members, 'store']).as('members.store')
  })
  .where('id', router.matchers.number())
  .where('approvalId', router.matchers.number())
  .use([middleware.auth(), middleware.organization()])
