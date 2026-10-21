// Server-only cryptographic component. Never import from browser code.
// Stateless: no consumption, one-time guarantee, authentication, or physical measurement proof.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { normalizeStaffId } from '../normalizeStaffId.js';
import { isRecordOperationId } from '../recordOperationId.js';

export const WEIGHT_CHALLENGE_POLICY = Object.freeze({
  version: 1,
  remeasureTtlMs: 10 * 60 * 1000,
  confirmTtlMs: 5 * 60 * 1000,
  futureIssuedAtToleranceMs: 30 * 1000,
  // Several hundred bytes of ordinary claims plus optional baseline metadata fit well
  // below 4KiB. Cap the encoded token before decoding, JSON parsing or HMAC work.
  maxTokenLength: 4096,
});
const PREFIX = 'WEIGHT_CHALLENGE_';
export class WeightChallengeError extends Error {
  constructor(kind) {
    super(`${PREFIX}${kind}`); // Fixed text only: never token, payload, secret or raw cause.
    this.name = 'WeightChallengeError';
    this.code = `${PREFIX}${kind}`;
  }
}
const fail = kind => { throw new WeightChallengeError(kind); };
const stages = ['remeasure', 'confirm'];
const required = ['version','stage','staffId','previousWeight','weightNow','currentMl','appBuildId','ruleVersion','issuedAt','expiresAt'];
const optional = ['matchedRules','personalMedianMl','baselineCount','personalRuleEvaluated','baselineDigest','flowExpiresAt','operationId'];
const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
const integerTime = n => Number.isSafeInteger(n) && n > 0;
const finite = n => typeof n === 'number' && Number.isFinite(n);
const plain = o => o !== null && typeof o === 'object' && !Array.isArray(o) &&
  (Object.getPrototypeOf(o) === Object.prototype || Object.getPrototypeOf(o) === null);
function canonicalId(id) {
  return typeof id === 'string' && id.length > 0 && Buffer.byteLength(id,'utf8') <= 1500 &&
    id === normalizeStaffId(id) && !/[\/\u0000-\u001f\u007f]/.test(id) && id !== '.' && id !== '..';
}
function secretKey(secret) {
  if (typeof window !== 'undefined' || typeof secret !== 'string' || !secret.trim() ||
      Buffer.byteLength(secret,'utf8') < 32 || Buffer.byteLength(secret,'utf8') > 4096) fail('UNAVAILABLE');
  // Length is not an entropy test. Deployment must provide a cryptographically random secret.
  return secret;
}
function ttl(stage) {
  return stage === 'remeasure' ? WEIGHT_CHALLENGE_POLICY.remeasureTtlMs : WEIGHT_CHALLENGE_POLICY.confirmTtlMs;
}
function schema(p) {
  if (!plain(p) || required.some(k=>!own(p,k)) || Object.keys(p).some(k=>!required.includes(k)&&!optional.includes(k))) fail('INVALID');
  if (p.version !== WEIGHT_CHALLENGE_POLICY.version || !stages.includes(p.stage) || !canonicalId(p.staffId)) fail('INVALID');
  if (own(p,'operationId') && !isRecordOperationId(p.operationId)) fail('INVALID');
  if (!finite(p.previousWeight) || p.previousWeight < 45 || p.previousWeight > 263 ||
      !finite(p.weightNow) || p.weightNow <= 45 || p.weightNow > 263 ||
      !finite(p.currentMl) || p.currentMl < 0 || p.currentMl > 250) fail('INVALID');
  if (typeof p.appBuildId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(p.appBuildId) ||
      typeof p.ruleVersion !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(p.ruleVersion)) fail('INVALID');
  if (!integerTime(p.issuedAt) || !integerTime(p.expiresAt) || p.expiresAt <= p.issuedAt || p.expiresAt-p.issuedAt > ttl(p.stage)) fail('INVALID');
  if (own(p,'flowExpiresAt') && (!integerTime(p.flowExpiresAt) || p.flowExpiresAt <= p.issuedAt || p.expiresAt > p.flowExpiresAt)) fail('INVALID');
  if (own(p,'matchedRules') && (!Array.isArray(p.matchedRules) || !p.matchedRules.length || p.matchedRules.length > 2 ||
      p.matchedRules.some(r=>r!=='A'&&r!=='B') || new Set(p.matchedRules).size !== p.matchedRules.length)) fail('INVALID');
  if (own(p,'personalMedianMl') && p.personalMedianMl !== null && (!finite(p.personalMedianMl) || p.personalMedianMl <= 0 || p.personalMedianMl > 250)) fail('INVALID');
  if (own(p,'baselineCount') && (!Number.isInteger(p.baselineCount) || p.baselineCount < 0 || p.baselineCount > 3)) fail('INVALID');
  if (own(p,'personalRuleEvaluated') && typeof p.personalRuleEvaluated !== 'boolean') fail('INVALID');
  if (own(p,'baselineDigest') && (typeof p.baselineDigest !== 'string' || !/^[a-f0-9]{64}$/.test(p.baselineDigest))) fail('INVALID');
  if (p.personalRuleEvaluated === true && (p.baselineCount !== 3 || !finite(p.personalMedianMl) || p.personalMedianMl <= 0)) fail('INVALID');
  if (p.personalRuleEvaluated === false && own(p,'personalMedianMl') && p.personalMedianMl !== null) fail('INVALID');
}
function encodedSegment(text) {
  if (!text || !/^[A-Za-z0-9_-]+$/.test(text)) fail('INVALID');
  const buffer = Buffer.from(text,'base64url');
  if (buffer.toString('base64url') !== text) fail('INVALID');
  return buffer;
}
const mac = (encodedPayload,secret) => createHmac('sha256',secret).update(encodedPayload,'utf8').digest();

