import ContentPage from "../components/ContentPage.jsx";

export default function HowItWorks() {
  return (
    <ContentPage title="How sports odds comparison works">
      <figure className="content-figure">
        <img src="/images/feature-dashboard.svg" alt="Dashboard and comparison illustration" width={320} height={200} />
      </figure>

      <p>
        This guide explains the concepts behind comparing posted sports prices across sources.
        It is intended for readers learning market structure and data quality—not as betting
        advice.
      </p>

      <h2>Odds formats</h2>
      <p>
        Prices may appear as American (+200 / −150), decimal (3.00), or fractional (2/1)
        figures. Each format maps to an implied probability if you assume the line is efficient
        and excludes vigorish. When comparing two sources, convert to the same format first to
        avoid false gaps caused by rounding.
      </p>

      <h2>Markets and categories</h2>
      <p>
        A single game can have hundreds of markets: moneyline, spread, totals, and player props
        (points, rebounds, assists, etc.). Comparisons are only meaningful when the market
        definition matches—same player, same line type (over/under), and compatible timing.
        Mismatched categories produce misleading “arbitrage” percentages.
      </p>

      <h2>Timestamps and freshness</h2>
      <p>
        Odds change quickly after news and volume. A comparison row should record when each side
        was observed. If one side is several minutes older than the other, the gap may reflect
        delay rather than a true pricing difference. Our dashboard highlights recent updates
        and supports filters for this reason.
      </p>

      <h2>Implied edge (percentage difference)</h2>
      <p>
        Researchers sometimes express the ratio between two decimal-implied prices as a
        percentage. This metric is a descriptive snapshot, not a promise of profit. Limits,
        account rules, void policies, and line movement before placement all affect real-world
        outcomes.
      </p>

      <h2>Data collection</h2>
      <p>
        Public sportsbook pages and licensed data APIs can supply raw numbers. Collection must
        respect terms of service and applicable law. This site’s tools are designed for users
        who maintain their own lawful data pipelines; we do not guarantee completeness or
        accuracy of third-party feeds.
      </p>

      <h2>Next steps</h2>
      <p>
        Read our <a href="/about">About</a> page for editorial standards, or open the{" "}
        <a href="/dashboard">odds dashboard</a> if you already operate a configured data
        environment. For privacy questions, see <a href="/privacy">Privacy Policy</a>.
      </p>
    </ContentPage>
  );
}
