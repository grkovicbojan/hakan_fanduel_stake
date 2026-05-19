import ContentPage from "../components/ContentPage.jsx";

export default function Privacy() {
  return (
    <ContentPage title="Privacy Policy" showTopAd={false}>
      <p className="muted small">Effective date: May 19, 2026</p>

      <p>
        SportBet Odds Comparator (“we”, “our”, “us”) operates the website weienwong.online. This
        Privacy Policy explains what information we collect, how we use it, and your choices.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Usage data:</strong> Standard server and analytics logs (IP address, browser
          type, pages visited, timestamps) may be collected automatically.
        </li>
        <li>
          <strong>Tool data:</strong> If you use the odds dashboard, data you or your systems
          submit (URLs, scraped content, configuration) is processed to provide the service.
        </li>
        <li>
          <strong>Cookies:</strong> We and third-party partners (including Google AdSense) may
          use cookies or similar technologies for advertising and measurement on content pages.
        </li>
      </ul>

      <h2>How we use information</h2>
      <p>
        We use information to operate and improve the website, secure our systems, respond to
        inquiries, and—where enabled—display relevant advertisements through Google AdSense.
      </p>

      <h2>Google AdSense and advertising partners</h2>
      <p>
        Google, as a third-party vendor, uses cookies to serve ads on this site. Google’s use of
        the DART cookie enables it to serve ads based on visits to this and other sites. Users
        may opt out of the DART cookie by visiting{" "}
        <a
          href="https://policies.google.com/technologies/ads"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google’s ad technology policy
        </a>
        . Other partners may use cookies per their own policies.
      </p>

      <h2>Data retention</h2>
      <p>
        We retain operational data only as long as needed for the purposes described above or as
        required by law. Dashboard data stored in your deployment’s database is controlled by
        your server configuration.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on your location, you may have rights to access, correct, or delete personal
        data. Contact us using the details on the <a href="/contact">Contact</a> page.
      </p>

      <h2>Children</h2>
      <p>
        This site is not directed at individuals under 18 (or the legal age in your jurisdiction).
        We do not knowingly collect personal information from children.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy from time to time. Continued use of the site after changes
        constitutes acceptance of the updated policy.
      </p>

      <h2>Contact</h2>
      <p>
        Questions: see <a href="/contact">Contact</a>.
      </p>
    </ContentPage>
  );
}
