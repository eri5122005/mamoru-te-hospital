import { db } from '../../../firebaseConfig';
import { lookupRecordOperationResult } from '../../../utils/server/lookupRecordOperationResult';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  // Deliberately no build gate: this returns historical results only, never grants
  // permission to save. The existing POST /api/records 426 gate is unchanged.
  try {
    const { operationId, staffId } = req.query ?? {};
    const result = await lookupRecordOperationResult({ db, operationId, staffId });
    return res.status(result.status).json(result.body);
  } catch {
    return res.status(500).json({ ok: false, code: 'OPERATION_RESULT_READ_FAILED',
      error: '保存結果を取得できませんでした。再登録せず、管理者に確認してください。' });
  }
}
