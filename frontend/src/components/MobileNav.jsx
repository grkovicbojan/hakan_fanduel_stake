import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { isContentRoute } from "../lib/siteMeta.js";

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const isToolRoute = !isContentRoute(pathname);

  const close = () => setOpen(false);

  return (
    <div className="mobile-nav">
      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Close" : "Menu"}
      </button>
      {open ? (
        <nav id="mobile-nav-panel" className="mobile-nav-panel" aria-label="Mobile">
          <NavLink to="/" end onClick={close}>
            Home
          </NavLink>
          <NavLink to="/guides" onClick={close}>
            Guides
          </NavLink>
          <NavLink to="/glossary" onClick={close}>
            Glossary
          </NavLink>
          <NavLink to="/how-it-works" onClick={close}>
            How it works
          </NavLink>
          <NavLink to="/about" onClick={close}>
            About
          </NavLink>
          <NavLink to="/faq" onClick={close}>
            FAQ
          </NavLink>
          <NavLink to="/contact" onClick={close}>
            Contact
          </NavLink>
          {isToolRoute ? (
            <>
              <span className="mobile-nav-divider">Research tools</span>
              <NavLink to="/dashboard" onClick={close}>
                Dashboard
              </NavLink>
              <NavLink to="/settings" onClick={close}>
                Settings
              </NavLink>
              <NavLink to="/alert" onClick={close}>
                Alerts
              </NavLink>
            </>
          ) : (
            <NavLink to="/dashboard" onClick={close} className="mobile-nav-tools-link">
              Research tools
            </NavLink>
          )}
        </nav>
      ) : null}
    </div>
  );
}
