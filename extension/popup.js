const mainUrlInput = document.getElementById("mainUrl");
const statusEl = document.getElementById("connectionStatus");
const monitoringEl = document.getElementById("monitoringStatus");
const trackingHintEl = document.getElementById("trackingHint");
const schedulerDetailEl = document.getElementById("schedulerDetail");
const subUrlTableBody = document.getElementById("subUrlTableBody");
const subUrlTableHint = document.getElementById("subUrlTableHint");
const taskAddedBody = document.getElementById("taskAddedBody");
const taskDoneBody = document.getElementById("taskDoneBody");

function formatTime(isoOrMs) {
  if (isoOrMs == null || isoOrMs === "") return "—";
  const t = typeof isoOrMs === "number" ? isoOrMs : Date.parse(isoOrMs);
  if (Number.isNaN(t)) return String(isoOrMs);
  return new Date(t).toLocaleString();
}

function formatShortTime(iso) {
  if (iso == null || iso === "") return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  return new Date(t).toLocaleTimeString();
}

function formatTargetOpened(row) {
  if (row.targetOpened === null || row.targetOpened === undefined) return "—";
  const n = row.lastTargetHitCount;
  if (row.targetOpened) return `Yes (${n})`;
  return "No";
}

function formatLoadingMs(ms) {
  if (ms == null || ms === "") return "—";
  return `${ms} ms`;
}

