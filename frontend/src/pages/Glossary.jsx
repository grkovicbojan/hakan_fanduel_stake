import { Link } from "react-router-dom";
import ContentPage from "../components/ContentPage.jsx";

const TERMS = [
  {
    term: "American odds",
    def: "Moneyline notation using positive and negative numbers (e.g. +200, −150).",
    link: "/guides/odds-formats"
  },
  {
    term: "Decimal odds",
    def: "Total return per unit staked, including stake (e.g. 2.50).",
    link: "/guides/odds-formats"
  },
  {
    term: "Implied probability",
    def: "Win rate implied by a price if the line were fair and had no margin.",
    link: "/guides/implied-probability"
  },
  {
    term: "Vig (juice)",
    def: "Bookmaker margin embedded in prices; makes implied probabilities sum above 100%.",
    link: "/guides/implied-probability"
  },
  {
    term: "Moneyline",
    def: "Market on which team or player wins outright (may exclude draw in some sports)."
  },
  {
    term: "Point spread",
    def: "Handicap added to a team’s score for pricing purposes."
  },
  {
    term: "Total (over/under)",
    def: "Combined score market; bettors compare result to a posted line."
  },
  {
    term: "Player prop",
    def: "Market on an individual statistic (points, assists, etc.) with a strike line.",
    link: "/guides/player-props"
  },
  {
    term: "Strike",
    def: "The numeric line in a prop (e.g. 22.5 points)."
  },
  {
    term: "Stale line",
    def: "A price that has not updated after news while another source has moved.",
    link: "/guides/arbitrage-research"
  },
  {
    term: "Line movement",
    def: "Change in posted prices over time due to news, volume, or risk management.",
    link: "/guides/line-movement"
  },
  {
    term: "Closing line",
    def: "Final posted price before an event starts; often used in retrospective analysis."
  },
  {
    term: "Limit",
    def: "Maximum stake a book accepts on a market; affects whether research gaps are actionable."
  },
  {
    term: "Void",
    def: "Bet graded as no action under specific rules (e.g. certain DNPs)."
  }
];

export default function Glossary() {
  return (
    <ContentPage title="Glossary of sports market terms" showTopAd={false}>
      <p>
        Reference definitions for readers of our <Link to="/guides">guides</Link>. Terms are
        explained for education, not as betting instructions.
      </p>
      <dl className="glossary-list">
        {TERMS.map((item) => (
          <div key={item.term} className="glossary-entry">
            <dt>{item.term}</dt>
            <dd>
              {item.def}
              {item.link ? (
                <>
                  {" "}
                  <Link to={item.link}>Learn more</Link>
                </>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </ContentPage>
  );
}
