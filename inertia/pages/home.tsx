import MarketingLayout from '~/layouts/marketing'
import { Head } from '@inertiajs/react'

const points = [
  [
    'Circuits configurables',
    'Une suite d’étapes confiées à des rôles : juridique, direction, propriétaire.',
  ],
  [
    'Versions immuables',
    'Chaque modification crée une version ; on compare deux versions ligne à ligne.',
  ],
  [
    'Règles tenues par la base',
    'Une étape ne se décide qu’à son tour, une seule fois, par le bon rôle.',
  ],
  ['Journal complet', 'Création, révision, soumission, décision : qui, quand, sur quelle version.'],
]

export default function Home() {
  return (
    <div className="home">
      <Head title="Accueil" />
      <article className="prose-card">
        <h1 className="pc-lead">Créer, faire valider et suivre ses contrats.</h1>
        <p className="pc-para">
          ContractFlow centralise les contrats d’une entreprise et leur fait suivre un circuit de
          validation : chaque approbateur intervient à son étape, sur un texte qui ne change plus.
        </p>
        <ul className="links">
          {points.map(([title, description]) => (
            <li key={title} className="lrow">
              <span className="lrow__bullet" />
              <span className="lrow__title">{title}</span>
              <span className="lrow__desc">{description}</span>
            </li>
          ))}
        </ul>
      </article>
    </div>
  )
}

Home.layout = [MarketingLayout]
