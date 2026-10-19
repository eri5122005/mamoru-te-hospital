import { useEffect, useSyncExternalStore } from "react";
import { checkAppVersion, monitorAppVersion } from "../utils/checkAppVersion";
import { subscribeAppUpdate, getAppUpdateState, getServerAppUpdateState, requireAppUpdate, reloadUpdatedApp } from "../utils/appUpdateState";

export default function AppUpdateNotice() {
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
      {state.hasInput && <p>更新すると入力は消えます。重量を控えてから更新してください。</p>}
      {state.operations > 0 && <p>処理中です。完了するまで更新せずお待ちください。</p>}
      <button type="button" disabled={state.operations > 0}
        onClick={() => reloadUpdatedApp(() => window.location.reload())}
        style={{ padding: "12px 16px", borderRadius: "8px" }}>最新版へ更新</button>
    </aside>
  );
}
