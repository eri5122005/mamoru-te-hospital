import { eligibleNormalUsage, WEIGHT_REMEASUREMENT_RULES } from './weightRemeasurement.js';
import { normalizeStaffId } from './normalizeStaffId.js';

export const NORMAL_WEIGHT_HISTORY_LIMITS = Object.freeze({ pageSize: 20, maxDocuments: 100, probeSize: 1 });
const FIELDS = Object.freeze(['date', 'unit', 'weightPrev', 'weightNow', 'isBottleExchange', 'ml']);

// Lazy SDK loading does not initialize Firebase. The caller supplies its existing server db.
// Tests inject a read-only page adapter, never load the SDK or connect to Firebase.
async function serverPage({ db, staffId, cursor, pageSize }) {
  const { collection, query, where, orderBy, documentId, limit, startAfter, getDocsFromServer } = await import('firebase/firestore');
  const constraints = [where('staffId', '==', staffId), orderBy(documentId()), limit(pageSize)];
  if (cursor) constraints.push(startAfter(cursor));
  const snapshot = await getDocsFromServer(query(collection(db, 'records'), ...constraints));
  return snapshot.docs;
}

function time(value) {
  try {
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
    if (value && typeof value.toDate === 'function') return time(value.toDate());
    const text = typeof value === 'string' ? value : value?.timestamp;
    if (typeof text !== 'string' || !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text.trim())) return null;
    const t = Date.parse(text);
    return Number.isFinite(t) ? t : null;
  } catch { return null; }
}

/**
 * Server-only call site intended, but NOT integrated into any API yet.
 * Only records for one exact canonical staffId are queried, in stable document ID order.
 * Document IDs have NO chronological meaning; missing dates are read and excluded.
 * Mixed Firestore date types and ISO offsets are not chronological in index order.
 * Therefore finish this bounded per-person query before certifying the latest three.
 * At maxDocuments, a limit(1) existence probe distinguishes exhaustion from overflow.
 * Its document fields are never accessed or analysed (at most 101 documents received).
 * No transaction snapshot guarantee: the future save integration must handle races.
 */
export async function fetchRecentNormalWeightHistory({ db, staffId, evaluatedAt }, readPage = serverPage) {
  if (typeof staffId !== 'string' || !staffId || normalizeStaffId(staffId) !== staffId ||
      staffId.includes('/') || staffId === '.' || staffId === '..') throw new TypeError('Canonical staffId required');
  const cutoff = time(evaluatedAt);
  if (cutoff === null) throw new TypeError('Valid evaluation date required');
  const received = [], seen = new Set();
  let cursor, scanned = 0, pages = 0, exhausted = false, probeDocumentsRead = 0;
  for (; scanned < NORMAL_WEIGHT_HISTORY_LIMITS.maxDocuments;) {
    // Propagate SDK/permission/network failures; never convert failure to insufficient.
    const docs = await readPage({ db, staffId, cursor, pageSize: NORMAL_WEIGHT_HISTORY_LIMITS.pageSize });
    pages++;
    if (!Array.isArray(docs) || docs.length > NORMAL_WEIGHT_HISTORY_LIMITS.pageSize) throw new Error('Invalid history page');
    for (const snapshot of docs) {
      if (typeof snapshot.id !== 'string' || !snapshot.id || seen.has(snapshot.id)) throw new Error('Invalid/repeated history document');
      seen.add(snapshot.id); scanned++;
      // Explicit projection: no data(), spread, staffId, or personal fields copied from documents.
      const record = {};
      for (const field of FIELDS) record[field] = snapshot.get(field);
      received.push({ documentId: snapshot.id, record });
    }
    if (docs.length < NORMAL_WEIGHT_HISTORY_LIMITS.pageSize) { exhausted = true; break; }
    cursor = docs.at(-1);
  }
  if (!exhausted) {
    const probe = await readPage({ db, staffId, cursor, pageSize: NORMAL_WEIGHT_HISTORY_LIMITS.probeSize });
    pages++;
    if (!Array.isArray(probe) || probe.length > NORMAL_WEIGHT_HISTORY_LIMITS.probeSize) throw new Error('Invalid history probe');
    probeDocumentsRead = probe.length;
    if (probe.length) {
      if (typeof probe[0].id !== 'string' || !probe[0].id || seen.has(probe[0].id)) throw new Error('Invalid/repeated history probe document');
      return { status: 'limit_reached', history: null, documentsScanned: scanned, pagesRead: pages, probeDocumentsRead };
    }
    exhausted = true;
  }
  // Only after proven exhaustion: normalize real times, group ties, and select.
  const dated = received.map(r => ({ ...r, time: time(r.record.date) }))
    .filter(r => r.time !== null && r.time < cutoff);
  const counts = new Map();
  for (const r of dated) counts.set(r.time, (counts.get(r.time) || 0) + 1);
  const selected = dated.filter(r => counts.get(r.time) === 1 && eligibleNormalUsage(r.record) !== null)
    .sort((a, b) => b.time - a.time).slice(0, WEIGHT_REMEASUREMENT_RULES.historyCount);
  return { status: selected.length === WEIGHT_REMEASUREMENT_RULES.historyCount ? 'complete' : 'insufficient',
    history: selected.map(r => ({ documentId: r.documentId, date: new Date(r.time).toISOString(),
      unit: r.record.unit, weightPrev: r.record.weightPrev, weightNow: r.record.weightNow,
      isBottleExchange: r.record.isBottleExchange, ml: r.record.ml })), documentsScanned: scanned, pagesRead: pages, probeDocumentsRead };
}
