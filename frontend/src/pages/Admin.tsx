import { useEffect, useState } from "react";
import { api, setSession } from "../lib/api";

export default function Organizer() {
  const [ranking, setRanking] = useState<any[]>([]);

  useEffect(() => {
    setSession("org_seed_01");
    api("/api/organizer/ranking")
      .then((r) => r.json())
      .then((d) => setRanking(d.ranking || []))
      .catch(console.error);
  }, []);

  return (
    <div>
      <h1>Organizer</h1>
      <p>
        <a href="/api/export.csv" onClick={() => setSession("org_seed_01")}>
          Download CSV export
        </a>
      </p>
      <ol>
        {ranking.map((r, i) => (
          <li key={r.id}>
            #{i + 1} <strong>{r.title}</strong> — score {r.score?.toFixed?.(3)}
          </li>
        ))}
      </ol>
    </div>
  );
}
