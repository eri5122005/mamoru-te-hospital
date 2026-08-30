import { getRecords } from "../../utils/getRecords";

export default function RecordsPage({ records }) {
  return (
    <div style={{ padding: "20px" }}>
      <h1>記録一覧</h1>

      <ul>
        {records.map((r) => (
          <li key={r.id} style={{ marginBottom: "12px" }}>
            <strong>{r.name}</strong>（{r.department}）
            <br />
            使用量: {r.ml} ml / {r.amount} 回
            <br />
            単位: {r.unit}
            <br />
            日付: {new Date(r.date.seconds * 1000).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function getServerSideProps() {
  const records = await getRecords();
  return { props: { records } };
}
