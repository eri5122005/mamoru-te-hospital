// An unsuccessful or unreadable response must never trigger local success handling.
export async function requestStaffWeightSettings(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error("通信結果を確認できませんでした。再登録せず、管理者に確認してください。");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : "保存結果を確認できませんでした。再登録せず、管理者に確認してください。");
  if (body?.ok !== true || typeof body.staff?.staffId !== "string" ||
      (options?.method === "POST" && !["cm", "weight"].includes(body.staff.mode))) {
    throw new Error("保存結果を確認できませんでした。再登録せず、管理者に確認してください。");
  }
  if (options?.method === "POST" && body.staff.mode === "weight" &&
      (!Number.isFinite(body.staff.lastWeight) || body.staff.emptyWeight !== 46)) {
    throw new Error("保存結果を確認できませんでした。再登録せず、管理者に確認してください。");
  }
  return body.staff;
}
