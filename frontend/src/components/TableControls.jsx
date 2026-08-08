import { useMemo, useState } from "react";

/**
 * Client-side sort + filter for the tool tables.
 *
 * React owns these rows, so the DOM-mutating ww-table.js used elsewhere in the
 * network would fight the reconciler. This derives the visible rows instead.
 *
 * Both operations apply to the rows currently in `rows`. On a server-paginated
 * table that is the loaded page only, which is what the row counter reports.
 *
 *   const table = useTableControls(rows, {
 *     columns: { name: (r) => r.name, score: (r) => Number(r.score) },
 *     search: (r) => `${r.name} ${r.category}`,
 *   });
 */
export function useTableControls(
  rows,
  { columns = {}, search, initialSort, pageSize: initialPageSize = 25, paged = true } = {}
) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(() =>
    initialSort ? { key: initialSort.key, dir: initialSort.dir || "asc" } : null
  );
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);

  const list = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    const text = search || ((row) => Object.values(row || {}).join(" "));
    return list.filter((row) => String(text(row) ?? "").toLowerCase().includes(q));
  }, [list, query, search]);

  const visible = useMemo(() => {
    if (!sort || !columns[sort.key]) return filtered;
    const get = columns[sort.key];
    const sign = sort.dir === "desc" ? -1 : 1;
    return [...filtered].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      const na = va === null || va === undefined || va === "";
      const nb = vb === null || vb === undefined || vb === "";
      if (na && nb) return 0;
      if (na) return 1; // blanks last in both directions
      if (nb) return -1;
      if (typeof va === "number" && typeof vb === "number") {
        if (Number.isNaN(va) && Number.isNaN(vb)) return 0;
        if (Number.isNaN(va)) return 1;
        if (Number.isNaN(vb)) return -1;
        return sign * (va - vb);
      }
      return sign * String(va).localeCompare(String(vb), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
  }, [filtered, sort, columns]);

  const pageCount = paged ? Math.max(1, Math.ceil(visible.length / pageSize)) : 1;
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = paged ? (safePage - 1) * pageSize : 0;
  const pageRows = paged ? visible.slice(start, start + pageSize) : visible;

  function toggleSort(key) {
    setPage(1); // you sorted to see the top of the order
    setSort((current) =>
      current && current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  return {
    rows: pageRows,
    total: list.length,
    shown: visible.length,
    query,
    setQuery: (value) => {
      setPage(1); // a new query should land on its first results
      setQuery(value);
    },
    sort,
    toggleSort,
    paged,
    page: safePage,
    pageCount,
    pageSize,
    setPageSize: (size) => {
      setPage(1);
      setPageSize(size);
    },
    setPage,
    rangeStart: start,
    rangeEnd: start + pageRows.length,
  };
}

function countText({ total, shown, paged, rangeStart, rangeEnd }) {
  if (total === 0) return "";
  if (paged && rangeEnd - rangeStart < shown) {
    const range = `showing ${rangeStart + 1}–${rangeEnd} of ${shown}`;
    return shown === total ? range : `${range} filtered from ${total}`;
  }
  if (shown === total) return `${total} ${total === 1 ? "row" : "rows"}`;
  return `showing ${shown} of ${total}`;
}

/** Filter box plus a row counter that makes the filtered scope explicit. */
export function TableFilter({ controls, placeholder = "Filter rows…", note }) {
  const { query, setQuery } = controls;
  return (
    <div className="ww-table-tools">
      <input
        type="search"
        className="ww-table-filter"
        value={query}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => setQuery(event.target.value)}
      />
      <span className="ww-table-count" aria-live="polite">
        {countText(controls)}
      </span>
      {note ? <span className="ww-table-note">{note}</span> : null}
    </div>
  );
}

/** Prev/next plus a page-size picker. Hides itself when there is one page. */
export function TablePager({ controls }) {
  const { paged, page, pageCount, pageSize, setPage, setPageSize } = controls;
  if (!paged || pageCount <= 1) return null;
  return (
    <div className="ww-table-pager">
      <button
        type="button"
        className="ww-page-btn"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
      >
        ‹ Prev
      </button>
      <span className="ww-page-info" aria-live="polite">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        className="ww-page-btn"
        disabled={page >= pageCount}
        onClick={() => setPage(page + 1)}
      >
        Next ›
      </button>
      <label className="ww-page-size">
        Rows{" "}
        <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/** A <th> whose label toggles sorting for `col`. */
export function SortHeader({ controls, col, children, ...rest }) {
  const { sort, toggleSort } = controls;
  const active = sort && sort.key === col;
  const ariaSort = active ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
  return (
    <th className="ww-sortable" aria-sort={ariaSort} {...rest}>
      <button type="button" className="ww-th-btn" onClick={() => toggleSort(col)}>
        {children}
        <span className="ww-arrow" aria-hidden="true">
          {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}
