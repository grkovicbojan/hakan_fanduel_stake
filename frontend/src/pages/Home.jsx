import { Link } from "react-router-dom";
import ContentPage from "../components/ContentPage.jsx";
import JsonLd from "../components/JsonLd.jsx";
import { GUIDES } from "../content/guides.js";
import { DEFAULT_PROJECT_SLUG } from "../lib/auth.jsx";

const FEATURED_SLUGS = [
  "odds-formats",
  "implied-probability",
  "moneyline-and-spreads",
  "responsible-gambling"
];

export default function Home() {
  const featured = FEATURED_SLUGS.map((slug) => GUIDES.find((g) => g.slug === slug)).filter(Boolean);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "SportBet Odds Comparator",
          url: "https://weienwong.online/",
          description:
            "Educational guides on sports market structure, odds formats, and research methodology.",
          publisher: {
            "@type": "Organization",
            name: "SportBet Odds Comparator",
            url: "https://weienwong.online/"
          }
        }}
      />
      <ContentPage
        title="Sports market research and odds education"
        showTopAd
        hero={{
          image: "/images/feature-education.svg",
          imageAlt: "Educational guides on sports market research",
          lead:
            "Independent articles on how posted prices work, how to read odds formats, and how to evaluate data quality—written for students of probability and market structure, not for wagering on this site.",
          actions: (
            <>
              <Link to="/guides" className="btn btn-primary">
                Browse all guides
              </Link>
              <Link to="/glossary" className="btn btn-secondary">
                Glossary
              </Link>
            </>
          )
        }}
      >
        <section className="featured-guides" aria-labelledby="featured-heading">
          <h2 id="featured-heading">Featured articles</h2>
          <ul className="guide-list">
            {featured.map((guide) => (
              <li key={guide.slug} className="guide-card">
                <h3>
                  <Link to={guide.path}>{guide.title}</Link>
                </h3>
                <p>{guide.summary}</p>
                <p className="muted small">
                  ~{guide.readMinutes} min read · <Link to={guide.path}>Read article</Link>
                </p>
              </li>
            ))}
          </ul>
          <p>
            <Link to="/guides">View all {GUIDES.length} guides</Link> ·{" "}
            <Link to="/faq">FAQ</Link>
          </p>
        </section>

        <h2>Who this site is for</h2>
        <p>
          Readers learning statistics and market mechanics: how sportsbooks quote prices, why
          implied probabilities exceed 100%, and how to compare sources without fooling yourself
          with stale or mismatched data. We publish original explanations—not affiliate funnels or
          pick-selling services.
        </p>

        <h2>What we publish</h2>
        <ul>
          <li>
            <Link to="/guides">Research guides</Link> — long-form tutorials (odds formats, vig,
            player props, ethics, line movement)
          </li>
          <li>
            <Link to="/glossary">Glossary</Link> — definitions of common terms
          </li>
          <li>
            <Link to="/how-it-works">How it works</Link> — comparison methodology overview
          </li>
          <li>
            <Link to="/about">About</Link> — editorial standards and mission
          </li>
        </ul>

        <h2>What we do not do</h2>
        <ul>
          <li>Accept bets or process wagering payments</li>
          <li>Sell picks, parlays, or guaranteed-profit systems</li>
          <li>Promote sign-ups at gambling operators for commission</li>
        </ul>

        <h2>Get started with your team</h2>
        <p>
          Create a free project workspace at{" "}
          <Link to={`/p/${DEFAULT_PROJECT_SLUG}/auth`}>/p/{DEFAULT_PROJECT_SLUG}/auth</Link> to invite
          collaborators and use the optional research tools.
        </p>

        <h2>Optional research tools</h2>
        <p>
          A separate <Link to="/dashboard">data monitoring area</Link> exists for users who run
          their own configured pipelines. It is not the main purpose of this site, does not carry
          display advertisements, and is not required to read our articles.
        </p>

        <h2>Responsible use</h2>
        <p>
          Gambling involves financial risk and may be illegal where you live. If you need help,
          see our{" "}
          <Link to="/guides/responsible-gambling">responsible gambling guide</Link> and resources
          such as{" "}
          <a href="https://www.begambleaware.org/" target="_blank" rel="noopener noreferrer">
            BeGambleAware
          </a>
          .
        </p>

        <p className="muted small">
          Last reviewed:{" "}
          {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </p>
      </ContentPage>
    </>
  );
}
