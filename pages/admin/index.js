import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminTop() {
  const [todayTotal, setTodayTotal] = useState(0);
  const [todayRate, setTodayRate] = useState(0);
  const [todayNotEnteredCount, setTodayNotEnteredCount] = useState(0);

  const [monthTotal, setMonthTotal] = useState(0); // 今月は使用量だけ

  useEffect(() => {
    fetch("/api/admin/today-total")
      .then(res => res.json())
      .then(data => setTodayTotal(data.total));

    fetch("/api/admin/today-rate")
      .then(res => res.json())
      .then(data => setTodayRate(data.rate));

    fetch("/api/admin/today-not-entered-count")
      .then(res => res.json())
      .then(data => setTodayNotEnteredCount(data.count));

    // 今月の総使用量だけ取得
    fetch("/api/admin/month-total")
      .then(res => res.json())
      .then(data => setMonthTotal(data.total));
  }, []);

  const innerRow = {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    width: "100%",
    paddingLeft: "100px",
  };

  const SmallCard = ({ icon, title, value }) => (
    <div style={smallCardStyle}>
      <div style={innerRow}>
        <div style={{ fontSize: "32px" }}>{icon}</div>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: "14px", opacity: 0.7 }}>{title}</div>
          <div style={{ fontSize: "26px", fontWeight: "bold" }}>{value}</div>
        </div>
      </div>
    </div>
  );

  const MenuCard = ({ icon, label }) => (
    <div style={menuCard}>
      <div style={innerRow}>
        <div style={{ fontSize: "28px" }}>{icon}</div>
        <div style={{ textAlign: "left", fontSize: "20px" }}>{label}</div>
      </div>
    </div>
  );

  return (
    <div style={{ background: "#F9F9F9", minHeight: "100vh", padding: "20px" }}>
      <h1 style={{ fontSize: "28px", marginBottom: "20px" }}>総合管理者トップページ</h1>

      {/* 今日の状況 */}
      <div style={sectionCard}>
        <h2 style={sectionTitle}>今日の状況</h2>
        <div style={cardColumn}>
          <SmallCard icon="🧴" title="今日の使用量" value={`${todayTotal} mL`} />
          <SmallCard icon="📊" title="今日の入力率" value={`${todayRate}%`} />
          <SmallCard icon="👤" title="今日の未入力者" value={`${todayNotEnteredCount} 人`} />
        </div>
      </div>

      {/* 病棟別ランキング */}
      <div style={sectionCard}>
        <h2 style={sectionTitle}>病棟別ランキング</h2>
        <Link href="/ranking/ward">
          <MenuCard icon="🏥" label="ランキングを見る" />
        </Link>
      </div>

      {/* 今月の状況（使用量のみ） */}
      <div style={sectionCard}>
        <h2 style={sectionTitle}>今月の状況</h2>
        <div style={cardColumn}>
          <SmallCard
            icon="📅"
            title="今月の総使用量"
            value={`${Number(monthTotal).toFixed(2)} mL`}
          />
        </div>
      </div>

      {/* 管理メニュー */}
      <div style={sectionCard}>
        <h2 style={sectionTitle}>管理メニュー</h2>
        <div style={cardColumn}>
          <Link href="/admin/ward"><MenuCard icon="🏥" label="病棟一覧" /></Link>
          <Link href="/admin/staff"><MenuCard icon="👥" label="スタッフ一覧" /></Link>
        </div>
      </div>

      {/* ログイン画面に戻る */}
      <div style={sectionCard}>
        <h2 style={sectionTitle}>ログアウト</h2>
        <div style={cardColumn}>
          <Link href="/login">
            <MenuCard icon="🔙" label="ログイン画面に戻る" />
          </Link>
        </div>
      </div>
    </div>
  );
}

const sectionCard = {
  background: "transparent",
  borderRadius: "16px",
  padding: "10px",
  marginBottom: "24px",
  border: "1px solid #E0E0E0",
};

const sectionTitle = {
  fontSize: "22px",
  marginBottom: "16px",
  color: "#006b5f",
};

const cardColumn = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const smallCardStyle = {
  width: "100%",
  height: "140px",
  background: "#DFF7F2",
  borderRadius: "12px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  color: "#2AAE9E",
  border: "1px solid #E0E0E0",
};

const menuCard = {
  width: "100%",
  height: "120px",
  background: "#DFF7F2",
  borderRadius: "12px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  color: "#2AAE9E",
  border: "1px solid #E0E0E0",
  cursor: "pointer",
};
