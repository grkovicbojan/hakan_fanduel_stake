export const DASHBOARD_NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/settings", label: "Settings" },
  { to: "/alert", label: "Alerts" },
];

export function isDashboardNavActive(pathname) {
  return DASHBOARD_NAV_ITEMS.some(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`)
  );
}
