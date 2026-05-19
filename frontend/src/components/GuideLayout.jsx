import { Link } from "react-router-dom";
import ContentPage from "./ContentPage.jsx";
import { GUIDES, guideBySlug } from "../content/guides.js";

export default function GuideLayout({ slug, children }) {
  const meta = guideBySlug(slug);
  if (!meta) return null;

  const others = GUIDES.filter((g) => g.slug !== slug).slice(0, 3);

  return (
    <ContentPage title={meta.title}>
      <p className="muted small">
        ~{meta.readMinutes} min read · Part of our{" "}
        <Link to="/guides">research guides</Link>
      </p>
      {children}
      <hr className="content-divider" />
      <h2>More guides</h2>
      <ul>
        {others.map((g) => (
          <li key={g.slug}>
            <Link to={g.path}>{g.title}</Link>
          </li>
        ))}
        <li>
          <Link to="/guides">View all guides</Link>
        </li>
      </ul>
    </ContentPage>
  );
}
