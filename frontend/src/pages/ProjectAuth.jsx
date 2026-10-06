import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import ContentPage from "../components/ContentPage.jsx";
import { AuthProvider, useAuth } from "../lib/auth.jsx";
import { handleFormEnterKeyDown } from "../lib/formEnter.js";

function AuthForm() {
  const { slug } = useParams();
  const { user, linkRequired, logout, refreshUser, sendInvite, signIn, signUp,
    linkLegacyAccount, booting } = useAuth();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [legacyPassword, setLegacyPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAuth(event) {
    event.preventDefault();
    setMessage("");
    if (mode === "register" && password !== confirmation) {
      setMessage("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "register") await signUp(email.trim(), password);
      else await signIn(email.trim(), password);
      setPassword("");
      setConfirmation("");
    } catch (error) {
      setMessage(error.message || "Could not sign in.");
    } finally { setBusy(false); }
  }

  async function handleLegacyLink(event) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      await linkLegacyAccount(legacyPassword);
      setLegacyPassword("");
    } catch (error) {
      setMessage(error.message || "Could not link the older SportBet account.");
    } finally { setBusy(false); }
  }

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
    <ContentPage title="Your account" showTopAd={false}>
      {linkRequired ? (
        <>
          <h2>Link your older SportBet account</h2>
          <p className="lead">Your shared account is signed in as {linkRequired.email}. Enter the old SportBet password once to keep your existing projects and permissions.</p>
          <form onSubmit={handleLegacyLink} className="stack-form" style={{ maxWidth: 420 }}>
            <label>Old SportBet password
              <input type="password" autoComplete="current-password" value={legacyPassword}
                onChange={(event) => setLegacyPassword(event.target.value)} required disabled={busy} />
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Linking…" : "Link account"}</button>
          </form>
          <button type="button" className="btn btn-secondary" onClick={() => logout()}>Use a different account</button>
        </>
      ) : (
        <>
          <p className="lead">Create an account here and use the same email and password on every Weien Wong service. Already registered elsewhere? Sign in here.</p>
          <form onSubmit={handleAuth} onKeyDown={handleFormEnterKeyDown} className="stack-form" style={{ maxWidth: 420 }}>
            <label>Email
              <input type="email" autoComplete="email" value={email}
                onChange={(event) => setEmail(event.target.value)} required disabled={busy} />
            </label>
            <label>Password
              <input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"}
                value={password} onChange={(event) => setPassword(event.target.value)}
                minLength={mode === "register" ? 12 : undefined} required disabled={busy} />
            </label>
            {mode === "register" ? (
              <label>Confirm password
                <input type="password" autoComplete="new-password" value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)} minLength={12} required disabled={busy} />
              </label>
            ) : null}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}
            </button>
          </form>
          <button type="button" className="btn btn-secondary" style={{ marginTop: 12 }}
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setMessage(""); setPassword(""); setConfirmation(""); }}>
            {mode === "login" ? "Create an account" : "Already have an account? Sign in"}
          </button>
        </>
      )}
      {message ? <p className="message error" role="alert">{message}</p> : null}
      <p className="small muted"><Link to="/">← Back to home</Link></p>
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
