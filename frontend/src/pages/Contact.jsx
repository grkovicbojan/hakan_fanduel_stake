import ContentPage from "../components/ContentPage.jsx";

export default function Contact() {
  return (
    <ContentPage title="Contact">
      <p>
        For questions about this website, privacy requests, or corrections to informational
        content, use the contact method below.
      </p>

      <h2>Email</h2>
      <p>
        <a href="mailto:contact@weienwong.online">contact@weienwong.online</a>
      </p>
      <p className="muted small">
        Replace this address with your active inbox before publishing if you use a different
        mailbox.
      </p>

      <h2>Response time</h2>
      <p>
        We aim to respond within five business days. Technical support for self-hosted dashboard
        deployments is limited to publicly documented behavior on this site.
      </p>

      <h2>Abuse and legal notices</h2>
      <p>
        For copyright or policy concerns, include the page URL, description of the issue, and your
        contact details. We review good-faith reports and remove or correct content when
        appropriate.
      </p>
    </ContentPage>
  );
}
