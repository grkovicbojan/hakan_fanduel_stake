import { Link } from "react-router-dom";
import ContentPage from "../components/ContentPage.jsx";

export default function Faq() {
  return (
    <ContentPage title="Frequently asked questions" showTopAd={false}>
      <p>
        Answers about SportBet Odds Comparator, our educational content, optional research tools,
        and how we comply with advertising program policies.
      </p>

      <h2>What is this website?</h2>
      <p>
        An independent educational publisher focused on sports market structure—how odds are
        displayed, what implied probability means, and how researchers compare prices across
        sources. We are not a sportsbook and do not accept bets.
      </p>

      <h2>Do you provide betting tips or guaranteed profits?</h2>
      <p>
        No. We do not publish picks, “locks,” parlays, or claims of risk-free profit. Guides explain
        concepts and data quality; they are not wagering advice. See our{" "}
        <Link to="/about">About</Link> page for editorial standards.
      </p>

      <h2>What are the research tools (dashboard)?</h2>
      <p>
        Optional utilities for users who operate their own lawful data collection (scraping or
        APIs). Tools show structured snapshots for monitoring—not public recommendations. Tool
        pages do not display third-party advertisements. Access via the footer link{" "}
        <Link to="/dashboard">Research tools</Link>.
      </p>

      <h2>Why do you write about gambling operators?</h2>
      <p>
        Posted prices appear on licensed operator sites; describing how those markets work is part
        of market research education. We do not endorse any operator or earn commission for
        sign-ups.
      </p>

      <h2>How do you use advertising?</h2>
      <p>
        We may show Google AdSense on informational pages (home, guides, policies). Application
        screens used only for data configuration or live tables are kept ad-free. See{" "}
        <Link to="/privacy">Privacy Policy</Link> for cookies and ad partners.
      </p>

      <h2>Who can use this content?</h2>
      <p>
        Adults interested in statistics, probability, and market mechanics. Content is not directed
        at minors. If gambling affects your wellbeing, see our{" "}
        <Link to="/guides/responsible-gambling">responsible gambling guide</Link>.
      </p>

      <h2>How often is content updated?</h2>
      <p>
        Guides and policy pages are revised when methodology or legal requirements change. Each
        article lists related material; the <Link to="/guides">guides index</Link> lists all
        long-form articles.
      </p>

      <h2>How do I contact you?</h2>
      <p>
        Email <a href="mailto:contact@weienwong.online">contact@weienwong.online</a> for content
        corrections, privacy requests, or policy questions. See <Link to="/contact">Contact</Link>.
      </p>
    </ContentPage>
  );
}
