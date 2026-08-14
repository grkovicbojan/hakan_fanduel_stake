/**
 * ww-table.js — progressive sort + filter for plain HTML tables.
 *
 * Enhances every <table> that has a <thead> with <th> cells: header cells
 * become sort buttons, a search box above the table filters rows, and a pager
 * below it splits them into pages (sort, then filter, then page).
 * Everything operates on the rows currently in the DOM, so on a server-paginated
 * table it sorts and filters that page only — the row counter says so.
 *
 * Opt a table out entirely with data-ww-table="off".
 * Opt out of paging alone with data-ww-page="off" — use this when the table
 * already has its own pager, so the page never shows two sets of controls.
 * Set the initial page size with data-ww-page-size="50" (default 25).
 * Give a cell an explicit sort key with data-sort-value="...".
 * Skip a column's sorting with data-ww-sort="off" on its <th>.
 *
 * Tables re-rendered through innerHTML are re-enhanced automatically, and the
 * active sort and filter are reapplied.
 */
(function () {
  "use strict";

  if (window.WWTable) return;

  var STATE = new WeakMap();
  var UID = 0;

  /* ---------------------------------------------------------------- styles */

  // Colours come from currentColor/opacity only: these tables live in eight
  // different themes and no shared custom-property names exist across them.
  var CSS =
    ".ww-table-tools{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin:0 0 .6rem}" +
    ".ww-table-filter{flex:1 1 12rem;min-width:0;max-width:22rem;font:inherit;font-size:.875rem;" +
    "padding:.4rem .6rem;border-radius:8px;border:1px solid currentColor;background:transparent;" +
    "color:inherit;opacity:.75}" +
    ".ww-table-filter:focus{opacity:1;outline:2px solid currentColor;outline-offset:1px}" +
    ".ww-table-count{font-size:.8rem;opacity:.65;white-space:nowrap}" +
    "th.ww-sortable{cursor:pointer;user-select:none;white-space:nowrap}" +
    "th.ww-sortable .ww-th-btn{all:unset;cursor:pointer;display:inline-flex;align-items:center;" +
    "gap:.35em;width:100%;font:inherit;color:inherit}" +
    "th.ww-sortable .ww-th-btn:focus-visible{outline:2px solid currentColor;outline-offset:2px}" +
    "th.ww-sortable .ww-arrow{opacity:.3;font-size:.85em;line-height:1}" +
    'th.ww-sortable[aria-sort="ascending"] .ww-arrow,' +
    'th.ww-sortable[aria-sort="descending"] .ww-arrow{opacity:1}' +
    ".ww-table-empty td{opacity:.7;font-style:italic}" +
    ".ww-table-pager{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin:.6rem 0 0}" +
    ".ww-table-pager[hidden]{display:none}" +
    ".ww-page-btn{font:inherit;font-size:.8125rem;padding:.35rem .7rem;border-radius:8px;" +
    "border:1px solid currentColor;background:transparent;color:inherit;opacity:.8;cursor:pointer}" +
    ".ww-page-btn:hover:not(:disabled){opacity:1}" +
    ".ww-page-btn:disabled{opacity:.35;cursor:default}" +
    ".ww-page-info{font-size:.8rem;opacity:.7;white-space:nowrap}" +
    ".ww-page-size{margin-left:auto;font-size:.8rem;opacity:.7;display:inline-flex;align-items:center;gap:.35rem}" +
    ".ww-page-size select{font:inherit;font-size:.8rem;padding:.25rem .4rem;border-radius:6px;" +
    "border:1px solid currentColor;background:transparent;color:inherit}" +
    ".ww-page-size option{color:CanvasText;background:Canvas}";

  function injectStyles() {
    if (document.getElementById("ww-table-styles")) return;
    var el = document.createElement("style");
    el.id = "ww-table-styles";
    el.textContent = CSS;
    (document.head || document.documentElement).appendChild(el);
  }

  /* ------------------------------------------------------------ value types */

  var NUM_RE = /^-?[$€£]?\s*-?[\d,\s]*\.?\d+\s*%?$/;

  function cellText(row, index) {
    var cell = row.cells[index];
    if (!cell) return "";
    var explicit = cell.getAttribute("data-sort-value");
    return explicit !== null ? explicit : cell.textContent.trim();
  }

  function asNumber(text) {
    if (!text) return null;
    var cleaned = text.replace(/[$€£,\s%]/g, "");
    if (cleaned === "" || cleaned === "-") return null;
    if (!NUM_RE.test(text.trim())) return null;
    var n = Number(cleaned);
    return isNaN(n) ? null : n;
  }

  function asDate(text) {
    // Bare numbers parse as years in some engines, so require a separator.
    if (!text || !/[-/:]/.test(text)) return null;
    var t = Date.parse(text);
    return isNaN(t) ? null : t;
  }

  /** Pick one comparison type per column by sampling the rows we can see. */
  function detectType(rows, index) {
    var seen = 0;
    var numbers = 0;
    var dates = 0;
    for (var i = 0; i < rows.length && seen < 25; i++) {
      var text = cellText(rows[i], index);
      if (!text) continue;
      seen++;
      if (asNumber(text) !== null) numbers++;
      else if (asDate(text) !== null) dates++;
    }
    if (!seen) return "text";
    if (numbers === seen) return "number";
    if (dates === seen) return "date";
    return "text";
  }

  function comparator(type, index, dir) {
    var sign = dir === "descending" ? -1 : 1;
    return function (a, b) {
      var ta = cellText(a, index);
      var tb = cellText(b, index);
      var va;
      var vb;
      if (type === "number") {
        va = asNumber(ta);
        vb = asNumber(tb);
      } else if (type === "date") {
        va = asDate(ta);
        vb = asDate(tb);
      } else {
        // localeCompare with numeric so "item 2" sorts before "item 10".
        if (ta === tb) return 0;
        if (ta === "") return 1; // blanks last, both directions
        if (tb === "") return -1;
        return sign * ta.localeCompare(tb, undefined, { numeric: true, sensitivity: "base" });
      }
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (va === vb) return 0;
      return sign * (va < vb ? -1 : 1);
    };
  }

  /* -------------------------------------------------------------- row model */

  function bodyRows(table) {
    var tbody = table.tBodies[0];
    if (!tbody) return [];
    return Array.prototype.filter.call(tbody.rows, function (row) {
      // A single full-width cell is a placeholder ("No records yet"), not data.
      if (row.cells.length === 1 && row.cells[0].colSpan > 1) {
        row.classList.add("ww-table-empty");
        return false;
      }
      return true;
    });
  }

  function headerCells(table) {
    var head = table.tHead;
    if (!head || !head.rows.length) return [];
    // Use the last header row: grouped headers put the leaf columns there.
    var row = head.rows[head.rows.length - 1];
    return Array.prototype.slice.call(row.cells);
  }

  /* ---------------------------------------------------------------- render */

  var applying = 0;

  function apply(table) {
    var state = STATE.get(table);
    if (!state) return;
    applying++;
    try {
      applyInner(table, state);
    } finally {
      applying--;
    }
  }

  function applyInner(table, state) {
    var rows = bodyRows(table);

    // 1. Sort every row first so paging slices the ordered set.
    if (state.sortIndex !== null && rows.length > 1) {
      var type = detectType(rows, state.sortIndex);
      var sorted = rows.slice().sort(comparator(type, state.sortIndex, state.sortDir));
      var tbody = table.tBodies[0];
      var frag = document.createDocumentFragment();
      for (var j = 0; j < sorted.length; j++) frag.appendChild(sorted[j]);
      tbody.appendChild(frag); // appending moves the existing nodes
      rows = sorted;
    }

    // 2. Filter.
    var query = state.query.trim().toLowerCase();
    var matching = [];
    for (var i = 0; i < rows.length; i++) {
      if (!query || rows[i].textContent.toLowerCase().indexOf(query) !== -1) matching.push(rows[i]);
    }

    // 3. Page the filtered set.
    var pageSize = state.paged ? state.pageSize : 0;
    var pageCount = pageSize ? Math.max(1, Math.ceil(matching.length / pageSize)) : 1;
    if (state.page > pageCount) state.page = pageCount;
    if (state.page < 1) state.page = 1;

    var start = pageSize ? (state.page - 1) * pageSize : 0;
    var end = pageSize ? start + pageSize : matching.length;
    var onPage = matching.slice(start, end);

    var shown = new Set(onPage);
    for (var k = 0; k < rows.length; k++) rows[k].hidden = !shown.has(rows[k]);

    var placeholder = table.querySelector("tbody .ww-table-empty");
    if (placeholder) placeholder.hidden = rows.length > 0;

    updateCount(table, matching.length, rows.length, onPage.length, start);
    updatePager(table, state, pageCount, matching.length);
    updateHeaders(table);
  }

  function updateCount(table, matching, total, onPage, start) {
    var state = STATE.get(table);
    if (!state || !state.count) return;
    if (!total) {
      state.count.textContent = "";
      return;
    }
    var noun = total === 1 ? " row" : " rows";
    if (state.paged && onPage < matching) {
      state.count.textContent =
        "showing " + (start + 1) + "–" + (start + onPage) + " of " + matching +
        (matching === total ? "" : " filtered from " + total);
    } else if (matching === total) {
      state.count.textContent = total + noun;
    } else {
      state.count.textContent = "showing " + matching + " of " + total;
    }
  }

  function updatePager(table, state, pageCount, matching) {
    if (!state.pager) return;
    // One page of results needs no controls.
    state.pager.hidden = !state.paged || pageCount <= 1;
    state.pageInfo.textContent = "Page " + state.page + " of " + pageCount;
    state.prevBtn.disabled = state.page <= 1;
    state.nextBtn.disabled = state.page >= pageCount;
    state.pager.setAttribute("data-total", matching);
  }

  function buildPager(table, state) {
    var pager = document.createElement("div");
    pager.className = "ww-table-pager";

    var prev = document.createElement("button");
    prev.type = "button";
    prev.className = "ww-page-btn";
    prev.textContent = "‹ Prev";

    var info = document.createElement("span");
    info.className = "ww-page-info";
    info.setAttribute("aria-live", "polite");

    var next = document.createElement("button");
    next.type = "button";
    next.className = "ww-page-btn";
    next.textContent = "Next ›";

    var sizeWrap = document.createElement("label");
    sizeWrap.className = "ww-page-size";
    sizeWrap.appendChild(document.createTextNode("Rows "));
    var select = document.createElement("select");
    [10, 25, 50, 100].forEach(function (n) {
      var opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = String(n);
      if (n === state.pageSize) opt.selected = true;
      select.appendChild(opt);
    });
    sizeWrap.appendChild(select);

    pager.appendChild(prev);
    pager.appendChild(info);
    pager.appendChild(next);
    pager.appendChild(sizeWrap);

    var anchor = scrollAnchor(table);
    anchor.parentNode.insertBefore(pager, anchor.nextSibling);

    prev.addEventListener("click", function () {
      state.page = Math.max(1, state.page - 1);
      apply(table);
    });
    next.addEventListener("click", function () {
      state.page += 1;
      apply(table);
    });
    select.addEventListener("change", function () {
      state.pageSize = Number(select.value) || 25;
      state.page = 1;
      apply(table);
    });

    state.pager = pager;
    state.pageInfo = info;
    state.prevBtn = prev;
    state.nextBtn = next;
  }

  function updateHeaders(table) {
    var state = STATE.get(table);
    var cells = headerCells(table);
    for (var i = 0; i < cells.length; i++) {
      var th = cells[i];
      if (!th.classList.contains("ww-sortable")) continue;
      var active = state.sortIndex === i;
      th.setAttribute("aria-sort", active ? state.sortDir : "none");
      var arrow = th.querySelector(".ww-arrow");
      if (arrow) arrow.textContent = active ? (state.sortDir === "ascending" ? "▲" : "▼") : "↕";
    }
  }

  /* ----------------------------------------------------------------- setup */

  function buildHeaders(table) {
    var cells = headerCells(table);
    cells.forEach(function (th, index) {
      if (th.classList.contains("ww-sortable")) return;
      if (th.getAttribute("data-ww-sort") === "off") return;
      if (!th.textContent.trim()) return; // action/checkbox columns

      th.classList.add("ww-sortable");
      th.setAttribute("aria-sort", "none");

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ww-th-btn";
      while (th.firstChild) btn.appendChild(th.firstChild);
      var arrow = document.createElement("span");
      arrow.className = "ww-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "↕";
      btn.appendChild(arrow);
      th.appendChild(btn);

      btn.addEventListener("click", function () {
        var state = STATE.get(table);
        if (state.sortIndex === index) {
          state.sortDir = state.sortDir === "ascending" ? "descending" : "ascending";
        } else {
          state.sortIndex = index;
          state.sortDir = "ascending";
        }
        state.page = 1; // you sorted to see the top of the order
        apply(table);
      });
    });
  }

  /** Place controls outside the horizontal scroll box rather than inside it. */
  function scrollAnchor(table) {
    var parent = table.parentElement;
    if (parent && parent.children.length === 1) {
      var overflow = getComputedStyle(parent).overflowX;
      if (overflow === "auto" || overflow === "scroll") return parent;
    }
    return table;
  }

  function buildTools(table, label) {
    var state = STATE.get(table);
    var tools = document.createElement("div");
    tools.className = "ww-table-tools";

    var id = "ww-table-filter-" + ++UID;
    var input = document.createElement("input");
    input.type = "search";
    input.id = id;
    input.className = "ww-table-filter";
    input.placeholder = label;
    input.setAttribute("aria-label", label);

    var count = document.createElement("span");
    count.className = "ww-table-count";
    count.setAttribute("aria-live", "polite");

    tools.appendChild(input);
    tools.appendChild(count);

    var anchor = scrollAnchor(table);
    anchor.parentNode.insertBefore(tools, anchor);

    input.addEventListener("input", function () {
      state.query = input.value;
      state.page = 1; // a new query should land on its first results
      apply(table);
    });

    state.input = input;
    state.count = count;
    state.tools = tools;
  }

  function enhance(table, options) {
    if (!table || table.getAttribute("data-ww-table") === "off") return;
    if (STATE.has(table)) return;
    if (!table.tHead || !headerCells(table).length) return;
    if (!table.tBodies.length) return;

    injectStyles();
    var opts = options || {};

    // Tables that already carry their own pager (server-side or app-driven)
    // opt out with data-ww-page="off" so the page never shows two sets.
    var paged = table.getAttribute("data-ww-page") !== "off";
    if (opts.paged === false) paged = false;
    var size = Number(table.getAttribute("data-ww-page-size")) || opts.pageSize || 25;

    var state = {
      query: "",
      sortIndex: null,
      sortDir: "ascending",
      paged: paged,
      pageSize: size,
      page: 1,
    };
    STATE.set(table, state);

    buildHeaders(table);
    buildTools(table, opts.filterLabel || "Filter rows…");
    if (paged) buildPager(table, state);
    table.setAttribute("data-ww-table", "on");
    apply(table);
  }

  /**
   * Re-read a table after its rows were replaced, keeping sort and filter.
   * Called automatically by the observer; exported for explicit use.
   */
  function refresh(table) {
    if (!STATE.has(table)) {
      enhance(table);
      return;
    }
    var state = STATE.get(table);
    // A re-rendered <thead> loses its buttons; rebuild them if so.
    buildHeaders(table);
    if (state.input && state.input.value !== state.query) state.query = state.input.value;
    apply(table);
  }

  function enhanceAll(root) {
    var scope = root || document;
    var tables = scope.querySelectorAll("table");
    for (var i = 0; i < tables.length; i++) enhance(tables[i]);
  }

  /* -------------------------------------------------------------- observer */

  var pending = new Set();
  var scheduled = false;

  function flush() {
    scheduled = false;
    pending.forEach(function (table) {
      if (table.isConnected) refresh(table);
    });
    pending.clear();
    enhanceAll(document);
  }

  function defer(fn) {
    if (window.requestAnimationFrame) window.requestAnimationFrame(fn);
    else setTimeout(fn, 16);
  }

  function schedule(table) {
    if (table) pending.add(table);
    if (scheduled) return;
    scheduled = true;
    defer(flush);
  }

  function observe() {
    if (!window.MutationObserver) return;
    new MutationObserver(function (records) {
      // apply() reorders rows and writes counts; reacting to that would loop.
      if (applying) return;
      for (var i = 0; i < records.length; i++) {
        var target = records[i].target;
        if (!(target instanceof Element)) continue;
        var table = target.closest ? target.closest("table") : null;
        if (table && STATE.has(table)) {
          schedule(table);
        } else if (records[i].addedNodes.length) {
          schedule(null);
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  window.WWTable = { enhance: enhance, enhanceAll: enhanceAll, refresh: refresh };

  function init() {
    enhanceAll(document);
    observe();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
