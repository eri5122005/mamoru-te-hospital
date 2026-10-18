import { db } from "../../firebaseConfig";
import {
  collection,
  runTransaction,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  Timestamp,
} from "firebase/firestore";

import { normalizeStaffId } from "../../utils/normalizeStaffId";
import { isActiveStaff } from "../../utils/isActiveStaff";
import { calculateWeightUsage } from "../../utils/calculateWeightUsage";

export default async function handler(req, res) {
  // ==============================
  // 新しい記録を保存
  // ==============================
  if (req.method === "POST") {
    const body = req.body ?? {};
    if (typeof body.staffId !== "string") {
      return res.status(400).json({ error: "職員番号が正しくありません" });
    }
    const staffId = normalizeStaffId(body.staffId);
    if (!staffId || staffId.includes("/") || staffId === "." || staffId === "..") {
      return res.status(400).json({ error: "職員番号が正しくありません" });
    }
    const parseWeight = value =>
      (typeof value === "number" || (typeof value === "string" && value.trim()))
        ? Number(value) : NaN;
    const nowWeight = parseWeight(body.weightNow);
    const prevWeight = parseWeight(body.weightPrev);
    const exchange = body.isBottleExchange ?? false;
    if (!Number.isFinite(nowWeight) || nowWeight <= 45 || nowWeight > 263 ||
        !Number.isFinite(prevWeight) || prevWeight < 45 || prevWeight > 263 ||
        typeof exchange !== "boolean") {
      return res.status(400).json({ error: "今回または前回の重量が正しくありません。管理者に確認してください。" });
    }

    try {
      const recordRef = doc(collection(db, "records"));
      const result = await runTransaction(db, async transaction => {
        const staffRef = doc(db, "staff", staffId);
        const staffSnap = await transaction.get(staffRef);
        if (!staffSnap.exists()) return { status: 404, error: "職員情報が見つかりません。管理者に確認してください。" };
        const staff = staffSnap.data();
        if (!isActiveStaff(staff)) return { status: 403, error: "この職員番号は現在利用できません。管理者に確認してください。" };
        const dbWeight = parseWeight(staff.lastWeight);
        if (!Number.isFinite(dbWeight) || dbWeight < 45 || dbWeight > 263 || dbWeight !== prevWeight) {
          return { status: 409, error: "前回の重量が更新されているか、正しく設定されていません。再登録せず、管理者に確認してください。" };
        }
        const backupRef = doc(db, "staffs", staffId);
        const backup = exchange ? await transaction.get(backupRef) : null;
        const ml = calculateWeightUsage(prevWeight, nowWeight, exchange);
        const recordData = {
          staffId,
          name: body.name ?? "",
          department: body.department ?? "",
          wardId: body.wardId ?? "",
          unit: body.unit ?? "weight",
          ml,
          mintPoint: Number(body.mintPoint ?? 0),
          date: Timestamp.now(),
          weightNow: nowWeight,
          weightPrev: prevWeight,
          isBottleExchange: exchange,
        };
        if (body.amount !== undefined && body.amount !== null && body.amount !== "" && Number.isFinite(Number(body.amount))) {
          recordData.amount = Number(body.amount);
        }
        transaction.set(recordRef, recordData);
        transaction.update(staffRef, { lastWeight: nowWeight });
        if (backup?.exists()) transaction.update(backupRef, { lastWeight: nowWeight });
        return { status: 200, ml };
      });
      if (result.status !== 200) return res.status(result.status).json({ error: result.error });
      return res.status(200).json({ ok: true, recordId: recordRef.id, staffId, lastWeight: nowWeight, ml: result.ml });
    } catch (error) {
      console.error("記録保存エラー:", error);
      return res.status(500).json({ error: "記録の保存結果を確認できませんでした。再登録せず、管理者に確認してください。" });
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