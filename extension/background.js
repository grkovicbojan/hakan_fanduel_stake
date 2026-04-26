import { API_BASE } from "./config.js";

const SCHEDULER_ALARM = "schedulerTick";
const TICK_MS = 1000;
const SUB_TAB_LOAD_MAX_MS = 30_000;
const MAIN_TAB_LOAD_MAX_MS = 30_000;
/** `openTarget`: how many times to count selector targets; spaced by interval (~1s total window). */
const OPEN_TARGET_TARGET_POLLS = 5;
const OPEN_TARGET_POLL_INTERVAL_MS = 1250;
const TASK_HISTORY_MAX = 10;
const RETRY_OPEN_SUB_MS = 3000;
const RETRY_OPEN_TARGET_MS = 2000;
const RETRY_REFRESH_SUB_MS = 5000;

/** @typedef {number | ""} ChromeTabIdField */

/**
 * @typedef {{
 *   type: string,
 *   url: string,
 *   chromeTabId: ChromeTabIdField,
 *   timestamp: number,
 *   _seq?: number
 * }} Task
 */

const TASK_TYPES = {
  OpenMainWebsite: "OpenMainWebsite",
  OpenSubWebsite: "OpenSubWebsite",
  OpenTarget: "OpenTarget",
  ScrapeMainWebsite: "ScrapeMainWebsite",
  ScrapeSubWebsite: "ScrapeSubWebsite",
  RefreshMainWebsite: "RefreshMainWebsite",
  RefreshSubWebsite: "RefreshSubWebsite"
};

/** @type {Task[]} */
const TL = [];
let taskSeq = 0;

/** Newest first (for popup). @type {{ at: string, type: string, url: string, chromeTabId: ChromeTabIdField, scheduledFor: number, seq: number }[]} */
const taskAddedHistory = [];

/** Newest first: async handler settled. @type {{ at: string, type: string, url: string, chromeTabId: ChromeTabIdField, scheduledFor: number, seq: number, outcome: "ok" | "error", detail?: string }[]} */
const taskAccomplishedHistory = [];

/**
 * @param {{ at: string, type: string, url: string, chromeTabId: ChromeTabIdField, scheduledFor: number, seq: number }} row
 */
function recordTaskAdded(row) {
  taskAddedHistory.unshift(row);
  taskAddedHistory.splice(TASK_HISTORY_MAX);
}

/**
 * @param {{ at: string, type: string, url: string, chromeTabId: ChromeTabIdField, scheduledFor: number, seq: number, outcome: "ok" | "error", detail?: string }} row
 */
function recordTaskAccomplished(row) {
  taskAccomplishedHistory.unshift(row);
  taskAccomplishedHistory.splice(TASK_HISTORY_MAX);
}

/** @param {Task} task */
function taskSnapshotForHistory(task) {
  return {
    type: task.type,
    url: task.url,
    chromeTabId: task.chromeTabId === "" || task.chromeTabId == null ? "" : Number(task.chromeTabId),
    scheduledFor: Number(task.timestamp) || 0,
    seq: Number(task._seq) || 0
  };
}

/** Serialize all TL mutations / reads that must be consistent. */
let taskMutexTail = Promise.resolve();

/**
 * @template T
 * @param {() => Promise<T> | T} fn
 * @returns {Promise<T>}
 */
function runTaskLocked(fn) {
  const next = taskMutexTail.then(() => fn());
  taskMutexTail = next.catch(() => {});
  return next;
}

/**
 * @param {Task} task
 */
async function addTask(task) {
  await runTaskLocked(() => {
    const normalizedUrl = normalizeUrl(task.url);
    const normalizedTabId = task.chromeTabId === "" || task.chromeTabId == null ? "" : Number(task.chromeTabId);
    const normalizedTs = Number(task.timestamp) || 0;
    const dup = TL.find(
      (t) => t.type === task.type && normalizeUrl(t.url) === normalizedUrl
    );
    if (dup) {
      // Keep one pending task per (type, url), pulling due-time earlier when needed.
      const prevTs = dup.timestamp;
      dup.timestamp = Math.min(dup.timestamp, normalizedTs);
      if ((dup.chromeTabId === "" || dup.chromeTabId == null) && normalizedTabId !== "") {
        dup.chromeTabId = normalizedTabId;
      }
      TL.sort((a, b) => a.timestamp - b.timestamp || (a._seq || 0) - (b._seq || 0));
      console.log("[SportBet TL] addTask deduped", {
        type: dup.type,
        url: dup.url,
        seq: dup._seq,
        prevDueAt: prevTs,
        dueAt: dup.timestamp,
        queueLength: TL.length
      });
      return;
    }
    const entry = {
      type: task.type,
      url: task.url,
      chromeTabId: normalizedTabId,
      timestamp: normalizedTs,
      _seq: ++taskSeq
    };
    TL.push(entry);
    TL.sort((a, b) => a.timestamp - b.timestamp || (a._seq || 0) - (b._seq || 0));
    recordTaskAdded({
      at: new Date().toISOString(),
      type: entry.type,
      url: entry.url,
      chromeTabId: entry.chromeTabId,
      scheduledFor: entry.timestamp,
      seq: entry._seq
    });
    console.log("[SportBet TL] addTask", {
      type: entry.type,
      url: entry.url,
      seq: entry._seq,
      dueAt: entry.timestamp,
      queueLength: TL.length
    });
  });
  queuePersist();
}

/**
 * @returns {Promise<Task | null>}
 */
async function popTask() {
  const t = await runTaskLocked(() => {
    const popped = TL.shift() ?? null;
    if (popped) {
      console.log("[SportBet TL] popTask", {
        type: popped.type,
        url: popped.url,
        seq: popped._seq,
        remaining: TL.length
      });
    }
    return popped;
  });
  queuePersist();
  return t;
}

/**
 * @returns {Promise<Task | null>}
 */
