/** Publisher content routes (ads + index allowed). */
export const CONTENT_ROUTES = new Set([
  "/",
  "/about",
  "/how-it-works",
  "/guides",
  "/faq",
  "/glossary",
  "/privacy",
  "/terms",
  "/contact"
]);

export const TOOL_ROUTE_PREFIXES = ["/dashboard", "/settings", "/alert"];

export function isContentRoute(pathname) {
  if (CONTENT_ROUTES.has(pathname)) return true;
  return pathname.startsWith("/guides/");
}

export function isToolRoute(pathname) {
  return TOOL_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const PAGE_META = {
  "/": {
    title: "Sports Market Research & Odds Education",
    description:
      "Free guides on odds formats, implied probability, and sports market research. Independent educational publisher—no wagering on this site."
  },
  "/about": {
    title: "About Us",
    description: "Mission, editorial standards, and who we serve. Independent sports market education."
  },
  "/how-it-works": {
    title: "How Market Comparison Works",
    description: "Methodology for comparing posted sports prices across sources—educational overview."
  },
  "/guides": {
    title: "Research Guides",
    description: "Long-form articles on odds, probability, player props, and responsible use."
  },
  "/faq": {
    title: "Frequently Asked Questions",
    description: "Answers about this site, our content, tools, advertising, and responsible use."
  },
  "/glossary": {
    title: "Glossary",
    description: "Definitions of common sports market and odds terminology for researchers."
  },
  "/privacy": { title: "Privacy Policy", description: "How we collect and use data, including cookies and AdSense." },
  "/terms": { title: "Terms of Use", description: "Terms for using weienwong.online and our educational content." },
  "/contact": { title: "Contact", description: "Contact SportBet Odds Comparator for content and privacy inquiries." },
  "/dashboard": {
    title: "Research Tools",
    description: "Optional data monitoring tools for configured research environments.",
    noindex: true
  },
  "/settings": { title: "Settings", description: "Tool configuration.", noindex: true },
  "/alert": { title: "Alerts", description: "Tool alerts.", noindex: true }
};

export function metaForPath(pathname) {
  if (PAGE_META[pathname]) return PAGE_META[pathname];
  const guideMatch = pathname.match(/^\/guides\/([^/]+)$/);
  if (guideMatch) {
    return {
      title: "Guide",
      description: "Educational article on sports market research.",
      noindex: false
    };
  }
  return { title: "SportBet Odds Comparator", description: "Sports market education.", noindex: false };
}
