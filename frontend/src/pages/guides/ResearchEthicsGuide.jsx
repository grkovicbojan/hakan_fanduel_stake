import GuideLayout from "../../components/GuideLayout.jsx";

export default function ResearchEthicsGuide() {
  return (
    <GuideLayout slug="research-ethics">
      <p>
        Collecting sports prices for personal research must respect law, operator terms, and
        privacy. This article outlines principles—not legal advice for your jurisdiction.
      </p>
      <h2>Terms of service</h2>
      <p>
        Sportsbook and data provider sites publish rules on automated access, redistribution, and
        commercial use. Scraping where prohibited can terminate accounts or create legal exposure.
        Read each source’s terms; prefer licensed APIs when available.
      </p>
      <h2>Geo and licensing</h2>
      <p>
        Online wagering is regulated by region. Accessing markets from prohibited locations may
        violate local law and operator policies. Researchers should work only where their
        activities are permitted.
      </p>
      <h2>Accuracy and public communication</h2>
      <p>
        Publishing comparison tables without context can mislead readers. Label snapshots as
        time-bound, disclose limitations, and avoid promising profit. Our site separates long-form
        education from optional private tools for this reason.
      </p>
      <h2>Personal data</h2>
      <p>
        If your pipeline stores user accounts or emails, handle them under applicable privacy law.
        Our public pages describe cookies and analytics in the{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>
      <h2>Responsible publishing</h2>
      <p>
        Do not target minors. Include harm-reduction resources where discussing wagering products.
        See <a href="/guides/responsible-gambling">responsible gambling</a> for helplines.
      </p>
    </GuideLayout>
  );
}
