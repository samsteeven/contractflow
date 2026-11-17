import { configApp } from '@adonisjs/eslint-config'
import { react } from '@adonisjs/eslint-config/react'

export default configApp(...react, {
  // Dans les tests, `(await Contract.findOrFail(id)).status` se lit mieux qu'une variable de plus.
  files: ['tests/**/*.ts'],
  rules: { '@unicorn/no-await-expression-member': 'off' },
})
