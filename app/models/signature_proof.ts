import { SignatureProofSchema } from '#database/schema'

/** Preuve archivée d'une signature complète. Immuable : la base refuse UPDATE et DELETE. */
export default class SignatureProof extends SignatureProofSchema {}
