import { Link } from "react-router-dom";
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

      <h2>Who this site is for</h2>
      <p>
        Readers learning how sports markets are quoted, students of probability and statistics,
        and analysts building private datasets may find our guides useful. We do not target
        casual bettors seeking picks. If you are new, start with the{" "}
        <Link to="/guides/odds-formats">odds formats guide</Link> and{" "}
        <Link to="/guides/implied-probability">implied probability article</Link>.
      </p>

      <h2>Content updates</h2>
      <p>
        We add and revise articles when methodology changes. The{" "}
        <Link to="/guides">guides section</Link> is the primary home for long-form material;
        shorter summaries appear on <Link to="/how-it-works">How it works</Link>. Tool pages
        (dashboard, settings, alerts) document behavior but are not substitutes for editorial
        content.
      </p>

      <h2>Technology</h2>
      <p>
        The optional dashboard aggregates structured odds data that users supply through their
        own scraping or API integrations. Displayed values are snapshots in time; stale data can
        mislead if used without refresh intervals. Always verify critical figures at the source
        before making decisions.
      </p>

      <h2>Site structure</h2>
      <p>
        Public reading material lives on the home page, <Link to="/guides">guides</Link>,{" "}
        <Link to="/glossary">glossary</Link>, <Link to="/faq">FAQ</Link>, and policy pages.
        Optional <Link to="/dashboard">research tools</Link> are linked from the footer for
        advanced users and are excluded from search indexing.
      </p>

      <h2>Advertising</h2>
      <p>
        We may show Google AdSense on informational pages only. Tool screens have no display ads.
        See our <a href="/privacy">Privacy Policy</a> for cookies and ad partners.
      </p>
    </ContentPage>
  );
}
