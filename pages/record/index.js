"use client";

import { getAppBuildId } from "../../utils/getAppBuildId";

import {
  normalMessages,
  funMessages,
  mintSpiritMessages,
  legendaryMintMessages,
} from "../../data/messages";
import NavBar from "../../components/NavBar";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { Timestamp } from "firebase/firestore";

// ★ 病棟ID → 表示名マップ
const wardNameMap = {
    "nursing": "看護部",
  "6f": "6階",
  "5f": "5階",
  "4f": "4階",
  "78f": "7.8階",
  "gairai": "外来",
  "touseki": "透析室",
  "riha": "リハビリ",
  "ikyoku": "医局",
  "shisetsu": "施設管理",
};

export default function RecordPage() {
  const router = useRouter();
  const EMPTY_WEIGHT = 45;
const FULL_WEIGHT = 263;

// ★ g → mL 換算係数（263g = 250mL）
const ML_PER_GRAM = 250 / (FULL_WEIGHT - EMPTY_WEIGHT); 
// = 250 / 218 = 1.147mL

  

  const [weightNow, setWeightNow] = useState("");
const [message, setMessage] = useState("");
const [messageType, setMessageType] = useState("normal");
const [staff, setStaff] = useState(null);

const [showExchangeConfirm, setShowExchangeConfirm] = useState(false);

// ★ 二重登録防止フラグ（ここに追加）
const [isSubmitting, setIsSubmitting] = useState(false);
// ★ ボトル交換の二重実行を同期的に防止
const exchangeLockRef = useRef(false);
const recordLockRef = useRef(false);
const messageTimerRef = useRef(null);
const clearMessageTimer = () => {
  clearTimeout(messageTimerRef.current);
  messageTimerRef.current = null;
};
const weightUpdateWarning = "記録と次回計算用の重量の保存結果を確認できません。\n再登録せず、管理者に確認してください。";
useEffect(() => () => clearTimeout(messageTimerRef.current), []);

// ★ ボトル交換処理中のボタン無効化
const [isExchangeProcessing, setIsExchangeProcessing] = useState(false);

 useEffect(() => {
  if (typeof window === "undefined") return;

  const local = JSON.parse(localStorage.getItem("currentStaff"));
  if (!local) {
    router.replace("/login");
    return;
  }

  if (!local.lastWeight) {
    router.replace("/first-weight");
    return;
  }

  setStaff(local);
}, []);

  // ★ 記録保存共通処理
  const saveRecord = async (
  usedMl,
  nowWeightValue,
  isBottleExchange = false
) => {
    let savedRecord;
    try {
      const now = new Date();
const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);

const response = await fetch("/api/records", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-App-Build-Id": getAppBuildId() || "" },
  body: JSON.stringify({
    staffId: staff.staffId,
    name: staff.name,
    department: wardNameMap[staff.wardId] || staff.department,
    wardId: staff.wardId,
    ml: usedMl,
    unit: "weight",
    mintPoint: 1,
    weightNow: nowWeightValue,
weightPrev: staff.lastWeight,
isBottleExchange: isBottleExchange,
date: Timestamp.fromDate(jstNow),   // ← ★これが必須
  }),
});

      if (!response.ok) {
        let detail = "";
        try {
          const body = await response.json();
          if (typeof body?.error === "string" && body.error.trim()) {
            detail = `\n詳細：${body.error}`;
          }
        } catch {
          // 空・HTML・不正JSONの応答でも共通の案内を表示する。
        }
        setMessage(detail ? `記録を保存できませんでした。${detail}` : `記録を保存できませんでした。\n${weightUpdateWarning}`);
        return false;
      }
      savedRecord = await response.json();
      if (savedRecord?.ok !== true || typeof savedRecord.staffId !== "string" ||
          !Number.isFinite(savedRecord.lastWeight) || !Number.isFinite(savedRecord.ml)) {
        throw new Error("Invalid save response");
      }
    } catch (error) {
      setMessage(`保存結果を確認できませんでした。\n${weightUpdateWarning}`);
      return false;
    }

    try {
    const updated = { ...staff, staffId: savedRecord.staffId, lastWeight: savedRecord.lastWeight };
    setStaff(updated);
    if (typeof window !== "undefined") {
  localStorage.setItem("currentStaff", JSON.stringify(updated));
  localStorage.setItem(`staff-${savedRecord.staffId}`, JSON.stringify(updated));
  const history = JSON.parse(localStorage.getItem("history") || "[]");

  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  history.push({
    staffId: savedRecord.staffId,
    name: staff.name,
    department: wardNameMap[staff.wardId] || staff.department,
    wardId: staff.wardId,
    ml: savedRecord.ml,
    unit: "weight",
    weightNow: nowWeightValue,
weightPrev: staff.lastWeight,
isBottleExchange: isBottleExchange,
date: jstNow,   // ← ★ここが最重要（JSTで保存）
  });

  localStorage.setItem("history", JSON.stringify(history));
}
    } catch {
      setMessage("記録は保存されましたが、端末内の処理に失敗しました。\n再登録せず、管理者に確認してください。");
      return false;
    }

