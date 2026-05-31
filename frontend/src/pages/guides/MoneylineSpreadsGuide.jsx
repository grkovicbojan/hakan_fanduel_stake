import GuideLayout from "../../components/GuideLayout.jsx";

export default function MoneylineSpreadsGuide() {
  return (
    <GuideLayout slug="moneyline-and-spreads">
      <p>
        Before studying player props or cross-book gaps, researchers should understand the main
        team markets: moneyline, point spread, and game total. Each prices a different question
        about the same event.
      </p>
      <h2>Moneyline</h2>
      <p>
        Moneyline markets ask which side wins outright. In sports with draws (soccer), a three-way
        line may include the draw. Prices encode implied strength; heavy favorites show negative
        American odds or low decimal returns. Moneylines are sensitive to overtime rules—check
        whether the market includes extra periods.
      </p>
      <h2>Point spread</h2>
      <p>
        Spreads handicap the favorite by points (e.g. −6.5). The favorite must win by more than the
        spread for backers to win; the underdog can lose by fewer than the spread and still cover.
        Half-points (.5) reduce push frequency. Spreads correlate with moneylines but are not
        redundant: books balance action differently on each market.
      </p>
      <h2>Game totals</h2>
      <p>
        Totals combine both teams’ scores against a line (e.g. 214.5 NBA). Weather, pace, and
        injury news move totals independently of spread. Comparing totals across books requires the
        same rules for overtime inclusion.
      </p>
      <h2>How books set main lines</h2>
      <p>
        Opening numbers reflect power ratings and public bias; later moves reflect bets and risk.
        Researchers track open vs close to study market efficiency—not to predict outcomes with
        certainty.
      </p>
      <h2>Comparison checklist</h2>
      <ul>
        <li>Same event, same period rules (regulation vs including OT).</li>
        <li>Same market type (ML vs spread vs total).</li>
        <li>Captured timestamps within your freshness window.</li>
        <li>Converted to one odds format before math.</li>
      </ul>
    </GuideLayout>
  );
}
