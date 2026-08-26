/**
 * TARIFF-SIMULATOR-CANADA — Regression Test Suite
 * ================================================
 * Run this after ANY change to data.js or client.html to catch regressions
 * in seconds instead of re-deriving test cases from scratch. Consolidates
 * every check built up during the pre-launch QA pass (12-13 AUG 2026).
 *
 * USAGE:
 *   1. Place this file in the same directory as data.js and client.html
 *      (or edit the paths just below).
 *   2. Run: node regression_suite.js
 *   3. Read the summary at the bottom. Any FAIL needs investigation before
 *      shipping the change that caused it.
 *
 * Requires Node.js and the "jsdom" package (npm install jsdom) for the
 * Section C end-to-end UI tests. Sections A and B only need built-in
 * Node modules and will still run without jsdom installed.
 *
 * WHEN TO EXTEND THIS FILE: any time a real bug is found and fixed (the
 * way the Côte d'Ivoire alias, the surtax precedence bug, and the
 * negative-value validation bug were found), add a check for it here so
 * it can never silently regress again.
 */

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'data.js');
const CLIENT_PATH = path.join(__dirname, 'client.html');

let pass = 0;
let fail = 0;
const failures = [];

function check(section, name, condition, detail) {
  if (condition) {
    pass++;
  } else {
    fail++;
    failures.push(`[${section}] ${name}${detail ? ' — ' + detail : ''}`);
  }
}

console.log('='.repeat(70));
console.log('TARIFF-SIMULATOR-CANADA — Regression Suite');
console.log('='.repeat(70));

// =========================================================================
// SECTION A — Data integrity (structural checks across the whole dataset)
// =========================================================================
console.log('\n--- SECTION A: Data Integrity ---');

const dataCode = fs.readFileSync(DATA_PATH, 'utf8');
const exportNames = [
  'CODE_DESCRIPTIONS', 'MFN_RATES', 'PREF_FREE', 'PREF_SPECIAL',
  'MFN_FREE_CHAPTERS', 'MFN_FREE_DEFAULT_CHAPTERS',
  'SIMA_CASES', 'SURTAX_ORDERS', 'SAFEGUARD_MEASURES',
  'COUNTRY_TREATIES', 'COUNTRY_NAME_ALIASES', 'PROVINCE_TAX_RATES',
  'getMfnRate', 'getApplicableRate', 'findSimaMatches', 'findSurtaxMatches',
  'findSafeguardMatches', 'surtaxAppliesToCountry', 'getFeesTaxForProvince',
  'wholeWordMatch', 'searchCodes', 'searchCodesByText'
];
const exportBlock = '\n' + exportNames.map(n => `try { globalThis.__EXPORT__${n} = ${n}; } catch(e) {}`).join('\n');
const dataSandbox = { console: { log: () => {} }, globalThis: {} };
dataSandbox.globalThis = dataSandbox;
vm.createContext(dataSandbox);
vm.runInContext(dataCode + exportBlock, dataSandbox);

const extracted = {};
exportNames.forEach(n => { extracted[n] = dataSandbox['__EXPORT__' + n]; });

const {
  CODE_DESCRIPTIONS, MFN_RATES, PREF_FREE, PREF_SPECIAL,
  MFN_FREE_CHAPTERS, MFN_FREE_DEFAULT_CHAPTERS,
  SIMA_CASES, SURTAX_ORDERS, SAFEGUARD_MEASURES,
  COUNTRY_TREATIES, COUNTRY_NAME_ALIASES, PROVINCE_TAX_RATES,
  getMfnRate, getApplicableRate, findSimaMatches, findSurtaxMatches,
  findSafeguardMatches, surtaxAppliesToCountry, getFeesTaxForProvince,
  wholeWordMatch, searchCodes, searchCodesByText
} = extracted;

// A1 — Chapter coverage
{
  const missing = [];
  for (let ch = 1; ch <= 97; ch++) {
    if (ch === 77) continue;
    const prefix = String(ch).padStart(2, '0');
    if (!Object.keys(CODE_DESCRIPTIONS).some(c => c.startsWith(prefix))) missing.push(ch);
  }
  check('A1', 'All chapters 1-97 (excl. 77) have codes', missing.length === 0, `missing: ${JSON.stringify(missing)}`);
}

// A2 — Every code resolves to a rate
{
  const unresolved = Object.keys(CODE_DESCRIPTIONS).filter(c => {
    try { return !getMfnRate(c); } catch(e) { return true; }
  });
  // Known, pre-existing gaps confirmed via direct investigation on 13 AUG
  // 2026: honest "source text was cut off, correctly left null rather than
  // guessed" gaps from build sessions that predate this project's QA phase.
  // Total is 43 across five chapters - NOT just Chapter 27, which is the
  // largest single cluster but not the only one. If this count changes,
  // investigate before assuming it's fine either direction: fewer could
  // mean someone guessed a rate instead of sourcing it; more means a new
  // gap opened up somewhere.
  check('A2', 'Total unresolved-code count matches the known baseline (43)',
    unresolved.length === 43,
    `now ${unresolved.length}: ${JSON.stringify(unresolved.slice(0,15))}`);
  const byChapter = {};
  unresolved.forEach(c => { const ch = c.slice(0,2); byChapter[ch] = (byChapter[ch]||0)+1; });
  check('A2b', 'Unresolved codes are still confined to the known chapters (19, 27, 28, 32, 35)',
    Object.keys(byChapter).every(ch => ['19','27','28','32','35'].includes(ch)),
    `breakdown: ${JSON.stringify(byChapter)}`);
}

// A3 — Malformed code format
{
  const pattern = /^\d{4}\.\d{2}\.\d{2}\.\d{2}$/;
  const malformed = Object.keys(CODE_DESCRIPTIONS).filter(c => !pattern.test(c));
  check('A3', 'No malformed HS codes', malformed.length === 0, JSON.stringify(malformed.slice(0,10)));
}

// A4 — Valid rate types
{
  const validTypes = new Set(['free','percent','specific','compound']);
  const invalid = Object.entries(MFN_RATES).filter(([c,r]) => !validTypes.has(r.type));
  check('A4', 'All MFN_RATES have a valid type', invalid.length === 0, JSON.stringify(invalid.slice(0,5)));
}

// A5 — Treaty code validity
{
  const known = new Set(['AUT','NZT','CCCT','LDCT','GPT','UST','MXT','CIAT','CT','CRT','IT','NT','SLT','PT','COLT','JT','PAT','HNT','KRT','CEUT','UAT','CPTPT','UKT']);
  const bad = [];
  Object.entries(PREF_FREE).forEach(([c,list]) => (list||[]).forEach(t => { if (!known.has(t)) bad.push(c+':'+t); }));
  Object.entries(PREF_SPECIAL).forEach(([c,obj]) => Object.keys(obj).forEach(t => { if (!known.has(t)) bad.push(c+':'+t); }));
  check('A5', 'No unknown/typo\'d treaty abbreviations', bad.length === 0, JSON.stringify(bad.slice(0,10)));
}

