/**
 * READ-ONLY records audit. DO NOT RUN WITHOUT SEPARATE APPROVAL.
 * Node >= 22.7. Future use: explicit --confirm-records-read-only is required.
 * Reads the existing repository .env.local (never creates/changes it), falling
 * back to existing process environment. Configuration values are never logged.
 * Only the records collection is read, subject to production Security Rules.
 * The Client SDK receives full documents; only the allowlisted fields below
 * are accessed. Other fields are neither inspected nor retained in our results.
 * SDK read RPCs may use POST internally; that does not make them data writes.
 * Read billing applies. Paging is not a single fixed-time snapshot.
 * Result files contain IDs: keep locally, restrict access and delete after review.
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, documentId, limit, startAfter, getDocsFromServer, terminate } from 'firebase/firestore';
import { mkdtemp, writeFile, realpath, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { calculateWeightUsage } from '../utils/calculateWeightUsage.js';

const FIELDS = Object.freeze(['date', 'staffId', 'wardId', 'unit', 'weightPrev', 'weightNow', 'isBottleExchange', 'ml']);
const PAGE_SIZE = 500;
const PERCENTILE_METHOD = 'nearest-rank: sort ascending; percentile p = value at ceil(p * N), 1-based (no interpolation)';
const THRESHOLDS = Object.freeze([50, 60, 70, 80, 100]); // Reporting cutoffs, NOT validation thresholds.
const readLog = [];
let documentsRead = 0;
const startedAt = new Date().toISOString();
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function confirmReadOnly() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0] !== '--confirm-records-read-only') {
    throw new Error('Explicit read-only confirmation is required; no Firebase initialization performed.');
  }
}
async function loadFirebaseConfig() {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  let fileEnv = {};
  try { fileEnv = parseEnv(await readFile(join(root, '.env.local'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('Unable to read environment settings.'); }
  const keys = {
    apiKey: 'NEXT_PUBLIC_FIREBASE_API_KEY', authDomain: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    projectId: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', storageBucket: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    messagingSenderId: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', appId: 'NEXT_PUBLIC_FIREBASE_APP_ID',
  };
  const missing = Object.values(keys).filter(key => typeof (process.env[key] ?? fileEnv[key]) !== 'string' || !(process.env[key] ?? fileEnv[key]).trim());
  if (missing.length) {
    console.error('Missing Firebase environment variable names:', missing.join(', '));
    throw new Error('Required Firebase settings are missing.');
  }
  const config = Object.fromEntries(Object.entries(keys).map(([key, envKey]) => [key, (process.env[envKey] ?? fileEnv[envKey]).trim()]));
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(config.projectId)) throw new Error('Invalid project setting; value not logged.');
  return config;
}
// Keep only known scalar/timestamp values; do not traverse arbitrary map contents.
function scalar(value) {
  if (value === null || value === undefined || ['number', 'string', 'boolean'].includes(typeof value)) return value;
  if (Array.isArray(value)) return { invalidType: 'array' };
  if (value instanceof Date || typeof value?.toDate === 'function') {
    try {
      const date = value instanceof Date ? value : value.toDate();
      if (Number.isFinite(date.getTime())) return { timestamp: date.toISOString() };
    } catch { /* Classified as an invalid object below. */ }
  }
  return { invalidType: typeof value === 'object' ? 'map' : 'other' };
}
function numeric(value) {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) return { status: 'missing' };
  if (typeof value !== 'number' && typeof value !== 'string') return { status: 'non_numeric' };
  if (typeof value === 'string' && /^(?:NaN|[+-]?Infinity)$/i.test(value.trim())) return { status: 'non_finite' };
  const n = Number(value);
  if (Number.isNaN(n)) return { status: typeof value === 'number' ? 'non_finite' : 'non_numeric' };
  if (!Number.isFinite(n)) return { status: 'non_finite' };
  return { status: 'valid', value: n };
}
function weight(value, previous) {
  const result = numeric(value);
  if (result.status === 'valid' && (result.value > 263 || (previous ? result.value < 45 : result.value <= 45))) {
    return { status: 'out_of_range' };
  }
  return result;
}
function savedMl(value) {
  const result = numeric(value);
  return result.status === 'valid' && result.value < 0 ? { status: 'invalid_negative' } : result;
}
function dateTime(value) {
  const text = typeof value === 'string' ? value : value?.timestamp;
  // Reject timezone-less legacy text rather than depending on the PC timezone.
  const explicitZone = typeof text === 'string' && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text.trim());
  const n = explicitZone ? Date.parse(text) : NaN;
  return Number.isFinite(n) ? n : null;
}
function exchangeKind(value) {
  return value === false ? 'false' : value === true ? 'true' : value === undefined ? 'missing' : 'non_boolean';
}
function stats(values) {
  if (!values.length) return { count: 0, min: null, median: null, mean: null, max: null, p95: null, p99: null };
  const sorted = values.toSorted((a, b) => a - b), n = sorted.length;
  return {
    count: n, min: sorted[0], median: n % 2 ? sorted[(n - 1) / 2] : sorted[n / 2 - 1] / 2 + sorted[n / 2] / 2,
    mean: sorted.reduce((mean, value, index) => mean + (value - mean) / (index + 1), 0), max: sorted[n - 1],
    p95: sorted[Math.ceil(.95 * n) - 1], p99: sorted[Math.ceil(.99 * n) - 1],
  };
}
function cutoffCounts(values) {
  return Object.fromEntries(THRESHOLDS.map(g => {
    const count = values.filter(v => v >= g).length;
    return [`at_least_${g}g`, { count, percentOfPositiveDecreases: values.length ? count * 100 / values.length : null }];
  }));
}
function increment(counts, key) { counts[key] = (counts[key] || 0) + 1; }
function direction(previous, current) {
  const increase = current - previous;
  return increase < 0 ? 'decrease' : increase === 0 ? 'same' : increase < 1 ? 'increase_under_1g'
    : increase <= 3 ? 'increase_1_to_3g' : 'increase_over_3g';
}
function reviewRecord(record) {
  return { documentId: record.id, date: record.date, staffId: record.staffId, wardId: record.wardId,
    unit: record.unit, weightPrev: record.weightPrev, weightNow: record.weightNow,
    isBottleExchange: record.isBottleExchange, ml: record.ml };
}
function emptyBucket() { return { records: 0, weightRecords: 0, positives: [] }; }

