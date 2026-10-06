import AmountSwitcher from "../../components/AmountSwitcher";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminTop() {
  const [todayTotal, setTodayTotal] = useState(0);
  const [monthTotal, setMonthTotal] = useState(0);

  useEffect(() => {
  // 今日の使用量
  fetch("/api/admin/todayTotal")
    .then(res => res.json())
    .then(data => setTodayTotal(data.total));

  // 今月の総使用量
  fetch("/api/admin/month-total")
    .then(res => res.json())
    .then(data => setMonthTotal(data.total));
}, []);

  // ====== UI Styles ======
  const Grid = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "16px",
  };

  const Card = {
    background: "#E8F8F6",
    borderRadius: "14px",
    padding: "16px",
    border: "1px solid #cfeeee",
    minHeight: "140px",
    display: "flex",
    alignItems: "center",
  };

  const Row = {
    display: "flex",
    alignItems: "center",
    gap: "20px",
  };

  const CardIcon = {
    marginLeft: "24px",
    fontSize: "36px",
  };

  const Value = {
    fontSize: "26px",
    fontWeight: "700",
    marginTop: "6px",
    color: "#006b5f",
  };

  const MenuCard = (bg) => ({
    background: bg,
    borderRadius: "14px",
    padding: "16px",
    minHeight: "120px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    color: "#fff",
    fontSize: "20px",
    fontWeight: "600",
  });

  return (
    <div className="admin-container">
      
      {/* ★ 中央寄せコンテナ（これが重要） */}
      <div className="admin-container" style={{ maxWidth: "600px", margin: "0 auto" }}>

        {/* タイトル */}
        <h1
  style={{
    fontSize: "26px",
    color: "#006b5f",
    marginBottom: "20px",
    textAlign: "center",
    lineHeight: "1.4",
  }}
>
  総合管理者 🌿<br />トップページ
</h1>


       <AmountSwitcher />


        {/* 今月の状況 */}
        <h2 style={{ fontSize: "22px", color: "#006b5f", marginTop: "30px", marginBottom: "12px" }}>
          今月の状況
        </h2>

        <div style={Grid}>
          <div style={Card}>
            <div style={Row}>
              <div style={CardIcon}>📅</div>
              <div>
                <div style={{ fontSize: "18px", color: "#006b5f" }}>今月の総使用量</div>
                <div style={Value}>{Number(monthTotal).toFixed(2)} mL</div>
              </div>
            </div>
          </div>
        </div>

        {/* 管理メニュー */}
        <h2 style={{ fontSize: "22px", color: "#006b5f", marginTop: "30px", marginBottom: "12px" }}>
          管理メニュー
        </h2>

        <div style={Grid}>
          <Link href="/admin/global-ranking">
            <div style={MenuCard("#006b5f")}>🧴 院内個人ランキング</div>
          </Link>

          <Link href="/admin/global-avg-ranking">
            <div style={MenuCard("#008b75")}>📊 平均使用量ランキング</div>
          </Link>

          <Link href="/admin/history-month">
            <div style={MenuCard("#4caf50")}>📅 月ごとの過去データ</div>
          </Link>

          <Link href="/admin/history-year">
            <div style={MenuCard("#388e3c")}>📆 年ごとの過去データ</div>
          </Link>

          <Link href="/admin/ward">
            <div style={MenuCard("#009688")}>🏥 病棟一覧</div>
          </Link>

          <Link href="/admin/staff">
            <div style={MenuCard("#00a39a")}>👥 スタッフ一覧</div>
          </Link>
        </div>

        {/* ログアウト */}
        <h2 style={{ fontSize: "22px", color: "#006b5f", marginTop: "30px" }}>
          ログアウト
        </h2>

        <div style={Grid}>
          <Link href="/login">
            <div style={MenuCard("#444")}>🔙 ログイン画面に戻る</div>
          </Link>
        </div>

      </div> {/* ★ 内側コンテナの閉じタグ */}

    </div>
  );
}
