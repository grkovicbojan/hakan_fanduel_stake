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
export function useTableControls(rows, { columns = {}, search, initialSort } = {}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(() =>
    initialSort ? { key: initialSort.key, dir: initialSort.dir || "asc" } : null
  );

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

  function toggleSort(key) {
    setSort((current) =>
      current && current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  return {
    rows: visible,
    total: list.length,
    shown: visible.length,
    query,
    setQuery,
    sort,
    toggleSort,
  };
}

/** Filter box plus a row counter that makes the filtered scope explicit. */
export function TableFilter({ controls, placeholder = "Filter rows…", note }) {
  const { query, setQuery, total, shown } = controls;
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
        {total === 0 ? "" : shown === total ? `${total} ${total === 1 ? "row" : "rows"}` : `showing ${shown} of ${total}`}
      </span>
      {note ? <span className="ww-table-note">{note}</span> : null}
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