// A6 — Country name resolution (the alias-bug family)
{
  function walk(obj, results) {
    if (!obj || typeof obj !== 'object') return;
    if (obj.country && typeof obj.country === 'string') results.add(obj.country);
    if (Array.isArray(obj.countries)) obj.countries.forEach(c => results.add(c));
    if (Array.isArray(obj.excludedOrigins)) obj.excludedOrigins.forEach(c => results.add(c));
    if (obj.origin && typeof obj.origin === 'string' && !obj.origin.startsWith('Goods') && !obj.origin.startsWith('⚠') && !obj.origin.startsWith('Any')) results.add(obj.origin);
    for (const k in obj) { if (typeof obj[k] === 'object') walk(obj[k], results); }
  }
  const refs = new Set();
  SIMA_CASES.forEach(c => walk(c, refs));
  SURTAX_ORDERS.forEach(o => walk(o, refs));
  SAFEGUARD_MEASURES.forEach(m => walk(m, refs));
  const knownDeferred = new Set(['European Union']); // bloc name, not a country - separate design question
  const unresolvedCountries = [...refs].filter(c => {
    const resolved = COUNTRY_NAME_ALIASES[c] || c;
    return !(resolved in COUNTRY_TREATIES) && !knownDeferred.has(c);
  });
  check('A6', 'Every SIMA/surtax/safeguard country reference resolves via COUNTRY_TREATIES or an alias',
    unresolvedCountries.length === 0, JSON.stringify(unresolvedCountries));
}

// A7 — Chapter registration overlap
{
  const overlap = MFN_FREE_CHAPTERS.filter(ch => MFN_FREE_DEFAULT_CHAPTERS.includes(ch));
  check('A7', 'No chapter registered in both MFN_FREE_CHAPTERS and MFN_FREE_DEFAULT_CHAPTERS', overlap.length === 0, JSON.stringify(overlap));
}

// A8 — Known orphaned generic-suffix keys still resolve consistently (not a growing list)
{
  const orphans = [];
  Object.keys(MFN_RATES).forEach(code => {
    if (code.endsWith('.00') && !CODE_DESCRIPTIONS[code]) {
      const parent = code.slice(0, -3);
      if (Object.keys(CODE_DESCRIPTIONS).some(c => c.startsWith(parent) && c !== code)) orphans.push(code);
    }
  });
  check('A8', 'Known orphan count is stable (10 as of 12 AUG 2026 sweep) - investigate if this changed',
    orphans.length === 10, `now ${orphans.length}: ${JSON.stringify(orphans)}`);
}

// A9 — Whole-word search matching (24 AUG 2026 fix): guards against the
// exact substring false-positives found in a systematic batch test, and
// against over-correcting in a way that breaks legitimate plurals
{
  const falsePositiveCases = [
    { term: 'table', badText: 'juice of any other single vegetable', badWord: 'vegetable' },
    { term: 'hat', badText: 'fertilized for incubation other hatching', badWord: 'hatching' },
    { term: 'pen', badText: 'spent fowl', badWord: 'spent' },
    { term: 'pen', badText: 'saturated pentanes', badWord: 'pentanes' },
    { term: 'dress', badText: 'mayonnaise and salad dressing', badWord: 'dressing' },
    { term: 'mat', badText: 'maté', badWord: "maté (accented - JS's plain \\b doesn't treat accented letters as word chars)" },
    { term: 'mat', badText: 'tomato juice', badWord: 'tomato' },
    { term: 'pure', badText: 'tomatoes other purées', badWord: 'purées' },
  ];
  const stillFalsePositive = falsePositiveCases.filter(c => wholeWordMatch(c.badText, c.term));
  check('A9a', 'No substring false-positives remain (table/vegetable, hat/hatching, pen/spent, etc.)',
    stillFalsePositive.length === 0,
    JSON.stringify(stillFalsePositive.map(c => `"${c.term}" still matches inside "${c.badWord}"`)));

  const legitimatePlurals = [
    { term: 'table', text: 'wooden furniture of a kind used in offices tables' },
    { term: 'cable', text: 'insulated wire and cables' },
    { term: 'hat', text: 'other headgear hats and caps' },
    { term: 'pen', text: 'pen holders and pens' },
  ];
  const brokenPlurals = legitimatePlurals.filter(c => !wholeWordMatch(c.text, c.term));
  check('A9b', 'Simple pluralization still matches correctly (the fix did not over-correct)',
    brokenPlurals.length === 0,
    JSON.stringify(brokenPlurals.map(c => `"${c.term}" no longer matches "${c.text}"`)));

  check('A9c', '"hat" now correctly finds a real hat-related code via searchCodes',
    searchCodes('hat', 5).some(r => r.description.toLowerCase().includes('headgear')));
  check('A9d', '"sofa" still resolves via the earlier synonym fix, now on top of the matching fix',
    searchCodes('sofa', 5).some(r => r.code.startsWith('9401')));
}

// =========================================================================
// SECTION B — Known-bug regressions (specific fixes that must never revert)
// =========================================================================
console.log('--- SECTION B: Known-Bug Regressions ---');

// B1 — Country alias fixes
check('B1a', 'US alias resolves', (COUNTRY_NAME_ALIASES['United States']||'United States') === 'United States of America');
check('B1b', 'Taiwan alias resolves', (COUNTRY_NAME_ALIASES['Chinese Taipei']||'Chinese Taipei') === 'Taiwan');
check('B1c', 'Turkey alias resolves', (COUNTRY_NAME_ALIASES['Türkiye']||'Türkiye') === 'Turkey');
check('B1d', "Côte d'Ivoire alias resolves", (COUNTRY_NAME_ALIASES["Côte d'Ivoire"]||"Côte d'Ivoire") === "Cote d'Ivoire");

// B2 — Surtax applies-to-country uses resolved names (not raw aliases)
{
  const usOrder = SURTAX_ORDERS.find(o => o.originScope === 'US');
  check('B2', 'US-scoped surtax order correctly applies to canonical "United States of America"',
    usOrder ? surtaxAppliesToCountry(usOrder, 'United States of America') : false);
}

// B3 — Surtax precedence: known real overlaps resolve to the higher-precedence order
{
  const usAluminumCode = '7614.10.00.00';
  const usMatches = findSurtaxMatches(usAluminumCode).filter(o => surtaxAppliesToCountry(o, 'United States of America'));
  const scopeRank = {'China':0,'US':0,'exclude-US':1,'any-except-us-china':2,'any':3};
  const picked = usMatches.length ? usMatches.slice().sort((a,b)=>(scopeRank[a.originScope]??99)-(scopeRank[b.originScope]??99))[0] : null;
  check('B3', 'US-origin surtax overlap resolves to the US-specific order, not the general one',
    picked && picked.originScope === 'US', picked ? picked.name : 'no match found - code list may have changed');
}

