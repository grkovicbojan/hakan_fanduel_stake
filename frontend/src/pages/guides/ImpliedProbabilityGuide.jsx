import GuideLayout from "../../components/GuideLayout.jsx";

export default function ImpliedProbabilityGuide() {
  return (
    <GuideLayout slug="implied-probability">
      <p>
        Every posted price implies a probability if you treat the line as fair and ignore
        bookmaker margin. Understanding implied probability helps you compare markets and spot when
        two books disagree—but it does not, by itself, identify mispriced outcomes in real life.
      </p>

      <h2>From decimal odds to implied probability</h2>
      <p>
        For decimal odds <em>d</em>, implied probability (ignoring vig) is <em>p = 1 / d</em>.
        Example: decimal 2.00 → 50% implied. Decimal 1.50 → 66.7% implied. This is the
        break-even win rate needed for a breakeven bet absent margin.
      </p>

      <h2>American odds to implied probability</h2>
      <p>
        For positive American <em>A</em>: p = 100 / (A + 100). For negative American <em>A</em>:
        p = |A| / (|A| + 100). Example: −110 → 110/210 ≈ 52.38%. +150 → 100/250 = 40%. These
        formulas assume standard American notation on a two-outcome market.
      </p>

      <h2>Why probabilities sum above 100%</h2>
      <p>
        In a binary market (e.g. moneyline with no draw), fair probabilities sum to 100%. Real
        books embed margin (“vig” or “overround”). If both sides are −110, each side implies about
        52.38%, summing to ~104.76%. The excess above 100% is the book’s theoretical margin on
        balanced action. Multi-outcome markets (1X2 soccer) can show even higher total implied
        probability across all selections.
      </p>

      <h2>Removing margin (theoretical)</h2>
      <p>
        Researchers sometimes “normalize” implied probabilities by scaling so they sum to 100%.
        Methods include proportional scaling (divide each implied p by the sum) or more advanced
        Shin/power methods for multi-way markets. Normalization is useful for modeling, not proof
        of edge: the true win probability is unknown and the book’s margin model may be
        asymmetric.
      </p>

      <h2>Vig and comparison research</h2>
      <p>
        When comparing Source A vs Source B on the same selection, a lower decimal (higher
        implied probability for the bettor) is better for the backer. But if both sources embed
        different margin structures, part of the gap may be vig rather than disagreement about
        the event. Prop markets often carry higher margin than main lines.
      </p>

      <h2>Limitations</h2>
      <ul>
        <li>Implied probability assumes the posted line is efficient; markets can be stale.</li>
        <li>Correlated parlays and promotions break simple single-leg math.</li>
        <li>Exchange books may show lay/back separately; treat each side explicitly.</li>
        <li>Regulatory void rules and palp errors are not captured in implied p.</li>
      </ul>

      <p>
        Use implied probability as a language for comparison, not a guarantee. Pair it with
        timestamps, market definitions, and source terms of service when building datasets.
      </p>
    </GuideLayout>
  );
}