async function getFirstTask() {
  return runTaskLocked(() => {
    const t = TL[0];
    return t ? { ...t } : null;
  });
}

/**
 * Remove every task whose normalized URL equals the given website URL.
 * @param {string} websiteUrl
 */
async function removeAllTask(websiteUrl) {
  const key = normalizeUrl(websiteUrl);
  const n = await runTaskLocked(() => {
    /** @type {{ type: string, url: string, seq?: number }[]} */
    const removed = [];
    for (let i = TL.length - 1; i >= 0; i--) {
      if (normalizeUrl(TL[i].url) !== key) continue;
      const row = TL[i];
      removed.push({ type: row.type, url: row.url, seq: row._seq });
      TL.splice(i, 1);
    }
    if (removed.length) {
      console.log("[SportBet TL] removeAllTask", {
        matchKey: key,
        requestedRaw: websiteUrl,
        removedCount: removed.length,
        removed
      });
    }
    return removed.length;
  });
  queuePersist();
  return n;
}

async function getTaskListLength() {
  return runTaskLocked(() => TL.length);
}

/**
 * @param {string} [reason]
 */
async function clearTaskList(reason = "") {
  await runTaskLocked(() => {
    const dropped = TL.map((x) => ({ type: x.type, url: x.url, seq: x._seq }));
    const n = dropped.length;
    TL.length = 0;
    if (n > 0) {
      // console.log("[SportBet TL] clearTaskList", { reason: reason || "(no reason)", droppedCount: n, dropped });
    } else {
      // console.log("[SportBet TL] clearTaskList", { reason: reason || "(no reason)", droppedCount: 0 });
    }
  });
  queuePersist();
}

const state = {
  running: false,
  connected: false,
  mainUrl: "",
  globalUrlData: { scrapeInterval: 10, refreshInterval: 300, urls: [] },
  oldUrlData: { scrapeInterval: 10, refreshInterval: 300, urls: [] },
  /** normalizedUrl -> tabId */
  tabByUrl: new Map(),
  /** @type {Map<string, { name: string, bootstrapped: boolean, anchorScrapeMs: number | null, anchorRefreshMs: number | null, targetOpened: boolean | null, lastTargetHitCount: number | null, lastScrapedAt: string | null, lastRefreshedAt: string | null, lastLoadingTimeMs: number | null }>} */
  subUrlStatus: new Map(),
  mainSchedule: {
    bootstrapped: false,
    lastScrapeAtMs: null,
    lastRefreshAtMs: null
  },
  lastSchedulerTickAt: null,
  lastSchedulerSummary: "—"
};

/** Used when storage is missing, corrupt, or restore fails (e.g. after reinstall). */
function resetMonitorStateDefaults() {
  state.running = false;
  state.connected = false;
  state.mainUrl = "";
  state.globalUrlData = { scrapeInterval: 10, refreshInterval: 300, urls: [] };
  state.oldUrlData = { scrapeInterval: 10, refreshInterval: 300, urls: [] };
  state.tabByUrl.clear();
  state.subUrlStatus.clear();
  state.mainSchedule = { bootstrapped: false, lastScrapeAtMs: null, lastRefreshAtMs: null };
  state.lastSchedulerTickAt = null;
  state.lastSchedulerSummary = "—";
  TL.length = 0;
  taskSeq = 0;
  taskAddedHistory.length = 0;
  taskAccomplishedHistory.length = 0;
}

let schedulerLock = false;

function normalizeUrl(url) {
  try {
    const u = new URL(String(url).trim());
    u.hash = "";
    let href = u.href;
    if (href.endsWith("/") && u.pathname !== "/") href = href.slice(0, -1);
    return href;
  } catch {
    return String(url).trim();
  }
}

function shortNameForUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, "");
    const seg = path.split("/").filter(Boolean).pop() || u.hostname;
    return seg.length > 48 ? `${seg.slice(0, 45)}…` : seg;
  } catch {
    return url.length > 48 ? `${url.slice(0, 45)}…` : url;
  }
}

function syncSubUrlStatusRows(urls) {
  const next = new Set(urls.map(normalizeUrl));
  for (const key of [...state.subUrlStatus.keys()]) {
    if (!next.has(key)) state.subUrlStatus.delete(key);
  }
  for (const url of urls) {
    const k = normalizeUrl(url);
    if (!state.subUrlStatus.has(k)) {
      state.subUrlStatus.set(k, {
        name: shortNameForUrl(url),
        bootstrapped: false,
        anchorScrapeMs: null,
        anchorRefreshMs: null,
        targetOpened: null,
        lastTargetHitCount: null,
        lastScrapedAt: null,
        lastRefreshedAt: null,
        lastLoadingTimeMs: null
      });
    }
  }
}

function buildSubUrlTablePayload() {
  const intervalSec = ensureMinimumInterval(state.oldUrlData.scrapeInterval);
  const staleMs = Math.max(intervalSec * 2.5 * 1000, 45_000);
  const now = Date.now();
  const rows = [];
  for (const url of state.oldUrlData.urls) {
    const k = normalizeUrl(url);
    const row = state.subUrlStatus.get(k);
    if (!row) continue;
    let stale = false;
    if (state.running && row.bootstrapped && row.anchorScrapeMs != null && now - row.anchorScrapeMs > staleMs) {
      stale = true;
    }
    rows.push({
      url,
      name: row.name,
      targetOpened: row.targetOpened,
      lastTargetHitCount: row.lastTargetHitCount,
      lastScrapedAt: row.lastScrapedAt,
      lastRefreshedAt: row.lastRefreshedAt,
      lastLoadingTimeMs: row.lastLoadingTimeMs,
      stale
    });
  }
  return { rows, staleAfterMs: staleMs };
}

async function healthcheck() {
  if (!state.mainUrl) {
    state.connected = false;
    return false;
  }
  const requestUrl = `${API_BASE}/api/health`;
  try {
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: state.mainUrl })
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    state.connected = payload?.data === "ok";
    return state.connected;
  } catch {
    state.connected = false;
    return false;
  }
}

