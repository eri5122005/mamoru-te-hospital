import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminTop() {
  const [todayTotal, setTodayTotal] = useState(0);
  const [todayRate, setTodayRate] = useState(0);
  const [todayNotEnteredCount, setTodayNotEnteredCount] = useState(0);

  const [monthTotal, setMonthTotal] = useState(0);
  const [ranking, setRanking] = useState([]);
  const [wardRate, setWardRate] = useState([]);

  useEffect(() => {
    const fetchRanking = async () => {
      const res = await fetch("/api/admin/ranking");
      const data = await res.json();
      setRanking(data);
    };
    fetchRanking();

    fetch("/api/admin/ward-rate")
      .then(res => res.json())
      .then(data => setWardRate(data));

    fetch("/api/admin/today-total")
      .then(res => res.json())
      .then(data => setTodayTotal(data.total));

    fetch("/api/admin/today-rate")
      .then(res => res.json())
      .then(data => setTodayRate(data.rate));

    fetch("/api/admin/today-not-entered-count")
      .then(res => res.json())
      .then(data => setTodayNotEnteredCount(data.count));

    fetch("/api/admin/month-total")
      .then(res => res.json())
      .then(data => setMonthTotal(data.total));
  }, []);

  // ★★★ すべての style をコンポーネント内に移動（Next.js pages ルーターで必須）
  const Grid = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "14px",
};



  const Card = {
    background: "#DFF7F2",
    borderRadius: "14px",
    padding: "16px",
    border: "1px solid #cfeeee",
    minHeight: "140px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  };

  const Title = {
    fontSize: "22px",
    margin: "20px 0 12px",
    color: "#006b5f",
  };

  const Value = {
    fontSize: "26px",
    fontWeight: "bold",
    marginTop: "6px",
    color: "#006b5f",
  };

  const buttonStyle = {
    width: "100%",
    padding: "14px",
    background: "#006b5f",
    color: "#fff",
    borderRadius: "12px",
    border: "none",
    fontSize: "18px",
    marginTop: "16px",
    cursor: "pointer",
  };

  const buttonStyle2 = {
    width: "100%",
    padding: "14px",
    background: "#008b75",
    color: "#fff",
    borderRadius: "12px",
    border: "none",
    fontSize: "18px",
    marginTop: "12px",
    cursor: "pointer",
  };

  return (
    <div style={{ background: "#F9F9F9", minHeight: "100vh", padding: "20px" }}>
      <h1 style={{ fontSize: "28px", marginBottom: "20px", color: "#006b5f" }}>
        🌿 総合管理者トップページ
      </h1>

      {/* 今日の状況 */}
      <h2 style={Title}>今日の状況</h2>
      <div style={Grid}>
        <div style={Card}>
          <div>🧴 今日の使用量</div>
          <div style={Value}>{todayTotal} mL</div>
        </div>

        <div style={Card}>
          <div>📊 今日の入力率</div>
          <div style={Value}>{todayRate}%</div>
        </div>

        <div style={Card}>
          <div>👤 未入力者</div>
          <div style={Value}>{todayNotEnteredCount} 人</div>
        </div>
      </div>

      {/* ランキング */}
      <h2 style={Title}>病棟別ランキング</h2>
      <div style={Grid}>
        {ranking.map((ward, index) => (
          <div key={index} style={Card}>
            <div style={{ fontSize: "18px" }}>{index + 1}位：{ward.wardName}</div>
            <div style={Value}>{Number(ward.total).toFixed(2)} mL</div>
          </div>
        ))}
      </div>

      <Link href="/admin/global-ranking">
        <button style={buttonStyle}>🧴 院内個人ランキングを見る</button>
      </Link>

      <Link href="/admin/global-avg-ranking">
        <button style={buttonStyle2}>📊 平均使用量ランキングを見る</button>
      </Link>

      {/* 入力率 */}
      <h2 style={Title}>病棟別入力率</h2>
      <div style={Grid}>
        {wardRate.map((ward, index) => (
          <div key={index} style={Card}>
            <div style={{ fontSize: "18px" }}>{ward.wardName}</div>
            <div style={Value}>{ward.rate}%</div>
          </div>
        ))}
      </div>

      {/* 今月 */}
      <h2 style={Title}>今月の状況</h2>
      <div style={Grid}>
        <div style={Card}>
          <div>📅 今月の総使用量</div>
          <div style={Value}>{Number(monthTotal).toFixed(2)} mL</div>
        </div>
      </div>

      {/* 管理メニュー */}
      <h2 style={Title}>管理メニュー</h2>
      <div style={Grid}>
        <Link href="/admin/ward">
          <div style={{ ...Card, background: "#006b5f", color: "#fff", minHeight: "120px" }}>
            <div style={{ fontSize: "20px", fontWeight: "600" }}>🏥 病棟一覧</div>
          </div>
        </Link>

        <Link href="/admin/staff">
          <div style={{ ...Card, background: "#008b75", color: "#fff", minHeight: "120px" }}>
            <div style={{ fontSize: "20px", fontWeight: "600" }}>👥 スタッフ一覧</div>
          </div>
        </Link>
      </div>

      {/* ログアウト */}
      <h2 style={Title}>ログアウト</h2>
      <div style={Grid}>
        <Link href="/login">
          <div style={{ ...Card, background: "#444", color: "#fff", minHeight: "120px" }}>
            <div style={{ fontSize: "20px", fontWeight: "600" }}>🔙 ログイン画面に戻る</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