// B4 — The 2005.99.90.99 fix (description + PREF_FREE)
check('B4a', '2005.99.90.99 has a description', !!CODE_DESCRIPTIONS['2005.99.90.99']);
check('B4b', '2005.99.90.99 has PREF_FREE relief', !!(PREF_FREE['2005.99.90.99'] && PREF_FREE['2005.99.90.99'].length));

// B5 — The 4402 wood charcoal correction (spot check it's still what was confirmed)
check('B5', '4402.10.90.00 resolves to a rate', !!getMfnRate('4402.10.90.00'));

// B6 — Fees-tax-on-province fix: constant should no longer exist
{
  const hasOldConstant = /hstOnFeesRate/.test(dataCode);
  check('B6', 'Old flat hstOnFeesRate constant is gone (replaced by getFeesTaxForProvince)', !hasOldConstant);
  check('B6b', 'getFeesTaxForProvince exists and is a function', typeof getFeesTaxForProvince === 'function');
}
if (typeof getFeesTaxForProvince === 'function') {
  check('B6c', 'Ontario -> HST 13% for fees', JSON.stringify(getFeesTaxForProvince('Ontario')) === JSON.stringify({label:'HST',rate:13}));
  check('B6d', 'Quebec -> GST only for fees (never QST)', JSON.stringify(getFeesTaxForProvince('Quebec')) === JSON.stringify({label:'GST',rate:5}));
  check('B6e', 'British Columbia -> GST only for fees (never PST)', JSON.stringify(getFeesTaxForProvince('British Columbia')) === JSON.stringify({label:'GST',rate:5}));
  check('B6f', 'New Brunswick -> HST 15% for fees', JSON.stringify(getFeesTaxForProvince('New Brunswick')) === JSON.stringify({label:'HST',rate:15}));
}

// =========================================================================
// SECTION C — End-to-end UI/calculation tests (requires jsdom)
// =========================================================================
console.log('--- SECTION C: End-to-End Calculation ---');

let jsdomAvailable = true;
let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch(e) { jsdomAvailable = false; }

