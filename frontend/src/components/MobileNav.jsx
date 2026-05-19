import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { isAdSenseContentRoute } from "../lib/adsense.js";

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const isToolRoute = !isAdSenseContentRoute(pathname);

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
          <NavLink to="/how-it-works" onClick={close}>
            How it works
          </NavLink>
          <NavLink to="/about" onClick={close}>
            About
          </NavLink>
          <NavLink to="/dashboard" onClick={close}>
            Odds dashboard
          </NavLink>
          {isToolRoute ? (
            <>
              <NavLink to="/settings" onClick={close}>
                Settings
              </NavLink>
              <NavLink to="/alert" onClick={close}>
                Alerts
              </NavLink>
            </>
          ) : null}
          <NavLink to="/contact" onClick={close}>
            Contact
          </NavLink>
        </nav>
      ) : null}
    </div>
  );
}
