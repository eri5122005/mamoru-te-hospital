import { db } from "../../firebaseConfig";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  Timestamp,
} from "firebase/firestore";

export default async function handler(req, res) {
  // ==============================
  // 新しい記録を保存
  // ==============================
  if (req.method === "POST") {
    const {
      staffId,
      name,
      department,
      wardId,
      amount,
      unit,
      ml,
      mintPoint,
      weightNow,
      weightPrev,
      isBottleExchange,
    } = req.body;

    const mlNumber = Number(ml);

    // 使用量として保存できない値を防止
    if (!Number.isFinite(mlNumber) || mlNumber < 0) {
      return res.status(400).json({
        error: "使用量の値が正しくありません",
      });
    }

    // 重量が送られてきた場合だけチェックする
    const nowWeight =
      weightNow === undefined || weightNow === null
        ? null
        : Number(weightNow);

    const prevWeight =
      weightPrev === undefined || weightPrev === null
        ? null
        : Number(weightPrev);

    if (
      nowWeight !== null &&
      (!Number.isFinite(nowWeight) ||
        nowWeight <= 45 ||
        nowWeight > 263)
    ) {
      return res.status(400).json({
        error: "今回の重量が正しくありません",
      });
    }

    if (
      prevWeight !== null &&
      (!Number.isFinite(prevWeight) ||
        prevWeight < 45 ||
        prevWeight > 263)
    ) {
      return res.status(400).json({
        error: "前回の重量が正しくありません",
      });
    }

    try {
      const recordData = {
        staffId: staffId ?? "",
        name: name ?? "",
        department: department ?? "",
        wardId: wardId ?? "",
        unit: unit ?? "weight",
        ml: mlNumber,
        mintPoint: Number(mintPoint ?? 0),
        date: Timestamp.now(),
      };

      // 古い形式との互換性のため、
      // amount が正常な数値として送られた場合だけ保存
      if (
        amount !== undefined &&
        amount !== null &&
        amount !== "" &&
        Number.isFinite(Number(amount))
      ) {
        recordData.amount = Number(amount);
      }

      // 重量記録の場合は、計算の根拠も保存する
      if (nowWeight !== null) {
        recordData.weightNow = nowWeight;
      }

      if (prevWeight !== null) {
        recordData.weightPrev = prevWeight;
      }

      if (typeof isBottleExchange === "boolean") {
        recordData.isBottleExchange = isBottleExchange;
      }

      const docRef = await addDoc(
        collection(db, "records"),
        recordData
      );

      return res.status(200).json({
        ok: true,
        recordId: docRef.id,
      });
    } catch (error) {
      console.error("記録保存エラー:", error);

      return res.status(500).json({
        error: "記録の保存に失敗しました",
      });
    }
  }

  // ==============================
  // 全記録を取得
  // ==============================
  if (req.method === "GET" && !req.query.id) {
    try {
      const snapshot = await getDocs(collection(db, "records"));

      const records = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      return res.status(200).json(records);
    } catch (error) {
      console.error("記録一覧取得エラー:", error);

      return res.status(500).json({
        error: "記録の取得に失敗しました",
      });
    }
  }

  // ==============================
  // 1件の記録を取得
  // ==============================
  if (req.method === "GET") {
    try {
      const recordId = req.query.id;

      const snap = await getDoc(
        doc(db, "records", recordId)
      );

      if (!snap.exists()) {
        return res.status(404).json({
          error: "記録が見つかりません",
        });
      }

      return res.status(200).json({
        id: snap.id,
        ...snap.data(),
      });
    } catch (error) {
      console.error("記録取得エラー:", error);

      return res.status(500).json({
        error: "記録の取得に失敗しました",
      });
    }
  }

  // ==============================
  // 記録を修正
  // ==============================
  if (req.method === "PATCH") {
    const { recordId, ml } = req.body;

    const mlNumber = Number(ml);

    if (
      !recordId ||
      !Number.isFinite(mlNumber) ||
      mlNumber < 0
    ) {
      return res.status(400).json({
        error: "修正する値が正しくありません",
      });
    }

    try {
      await updateDoc(doc(db, "records", recordId), {
        ml: mlNumber,
        updatedAt: Timestamp.now(),
      });

      return res.status(200).json({
        ok: true,
      });
    } catch (error) {
      console.error("記録修正エラー:", error);

      return res.status(500).json({
        error: "記録の修正に失敗しました",
      });
    }
  }

  return res.status(405).json({
    error: "Method not allowed",
  });
}