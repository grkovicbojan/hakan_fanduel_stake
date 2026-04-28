import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { createDashboardSocket } from "../lib/ws.js";

const PAGE_SIZE = 50;

function keyOf(row) {
  return `${row.name}|${row.baseline_match_url}|${row.comparison_match_url}|${row.category}`;
}

/** 5–10 visible characters: strip https/http/www, prefer first hostname label, else host + path. */
function shortSiteLabel(url) {
  const min = 5;
  const max = 10;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, "");
    const path0 = (u.pathname.split("/").filter(Boolean)[0] || "").replace(/[^a-z0-9_-]/gi, "");
    const firstLabel = host.split(".")[0] || host;
    let label = firstLabel.slice(0, max);
    if (label.length >= min) return label;
    if (host.length >= min) return host.slice(0, max);
    const glued = (host.replace(/\./g, "") + path0).slice(0, max);
    if (glued.length >= min) return glued;
    return (host + path0).slice(0, max) || host.slice(0, max);
  } catch {
    const stripped = url
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split(/[/?#]/)[0];
    const t = stripped.split(".")[0] || stripped;
    return t.length >= min ? t.slice(0, max) : stripped.slice(0, max);
  }
}

function WebsiteDetail({ w, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-panel modal-wide" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="website-card website-card-modal">
          <div className="website-card-head">
            <span className="website-status" data-ok={w.status === "ok"}>
              {w.status === "ok" ? "Healthy (within refresh window)" : "Stale / not scraped"}
            </span>
            <span className="website-type">Type {w.type}</span>
          </div>
          <div className="website-url">{w.url}</div>
          <div className="website-meta">
            Last scrape: {w.lastScrapedAt ? new Date(w.lastScrapedAt).toLocaleString() : "—"} ·
            Scrape interval: {w.scrape_interval}s · Refresh window: {w.refresh_interval}s · Matches
            in DB: {w.match_total} ({w.match_pending} pending compare)
          </div>
          <div className="website-relations">
            <strong>Relationships</strong>
            <p className="muted small">
              Linked in <code>match_infos</code> where <code>baseline_url</code> or{" "}
              <code>comparison_url</code> equals this site. Comparison targets from{" "}
              <code>comparison_website_list</code>:
            </p>
            {w.comparison_urls.length === 0 ? (
              <p className="muted small">None listed.</p>
            ) : (
              <ul className="rel-list">
                {w.comparison_urls.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="row">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [currentOddsData, setCurrentOddsData] = useState([]);
  const [oldOddsData, setOldOddsData] = useState([]);
  const [websiteOverview, setWebsiteOverview] = useState(null);
  const [detailWebsite, setDetailWebsite] = useState(null);
  const [disableOdds10mDeadline, setDisableOdds10mDeadline] = useState(false);
  const [thresholdInput, setThresholdInput] = useState("0");
  const threshold = useMemo(() => {
    const n = Number.parseFloat(thresholdInput);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, n);
  }, [thresholdInput]);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setOldOddsData([]);
    api
      .getDashboard({ threshold })
      .then((payload) => {
        setCurrentOddsData(payload.rows ?? []);
        setDisableOdds10mDeadline(Boolean(payload.disableOdds10mDeadline));
      })
      .catch(() => {});
    api.getDashboardWebsites().then(setWebsiteOverview).catch(() => {});
    const socket = createDashboardSocket((payload) => {
      setOldOddsData((prevCurrent) => prevCurrent);
      setCurrentOddsData(payload.rows ?? []);
      setDisableOdds10mDeadline(Boolean(payload.disableOdds10mDeadline));
    }, threshold);
    return () => socket.close();
  }, [threshold]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      setDetailWebsite(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const oldMap = useMemo(() => {
    const map = new Map();
    for (const row of oldOddsData) {
      map.set(keyOf(row), row.arbitrage);
    }
    return map;
  }, [oldOddsData]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return currentOddsData;
    return currentOddsData.filter((row) =>
      [row.name, row.category, row.baseline_match_url, row.comparison_match_url]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [filter, currentOddsData]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <section>
      <h2>Configured websites</h2>
      {websiteOverview == null ? (
        <p className="muted">Loading website overview…</p>
      ) : websiteOverview.total === 0 ? (
        <p className="muted">No rows in website_infos yet. Add sites under Settings.</p>
      ) : (
        <div className="website-toolbar">
          <p className="overview-total">
            <strong>{websiteOverview.total}</strong> site
            {websiteOverview.total === 1 ? "" : "s"} — click a pill for details.
          </p>
          <div className="website-pill-row">
            {websiteOverview.websites.map((w) => (
              <button
                key={w.id}
                type="button"
                className="website-pill"
                data-ok={w.status === "ok"}
                title={w.url}
                aria-label={`${w.status === "ok" ? "Scrape healthy" : "Scrape stale"}, type ${w.type}, ${w.url}`}
                onClick={() => setDetailWebsite(w)}
              >
                <span className="status-dot" aria-hidden />
                <span className="pill-type">Type {w.type}</span>
                <span className="pill-label">{shortSiteLabel(w.url)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {detailWebsite != null ? (
        <WebsiteDetail w={detailWebsite} onClose={() => setDetailWebsite(null)} />
      ) : null}

      <h2>
        Odds{" "}
        {disableOdds10mDeadline ? "(all compared rows)" : "(last 10 minutes)"}
      </h2>
      <div className="row">
        <label>Filter:</label>
        <input
          placeholder="Filter matches/categories/urls"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
            setPage(1);
          }}
        />
        <label>Threshold:</label>
        <input
          type="number"
          min={0}
          step="0.01"
          placeholder="Threshold %"
          value={thresholdInput}
          onChange={(event) => {
            setThresholdInput(event.target.value);
            setPage(1);
          }}
          onBlur={() => {
            const n = Number.parseFloat(thresholdInput);
            setThresholdInput(Number.isFinite(n) ? String(Math.max(0, n)) : "0");
          }}
          title="Show rows where comparison odd > baseline odd * (1 + threshold/100)"
        />
      </div>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Name</th>
            <th>BaselineMatchUrl</th>
            <th>ComparisonMatchUrl</th>
            <th>Category</th>
            <th>BaselineValue</th>
            <th>BaselineTime</th>
            <th>ComparisonValue</th>
            <th>ComparisonTime</th>
            <th>Arbitrage(%)</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row) => {
            const previous = oldMap.get(keyOf(row));
            const up = previous == null ? true : row.arbitrage > previous;
            return (
              <tr key={keyOf(row)}>
                <td>{up ? "🔼" : "🔽"}</td>
                <td>{row.name}</td>
                <td><a href={row.baseline_match_url} target="_blank" rel="noopener noreferrer">Base Match Url</a></td>
                <td><a href={row.comparison_match_url} target="_blank" rel="noopener noreferrer">Compared Match Url</a></td>
                <td>{row.category}</td>
                <td>{Number(row.baseline_value).toFixed(2)}</td>
                <td>{new Date(row.baseline_timestamp).toLocaleString()}</td>
                <td>{Number(row.comparison_value).toFixed(2)}</td>
                <td>{new Date(row.comparison_timestamp).toLocaleString()}</td>
                <td>{Number(row.arbitrage).toFixed(4)}</td>
                <td>{new Date(row.timestamp).toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="row">
        <button type="button" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)}>
          Prev
        </button>
        <span>
          Page {safePage}/{pageCount}
        </span>
        <button type="button" disabled={safePage >= pageCount} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>
    </section>
  );
}
