import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.js";

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
    <section>
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
      <div className="form-grid">
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
      <div className="form-grid">
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
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>LastScraped</th>
            <th>Url</th>
            <th>Type</th>
            <th>ScrapeInterval</th>
            <th>RefreshInterval</th>
            <th>Comparison List</th>
            <th>Scrape type</th>
            <th>API keys</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
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
          <div
            key={website}
            className={`match-website-group ${groupIdx % 2 === 1 ? "match-website-group--alt" : ""}`}
          >
            <div className="match-website-group__title">{website}</div>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Detailed Match Url</th>
                  <th>ExtractedOddCount</th>
                  <th>LastScraped</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const ago = Number.isFinite(item.lastScrapedAgoSeconds) ? item.lastScrapedAgoSeconds : null;
                  const ok = item.status === "ok";
                  return (
                    <tr key={`${item.website}|${item.url}`}>
                      <td>{item.name}</td>
                      <td>
                        <button
                          type="button"
                          className="linklike"
                          onClick={() => setDetailMatchUrl(item.url)}
                        >
                          {item.url}
                        </button>
                      </td>
                      <td>{item.extracted_odd_count ?? 0}</td>
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
        ))
      )}

      {edit != null && editForm != null ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setEdit(null)}>
          <div className="modal-panel" role="dialog" onClick={(e) => e.stopPropagation()}>
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
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Value</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {oddRows.map((item, index) => (
                    <tr key={`${item.url}|${item.category}|${index}`}>
                      <td>{item.category}</td>
                      <td>{item.value}</td>
                      <td>{item.timestamp ? new Date(item.timestamp).toLocaleString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
