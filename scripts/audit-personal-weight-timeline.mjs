/**
 * READ-ONLY records audit. DO NOT RUN WITHOUT SEPARATE APPROVAL.
 * Node >= 22.7. Future use: explicit --confirm-personal-weight-timeline-records-read-only is required.
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
import { analyseTimeline } from './lib/analyse-weight-timeline.mjs';

const FIELDS = Object.freeze(['date', 'staffId', 'wardId', 'unit', 'weightPrev', 'weightNow', 'isBottleExchange', 'ml']);
const PAGE_SIZE = 500;
const readLog = [];
let documentsRead = 0;
const startedAt = new Date().toISOString();

function confirmReadOnly() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0] !== '--confirm-personal-weight-timeline-records-read-only') {
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
  if (inside(repoRoot, tempRoot)) throw new Error('Output must be outside repository.');
  await assertOutsideGit(tempRoot);
  const directory = await mkdtemp(join(tempRoot, 'mamoru-personal-weight-timeline-'));
  // Windows inherits temporary-directory ACL; verify permissions locally.
  for (const [file, value] of [['summary', report.summary], ['review', report.review], ['known-case', report.knownCase]]) {
    await writeFile(join(directory, `${file}.json`), JSON.stringify(value, null, 2), { mode: 0o600 });
  }
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Local reports (IDs included): ${directory}`);
}
let auditDb;
try {
  confirmReadOnly();
  const config = await loadFirebaseConfig(); // Stops before initialization if any setting is missing.
  console.log('READ-ONLY AUDIT: project confirmed via environment; collection=records; configuration values hidden.');
  const app = initializeApp(config, 'mamoru-personal-timeline-read-only-audit');
  auditDb = getFirestore(app);
  const records = await readRecords(auditDb);
  if (readLog.some(r => r.operation !== 'getDocsFromServer' || r.collection !== 'records')) throw new Error('Read-only ledger check failed.');
  const report = analyseTimeline(records);
  report.summary.audit = { projectConfirmed: true, startedAt, finishedAt: new Date().toISOString(), documentsRead,
    pageReadAttempts: readLog.length, firestoreWrites: readLog.filter(r => r.operation !== 'getDocsFromServer').length,
    analysis: "personal timeline; candidates undecided" };
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