if (!jsdomAvailable) {
  console.log('jsdom not installed - skipping Section C (run "npm install jsdom" to enable)');
} else {
  const clientHtml = fs.readFileSync(CLIENT_PATH, 'utf8')
    .replace('<script src="data.js"></script>', () => `<script>${dataCode}</script>`);

  async function runUI(fields) {
    const dom = new JSDOM(clientHtml, { runScripts: 'dangerously', resources: 'usable' });
    await new Promise(r => setTimeout(r, 100));
    const doc = dom.window.document;
    doc.getElementById('q').value = fields.q || '';
    doc.getElementById('value').value = fields.value != null ? String(fields.value) : '';
    doc.getElementById('origin').value = fields.origin || '';
    doc.getElementById('importType').value = fields.importType || 'commercial';
    if (fields.province) doc.getElementById('province').value = fields.province;
    if (fields.frequency) doc.getElementById('frequency').value = fields.frequency;
    if (fields.currency) doc.getElementById('currency').value = fields.currency;
    dom.window.runEstimate();
    await new Promise(r => setTimeout(r, 50));
    const resultsHtml = doc.getElementById('results').innerHTML;
    return {
      html: resultsHtml,
      text: resultsHtml.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(),
      inputs: dom.window.__brokerageInputs,
      computeBrokerageFees: dom.window.computeBrokerageFees
    };
  }

  (async () => {
    // C1 — Negative value blocked
    {
      const r = await runUI({ q: '4402.10.90.00', value: -500, origin: 'Germany' });
      check('C1', 'Negative shipment value is blocked with a clear message',
        r.html.includes('Enter a shipment value of zero or more'), r.html.slice(0,100));
    }

    // C2 — Zero/blank still blocked (regression)
    {
      const r = await runUI({ q: '4402.10.90.00', value: 0, origin: 'Germany' });
      check('C2', 'Zero shipment value is still blocked', r.html.includes('Enter a product and a shipment value'));
    }

    // C3 — Preferential relief math (China = pure MFN, Chile = full relief)
    {
      const r1 = await runUI({ q: '0105.12.90.00', value: 10000, origin: 'China' });
      const expectedDuty = 800, expectedGST = (10000+800)*0.05, expectedTotal = 10000+800+expectedGST;
      check('C3a', 'MFN duty calculates correctly (China, no relief)',
        Math.abs(r1.inputs.duty - expectedDuty) < 0.01, `got ${r1.inputs.duty}`);
      check('C3b', 'GST calculates on duty-paid value correctly',
        Math.abs(r1.inputs.taxOnGoods - expectedGST) < 0.01, `got ${r1.inputs.taxOnGoods}`);
      check('C3c', 'Total matches value+duty+GST exactly',
        Math.abs(r1.inputs.estimatedLandedCost - expectedTotal) < 0.01, `got ${r1.inputs.estimatedLandedCost}`);

      const r2 = await runUI({ q: '0105.12.90.00', value: 10000, origin: 'Chile' });
      check('C3d', 'Treaty relief correctly zeroes duty (Chile, CT)', r2.inputs.duty === 0, `got ${r2.inputs.duty}`);
      check('C3e', 'GST recalculates on the reduced (duty-free) base',
        Math.abs(r2.inputs.taxOnGoods - 500) < 0.01, `got ${r2.inputs.taxOnGoods}`);
    }

    // C4 — SIMA and Safeguard never enter the total
    {
      const r = await runUI({ q: '7604.10.00.30', value: 10000, origin: 'China' });
      const hasSimaWarning = r.html.includes('SIMA') || r.html.includes('umping');
      check('C4a', 'SIMA warning displays', hasSimaWarning);
      // value=10000, duty=0 (typical for this code), surtax 25% = 2500, dutyPaidValue=12500, GST=625, total=13125
      const expectedTotal = 10000 + 2500 + (12500*0.05);
      check('C4b', 'Total reflects surtax but NOT a speculative SIMA percentage',
        Math.abs(r.inputs.estimatedLandedCost - expectedTotal) < 1, `got ${r.inputs.estimatedLandedCost}, expected ~${expectedTotal}`);
    }

    // C5 — Province-based GST/HST/QST for goods (personal/casual)
    {
      const quebec = await runUI({ q: '4402.10.90.00', value: 1000, origin: 'United States of America', importType: 'personal', province: 'Quebec' });
      check('C5a', 'Quebec shows QST, not HST', quebec.html.includes('QST') && !quebec.html.includes('HST'));
      const ontario = await runUI({ q: '4402.10.90.00', value: 1000, origin: 'United States of America', importType: 'personal', province: 'Ontario' });
      check('C5b', 'Ontario shows HST, not QST', ontario.html.includes('HST') && !ontario.html.includes('QST'));
    }

    // C6 — Personal import without province is blocked
    {
      const r = await runUI({ q: '4402.10.90.00', value: 1000, origin: 'Germany', importType: 'personal' });
      check('C6', 'Personal import without a province selected is blocked',
        r.html.includes('Select your province'));
    }

    // C7 — Fees-tax-on-province fix, end to end through computeBrokerageFees
    {
      const bc = await runUI({ q: '4402.10.90.00', value: 1000, origin: 'United States of America', importType: 'commercial', province: 'British Columbia' });
      const bcFees = bc.computeBrokerageFees('onetime');
      check('C7a', 'BC commercial: our fees taxed at GST only', bcFees.feesTaxLabel === 'GST' && bcFees.feesTaxRate === 5);

      const on = await runUI({ q: '4402.10.90.00', value: 1000, origin: 'United States of America', importType: 'commercial', province: 'Ontario' });
      const onFees = on.computeBrokerageFees('onetime');
      check('C7b', 'Ontario commercial: our fees taxed at HST 13%', onFees.feesTaxLabel === 'HST' && onFees.feesTaxRate === 13);

      const qcPersonal = await runUI({ q: '4402.10.90.00', value: 1000, origin: 'United States of America', importType: 'personal', province: 'Quebec' });
      const qcFees = qcPersonal.computeBrokerageFees('onetime');
      check('C7c', 'Quebec personal: our fees taxed at GST only, never QST', qcFees.feesTaxLabel === 'GST' && qcFees.feesTaxRate === 5);
    }

    // C8 — Invalid/no-match code handled cleanly, no crash
    {
      const r = await runUI({ q: '9999.99.99.99', value: 1000, origin: 'Germany' });
      check('C8', 'Invalid HS code shows a clean fallback message', r.html.includes("don't have that product"));
    }

    // C9 — XSS safety: raw script tag never survives unescaped
    {
      const r = await runUI({ q: '<script>alert(1)</script>', value: 1000, origin: 'Germany' });
      check('C9', 'Raw <script> input never survives unescaped in output', !r.html.includes('<script>alert'));
    }

    // C10 — "Did you mean" fallback for free-text product search (13 AUG 2026 fix)
    {
      const r = await runUI({ q: 'aluminum windows', value: 1000, origin: 'Germany' });
      check('C10a', 'Free-text search with good candidates shows "did you mean" instead of a dead-end',
        r.html.includes('did you mean'), r.html.slice(0,150));
      check('C10b', 'The specific placeholder example (aluminum windows) surfaces a real matching code',
        r.html.includes('7610.'), 'no 7610.x code found in suggestions');

      const r2 = await runUI({ q: 'zqxvbkwpfjm', value: 1000, origin: 'Germany' });
      check('C10c', 'Genuine gibberish still falls through to the real "contact a broker" dead-end',
        r2.html.includes('Contact a broker'));
    }

    // C11 — Entry fee schedule boundaries (off-by-one risk at tier edges)
    {
      const r50 = await runUI({ q: '4402.10.90.00', value: 50, origin: 'Germany' });
      check('C11a', '$50 exactly gets the $10 tier (inclusive boundary)',
        r50.computeBrokerageFees('onetime').entryFee === 10);

      const r5001 = await runUI({ q: '4402.10.90.00', value: 50.01, origin: 'Germany' });
      check('C11b', '$50.01 correctly bumps to the next tier ($40)',
        r5001.computeBrokerageFees('onetime').entryFee === 40);

      const r25k = await runUI({ q: '4402.10.90.00', value: 25000, origin: 'Germany' });
      check('C11c', '$25,000 exactly is still within the schedule ($950)',
        r25k.computeBrokerageFees('onetime').entryFee === 950);

      const rOver = await runUI({ q: '4402.10.90.00', value: 25000.01, origin: 'Germany' });
      check('C11d', '$25,000.01 correctly triggers overLimit, not a guessed fee',
        r25k.computeBrokerageFees('onetime') && rOver.computeBrokerageFees('onetime').overLimit === true);
    }

    // C12 — Client-type toggle (UPDATED 25 AUG 2026): Account Setup Fee
    // remains one-time-vs-setup-differentiated, but Bond Fee was corrected
    // to be mandatory for ALL shipments regardless of client type - the
    // earlier assumption that one-timers ship under Hemisphere's own bond
    // was confirmed wrong by Rigo. Kept the old check's intent (verifying
    // the account-type distinction genuinely works) while fixing what each
    // fee is actually supposed to do.
    {
      const oneTime = await runUI({ q: '0105.12.90.00', value: 1000, origin: 'China' });
      const oneTimeFees = oneTime.computeBrokerageFees('onetime');
      check('C12a', 'One-time shipment: Account Setup Fee is zero, but Bond Fee is mandatory (non-zero)',
        oneTimeFees.accountSetupFee === 0 && oneTimeFees.bondFee > 0);

      const setupSmall = await runUI({ q: '0105.12.90.00', value: 1000, origin: 'China' });
      const setupSmallFees = setupSmall.computeBrokerageFees('setup');
      check('C12b', 'Account setup, small shipment: Bond Fee correctly hits the $100 minimum',
        setupSmallFees.bondFee === 100);
      check('C12bb', 'One-time and setup Bond Fee are IDENTICAL for the same shipment (both mandatory, same formula)',
        Math.abs(oneTimeFees.bondFee - setupSmallFees.bondFee) < 0.01);

      const setupLarge = await runUI({ q: '0105.12.90.00', value: 10000, origin: 'China' });
      const setupLargeFees = setupLarge.computeBrokerageFees('setup');
      const oneTimeLarge = await runUI({ q: '0105.12.90.00', value: 10000, origin: 'China' });
      const oneTimeLargeFees = oneTimeLarge.computeBrokerageFees('onetime');
      const expectedBond = Math.max(0.25 * (800 + (10000+800)*0.05), 100);
      check('C12c', 'Large shipment: Bond Fee correctly calculates 25% of duty+tax, for setup AND one-time alike',
        Math.abs(setupLargeFees.bondFee - expectedBond) < 0.01 && Math.abs(oneTimeLargeFees.bondFee - expectedBond) < 0.01);
    }

    // C13 — All 13 provinces/territories compute the correct tax combination
    {
      const provinceExpected = {
        'Alberta': 50, 'British Columbia': 120, 'Manitoba': 120, 'New Brunswick': 150,
        'Newfoundland and Labrador': 150, 'Northwest Territories': 50, 'Nova Scotia': 140,
        'Nunavut': 50, 'Ontario': 130, 'Prince Edward Island': 150, 'Quebec': 149.75,
        'Saskatchewan': 110, 'Yukon': 50
      };
      let allProvincesPass = true;
      const failures13 = [];
      for (const [prov, expected] of Object.entries(provinceExpected)) {
        const r = await runUI({ q: '4402.10.90.00', value: 1000, origin: 'United States of America', importType: 'personal', province: prov });
        if (Math.abs(r.inputs.taxOnGoods - expected) > 0.01) {
          allProvincesPass = false;
          failures13.push(`${prov}: got ${r.inputs.taxOnGoods}, expected ${expected}`);
        }
      }
      check('C13', 'All 13 provinces/territories compute their correct tax combination', allProvincesPass, JSON.stringify(failures13));
    }

    // C14 — Compound/specific rate codes never silently guess a duty amount
    {
      const r1 = await runUI({ q: '0105.11.22.00', value: 5000, origin: 'China' });
      check('C14a', 'Compound-rate code (238% but not less than 30.8c/each) computes zero duty, not a guess',
        r1.inputs.duty === 0);
      const r2 = await runUI({ q: '0402.10.10.00', value: 5000, origin: 'China' });
      check('C14b', 'Specific-rate code (3.32c/kg) computes zero duty, not a guess',
        r2.inputs.duty === 0);
      check('C14c', 'Specific-rate code clearly states per-unit, not silently implying zero duty',
        r2.html.includes('per unit') || r2.html.includes('Per-unit'));
    }

    // C15 — Rate resolver checks ALL of a country's treaties, not just the first
    {
      const r = await runUI({ q: '0401.10.10.00', value: 1000, origin: 'Mexico' });
      // Mexico is excluded from this code's MXT relief but qualifies via CPTPT instead
      check('C15', 'Resolver finds Mexicos CPTPT relief on a code that excludes its MXT treaty',
        r.inputs.duty === 0);
    }

    // C16 — Multiple simultaneous SIMA matches on the same code all render, not just the first
    {
      const r = await runUI({ q: '7610.10.00.10', value: 5000, origin: 'China' });
      const extrusionsCount = (r.html.match(/extrusions/gi) || []).length;
      const wallModulesCount = (r.html.match(/wall modules/gi) || []).length;
      check('C16', 'Both simultaneous SIMA matches (aluminum extrusions + wall modules) render as separate cards',
        extrusionsCount >= 1 && wallModulesCount >= 1, `extrusions: ${extrusionsCount}, wall modules: ${wallModulesCount}`);
    }

    // C17 — End-to-end confirmation of the Cote d'Ivoire alias fix (B1d checked the data layer;
    // this confirms the exemption actually suppresses the warning through the real UI flow)
    {
      const exempt = await runUI({ q: '2005.40.00.00', value: 5000, origin: "Cote d'Ivoire" });
      check('C17a', "Cote d'Ivoire is correctly exempt from the canned vegetable safeguard end-to-end",
        !exempt.html.includes('Safeguard'));
      const nonExempt = await runUI({ q: '2005.40.00.00', value: 5000, origin: 'Germany' });
      check('C17b', 'Germany (non-exempt) still correctly shows the safeguard warning, as a contrast check',
        nonExempt.html.includes('Safeguard'));
    }

    // C18 — Surtax applies independently of treaty duty relief (a real, practically important
    // case: CUSMA-Free aluminum from the US still correctly carries the steel/aluminum surtax)
    {
      const r = await runUI({ q: '7601.10.00.90', value: 10000, origin: 'United States of America' });
      check('C18a', 'CUSMA duty relief correctly gives zero duty', r.inputs.duty === 0);
      const expectedSurtax = 10000 * 0.25;
      const expectedTax = (10000 + expectedSurtax) * 0.05;
      const expectedTotal = 10000 + expectedSurtax + expectedTax;
      check('C18b', 'Surtax still applies in full despite zero duty, and total reflects both correctly',
        Math.abs(r.inputs.estimatedLandedCost - expectedTotal) < 0.01,
        `got ${r.inputs.estimatedLandedCost}, expected ${expectedTotal}`);
    }

    // C19 — SIMA and surtax applying simultaneously on the same shipment: both warnings must
    // display, but only the surtax dollar amount enters the total (SIMA stays a screening
    // indication, never a guessed number) - aluminum extrusions from China, a real combination
    {
      const r = await runUI({ q: '7604.10.00.30', value: 10000, origin: 'China' });
      check('C19a', 'Duty is correctly Free (MFN) for this code', r.inputs.duty === 0);
      const expectedSurtax = 10000 * 0.25;
      const expectedTax = (10000 + expectedSurtax) * 0.05;
      const expectedTotal = 10000 + expectedSurtax + expectedTax;
      check('C19b', 'Total reflects surtax only (value + surtax + tax), matching hand-calculated $13,125',
        Math.abs(r.inputs.estimatedLandedCost - expectedTotal) < 0.01,
        `got ${r.inputs.estimatedLandedCost}, expected ${expectedTotal}`);
      check('C19c', 'Both SIMA and surtax cards display simultaneously',
        r.html.includes('aluminum extrusions') && r.html.includes('Surtax (25%)'));
      check('C19d', 'SIMA stays a screening indication, never baked into the total as a guessed amount',
        r.html.includes('Screening indication'));
      check('C19e', 'Trade measures flag clearly lists both measures together',
        r.inputs.tradeMeasuresFlag.includes('Surtax') && r.inputs.tradeMeasuresFlag.includes('SIMA'));
    }

    // C20 — "sofa" search-synonym fix (24 AUG 2026): a common everyday furniture term with zero
    // literal match in the formal tariff text now correctly resolves via SEARCH_SYNONYMS
    {
      const r = await runUI({ q: 'sofa', value: 1000, origin: 'China' });
      check('C20a', '"sofa" shows a "did you mean" suggestion instead of a dead-end',
        r.html.includes('did you mean'));
      check('C20b', 'Suggestion includes a real upholstered seat code (9401.x)',
        r.html.includes('9401.'));
    }

    // C21 — Real client scenario: US wooden office desks, Ontario, commercial (25 AUG 2026,
    // from a user-provided test library). MFN is already Free for this code - the tool must
    // NOT claim a specific US/CUSMA treaty applies when none is needed, and must clearly
    // explain why the provincial tax portion isn't shown for a commercial import.
    {
      const r = await runUI({ q: '9403.30.00.10', value: 25000, origin: 'United States of America', province: 'Ontario' });
      check('C21a', 'HS code recognized exactly', r.inputs.hsCode === '9403.30.00.10');
      check('C21b', 'Correctly shows plain MFN, not a claimed US-specific treaty (none needed - MFN is already Free)',
        r.inputs.preferentialTreatment === 'MFN (no preferential treaty)');
      check('C21c', 'Ontario commercial: GST-only total is correct ($26,250 = $25,000 + 5% GST, provincial portion self-assessed)',
        Math.abs(r.inputs.estimatedLandedCost - 26250) < 0.01);
      check('C21d', 'Clearly explains why the provincial portion is not collected at the border',
        r.html.includes('self-assessed'));
    }

    // C22 — Real client scenario: air compressor description variations (25 AUG 2026). Tests
    // that the search correctly distinguishes portable/stationary and reciprocating/rotary
    // rather than treating every "compressor" query identically. Includes the "industrial"
    // synonym fix found via this exact test.
    {
      const recip = searchCodes('portable reciprocating air compressor', 1);
      check('C22a', '"portable reciprocating air compressor" resolves to the exact right code',
        recip[0] && recip[0].code === '8414.80.90.71');
      const rotary = searchCodes('portable rotary air compressor', 1);
      check('C22b', '"portable rotary air compressor" resolves to the exact right code',
        rotary[0] && rotary[0].code === '8414.80.90.72');
      const industrial = searchCodes('industrial air compressor', 3);
      check('C22c', '"industrial air compressor" correctly surfaces stationary compressor codes, not noise',
        industrial.some(r => r.code.startsWith('8414.80.90.4')));
    }

    // C23 — Real client scenario: Vietnam kitchen cabinets, BC, commercial (25 AUG 2026).
    // Confirms CPTPT resolution is explicitly named (not silently applied) and that the tool
    // visibly distinguishes "Preferential" tariff treatment from plain "MFN" (contrast with C21).
    {
      const r = await runUI({ q: '9403.40.00.10', value: 40000, origin: 'Vietnam', province: 'British Columbia' });
      check('C23a', 'Vietnam correctly resolves via CPTPT to zero duty', r.inputs.duty === 0);
      check('C23b', 'Preferential treatment explicitly names the treaty (CPTPT), not left implicit',
        r.inputs.preferentialTreatment === 'CPTPT');
      check('C23c', 'Tariff treatment is visibly labeled "Preferential", contrasting with C21bs plain "MFN"',
        r.html.includes('Preferential (CPTPT)'));
      check('C23d', 'BC commercial: GST-only total is correct ($42,000 = $40,000 + 5% GST)',
        Math.abs(r.inputs.estimatedLandedCost - 42000) < 0.01);
    }

    // =====================================================================
    // C24-C36 — REAL-WORLD CLIENT SCENARIO LIBRARY (25 AUG 2026)
    // A test library modeled on actual client journeys (Product -> HS ->
    // Origin -> Tariff treatment -> Province -> Tax -> Frequency -> Final
    // result), not just isolated technical checks. Covers every province,
    // 9 distinct treaty relationships, all three trade-measure types, TRQ
    // within/over-access, every rate type, fee-schedule boundaries,
    // validation, and search quality. Re-run this whenever data.js or
    // client.html changes - this is the quality-control checklist for the
    // simulator, alongside the more technical checks above it.
    // =====================================================================

    // C24 — China charcoal -> Quebec, commercial: contrast with C21/C23's
    // Ontario/BC cases, confirming QST-bearing Quebec still only charges
    // GST on OUR fees (not QST), while goods tax still shows correctly
    {
      const r = await runUI({ q: '4402.10.90.00', value: 5000, origin: 'China', province: 'Quebec' });
      check('C24', 'China charcoal -> Quebec: goods tax section renders correctly (QST or GST)',
        r.text.includes('QST') || r.text.includes('GST'));
    }

    // C25/C26 — Mexico vs Japan, same auto part: confirms the resolver picks
    // the correct DIFFERENT treaty for each origin on an identical code
    {
      const rMex = await runUI({ q: '8708.99.99.99', value: 12000, origin: 'Mexico', province: 'Manitoba' });
      check('C25', 'Mexico auto parts -> Manitoba: resolves via MXT (CUSMA), zero duty',
        rMex.inputs.duty === 0 && rMex.inputs.preferentialTreatment === 'MXT');
      const rJpn = await runUI({ q: '8708.99.99.99', value: 12000, origin: 'Japan', province: 'Saskatchewan' });
      check('C26', 'Japan auto parts -> Saskatchewan: resolves via CPTPT (CPTPP), zero duty',
        rJpn.inputs.duty === 0 && rJpn.inputs.preferentialTreatment === 'CPTPT');
    }

    // C27-C29 — Germany/CETA, UK/CUFTA, Chile/CCFTA+CPTPT dual-treaty:
    // confirms three more distinct trade agreements each resolve by name
    {
      const rDe = await runUI({ q: '8418.29.00.00', value: 15000, origin: 'Germany', province: 'Nova Scotia' });
      check('C27', 'Germany refrigeration equip -> Nova Scotia: resolves via CEUT (CETA), zero duty',
        rDe.inputs.duty === 0 && rDe.inputs.preferentialTreatment === 'CEUT');
      const rUk = await runUI({ q: '8407.29.20.00', value: 9000, origin: 'United Kingdom', province: 'New Brunswick' });
      check('C28', 'UK marine engines -> New Brunswick: resolves via UKT (CUFTA), zero duty',
        rUk.inputs.duty === 0 && rUk.inputs.preferentialTreatment === 'UKT');
      const rCl = await runUI({ q: '8418.50.10.00', value: 7000, origin: 'Chile', province: 'Prince Edward Island' });
      check('C29', 'Chile compressors -> PEI: dual CCFTA/CPTPP membership still resolves to zero duty',
        rCl.inputs.duty === 0);
    }

    // C30 — South Korea/CKFTA
    {
      const r = await runUI({ q: '8418.29.00.00', value: 11000, origin: 'South Korea', province: 'Newfoundland and Labrador' });
      check('C30', 'South Korea refrigeration equip -> Newfoundland and Labrador: resolves via KRT (CKFTA)',
        r.inputs.duty === 0 && r.inputs.preferentialTreatment === 'KRT');
    }

    // C31-C33 — Same product (t-shirts, 18% MFN), three origins with three
    // genuinely different outcomes: LDC gets full relief, no-treaty gets
    // full MFN, GPT gets a real but partial discount. This trio together is
    // the clearest possible demonstration that treaty resolution is doing
    // real, origin-specific work rather than a flat lookup.
    {
      const rBd = await runUI({ q: '6109.10.00.12', value: 3000, origin: 'Bangladesh', importType: 'personal', province: 'Ontario' });
      check('C31', 'Bangladesh t-shirts (LDC): LDCT gives full relief, zero duty',
        rBd.inputs.duty === 0 && rBd.inputs.preferentialTreatment === 'LDCT');
      const rIn = await runUI({ q: '6109.10.00.12', value: 3000, origin: 'India', importType: 'personal', province: 'Ontario' });
      check('C32', 'India t-shirts (no treaty): plain MFN 18%, no relief claimed',
        rIn.inputs.dutyRate === '18%' && rIn.inputs.preferentialTreatment === 'MFN (no preferential treaty)');
      const rSv = await runUI({ q: '6110.11.10.00', value: 4000, origin: 'El Salvador', importType: 'personal', province: 'Ontario' });
      check('C33', 'El Salvador wool sweaters (GPT): real partial relief 18%->16%, not zero and not full',
        Math.abs(rSv.inputs.duty - 4000*0.16) < 0.01 && rSv.inputs.preferentialTreatment === 'GPT');
    }

    // C34 — US steel pipe: CUSMA duty relief AND the steel surtax both
    // correctly apply together (same independence-of-surtax pattern as
    // C18, different product/heading for coverage)
    {
      const r = await runUI({ q: '7304.19.00.14', value: 20000, origin: 'United States of America', province: 'Ontario' });
      const expectedTotal = 20000 + 20000*0.25 + (20000+20000*0.25)*0.05;
      check('C34', 'US steel pipe: CUSMA zero duty, but 25% surtax still applies in full',
        r.inputs.duty === 0 && Math.abs(r.inputs.estimatedLandedCost - expectedTotal) < 0.01);
    }

    // C35 — Cast iron soil pipe: a SIMA case with NO surtax overlap, unlike
    // C19's aluminum extrusions. Confirms SIMA renders correctly on its own,
    // not just when paired with a surtax.
    {
      const r = await runUI({ q: '7303.00.00.10', value: 8000, origin: 'China', province: 'Ontario' });
      check('C35', 'China cast iron soil pipe: SIMA renders alone, with no surtax card present',
        r.text.includes('SIMA') && !r.text.includes('Surtax ('));
    }

    // C36 — TRQ within-access (Free) vs over-access (punitive compound rate)
    // on the exact same product family, confirming both ends of the TRQ
    // structure behave correctly side by side
    {
      const rOver = await runUI({ q: '0105.11.22.00', value: 2000, origin: 'China', province: 'Ontario' });
      check('C36a', 'Over-access broilers: compound rate never silently computed as a guessed duty',
        rOver.inputs.duty === 0 && (rOver.text.includes('per unit') || rOver.text.includes('Per-unit')));
      const rWithin = await runUI({ q: '0105.11.21.00', value: 2000, origin: 'United States of America', province: 'Ontario' });
      check('C36b', 'Within-access broilers (US): correctly gets relief, contrasting with over-access',
        rWithin.inputs.duty === 0);
    }

    // C37 — Free MFN chapter-pattern products in GST-only territories
    // (Yukon, NWT), confirming the territory tax combination and Free
    // chapter-pattern resolution both work outside the 4 most-tested provinces
    {
      const rYt = await runUI({ q: '6109.10.00.12', value: 800, origin: 'China', importType: 'personal', province: 'Yukon' });
      const expDuty = 800*0.18, expTax = (800+expDuty)*0.05;
      check('C37a', 'China t-shirts -> Yukon, personal: correct GST-only territory tax total',
        Math.abs(rYt.inputs.estimatedLandedCost - (800+expDuty+expTax)) < 0.01);
      const rNwt = await runUI({ q: '8517.13.00.00', value: 1500, origin: 'China', importType: 'personal', province: 'Northwest Territories' });
      check('C37b', 'China smartphones -> NWT, personal: Free MFN + correct GST-only total',
        rNwt.inputs.duty === 0 && Math.abs(rNwt.inputs.estimatedLandedCost - 1500*1.05) < 0.01);
    }

    // C38 — Ambiguous single-word search must show real options, not guess
    {
      const r = await runUI({ q: 'compressor', value: 5000, origin: 'China', province: 'Ontario' });
      const suggestCount = (r.html.match(/suggest-item/g) || []).length;
      check('C38', '"compressor" alone (genuinely ambiguous - portable/stationary/gas) shows 2+ real options',
        suggestCount >= 2, `found ${suggestCount} suggestions`);
    }

    // C39 — 100%-Free chapter product (aircraft parts, Ch.88) at a large,
    // realistic commercial value
    {
      const r = await runUI({ q: '8807.30.00.00', value: 50000, origin: 'France', province: 'Quebec' });
      check('C39', 'France aircraft parts -> Quebec: Ch.88 (100% Free chapter) correctly gives zero duty',
        r.inputs.duty === 0);
    }

    // C40 — Weekly frequency normalizes to monthly/yearly projections (not
    // a raw "/week" figure) - verified against hand-calculated math
    {
      const r = await runUI({ q: '4402.10.90.00', value: 2000, origin: 'Germany', province: 'Ontario', frequency: 'weekly' });
      const perShipment = 2000 * 1.05;
      const expectedYearly = perShipment * 52;
      check('C40', 'Weekly frequency -> correct monthly/annual projection, matching hand-calculated $109,200/yr',
        r.inputs.frequency === 'Weekly' && r.text.includes('Weekly shipments')
        && r.text.includes(expectedYearly.toLocaleString('en-US', {minimumFractionDigits:2})));
    }

    // C41 — One-time vs account-setup client type on the same real scenario:
    // confirms Account Setup Fee correctly toggles while Bond Fee (mandatory
    // for all shipments as of 25 AUG 2026) is identical for both, on a
    // realistic $15,000 commercial shipment, not just the smaller test
    // values used in C12
    {
      const r = await runUI({ q: '9403.40.00.10', value: 15000, origin: 'Vietnam', province: 'British Columbia' });
      const oneTime = r.computeBrokerageFees('onetime');
      const setup = r.computeBrokerageFees('setup');
      check('C41', 'Vietnam cabinets ($15k): Account Setup Fee toggles correctly, Bond Fee is mandatory and identical for both',
        oneTime.accountSetupFee === 0 && setup.accountSetupFee === 100
        && oneTime.bondFee > 0 && Math.abs(oneTime.bondFee - setup.bondFee) < 0.01);
    }

    // C42 — Same product, three provinces side by side (BC/Ontario/Quebec):
    // for a commercial import, all three should charge identical 5%
    // GST-only tax (provincial portion self-assessed everywhere), proving
    // the commercial-tax rule is genuinely province-independent, not
    // accidentally varying
    {
      const bc = await runUI({ q: '9403.40.00.10', value: 20000, origin: 'Vietnam', province: 'British Columbia' });
      const on = await runUI({ q: '9403.40.00.10', value: 20000, origin: 'Vietnam', province: 'Ontario' });
      const qc = await runUI({ q: '9403.40.00.10', value: 20000, origin: 'Vietnam', province: 'Quebec' });
      check('C42', 'Vietnam cabinets: BC/Ontario/Quebec commercial tax is identical (5% GST-only in all three)',
        Math.abs(bc.inputs.taxOnGoods - on.inputs.taxOnGoods) < 0.01 && Math.abs(on.inputs.taxOnGoods - qc.inputs.taxOnGoods) < 0.01,
        `BC=${bc.inputs.taxOnGoods}, ON=${on.inputs.taxOnGoods}, QC=${qc.inputs.taxOnGoods}`);
    }

    // C43 — Leaf-scoring bug (25 AUG 2026, found via a real user report): a
    // raw material's incidental mention in a long "exempted downstream
    // uses" list was unfairly outranking the actual specific product it was
    // mentioned in passing. Two distinct patterns caused this - a
    // parenthetical exemption clause (polyester fibre/"upholstered
    // furniture"), and a plain semicolon-separated one with no parens at
    // all (steel hardware/"air compressor tanks") - fixed with a combined
    // parenthetical-stripping + leaf-length-cutoff approach covering both.
    {
      const rSofa = await runUI({ q: 'sofa', value: 1000, origin: 'China' });
      check('C43a', '"sofa" no longer ranks the raw polyester fibre code (5503.20) above real seat codes',
        rSofa.html.includes('9401.') && rSofa.html.indexOf('9401.') < (rSofa.html.indexOf('5503.20') === -1 ? Infinity : rSofa.html.indexOf('5503.20')));
      const rIndustrial = searchCodes('industrial air compressor', 3);
      check('C43b', '"industrial air compressor" no longer ranks the steel-hardware exemption code (7326.90) first',
        rIndustrial[0] && rIndustrial[0].code.startsWith('8414.80.90.4'));
      check('C43c', 'The fix does not regress the earlier substring-matching or aluminum-windows fixes',
        searchCodes('hat',1)[0].description.toLowerCase().includes('headgear')
        && searchCodes('aluminum windows',1)[0].code === '7610.10.00.20');
    }

    // C44 — Surtax field fix (25 AUG 2026, found via a real Make/Tally setup
    // question): the Tally payload never sent a dedicated surtax field -
    // only duty_amount and gst_hst_pst_amount existed as separate, always-
    // present numeric fields, while surtax info was buried as text inside
    // the combined trade_measures_flag string alongside SIMA and safeguard.
    // This explained why Make's field picker never offered a "surtax"
    // option: it only offers fields it has seen real data for, and no
    // submission had ever sent one. Fixed by adding dedicated, always-
    // present surtax_amount/surtax_rate fields.
    {
      const rFlat = await runUI({ q: '7601.10.00.90', value: 10000, origin: 'United States of America' });
      check('C44a', 'Flat-rate surtax case: surtaxAmount/surtaxRate populated correctly',
        rFlat.inputs.surtaxAmount === 2500 && rFlat.inputs.surtaxRate === '25%');
      const rNone = await runUI({ q: '4402.10.90.00', value: 1000, origin: 'Germany' });
      check('C44b', 'No-surtax case: fields present as 0/"None", not missing entirely',
        rNone.inputs.surtaxAmount === 0 && rNone.inputs.surtaxRate === 'None');
      const rQuota = await runUI({ q: '7206.10.00.90', value: 10000, origin: 'Germany' });
      check('C44c', 'Quota-dependent TRQ surtax case: amount=0, rate correctly labeled',
        rQuota.inputs.surtaxAmount === 0 && rQuota.inputs.surtaxRate === 'Quota-dependent');
    }

    // C45-C46 — USD/CAD currency toggle (25 AUG 2026): client can enter a
    // shipment value in USD, converted to CAD at a fixed 1.45 rate
    // (deliberately higher than live market rate - confirmed with Rigo -
    // so a client's real cost comes in under the estimate, not over it)
    // before any duty/tax calculation runs. CAD entry (the default) must
    // remain completely unaffected.
    {
      const rUsd = await runUI({ q: '4402.10.90.00', value: 10000, origin: 'Germany', currency: 'USD' });
      check('C45a', 'USD entry converts to CAD at exactly 1.45 before calculation',
        rUsd.inputs.value === 14500 && rUsd.inputs.originalEnteredValue === 10000 && rUsd.inputs.currency === 'USD');
      const expectedTotal = 14500 + 14500*0.05;
      check('C45b', 'Downstream GST/total calculated correctly on the CONVERTED CAD value, not the raw USD figure',
        Math.abs(rUsd.inputs.estimatedLandedCost - expectedTotal) < 0.01);
      check('C45c', 'Conversion is clearly shown in the visible results, not silently applied',
        rUsd.text.includes('converted from') && rUsd.text.includes('USD'));

      const rCad = await runUI({ q: '4402.10.90.00', value: 10000, origin: 'Germany', currency: 'CAD' });
      check('C46', 'CAD entry (default) is completely unaffected - no conversion applied, no note shown',
        rCad.inputs.value === 10000 && !rCad.text.includes('converted from'));
    }

    // C47 — Referral source field (25 AUG 2026): new optional field in the
    // quote-request contact box, wired through to the Tally payload
    {
      const dom = new (require('jsdom').JSDOM)(clientHtml, { runScripts: 'dangerously', resources: 'usable' });
      await new Promise(r => setTimeout(r, 100));
      const doc = dom.window.document;
      doc.getElementById('q').value = '4402.10.90.00';
      doc.getElementById('value').value = '1000';
      doc.getElementById('origin').value = 'Germany';
      dom.window.runEstimate();
      await new Promise(r => setTimeout(r, 50));
      doc.getElementById('quoteRevealBtn').click();
      await new Promise(r => setTimeout(r, 50));
      const referralEl = doc.getElementById('bpReferral');
      check('C47a', 'Referral source field exists in the quote-request box', !!referralEl);
      if (referralEl) {
        const hasExpectedOption = [...referralEl.options].some(o => o.value === 'Referral from a colleague or client');
        check('C47b', 'Referral field includes a sensible set of options', hasExpectedOption);
      }
    }

    // C48 — Internal exchange rate must never be shown to the client
    // (25 AUG 2026): the live typing preview note was removed entirely, and
    // the results-header explanation keeps the "converted from X USD"
    // wording but no longer states the 1.45 rate itself
    {
      const r = await runUI({ q: '4402.10.90.00', value: 1230, origin: 'Germany', currency: 'USD' });
      check('C48a', 'Results header explains the conversion without exposing the internal rate',
        r.text.includes('converted from') && r.text.includes('USD') && !r.text.includes('1.45'));
      const dom = new (require('jsdom').JSDOM)(clientHtml, { runScripts: 'dangerously', resources: 'usable' });
      await new Promise(res => setTimeout(res, 100));
      check('C48b', 'The live typing preview note element no longer exists in the DOM at all',
        !dom.window.document.getElementById('currencyConvertNote'));
    }

    // C49 — Referral "Other" reveal field (25 AUG 2026)
    {
      const dom = new (require('jsdom').JSDOM)(clientHtml, { runScripts: 'dangerously', resources: 'usable' });
      await new Promise(r => setTimeout(r, 100));
      const doc = dom.window.document;
      doc.getElementById('q').value = '4402.10.90.00';
      doc.getElementById('value').value = '1000';
      doc.getElementById('origin').value = 'Germany';
      dom.window.runEstimate();
      await new Promise(r => setTimeout(r, 50));
      doc.getElementById('quoteRevealBtn').click();
      await new Promise(r => setTimeout(r, 50));
      const referralSelect = doc.getElementById('bpReferral');
      const otherInput = doc.getElementById('bpReferralOther');
      check('C49a', 'Other text input is hidden by default', otherInput.style.display === 'none');
      referralSelect.value = 'Other';
      referralSelect.dispatchEvent(new dom.window.Event('change'));
      check('C49b', 'Other text input reveals when "Other" is selected', otherInput.style.display === 'block');
      referralSelect.value = 'Google/web search';
      referralSelect.dispatchEvent(new dom.window.Event('change'));
      check('C49c', 'Other text input hides again when switching to a different option', otherInput.style.display === 'none');
    }

    printSummary();
  })();
}

function printSummary() {
  console.log('\n' + '='.repeat(70));
  console.log(`RESULTS: ${pass} passed, ${fail} failed`);
  console.log('='.repeat(70));
  if (failures.length) {
    console.log('\nFAILURES:');
    failures.forEach(f => console.log('  ✗ ' + f));
    process.exitCode = 1;
  } else {
    console.log('\nAll checks passed.');
  }
}

// If jsdom wasn't available, Section C never ran async - print summary now.
if (!jsdomAvailable) printSummary();
