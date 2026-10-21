import { readPendingRecordOperation, clearPendingRecordOperation } from './recordOperationClient.js';

export const RECOVERY_MESSAGES = Object.freeze({
  malformed: '未確認の記録情報を確認できません。管理者に確認してください。',
  mismatch: '未確認の記録操作があります。管理者に確認してください。',
  unknown: '登録結果を確認できません。再登録せず、管理者に確認してください。',
  failed: '登録結果の確認処理に失敗しました。再登録せず、管理者に確認してください。',
  succeeded: '前回の記録は保存済みであることを確認しました。画面を再読み込みして最新情報を確認してください。',
});

// Read-only GET; identifiers are not authentication. Never retry a POST or use
// historical receipt weights as the current staff state. One checker per mount.
export function createPendingRecordRecovery() {
  let lookup = null;
  return async function recover({ storage, staffId, fetchImpl, isCurrent = () => true, timeoutMs = 10000 }) {
    let pending;
    try { pending = readPendingRecordOperation(storage, staffId); }
    catch { return { status: 'malformed', message: RECOVERY_MESSAGES.malformed }; }
    if (!pending) return { status: 'none' };
    if (!staffId || staffId !== pending.staffId) return { status: 'mismatch', message: RECOVERY_MESSAGES.mismatch };
    const key = JSON.stringify(pending);
    if (!lookup || lookup.key !== key) {
      const promise = (async () => {
        const controller = new AbortController();
        let timer;
        try {
          const request = (async () => {
            const query = new URLSearchParams({ operationId: pending.operationId, staffId: pending.staffId });
            const response = await fetchImpl(`/api/records/operation-result?${query}`, { method: 'GET', cache: 'no-store', signal: controller.signal });
            if (!response.ok || response.status !== 200) throw new Error('RESULT_HTTP');
            const body = await response.json();
            if (body?.ok === false && body.status === 'unknown' && Object.keys(body).sort().join(',') === 'message,ok,status' && typeof body.message === 'string') return 'unknown';
            if (!body || Object.keys(body).sort().join(',') !== 'lastWeight,ml,ok,operationId,recordId,staffId,status' ||
                body.ok !== true || body.status !== 'succeeded' || body.operationId !== pending.operationId || body.staffId !== pending.staffId ||
                typeof body.recordId !== 'string' || !body.recordId || body.recordId.includes('/') ||
                !Number.isFinite(body.lastWeight) || body.lastWeight <= 45 || body.lastWeight > 263 || !Number.isFinite(body.ml) || body.ml < 0) throw new Error('RESULT_SCHEMA');
            return 'succeeded';
          })();
          const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('RESULT_TIMEOUT')); }, timeoutMs); });
          return await Promise.race([request, timeout]);
        } catch { return 'failed'; }
        finally { clearTimeout(timer); }
      })();
      lookup = { key, promise };
    }
    const status = await lookup.promise;
    if (!isCurrent()) return { status: 'cancelled' };
    if (status !== 'succeeded') return { status, message: RECOVERY_MESSAGES[status] };
    try {
      // Clear only the exact evidence we queried, never a replacement operation.
      if (JSON.stringify(readPendingRecordOperation(storage, staffId)) !== key) throw new Error('PENDING_CHANGED');
      clearPendingRecordOperation(storage, pending.staffId, pending.operationId);
    } catch { return { status: 'failed', message: RECOVERY_MESSAGES.failed }; }
    return { status: 'succeeded', message: RECOVERY_MESSAGES.succeeded };
  };
}
