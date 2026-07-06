import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ContentPage from "../components/ContentPage.jsx";
import { AuthProvider, useAuth } from "../lib/auth.jsx";
import { handleFormEnterKeyDown } from "../lib/formEnter.js";

function AuthForm() {
  const { slug } = useParams();
  const { token, user, login, register, logout, refreshUser, sendInvite } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    refreshUser()
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [token, refreshUser, logout]);

  async function handleAuth(event) {
    event.preventDefault();
    setMessage("");
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password);
    } catch (error) {
      setMessage(error.message);
    }
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

  if (loading) {
    return <ContentPage title="Account"><p>Loading…</p></ContentPage>;
  }

  if (user) {
    return (
      <ContentPage title="Your project account" showTopAd={false}>
        <p>
          Signed in as <strong>{user.email}</strong> on project <code>/p/{slug}/</code>.
        </p>
        <p className="muted">
          Invites accepted: {user.accepted_invites_sent ?? 0}. Share research tools with teammates via invite links.
        </p>
        <form onSubmit={handleInvite} onKeyDown={handleFormEnterKeyDown} className="stack-form" style={{ maxWidth: 420 }}>
          <label>
            Invite teammate by email
            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
          </label>
          <button type="submit" className="btn btn-primary">Send invite</button>
        </form>
        {inviteLink ? <p className="small muted">Share: {inviteLink}</p> : null}
        <p>
          <Link to="/dashboard" className="btn btn-secondary">Open dashboard</Link>{" "}
          <button type="button" className="btn btn-secondary" onClick={logout}>Logout</button>
        </p>
        {message ? <p className="message error">{message}</p> : null}
      </ContentPage>
    );
  }

  return (
    <ContentPage title={mode === "login" ? "Sign in" : "Create account"} showTopAd={false}>
      <p className="lead">
        Access research tools for <strong>{slug}</strong>.
      </p>
      <div className="auth-tabs">
        <button type="button" className={`btn ${mode === "login" ? "btn-primary" : "btn-secondary"}`} onClick={() => setMode("login")}>Login</button>
        <button type="button" className={`btn ${mode === "register" ? "btn-primary" : "btn-secondary"}`} onClick={() => setMode("register")}>Register</button>
      </div>
      <form onSubmit={handleAuth} onKeyDown={handleFormEnterKeyDown} className="stack-form" style={{ maxWidth: 420 }}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
        </label>
        <button type="submit" className="btn btn-primary">{mode === "login" ? "Login" : "Register"}</button>
      </form>
      {message ? <p className="message error">{message}</p> : null}
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
