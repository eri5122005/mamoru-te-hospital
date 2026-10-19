import { useEffect, useState, useSyncExternalStore } from "react";
import { checkAppVersion, monitorAppVersion } from "../utils/checkAppVersion";
import { subscribeAppUpdate, getAppUpdateState, getServerAppUpdateState, requireAppUpdate, reloadUpdatedApp } from "../utils/appUpdateState";

export default function AppUpdateNotice() {
  const [updateError, setUpdateError] = useState("");
  const update = () => {
    try { reloadUpdatedApp(() => window.location.reload()); }
    catch (error) { setUpdateError(error.message || "入力を一時保存できません。更新せず、管理者に確認してください。"); }
  };
  const state = useSyncExternalStore(subscribeAppUpdate, getAppUpdateState, getServerAppUpdateState);
  useEffect(() => monitorAppVersion({
    window, document, check: checkAppVersion,
    onResult: result => { if (result.status === "update-required") requireAppUpdate(); },
  }), []);
  if (!state.required) return null;
  return (
    <aside role="alert" style={{ padding: "16px", marginBottom: "16px", background: "#fff3cd", borderRadius: "12px", color: "#594600" }}>
      <p>{state.hasInput
        ? "アプリが更新されました。入力した重量を確認してから最新版に更新してください。"
        : "アプリが更新されました。最新版に更新してください。"}</p>
      {state.hasInput && <p>有効な入力重量だけを一時保存します。更新後に重量を再確認してください。</p>}
      {state.operations > 0 && <p>処理中です。完了するまで更新せずお待ちください。</p>}
      {updateError && <p role="alert">{updateError}</p>}
      <button type="button" disabled={state.operations > 0 || state.reloading}
        onClick={update}
        style={{ padding: "12px 16px", borderRadius: "8px" }}>最新版へ更新</button>
    </aside>
  );
}
