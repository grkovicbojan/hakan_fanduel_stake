import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ContentPage from "../components/ContentPage.jsx";
import { AuthProvider, useAuth } from "../lib/auth.jsx";
import { handleFormEnterKeyDown } from "../lib/formEnter.js";

function InviteInner() {
  const { slug, token } = useParams();
  const { setToken, setUser, authFetch } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    authFetch(`/invites/${token}`)
      .then((data) => setEmail(data.email))
      .catch((e) => setMessage(e.message));
  }, [authFetch, token]);

  async function handleAccept(event) {
    event.preventDefault();
    try {
      const data = await authFetch(`/invites/${token}/accept`, {
        method: "POST",
        json: { password },
      });
      setToken(data.token);
      setUser(data.user);
      navigate(`/p/${slug}/auth`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <ContentPage title="Accept invitation" showTopAd={false}>
      <p>Join project <strong>{slug}</strong> as <strong>{email}</strong>.</p>
      <form onSubmit={handleAccept} onKeyDown={handleFormEnterKeyDown} className="stack-form" style={{ maxWidth: 420 }}>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
        </label>
        <button type="submit" className="btn btn-primary">Accept invite</button>
      </form>
      {message ? <p className="message error">{message}</p> : null}
      <p className="small muted"><Link to={`/p/${slug}/auth`}>Back to login</Link></p>
    </ContentPage>
  );
}

export default function ProjectInvite() {
  const { slug } = useParams();
  return (
    <AuthProvider slug={slug}>
      <InviteInner />
    </AuthProvider>
  );
}
