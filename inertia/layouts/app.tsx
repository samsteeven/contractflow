import Logo from '~/components/logo'
import { type ReactNode } from 'react'
import { usePage } from '@inertiajs/react'
import { Form } from '@adonisjs/inertia/react'
import FlashToasts from '~/components/flash_toasts'
import ThemeToggle from '~/components/theme_toggle'
import NavLink, { type NavItem } from '~/components/nav_link'
import { ROLE_LABELS } from '~/lib/labels'
import { CalendarClock, FileStack, FileText, GitBranch, House, LogOut, Users } from 'lucide-react'

const nav: NavItem[] = [
  { label: 'Tableau de bord', route: 'dashboard', icon: House },
  { label: 'Contrats', route: 'contracts.index', icon: FileText },
  { label: 'Échéances', route: 'deadlines.index', icon: CalendarClock },
  { label: 'Modèles', route: 'templates.index', icon: FileStack },
  { label: 'Circuits', route: 'workflows.index', icon: GitBranch },
  { label: 'Équipe', route: 'members.index', icon: Users },
]

export default function AppLayout({ children }: { children: ReactNode }) {
  const { organization, user } = usePage().props

  return (
    <>
      <header className="header header--bar">
        <div className="header__inner">
          <Logo size={24} />
          <div className="header__right">
            {organization && (
              <span className="whoami" data-testid="whoami">
                {user?.fullName ?? user?.email} · {organization.name} ·{' '}
                {ROLE_LABELS[organization.role]}
              </span>
            )}
            <ThemeToggle />
            <Form route="session.destroy">
              <button type="submit" className="btn btn--secondary btn--sm">
                <LogOut size={15} /> Déconnexion
              </button>
            </Form>
          </div>
        </div>
      </header>

      <nav className="subnav" aria-label="Navigation principale">
        <div className="subnav__inner">
          {nav.map(({ label, route, icon: Icon }) => (
            <NavLink key={label} route={route} className="subnav__item">
              {Icon && <Icon size={14} />}
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="app-main">{children}</main>
      <FlashToasts />
    </>
  )
}
