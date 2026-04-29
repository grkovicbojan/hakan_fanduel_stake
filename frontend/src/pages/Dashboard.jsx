import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { createDashboardSocket } from "../lib/ws.js";

const PAGE_SIZE = 50;

function keyOf(row) {
  return `${row.name}|${row.baseline_match_url}|${row.comparison_match_url}|${row.category}`;
}

function formatRemainingToStart(startTimeIso, nowMs) {
  if (!startTimeIso) return "—";
  const target = new Date(startTimeIso).getTime();
  if (!Number.isFinite(target)) return "—";
  const diffMs = target - nowMs;
  if (diffMs <= 0) return "Started";
  const totalSec = Math.floor(diffMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
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
  const activeThresholdRef = useRef(0);
  const [websiteOverview, setWebsiteOverview] = useState(null);
  const [detailWebsite, setDetailWebsite] = useState(null);
  const [disableOdds10mDeadline, setDisableOdds10mDeadline] = useState(false);
  const [thresholdInput, setThresholdInput] = useState("0");
  const [threshold, setThreshold] = useState(0);
  const [filterEnabled, setFilterEnabled] = useState(true);
  const [filter, setFilter] = useState("");
  const [sortByArbitrageEnabled, setSortByArbitrageEnabled] = useState(true);
  const [sortByNewlyAddedEnabled, setSortByNewlyAddedEnabled] = useState(true);
  const [sortByRemainingEnabled, setSortByRemainingEnabled] = useState(true);
  const [arbitrageOrder, setArbitrageOrder] = useState("desc");
  const [newlyAddedOrder, setNewlyAddedOrder] = useState("desc");
  const [remainingOrder, setRemainingOrder] = useState("desc");
  const [newlyAddedMinutesInput, setNewlyAddedMinutesInput] = useState("10");
  const [newlyAddedMinutes, setNewlyAddedMinutes] = useState(10);
  const [page, setPage] = useState(1);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const applyThresholdFromInput = () => {
    const n = Number.parseFloat(thresholdInput);
    const next = Number.isFinite(n) ? Math.max(0, n) : 0;
    setThresholdInput(String(next));
    setThreshold(next);
    setPage(1);
  };
  const applyNewlyAddedMinutesFromInput = () => {
    const n = Number.parseFloat(newlyAddedMinutesInput);
    const next = Number.isFinite(n) ? Math.max(0, n) : 0;
    setNewlyAddedMinutesInput(String(next));
    setNewlyAddedMinutes(next);
    setPage(1);
  };
  const appliedThreshold = filterEnabled ? threshold : 0;

  useEffect(() => {
    activeThresholdRef.current = appliedThreshold;
    setCurrentOddsData([]);
    setOldOddsData([]);
    const applyPayload = (payload) => {
      const payloadThreshold = Math.max(0, Number(payload?.threshold ?? appliedThreshold) || 0);
      // Ignore late updates from an older threshold subscription.
      if (payloadThreshold !== activeThresholdRef.current) return;
      setCurrentOddsData((prevCurrent) => {
        setOldOddsData(prevCurrent);
        return payload.rows ?? [];
      });
      setDisableOdds10mDeadline(Boolean(payload.disableOdds10mDeadline));
    };

    api
      .getDashboard({ threshold: appliedThreshold })
      .then(applyPayload)
      .catch(() => { });
    const pollId = window.setInterval(() => {
      api.getDashboard({ threshold: appliedThreshold }).then(applyPayload).catch(() => { });
    }, 5000);
    api.getDashboardWebsites().then(setWebsiteOverview).catch(() => { });
    const socket = createDashboardSocket((payload) => {
      applyPayload(payload);
    }, appliedThreshold);
    return () => {
      window.clearInterval(pollId);
      socket.close();
    };
  }, [appliedThreshold]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      setDetailWebsite(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const oldMap = useMemo(() => {
    const map = new Map();
    for (const row of oldOddsData) {
      map.set(keyOf(row), row.arbitrage);
    }
    return map;
  }, [oldOddsData]);

  const filtered = useMemo(() => {
    if (!filterEnabled) return currentOddsData;
    const q = filter.trim().toLowerCase();
    if (!q) return currentOddsData;
    return currentOddsData.filter((row) =>
      [row.name, row.category, row.baseline_match_url, row.comparison_match_url]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [filterEnabled, filter, currentOddsData]);

  const sorted = useMemo(() => {
    if (!sortByArbitrageEnabled && !sortByNewlyAddedEnabled && !sortByRemainingEnabled) return filtered;
    const list = [...filtered];
    const dirArb = arbitrageOrder === "asc" ? 1 : -1;
    const dirNew = newlyAddedOrder === "asc" ? 1 : -1;
    const dirRemain = remainingOrder === "asc" ? 1 : -1;
    const createdSortValue = (row) => {
      const t = new Date(row.timestamp).getTime();
      if (!Number.isFinite(t)) return Number.NEGATIVE_INFINITY;
      return t;
    };
    const remainingSortValue = (row) => {
      const t = new Date(row.start_time).getTime();
      if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
      return t - nowMs;
    };
    list.sort((a, b) => {
      if (sortByArbitrageEnabled) {
        const arbA = Number(Number(a.arbitrage).toFixed(2));
        const arbB = Number(Number(b.arbitrage).toFixed(2));
        if (arbA !== arbB) return (arbA - arbB) * dirArb;
      }
      if (sortByNewlyAddedEnabled) {
        const newA = createdSortValue(a);
        const newB = createdSortValue(b);
        if (newA !== newB) return (newA - newB) * dirNew;
      }
      if (sortByRemainingEnabled) {
        const remA = remainingSortValue(a);
        const remB = remainingSortValue(b);
        if (remA !== remB) return (remA - remB) * dirRemain;
      }
      return 0;
    });
    return list;
  }, [
    filtered,
    sortByArbitrageEnabled,
    sortByNewlyAddedEnabled,
    sortByRemainingEnabled,
    arbitrageOrder,
    newlyAddedOrder,
    remainingOrder,
    nowMs
  ]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const isNewlyAddedRow = (row) => {
    const createdMs = new Date(row.timestamp).getTime();
    if (!Number.isFinite(createdMs)) return false;
    return nowMs - createdMs <= newlyAddedMinutes * 60 * 1000;
  };

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
        <label>Arbitrage:</label>
        <label>
          <input
            type="checkbox"
            checked={sortByArbitrageEnabled}
            onChange={(event) => {
              setSortByArbitrageEnabled(event.target.checked);
              setPage(1);
            }}
          />{" "}
          Sort
        </label>
        <select
          disabled={!sortByArbitrageEnabled}
          value={arbitrageOrder}
          onChange={(event) => {
            setArbitrageOrder(event.target.value);
            setPage(1);
          }}
        >
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>

        <label>Newly Added:</label>
        <label>
          <input
            type="checkbox"
            checked={sortByNewlyAddedEnabled}
            onChange={(event) => {
              setSortByNewlyAddedEnabled(event.target.checked);
              setPage(1);
            }}
          />{" "}
          Sort
        </label>
        <select
          disabled={!sortByNewlyAddedEnabled}
          value={newlyAddedOrder}
          onChange={(event) => {
            setNewlyAddedOrder(event.target.value);
            setPage(1);
          }}
        >
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
        <label>Remaining Time:</label>
        <label>
          <input
            type="checkbox"
            checked={sortByRemainingEnabled}
            onChange={(event) => {
              setSortByRemainingEnabled(event.target.checked);
              setPage(1);
            }}
          />{" "}
          Sort
        </label>
        <select
          disabled={!sortByRemainingEnabled}
          value={remainingOrder}
          onChange={(event) => {
            setRemainingOrder(event.target.value);
            setPage(1);
          }}
        >
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>

        <label>
          <input
            type="checkbox"
            checked={filterEnabled}
            onChange={(event) => {
              setFilterEnabled(event.target.checked);
              setPage(1);
            }}
          />{" "}
          Enable Filter
        </label>
        
        <label>Threshold:</label>
        <input
          type="number"
          min={0}
          step="0.01"
          placeholder="Threshold %"
          disabled={!filterEnabled}
          value={thresholdInput}
          onChange={(event) => {
            setThresholdInput(event.target.value);
          }}
          onBlur={applyThresholdFromInput}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            applyThresholdFromInput();
          }}
          title="Show rows where comparison odd > baseline odd * (1 + threshold/100)"
        />
        
        <label>Newly Added Odd (minutes):</label>
        <input
          type="number"
          min={0}
          step="1"
          value={newlyAddedMinutesInput}
          onChange={(event) => setNewlyAddedMinutesInput(event.target.value)}
          onBlur={applyNewlyAddedMinutesFromInput}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            applyNewlyAddedMinutesFromInput();
          }}
          title="Highlight rows created in last N minutes"
        />
        <label>Text:</label>
        <input
          placeholder="Filter matches/categories/urls"
          disabled={!filterEnabled}
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
            setPage(1);
          }}
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
            <th>Arbitrage(%)</th>
            <th>Remaining To Start</th>
            <th>BaselineValue</th>
            <th>ComparisonValue</th>
            <th>BaselineTime</th>
            <th>ComparisonTime</th>
            <th>CreatedAt</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row) => {
            const previous = oldMap.get(keyOf(row));
            const up = previous == null ? true : row.arbitrage > previous;
            return (
              <tr
                key={keyOf(row)}
                style={isNewlyAddedRow(row) ? { backgroundColor: "rgba(255, 235, 120, 0.20)" } : undefined}
              >
                <td>{up ? "🔼" : "🔽"}</td>
                <td>{row.name}</td>
                <td><a href={row.baseline_match_url} target="_blank" rel="noopener noreferrer" style={{ color: "#d6ecff" }}>Base Match Url</a></td>
                <td><a href={row.comparison_match_url} target="_blank" rel="noopener noreferrer" style={{ color: "#d6ecff" }}>Compared Match Url</a></td>
                <td>{row.category}</td>
                <td>{Number(row.arbitrage).toFixed(4)}</td>
                <td>{formatRemainingToStart(row.start_time, nowMs)}</td>                <td>{Number(row.baseline_value).toFixed(2)}</td>
                <td>{new Date(row.baseline_timestamp).toLocaleString()}</td>
                <td>{Number(row.comparison_value).toFixed(2)}</td>
                <td>{new Date(row.comparison_timestamp).toLocaleString()}</td>
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
