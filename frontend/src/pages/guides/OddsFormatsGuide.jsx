import GuideLayout from "../../components/GuideLayout.jsx";

export default function OddsFormatsGuide() {
  return (
    <GuideLayout slug="odds-formats">
      <p>
        Sportsbooks publish prices in several notations. Before comparing two sources, convert
        both sides to the same format (or to implied probability). Mixing formats without
        conversion is one of the most common errors in odds research.
      </p>

      <h2>American (moneyline) odds</h2>
      <p>
        American odds use positive and negative numbers. A positive line (e.g. +200) shows profit
        on a $100 stake if the outcome wins. A negative line (e.g. −150) shows how much you must
        risk to win $100. Favorites are negative; underdogs are positive. The magnitude reflects
        perceived likelihood, but the number is not itself a probability until you convert it.
      </p>
      <p>
        Example: +200 implies that a $100 bet returns $200 profit plus stake if successful.
        −150 implies risking $150 to win $100 profit. Researchers often convert both to decimal
        for arithmetic.
      </p>

      <h2>Decimal odds</h2>
      <p>
        Decimal odds (common in Europe and Australia) express total return per unit staked,
        including the stake. Decimal 2.50 means $1 staked returns $2.50 total ($1.50 profit).
        Decimal is convenient for multiplication: parlay decimal odds multiply directly (ignoring
        correlation, which books adjust separately).
      </p>
      <p>
        Conversion from American positive: decimal = 1 + (american / 100). From American
        negative: decimal = 1 + (100 / |american|). Example: +200 → 3.00 decimal; −150 → 1.667
        decimal (approximately).
      </p>

      <h2>Fractional odds</h2>
      <p>
        Fractional odds (e.g. 5/2, 4/7) show profit relative to stake. 5/2 means win $5 for every
        $2 staked (total return 7/2 of stake in profit-plus-stake terms). UK racing traditions use
        fractional heavily; many online books let users switch display format without changing
        underlying risk.
      </p>

      <h2>Worked comparison example</h2>
      <p>
        Source A lists Team X at decimal 2.10. Source B lists Team X at American +105. Convert
        +105: decimal ≈ 1 + 105/100 = 2.05. The gap is small (2.10 vs 2.05) but non-zero—about
        2.4% difference in decimal terms. Without conversion, a researcher might misread +105 as
        “far from” 2.10. Always normalize first, then compute percentage difference.
      </p>

      <h2>Rounding and display rules</h2>
      <p>
        Books round to tick sizes (e.g. −110 vs −108 on spreads). Automated scrapers may capture
        displayed strings that were already rounded. When building comparison tools, store raw
        numeric values from APIs when possible; string parsing of UI text can introduce extra
        rounding error.
      </p>

      <h2>Takeaways for researchers</h2>
      <ul>
        <li>Pick one internal format (decimal or implied probability) for all math.</li>
        <li>Document conversion formulas in your pipeline so results are reproducible.</li>
        <li>Do not compare American to decimal without conversion.</li>
        <li>Check whether prices include vig separately or only as embedded margin.</li>
      </ul>
    </GuideLayout>
  );
}