function ensureMinimumInterval(seconds) {
  return Math.max(3, Number(seconds) || 10);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scrapeIntervalMs() {
  return ensureMinimumInterval(state.oldUrlData.scrapeInterval) * 1000;
}

function refreshIntervalMs() {
  return ensureMinimumInterval(state.oldUrlData.refreshInterval) * 1000;
}

/** Persisted across MV3 service worker restarts (chrome.storage.local). */
const PERSIST_KEY = "sportBetMonitorSessionV1";

/** @type {ReturnType<typeof setTimeout> | null} */
let persistDebounceTimer = null;

function queuePersist() {
  if (persistDebounceTimer != null) clearTimeout(persistDebounceTimer);
  persistDebounceTimer = setTimeout(() => {
    persistDebounceTimer = null;
    void persistStateToStorage();
  }, 400);
}

async function flushPersist() {
  if (persistDebounceTimer != null) {
    clearTimeout(persistDebounceTimer);
    persistDebounceTimer = null;
  }
  await persistStateToStorage();
}

async function persistStateToStorage() {
  if (!state.running) return;
  const urlsG = Array.isArray(state.globalUrlData?.urls) ? state.globalUrlData.urls : [];
  const urlsO = Array.isArray(state.oldUrlData?.urls) ? state.oldUrlData.urls : [];
  const payload = {
    v: 1,
    savedAt: Date.now(),
    running: state.running,
    mainUrl: state.mainUrl,
    globalUrlData: {
      scrapeInterval: state.globalUrlData.scrapeInterval,
      refreshInterval: state.globalUrlData.refreshInterval,
      urls: [...urlsG]
    },
    oldUrlData: {
      scrapeInterval: state.oldUrlData.scrapeInterval,
      refreshInterval: state.oldUrlData.refreshInterval,
      urls: [...urlsO]
    },
    mainSchedule: { ...state.mainSchedule },
    taskSeq,
    TL: TL.map((t) => ({
      type: t.type,
      url: t.url,
      chromeTabId: t.chromeTabId === "" || t.chromeTabId == null ? "" : Number(t.chromeTabId),
      timestamp: t.timestamp,
      _seq: t._seq
    })),
    tabByUrl: [...state.tabByUrl.entries()],
    subUrlStatus: [...state.subUrlStatus.entries()],
    taskAddedHistory: taskAddedHistory.map((r) => ({ ...r })),
    taskAccomplishedHistory: taskAccomplishedHistory.map((r) => ({ ...r }))
  };
  try {
    await chrome.storage.local.set({ [PERSIST_KEY]: payload });
  } catch (e) {
    console.warn("[SportBet TL] persistStateToStorage failed", e);
  }
}

/**
 * @returns {Promise<boolean>}
 */
async function restoreStateFromStorage() {
  let raw;
  try {
    raw = await chrome.storage.local.get(PERSIST_KEY);
  } catch (e) {
    console.warn("[SportBet TL] restoreStateFromStorage read failed", e);
    return false;
  }
  const p = raw[PERSIST_KEY];
  if (!p || p.v !== 1) return false;
  if (!p.running || !p.mainUrl) {
    await chrome.storage.local.remove(PERSIST_KEY).catch(() => {});
    return false;
  }

  if (!Array.isArray(p.TL)) {
    console.warn("[SportBet TL] restoreStateFromStorage: invalid TL, clearing snapshot");
    await chrome.storage.local.remove(PERSIST_KEY).catch(() => {});
    return false;
  }
  if (p.tabByUrl != null && !Array.isArray(p.tabByUrl)) {
    console.warn("[SportBet TL] restoreStateFromStorage: invalid tabByUrl, clearing snapshot");
    await chrome.storage.local.remove(PERSIST_KEY).catch(() => {});
    return false;
  }
  if (p.subUrlStatus != null && !Array.isArray(p.subUrlStatus)) {
    console.warn("[SportBet TL] restoreStateFromStorage: invalid subUrlStatus, clearing snapshot");
    await chrome.storage.local.remove(PERSIST_KEY).catch(() => {});
    return false;
  }

  try {
    state.running = true;
    state.mainUrl = normalizeUrl(p.mainUrl);
    state.globalUrlData = {
      scrapeInterval: ensureMinimumInterval(p.globalUrlData?.scrapeInterval),
      refreshInterval: ensureMinimumInterval(p.globalUrlData?.refreshInterval),
      urls: (Array.isArray(p.globalUrlData?.urls) ? p.globalUrlData.urls : []).map((u) => normalizeUrl(u))
    };
    state.oldUrlData = {
      scrapeInterval: ensureMinimumInterval(p.oldUrlData?.scrapeInterval),
      refreshInterval: ensureMinimumInterval(p.oldUrlData?.refreshInterval),
      urls: (Array.isArray(p.oldUrlData?.urls) ? p.oldUrlData.urls : []).map((u) => normalizeUrl(u))
    };
    state.mainSchedule = {
      bootstrapped: !!p.mainSchedule?.bootstrapped,
      lastScrapeAtMs: p.mainSchedule?.lastScrapeAtMs ?? null,
      lastRefreshAtMs: p.mainSchedule?.lastRefreshAtMs ?? null
    };

    taskSeq = Number(p.taskSeq) || 0;
    TL.length = 0;
    for (const t of p.TL) {
      if (!t || typeof t.type !== "string" || typeof t.url !== "string") continue;
      const seq = Number(t._seq) || 0;
      taskSeq = Math.max(taskSeq, seq);
      TL.push({
        type: t.type,
        url: t.url,
        chromeTabId: t.chromeTabId === "" || t.chromeTabId == null ? "" : Number(t.chromeTabId),
        timestamp: Number(t.timestamp) || 0,
        _seq: seq
      });
    }
    TL.sort((a, b) => a.timestamp - b.timestamp || (a._seq || 0) - (b._seq || 0));
    for (const row of TL) {
      if (row._seq != null) taskSeq = Math.max(taskSeq, row._seq);
    }

    state.tabByUrl.clear();
    for (const pair of p.tabByUrl || []) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const [k, id] = pair;
      if (typeof id === "number" && id > 0) state.tabByUrl.set(normalizeUrl(String(k)), id);
    }

    state.subUrlStatus.clear();
    for (const pair of p.subUrlStatus || []) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const [k, row] = pair;
      if (row && typeof row === "object") state.subUrlStatus.set(normalizeUrl(String(k)), row);
    }

    taskAddedHistory.length = 0;
    if (Array.isArray(p.taskAddedHistory)) {
      for (const r of p.taskAddedHistory.slice(0, TASK_HISTORY_MAX)) {
        if (r && typeof r === "object") taskAddedHistory.push(r);
      }
    }
    taskAccomplishedHistory.length = 0;
    if (Array.isArray(p.taskAccomplishedHistory)) {
      for (const r of p.taskAccomplishedHistory.slice(0, TASK_HISTORY_MAX)) {
        if (r && typeof r === "object") taskAccomplishedHistory.push(r);
      }
    }

    if (TL.length === 0 && state.mainUrl) {
      TL.push({
        type: TASK_TYPES.OpenMainWebsite,
        url: state.mainUrl,
        chromeTabId: "",
        timestamp: Date.now(),
        _seq: ++taskSeq
      });
      console.log("[SportBet TL] restoreStateFromStorage: TL was empty; re-queued OpenMainWebsite");
    }

    console.log("[SportBet TL] restoreStateFromStorage", {
      mainUrl: state.mainUrl,
      queueLength: TL.length,
      subCount: state.oldUrlData.urls.length
    });
    return true;
  } catch (e) {
    console.error("[SportBet TL] restoreStateFromStorage apply failed", e);
    resetMonitorStateDefaults();
    await chrome.storage.local.remove(PERSIST_KEY).catch(() => {});
    return false;
  }
}