function analyse(records) {
  const counts = {
    records: records.length, weightCandidates: 0, explicitWeight: 0, inferredLegacyWeight: 0,
    otherUnitWithWeights: 0, units: Object.create(null), exchangeAllRecords: { false: 0, true: 0, missing: 0, non_boolean: 0 },
    exchangeWeightCandidates: { false: 0, true: 0, missing: 0, non_boolean: 0 },
    previousWeight: { valid: 0, missing: 0, non_numeric: 0, non_finite: 0, out_of_range: 0 },
    currentWeight: { valid: 0, missing: 0, non_numeric: 0, non_finite: 0, out_of_range: 0 },
    validWeightPairs: 0, invalidWeightPairs: 0,
    normalDirections: { decrease: 0, same: 0, increase_under_1g: 0, increase_1_to_3g: 0, increase_over_3g: 0 },
    zeroMlAllRecords: { total: 0, sameWeight: 0, increase1To3g: 0, other: 0, otherIncludesUnder1g: 0 },
    mlAllRecords: Object.create(null), mlComparison: { within001: 0, exact: 0, nonzeroWithin001: 0, over001: 0, missing: 0, invalid: 0, notComparable: 0 },
    chain: { comparableAdjacentPairs: 0, mismatches: 0, uncomparableAdjacentPairs: 0, recordsWithInvalidStaffId: 0, recordsWithInvalidDate: 0 },
    shortIntervals: { adjacentPairsWithin30Seconds: 0, adjacentPairsWithin60Seconds: 0, adjacentPairsWithin300Seconds: 0 },
  };
  const review = { label: '要確認。誤登録・誤交換とは断定しない。', largeNormalDecreases: [], unexpectedNormalIncreases: [],
    mlDifferences: [], chainMismatches: [], shortIntervals: [], invalidWeights: [] };
  const normalPositive = [], normalSignedDeltas = [], normalSavedMl = [];
  const exchange = { records: 0, validPairs: 0, directions: { increaseOver3g: 0, increaseUpTo3g: 0, same: 0, decrease: 0 },
    previous: [], current: [], increase: [], ml: [] };
  const wards = new Map(), staffGroups = new Map();

  for (const record of records) {
    const prev = weight(record.weightPrev, true), now = weight(record.weightNow, false), ml = savedMl(record.ml);
    const pairValid = prev.status === 'valid' && now.status === 'valid', kind = exchangeKind(record.isBottleExchange);
    increment(counts.units, record.unit === undefined ? '(missing)' : typeof record.unit === 'string' ? record.unit : '(invalid)');
    increment(counts.exchangeAllRecords, kind); increment(counts.mlAllRecords, ml.status);
    if (ml.status === 'valid' && ml.value === 0) {
      const zero = counts.zeroMlAllRecords; zero.total++;
      const d = pairValid ? direction(prev.value, now.value) : null;
      if (d === 'same') zero.sameWeight++;
      else if (d === 'increase_1_to_3g') zero.increase1To3g++;
      else { zero.other++; if (d === 'increase_under_1g') zero.otherIncludesUnder1g++; }
    }
    const ward = typeof record.wardId === 'string' && record.wardId ? record.wardId : '(missing-or-invalid)';
    if (!wards.has(ward)) wards.set(ward, emptyBucket());
    const bucket = wards.get(ward); bucket.records++;
    const hasWeightField = own(record, 'weightPrev') || own(record, 'weightNow');
    const candidate = record.unit === 'weight' || ((record.unit === undefined || record.unit === null || record.unit === '') && hasWeightField);
    if (candidate) {
      counts.weightCandidates++;
      if (record.unit === 'weight') counts.explicitWeight++; else counts.inferredLegacyWeight++;
      increment(counts.exchangeWeightCandidates, kind); increment(counts.previousWeight, prev.status); increment(counts.currentWeight, now.status);
      bucket.weightRecords++;
      if (pairValid) counts.validWeightPairs++; else { counts.invalidWeightPairs++; review.invalidWeights.push({ ...reviewRecord(record), previousStatus: prev.status, currentStatus: now.status }); }
      if (kind === 'false') {
        if (ml.status === 'valid') normalSavedMl.push(ml.value); // Includes zero: distinct from positive weight decreases.
        if (pairValid) {
          const delta = prev.value - now.value;
          increment(counts.normalDirections, direction(prev.value, now.value)); normalSignedDeltas.push(delta);
          if (delta > 0) {
            normalPositive.push(delta); bucket.positives.push(delta);
            if (delta >= 50) review.largeNormalDecreases.push({ ...reviewRecord(record), decreaseG: delta });
          }
          if (delta < -3) review.unexpectedNormalIncreases.push(reviewRecord(record));
        }
      }
      if (kind === 'true') {
        exchange.records++;
        if (prev.status === 'valid') exchange.previous.push(prev.value);
        if (now.status === 'valid') exchange.current.push(now.value);
        if (ml.status === 'valid') exchange.ml.push(ml.value);
        if (pairValid) {
          exchange.validPairs++; const delta = now.value - prev.value; exchange.increase.push(delta);
          increment(exchange.directions, delta > 3 ? 'increaseOver3g' : delta > 0 ? 'increaseUpTo3g' : delta === 0 ? 'same' : 'decrease');
        }
      }
      if (ml.status === 'missing') counts.mlComparison.missing++;
      else if (ml.status !== 'valid') counts.mlComparison.invalid++;
      else if (!pairValid || (kind !== 'false' && kind !== 'true')) counts.mlComparison.notComparable++;
      else {
        const expectedMl = calculateWeightUsage(prev.value, now.value, kind === 'true');
        const difference = ml.value - expectedMl;
        // Floating-point epsilon prevents 0.010000000000... being misclassified.
        if (Math.abs(difference) <= .01 + 1e-9) {
          counts.mlComparison.within001++;
          increment(counts.mlComparison, Math.abs(difference) <= 1e-9 ? 'exact' : 'nonzeroWithin001');
        } else {
          counts.mlComparison.over001++;
          review.mlDifferences.push({ ...reviewRecord(record), expectedMl, differenceMl: difference });
        }
      }
    } else if (hasWeightField) counts.otherUnitWithWeights++;

    // Do not normalize IDs or merge numeric IDs with strings: preserve historical identity semantics.
    const validStaffId = (typeof record.staffId === 'string' && record.staffId.trim() !== '') ||
      (typeof record.staffId === 'number' && Number.isFinite(record.staffId));
    const time = dateTime(record.date);
    if (!validStaffId) counts.chain.recordsWithInvalidStaffId++;
    if (time === null) counts.chain.recordsWithInvalidDate++;
    if (validStaffId && time !== null) {
      const key = `${typeof record.staffId}:${record.staffId}`;
      if (!staffGroups.has(key)) staffGroups.set(key, []);
      staffGroups.get(key).push({ record, time, prev, now });
    }
  }
  for (const group of staffGroups.values()) {
    group.sort((a, b) => a.time - b.time || (a.record.id < b.record.id ? -1 : a.record.id > b.record.id ? 1 : 0));
    for (let i = 1; i < group.length; i++) {
      const a = group[i - 1], b = group[i], seconds = (b.time - a.time) / 1000;
      const details = { staffId: b.record.staffId, previousDocumentId: a.record.id, nextDocumentId: b.record.id,
        previousDate: new Date(a.time).toISOString(), nextDate: new Date(b.time).toISOString() };
      if (a.now.status === 'valid' && b.prev.status === 'valid') {
        counts.chain.comparableAdjacentPairs++;
        if (a.now.value !== b.prev.value) {
          counts.chain.mismatches++;
          review.chainMismatches.push({ ...details, previousWeightNow: a.now.value, nextWeightPrev: b.prev.value,
            differenceG: b.prev.value - a.now.value, reason: '要確認：旧実装・記録欠落・削除・モード変更・初回設定等でも生じ得る' });
        }
      } else counts.chain.uncomparableAdjacentPairs++;
      if (seconds <= 30) counts.shortIntervals.adjacentPairsWithin30Seconds++;
      if (seconds <= 60) counts.shortIntervals.adjacentPairsWithin60Seconds++;
      if (seconds <= 300) {
        counts.shortIntervals.adjacentPairsWithin300Seconds++;
        review.shortIntervals.push({ ...details, intervalSeconds: seconds, previousWeightPrev: a.record.weightPrev,
          previousWeightNow: a.record.weightNow, nextWeightPrev: b.record.weightPrev, nextWeightNow: b.record.weightNow,
          previousMl: a.record.ml, nextMl: b.record.ml, reason: '要確認：短時間記録だけでは誤登録と断定しない' });
      }
    }
  }
  return {
    methodology: { percentile: PERCENTILE_METHOD, median: 'middle value; mean of two middle values for even N',
      eligible: 'unit=weight, or missing/null/empty unit with weight fields. Explicit other units excluded from weight distributions.',
      normal: 'isBottleExchange === false only; valid finite range-checked weights; not certified as correct records',
      ranges: 'previous: 45 <= g <= 263; current: 45 < g <= 263; decimal and numeric-string compatibility retained',
      zeroMl: 'all records with finite non-negative numeric ml equal to zero; equality uses parsed numeric weights',
      increments: 'normal 1–3g bucket is inclusive; fractional 0<increase<1g reported separately',
      chain: 'adjacent date-valid records per exact typed staffId; all units retained to avoid bridging known mode records; invalid dates excluded',
      shortIntervals: 'nested inclusive cutoffs of adjacent pairs; dates compared at millisecond precision; ties ordered by document ID, not proven operation order',
      mlComparison: 'weight candidates only; match means abs(stored - expected) <= 0.01mL (+1e-9 epsilon); exact and nonzero tolerance matches also shown',
      snapshot: 'paginated live listing, not a fixed-time snapshot; concurrent changes may affect completeness' },
    counts, normalPositiveDecreaseG: { ...stats(normalPositive), cutoffs: cutoffCounts(normalPositive) },
    normalSignedDecreaseIncludingZeroG: stats(normalSignedDeltas), normalSavedMlIncludingZero: stats(normalSavedMl),
    exchange: { records: exchange.records, validPairs: exchange.validPairs, directions: exchange.directions,
      currentLessOrEqualPreviousSubtotal: exchange.directions.same + exchange.directions.decrease,
      previousG: stats(exchange.previous), currentG: stats(exchange.current), increaseG: stats(exchange.increase), savedMl: stats(exchange.ml) },
    wards: Object.fromEntries([...wards].map(([id, b]) => [id, { records: b.records, weightRecords: b.weightRecords,
      positiveNormalDecreases: stats(b.positives), cutoffs: cutoffCounts(b.positives) }])), review,
  };
}

