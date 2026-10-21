// An opaque operation identifier, not authentication or a measurement identifier.
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isRecordOperationId(value) {
  return typeof value === 'string' && value.length === 36 && UUID_V4.test(value);
}

// Dependency injection permits offline tests. Never fall back to time or Math.random.
export function generateRecordOperationId(cryptoSource = globalThis.crypto) {
  if (typeof cryptoSource?.randomUUID !== 'function') throw new Error('OPERATION_ID_UNAVAILABLE');
  let id;
  try { id = cryptoSource.randomUUID(); }
  catch { throw new Error('OPERATION_ID_UNAVAILABLE'); }
  if (!isRecordOperationId(id)) throw new Error('OPERATION_ID_UNAVAILABLE');
  return id;
}
