import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

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

  return (
    <section>
      <h2>Alerts</h2>
      <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Alert Data</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
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