async function readRecords(db) {
  const records = [], seenIds = new Set();
  let cursor;
  for (;;) {
    const constraints = [orderBy(documentId()), limit(PAGE_SIZE)];
    if (cursor !== undefined) constraints.push(startAfter(cursor));
    // No collection or operation is accepted from command-line arguments.
    const request = query(collection(db, 'records'), ...constraints);
    readLog.push({ operation: 'getDocsFromServer', collection: 'records' });
    const page = await getDocsFromServer(request); // Fail closed: no cached-read fallback.
    for (const snapshot of page.docs) {
      if (seenIds.has(snapshot.id)) throw new Error('Repeated document cursor; stopping audit.');
      seenIds.add(snapshot.id);
      documentsRead++;
      const record = { id: snapshot.id };
      // Never call data(), spread a document, or inspect fields outside FIELDS.
      for (const field of FIELDS) {
        const value = snapshot.get(field);
        if (value !== undefined) record[field] = scalar(value);
      }
      records.push(record);
    }
    if (page.docs.length < PAGE_SIZE) break;
    cursor = page.docs[page.docs.length - 1].id;
  }
  return records;
}

function inside(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}
async function assertOutsideGit(directory) {
  let current = directory;
  for (;;) {
    try { await stat(join(current, '.git')); throw new Error('Output location is inside a Git work tree.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}
async function outputLocally(report) {
  const repoRoot = await realpath(dirname(dirname(fileURLToPath(import.meta.url))));
  const tempRoot = await realpath(tmpdir());
  if (inside(repoRoot, tempRoot)) throw new Error('Temporary output directory must be outside the repository.');
  await assertOutsideGit(tempRoot);
  const directory = await mkdtemp(join(tempRoot, 'mamoru-record-audit-'));
  const safeJson = value => JSON.stringify(value, (_, v) => typeof v === 'number' && !Number.isFinite(v) ? String(v) : v, 2);
  // POSIX mode is owner-only; on Windows verify the inherited temporary-directory ACL. Nothing is uploaded.
  await writeFile(join(directory, 'summary.json'), safeJson({ ...report, review: undefined }), { mode: 0o600 });
  await writeFile(join(directory, 'review.json'), safeJson(report.review), { mode: 0o600 });
  const { counts, normalPositiveDecreaseG, exchange, wards } = report;
  console.log(JSON.stringify({ methodology: report.methodology, counts, normalPositiveDecreaseG,
    normalSignedDecreaseIncludingZeroG: report.normalSignedDecreaseIncludingZeroG,
    normalSavedMlIncludingZero: report.normalSavedMlIncludingZero, exchange, wards }, null, 2));
  console.log(`Local reports (IDs included; no names): ${directory}`);
}

let auditDb;
try {
  confirmReadOnly();
  const config = await loadFirebaseConfig(); // Stops before initialization if any setting is missing.
  console.log('READ-ONLY AUDIT: project confirmed via environment; collection=records; configuration values hidden.');
  const app = initializeApp(config, 'mamoru-records-read-only-audit');
  auditDb = getFirestore(app);
  const records = await readRecords(auditDb);
  if (readLog.some(r => r.operation !== 'getDocsFromServer' || r.collection !== 'records')) throw new Error('Read-only ledger check failed.');
  const report = analyse(records);
  report.audit = { projectConfirmed: true, startedAt, finishedAt: new Date().toISOString(), documentsRead,
    pageReadAttempts: readLog.length, firestoreWrites: readLog.filter(r => r.operation !== 'getDocsFromServer').length,
    percentileMethod: PERCENTILE_METHOD };
  await outputLocally(report);
  console.log('Audit completed; no thresholds selected and no data corrected.');
} catch {
  // No SDK error dump: it might contain configuration values or document content.
  console.error('Audit stopped. Results may be incomplete. Check confirmation, required variable names, read permissions, connection and local output permissions.');
  process.exitCode = 1;
} finally {
  if (auditDb) {
    try { await terminate(auditDb); } // Local connection cleanup, not a remote data mutation.
    catch { console.error('Local SDK connection cleanup failed.'); process.exitCode = 1; }
  }
  const writes = readLog.filter(r => r.operation !== 'getDocsFromServer').length;
  console.log(`Firestore reads: ${documentsRead} documents returned (${readLog.length} page read attempts; NOT exact billed reads)`);
  console.log(`Firestore writes: ${writes}`);
  if (writes !== 0) process.exitCode = 1;
}
