import { getAppBuildId } from "./getAppBuildId";

export async function checkAppVersion({ fetcher = fetch, timeoutMs = 8000 } = {}) {
  const ownId = getAppBuildId();
  if (!ownId) return { status: "unavailable", reason: "client-id" };
  const controller = new AbortController();
  let timer;
  try {
    const request = async () => {
      const response = await fetcher("/api/app-version", { cache: "no-store", signal: controller.signal });
      if (!response.ok) return { status: "unavailable", reason: response.status === 503 ? "server-unavailable" : "http" };
      let body;
      try { body = await response.json(); }
      catch (error) {
        if (controller.signal.aborted) throw error;
        return { status: "unavailable", reason: "invalid-json" };
      }
      if (body?.appBuildId === undefined) return { status: "unavailable", reason: "missing-id" };
      if (typeof body?.appBuildId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(body.appBuildId)) {
        return { status: "unavailable", reason: "invalid-id" };
      }
      return { status: body.appBuildId === ownId ? "current" : "update-required" };
    };
    return await Promise.race([
      request(),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("timeout")); }, timeoutMs); }),
    ]);
  } catch {
    return { status: "unavailable", reason: controller.signal.aborted ? "timeout" : "network" };
  } finally { clearTimeout(timer); }
}

// Background events share only their in-flight check; saves always call a fresh check.
export function monitorAppVersion({ window: win, document: doc, check, onResult, intervalMs = 300000 }) {
  let pending = false, stopped = false;
  const run = async () => {
    if (pending || stopped) return;
    pending = true;
    try { const result = await check(); if (!stopped) onResult(result); }
    finally { pending = false; }
  };
  const visible = () => { if (doc.visibilityState === "visible") void run(); };
  win.addEventListener("pageshow", run);
  win.addEventListener("online", run);
  doc.addEventListener("visibilitychange", visible);
  const timer = win.setInterval(visible, intervalMs);
  void run();
  return () => {
    stopped = true; win.clearInterval(timer);
    win.removeEventListener("pageshow", run); win.removeEventListener("online", run);
    doc.removeEventListener("visibilitychange", visible);
  };
}
