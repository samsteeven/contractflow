import { Link } from '@adonisjs/inertia/react'
import { FileCheck2 } from 'lucide-react'

export default function Logo({ size = 26 }: { size?: number }) {
  return (
    <Link route="home" className="logo" aria-label="ContractFlow, accueil">
      <FileCheck2 size={size} strokeWidth={1.8} aria-hidden="true" />
      <span className="logo__name">ContractFlow</span>
    </Link>
  )
}
