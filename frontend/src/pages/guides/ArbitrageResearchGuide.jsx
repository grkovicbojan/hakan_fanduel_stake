import GuideLayout from "../../components/GuideLayout.jsx";

export default function ArbitrageResearchGuide() {
  return (
    <GuideLayout slug="arbitrage-research">
      <p>
        Automated dashboards sometimes highlight a “percentage gap” between two posted prices.
        That number describes a snapshot; it is not a promise that risk-free profit exists.
        Serious researchers treat arbitrage metrics as diagnostics, not trading signals.
      </p>

      <h2>What the percentage usually measures</h2>
      <p>
        A common approach compares decimal-implied values: if comparison decimal is higher than
        baseline for the same defined market, the gap may be expressed as a percent above
        baseline. This is descriptive statistics on scraped data—not accounting for fees, taxes,
        currency, or execution risk.
      </p>

      <h2>Stale or mismatched timestamps</h2>
      <p>
        If baseline was captured at 12:00 and comparison at 12:08, news may have moved one book
        first. The gap reflects latency, not opportunity. Good pipelines store per-side timestamps
        and discard pairs older than a threshold (e.g. five minutes apart).
      </p>

      <h2>Category and market definition</h2>
      <p>
        Player props are especially error-prone: “Points 22.5 over” on one book may differ from
        “23.5” on another, or include different void rules for DNPs. Team totals vs game totals,
        alternate lines, and live vs pregame markets must match exactly. Mislabeled categories
        inflate arbitrage percentages without real overlap.
      </p>

      <h2>Limits, account rules, and palp</h2>
      <p>
        Even when a theoretical gap exists, books limit stake sizes on props and correlated
        markets. Winning arbitrage-style bettors may face account restrictions. Some books void or
        adjust lines posted in error (“palpable error” clauses). None of this appears in a simple
        percentage column.
      </p>

      <h2>Fees, exchange commission, and slippage</h2>
      <p>
        Betting exchanges charge commission on net winnings. Traditional books build margin into
        odds. Moving money between platforms has friction. Live betting introduces slippage between
        click and acceptance. Model these costs before treating any gap as economic edge.
      </p>

      <h2>Legal and terms-of-service constraints</h2>
      <p>
        Scraping or API use may be restricted by operator terms. Automated comparison for
        personal research may be permitted where you have rights to the data; redistribution or
        circumvention of geo-blocks may not be. Comply with law in your jurisdiction.
      </p>

      <h2>How we recommend using comparison tools</h2>
      <ul>
        <li>Filter by freshness and matching category strings.</li>
        <li>Manually verify any large gap at both sources before drawing conclusions.</li>
        <li>Log void rules and market suspension behavior separately.</li>
        <li>Never present percentage gaps as “guaranteed profit” on public pages.</li>
      </ul>

      <p>
        Our optional dashboard is built for monitoring structured snapshots from your own lawful
        pipelines—not for promoting wagering strategies.
      </p>
    </GuideLayout>
  );
}
