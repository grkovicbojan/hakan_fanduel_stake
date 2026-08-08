import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { SortHeader, TableFilter, useTableControls } from "../components/TableControls.jsx";

const PAGE_SIZE = 50;

export default function Alert() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api
      .getAlerts({ page, pageSize: PAGE_SIZE })
      .then((payload) => {
        setRows(payload.rows ?? []);
        setTotal(payload.total ?? 0);
      })
      .catch(() => {});
  }, [page]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);

  const table = useTableControls(rows, {
    columns: {
      timestamp: (row) => new Date(row.timestamp).getTime(),
      alert: (row) => JSON.stringify(row.alert_data ?? ""),
    },
    search: (row) =>
      `${new Date(row.timestamp).toLocaleString()} ${JSON.stringify(row.alert_data ?? "")}`,
  });

  return (
    <section className="tool-page">
      <h2>Alerts</h2>
      <TableFilter controls={table} placeholder="Filter alerts on this page…" />
      <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <SortHeader controls={table} col="timestamp">
              Timestamp
            </SortHeader>
            <SortHeader controls={table} col="alert">
              Alert Data
            </SortHeader>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.id}>
              <td>{new Date(row.timestamp).toLocaleString()}</td>
              <td>
                <pre>{JSON.stringify(row.alert_data, null, 2)}</pre>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className="row">
        <button type="button" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)}>
          Prev
        </button>
        <span>
          Page {safePage}/{pageCount} ({total} total)
        </span>
        <button type="button" disabled={safePage >= pageCount} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>
    </section>
  );
}
