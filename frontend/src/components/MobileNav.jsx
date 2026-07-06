import { useState } from "react";
import { NavLink } from "react-router-dom";
import { DASHBOARD_NAV_ITEMS } from "../lib/dashboardNav.js";

export default function MobileNav() {
  const [open, setOpen] = useState(false);

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
          <span className="mobile-nav-divider">Dashboard</span>
          {DASHBOARD_NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={close} className="mobile-nav-submenu-link">
              {item.label}
            </NavLink>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