/**
 * Manifest content scripts only attach on navigation; after extension reload, open tabs
 * often have no listener until refresh. Programmatic injection fixes that for http(s) pages.
 * @param {number} tabId
 * @returns {Promise<boolean>}
 */
async function ensureContentScriptInjected(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const u = tab.url || "";
    if (!u.startsWith("http://") && !u.startsWith("https://")) {
      console.warn("[SportBet CS] ensureContentScriptInjected: skip (URL cannot run extension scripts)", {
        tabId,
        url: u
      });
      return false;
    }
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      files: ["content.js"]
    });
    console.log("[SportBet CS] ensureContentScriptInjected: executeScript ok", { tabId });
    return true;
  } catch (e) {
    console.warn("[SportBet CS] ensureContentScriptInjected failed", tabId, e?.message || e);
    return false;
  }
}

async function waitForTabComplete(tabId, timeoutMs = 45_000) {
  const tab = await chrome.tabs.get(tabId);
  if (tab.status === "complete") return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error("Tab load timeout"));
    }, timeoutMs);
    function onUpdated(id, info) {
      if (id !== tabId || info.status !== "complete") return;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

/**
 * chrome.tabs.reload is fire-and-forget; wait until reload completes.
 * @param {number} tabId
 * @param {number} timeoutMs
 */
async function reloadTabAndWait(tabId, timeoutMs) {
  await new Promise((resolve, reject) => {
    try {
      chrome.tabs.reload(tabId, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
  await waitForTabComplete(tabId, timeoutMs);
}

/**
 * Reads HTML via the content script. A valid tabId is not enough: the tab must have
 * this extension's content script running (see manifest). If you reload the extension,
 * existing tabs often lose the listener until the page is refreshed.
 *
 * @param {number} tabId
 * @param {boolean} isMain
 * @param {{ skipTargetClicks?: boolean, tabLoadTimeoutMs?: number }} [opts]
 * @returns {Promise<{ html: string, targetHitCount: number, durationMs: number }>}
 */
async function extractHtmlFromTab(tabId, isMain = false, opts = {}) {
  void isMain;
  const loadTimeout = opts.tabLoadTimeoutMs ?? MAIN_TAB_LOAD_MAX_MS;
  const t0 = performance.now();
  await waitForTabComplete(tabId, loadTimeout).catch(() => {});
  await sleep(300);
  await ensureContentScriptInjected(tabId);
  const message = {
    type: "GET_PAGE_HTML",
    isMain: isMain,
    skipTargetClicks: opts.skipTargetClicks === true
  };
  let lastError;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      const durationMs = Math.round(performance.now() - t0);
      return {
        html: response?.html || "",
        targetHitCount: Number(response?.targetHitCount) || 0,
        durationMs
      };
    } catch (e) {
      lastError = e;
      await ensureContentScriptInjected(tabId);
      await sleep(400 * (attempt + 1));
    }
  }
  let tabUrl = "";
  try {
    tabUrl = (await chrome.tabs.get(tabId))?.url || "";
  } catch {
    tabUrl = "(chrome.tabs.get failed)";
  }
  const errMsg = lastError?.message || String(lastError);
  console.warn(
    "extractHtmlFromTab: sendMessage failed after retries.",
    "Typical cause: no message listener in that tab (content script missing until navigation, or extension was reloaded).",
    { tabId, tabUrl, error: errMsg }
  );
  return {
    html: "",
    targetHitCount: 0,
    durationMs: Math.round(performance.now() - t0)
  };
}

/** @param {number} tabId */
async function countTargetsInTab(tabId) {
  await ensureContentScriptInjected(tabId);
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: "COUNT_TARGETS" });
      return Number(response?.targetHitCount) || 0;
    } catch {
      await ensureContentScriptInjected(tabId);
      await sleep(400 * (attempt + 1));
    }
  }
  return 0;
}

/**
 * @param {string} targetUrl
 * @returns {Promise<number | null>}
 */
