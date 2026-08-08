import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { SortHeader, TableFilter, TablePager, useTableControls } from "../components/TableControls.jsx";
import { handleFormEnterKeyDown } from "../lib/formEnter.js";

const initialForm = {
  url: "",
  type: "B",
  scrapeInterval: 10,
  refreshInterval: 300,
  comparisonWebsiteList: "",
  scrapeType: 0,
  apiKeys: ""
};

function rowToEditForm(row) {
  return {
    url: row.url,
    type: row.type,
    scrapeInterval: row.scrape_interval,
    refreshInterval: row.refresh_interval,
    comparisonWebsiteList: row.comparison_website_list ?? "",
    scrapeType: Number(row.scrape_type) === 1 ? 1 : 0,
    apiKeys: row.api_keys ?? ""
  };
}

function apiKeysConfiguredCount(text) {
  if (!text || typeof text !== "string") return 0;
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

function isStakeSiteRow(row) {
  return /stake\.(com|de)/i.test(row?.url || "");
}

function groupMatchRows(rows) {
  const map = new Map();
  for (const row of rows) {
    const w = row.website;
    if (!map.has(w)) map.set(w, []);
    map.get(w).push(row);
  }
  return Array.from(map.entries());
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

/** One website's match table, with its own sort and filter state. */
function MatchGroupTable({ website, items, groupIdx, nowMs, onOpenDetail }) {
  const table = useTableControls(items, {
    columns: {
      name: (item) => item.name ?? "",
      url: (item) => item.url ?? "",
      oddCount: (item) => Number(item.extracted_odd_count ?? 0),
      remaining: (item) => {
        const target = new Date(item.start_time).getTime();
        return Number.isFinite(target) ? target - nowMs : NaN;
      },
      lastScraped: (item) =>
        Number.isFinite(item.lastScrapedAgoSeconds) ? item.lastScrapedAgoSeconds : NaN,
      status: (item) => item.status ?? "",
    },
    search: (item) => `${item.name ?? ""} ${item.url ?? ""} ${item.status ?? ""}`,
  });

  return (
    <div className={`match-website-group ${groupIdx % 2 === 1 ? "match-website-group--alt" : ""}`}>
      <div className="match-website-group__title">{website}</div>
      <TableFilter controls={table} placeholder={`Filter ${website} matches…`} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortHeader controls={table} col="name">Name</SortHeader>
              <SortHeader controls={table} col="url">Detailed Match Url</SortHeader>
              <SortHeader controls={table} col="oddCount">ExtractedOddCount</SortHeader>
              <SortHeader controls={table} col="remaining">Remaining Time To Start</SortHeader>
              <SortHeader controls={table} col="lastScraped">LastScraped</SortHeader>
              <SortHeader controls={table} col="status">Status</SortHeader>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((item) => {
              const ago = Number.isFinite(item.lastScrapedAgoSeconds) ? item.lastScrapedAgoSeconds : null;
              const ok = item.status === "ok";
              return (
                <tr key={`${item.website}|${item.url}`}>
                  <td>{item.name}</td>
                  <td>
                    <button type="button" className="linklike" onClick={() => onOpenDetail(item.url)}>
                      {item.url}
                    </button>
                  </td>
                  <td>{item.extracted_odd_count ?? 0}</td>
                  <td>{formatRemainingToStart(item.start_time, nowMs)}</td>
                  <td>{ago === null ? "—" : `${ago}s ago`}</td>
                  <td>
                    <span className={ok ? "status-dot status-dot--ok" : "status-dot status-dot--stale"} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <TablePager controls={table} />
    </div>
  );
}

export default function Settings() {
  const [rows, setRows] = useState([]);
  const [stakeSyncWebsiteId, setStakeSyncWebsiteId] = useState("");
  const [stakeSyncApiKeyOverride, setStakeSyncApiKeyOverride] = useState("");
  const [stakeSyncBusy, setStakeSyncBusy] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [edit, setEdit] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [matchOverviewRows, setMatchOverviewRows] = useState([]);
  const [matchOverviewLoading, setMatchOverviewLoading] = useState(false);
  const [detailMatchUrl, setDetailMatchUrl] = useState(null);
  const [oddRows, setOddRows] = useState([]);
  const [oddLoading, setOddLoading] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const pollingInFlightRef = useRef(false);

  const refreshSettings = useCallback(() => api.getSettings().then(setRows).catch(() => {}), []);

  const refreshMatchOverview = useCallback((silent = false) => {
    if (!silent) setMatchOverviewLoading(true);
    return api
      .getMatchWebsitesOverview()
      .then((r) => setMatchOverviewRows(r ?? []))
      .catch(() => setMatchOverviewRows([]))
      .finally(() => {
        if (!silent) setMatchOverviewLoading(false);
      });
  }, []);

  const reloadAll = useCallback(
    async (silent = false) => {
      await Promise.all([refreshSettings(), refreshMatchOverview(silent)]);
    },
    [refreshMatchOverview, refreshSettings]
  );

  useEffect(() => {
    let cancelled = false;
    const runPoll = async (silent) => {
      if (pollingInFlightRef.current) return;
      pollingInFlightRef.current = true;
      try {
        await reloadAll(silent);
      } finally {
        pollingInFlightRef.current = false;
      }
    };
    void runPoll(false);
    const id = window.setInterval(() => {
      if (!cancelled) void runPoll(true);
    }, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [reloadAll]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!detailMatchUrl) {
      setOddRows([]);
      return;
    }
    setOddLoading(true);
    setOddRows([]);
    api
      .getOddsByMatchUrl(detailMatchUrl)
      .then((r) => setOddRows(r ?? []))
      .catch(() => setOddRows([]))
      .finally(() => setOddLoading(false));
  }, [detailMatchUrl]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      setEdit(null);
      setEditForm(null);
      setDetailMatchUrl(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const matchGroups = useMemo(() => groupMatchRows(matchOverviewRows), [matchOverviewRows]);

  const websitesTable = useTableControls(rows, {
    columns: {
      status: (row) => row.status ?? "",
      lastScraped: (row) =>
        Number.isFinite(row.lastScrapedAgoSeconds) ? row.lastScrapedAgoSeconds : NaN,
      url: (row) => row.url ?? "",
      type: (row) => row.type ?? "",
      scrapeInterval: (row) => Number(row.scrape_interval),
      refreshInterval: (row) => Number(row.refresh_interval),
      comparison: (row) => row.comparison_website_list ?? "",
      scrapeType: (row) => row.scrape_type ?? "",
      apiKeys: (row) => apiKeysConfiguredCount(row.api_keys),
    },
    search: (row) =>
      `${row.url ?? ""} ${row.type ?? ""} ${row.scrape_type ?? ""} ${
        row.comparison_website_list ?? ""
      } ${row.status ?? ""}`,
  });

  const oddRowsTable = useTableControls(oddRows, {
    columns: {
      category: (row) => row.category ?? "",
      value: (row) => Number(row.value),
      timestamp: (row) => (row.timestamp ? new Date(row.timestamp).getTime() : NaN),
    },
    search: (row) => `${row.category ?? ""} ${row.value ?? ""}`,
  });

  const create = async () => {
    await api.createSetting(form);
    setForm(initialForm);
    await reloadAll(true);
  };

  const remove = async (id) => {
    await api.deleteSetting(id);
    await reloadAll(true);
  };

  const openEdit = (row) => {
    setEdit(row.id);
    setEditForm(rowToEditForm(row));
  };

  const syncStakeNbaFixtures = async () => {
    setStakeSyncBusy(true);
    try {
      const wid = stakeSyncWebsiteId.trim();
      const key = stakeSyncApiKeyOverride.trim();
      await api.postStakeSyncNbaFixtures({
        ...(wid ? { websiteId: wid } : {}),
        ...(key ? { apiKey: key } : {})
      });
      setStakeSyncApiKeyOverride("");
      await refreshMatchOverview(true);
    } finally {
      setStakeSyncBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!edit || !editForm) return;
    await api.updateSetting(edit, {
      url: editForm.url,
      type: editForm.type,
      scrapeInterval: editForm.scrapeInterval,
      refreshInterval: editForm.refreshInterval,
      comparisonWebsiteList: editForm.comparisonWebsiteList,
      scrapeType: editForm.scrapeType,
      apiKeys: editForm.apiKeys
    });
    setEdit(null);
    setEditForm(null);
    await reloadAll(true);
  };

  return (
    <section className="tool-page">
      <h2>Stake Odds Data API</h2>
      <p className="muted small">
        Per website below: set <strong>Scrape type</strong> to API for Stake rows that should use{" "}
        <a href="https://odds-data.stake.com/" target="_blank" rel="noreferrer">
          odds-data.stake.com
        </a>{" "}
        (<a href="https://docs-odds-data.stake.com/" target="_blank" rel="noreferrer">
          docs
        </a>
        ). Enter one or more API keys (comma or newline separated) in <strong>API keys</strong> to spread rate
        limits. Optional env fallback: <code>STAKE_ODDS_API_KEY</code>.
      </p>
      <div className="form-grid" data-enter-group onKeyDown={handleFormEnterKeyDown}>
        <label className="row">
          <span className="muted small">Sync NBA fixtures into match list for</span>
          <select
            value={stakeSyncWebsiteId}
            onChange={(e) => setStakeSyncWebsiteId(e.target.value)}
            aria-label="Stake website for NBA sync"
          >
            <option value="">Auto (first Stake row with API scrape type, else first Stake)</option>
            {rows.filter(isStakeSiteRow).map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.url} (scrape_type={r.scrape_type}, keys={apiKeysConfiguredCount(r.api_keys)})
              </option>
            ))}
          </select>
        </label>
        <input
          type="password"
          autoComplete="off"
          placeholder="One-shot API key override (optional)"
          value={stakeSyncApiKeyOverride}
          onChange={(e) => setStakeSyncApiKeyOverride(e.target.value)}
        />
        <button type="button" disabled={stakeSyncBusy} onClick={syncStakeNbaFixtures}>
          {stakeSyncBusy ? "Syncing…" : "Sync NBA fixtures"}
        </button>
      </div>

      <h2>Website Infos</h2>
      <div className="form-grid" data-enter-group onKeyDown={handleFormEnterKeyDown}>
        <input
          placeholder="Url"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
        />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="B">B</option>
          <option value="C">C</option>
        </select>
        <input
          type="number"
          value={form.scrapeInterval}
          onChange={(e) => setForm({ ...form, scrapeInterval: Number(e.target.value) })}
        />
        <input
          type="number"
          value={form.refreshInterval}
          onChange={(e) => setForm({ ...form, refreshInterval: Number(e.target.value) })}
        />
        <input
          placeholder="Comparison list comma separated"
          value={form.comparisonWebsiteList}
          onChange={(e) => setForm({ ...form, comparisonWebsiteList: e.target.value })}
        />
        <select
          value={form.scrapeType}
          onChange={(e) => setForm({ ...form, scrapeType: Number(e.target.value) })}
          aria-label="Scrape type"
        >
          <option value={0}>Scrape (0)</option>
          <option value={1}>API (1)</option>
        </select>
        <textarea
          placeholder="API keys (comma or newline); empty if scrape"
          rows={2}
          value={form.apiKeys}
          onChange={(e) => setForm({ ...form, apiKeys: e.target.value })}
        />
        <button type="button" onClick={create}>
          Add
        </button>
      </div>
      <TableFilter controls={websitesTable} placeholder="Filter websites…" />
      <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <SortHeader controls={websitesTable} col="status">Status</SortHeader>
            <SortHeader controls={websitesTable} col="lastScraped">LastScraped</SortHeader>
            <SortHeader controls={websitesTable} col="url">Url</SortHeader>
            <SortHeader controls={websitesTable} col="type">Type</SortHeader>
            <SortHeader controls={websitesTable} col="scrapeInterval">ScrapeInterval</SortHeader>
            <SortHeader controls={websitesTable} col="refreshInterval">RefreshInterval</SortHeader>
            <SortHeader controls={websitesTable} col="comparison">Comparison List</SortHeader>
            <SortHeader controls={websitesTable} col="scrapeType">Scrape type</SortHeader>
            <SortHeader controls={websitesTable} col="apiKeys">API keys</SortHeader>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {websitesTable.rows.map((row) => {
            const mainAgo = Number.isFinite(row.lastScrapedAgoSeconds) ? row.lastScrapedAgoSeconds : null;
            return (
              <tr key={row.id}>
                <td>{row.status === "ok" ? "🟢" : "🔴"}</td>
                <td>{mainAgo === null ? "—" : `${mainAgo}s ago`}</td>
                <td>{row.url}</td>
                <td>{row.type}</td>
                <td>{row.scrape_interval}</td>
                <td>{row.refresh_interval}</td>
                <td>{row.comparison_website_list}</td>
                <td>{row.scrape_type}</td>
                <td>
                  {apiKeysConfiguredCount(row.api_keys) > 0
                    ? `${apiKeysConfiguredCount(row.api_keys)} key(s)`
                    : "—"}
                </td>
                <td>
                  <button type="button" onClick={() => openEdit(row)}>
                    Edit
                  </button>{" "}
                  <button type="button" onClick={() => remove(row.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      <TablePager controls={websitesTable} />

      <h2>Match Info Based on Website</h2>
      <p className="muted small">
        All sub-URLs from match_website_infos, grouped by main website. Status uses last odds update (extension scrape
        or Stake API) vs <code>scrapeInterval</code> for that main site.
      </p>
      {matchOverviewLoading ? (
        <p>Loading…</p>
      ) : matchOverviewRows.length === 0 ? (
        <p>No rows in match_website_infos yet.</p>
      ) : (
        matchGroups.map(([website, items], groupIdx) => (
          <MatchGroupTable
            key={website}
            website={website}
            items={items}
            groupIdx={groupIdx}
            nowMs={nowMs}
            onOpenDetail={setDetailMatchUrl}
          />
        ))
      )}

      {edit != null && editForm != null ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setEdit(null)}>
          <div className="modal-panel" role="dialog" data-enter-group onKeyDown={handleFormEnterKeyDown} onClick={(e) => e.stopPropagation()}>
            <h3>Edit website</h3>
            <div className="modal-form">
              <label>
                Url
                <input
                  value={editForm.url}
                  onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                />
              </label>
              <label>
                Type
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                >
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              </label>
              <label>
                Scrape interval (s)
                <input
                  type="number"
                  value={editForm.scrapeInterval}
                  onChange={(e) =>
                    setEditForm({ ...editForm, scrapeInterval: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Refresh interval (s)
                <input
                  type="number"
                  value={editForm.refreshInterval}
                  onChange={(e) =>
                    setEditForm({ ...editForm, refreshInterval: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Comparison sites (comma separated)
                <input
                  value={editForm.comparisonWebsiteList}
                  onChange={(e) =>
                    setEditForm({ ...editForm, comparisonWebsiteList: e.target.value })
                  }
                />
              </label>
              <label>
                Scrape type (0 = scrape, 1 = API)
                <select
                  value={editForm.scrapeType}
                  onChange={(e) =>
                    setEditForm({ ...editForm, scrapeType: Number(e.target.value) })
                  }
                >
                  <option value={0}>Scrape (0)</option>
                  <option value={1}>API (1)</option>
                </select>
              </label>
              <label>
                API keys (comma or newline; multiple for rate limits)
                <textarea
                  rows={4}
                  value={editForm.apiKeys}
                  onChange={(e) => setEditForm({ ...editForm, apiKeys: e.target.value })}
                />
              </label>
            </div>
            <div className="row">
              <button type="button" onClick={saveEdit}>
                Save
              </button>
              <button type="button" onClick={() => setEdit(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detailMatchUrl != null ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setDetailMatchUrl(null)}>
          <div className="modal-panel modal-wide" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Odd Infos</h3>
            <p className="muted">{detailMatchUrl}</p>
            {oddLoading ? (
              <p>Loading…</p>
            ) : oddRows.length > 0 ? (
              <>
              <TableFilter controls={oddRowsTable} placeholder="Filter odds…" />
              <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <SortHeader controls={oddRowsTable} col="category">Category</SortHeader>
                    <SortHeader controls={oddRowsTable} col="value">Value</SortHeader>
                    <SortHeader controls={oddRowsTable} col="timestamp">Timestamp</SortHeader>
                  </tr>
                </thead>
                <tbody>
                  {oddRowsTable.rows.map((item, index) => (
                    <tr key={`${item.url}|${item.category}|${index}`}>
                      <td>{item.category}</td>
                      <td>{item.value}</td>
                      <td>{item.timestamp ? new Date(item.timestamp).toLocaleString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <TablePager controls={oddRowsTable} />
              </>
            ) : (
              <p>No rows in odd_infos for this match URL yet.</p>
            )}
            <div className="row">
              <button type="button" onClick={() => setDetailMatchUrl(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
