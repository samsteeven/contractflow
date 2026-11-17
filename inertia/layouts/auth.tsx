import Logo from '~/components/logo'
import { type ReactNode } from 'react'
import FlashToasts from '~/components/flash_toasts'
import ThemeToggle from '~/components/theme_toggle'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="auth">
        <main className="auth__form-col">
          <Logo size={24} />
          <div className="auth__form-wrap">{children}</div>
          <div style={{ height: 20 }} />
        </main>

        <aside className="auth__aside">
          <div className="auth__aside-top">
            <ThemeToggle />
          </div>

          <p className="auth__quote">
            Chaque contrat suit son circuit : rédigé, relu, validé étape par étape, et tracé.
          </p>

          <div>
            <div className="pitch__t">Une version validée ne change plus</div>
            <p className="pitch__p">
              Modifier un contrat crée une nouvelle version. Une approbation vaut pour le texte
              exact qui a été relu, pas pour les suivants.
            </p>
          </div>
        </aside>
      </div>
      <FlashToasts />
    </>
  )
}
