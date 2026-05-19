import { Link } from "react-router-dom";
import ContentPage from "../components/ContentPage.jsx";

export default function Home() {
  return (
    <ContentPage
      title="Sports odds comparison for research and analysis"
      hero={{
        image: "/images/hero-sports.svg",
        imageAlt: "Illustration of sports analytics and odds research",
        lead:
          "Learn how betting markets are structured, how line movements are observed, and how to compare prices across sources—without wagering on this site.",
        actions: (
          <>
            <Link to="/how-it-works" className="btn btn-primary">
              How it works
            </Link>
            <Link to="/dashboard" className="btn btn-secondary">
              Open odds dashboard
            </Link>
          </>
        )
      }}
    >
      <section className="feature-grid" aria-label="Site highlights">
        <article className="feature-card">
          <img src="/images/feature-education.svg" alt="" width={320} height={200} />
          <div className="feature-card__body">
            <h3>Educational content</h3>
            <p>
              Guides on odds formats, implied probability, and market categories—written for
              researchers, not promoters.
            </p>
          </div>
        </article>
        <article className="feature-card">
          <img src="/images/feature-dashboard.svg" alt="" width={320} height={200} />
          <div className="feature-card__body">
            <h3>Live comparison tool</h3>
            <p>
              Optional dashboard to monitor structured odds snapshots from your own data
              workflows.
            </p>
          </div>
        </article>
        <article className="feature-card">
          <img src="/images/feature-responsible.svg" alt="" width={320} height={200} />
          <div className="feature-card__body">
            <h3>Responsible use</h3>
            <p>
              We do not accept bets or process wagering payments. Use regulated operators only
              where legal.
            </p>
          </div>
        </article>
      </section>

      <p>
        SportBet Odds Comparator is an informational website that explains how sports betting
        markets are structured and how line movements can be observed across different data
        sources. Our goal is to help readers understand comparison methodology, market
        terminology, and the factors that influence posted prices—not to encourage wagering or
        guarantee outcomes.
      </p>

      <h2>What you will find on this site</h2>
      <p>
        We publish educational material about odds formats, implied probability, and how
        operators publish prices for player and team markets. Separately, we provide an optional
        odds dashboard for users who already collect data through their own workflows. The
        dashboard is a monitoring tool; it is not a substitute for licensed financial or legal
        advice in your jurisdiction.
      </p>

      <h2>Educational focus</h2>
      <p>
        Sportsbooks display prices that reflect supply, demand, injury news, and market sentiment.
        When two sources show different numbers for a similar market, the gap is often expressed
        as a percentage difference. Learning to read that difference carefully—while accounting
        for market type, timing, and limits—is a core skill for quantitative sports research.
        Our <Link to="/how-it-works">How it works</Link> page walks through these concepts in
        plain language.
      </p>

      <h2>Responsible use</h2>
      <p>
        Gambling involves financial risk and may be illegal where you live. This website does not
        accept bets, process payments for wagering, or operate as a bookmaker. If you choose to
        engage with regulated operators, do so only where permitted by law and within personal
        limits. If you need support, contact organizations such as{" "}
        <a href="https://www.begambleaware.org/" target="_blank" rel="noopener noreferrer">
          BeGambleAware
        </a>{" "}
        or equivalent services in your country.
      </p>

      <h2>Explore the site</h2>
      <ul>
        <li>
          <Link to="/how-it-works">How it works</Link> — methodology and glossary
        </li>
        <li>
          <Link to="/about">About</Link> — mission and editorial standards
        </li>
        <li>
          <Link to="/dashboard">Odds dashboard</Link> — live comparison tool (no ads on tool pages)
        </li>
        <li>
          <Link to="/privacy">Privacy Policy</Link> — how we handle data
        </li>
        <li>
          <Link to="/contact">Contact</Link> — questions and feedback
        </li>
      </ul>

      <p className="muted small">
        Last updated:{" "}
        {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </p>
    </ContentPage>
  );
}