async function findTabIdForUrl(targetUrl) {
  const want = normalizeUrl(targetUrl);
  const mapped = state.tabByUrl.get(want);
  if (mapped != null) {
    try {
      const t = await chrome.tabs.get(mapped);
      if (t?.id && t.url && normalizeUrl(t.url) === want) return t.id;
    } catch {
      /* drop */
    }
    state.tabByUrl.delete(want);
  }
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    try {
      if (normalizeUrl(tab.url) === want) {
        state.tabByUrl.set(want, tab.id);
        return tab.id;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * @param {Set<string>} allowedNormalized
 * @param {string} mainNormalized
 */
async function closeTabsNotInAllowed(allowedNormalized, mainNormalized) {
  /** @type {{ tabId: number, mapKey: string, normalized: string }[]} */
  const closed = [];
  for (const [u, id] of [...state.tabByUrl.entries()]) {
    const nu = normalizeUrl(u);
    if (allowedNormalized.has(nu)) continue;
    if (nu === mainNormalized) continue;
    try {
      await chrome.tabs.remove(id);
      closed.push({ tabId: id, mapKey: u, normalized: nu });
    } catch {
      /* ignore */
    }
    state.tabByUrl.delete(u);
  }
  if (closed.length) {
    console.log("[SportBet TL] closeTabsNotInAllowed: closed tabs (tasks unchanged)", {
      mainNormalized,
      closedCount: closed.length,
      closed
    });
  }
}

function scheduleNextTick(delayMs) {
  const when = Date.now() + Math.max(delayMs, 50);
  chrome.alarms.clear(SCHEDULER_ALARM, () => {
    chrome.alarms.create(SCHEDULER_ALARM, { when });
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== SCHEDULER_ALARM) return;
  if (!state.running) return;
  void schedulerTick();
});

async function postScrape(type, url, html) {
  const at = new Date().toISOString();
  const requestUrl = `${API_BASE}/api/scrape`;
  try {
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        url,
        data: html,
        timestamp: at
      })
    });
    const text = await response.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = {};
    }
    return json;
  } catch {
    return {};
  }
}

/** @param {Task} task */
async function openMainWebsite(task) {
  const url = normalizeUrl(task.url);
  let tabId = await findTabIdForUrl(url);
  if (tabId == null) {
    const created = await chrome.tabs.create({ url, active: false });
    tabId = created.id;
    state.tabByUrl.set(url, tabId);
  }
  await waitForTabComplete(tabId, MAIN_TAB_LOAD_MAX_MS).catch(() => {});
  const now = Date.now();
  await addTask({
    type: TASK_TYPES.ScrapeMainWebsite,
    url,
    chromeTabId: tabId,
    timestamp: now
  });
  await addTask({
    type: TASK_TYPES.RefreshMainWebsite,
    url,
    chromeTabId: tabId,
    timestamp: now + refreshIntervalMs()
  });
}

/** @param {Task} task */
async function scrapeMainWebsite(task) {
  const url = normalizeUrl(task.url);
  let tabId =
    task.chromeTabId !== "" && task.chromeTabId != null ? Number(task.chromeTabId) : null;
  if (tabId != null) {
    try {
      const t = await chrome.tabs.get(tabId);
      if (!t?.url || normalizeUrl(t.url) !== url) tabId = null;
    } catch {
      tabId = null;
    }
  }
  if (tabId == null) tabId = await findTabIdForUrl(url);
  if (tabId == null) {
    await addTask({
      type: TASK_TYPES.OpenMainWebsite,
      url,
      chromeTabId: "",
      timestamp: Date.now()
    });
    return;
  }
  state.tabByUrl.set(url, tabId);
  await addTask({
    type: TASK_TYPES.ScrapeMainWebsite,
    url,
    chromeTabId: tabId,
    timestamp: Date.now() + scrapeIntervalMs()
  });

  await waitForTabComplete(tabId, MAIN_TAB_LOAD_MAX_MS).catch(() => {});
  await healthcheck().catch(() => {});
  const { html } = await extractHtmlFromTab(tabId, true, {
    skipTargetClicks: true,
    tabLoadTimeoutMs: MAIN_TAB_LOAD_MAX_MS
  });
  const result = await postScrape("M", url, html);
  if (result?.result !== "ok") {
    console.log("[SportBet TL] scrapeMainWebsite: early exit (no purge)", {
      serverResult: result?.result,
      mainUrl: url
    });
    return;
  }

  state.globalUrlData = {
    scrapeInterval: ensureMinimumInterval(result?.intervals?.scrapeInterval),
    refreshInterval: ensureMinimumInterval(result?.intervals?.refreshInterval),
    urls: (result?.urls || []).map((u) => normalizeUrl(u))
  };

  // Sub-URLs come from the server; main monitoring URL must always stay allowed so main tasks are never removed from TL.
  const mainNorm = normalizeUrl(state.mainUrl);
  const allowed = new Set([mainNorm, url, ...state.globalUrlData.urls]);
  const staleUrls = await runTaskLocked(() => {
    const seen = new Set();
    const out = [];
    for (const t of TL) {
      const nu = normalizeUrl(t.url);
      if (allowed.has(nu) || seen.has(nu)) continue;
      seen.add(nu);
      out.push(t.url);
    }
    return out;
  });
  const queueBeforePurge = await runTaskLocked(() =>
    TL.map((t) => ({ type: t.type, urlNorm: normalizeUrl(t.url), seq: t._seq }))
  );
  console.log("[SportBet TL] scrapeMainWebsite: purge decision", {
    mainNorm,
    scrapeTaskUrlNorm: url,
    stateMainUrl: state.mainUrl,
    previousSubUrls: [...state.oldUrlData.urls],
    serverSubUrls: [...state.globalUrlData.urls],
    allowedUrls: [...allowed],
    staleUrlsToStripTasksFor: staleUrls,
    queueLength: queueBeforePurge.length,
    queueSnapshot: queueBeforePurge
  });
  for (const u of staleUrls) await removeAllTask(u);
  await closeTabsNotInAllowed(allowed, mainNorm);

  const oldSet = new Set(state.oldUrlData.urls.map((u) => normalizeUrl(u)));
  for (const sub of state.globalUrlData.urls) {
    if (!oldSet.has(sub)) {
      console.log("[SportBet TL] scrapeMainWebsite: enqueue new sub OpenSubWebsite", { sub });
      await addTask({
        type: TASK_TYPES.OpenSubWebsite,
        url: sub,
        chromeTabId: "",
        timestamp: Date.now()
      });
    }
  }
  const queueAfterPurge = await getTaskListLength();
  console.log("[SportBet TL] scrapeMainWebsite: purge done", { queueLength: queueAfterPurge });
  state.oldUrlData = {
    scrapeInterval: state.globalUrlData.scrapeInterval,
    refreshInterval: state.globalUrlData.refreshInterval,
    urls: [...state.globalUrlData.urls]
  };
  syncSubUrlStatusRows(state.oldUrlData.urls);
  const nowMs = Date.now();
  state.mainSchedule.bootstrapped = true;
  state.mainSchedule.lastScrapeAtMs = nowMs;
  queuePersist();
}

