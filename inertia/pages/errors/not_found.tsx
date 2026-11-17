import MarketingLayout from '~/layouts/marketing'

export default function NotFound() {
  return (
    <div className="home">
      <article className="prose-card">
        <div className="pc-top">
          <span className="pc-status mono tag" style={{ color: 'var(--subtle)' }}>
            <span className="dot" /> 404
          </span>
        </div>
        <div className="pc-lead">
          <span>Page introuvable.</span>
          <em>Cette adresse ne mène nulle part.</em>
        </div>
        <p className="pc-para">
          La page demandée n&apos;existe pas, ou elle appartient à une autre organisation.
        </p>
      </article>
    </div>
  )
}

NotFound.layout = [MarketingLayout]