// ★ 記録成功時にメッセージを抽選
const roll = Math.random();
let randomMessage;

if (roll < 0.01) {
  // 1%：伝説級
  setMessageType("legendary");
  randomMessage =
    legendaryMintMessages[
      Math.floor(Math.random() * legendaryMintMessages.length)
    ];
} else if (roll < 0.10) {
  // 9%：ミントの精霊
  setMessageType("mint");
  randomMessage =
    mintSpiritMessages[
      Math.floor(Math.random() * mintSpiritMessages.length)
    ];
} else if (roll < 0.30) {
  // 20%：おもしろ・ランキング系
  setMessageType("fun");
  randomMessage =
    funMessages[Math.floor(Math.random() * funMessages.length)];
} else {
  // 70%：通常
  setMessageType("normal");
  randomMessage =
    normalMessages[Math.floor(Math.random() * normalMessages.length)];
}

setMessage(
  `記録しました：${nowWeightValue}g → ${savedRecord.ml}mL\n${randomMessage}`
);

    setWeightNow("");
    messageTimerRef.current = setTimeout(() => setMessage(""), 3000);
    return true;
  };

 // ★ 交換ダイアログを開くときにロックする
const openExchangeDialog = () => {
  setIsSubmitting(true);        // ★ ここでロック
  setShowExchangeConfirm(true);
};


// ★ ボトル交換 YES（完全版）
const handleExchangeYes = async () => {
  // ★ すでに交換処理中なら2回目は実行しない
  if (exchangeLockRef.current) return;
  if (!isSubmitting) return;

  // ★ awaitより前にロックする
  exchangeLockRef.current = true;
  setIsExchangeProcessing(true);

  try {
    clearMessageTimer();
    setMessageType("normal");
    setMessage("記録中です…");
  const now = Number(weightNow);
  const prev = Number(staff.lastWeight);

  // 入力値の安全確認
  if (
    !Number.isFinite(now) ||
    now <= EMPTY_WEIGHT ||
    now > FULL_WEIGHT
  ) {
    setMessage(
      `重さは${EMPTY_WEIGHT + 1}g～${FULL_WEIGHT}gの範囲で入力してください。`
    );
    setIsSubmitting(false);
    setShowExchangeConfirm(false);
    return;
  }

  // 前回重量の安全確認
  if (
    !Number.isFinite(prev) ||
    prev < EMPTY_WEIGHT ||
    prev > FULL_WEIGHT
  ) {
    setMessage("前回の重さに異常があります。記録できませんでした。");
    setIsSubmitting(false);
    setShowExchangeConfirm(false);
    return;
  }

  // 旧ボトル：
  // 前回重量から空ボトル45gになるまで使用した分
  const oldBottleUsedG = prev - EMPTY_WEIGHT;

  // 新ボトル：
  // 満タン263gから今回重量まで使用した分
  const newBottleUsedG = FULL_WEIGHT - now;

  // 旧ボトル分 ＋ 新ボトル分
  const totalUsedG = oldBottleUsedG + newBottleUsedG;

  let usedMl = totalUsedG * ML_PER_GRAM;

  if (usedMl < 0) usedMl = 0;

  usedMl = Number(usedMl.toFixed(2));

  const saved = await saveRecord(usedMl, now, true);

  if (!saved) {
    setIsSubmitting(false);
    return;
  }

    setIsSubmitting(false);
  setShowExchangeConfirm(false);

  } catch {
    setMessage(`処理を完了できませんでした。\n${weightUpdateWarning}`);
  } finally {
    setIsSubmitting(false);
    recordLockRef.current = false;
    setShowExchangeConfirm(false);
    // ★ 成功・失敗にかかわらず交換用ロックを解除
    exchangeLockRef.current = false;
    setIsExchangeProcessing(false);
  }
};


