"use client";

import { db } from "../firebaseConfig";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";

export default function FixRecords() {
  const ML_PER_GRAM = 250 / 217; // 263g=250ml → 中身217g

  const handleFix = async () => {
    const snap = await getDocs(collection(db, "records"));

    let count = 0;

    for (const r of snap.docs) {
      const data = r.data();

      // 過去データの ml は「gのまま」なので補正する
      const oldMl = Number(data.ml);

      // 新しい正しいmLに変換
      const newMl = oldMl * ML_PER_GRAM;

      await updateDoc(doc(db, "records", r.id), {
        ml: Math.round(newMl * 10) / 10, // 小数1桁に丸める
      });

      count++;
    }

    alert(`補正完了：${count}件の記録を修正しました`);
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>過去データ補正ツール</h1>
      <p>過去の「重さ＝mL」データを正しいmLに変換します。</p>

      <button
        onClick={handleFix}
        style={{
          padding: "12px 20px",
          background: "#2AAE9E",
          color: "white",
          borderRadius: "8px",
          border: "none",
          fontSize: "18px",
        }}
      >
        補正を実行する
      </button>
    </div>
  );
}
