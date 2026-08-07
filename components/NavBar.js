"use client";

import { useRouter } from "next/router";

export default function NavBar() {
  const router = useRouter();

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "100%",
        background: "#cfeeee",
        borderTop: "1px solid #b7e3e3",
        display: "flex",
        justifyContent: "space-around",
        padding: "10px 0",
        zIndex: 100,
      }}
    >
      <button onClick={() => router.push("/home")} style={btnStyle}>ホーム</button>
      <button onClick={() => router.push("/record")} style={btnStyle}>記録</button>
      <button onClick={() => router.push("/history")} style={btnStyle}>履歴</button>
      <button onClick={() => router.push("/ranking")} style={btnStyle}>ランキング</button>
    </nav>
  );
}

const btnStyle = {
  background: "none",
  border: "none",
  color: "#006b5f",
  fontSize: "14px",
  cursor: "pointer",
};
