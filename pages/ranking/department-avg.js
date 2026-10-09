"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useRouter } from "next/router";

export default function DepartmentAverageRanking() {
  const router = useRouter();

  const [period, setPeriod] = useState("today");
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRanking = async () => {
      setLoading(true);

      try {
        // -----------------------------
        // ① 現在のスタッフを取得
        // -----------------------------
        const staffSnapshot = await getDocs(collection(db, "staff"));

        const activeStaff = staffSnapshot.docs
  .map((doc) => doc.data())
  .filter(
    (staff) =>
      staff.isActive !== false &&
      !String(staff.staffId || "").startsWith("test-") &&
      staff.excludeFromDepartmentAverage !== true
  );

        // 部署ごとの現役スタッフ人数
        const staffCounts = {};

        activeStaff.forEach((staff) => {
          const wardId = staff.wardId;

          if (!wardId) return;

          if (!staffCounts[wardId]) {
            staffCounts[wardId] = {
              count: 0,
              name: staff.department || wardId,
              staffIds: new Set(),
            };
          }

          staffCounts[wardId].count += 1;
          staffCounts[wardId].staffIds.add(String(staff.staffId));
        });

        // -----------------------------
        // ② 使用記録を取得
        // -----------------------------
        const recordSnapshot = await getDocs(collection(db, "records"));

        const records = recordSnapshot.docs.map((doc) => doc.data());

        // -----------------------------
        // ③ JSTの今日を取得
        // -----------------------------
        const getJstDateNumber = (date) => {
          const parts = new Intl.DateTimeFormat("ja-JP", {
            timeZone: "Asia/Tokyo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).formatToParts(date);

          const values = {};

          parts.forEach((part) => {
            if (part.type !== "literal") {
              values[part.type] = part.value;
            }
          });

          return Number(
            `${values.year}${values.month}${values.day}`
          );
        };

        const now = new Date();
        const todayNumber = getJstDateNumber(now);

        const currentYear = Math.floor(todayNumber / 10000);
        const currentMonth = Math.floor(todayNumber / 100) % 100;

        // -----------------------------
        // ④ 選択期間の記録だけ抽出
        // -----------------------------
        const filteredRecords = records.filter((record) => {
          if (!record.date?.toDate) return false;

          const recordDateNumber = getJstDateNumber(
            record.date.toDate()
          );

          const recordYear = Math.floor(recordDateNumber / 10000);
          const recordMonth =
            Math.floor(recordDateNumber / 100) % 100;

          if (period === "today") {
            return recordDateNumber === todayNumber;
          }

          if (period === "month") {
            return (
              recordYear === currentYear &&
              recordMonth === currentMonth
            );
          }

          if (period === "year") {
            return recordYear === currentYear;
          }

          // 累計
          return true;
        });

        // -----------------------------
        // ⑤ 部署ごとの使用量を集計
        // -----------------------------
        const departmentTotals = {};

        filteredRecords.forEach((record) => {
          const wardId = record.wardId;

          if (!wardId) return;

          if (!departmentTotals[wardId]) {
            departmentTotals[wardId] = {
              total: 0,
              recordedStaffIds: new Set(),
            };
          }

          departmentTotals[wardId].total +=
            Number(record.ml) || 0;

          if (record.staffId) {
            departmentTotals[wardId].recordedStaffIds.add(
              String(record.staffId)
            );
          }
        });

        // -----------------------------
        // ⑥ 平均使用量を計算
        // 現役スタッフがいる部署は
        // 使用量0でもランキングに表示する
        // -----------------------------
        const rankingList = Object.entries(staffCounts)
          .map(([wardId, staffInfo]) => {
            const recordInfo = departmentTotals[wardId];

            const total = recordInfo?.total || 0;
            const staffCount = staffInfo.count;

            const average =
              staffCount > 0 ? total / staffCount : 0;

            // 今月の記録者数
            // 現役スタッフだけを人数として数える
            let recordedCount = 0;

            if (recordInfo) {
              recordInfo.recordedStaffIds.forEach((staffId) => {
                if (staffInfo.staffIds.has(staffId)) {
                  recordedCount += 1;
                }
              });
            }

            return {
              wardId,
              department: staffInfo.name,
              total: Number(total.toFixed(1)),
              average: Number(average.toFixed(1)),
              staffCount,
              recordedCount,
            };
          })
          .sort((a, b) => b.average - a.average);

        setRanking(rankingList);
      } catch (error) {
        console.error(
          "部署別平均ランキング取得エラー:",
          error
        );
      } finally {
        setLoading(false);
      }
    };

    loadRanking();
  }, [period]);

  const periodLabel = {
    today: "今日",
    month: "今月",
    year: "今年",
    all: "累計",
  };

  return (
    <div
      style={{
        background: "#F9F9F9",
        minHeight: "100vh",
        padding: "20px",
        paddingBottom: "80px",
        fontFamily: "sans-serif",
        maxWidth: "480px",
        margin: "0 auto",
      }}
    >
      <button
        onClick={() => router.push("/ranking")}
        style={{
          background: "#cfeeee",
          color: "#006b5f",
          border: "none",
          padding: "10px 16px",
          borderRadius: "12px",
          fontSize: "16px",
          cursor: "pointer",
          marginBottom: "20px",
          width: "100%",
        }}
      >
        ← ランキングメニューに戻る
      </button>

      <h1
        style={{
          color: "#006b5f",
          marginBottom: "10px",
          textAlign: "center",
          fontSize: "26px",
          fontWeight: "600",
        }}
      >
        ⚖️ 部署別平均ランキング
      </h1>

      <p
        style={{
          textAlign: "center",
          color: "#557c75",
          fontSize: "13px",
          marginBottom: "20px",
        }}
      >
        部署の使用量 ÷ 現在のスタッフ人数
      </p>

      {/* 期間切り替え */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          marginBottom: "24px",
        }}
      >
        {[
          ["today", "今日"],
          ["month", "今月"],
          ["year", "今年"],
          ["all", "累計"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            style={{
              flex: 1,
              padding: "10px 4px",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
              background:
                period === key ? "#008b75" : "#dff5ef",
              color:
                period === key ? "#ffffff" : "#006b5f",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div
          style={{
            textAlign: "center",
            color: "#006b5f",
            padding: "30px",
          }}
        >
          読み込み中...
        </div>
      ) : (
        <>
          <div
            style={{
              textAlign: "center",
              color: "#006b5f",
              fontWeight: "bold",
              marginBottom: "16px",
            }}
          >
            {periodLabel[period]}の平均使用量
          </div>

          {ranking.map((item, index) => (
            <div
              key={item.wardId}
              style={{
                background: "#ffffff",
                borderRadius: "14px",
                padding: "16px",
                marginBottom: "12px",
                border: "1px solid #cfeeee",
                boxShadow:
                  "0 2px 6px rgba(0, 120, 100, 0.08)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <div
  style={{
    width: "60px",
    minWidth: "60px",
    height: "60px",
    borderRadius: "14px",
    background: "#d8f3f3",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "30px",
  }}
>
  {index === 0
    ? "🥇"
    : index === 1
    ? "🥈"
    : index === 2
    ? "🥉"
    : "⚖️"}
</div>

<span
  style={{
    fontSize: "18px",
    fontWeight: "bold",
    color: "#006b5f",
  }}
>
  {index + 1}位 {item.department}
</span>
                  
                </div>

                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: "bold",
                    color: "#008b75",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.average.toFixed(1)} mL/人
                </div>
              </div>

              <div
                style={{
                  marginTop: "10px",
                  fontSize: "13px",
                  color: "#557c75",
                }}
              >
                部署使用量 {item.total.toFixed(1)} mL
                　／　スタッフ {item.staffCount}人
              </div>

              {period === "month" && (
                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "14px",
                    color: "#006b5f",
                    fontWeight: "bold",
                  }}
                >
                  👥 今月の記録者 {item.recordedCount} /{" "}
                  {item.staffCount}人
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}