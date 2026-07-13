import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ContentPage from "../components/ContentPage.jsx";
import { AuthProvider, useAuth } from "../lib/auth.jsx";

function InviteInner() {
  const { slug, token } = useParams();
  const { user, setUser, authFetch, hubLoginUrl, booting } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authFetch(`/invites/${token}`)
      .then((data) => setEmail(data.email))
      .catch((e) => setMessage(e.message));
  }, [authFetch, token]);

  async function handleAccept() {
    setBusy(true);
    setMessage("");
    try {
      const data = await authFetch(`/invites/${token}/accept`, {
        method: "POST",
        json: {},
      });
      setUser(data.user);
      navigate(`/p/${slug}/auth`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  if (booting) {
    return (
      <ContentPage title="Accept invitation" showTopAd={false}>
        <p>Loading…</p>
      </ContentPage>
    );
  }

  return (
    <ContentPage title="Accept invitation" showTopAd={false}>
      <p>
        Join project <strong>{slug}</strong>
        {email ? (
          <>
            {" "}
            as <strong>{email}</strong>
          </>
        ) : null}
        .
      </p>
      {!user ? (
        <p>
          <a className="btn btn-primary" href={hubLoginUrl}>
            Sign in with Weien Wong
          </a>
        </p>
      ) : (
        <p>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={handleAccept}>
            {busy ? "Accepting…" : "Accept invite"}
          </button>
        </p>
      )}
      {message ? <p className="message error">{message}</p> : null}
      <p className="small muted">
        <Link to={`/p/${slug}/auth`}>Back to account</Link>
      </p>
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