/** @param {Task} task */
async function refreshMainWebsite(task) {
  const url = normalizeUrl(task.url);
  const tabId = await findTabIdForUrl(url);
  if (tabId == null) {
    await addTask({
      type: TASK_TYPES.OpenMainWebsite,
      url,
      chromeTabId: "",
      timestamp: Date.now()
    });
    return;
  }
  await addTask({
    type: TASK_TYPES.RefreshMainWebsite,
    url,
    chromeTabId: tabId,
    timestamp: Date.now() + refreshIntervalMs()
  });
  await reloadTabAndWait(tabId, MAIN_TAB_LOAD_MAX_MS).catch((e) => {
    console.warn("[SportBet TL] refreshMainWebsite: reload wait failed", { tabId, url, err: String(e?.message || e) });
  });
  state.mainSchedule.lastRefreshAtMs = Date.now();
}

/** @param {Task} task */
async function openSubWebsite(task) {
  const sub = normalizeUrl(task.url);
  if (!state.globalUrlData.urls.some((u) => normalizeUrl(u) === sub)) {
    console.log("[SportBet TL] openSubWebsite: skip (sub not in globalUrlData.urls)", {
      sub,
      globalUrls: [...state.globalUrlData.urls]
    });
    return;
  }
  let tabId = await findTabIdForUrl(sub);
  if (tabId == null) {
    const created = await chrome.tabs.create({ url: sub, active: false });
    tabId = created.id;
    state.tabByUrl.set(sub, tabId);
  }
  await waitForTabComplete(tabId, SUB_TAB_LOAD_MAX_MS).catch(() => {});
  await addTask({
    type: TASK_TYPES.OpenTarget,
    url: sub,
    chromeTabId: tabId,
    timestamp: Date.now()
  });
}

/** @param {Task} task */
async function openTarget(task) {
  const sub = normalizeUrl(task.url);
 
  console.log("[SportBet TL] openTarget: try to find tabId for", task.url);

  let tabId =
    task.chromeTabId !== "" && task.chromeTabId != null ? Number(task.chromeTabId) : null;
  if (tabId != null) {
    try {
      const t = await chrome.tabs.get(tabId);
      if (!t?.url || normalizeUrl(t.url) !== sub) tabId = null;
    } catch {
      tabId = null;
    }
  }
  if (tabId == null) {
    await addTask({
      type: TASK_TYPES.OpenSubWebsite,
      url: sub,
      chromeTabId: "",
      timestamp: Date.now() + RETRY_OPEN_SUB_MS
    });
    return;
  }
  console.log("[SportBet TL] openTarget: starting to wait loading", task.url);
  await waitForTabComplete(tabId, SUB_TAB_LOAD_MAX_MS).catch(() => {});

  const now = Date.now();

  let hit = 0;
  for (let attempt = 0; attempt < OPEN_TARGET_TARGET_POLLS; attempt++) {
    if (attempt > 0) await sleep(OPEN_TARGET_POLL_INTERVAL_MS);
    hit = await countTargetsInTab(tabId);
    console.log("[SportBet TL] openTarget: target poll", { url: task.url, attempt: attempt + 1, hit });
    if (hit > 0) break;
  }

  console.log("[SportBet TL] openTarget: find target tags (final)", task.url, hit);

  if (hit <= 0) {
    await addTask({
      type: TASK_TYPES.RefreshSubWebsite,
      url: sub,
      chromeTabId: tabId,
      timestamp: now + RETRY_REFRESH_SUB_MS
    });
    return;
  }
  await addTask({
    type: TASK_TYPES.ScrapeSubWebsite,
    url: sub,
    chromeTabId: tabId,
    timestamp: now
  });
  await addTask({
    type: TASK_TYPES.RefreshSubWebsite,
    url: sub,
    chromeTabId: tabId,
    timestamp: now + refreshIntervalMs()
  });
}

