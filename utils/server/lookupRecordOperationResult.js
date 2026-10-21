import { isRecordOperationId } from '../recordOperationId.js';
import { normalizeStaffId } from '../normalizeStaffId.js';
import { isActiveStaff } from '../isActiveStaff.js';
import { isValidRecordOperationReceipt } from './recordOperationReceipt.js';

// Server-only server-source reads. No cache fallback, client-page import or writes.
async function readStaff({ db, staffId }) {
  const { doc, getDocFromServer } = await import('firebase/firestore');
  const snapshot = await getDocFromServer(doc(db, 'staff', staffId));
  return snapshot.exists() ? { isActive: snapshot.get('isActive') } : null;
}
async function readReceipt({ db, operationId }) {
  const { doc, getDocFromServer } = await import('firebase/firestore');
  const snapshot = await getDocFromServer(doc(db, 'recordOperations', operationId));
  return snapshot.exists() ? snapshot.data() : null;
}
const unknown = () => ({ status: 200, body: { ok: false, status: 'unknown',
  message: '現時点では保存成功を確認できません。再登録せず、管理者に確認してください。' } });

/** A pair of identifiers is NOT authentication. Do not reveal results to a different
 * staff ID, retired staff or a deleted staff account. Unknown never authorizes saving:
 * the original POST may still be running. Read failures propagate to the HTTP layer.
 */
export async function lookupRecordOperationResult({ db, operationId, staffId }, {
  readStaffStatus = readStaff, readOperationReceipt = readReceipt,
} = {}) {
  const id = typeof staffId === 'string' ? normalizeStaffId(staffId) : '';
  if (!isRecordOperationId(operationId) || !id || id === '.' || id === '..' ||
      /[\/\u0000-\u001f\u007f]/.test(id) || Buffer.byteLength(id, 'utf8') > 1500) {
    return { status: 400, body: { ok: false, code: 'INVALID_OPERATION_QUERY', error: '記録操作IDまたは職員番号が正しくありません。' } };
  }
  const staff = await readStaffStatus({ db, staffId: id });
  if (staff === null) return unknown();
  if (typeof staff !== 'object' || !staff || Array.isArray(staff)) throw new TypeError('INVALID_STAFF_READ_RESULT');
  if (!isActiveStaff(staff)) return unknown();
  const receipt = await readOperationReceipt({ db, operationId });
  if (receipt === null) return unknown();
  // Hide another staff member's existence and result, even if their receipt is damaged.
  if (typeof receipt?.staffId === 'string' && receipt.staffId !== id) return unknown();
  if (!isValidRecordOperationReceipt(receipt)) {
    return { status: 503, body: { ok: false, code: 'OPERATION_RESULT_UNAVAILABLE',
      error: '保存済み操作の情報を安全に確認できません。再登録せず、管理者に確認してください。' } };
  }
  return { status: 200, body: { ok: true, status: 'succeeded', operationId,
    recordId: receipt.result.recordId, staffId: receipt.result.staffId,
    lastWeight: receipt.result.lastWeight, ml: receipt.result.ml } };
}
