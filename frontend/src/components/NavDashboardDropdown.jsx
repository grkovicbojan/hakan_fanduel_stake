import { NavLink, useLocation } from "react-router-dom";
import { DASHBOARD_NAV_ITEMS, isDashboardNavActive } from "../lib/dashboardNav.js";

export default function NavDashboardDropdown() {
  const { pathname } = useLocation();
  const active = isDashboardNavActive(pathname);

  return (
    <div className={`nav-dropdown${active ? " nav-dropdown--active" : ""}`}>
      <button
        type="button"
        className="nav-dropdown__trigger"
        aria-haspopup="true"
        aria-expanded={active ? "true" : "false"}
      >
        Dashboard
        <span className="nav-dropdown__chevron" aria-hidden>
          ▾
        </span>
      </button>
      <div className="nav-dropdown__panel" role="menu">
        {DASHBOARD_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="nav-dropdown__link"
            role="menuitem"
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
