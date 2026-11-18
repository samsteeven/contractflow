import vine from '@vinejs/vine'

/**
 * Shared rules for email and password.
 */
const email = () => vine.string().email().maxLength(254)
const password = () => vine.string().minLength(10).maxLength(200)

/**
 * Validator to use when performing self-signup.
 *
 * The "passwordConfirmation" field is declared explicitly, so that it is part
 * of the request body type shared with the frontend. Otherwise the signup form
 * has no way to know about the errors reported for this field.
 */
export const signupValidator = vine.create({
  fullName: vine.string().trim().maxLength(200).nullable(),
  organizationName: vine.string().trim().minLength(2).maxLength(200),
  email: email().unique({ table: 'users', column: 'email' }),
  password: password(),
  passwordConfirmation: password().sameAs('password'),
})

/**
 * Validator to use before validating user credentials
 * during login
 */
export const loginValidator = vine.create({
  email: email(),
  password: vine.string(),
})

/**
 * Acceptation d'une invitation. L'adresse vient de l'invitation, jamais du formulaire.
 * Le mot de passe n'est demandé que si l'adresse n'a pas encore de compte.
 */
export const acceptInvitationValidator = vine.create({
  fullName: vine.string().trim().maxLength(200).nullable().optional(),
  password: password().optional(),
  passwordConfirmation: password().sameAs('password').optional(),
})