/** @param {Task} task */
async function scrapeSubWebsite(task) {
  const sub = normalizeUrl(task.url);
  if (!state.globalUrlData.urls.some((u) => normalizeUrl(u) === sub)) {
    console.log("[SportBet TL] scrapeSubWebsite: skip (sub not in globalUrlData.urls)", {
      sub,
      globalUrls: [...state.globalUrlData.urls]
    });
    return;
  }

  let tabId =
    task.chromeTabId !== "" && task.chromeTabId != null ? Number(task.chromeTabId) : null;
  if (tabId != null) {
    try {
      const t = await chrome.tabs.get(tabId);
      if (!t?.url || normalizeUrl(t.url) !== sub) tabId = null;
    } catch {
      tabId = null;
    }
  }
  if (tabId == null) tabId = await findTabIdForUrl(sub);
  if (tabId == null) {
    await addTask({
      type: TASK_TYPES.OpenSubWebsite,
      url: sub,
      chromeTabId: "",
      timestamp: Date.now() + RETRY_OPEN_SUB_MS
    });
    return;
  }

  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    await addTask({
      type: TASK_TYPES.OpenSubWebsite,
      url: sub,
      chromeTabId: "",
      timestamp: Date.now() + RETRY_OPEN_SUB_MS
    });
    return;
  }
  if (tab.status !== "complete") {
    await addTask({
      type: TASK_TYPES.OpenTarget,
      url: sub,
      chromeTabId: tabId,
      timestamp: Date.now() + RETRY_OPEN_TARGET_MS
    });
    return;
  }

  const hit = await countTargetsInTab(tabId);
  if (hit <= 0) {
    await addTask({
      type: TASK_TYPES.RefreshSubWebsite,
      url: sub,
      chromeTabId: tabId,
      timestamp: Date.now() + RETRY_REFRESH_SUB_MS
    });
    return;
  }

  await addTask({
    type: TASK_TYPES.ScrapeSubWebsite,
    url: sub,
    chromeTabId: tabId,
    timestamp: Date.now() + scrapeIntervalMs()
  });

  await healthcheck().catch(() => {});
  const { html, targetHitCount, durationMs } = await extractHtmlFromTab(tabId, false, {
    skipTargetClicks: false,
    tabLoadTimeoutMs: SUB_TAB_LOAD_MAX_MS
  });
  const row = state.subUrlStatus.get(sub);
  if (row) {
    row.targetOpened = targetHitCount > 0;
    row.lastTargetHitCount = targetHitCount;
    row.lastLoadingTimeMs = durationMs;
    row.bootstrapped = true;
    row.anchorScrapeMs = Date.now();
    row.lastScrapedAt = new Date().toISOString();
  }
  await postScrape("S", sub, html);
}

/** @param {Task} task */
async function refreshSubWebsite(task) {
  const sub = normalizeUrl(task.url);
  if (!state.globalUrlData.urls.some((u) => normalizeUrl(u) === sub)) {
    console.log("[SportBet TL] refreshSubWebsite: skip (sub not in globalUrlData.urls)", {
      sub,
      globalUrls: [...state.globalUrlData.urls]
    });
    return;
  }

  let tabId =
    task.chromeTabId !== "" && task.chromeTabId != null ? Number(task.chromeTabId) : null;
  if (tabId != null) {
    try {
      const t = await chrome.tabs.get(tabId);
      if (!t?.url || normalizeUrl(t.url) !== sub) tabId = null;
    } catch {
      tabId = null;
    }
  }
  if (tabId == null) tabId = await findTabIdForUrl(sub);
  if (tabId == null) {
    await addTask({
      type: TASK_TYPES.OpenSubWebsite,
      url: sub,
      chromeTabId: "",
      timestamp: Date.now() + RETRY_OPEN_SUB_MS
    });
    return;
  }

  await addTask({
    type: TASK_TYPES.RefreshSubWebsite,
    url: sub,
    chromeTabId: tabId,
    timestamp: Date.now() + refreshIntervalMs()
  });
  await reloadTabAndWait(tabId, SUB_TAB_LOAD_MAX_MS).catch((e) => {
    console.warn("[SportBet TL] refreshSubWebsite: reload wait failed", { tabId, url: sub, err: String(e?.message || e) });
  });
  /** Without this, only future RefreshSubWebsite tasks remain; OpenTarget / ScrapeSubWebsite may never run again after a reload. */
  await addTask({
    type: TASK_TYPES.OpenTarget,
    url: sub,
    chromeTabId: tabId,
    timestamp: Date.now() + 1500
  });
  const row = state.subUrlStatus.get(sub);
  if (row) row.lastRefreshedAt = new Date().toISOString();
}

/**
 * @param {Task} task
 * @param {() => Promise<void>} fn
 */
function dispatchHandlerTracked(task, fn) {
  const snap = taskSnapshotForHistory(task);
  void fn()
    .then(() => {
      recordTaskAccomplished({
        at: new Date().toISOString(),
        ...snap,
        outcome: "ok"
      });
    })
    .catch((e) => {
      const detail = String(e?.message || e);
      console.warn(snap.type, e);
      recordTaskAccomplished({
        at: new Date().toISOString(),
        ...snap,
        outcome: "error",
        detail
      });
    });
}

/** @param {Task} task */
function dispatchTaskNoWait(task) {
  switch (task.type) {
    case TASK_TYPES.OpenMainWebsite:
      dispatchHandlerTracked(task, () => openMainWebsite(task));
      break;
    case TASK_TYPES.ScrapeMainWebsite:
      dispatchHandlerTracked(task, () => scrapeMainWebsite(task));
      break;
    case TASK_TYPES.RefreshMainWebsite:
      dispatchHandlerTracked(task, () => refreshMainWebsite(task));
      break;
    case TASK_TYPES.OpenSubWebsite:
      dispatchHandlerTracked(task, () => openSubWebsite(task));
      break;
    case TASK_TYPES.OpenTarget:
      dispatchHandlerTracked(task, () => openTarget(task));
      break;
    case TASK_TYPES.ScrapeSubWebsite:
      dispatchHandlerTracked(task, () => scrapeSubWebsite(task));
      break;
    case TASK_TYPES.RefreshSubWebsite:
      dispatchHandlerTracked(task, () => refreshSubWebsite(task));
      break;
    default:
      console.warn("Unknown task type", task);
  }
}

