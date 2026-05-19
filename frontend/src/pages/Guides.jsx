import { Link } from "react-router-dom";
import ContentPage from "../components/ContentPage.jsx";
import { GUIDES } from "../content/guides.js";

export default function Guides() {
  return (
    <ContentPage title="Sports betting research guides">
      <p>
        These articles explain market structure, data quality, and responsible use in plain
        language. They are written for readers learning quantitative sports research—not as
        betting picks or financial advice.
      </p>

      <ul className="guide-list">
        {GUIDES.map((guide) => (
          <li key={guide.slug} className="guide-card">
            <h2>
              <Link to={guide.path}>{guide.title}</Link>
            </h2>
            <p>{guide.summary}</p>
            <p className="muted small">
              ~{guide.readMinutes} min read ·{" "}
              <Link to={guide.path}>Read article</Link>
            </p>
          </li>
        ))}
      </ul>

      <h2>Related pages</h2>
      <ul>
        <li>
          <Link to="/how-it-works">How it works</Link> — overview of comparison methodology
        </li>
        <li>
          <Link to="/about">About</Link> — editorial standards and mission
        </li>
      </ul>
    </ContentPage>
  );
}
