// Internal server receipt helpers only. No SDK, network, secrets or authorization.
// Shared Client SDK access is not privileged: deployed rules must protect receipts.
import { isRecordOperationId } from '../recordOperationId.js';
import { canonicalizeRecordRequest, digestCanonicalRecordRequest, isSameRecordOperation } from './recordRequestDigest.js';
import { calculateWeightUsage } from '../calculateWeightUsage.js';

export function prepareRecordOperation(operationId, body) {
  if (!isRecordOperationId(operationId)) throw new TypeError('INVALID_OPERATION_ID');
  const canonicalRequest = canonicalizeRecordRequest(body);
  return Object.freeze({ operationId, canonicalRequest, requestDigest: digestCanonicalRecordRequest(canonicalRequest) });
}

export function createRecordOperationReceipt(context, { recordId, ml, committedAt }) {
  const { canonicalRequest: request, requestDigest } = context;
  if (typeof recordId !== 'string' || !recordId || recordId.includes('/') || committedAt == null ||
      ml !== calculateWeightUsage(request.previousWeight, request.weightNow, request.isBottleExchange)) {
    throw new TypeError('INVALID_OPERATION_RESULT');
  }
  return {
    schemaVersion: 1, resultVersion: 1, staffId: request.staffId, requestDigest, recordId,
    result: { ok: true, recordId, staffId: request.staffId, lastWeight: request.weightNow, ml },
    committedAt,
  };
}

const receiptKeys = ['schemaVersion', 'resultVersion', 'staffId', 'requestDigest', 'recordId', 'result', 'committedAt'];
const resultKeys = ['ok', 'recordId', 'staffId', 'lastWeight', 'ml'];
const hasExactKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const unavailable = () => ({ status: 503, code: 'OPERATION_RESULT_UNAVAILABLE',
  error: '保存済み操作の情報を安全に確認できません。再登録せず、管理者に確認してください。' });

// Caller must already verify current staff existence/active status. A receipt is not
// authorization. Corrupt/unknown receipts NEVER fall through to a new record save.
export function resolveRecordOperationReceipt(context, receipt) {
  if (!hasExactKeys(receipt, receiptKeys) || receipt.schemaVersion !== 1 || receipt.resultVersion !== 1 ||
      !hasExactKeys(receipt.result, resultKeys) || receipt.committedAt == null ||
      typeof receipt.staffId !== 'string' || typeof receipt.recordId !== 'string' || !receipt.recordId || receipt.recordId.includes('/') ||
      typeof receipt.requestDigest !== 'string' || !/^[0-9a-f]{64}$/.test(receipt.requestDigest) || receipt.requestDigest.length !== 64 ||
      receipt.result.ok !== true || receipt.result.recordId !== receipt.recordId || receipt.result.staffId !== receipt.staffId ||
      !Number.isFinite(receipt.result.lastWeight) || receipt.result.lastWeight <= 45 || receipt.result.lastWeight > 263 ||
      !Number.isFinite(receipt.result.ml) || receipt.result.ml < 0) return unavailable();
  const candidate = { operationId: context.operationId, staffId: context.canonicalRequest.staffId, requestDigest: context.requestDigest };
  const completed = { operationId: context.operationId, staffId: receipt.staffId, requestDigest: receipt.requestDigest };
  if (!isSameRecordOperation(completed, candidate)) return {
    status: 409, code: 'OPERATION_ID_REUSED_WITH_DIFFERENT_REQUEST',
    error: '同じ記録操作IDで異なる内容は保存できません。再登録せず、管理者に確認してください。',
  };
  const request = context.canonicalRequest;
  if (receipt.result.lastWeight !== request.weightNow ||
      receipt.result.ml !== calculateWeightUsage(request.previousWeight, request.weightNow, request.isBottleExchange)) return unavailable();
  // Select fields; never spread arbitrary stored data into an HTTP response.
  return { status: 200, success: { ok: true, recordId: receipt.recordId, staffId: receipt.staffId,
    lastWeight: receipt.result.lastWeight, ml: receipt.result.ml, replayed: true } };
}
