import { getAppBuildId } from "../../utils/getAppBuildId";
import { db } from "../../firebaseConfig";
import {
  collection,
  runTransaction,
  doc,
  getDoc,
  getDocs,
  Timestamp,
} from "firebase/firestore";

import { normalizeStaffId } from "../../utils/normalizeStaffId";
import { isActiveStaff } from "../../utils/isActiveStaff";
import { calculateWeightUsage } from "../../utils/calculateWeightUsage";
import { evaluateWeightRemeasurementFlow, checkWeightFlowChallenge } from "../../utils/server/weightRemeasurementFlow";
import { prepareRecordOperation, createRecordOperationReceipt, resolveRecordOperationReceipt } from "../../utils/server/recordOperationReceipt";

// Temporary rollout compatibility. Require IDs here after the record UI migration.
const ALLOW_LEGACY_RECORD_REQUESTS = false;

// Fixed public responses only; never serialize errors, request bodies, or token payloads.
function flowFailure(status) {
  const failures = {
    staff_not_found: [404, undefined, "職員情報が見つかりません。管理者に確認してください。"],
    staff_inactive: [403, undefined, "この職員番号は現在利用できません。管理者に確認してください。"],
    invalid_db_weight: [409, undefined, "前回の重量が正しく設定されていません。管理者に確認してください。"],
    previous_weight_mismatch: [409, undefined, "前回の重量が更新されています。再登録せず、管理者に確認してください。"],
    invalid_request: [400, undefined, "今回または前回の重量や操作が正しくありません。"],
    history_limit_reached: [503, "WEIGHT_HISTORY_LIMIT_REACHED", "過去の記録を安全に確認できません。記録せず、管理者に確認してください。"],
    history_unavailable: [503, "WEIGHT_HISTORY_UNAVAILABLE", "過去の記録を確認できませんでした。記録せず、通信状態を確認してください。"],
    staff_weight_unavailable: [503, "STAFF_WEIGHT_UNAVAILABLE", "最新の職員情報を確認できませんでした。記録せず、通信状態を確認してください。"],
    challenge_unavailable: [503, "WEIGHT_CHALLENGE_UNAVAILABLE", "再測定の確認機能を利用できません。記録せず、管理者に確認してください。"],
    challenge_invalid: [400, "WEIGHT_CHALLENGE_INVALID", "再測定の確認情報が無効です。最初から入力し直してください。"],
    challenge_wrong_stage: [400, "WEIGHT_CHALLENGE_WRONG_STAGE", "再測定の確認手順が変わりました。最初から入力し直してください。"],
    challenge_operation_mismatch: [409, "WEIGHT_CHALLENGE_OPERATION_MISMATCH", "記録操作の確認情報が一致しません。最初から入力し直してください。"],
    challenge_expired: [422, "WEIGHT_CHALLENGE_EXPIRED", "再測定の確認期限が切れました。最初から入力し直してください。"],
    challenge_staff_mismatch: [409, "WEIGHT_CHALLENGE_STAFF_MISMATCH", "職員情報が変わりました。ログインし直してください。"],
    challenge_previous_weight_mismatch: [409, "WEIGHT_CHALLENGE_PREVIOUS_WEIGHT_MISMATCH", "前回の重量が更新されています。再登録せず、管理者に確認してください。"],
    challenge_weight_mismatch: [409, "WEIGHT_CONFIRMATION_CHANGED", "確認した重量が変わりました。もう一度測り直してください。"],
    challenge_app_version_mismatch: [409, "WEIGHT_CHALLENGE_APP_VERSION_MISMATCH", "アプリが更新されました。最新版に更新して入力し直してください。"],
    challenge_rule_version_mismatch: [409, "WEIGHT_CHALLENGE_RULE_VERSION_MISMATCH", "確認条件が更新されました。最初から入力し直してください。"],
  };
  const row = failures[status];
  if (!row) throw new Error("Unexpected weight flow status");
  return { status: row[0], ...(row[1] ? { code: row[1] } : {}), error: row[2] };
}

