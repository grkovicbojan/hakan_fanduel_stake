import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import ContentPage from "../components/ContentPage.jsx";
import { AuthProvider, useAuth } from "../lib/auth.jsx";
import { handleFormEnterKeyDown } from "../lib/formEnter.js";

function AuthForm() {
  const { slug } = useParams();
  const { user, logout, refreshUser, sendInvite, hubLoginUrl, hubRegisterUrl, booting } = useAuth();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [message, setMessage] = useState("");

  async function handleInvite(event) {
    event.preventDefault();
    try {
      const data = await sendInvite(inviteEmail);
      setInviteLink(data.invite.link);
      await refreshUser();
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (booting) {
    return (
      <ContentPage title="Account">
        <p>Loading…</p>
      </ContentPage>
    );
  }

  if (user) {
    return (
      <ContentPage title="Your project account" showTopAd={false}>
        <p>
          Signed in as <strong>{user.email}</strong> on project <code>/p/{slug}/</code>.
        </p>
        <p className="muted">
          Invites accepted: {user.accepted_invites_sent ?? 0}. Share research tools with teammates via
          invite links.
        </p>
        <form
          onSubmit={handleInvite}
          onKeyDown={handleFormEnterKeyDown}
          className="stack-form"
          style={{ maxWidth: 420 }}
        >
          <label>
            Invite teammate by email
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn btn-primary">
            Send invite
          </button>
        </form>
        {inviteLink ? <p className="small muted">Share: {inviteLink}</p> : null}
        <p>
          <Link to="/dashboard" className="btn btn-secondary">
            Open dashboard
          </Link>{" "}
          <button type="button" className="btn btn-secondary" onClick={() => logout()}>
            Logout
          </button>
        </p>
        {message ? <p className="message error">{message}</p> : null}
      </ContentPage>
    );
  }

  return (
    <ContentPage title="Sign in" showTopAd={false}>
      <p className="lead">
        Use your Weien Wong hub account for <strong>{slug}</strong>.
      </p>
      <p style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <a className="btn btn-primary" href={hubLoginUrl}>
          Sign in with Weien Wong
        </a>
        <a className="btn btn-secondary" href={hubRegisterUrl}>
          Create hub account
        </a>
      </p>
      <p className="small muted">
        <Link to="/">← Back to home</Link>
      </p>
    </ContentPage>
  );
}

export default function ProjectAuth() {
  const { slug } = useParams();
  return (
    <AuthProvider slug={slug}>
      <AuthForm />
    </AuthProvider>
  );
}
