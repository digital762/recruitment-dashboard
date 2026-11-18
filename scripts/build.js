// Usage: node scripts/build.js <inputs dir> [out=data.json]
// Inputs dir holds: sheetA.json, sheetCD.json, sheetGN.json (Google Sheets get_values results),
// meta.json, google.json, linkedin.json (Supermetrics data_query results), ph_weekly.txt, ph_newform.txt (PostHog execute-sql tables).
const fs = require('fs'), path = require('path'), E = require('../engine.js');
const dir = process.argv[2], out = process.argv[3] || path.join(__dirname, '..', 'data.json');
const rd = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
const o = E.build({sheetA: rd('sheetA.json'), sheetCD: rd('sheetCD.json'), sheetGN: rd('sheetGN.json'), meta: rd('meta.json'), google: rd('google.json'), linkedin: rd('linkedin.json'), phWeekly: rd('ph_weekly.txt'), phNewform: rd('ph_newform.txt')});
let prev = null; try { prev = JSON.parse(fs.readFileSync(out, 'utf8')); } catch (e) {}
if (prev && prev.kpis && o.kpis.applications < prev.kpis.applications) { console.error('Refusing to write: ' + o.kpis.applications + ' applicants < previous ' + prev.kpis.applications); process.exit(2); }
fs.writeFileSync(out, JSON.stringify(o, null, 1));
console.log(o.kpis.applications + ' applicants, ' + o.kpis.qualified_plus + ' qualified+, ' + o.kpis.hired + ' hired, paid spend AED ' + o.kpis.paid_spend);
