export function RecommendationCard({ recommendation, recommendationStatus = 'local', scoreLabel = 'readiness', session }) {
  const readinessBand = getReadinessBand(recommendation.score)
  const sections = indexSections(recommendation.reportSections)
  const concerns = sections['main-concerns']
  const pain = sections['pain-guidance']

  return (
    <aside className={`recommendation recommendation-report checkin-report ${recommendation.tone} ${readinessBand}`}>
      <ReportSource session={session} status={recommendationStatus} />
      <header className="checkin-report-hero">
        <div className={`score-ring ${readinessBand}`} style={{ '--score': `${recommendation.score}%` }}>
          <span>{recommendation.score}</span><small>{scoreLabel}</small>
        </div>
        <div><p className="report-kicker">Your event outlook</p><h2>{recommendation.label}</h2><p>{recommendation.summary}</p></div>
      </header>

      <div className="report-section-grid">
        {concerns && <ReportSection section={concerns} tone="concern" />}
        <ReportSection section={sections['event-demand']} />
        <ReportSection section={sections['personalized-warm-up']} />
        <ReportSection section={sections['fuel-hydration']} />
        {pain && <ReportSection section={pain} tone="pain" />}
      </div>
      {sections['motivational-quote'] && <QuoteSection section={sections['motivational-quote']} />}
    </aside>
  )
}

export function RecoveryPlanCard({ recommendation, recommendationStatus = 'local', session }) {
  const sections = indexSections(recommendation.reportSections)
  const orderedIds = ['event-summary', 'planned-vs-actual', 'workload-summary', 'body-response', 'session-quality', 'recovery-demand', 'immediate-priorities', 'next-event-impact']

  return (
    <aside className={`recommendation recommendation-report checkout-report ${recommendation.tone}`}>
      <ReportSource session={session} status={recommendationStatus} />
      <header className="checkout-report-hero">
        <p className="report-kicker">Checkout complete</p>
        <h2>{recommendation.label}</h2>
        <p>{recommendation.summary}</p>
      </header>
      <div className="report-section-grid checkout-section-grid">
        {orderedIds.map((id) => sections[id] ? <ReportSection key={id} section={sections[id]} tone={id === 'immediate-priorities' ? 'priority' : ''} /> : null)}
      </div>
    </aside>
  )
}

function ReportSource({ session, status }) {
  const statusLabel = { ai: 'AI personalized', loading: 'Generating', local: 'Saved' }[status] ?? 'AI personalized'
  return <div className="recommendation-source"><p className="eyebrow">{session}</p><span>{statusLabel}</span></div>
}

function ReportSection({ section, tone = '' }) {
  if (!section || (!section.summary && !section.items?.length)) return null
  return <section className={`report-section ${tone}`}>
    <div className="report-section-heading"><span aria-hidden="true">{getSectionIcon(section.id)}</span><strong>{section.title}</strong></div>
    {section.summary && <p>{section.summary}</p>}
    {section.items?.length > 0 && <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}
    {section.id === 'personalized-warm-up' && section.items?.length > 1 && <details className="warmup-details"><summary>View warm-up focus</summary><p>Use these priorities inside your normal progressive warm-up. Keep every movement comfortable and controlled.</p></details>}
  </section>
}

function QuoteSection({ section }) {
  const quote = section.summary || section.items?.[0]
  if (!quote) return null
  return <blockquote className="motivation-quote"><span>“</span><p>{quote.replace(/^[“"]|[”"]$/g, '')}</p></blockquote>
}

function indexSections(sections = []) {
  return Object.fromEntries(sections.filter((section) => section?.id).map((section) => [section.id, section]))
}

function getSectionIcon(id) {
  return ({
    'main-concerns': '!', 'event-demand': '↗', 'personalized-warm-up': '◌', 'fuel-hydration': '◇', 'pain-guidance': '+',
    'event-summary': '✓', 'planned-vs-actual': '↔', 'workload-summary': '∿', 'body-response': '◉', 'session-quality': '★',
    'recovery-demand': '◒', 'immediate-priorities': '→', 'next-event-impact': '›',
  })[id] ?? '•'
}

function getReadinessBand(score) {
  if (Number(score) >= 80) return 'readiness-green'
  if (Number(score) >= 60) return 'readiness-yellow'
  return 'readiness-red'
}