/** Claims omit version/issuedAt/expiresAt: issuer supplies fixed version and server-clock ms.
 * No ml recalculation, rule evaluation or baseline digest generation lives here.
 * flowExpiresAt can be passed by the future orchestrator to cap B at the original flow deadline.
 */
export function issueWeightChallenge(claims, { nowMs = Date.now(), secret = process.env.WEIGHT_REMEASUREMENT_SIGNING_SECRET, allowLegacy = true } = {}) {
  const key = secretKey(secret); // Only at call time; importing without a secret is safe.
  if (!integerTime(nowMs) || !plain(claims) || !stages.includes(claims.stage) ||
      Object.keys(claims).some(k=>!required.filter(k=>!['version','issuedAt','expiresAt'].includes(k)).includes(k)&&!optional.includes(k))) fail('INVALID');
  // Temporary rollout compatibility only. Disable legacy issuance after UI/API migration.
  if (!allowLegacy && !own(claims,'operationId')) fail('INVALID');
  const expiresAt = Math.min(nowMs+ttl(claims.stage), claims.flowExpiresAt ?? Infinity);
  const payload = { ...claims, version: WEIGHT_CHALLENGE_POLICY.version, issuedAt: nowMs, expiresAt };
  schema(payload);
  const encoded = Buffer.from(JSON.stringify(payload),'utf8').toString('base64url');
  const token = `${encoded}.${mac(encoded,key).toString('base64url')}`;
  if (token.length > WEIGHT_CHALLENGE_POLICY.maxTokenLength) fail('INVALID');
  return token;
}

/** expectedStage is mandatory. A verifies its initial weight but does not bind a future
 * re-entered weight. Returned B.weightNow must be matched by the future API, not this helper.
 */
export function verifyWeightChallenge(token, { expectedStage, expectedOperationId, nowMs = Date.now(), secret = process.env.WEIGHT_REMEASUREMENT_SIGNING_SECRET, allowLegacy = true } = {}) {
  if (typeof token !== 'string' || !token.length || token.length > WEIGHT_CHALLENGE_POLICY.maxTokenLength) fail('INVALID');
  const parts=token.split('.');
  if(parts.length!==2) fail('INVALID');
  // Validate format/size before HMAC, but never interpret unsigned claims as trusted data.
  const bytes=encodedSegment(parts[0]), signature=encodedSegment(parts[1]);
  if(signature.length!==32) fail('INVALID');
  const key=secretKey(secret);
  if(!timingSafeEqual(signature,mac(parts[0],key))) fail('INVALID');
  let payload;
  try { payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); }
  catch { fail('INVALID'); }
  schema(payload);
  if(!integerTime(nowMs) || !stages.includes(expectedStage)) fail('INVALID');
  if(payload.issuedAt-nowMs > WEIGHT_CHALLENGE_POLICY.futureIssuedAtToleranceMs) fail('INVALID');
  if(nowMs >= payload.expiresAt) fail('EXPIRED'); // Exact expiration is invalid, no expiry grace.
  if(payload.stage!==expectedStage) fail('WRONG_STAGE');
  if(expectedOperationId !== undefined && !isRecordOperationId(expectedOperationId)) fail('INVALID');
  // Presence is signed: neither dropping the request ID nor attaching one to a legacy
  // token can change its mode. No implicit upgrade/downgrade or token consumption.
  if(own(payload,'operationId')) {
    if(payload.operationId !== expectedOperationId) fail('OPERATION_MISMATCH');
  } else {
    if(!allowLegacy) fail('INVALID');
    if(expectedOperationId !== undefined) fail('OPERATION_MISMATCH');
  }
  return payload;
}
