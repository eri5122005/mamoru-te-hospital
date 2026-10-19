import Link from "next/link";

export default function EditRecord() {
  return (
    <main style={{ padding: "24px", background: "#F9F9F9", minHeight: "100vh" }}>
      <div style={{ maxWidth: "480px", margin: "0 auto", color: "#006b5f" }}>
        <h1 style={{ fontSize: "24px" }}>履歴の編集機能は廃止されています</h1>
        <p style={{ lineHeight: 1.6 }}>過去の記録は履歴画面で確認できます。</p>
        <Link href="/history" style={{ display: "block", padding: "14px", marginTop: "24px", borderRadius: "12px", background: "#cfeeee", textAlign: "center" }}>
          履歴に戻る
        </Link>
      </div>
    </main>
  );
}
