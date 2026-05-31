import GuideLayout from "../../components/GuideLayout.jsx";

export default function LineMovementGuide() {
  return (
    <GuideLayout slug="line-movement">
      <p>
        Posted prices move when new information arrives or when betting volume shifts risk. Line
        movement is normal; comparing two books without timestamps often mistakes delay for edge.
      </p>
      <h2>Opening vs current line</h2>
      <p>
        The open is the first price offered; subsequent moves reflect injuries, weather, lineup
        news, and money. Researchers log both to study how fast each source reacts. A slow book may
        temporarily show an outlier number that disappears within minutes.
      </p>
      <h2>Steam and synchronized moves</h2>
      <p>
        When many books move the same direction quickly, the market may be reacting to shared news
        or sharp action. A lone book lagging behind can show a large gap that closes before manual
        verification—always note observation time on each side.
      </p>
      <h2>Closing line value (CLV) in research</h2>
      <p>
        Analysts sometimes compare a bet price to the closing line as a retrospective quality
        metric. CLV studies require consistent closing definitions and large samples; they do not
        guarantee future results for casual readers.
      </p>
      <h2>Live vs pregame</h2>
      <p>
        In-play lines incorporate game state (score, fouls, pace). Never compare live prices to
        pregame snapshots. Separate datasets by phase and sport-specific rules.
      </p>
      <h2>Practical logging</h2>
      <p>
        Store ISO timestamps, market type, and source URL for each scrape. Filter comparison tools
        to pairs observed within the same short window. Document suspensions when markets are off
        the board.
      </p>
    </GuideLayout>
  );
}