async function schedulerTick() {
  if (!state.running) return;
  if (schedulerLock) {
    scheduleNextTick(TICK_MS);
    return;
  }
  schedulerLock = true;
  state.lastSchedulerTickAt = new Date().toISOString();
  try {
    const n = await getTaskListLength();
    if (n === 0) {
      state.lastSchedulerSummary = "TL empty; idle.";
      scheduleNextTick(TICK_MS);
      return;
    }
    const first = await getFirstTask();
    if (!first) {
      scheduleNextTick(TICK_MS);
      return;
    }
    const now = Date.now();
    if (first.timestamp > now) {
      state.lastSchedulerSummary = "Waiting for task due time.";
      scheduleNextTick(TICK_MS);
      return;
    }
    const task = await popTask();
    if (!task) {
      scheduleNextTick(TICK_MS);
      return;
    }
    state.lastSchedulerSummary = `Dispatch ${task.type}`;
    console.log("[SportBet TL] schedulerTick: dispatch", { type: task.type, url: task.url, seq: task._seq });
    dispatchTaskNoWait(task);
    scheduleNextTick(0);
  } catch (err) {
    console.warn("schedulerTick", err);
    state.lastSchedulerSummary = String(err?.message || err);
    scheduleNextTick(TICK_MS);
  } finally {
    schedulerLock = false;
    if (state.running) queuePersist();
  }
}

function startScheduler() {
  chrome.alarms.clear(SCHEDULER_ALARM, () => {
    chrome.alarms.create(SCHEDULER_ALARM, { when: Date.now() + TICK_MS });
  });
}

async function startMonitoring(mainUrl) {
  state.running = true;
  state.mainUrl = normalizeUrl(mainUrl);
  state.mainSchedule = { bootstrapped: false, lastScrapeAtMs: null, lastRefreshAtMs: null };
  state.globalUrlData = { scrapeInterval: 10, refreshInterval: 300, urls: [] };
  state.oldUrlData = { scrapeInterval: 10, refreshInterval: 300, urls: [] };
  state.subUrlStatus.clear();
  state.tabByUrl.clear();
  taskAddedHistory.length = 0;
  taskAccomplishedHistory.length = 0;
  await clearTaskList("startMonitoring");
  await addTask({
    type: TASK_TYPES.OpenMainWebsite,
    url: state.mainUrl,
    chromeTabId: "",
    timestamp: Date.now()
  });
  startScheduler();
  await flushPersist();
}

async function stopMonitoring() {
  state.running = false;
  state.subUrlStatus.clear();
  state.mainSchedule = { bootstrapped: false, lastScrapeAtMs: null, lastRefreshAtMs: null };
  await clearTaskList("stopMonitoring");
  chrome.alarms.clear(SCHEDULER_ALARM);
  if (persistDebounceTimer != null) {
    clearTimeout(persistDebounceTimer);
    persistDebounceTimer = null;
  }
  try {
    await chrome.storage.local.remove(PERSIST_KEY);
  } catch (e) {
    console.warn("[SportBet TL] stopMonitoring: storage remove failed", e);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void sender;
  if (message.type === "START_MONITORING") {
    startMonitoring(message.mainUrl).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "STOP_MONITORING") {
    void stopMonitoring().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "GET_STATUS") {
    void healthcheck().finally(() => {
      chrome.alarms.get(SCHEDULER_ALARM, (alarm) => {
        void getTaskListLength().then((tlLen) => {
          const subTable = buildSubUrlTablePayload();
          const sMs = scrapeIntervalMs();
          const rMs = refreshIntervalMs();
          sendResponse({
            connected: state.connected,
            mainUrl: state.mainUrl,
            running: state.running,
            trackedUrlCount: state.oldUrlData.urls.length,
            scrapeIntervalSec: state.oldUrlData.scrapeInterval,
            refreshIntervalSec: state.oldUrlData.refreshInterval,
            subUrlTable: subTable.rows,
            subUrlStaleHintMs: subTable.staleAfterMs,
            taskQueueLength: tlLen,
            taskAddedHistory: taskAddedHistory.map((r) => ({ ...r })),
            taskAccomplishedHistory: taskAccomplishedHistory.map((r) => ({ ...r })),
            scheduler: {
              tickMs: TICK_MS,
              lastTickAt: state.lastSchedulerTickAt,
              summary: state.lastSchedulerSummary,
              nextAlarmScheduledTime: alarm?.scheduledTime ?? null,
              mainBootstrapped: state.mainSchedule.bootstrapped,
              mainNextScrapeApprox:
                state.mainSchedule.bootstrapped && state.mainSchedule.lastScrapeAtMs != null
                  ? new Date(state.mainSchedule.lastScrapeAtMs + sMs).toISOString()
                  : null,
              mainNextRefreshApprox:
                state.mainSchedule.bootstrapped && state.mainSchedule.lastRefreshAtMs != null
                  ? new Date(state.mainSchedule.lastRefreshAtMs + rMs).toISOString()
                  : null
            }
          });
        });
      });
    });
    return true;
  }
  return false;
});

setInterval(() => {
  healthcheck().catch(() => {});
}, 60_000);

if (chrome.runtime.onSuspend) {
  chrome.runtime.onSuspend.addListener(() => {
    void flushPersist();
  });
}

/**
 * Avoid top-level await: it can block or break service worker startup on some Chrome paths
 * (e.g. fresh install / reinstall). Run bootstrap asynchronously with timeouts and fallbacks.
 */
async function bootstrapServiceWorker() {
  try {
    await Promise.race([
      new Promise((resolve) => {
        try {
          chrome.alarms.clear(SCHEDULER_ALARM, () => resolve());
        } catch {
          resolve();
        }
      }),
      new Promise((resolve) => setTimeout(resolve, 2000))
    ]);
  } catch {
    /* ignore */
  }
  try {
    const sessionRestored = await restoreStateFromStorage();
    if (sessionRestored && state.running) {
      console.log("[SportBet TL] bootstrapServiceWorker: session restored, scheduler started");
      startScheduler();
    }
  } catch (e) {
    console.error("[SportBet TL] bootstrapServiceWorker failed", e);
    resetMonitorStateDefaults();
    await chrome.storage.local.remove(PERSIST_KEY).catch(() => {});
  }
}

void bootstrapServiceWorker();
