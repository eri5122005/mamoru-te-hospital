// Local identity cleanup only, not server authentication or pending resolution.
// Attempt both keys even if one storage operation fails; never clear all storage.
export function clearLoginIdentity(storage) {
  let failed = false;
  for (const key of ['currentStaff', 'loginUser']) {
    try {
      storage.removeItem(key);
      if (storage.getItem(key) !== null) failed = true;
    } catch { failed = true; }
  }
  if (failed) throw new Error('前のログイン情報を消去できません。記録せず、管理者に確認してください。');
}
