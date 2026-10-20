// Pure offline analysis. No SDK, filesystem, network, or application entrypoint.
import { calculateWeightUsage } from '../../utils/calculateWeightUsage.js';
export const WINDOWS = Object.freeze([3, 5, 7]);
export function candidateRules() {
  // Comparison candidates ONLY: these are neither recommended nor decided thresholds.
  const existing = [2, 3].flatMap(k => [
    { id: `ratio-${k}`, ratio: k },
    { id: `ratio-${k}-difference-75`, ratio: k, difference: 75 },
    { id: `ratio-${k}-absolute-150`, ratio: k, absolute: 150 },
    { id: `ratio-${k}-difference-75-within-36h`, ratio: k, difference: 75, maxHours: 36 },
  ]).concat([{ id: 'difference-75', difference: 75 }, { id: 'absolute-150', absolute: 150 }]);
  const combinations = [50, 75, 100, 125, 150].flatMap(absolute =>
    [2, 3].map(ratio => ({ id: `ratio-${ratio}-absolute-${absolute}`, ratio, absolute })));
  // Reuse the two existing 150mL rules; never count duplicate rule IDs.
  return existing.concat(combinations.filter(rule => !existing.some(old => old.id === rule.id)));
}
const num = v => (typeof v === 'number' || (typeof v === 'string' && v.trim())) && Number.isFinite(Number(v)) ? Number(v) : null;
const weight = (v, prev) => { const n = num(v); return n !== null && n <= 263 && (prev ? n >= 45 : n > 45) ? n : null; };
const time = v => {
  const text = typeof v === 'string' ? v : v?.timestamp;
  const t = typeof text === 'string' && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text.trim()) ? Date.parse(text) : NaN;
  return Number.isFinite(t) ? t : null;
};
const median = a => { const s = [...a].sort((a,b)=>a-b); return s.length % 2 ? s[(s.length-1)/2] : (s[s.length/2-1]+s[s.length/2])/2; };
const bump = (o,k) => { o[k]=(o[k]||0)+1; };
function classify(r) {
  const prev=weight(r.weightPrev,true), now=weight(r.weightNow,false), stored=num(r.ml), t=time(r.date);
  const reasons=[];
  if (r.unit !== 'weight') reasons.push('not_explicit_weight_unit');
  if (r.isBottleExchange !== false) reasons.push(r.isBottleExchange === true ? 'exchange' : 'missing_or_invalid_exchange_flag');
  if (prev === null || now === null) reasons.push('invalid_or_missing_weight');
  const ml=prev !== null && now !== null ? calculateWeightUsage(prev,now,false) : null;
  if (ml !== null && ml <= 0) reasons.push('nonpositive_normal_ml');
  if (stored === null || stored < 0) reasons.push('invalid_or_missing_ml');
  else if (ml !== null && Math.abs(stored-ml) > .01+1e-9) reasons.push('ml_mismatch');
  if(t === null) reasons.push('invalid_date');
  const validId=(typeof r.staffId==='string' && r.staffId.trim()!=='') || (typeof r.staffId==='number' && Number.isFinite(r.staffId));
  if(!validId) reasons.push('invalid_staff_id');
  return {id:r.id,staffId:r.staffId,wardId:typeof r.wardId==='string'?r.wardId:'(missing-or-invalid)',t,prev,now,stored,ml,
    weightRecord:r.unit==='weight', validId, reasons,eligible:reasons.length===0};
}
function ruleMatch(rule,x,m,hours) {
  return (rule.ratio === undefined || x >= rule.ratio*m) &&
    (rule.difference === undefined || x-m >= rule.difference) &&
    (rule.absolute === undefined || x >= rule.absolute) &&
    (rule.maxHours === undefined || hours !== null && hours > 0 && hours <= rule.maxHours);
}
export function analyseTimeline(records, rules=candidateRules()) {
  if (!Array.isArray(rules) || !rules.length || new Set(rules.map(r=>r.id)).size!==rules.length) throw new Error('Unique rules required');
  for(const r of rules) {
    if(typeof r.id!=='string' || !r.id || !['ratio','difference','absolute'].some(k=>r[k]!==undefined)) throw new Error('Invalid rule');
    for(const k of Object.keys(r)) if(!['id','ratio','difference','absolute','maxHours'].includes(k)) throw new Error('Unknown condition');
    for(const k of ['ratio','difference','absolute','maxHours']) if(r[k]!==undefined && (typeof r[k]!=='number'||!Number.isFinite(r[k])||r[k]<=0)) throw new Error('Invalid parameter');
  }
  const groups=new Map(), excludedReasons=Object.create(null), counts={records:records.length,eligible:0,excluded:0,invalidDates:0};
  for(const r of records) {
    const c=classify(r);
    if(c.eligible) counts.eligible++; else {counts.excluded++;for(const reason of c.reasons)bump(excludedReasons,reason);}
    if(c.t===null) counts.invalidDates++;
    if(c.validId && c.t!==null) {const k=`${typeof c.staffId}:${c.staffId}`;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(c);}
  }
  const evaluations=[], chainReviews=[], knownRecords=[], aggregates=new Map();
  const baselineCounts=Object.fromEntries(WINDOWS.map(n=>[n,{evaluable:0,insufficient:0}]));
  for(const [staffKey,group] of groups) {
    group.sort((a,b)=>a.t-b.t || String(a.id).localeCompare(String(b.id),'en'));
    const history=[]; let previousGroup=[];
    for(let i=0;i<group.length;) {
      let end=i+1;while(end<group.length && group[end].t===group[i].t)end++;
      const batch=group.slice(i,end), ambiguous=batch.length>1 || previousGroup.length>1;
      for(const c of batch) {
        const p=previousGroup.length===1?previousGroup[0]:null;
        const hours=p?(c.t-p.t)/3600000:null;
        const comparable=!ambiguous && p?.weightRecord && c.weightRecord && p.now!==null && c.prev!==null;
        const mismatch=comparable ? p.now!==c.prev : null;
        const flags=[];
        if(ambiguous)flags.push('timestamp_tie_order_unknown');
        if(!comparable)flags.push('chain_uncomparable');
        if(mismatch)flags.push('chain_mismatch');
        if(hours!==null && hours<1/12)flags.push('under_5_minutes_rate_unreliable');
        const continuousHours=comparable && !mismatch ? hours:null;
        const details={documentId:c.id,staffId:c.staffId,wardId:c.wardId,date:new Date(c.t).toISOString(),
          previousDocumentId:p?.id??null,previousDate:p?new Date(p.t).toISOString():null,
          previousWeightNow:p?.now??null,currentWeightPrev:c.prev,currentWeightNow:c.now,
          elapsedHours:hours,continuousWeightElapsedHours:continuousHours,chainMismatch:mismatch,
          chainDifferenceG:comparable?c.prev-p.now:null,qualityFlags:flags,
          elapsed24HourEquivalentMl:continuousHours!==null && continuousHours>=1/12 && c.eligible?c.ml*24/continuousHours:null};
        if(mismatch) chainReviews.push(details);
        if(c.staffId==='11249'||c.staffId===11249)knownRecords.push({...details,storedMl:c.stored,exclusionReasons:c.reasons});
        if(!c.eligible)continue;
        for(const n of WINDOWS) {
          if(history.length<n){baselineCounts[n].insufficient++;continue;}
          baselineCounts[n].evaluable++;
          const past=history.slice(-n), m=median(past.map(x=>x.ml));
          const row={...details,currentMl:c.stored,recalculatedMl:c.ml,N:n,pastMedianMl:m,ratio:c.ml/m,differenceFromMedianMl:c.ml-m,
            baselineOldestDate:new Date(past[0].t).toISOString(),baselineNewestDate:new Date(past.at(-1).t).toISOString(),
            baselineSpanHours:(past.at(-1).t-past[0].t)/3600000,baselineDocumentIds:past.map(x=>x.id),
            typicalLowToOver150:m<50 && c.ml>150,matchedRuleIds:[],matchedRuleConditions:[]};
          // Each rule has its own eligible denominator; interval rules exclude unknown/unreliable intervals.
          for(const rule of rules) {
            const key=`${n}:${rule.id}`;
            if(!aggregates.has(key))aggregates.set(key,{N:n,ruleId:rule.id,evaluable:0,warnings:0,staff:new Set(),wards:new Map()});
            const a=aggregates.get(key);
            if(rule.maxHours!==undefined && (continuousHours===null || continuousHours<1/12))continue;
            a.evaluable++;
            if(!a.wards.has(c.wardId))a.wards.set(c.wardId,{evaluable:0,warnings:0,staff:new Set()});
            const w=a.wards.get(c.wardId);w.evaluable++;
            if(ruleMatch(rule,c.ml,m,continuousHours)){
              a.warnings++;a.staff.add(staffKey);w.warnings++;w.staff.add(staffKey);row.matchedRuleIds.push(rule.id);
              row.matchedRuleConditions.push({ruleId:rule.id,minimumMl:rule.absolute??null,medianMultiplier:rule.ratio??null,
                minimumDifferenceMl:rule.difference??null,maximumElapsedHours:rule.maxHours??null});
            }
          }
          evaluations.push(row);
        }
      }
      // Entire timestamp group is evaluated before insertion. Tied eligible records are not
      // selected into later baselines: true within-timestamp operation order is unknowable.
      if(batch.length===1 && batch[0].eligible)history.push(batch[0]);
      previousGroup=batch;i=end;
    }
  }
  const rate=(w,n)=>n?w*100/n:null;
  const comparisons=WINDOWS.flatMap(n=>rules.map(rule=>{
    const a=aggregates.get(`${n}:${rule.id}`)??{evaluable:0,warnings:0,staff:new Set(),wards:new Map()};
    return {N:n,ruleId:rule.id,evaluable:a.evaluable,warnings:a.warnings,warningPercent:rate(a.warnings,a.evaluable),staffCount:a.staff.size,
      wards:Object.fromEntries([...a.wards].map(([id,w])=>[id,{evaluable:w.evaluable,warnings:w.warnings,warningPercent:rate(w.warnings,w.evaluable),staffCount:w.staff.size}]))};
  }));
  return {summary:{notice:'比較候補であり未決定。警告は誤入力の断定ではない。',counts,excludedReasons,baselineCounts,comparisons,rules,
    chainMismatchCount:chainReviews.length,methodology:{history:'strictly earlier eligible positive normal records; tied groups never enter baselines; no lookback expiry',
      interval:'elapsed wall-clock hours, not working hours; no bridging intervening other-unit or invalid-weight records; invalid dates cannot be placed',
      timePrecision:'milliseconds; same-millisecond timestamps treated as tied',
      snapshot:'live paginated listing, not a fixed-time snapshot',rate:'auxiliary elapsed-24-hour equivalent; suppressed under 5 minutes or broken/unknown chain; 5 minutes is a reliability candidate, not a clinical threshold'}},
    review:{warnings:evaluations.filter(r=>r.matchedRuleIds.length),evaluations,chainMismatches:chainReviews},
    knownCase:{staffId:'11249',notice:'records上のチェーン情報のみ。未記録の重量変更や原因は推測しない。',records:knownRecords}};
}
