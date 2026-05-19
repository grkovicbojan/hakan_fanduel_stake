import ContentPage from "../components/ContentPage.jsx";

export default function Terms() {
  return (
    <ContentPage title="Terms of Use" showTopAd={false}>
      <p className="muted small">Effective date: May 19, 2026</p>

      <p>
        By accessing weienwong.online (“Site”), you agree to these Terms of Use. If you do not
        agree, do not use the Site.
      </p>

      <h2>Informational purpose only</h2>
      <p>
        Content on the Site is provided for general information and research. It is not financial,
        legal, or gambling advice. We do not operate a sportsbook and do not accept wagers.
      </p>

      <h2>No guarantee of accuracy</h2>
      <p>
        Odds, timestamps, and comparisons may be delayed, incomplete, or incorrect. You are
        responsible for verifying all figures before relying on them. We disclaim liability for
        decisions made based on Site content or tools.
      </p>

      <h2>Lawful use</h2>
      <p>
        You must comply with applicable laws in your jurisdiction, including rules related to
        sports betting, data scraping, and API use. You may not use the Site to violate third-party
        terms of service or intellectual property rights.
      </p>

      <h2>Dashboard and tools</h2>
      <p>
        Optional tools (dashboard, settings, alerts) are provided “as is” without warranties. We may
        modify or discontinue features at any time.
      </p>

      <h2>Intellectual property</h2>
      <p>
        Site text, layout, and branding are owned by us or licensed to us. You may not copy or
        republish substantial portions without permission, except for personal, non-commercial
        use with attribution.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, we are not liable for indirect, incidental, or
        consequential damages arising from use of the Site.
      </p>

      <h2>External links</h2>
      <p>
        The Site may reference third-party websites. We are not responsible for their content or
        practices.
      </p>

      <h2>Changes</h2>
      <p>
        We may revise these Terms at any time. Material changes will be reflected on this page.
      </p>

      <h2>Contact</h2>
      <p>
        See <a href="/contact">Contact</a> for inquiries.
      </p>
    </ContentPage>
  );
}