function shortenText(s, max = 40) {
  if (s == null || s === "") return "—";
  const t = String(s);
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function formatChromeTabId(id) {
  if (id === "" || id == null) return "—";
  return String(id);
}

function formatDueMs(ms) {
  if (ms == null || Number.isNaN(Number(ms))) return "—";
  return formatShortTime(new Date(Number(ms)).toISOString());
}

function renderTaskHistory(added, done) {
  if (taskAddedBody) {
    taskAddedBody.replaceChildren();
    if (!added?.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 6;
      td.textContent = "No tasks recorded yet. Start monitoring to enqueue work.";
      td.style.color = "#666";
      tr.appendChild(td);
      taskAddedBody.appendChild(tr);
    } else {
      for (const row of added) {
        const tr = document.createElement("tr");
        const tWhen = document.createElement("td");
        tWhen.className = "mono";
        tWhen.textContent = formatShortTime(row.at);
        tWhen.title = formatTime(row.at);
        const tType = document.createElement("td");
        tType.textContent = row.type || "—";
        const tUrl = document.createElement("td");
        tUrl.textContent = shortenText(row.url, 44);
        tUrl.title = row.url || "";
        const tTab = document.createElement("td");
        tTab.className = "mono";
        tTab.textContent = formatChromeTabId(row.chromeTabId);
        const tDue = document.createElement("td");
        tDue.className = "mono";
        tDue.textContent = formatDueMs(row.scheduledFor);
        tDue.title = row.scheduledFor != null ? new Date(row.scheduledFor).toLocaleString() : "";
        const tSeq = document.createElement("td");
        tSeq.className = "mono";
        tSeq.textContent = row.seq != null ? String(row.seq) : "—";
        tr.appendChild(tWhen);
        tr.appendChild(tType);
        tr.appendChild(tUrl);
        tr.appendChild(tTab);
        tr.appendChild(tDue);
        tr.appendChild(tSeq);
        taskAddedBody.appendChild(tr);
      }
    }
  }

  if (taskDoneBody) {
    taskDoneBody.replaceChildren();
    if (!done?.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 7;
      td.textContent =
        "No accomplished tasks yet. A row appears after a popped task's handler finishes (ok or error).";
      td.style.color = "#666";
      tr.appendChild(td);
      taskDoneBody.appendChild(tr);
    } else {
      for (const row of done) {
        const tr = document.createElement("tr");
        const tWhen = document.createElement("td");
        tWhen.className = "mono";
        tWhen.textContent = formatShortTime(row.at);
        tWhen.title = formatTime(row.at);
        const tType = document.createElement("td");
        tType.textContent = row.type || "—";
        const tUrl = document.createElement("td");
        tUrl.textContent = shortenText(row.url, 36);
        tUrl.title = row.url || "";
        const tTab = document.createElement("td");
        tTab.className = "mono";
        tTab.textContent = formatChromeTabId(row.chromeTabId);
        const tDue = document.createElement("td");
        tDue.className = "mono";
        tDue.textContent = formatDueMs(row.scheduledFor);
        const tSeq = document.createElement("td");
        tSeq.className = "mono";
        tSeq.textContent = row.seq != null ? String(row.seq) : "—";
        const tRes = document.createElement("td");
        if (row.outcome === "error") {
          tRes.className = "err";
          tRes.textContent = shortenText(row.detail || "error", 28);
          tRes.title = row.detail || "";
        } else {
          tRes.className = "ok";
          tRes.textContent = "ok";
        }
        tr.appendChild(tWhen);
        tr.appendChild(tType);
        tr.appendChild(tUrl);
        tr.appendChild(tTab);
        tr.appendChild(tDue);
        tr.appendChild(tSeq);
        tr.appendChild(tRes);
        taskDoneBody.appendChild(tr);
      }
    }
  }
}

function renderSubUrlTable(rows, staleHintMs, scrapeSec, refreshSec) {
  if (!subUrlTableBody) return;
  subUrlTableBody.replaceChildren();

  if (!rows || rows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.textContent =
      "No sub-URLs yet. They appear after a successful main scrape returns a URL list from the server.";
    td.style.color = "#666";
    tr.appendChild(td);
    subUrlTableBody.appendChild(tr);
  } else {
    for (const row of rows) {
      const tr = document.createElement("tr");
      if (row.stale) tr.classList.add("stale-row");

      const tdName = document.createElement("td");
      tdName.textContent = row.name || "";
      tdName.title = row.url || "";

      const tdTarget = document.createElement("td");
      tdTarget.textContent = formatTargetOpened(row);

      const tdScraped = document.createElement("td");
      tdScraped.textContent = formatShortTime(row.lastScrapedAt);

      const tdRef = document.createElement("td");
      tdRef.textContent = formatShortTime(row.lastRefreshedAt);

      const tdLoad = document.createElement("td");
      tdLoad.className = "num";
      tdLoad.textContent = formatLoadingMs(row.lastLoadingTimeMs);

      tr.appendChild(tdName);
      tr.appendChild(tdTarget);
      tr.appendChild(tdScraped);
      tr.appendChild(tdRef);
      tr.appendChild(tdLoad);
      subUrlTableBody.appendChild(tr);
    }
  }

  if (subUrlTableHint) {
    const sec = staleHintMs ? Math.round(staleHintMs / 1000) : 0;
    subUrlTableHint.textContent = [
      `Server intervals: scrape every ${scrapeSec ?? "—"}s, refresh every ${refreshSec ?? "—"}s (per tab, after first load).`,
      `Sub load wait: max 10s. Main tab: no accordion clicks.`,
      sec
        ? `Yellow row: no sub scrape for ~${sec}s while monitoring. Hover Name for full URL.`
        : "Hover Name for full URL."
    ].join(" ");
  }
}

function applyStatus(response) {
  if (!response) return;
  if (response.connected) {
    statusEl.textContent = "Connection: 🟢 (server reachable)";
  } else {
    statusEl.textContent = "Connection: 🔴 (cannot reach server)";
  }
  if (response.running) {
    monitoringEl.textContent = "Monitoring: ▶ running";
  } else {
    monitoringEl.textContent = "Monitoring: ■ stopped";
  }
  if (response.mainUrl) {
    mainUrlInput.value = response.mainUrl;
  }
  const n = response.trackedUrlCount ?? 0;
  const q = response.taskQueueLength ?? 0;
  trackingHintEl.textContent = response.running
    ? `Tracking ${n} sub-URL tab(s). Task queue: ${q}. Scheduler tick: ${response.scheduler?.tickMs ?? 1000} ms.`
    : "Press Start to open the main tab and begin monitoring.";

  renderSubUrlTable(
    response.subUrlTable ?? [],
    response.subUrlStaleHintMs,
    response.scrapeIntervalSec,
    response.refreshIntervalSec
  );

  renderTaskHistory(response.taskAddedHistory ?? [], response.taskAccomplishedHistory ?? []);

  if (schedulerDetailEl) {
    const sch = response.scheduler ?? {};
    schedulerDetailEl.textContent = [
      `Last tick: ${formatTime(sch.lastTickAt)}`,
      `Next alarm: ${formatTime(sch.nextAlarmScheduledTime)}`,
      `Main bootstrapped: ${sch.mainBootstrapped ? "yes" : "no"}`,
      `Main next scrape (approx): ${formatTime(sch.mainNextScrapeApprox)}`,
      `Main next refresh (approx): ${formatTime(sch.mainNextRefreshApprox)}`,
      "",
      sch.summary || ""
    ]
      .filter(Boolean)
      .join("\n");
  }
}

function refreshStatus() {
  chrome.runtime.sendMessage({ type: "GET_STATUS" }, (response) => {
    if (chrome.runtime.lastError) {
      statusEl.textContent = "Connection: ?";
      monitoringEl.textContent = "Monitoring: ?";
      trackingHintEl.textContent = chrome.runtime.lastError.message || "";
      if (schedulerDetailEl) {
        schedulerDetailEl.textContent = chrome.runtime.lastError.message || "";
      }
      renderSubUrlTable([], 0, null, null);
      renderTaskHistory([], []);
      return;
    }
    applyStatus(response);
  });
}

document.getElementById("startBtn").addEventListener("click", async () => {
  const mainUrl = mainUrlInput.value.trim();
  if (!mainUrl) return;
  await chrome.runtime.sendMessage({ type: "START_MONITORING", mainUrl });
  refreshStatus();
});

document.getElementById("stopBtn").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "STOP_MONITORING" });
  refreshStatus();
});

refreshStatus();
setInterval(refreshStatus, 2000);