// ★ ボトル交換 NO（完全版）
const handleExchangeNo = () => {
  // ★「はい」の処理中なら「いいえ」は実行しない
  if (exchangeLockRef.current) return;
  if (!isSubmitting) return;

  setMessage("重さが増えています。正しい重さを入力してください。");
  setShowExchangeConfirm(false);

  setIsSubmitting(false);
  recordLockRef.current = false;
};

  // ★ 記録処理（重さ方式）完全修正版
const handleRecord = async () => {
  if (!staff) return;

  // ★ 連打防止（2回目を絶対に走らせない）
  if (recordLockRef.current || isSubmitting) return;
  recordLockRef.current = true;
  setIsSubmitting(true);
  let awaitingExchangeConfirmation = false;

  try {
  clearMessageTimer();
  setMessageType("normal");
  // ★ 押した瞬間に反応させる（現場向け）
  setMessage("記録中です…");

  if (!weightNow) {
    setMessage("重さを入力してください");
    setIsSubmitting(false);
    return;
  }

  // ★ ボトル重量としてあり得ない値を防止
const inputWeight = Number(weightNow);

if (
  !Number.isFinite(inputWeight) ||
  inputWeight <= EMPTY_WEIGHT ||
  inputWeight > FULL_WEIGHT
) {
  setMessage(
    `重さは${EMPTY_WEIGHT + 1}g～${FULL_WEIGHT}gの範囲で入力してください。`
  );
  setIsSubmitting(false);
  return;
}

  // ★ 登録前の確認ポップアップ
  const ok = confirm(`${weightNow} g で登録してよろしいですか？`);
  if (!ok) {
    setIsSubmitting(false);
    return;
  }

  const now = Number(weightNow);
  let prev = Number(staff.lastWeight);


  // ★ lastWeight が壊れている人を自動初期化
  if (isNaN(prev) || prev < EMPTY_WEIGHT || prev > FULL_WEIGHT) {
    prev = FULL_WEIGHT; // 初期値は満タン扱い
  }

  // ★ ボトル交換判定（誤差3gまで許容）
if (now > prev + 3) {
  setMessage("記録中です…（ボトル交換の確認）");
  setShowExchangeConfirm(true);

  // ★ ロックは維持する（YES/NOで解除する）
  awaitingExchangeConfirmation = true;
  return;
}


  // ★ 使用量計算（異常値を自動補正）
  let usedMl = (prev - now) * ML_PER_GRAM;

  if (usedMl < 0) usedMl = 0;          // マイナス補正
  if (usedMl < 0.01) usedMl = 0;       // 極小値補正
  usedMl = Number(usedMl.toFixed(2));  // 小数点第2位に統一

  // ★ 二重登録防止（return を必ず入れる）
  const saved = await saveRecord(usedMl, now);
  if (!saved) return;
  } catch {
    setMessage(`処理を完了できませんでした。\n${weightUpdateWarning}`);
  } finally {
    if (!awaitingExchangeConfirmation) {
      setIsSubmitting(false);
      recordLockRef.current = false;
    }
  }
  };


  if (!staff) {
    return <p>スタッフ情報を読み込んでいます…</p>;
  }

  return (
    <div
      style={{
        background: "#F9F9F9",
        minHeight: "100vh",
        padding: "16px",
        fontFamily: "sans-serif",
        maxWidth: "480px",
        margin: "0 auto",
      }}
    >
      <main>
        <h1 style={{ color: "#006b5f", marginBottom: "10px" }}>今日の記録</h1>

        {showExchangeConfirm && (
          <div
            style={{
              background: "#fff3cd",
              padding: "16px",
              borderRadius: "12px",
              marginBottom: "20px",
              border: "1px solid #ffeeba",
              textAlign: "center",
            }}
          >
            <p style={{ marginBottom: "12px", fontWeight: "bold" }}>
              重さが前回より増えています。ボトル交換しましたか？
            </p>

            <button
  onClick={handleExchangeYes}
  disabled={isExchangeProcessing}
  style={{
                background: "#2AAE9E",
                color: "white",
                padding: "10px 16px",
                borderRadius: "10px",
                border: "none",
                marginRight: "10px",
              }}
            >
              はい
            </button>

            <button
  onClick={handleExchangeNo}
  disabled={isExchangeProcessing}
  style={{
                background: "#ccc",
                color: "#333",
                padding: "10px 16px",
                borderRadius: "10px",
                border: "none",
              }}
            >
              いいえ
            </button>
          </div>
        )}

        <div
          style={{
            background: "#ffffff",
            padding: "16px",
            borderRadius: "16px",
            marginBottom: "20px",
            border: "1px solid #cfeeee",
          }}
        >
          <p>職員番号：{staff.staffId}</p>
          <p>名前：{staff.name}</p>
          <p>病棟：{wardNameMap[staff.wardId] || staff.department}</p>
        </div>

        <div
          style={{
            background: "#ffffff",
            padding: "16px",
            borderRadius: "16px",
            marginBottom: "20px",
            border: "1px solid #cfeeee",
          }}
        >
          <label style={{ color: "#006b5f" }}>ボトルの現在の重さ（g）</label>

          <input
  type="number"
  value={weightNow}
  onChange={(e) => {
    const v = e.target.value;

    // ★ 全角 → 半角に強制変換（ここが最重要）
    const half = v.replace(/[０-９]/g, s =>
      String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
    );

    setWeightNow(half);
  }}
  placeholder="例：240（g）"
  style={{
    width: "100%",
    padding: "12px",
    borderRadius: "12px",
    border: "1px solid #cfeeee",
    marginTop: "8px",
    fontSize: "16px",
  }}
/>

        </div>

        {message && (
  <div
    style={{
      background:
        messageType === "legendary"
          ? "linear-gradient(135deg, #fff7c2, #ffe08a, #fff7c2)"
          : messageType === "mint"
          ? "linear-gradient(135deg, #e8fff8, #c9f7e8)"
          : "#dffef5",

      color:
        messageType === "legendary"
          ? "#8a6500"
          : "#008b75",

      padding:
        messageType === "legendary" || messageType === "mint"
          ? "20px 16px"
          : "16px",

      borderRadius: "16px",
      textAlign: "center",
      marginBottom: "20px",
      fontSize: "18px",
      fontWeight: "bold",
      whiteSpace: "pre-line",

      border:
        messageType === "legendary"
          ? "2px solid #e4b93f"
          : messageType === "mint"
          ? "2px solid #74d9bd"
          : "none",

      boxShadow:
        messageType === "legendary"
          ? "0 0 18px rgba(218, 165, 32, 0.45)"
          : messageType === "mint"
          ? "0 0 14px rgba(0, 180, 150, 0.25)"
          : "0 0 8px rgba(0, 150, 130, 0.15)",
    }}
  >
    {messageType === "legendary" && (
      <div
        style={{
          fontSize: "21px",
          marginBottom: "8px",
        }}
      >
        👑✨ 伝説のミントの精霊 降臨！ ✨👑
      </div>
    )}

    {messageType === "mint" && (
      <div
        style={{
          fontSize: "20px",
          marginBottom: "8px",
        }}
      >
        ✨🧚 ミントの精霊が現れた！ 🧚✨
      </div>
    )}

    {message}
  </div>
)}

        <button
  onClick={handleRecord}
  disabled={isSubmitting}
  style={{
    width: "100%",
    padding: "16px",
    background: "#cfeeee",
    border: "none",
    borderRadius: "12px",
    fontSize: "20px",
    color: "#006b5f",
    cursor: isSubmitting ? "not-allowed" : "pointer",
    opacity: isSubmitting ? 0.6 : 1,
  }}
>
  ＋ 記録する
</button>


        <NavBar />
      </main>
    </div>
  );
}
