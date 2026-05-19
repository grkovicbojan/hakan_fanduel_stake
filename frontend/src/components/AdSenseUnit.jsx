import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { ADSENSE_CLIENT, ADSENSE_SLOT, ensureAdSenseScript, isAdSenseContentRoute } from "../lib/adsense.js";

/**
 * Renders a display ad only on publisher-content routes (not on dashboard/tools).
 */
export default function AdSenseUnit({ className = "" }) {
  const { pathname } = useLocation();
  const pushedRef = useRef(false);
  const show = isAdSenseContentRoute(pathname);

  useEffect(() => {
    pushedRef.current = false;
  }, [pathname]);

  useEffect(() => {
    if (!show) {
      return;
    }
    let cancelled = false;

    ensureAdSenseScript()
      .then(() => {
        if (cancelled || pushedRef.current) return;
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          pushedRef.current = true;
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [show, pathname]);

  if (!show) return null;

  return (
    <div className={`adsense-wrap ${className}`.trim()}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={ADSENSE_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
