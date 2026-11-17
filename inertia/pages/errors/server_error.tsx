import MarketingLayout from '~/layouts/marketing'

export default function ServerError() {
  return (
    <div className="home">
      <article className="prose-card">
        <div className="pc-top">
          <span className="pc-status mono tag" style={{ color: '#c0392b' }}>
            <span className="dot" /> 500
          </span>
        </div>
        <div className="pc-lead">
          <span>Une erreur est survenue.</span>
          <em>Le serveur a rencontré une erreur inattendue.</em>
        </div>
        <p className="pc-para">Réessayez dans un instant.</p>
      </article>
    </div>
  )
}

ServerError.layout = [MarketingLayout]
