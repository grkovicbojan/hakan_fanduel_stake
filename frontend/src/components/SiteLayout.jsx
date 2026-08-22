import { NavLink, Outlet, useLocation } from "react-router-dom";
import AdSenseUnit from "./AdSenseUnit.jsx";
import MobileNav from "./MobileNav.jsx";
import NavDashboardDropdown from "./NavDashboardDropdown.jsx";
import EditorialBanner from "./EditorialBanner.jsx";
import PageMeta from "./PageMeta.jsx";
import { isContentRoute } from "../lib/siteMeta.js";
import { SIBLING_SITES } from "../content/ecosystem.js";
import ThemeToggle from "./ThemeToggle.jsx";
import { DEFAULT_PROJECT_SLUG } from "../lib/auth.jsx";

export default function SiteLayout() {
  const { pathname } = useLocation();
  const isToolRoute = !isContentRoute(pathname);
  const showAds = isContentRoute(pathname);

  return (
    <div className="layout">
      <PageMeta />
      <EditorialBanner />
      <header className="site-header">
        <div className="site-brand">
          <NavLink to="/" end className="site-logo-link" aria-label="Home">
            <img src="/images/logo.svg" alt="" className="site-logo" width={44} height={44} />
          </NavLink>
          <div className="site-brand-text">
            <NavLink to="/" className="site-title-link">
              SportBet Odds Comparator
            </NavLink>
            <p className="site-tagline muted small">
              Independent sports market education &amp; research guides
            </p>
          </div>
        </div>
        <nav className="site-nav" aria-label="Main">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/guides">Guides</NavLink>
          <NavLink to="/glossary">Glossary</NavLink>
          <NavLink to="/how-it-works">How it works</NavLink>
          <NavLink to="/about">About</NavLink>
          <NavLink to="/faq">FAQ</NavLink>
          <NavLink to="/contact">Contact</NavLink>
          <NavDashboardDropdown />
          <NavLink to={`/p/${DEFAULT_PROJECT_SLUG}/auth`} className="nav-account">
            Account
          </NavLink>
        </nav>
        <div className="header-utilities">
          <a
            className="btn btn-secondary"
            href="https://weienwong.online/"
            title="Return to Weien Wong hub"
          >
            ← Hub
          </a>
          <ThemeToggle />
          <MobileNav />
        </div>
      </header>

      {isToolRoute ? (
        <p className="tool-banner small">
          <strong>Research tools.</strong> This area is for data monitoring only—no display ads.
          For educational content, visit <NavLink to="/guides">Guides</NavLink> or{" "}
          <NavLink to="/">Home</NavLink>.
        </p>
      ) : null}

      <main className="site-main">
        <Outlet />
      </main>

      {showAds ? <AdSenseUnit className="adsense-bottom" /> : null}

      <footer className="site-footer">
        <div className="footer-sections-grid">
        <div className="footer-section">
          <p className="footer-heading">Content</p>
          <nav className="footer-nav" aria-label="Content">
            <NavLink to="/guides">Guides</NavLink>
            <NavLink to="/glossary">Glossary</NavLink>
            <NavLink to="/how-it-works">How it works</NavLink>
            <NavLink to="/about">About</NavLink>
            <NavLink to="/faq">FAQ</NavLink>
          </nav>
        </div>
        <div className="footer-section">
          <p className="footer-heading">Legal</p>
          <nav className="footer-nav" aria-label="Legal">
            <NavLink to="/privacy">Privacy Policy</NavLink>
            <NavLink to="/terms">Terms of Use</NavLink>
            <NavLink to="/contact">Contact</NavLink>
          </nav>
        </div>
        <div className="footer-section">
          <p className="footer-heading">Research tools (no ads)</p>
          <nav className="footer-nav" aria-label="Tools">
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/settings">Settings</NavLink>
            <NavLink to="/alert">Alerts</NavLink>
          </nav>
        </div>
        </div>
        <div className="footer-section footer-ecosystem">
          <p className="footer-heading">More from the Weien Wong network</p>
          <nav className="footer-nav footer-nav-wide" aria-label="Weien Wong ecosystem">
            {SIBLING_SITES.map((site) => (
              <a key={site.id} href={site.url} title={site.blurb}>
                {site.anchor}
              </a>
            ))}
          </nav>
        </div>
        <p className="muted small footer-copy">
          © {new Date().getFullYear()} SportBet Odds Comparator. Educational content only. Not a
          sportsbook. Does not accept wagers.
        </p>
      </footer>
    </div>
  );
}
