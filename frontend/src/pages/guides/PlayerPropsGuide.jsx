import GuideLayout from "../../components/GuideLayout.jsx";

export default function PlayerPropsGuide() {
  return (
    <GuideLayout slug="player-props">
      <p>
        Player proposition markets (points, rebounds, assists, combined stats, etc.) are among
        the hardest to compare across sportsbooks. Small differences in line, grading rules, or
        player name spelling can make automated matches unreliable without strict definitions.
      </p>

      <h2>Over/under and the strike line</h2>
      <p>
        A prop is typically “Player X over/under N.N stat.” The strike (N.N) must match: 22.5
        points is not comparable to 23.5. Some books offer alternate ladders (20.5, 22.5, 24.5);
        always pair identical strikes. Over/under direction must align—comparing over on one side
        to under on the other is a different economic position.
      </p>

      <h2>Naming and roster issues</h2>
      <p>
        Books abbreviate names differently (“L. James” vs “LeBron James”). Middle initials, suffixes
        (Jr.), and unicode accents break naive string equality. Match keys should use stable IDs
        from a roster feed when available, not display text alone.
      </p>

      <h2>Combined and exotic props</h2>
      <p>
        “Points + rebounds + assists” combos may use different weights or definitions (e.g.
        whether overtime counts). Same-player triple-double markets differ from single-stat props.
        Document the stat definition in your category label when storing comparisons.
      </p>

      <h2>Game state: pregame vs live</h2>
      <p>
        Live props react to minutes played and foul trouble; pregame lines do not. Never mix live
        and pregame rows in one comparison table. Injury news can pull a player’s line off the
        board on one book while another lags.
      </p>

      <h2>Grading and void policies</h2>
      <p>
        Did-not-play (DNP) rules vary: some books void, some lose overs. Shortened games, overtime
        inclusion, and official stat corrections (later adjustments) affect settlement. Research
        datasets should note policy per source even if prices match at scrape time.
      </p>

      <h2>Building comparable categories</h2>
      <p>
        A practical category string might encode: stat type, direction (over/under), strike,
        player key, and game ID. Example pattern:{" "}
        <code>Assists-Over-22.5+Points:PlayerKey</code>. Human-readable labels help debugging;
        machine keys prevent false positives.
      </p>

      <h2>Checklist before trusting a prop comparison</h2>
      <ul>
        <li>Same game, same player identity, same stat definition.</li>
        <li>Same strike and same side (over vs under).</li>
        <li>Both prices scraped within your freshness window.</li>
        <li>Pregame vs live flagged separately.</li>
        <li>Manual spot-check on any gap above your alert threshold.</li>
      </ul>
    </GuideLayout>
  );
}
