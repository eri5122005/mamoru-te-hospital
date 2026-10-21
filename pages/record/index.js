"use client";

import { requestStaffWeightSettings } from "../../utils/requestStaffWeightSettings";
import { currentRecordStaffId, loadRecordContext } from "../../utils/loadRecordContext";
import { saveRecordDraft, clearRecordDraft } from "../../utils/recordUpdateDraft";
import { registerUpdatePreparation } from "../../utils/appUpdateState";
import { checkAppVersion } from "../../utils/checkAppVersion";
import { getAppUpdateState, requireAppUpdate, setUpdateInput, beginUpdateOperation } from "../../utils/appUpdateState";
import { idleRemeasurement, acceptRemeasurementResponse, retryRemeasurement, recordFlowRequest, blockConfirmationEnter, createRecordRequestScope } from "../../utils/recordRemeasurementState";
import { subscribeAppUpdate } from "../../utils/appUpdateState";
import { getAppBuildId } from "../../utils/getAppBuildId";
import { createPendingRecordRecovery } from "../../utils/recoverPendingRecordOperation";
import { createRecordOperationLifecycle, ensureNoPendingRecordOperation, savePendingRecordOperation, clearPendingRecordOperation, isKnownRecordFailure, isValidRecordSuccess, RECORD_RESULT_UNKNOWN_MESSAGE } from "../../utils/recordOperationClient";

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
const [ready, setReady] = useState(false);
const readyRef = useRef(false);
const currentIdRef = useRef("");
const saveUncertainRef = useRef(false);
const cleanupFailedRef = useRef(false);
const operationLifecycleRef = useRef(createRecordOperationLifecycle());
const pendingRecoveryRef = useRef(createPendingRecordRecovery());
const [draftNotice, setDraftNotice] = useState("");

