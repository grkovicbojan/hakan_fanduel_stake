import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import AdSenseUnit from "./AdSenseUnit.jsx";
import MobileNav from "./MobileNav.jsx";
import { isAdSenseContentRoute } from "../lib/adsense.js";
import { guideBySlug } from "../content/guides.js";

const PAGE_TITLES = {
  "/": "Home | SportBet Odds Comparator",
  "/about": "About | SportBet Odds Comparator",
  "/how-it-works": "How It Works | SportBet Odds Comparator",
  "/guides": "Guides | SportBet Odds Comparator",
  "/privacy": "Privacy Policy | SportBet Odds Comparator",
  "/terms": "Terms of Use | SportBet Odds Comparator",
  "/contact": "Contact | SportBet Odds Comparator",
  "/dashboard": "Odds Dashboard | SportBet Odds Comparator",
  "/settings": "Settings | SportBet Odds Comparator",
  "/alert": "Alerts | SportBet Odds Comparator"
};

function titleForPath(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const guideMatch = pathname.match(/^\/guides\/([^/]+)$/);
  if (guideMatch) {
    const g = guideBySlug(guideMatch[1]);
    if (g) return `${g.title} | SportBet Odds Comparator`;
  }
  return "SportBet Odds Comparator";
}

export default function SiteLayout() {
  const { pathname } = useLocation();
  const isToolRoute = !isAdSenseContentRoute(pathname);

  useEffect(() => {
    document.title = titleForPath(pathname);
  }, [pathname]);

  return (
    <div className="layout">
      <header className="site-header">
        <div className="site-brand">
          <img
            src="/images/hero-sports.svg"
            alt=""
            className="site-logo"
            width={44}
            height={44}
          />
          <div className="site-brand-text">
            <NavLink to="/" className="site-title-link">
              SportBet Odds Comparator
            </NavLink>
            <p className="site-tagline muted small">
              Sports odds research and comparison methodology
            </p>
          </div>
        </div>
        <nav className="site-nav" aria-label="Main">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/guides">Guides</NavLink>
          <NavLink to="/how-it-works">How it works</NavLink>
          <NavLink to="/about">About</NavLink>
          <NavLink to="/dashboard">Odds dashboard</NavLink>
          {isToolRoute ? (
            <>
              <NavLink to="/settings">Settings</NavLink>
              <NavLink to="/alert">Alerts</NavLink>
            </>
          ) : null}
          <NavLink to="/contact">Contact</NavLink>
        </nav>
        <MobileNav />
      </header>

      {isToolRoute ? (
        <p className="tool-banner small">
          Application tools below are for data monitoring. Display advertisements appear only on
          informational content pages.
        </p>
      ) : null}

      <main className="site-main">
        <Outlet />
      </main>

      {!isToolRoute ? <AdSenseUnit className="adsense-bottom" /> : null}

      <footer className="site-footer">
        <nav className="footer-nav" aria-label="Legal">
          <NavLink to="/guides">Guides</NavLink>
          <NavLink to="/privacy">Privacy Policy</NavLink>
          <NavLink to="/terms">Terms of Use</NavLink>
          <NavLink to="/contact">Contact</NavLink>
          <NavLink to="/dashboard">Odds dashboard</NavLink>
        </nav>
        <p className="muted small">
          © {new Date().getFullYear()} SportBet Odds Comparator. For research and informational
          purposes. This site does not accept wagers or facilitate gambling.
        </p>
      </footer>
    </div>
  );
}
