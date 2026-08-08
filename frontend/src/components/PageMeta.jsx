import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { guideBySlug } from "../content/guides.js";
import { metaForPath } from "../lib/siteMeta.js";

const SITE_NAME = "SportBet Odds Comparator";
const SITE_URL = "https://sport.weienwong.online";

function upsertMeta(selector, attr, name, content) {
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export default function PageMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const base = metaForPath(pathname);
    const guideMatch = pathname.match(/^\/guides\/([^/]+)$/);
    let title = base.title;
    let description = base.description;

    if (guideMatch) {
      const g = guideBySlug(guideMatch[1]);
      if (g) {
        title = g.title;
        description = g.summary;
      }
    }

    document.title = `${title} | ${SITE_NAME}`;

    let desc = document.querySelector('meta[name="description"]');
    if (!desc) {
      desc = document.createElement("meta");
      desc.setAttribute("name", "description");
      document.head.appendChild(desc);
    }
    desc.setAttribute("content", description);

    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute(
      "content",
      base.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"
    );

    // Canonical must track the active route — otherwise every page reports as a
    // duplicate of whatever URL was baked into index.html.
    const canonicalUrl = `${SITE_URL}${pathname === "/" ? "/" : pathname.replace(/\/$/, "")}`;
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", canonicalUrl);

    const fullTitle = `${title} | ${SITE_NAME}`;
    upsertMeta('meta[property="og:title"]', "property", "og:title", fullTitle);
    upsertMeta('meta[property="og:description"]', "property", "og:description", description);
    upsertMeta('meta[property="og:url"]', "property", "og:url", canonicalUrl);
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", fullTitle);
    upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
  }, [pathname]);

  return null;
}