const [showExchangeConfirm, setShowExchangeConfirm] = useState(false);
const [remeasurementFlow, setRemeasurementFlow] = useState(idleRemeasurement);
const remeasurementRef = useRef(idleRemeasurement());
const requestScopeRef = useRef(createRecordRequestScope());
const changeRemeasurement = next => { remeasurementRef.current = next; setRemeasurementFlow(next); };
const resetRemeasurement = () => changeRemeasurement(idleRemeasurement());
useEffect(() => {
  requestScopeRef.current.activate();
  const leave = url => {
    // Re-selecting the current navbar tab is not a logout or a new staff context.
    if (typeof url === "string" && url.split(/[?#]/)[0].replace(/\/$/, "") === router.pathname) return;
    requestScopeRef.current.invalidate(); resetRemeasurement(); readyRef.current = false; setReady(false);
    setMessage("画面を切り替えています。続ける場合はログインし直してください。");
  };
  router.events.on("routeChangeStart", leave);
  const stop = subscribeAppUpdate(() => { if (getAppUpdateState().required) resetRemeasurement(); });
  return () => { router.events.off("routeChangeStart", leave); stop(); requestScopeRef.current.dispose(); remeasurementRef.current = idleRemeasurement(); };
}, []);

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
  let cancelled = false;
  const controller = new AbortController();
  const endOperation = beginUpdateOperation();
  const timer = setTimeout(() => controller.abort(), 10000);
  const load = async () => {
    try {
      const recoveryStaffId = currentRecordStaffId(localStorage);
      const recovery = await pendingRecoveryRef.current({
        storage: sessionStorage, staffId: recoveryStaffId, fetchImpl: fetch,
        isCurrent: () => !cancelled && currentRecordStaffId(localStorage) === recoveryStaffId,
      });
      if (cancelled) return;
      if (recovery.status !== "none") {
        // Even a confirmed historical receipt is not current staff state. Stop this
        // mount; a deliberate reload must pass the normal latest-staff initialization.
        operationLifecycleRef.current.block(); saveUncertainRef.current = true;
        setMessage(recovery.message || "職員情報が変わりました。再登録せず、管理者に確認してください。");
        return;
      }
      const result = await loadRecordContext({
        readCurrentId: () => currentRecordStaffId(localStorage),
        storage: sessionStorage,
        isCurrent: () => !cancelled,
        checkVersion: checkAppVersion,
        fetchStaff: id => requestStaffWeightSettings(`/api/staff/first-weight?staffId=${encodeURIComponent(id)}`, { cache: "no-store", signal: controller.signal }),
      });
      if (cancelled) return;
      try { ensureNoPendingRecordOperation(sessionStorage, result.staff.staffId); }
      catch (error) { operationLifecycleRef.current.block(); saveUncertainRef.current = true; throw error; }
      if (currentRecordStaffId(localStorage) !== result.staff.staffId) throw new Error("職員情報が変わりました。ログインし直してください。");
      currentIdRef.current = result.staff.staffId;
      setStaff(result.staff);
      setWeightNow(result.weightNow);
      if (result.weightNow) setDraftNotice("更新前に入力していた重量を復元しました。現在の重量と合っていることを確認してから記録してください。");
      readyRef.current = true;
      setReady(true);
    } catch (error) {
      if (!cancelled) {
        if (error.updateRequired) requireAppUpdate();
        setMessage(error.message || "最新情報を取得できませんでした。記録せず、管理者に確認してください。");
      }
    } finally { clearTimeout(timer); endOperation(); }
  };
  void load();
  return () => { cancelled = true; controller.abort(); clearTimeout(timer); endOperation(); readyRef.current = false; };
}, []);

  useEffect(() => registerUpdatePreparation(() => {
    if (saveUncertainRef.current || cleanupFailedRef.current) {
      throw new Error("保存結果または一時入力の削除を確認できません。再登録・更新せず、管理者に確認してください。");
    }
    if (!readyRef.current) return;
    if (currentRecordStaffId(localStorage) !== currentIdRef.current) {
      throw new Error("ログイン中の職員が変わりました。ログインし直してください。");
    }
    try { saveRecordDraft(sessionStorage, currentIdRef.current, weightNow); }
    catch { throw new Error("入力を一時保存できません。更新せず、重量を控えて管理者に確認してください。"); }
  }), [weightNow]);

  useEffect(() => {
    const changed = () => {
      try { if (currentIdRef.current && currentRecordStaffId(localStorage) !== currentIdRef.current) {
        requestScopeRef.current.invalidate(); resetRemeasurement();
        readyRef.current = false; setReady(false);
        try { clearRecordDraft(sessionStorage); } catch { /* Remain blocked. */ }
        setMessage("ログイン中の職員が変わりました。ログインし直してください。");
      } } catch { requestScopeRef.current.invalidate(); resetRemeasurement(); readyRef.current = false; setReady(false); }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);

  useEffect(() => {
    setUpdateInput(weightNow !== "");
    return () => setUpdateInput(false);
  }, [weightNow]);

  const ensureCurrentVersion = async () => {
    if (!readyRef.current || currentRecordStaffId(localStorage) !== currentIdRef.current) {
      requestScopeRef.current.invalidate(); resetRemeasurement();
      readyRef.current = false; setReady(false);
      setMessage("最新の職員情報を確認できません。ログインし直してください。");
      return false;
    }
    if (getAppUpdateState().required) return false;
    const result = await checkAppVersion();
    if (!readyRef.current || currentRecordStaffId(localStorage) !== currentIdRef.current) {
      requestScopeRef.current.invalidate(); resetRemeasurement();
      readyRef.current = false; setReady(false);
      setMessage("ログイン中の職員が変わりました。ログインし直してください。");
      return false;
    }
    if (result.status === "update-required") requireAppUpdate();
    if (getAppUpdateState().required) return false;
    if (result.status !== "current") {
      setMessageType("normal");
      setMessage("最新版を確認できませんでした。通信状態を確認して、もう一度お試しください。");
      return false;
    }
    return true;
  };

  // ★ 記録保存共通処理
  const saveRecord = async (
  usedMl,
  nowWeightValue,
  isBottleExchange = false
) => {
    const endOperation = beginUpdateOperation();
    try {
    if (!await ensureCurrentVersion() || getAppUpdateState().required) return false;
    let operationId;
    try {
      if (remeasurementRef.current.phase !== "idle" && !operationLifecycleRef.current.current()) throw new Error("Missing operation");
      operationId = operationLifecycleRef.current.begin(staff.staffId);
    } catch {
      readyRef.current = false; setReady(false);
      setMessage("記録操作を開始できません。記録は送信していません。管理者に確認してください。");
      return false;
    }
    let savedRecord;
    const sentFlow = remeasurementRef.current;
    const outgoing = recordFlowRequest(sentFlow, nowWeightValue, isBottleExchange);
    const ticket = requestScopeRef.current.begin(staff.staffId);
    const responseIsCurrent = () => { try { return requestScopeRef.current.valid(ticket, currentRecordStaffId(localStorage)); } catch { return false; } };
    const stopUnknown = () => {
      resetRemeasurement(); operationLifecycleRef.current.block();
      saveUncertainRef.current = true; readyRef.current = false; setReady(false);
      try { clearRecordDraft(sessionStorage, staff.staffId); } catch { /* Never erase pending or resend. */ }
      setMessage(RECORD_RESULT_UNKNOWN_MESSAGE);
    };
    try {
      const now = new Date();
      const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const postBody = JSON.stringify({
        ...outgoing, operationId,
        staffId: staff.staffId, name: staff.name,
        department: wardNameMap[staff.wardId] || staff.department, wardId: staff.wardId,
        ml: usedMl, unit: "weight", mintPoint: 1,
        weightNow: nowWeightValue, weightPrev: staff.lastWeight, isBottleExchange,
        date: Timestamp.fromDate(jstNow),
      });
      try { savePendingRecordOperation(sessionStorage, staff.staffId, operationId); }
      catch {
        operationLifecycleRef.current.block(); cleanupFailedRef.current = true;
        readyRef.current = false; setReady(false);
        setMessage("操作情報を安全に保持できません。記録は送信していません。管理者に確認してください。");
        return false;
      }
      operationLifecycleRef.current.markSent(staff.staffId, operationId);
      const response = await fetch("/api/records", {
        method: "POST", headers: { "Content-Type": "application/json", "X-App-Build-Id": getAppBuildId() || "" }, body: postBody,
      });
      if (!responseIsCurrent()) return false; // Keep pending for a later recovery step.
      const body = await response.json(); // Invalid JSON is an UNKNOWN result, including error responses.
      if (!responseIsCurrent()) return false;
      if (!response.ok) {
        if (!body || typeof body !== "object" || Array.isArray(body) ||
            (body.ok !== undefined && body.ok !== false) || body.status !== undefined ||
            body.recordId !== undefined || body.lastWeight !== undefined || body.ml !== undefined || body.replayed !== undefined) throw new Error("Contradictory error response");
        if (response.status === 422) {
          const next = acceptRemeasurementResponse(sentFlow, body, outgoing.operation);
          if (next) {
            if (next.display.weightNow !== nowWeightValue || next.display.previousWeight !== Number(staff.lastWeight)) throw new Error("Mismatched remeasurement response");
            clearPendingRecordOperation(sessionStorage, staff.staffId, operationId);
            if (getAppUpdateState().required) { resetRemeasurement(); return false; }
            clearMessageTimer(); setMessage(""); setMessageType("normal"); setShowExchangeConfirm(false);
            changeRemeasurement(next);
            if (next.phase === "remeasure_required") setWeightNow("");
            return false;
          }
        }
        if (!isKnownRecordFailure(response.status, body)) throw new Error("Unconfirmed save outcome");
        clearPendingRecordOperation(sessionStorage, staff.staffId, operationId);
        if (response.status === 426 && body.code === "APP_UPDATE_REQUIRED") {
          resetRemeasurement(); requireAppUpdate(); return false;
        }
        if (typeof body.code === "string" && body.code.startsWith("WEIGHT_CHALLENGE_")) {
          resetRemeasurement();
          if (body.code === "WEIGHT_CHALLENGE_APP_VERSION_MISMATCH") requireAppUpdate();
        }
        if (body.code === "WEIGHT_CONFIRMATION_CHANGED") changeRemeasurement(retryRemeasurement(remeasurementRef.current));
        if ([403, 404, 409].includes(response.status) && body.code !== "WEIGHT_CONFIRMATION_CHANGED" &&
            !["WEIGHT_CHALLENGE_APP_VERSION_MISMATCH", "WEIGHT_CHALLENGE_RULE_VERSION_MISMATCH"].includes(body.code)) {
          resetRemeasurement(); operationLifecycleRef.current.block(); readyRef.current = false; setReady(false);
        }
        if (response.status >= 500) {
          resetRemeasurement(); operationLifecycleRef.current.block(); readyRef.current = false; setReady(false);
          try { clearRecordDraft(sessionStorage, staff.staffId); } catch { /* No automatic retry. */ }
        }
        setMessage(`記録を保存できませんでした。\n詳細：${body.error}`);
        return false;
      }
      if (!isValidRecordSuccess(response.status, body, staff.staffId, nowWeightValue)) throw new Error("Invalid save response");
      savedRecord = body;
    } catch {
      if (!responseIsCurrent()) return false;
      stopUnknown(); return false;
    }

    resetRemeasurement();
    try {
      clearPendingRecordOperation(sessionStorage, staff.staffId, operationId);
      operationLifecycleRef.current.complete(staff.staffId, operationId);
    } catch {
      operationLifecycleRef.current.block(); cleanupFailedRef.current = true; readyRef.current = false; setReady(false);
      setMessage("記録は保存されましたが、操作情報の削除を確認できません。再登録せず、管理者に確認してください。");
      return true;
    }
    // A confirmed POST remains successful even if draft cleanup fails.
    try { clearRecordDraft(sessionStorage, savedRecord.staffId); }
    catch {
      cleanupFailedRef.current = true; readyRef.current = false; setReady(false);
      setDraftNotice("記録は保存されましたが、一時入力を削除できませんでした。再登録せず、管理者に確認してください。");
    }
    if (savedRecord.replayed) {
      // This is a historical acknowledgement, NOT the latest DB lastWeight. Do not
      // roll back local staff, append history or play a second success animation.
      readyRef.current = false; setReady(false); setWeightNow("");
      setMessage("この操作は既に記録されています。再登録せず、ログインし直して最新情報を確認してください。");
      return true;
    }
    try {
    if (currentRecordStaffId(localStorage) !== savedRecord.staffId) {
      readyRef.current = false; setReady(false); setWeightNow("");
      setMessage("記録は保存されました。ログイン中の職員が変わったため、ログインし直してください。");
      return true;
    }
    const updated = { ...staff, staffId: savedRecord.staffId, lastWeight: savedRecord.lastWeight };
    setStaff(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("currentStaff", JSON.stringify(updated));
      localStorage.setItem(`staff-${savedRecord.staffId}`, JSON.stringify(updated));
      const history = JSON.parse(localStorage.getItem("history") || "[]");
      const now = new Date();
      const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      if (!history.some(item => item?.recordId === savedRecord.recordId)) history.push({
        recordId: savedRecord.recordId,
        staffId: savedRecord.staffId, name: staff.name,
        department: wardNameMap[staff.wardId] || staff.department, wardId: staff.wardId,
        ml: savedRecord.ml, unit: "weight", weightNow: nowWeightValue,
        weightPrev: staff.lastWeight, isBottleExchange, date: jstNow,
      });
      localStorage.setItem("history", JSON.stringify(history));
    }
    } catch {
      readyRef.current = false; setReady(false);
      cleanupFailedRef.current = true;
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
    } finally { endOperation(); }
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
  if (!isSubmitting || !readyRef.current || remeasurementRef.current.phase !== "idle") return;

  // ★ awaitより前にロックする
  exchangeLockRef.current = true;
  setIsExchangeProcessing(true);
  const endOperation = beginUpdateOperation();

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
    endOperation();
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
  if (!staff || !readyRef.current) return;
  if (remeasurementRef.current.phase === "confirmation_required") return;

  // ★ 連打防止（2回目を絶対に走らせない）
  if (recordLockRef.current || isSubmitting) return;
  recordLockRef.current = true;
  setIsSubmitting(true);
  let awaitingExchangeConfirmation = false;
  const endOperation = beginUpdateOperation();

  try {
  clearMessageTimer();
  if (!await ensureCurrentVersion()) return;
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
  const ok = remeasurementRef.current.phase !== "idle" || confirm(`${weightNow} g で登録してよろしいですか？`);
  if (!ok) {
    setIsSubmitting(false);
    return;
  }

  try {
    if (remeasurementRef.current.phase !== "idle" && !operationLifecycleRef.current.current()) throw new Error("Missing operation");
    operationLifecycleRef.current.begin(staff.staffId);
  } catch {
    readyRef.current = false; setReady(false);
    setMessage("記録操作を開始できません。記録は送信していません。管理者に確認してください。");
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
  if (remeasurementRef.current.phase !== "idle") {
    setMessage("重さが増えています。再測定中は交換扱いにできません。測り直すか、再測定を終了して通常入力から確認してください。");
    return;
  }
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
    endOperation();
    if (!awaitingExchangeConfirmation) {
      setIsSubmitting(false);
      recordLockRef.current = false;
    }
  }
  };

const handleRemeasureAgain = () => {
  if (recordLockRef.current || isSubmitting || !readyRef.current) return;
  changeRemeasurement(retryRemeasurement(remeasurementRef.current)); setWeightNow(""); setMessage("");
};
const handleRemeasureCancel = () => {
  if (recordLockRef.current || isSubmitting) return;
  resetRemeasurement(); setMessage("再測定を終了しました。重量を確認して通常入力からやり直してください。");
};
const handleRemeasureConfirm = async () => {
  if (!staff || !readyRef.current || recordLockRef.current || isSubmitting || remeasurementRef.current.phase !== "confirmation_required") return;
  if (Number(weightNow) !== remeasurementRef.current.display?.weightNow) { handleRemeasureAgain(); return; }
  recordLockRef.current = true; setIsSubmitting(true);
  const endOperation = beginUpdateOperation();
  try { clearMessageTimer(); await saveRecord(0, Number(weightNow), false); }
  finally { recordLockRef.current = false; setIsSubmitting(false); endOperation(); }
};



  if (!staff) {
    return (
      <div>
        <p role="alert">{message || "最新の職員情報を確認しています…"}</p>
        {message && <button type="button" onClick={() => router.push("/login")}>ログイン画面へ戻る</button>}
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#F9F9F9",
        minHeight: "100vh",
        padding: "16px",
        // Fixed bottom navigation must not cover the final record controls.
        paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
        fontFamily: "sans-serif",
        maxWidth: "480px",
        margin: "0 auto",
      }}
    >
      <main>
        <h1 style={{ color: "#006b5f", marginBottom: "10px" }}>今日の記録</h1>
        {draftNotice && <p role="status">{draftNotice}</p>}
        {remeasurementFlow.phase !== "idle" && (
          <section role="alert" aria-live="polite" style={{ background: "#fff6df", border: "1px solid #e5c77e", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
            {remeasurementFlow.phase === "remeasure_required" ? <>
              <strong>通常より使用量が多くなっています。</strong>
              <p>入力間違いの可能性があるため、もう一度ボトルの重量を測定してください。</p>
              <p>最初に入力した重量：{remeasurementFlow.initialWeightNow}g</p>
              <p>下の入力欄へ、測り直した重量を入力してください。</p>
            </> : <>
              <strong>再測定後も通常より多い使用量です</strong>
              <p>前回重量：{remeasurementFlow.display.previousWeight}g<br />今回重量：{remeasurementFlow.display.weightNow}g<br />使用量：約{remeasurementFlow.display.currentMl}mL</p>
              <p>{remeasurementFlow.display.personalRuleEvaluated ? `最近の使用量中央値：約${remeasurementFlow.display.personalMedianMl}mL` : "個人基準は未評価"}</p>
              <button type="button" disabled={isSubmitting || !ready} onClick={handleRemeasureAgain} style={{ width: "100%", padding: "14px", background: "#cfeeee", border: "1px solid #2AAE9E", borderRadius: "10px", marginBottom: "12px" }}>測り直す</button>
              <button type="button" disabled={isSubmitting || !ready} onKeyDown={blockConfirmationEnter} onClick={handleRemeasureConfirm} style={{ width: "100%", padding: "14px", background: "white", border: "1px solid #9b8759", borderRadius: "10px" }}>再測定しました。この値で登録します</button>
            </>}
            <button type="button" disabled={isSubmitting} onClick={handleRemeasureCancel} style={{ marginTop: "12px", padding: "10px", background: "transparent", border: "none", textDecoration: "underline" }}>再測定を終了して通常入力へ戻る</button>
          </section>
        )}

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
  disabled={isExchangeProcessing || !ready}
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
  disabled={isExchangeProcessing || !ready}
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
  disabled={isSubmitting || !ready}
  value={weightNow}
  onChange={(e) => {
    if (recordLockRef.current || isSubmitting) return;
    const v = e.target.value;

    // ★ 全角 → 半角に強制変換（ここが最重要）
    const half = v.replace(/[０-９]/g, s =>
      String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
    );

    if (remeasurementRef.current.phase === "confirmation_required") changeRemeasurement(retryRemeasurement(remeasurementRef.current));
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

        {!ready && <button type="button" onClick={() => router.push("/login")} style={{ padding: "12px", marginBottom: "12px" }}>ログイン画面へ戻る</button>}
        <button
  type="button"
  onClick={handleRecord}
  disabled={isSubmitting || !ready || remeasurementFlow.phase === "confirmation_required"}
  style={{
    width: "100%",
    padding: "16px",
    background: "#cfeeee",
    border: "none",
    borderRadius: "12px",
    fontSize: "20px",
    color: "#006b5f",
    cursor: isSubmitting || !ready || remeasurementFlow.phase === "confirmation_required" ? "not-allowed" : "pointer",
    opacity: isSubmitting || !ready || remeasurementFlow.phase === "confirmation_required" ? 0.6 : 1,
  }}
>
  {remeasurementFlow.phase === "remeasure_required" ? "再測定した重量で記録する" : "＋ 記録する"}
</button>


        <NavBar />
      </main>
    </div>
  );
}
