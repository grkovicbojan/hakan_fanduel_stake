import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { guideBySlug } from "../content/guides.js";
import { metaForPath } from "../lib/siteMeta.js";

const SITE_NAME = "SportBet Odds Comparator";

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
      base.noindex ? "noindex, nofollow" : "index, follow"
    );
  }, [pathname]);

  return null;
}
