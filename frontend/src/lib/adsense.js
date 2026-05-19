/** Routes where display ads are allowed (publisher content pages only). */
export const ADSENSE_CLIENT = "ca-pub-3940185689979323";
export const ADSENSE_SLOT = "2649405178";

const CONTENT_ROUTES = new Set([
  "/",
  "/about",
  "/how-it-works",
  "/guides",
  "/privacy",
  "/terms",
  "/contact"
]);

export function isAdSenseContentRoute(pathname) {
  if (CONTENT_ROUTES.has(pathname)) return true;
  return pathname.startsWith("/guides/");
}

let scriptLoading = null;

/** Load AdSense script once; ad units are only mounted on content routes. */
export function ensureAdSenseScript() {
  if (typeof document === "undefined") return Promise.resolve();
  if (document.querySelector('script[src*="adsbygoogle.js"]')) return Promise.resolve();
  if (scriptLoading) return scriptLoading;

  scriptLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("AdSense script failed to load"));
    document.head.appendChild(s);
  });

  return scriptLoading;
}
