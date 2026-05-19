import ContentPage from "../components/ContentPage.jsx";

export default function About() {
  return (
    <ContentPage title="About SportBet Odds Comparator">
      <figure className="content-figure">
        <img src="/images/feature-education.svg" alt="Educational content illustration" width={320} height={200} />
      </figure>

      <p>
        SportBet Odds Comparator was created to document and explain sports market pricing from a
        research perspective. We focus on clarity: what odds represent, how timestamps matter,
        and why automated comparisons must be interpreted with context.
      </p>

      <h2>Our mission</h2>
      <p>
        We aim to publish useful, original explanations for readers interested in sports
        analytics—not promotional content designed to drive sign-ups at gambling operators.
        Where we reference third-party brands or data sources, we do so descriptively to explain
        how information is obtained, not to endorse any service.
      </p>

      <h2>Editorial standards</h2>
      <ul>
        <li>Articles prioritize accuracy, neutral tone, and definitional clarity.</li>
        <li>We distinguish educational pages from operational tools (dashboard, settings).</li>
        <li>We do not publish “sure win” tips, fixed picks, or guaranteed profit claims.</li>
        <li>We update pages when methodology or legal requirements change.</li>
      </ul>

      <h2>Technology</h2>
      <p>
        The optional dashboard aggregates structured odds data that users supply through their
        own scraping or API integrations. Displayed values are snapshots in time; stale data can
        mislead if used without refresh intervals. Always verify critical figures at the source
        before making decisions.
      </p>

      <h2>Advertising</h2>
      <p>
        We may show Google AdSense advertisements on informational pages only. Application
        screens used for alerts, configuration, or live data tables are kept free of display ads
        to comply with program policies. See our <a href="/privacy">Privacy Policy</a> for
        details on cookies and ad partners.
      </p>
    </ContentPage>
  );
}