export default async function handler(req, res) {
  // ==============================
  // 新しい記録を保存
  // ==============================
  if (req.method === "POST") {
    const appBuildId = getAppBuildId();
    if (!appBuildId) {
      return res.status(503).json({ code: "APP_VERSION_UNAVAILABLE", error: "アプリの版を確認できません。" });
    }
    const clientBuildId = req.headers?.["x-app-build-id"];
    if (typeof clientBuildId !== "string" || clientBuildId !== appBuildId) {
      return res.status(426).json({
        code: "APP_UPDATE_REQUIRED",
        error: "アプリが更新されました。最新版を読み込んでください。",
      });
    }
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

    const operation = body.operation === undefined || body.operation === "normal" ? "initial" : body.operation;
    if (!["initial", "remeasure", "confirm_remeasurement"].includes(operation) || body.operation === "initial") {
      return res.status(400).json({ error: "記録操作が正しくありません。" });
    }
    const flowRequest = { db, staffId, requestWeightPrev: prevWeight, weightNow: nowWeight,
      isBottleExchange: exchange, operation, challenge: body.challenge, operationId: body.operationId };
    try {
      let operationContext = null;
      if (body.operationId !== undefined) {
        try { operationContext = prepareRecordOperation(body.operationId, body); }
        catch { return res.status(400).json({ code: "INVALID_OPERATION_REQUEST", error: "記録操作IDまたは記録内容が正しくありません。" }); }
      } else if (!ALLOW_LEGACY_RECORD_REQUESTS) {
        return res.status(400).json({ code: "OPERATION_ID_REQUIRED", error: "記録操作IDが必要です。" });
      }
      const operationRef = operationContext ? doc(db, "recordOperations", operationContext.operationId) : null;
      const readCompletedOperation = () => runTransaction(db, async transaction => {
        const current = await transaction.get(doc(db, "staff", staffId));
        if (!current.exists()) return flowFailure("staff_not_found");
        if (!isActiveStaff(current.data())) return flowFailure("staff_inactive");
        const saved = await transaction.get(operationRef);
        return saved.exists() ? resolveRecordOperationReceipt(operationContext, saved.data()) : null;
      });
      if (operationContext) {
        const completed = await readCompletedOperation();
        if (completed) {
          if (completed.status === 200) return res.status(200).json(completed.success);
          const { status, ...response } = completed; return res.status(status).json(response);
        }
      }
      // Flow owns the save precheck/history reads; receipt lookups independently check
      // current staff status, but never run another history query.
      const decision = await evaluateWeightRemeasurementFlow(flowRequest, { appBuildId });
      if (operationContext && !["save_allowed", "save_allowed_after_confirmation"].includes(decision.status)) {
        // Another request can commit after our initial lookup and before/during precheck.
        // Recheck before returning stale-weight/history/challenge errors or a new 422.
        const completed = await readCompletedOperation();
        if (completed) {
          if (completed.status === 200) return res.status(200).json(completed.success);
          const { status, ...response } = completed; return res.status(status).json(response);
        }
      }
      if (["remeasurement_required", "confirmation_required"].includes(decision.status)) {
        const confirmation = decision.status === "confirmation_required";
        return res.status(422).json({
          code: confirmation ? "WEIGHT_REMEASUREMENT_CONFIRMATION_REQUIRED" : "WEIGHT_REMEASUREMENT_REQUIRED",
          error: confirmation ? "再測定後も通常より多い使用量です" : "通常より使用量が多くなっています。入力間違いの可能性があるため、もう一度ボトルの重量を測定してください。",
          challenge: decision.challenge, previousWeight: decision.previousWeight, weightNow: decision.weightNow,
          currentMl: decision.currentMl, personalMedianMl: decision.personalMedianMl,
          personalRuleEvaluated: decision.personalRuleEvaluated, matchedRules: decision.matchedRules,
        });
      }
      if (!["save_allowed", "save_allowed_after_confirmation"].includes(decision.status)) {
        const { status, ...response } = flowFailure(decision.status);
        return res.status(status).json(response);
      }

      const recordRef = doc(collection(db, "records"));
      const result = await runTransaction(db, async transaction => {
        const staffRef = doc(db, "staff", staffId);
        const staffSnap = await transaction.get(staffRef);
        if (!staffSnap.exists()) return { status: 404, error: "職員情報が見つかりません。管理者に確認してください。" };
        const staff = staffSnap.data();
        if (!isActiveStaff(staff)) return { status: 403, error: "この職員番号は現在利用できません。管理者に確認してください。" };
        if (operationContext) {
          const saved = await transaction.get(operationRef);
          if (saved.exists()) return resolveRecordOperationReceipt(operationContext, saved.data());
        }
        const dbWeight = parseWeight(staff.lastWeight);
        if (!Number.isFinite(dbWeight) || dbWeight < 45 || dbWeight > 263 || dbWeight !== prevWeight) {
          return { status: 409, error: "前回の重量が更新されているか、正しく設定されていません。再登録せず、管理者に確認してください。" };
        }
        if (!Number.isFinite(nowWeight) || nowWeight <= 45 || nowWeight > 263) return flowFailure("invalid_request");
        if (operation !== "initial") {
          // Repeat pure signature/expiry/stage/binding checks on EVERY retry, before any writes.
          const finalCheck = checkWeightFlowChallenge({ ...flowRequest, requestWeightPrev: dbWeight }, { appBuildId });
          if (finalCheck.status !== "valid") return flowFailure(finalCheck.status);
        }
        const backupRef = doc(db, "staffs", staffId);
        const backup = exchange ? await transaction.get(backupRef) : null;
        // Recompute from the verified latest DB weight on every retry. No external
        // history query, HTTP response, or challenge side effect belongs here.
        const ml = calculateWeightUsage(dbWeight, nowWeight, exchange);
        if (ml !== decision.currentMl) return { status: 409, error: "重量の確認結果が変わりました。再登録せず、管理者に確認してください。" };
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
        let receipt = null;
        if (operationContext) {
          recordData.operationId = operationContext.operationId;
          receipt = createRecordOperationReceipt(operationContext, { recordId: recordRef.id, ml, committedAt: recordData.date });
        }
        transaction.set(recordRef, recordData);
        transaction.update(staffRef, { lastWeight: nowWeight });
        if (backup?.exists()) transaction.update(backupRef, { lastWeight: nowWeight });
        if (receipt) transaction.set(operationRef, receipt);
        return receipt ? { status: 200, success: { ...receipt.result, replayed: false } } : { status: 200, ml };
      });
      if (result.status !== 200) {
        const { status, ...response } = result;
        return res.status(status).json(response);
      }
      return res.status(200).json(result.success ?? { ok: true, recordId: recordRef.id, staffId, lastWeight: nowWeight, ml: result.ml });
    } catch (error) {
      console.error("記録保存エラー: WEIGHT_RECORD_SAVE_FAILED");
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
    return res.status(410).json({
      error: "履歴の編集機能は廃止されています。",
    });
  }

  return res.status(405).json({
    error: "Method not allowed",
  });
}
