// Recruitment dashboard engine: turns the raw sources into the aggregates the page shows.
// Same rules as the claude.ai dashboard. No names, emails or phone numbers leave this file.
const RANK = {Hired: 4, Offered: 3, Interview: 2, Qualified: 1, Rejected: 0};
const MONTHS = {january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12};
const USD_TO_AED = 3.6725, CAMPAIGN_START = '2026-08-01';
const pad = (n) => String(n).padStart(2, '0');
const isQ = (s) => ['Qualified', 'Interview', 'Offered', 'Hired'].includes(s);
const isI = (s) => ['Interview', 'Offered', 'Hired'].includes(s);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDay = (iso) => { const d = new Date(iso + 'T00:00:00Z'); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; };
const monday = (iso) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); };
const parseSheetDate = (s) => { const m = /^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})/.exec(String(s || '').trim()); if (!m || !MONTHS[m[1].toLowerCase()]) return ''; return m[3] + '-' + pad(MONTHS[m[1].toLowerCase()]) + '-' + pad(m[2]); };
const isoWeekMonday = (yw) => { const m = /^(\d{4})\|(\d{1,2})$/.exec(String(yw || '')); if (!m) return ''; const y = +m[1], w = +m[2]; const j = new Date(Date.UTC(y, 0, 4)); j.setUTCDate(j.getUTCDate() - ((j.getUTCDay() + 6) % 7) + (w - 1) * 7); return j.toISOString().slice(0, 10); };

function pillarOfAd(ad) { const a = (ad || '').toLowerCase();
  if (a.includes('tools')) return 'Tools'; if (a.includes('next-step') || a.includes('next_step')) return 'Next Step'; if (a.includes('pitch')) return 'Bigger Pitch'; if (a.includes('box')) return 'Box'; if (a.includes('hero')) return 'Hero video'; if (a.includes('diana') || a.includes('oli') || a.includes('nada')) return 'People videos'; if (a.includes('halloween')) return 'Halloween'; return ''; }
function sourceOf(src, camp) { const s = (src || '').toLowerCase(), c = camp || '';
  if (['facebook', 'instagram', 'ig'].includes(s) || c.startsWith('Bh-Recruitment')) return 'Meta ads';
  if (s.includes('chatgpt') || s.includes('gemini')) return 'AI search (ChatGPT, Gemini)';
  if (s === 'google' || s === 'adwords' || c.startsWith('GGL')) return 'Google ads';
  if (s.includes('linkedin')) return 'LinkedIn';
  if (s) return 'Other tagged'; return 'Untagged (organic, direct, referral)'; }

// Supermetrics compact table ("[n]{a,b,c}:\n  x,y,z") -> rows
function smRows(raw) { let j = raw; if (typeof j === 'string') { try { j = JSON.parse(j); } catch (e) {} } if (Array.isArray(j)) j = JSON.parse(j[0].text);
  const d = j && j.data ? j.data : j; const t = typeof d.data === 'string' ? d.data : d; const lines = String(t).split('\n'); const cols = /\{(.*)\}/.exec(lines[0])[1].split(',');
  return lines.slice(1).map((l) => l.trim()).filter(Boolean).map((l) => { const v = l.split(','); const r = {}; r[cols[0]] = v[0]; r[cols[1]] = v.slice(1, v.length - 1).join(','); r[cols[2]] = Number(v[v.length - 1]) || 0; return r; }); }
// PostHog pipe table -> rows
function phRows(txt) { const lines = String(txt).trim().split('\n').filter((l) => l.includes('|')); const cols = lines[0].split('|').map((s) => s.trim());
  return lines.slice(1).map((l) => { const v = l.split('|'); const r = {}; cols.forEach((c, i) => { const x = (v[i] || '').trim(); r[c] = /^-?\d+(\.\d+)?$/.test(x) ? Number(x) : x; }); return r; }); }
const vals = (x) => { let j = x; if (typeof j === 'string') j = JSON.parse(j); return j.values || j; };

function build(inp) {
  const A = vals(inp.sheetA), CD = vals(inp.sheetCD), GN = vals(inp.sheetGN);
  // unique applicants
  const people = new Map();
  GN.forEach((v, i) => { v = v || []; const c = CD[i] || [], dt = parseSheetDate((A[i] || [])[0]);
    const g = (k) => (v[k] != null ? String(v[k]).trim() : '');
    const role = g(0), src = g(1), camp = g(2), ad = g(3), stageRaw = g(6), status = g(7);
    const email = String(c[0] || '').trim().toLowerCase(), phone = String(c[1] || '').replace(/\D/g, '').slice(-9);
    if (!email && !phone && !stageRaw && !role) return;
    const key = email || phone || ('row' + i), stage = RANK[stageRaw] !== undefined ? stageRaw : (stageRaw || 'Not set');
    const p = people.get(key);
    if (!p) { let pil = pillarOfAd(ad); if (!pil && (['facebook', 'instagram', 'ig'].includes(src.toLowerCase()) || camp.startsWith('Bh-Recruitment'))) pil = 'Meta, ad not tagged';
      people.set(key, {first_date: dt, pillar: pil, source: sourceOf(src, camp), stage, status: status || 'Not set'}); return; }
    if (!p.first_date && dt) p.first_date = dt;
    if ((RANK[stage] ?? -1) > (RANK[p.stage] ?? -1)) { p.stage = stage; p.status = status || p.status; } });
  const apps = Array.from(people.values());
  // spend
  const spend = [];
  smRows(inp.meta).forEach((r) => spend.push({date: isoWeekMonday(r.Yearweekiso), channel: 'Meta', ad: r.ad_name, cost: r.cost}));
  smRows(inp.google).forEach((r) => { const dt = r.date || isoWeekMonday(r.Yearweekiso); if (dt >= CAMPAIGN_START || (r.Yearweekiso && isoWeekMonday(r.Yearweekiso) >= '2026-07-27')) spend.push({date: dt, channel: 'Google', ad: r.Campaignname, cost: r.Cost}); });
  smRows(inp.linkedin).forEach((r) => { const dt = r.date || isoWeekMonday(r.yearWeekIso); if (dt >= CAMPAIGN_START) spend.push({date: dt, channel: 'LinkedIn', ad: r.campaignName, cost: r.spend * USD_TO_AED}); });
  const sum = (a, f) => a.reduce((s, r) => s + f(r), 0);
  const ch = (c) => Math.round(sum(spend.filter((s) => s.channel === c), (s) => s.cost));
  const paidQ = apps.filter((a) => ['Meta ads', 'Google ads', 'LinkedIn'].includes(a.source) && isQ(a.stage)).length;
  const paid = Math.round(sum(spend, (s) => s.cost));
  const n = apps.length, q = apps.filter((a) => isQ(a.stage)).length;
  const kpis = {applications: n, qualified_plus: q, qual_rate: n ? q / n : 0, interview_plus: apps.filter((a) => isI(a.stage)).length,
    offered_plus: apps.filter((a) => ['Offered', 'Hired'].includes(a.stage)).length, hired: apps.filter((a) => a.stage === 'Hired').length,
    open_leads: apps.filter((a) => a.status === 'Open').length, meta_spend: ch('Meta'), google_spend: ch('Google'), linkedin_spend: ch('LinkedIn'),
    paid_spend: paid, paid_qualified: paidQ, cost_per_qualified_paid: paidQ ? Math.round(paid / paidQ) : null};
  const stages = ['Rejected', 'Qualified', 'Interview', 'Offered', 'Hired', 'Not set'].map((s) => { const g = apps.filter((a) => a.stage === s); return {stage: s, open: g.filter((a) => a.status === 'Open').length, closed: g.filter((a) => a.status !== 'Open').length, total: g.length}; }).filter((r) => r.total > 0);
  // weekly
  const W = new Map(); const gw = (w) => { if (!W.has(w)) W.set(w, {week: w, applications: 0, qualified_plus: 0, meta_spend: 0, google_spend: 0, linkedin_spend: 0}); return W.get(w); };
  apps.forEach((a) => { if (!a.first_date) return; const r = gw(monday(a.first_date)); r.applications++; if (isQ(a.stage)) r.qualified_plus++; });
  spend.forEach((s) => { if (!s.date) return; gw(monday(s.date))[s.channel === 'Google' ? 'google_spend' : s.channel === 'LinkedIn' ? 'linkedin_spend' : 'meta_spend'] += s.cost; });
  const weekly = Array.from(W.values()).map((r) => Object.assign(r, {meta_spend: Math.round(r.meta_spend), google_spend: Math.round(r.google_spend), linkedin_spend: Math.round(r.linkedin_spend)})).sort((a, b) => a.week < b.week ? -1 : 1);
  // sources
  const spendOf = {'Meta ads': 'Meta', 'Google ads': 'Google', 'LinkedIn': 'LinkedIn'};
  const S = new Map(); apps.forEach((a) => { if (!S.has(a.source)) S.set(a.source, {source: a.source, applications: 0, qualified_plus: 0, interview_plus: 0, hired: 0}); const r = S.get(a.source); r.applications++; if (isQ(a.stage)) r.qualified_plus++; if (isI(a.stage)) r.interview_plus++; if (a.stage === 'Hired') r.hired++; });
  const sources = Array.from(S.values()).map((r) => { const sp = spendOf[r.source] ? ch(spendOf[r.source]) : null; return Object.assign(r, {qual_rate: r.applications ? r.qualified_plus / r.applications : 0, spend: sp, cost_per_qualified: sp != null && r.qualified_plus ? Math.round(sp / r.qualified_plus) : null}); }).sort((a, b) => b.applications - a.applications);
  // pillars
  const P = new Map(); const gp = (p) => { if (!P.has(p)) P.set(p, {pillar: p, first: '', last: '', spend: 0, applications: 0, qualified_plus: 0, interview_plus: 0, hired: 0}); return P.get(p); };
  spend.filter((s) => s.channel === 'Meta').forEach((s) => { const r = gp(pillarOfAd(s.ad) || 'Other ads'); r.spend += s.cost; if (s.date && s.cost > 1) { if (!r.first || s.date < r.first) r.first = s.date; if (!r.last || s.date > r.last) r.last = s.date; } });
  apps.forEach((a) => { if (!a.pillar) return; const r = gp(a.pillar); r.applications++; if (isQ(a.stage)) r.qualified_plus++; if (isI(a.stage)) r.interview_plus++; if (a.stage === 'Hired') r.hired++; });
  const pillars = Array.from(P.values()).filter((r) => r.applications > 0 || r.spend > 50).map((r) => ({pillar: r.pillar, live: r.first ? fmtDay(r.first) + ' – ' + fmtDay(r.last) : 'No ad tag', first: r.first, spend: Math.round(r.spend), applications: r.applications, qualified_plus: r.qualified_plus, qual_rate: r.applications ? r.qualified_plus / r.applications : null, cost_per_qualified: r.qualified_plus && r.spend ? Math.round(r.spend / r.qualified_plus) : null, interview_plus: r.interview_plus, hired: r.hired})).sort((a, b) => (b.first || '') < (a.first || '') ? -1 : 1);
  // CRO periods
  const dated = apps.filter((a) => a.first_date); const last = dated.reduce((m, a) => a.first_date > m ? a.first_date : m, '');
  const days = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5) + 1;
  const cro_periods = [{period: 'Next Step section, old form', from: '2026-09-30', to: '2026-10-21'}, {period: 'Tools section, old form', from: '2026-10-22', to: '2026-11-03'}, {period: 'Tools section + Apply in 1 min + new form', from: '2026-11-04', to: last}]
    .filter((p) => p.to >= p.from).map((p) => { const g = dated.filter((a) => a.first_date >= p.from && a.first_date <= p.to), d = days(p.from, p.to), qq = g.filter((a) => isQ(a.stage)).length;
      return {period: p.period, dates: fmtDay(p.from) + ' – ' + fmtDay(p.to), applications: g.length, apps_per_day: g.length / d, qualified_plus: qq, qualified_per_day: qq / d, qual_rate: g.length ? qq / g.length : 0, still_open: g.filter((a) => a.status === 'Open').length}; });
  // sheet rows per week vs PostHog
  const rowsPerWeek = new Map(); A.forEach((v) => { const d = parseSheetDate((v || [])[0]); if (!d) return; const w = monday(d); rowsPerWeek.set(w, (rowsPerWeek.get(w) || 0) + 1); });
  const cro_weekly = phRows(inp.phWeekly).map((r) => { const w = String(r.week_start).slice(0, 10), s = rowsPerWeek.get(w) || 0, t = Number(r.tracked_submissions) || 0; return {week: w, sheet_applications: s, tracked_submissions: t, tracked_share: s ? t / s : null}; }).filter((r) => r.week >= '2026-10-05');
  const f = phRows(inp.phNewform)[0] || {};
  const form_funnel = [['Clicked Apply in 1 min', f.clicked_apply_in_1_min], ['Opened the new form', f.opened_new_form], ['Pressed Continue', f.pressed_continue], ['Picked a role', f.picked_role], ['Chose a CV file', f.chose_cv], ['Submitted (clicked Apply now after the CV)', f.submitted_via_sticky]].map(([step, people]) => ({step, people: Number(people) || 0})).concat([{step: 'Old form: submissions PostHog recorded', people: Number(f.old_form_tracked_submits) || 0, group: 'old'}, {step: 'Old form: landed directly on the form (Ready for your next move)', people: Number(f.submitted_ready_section) || 0, group: 'old'}]);
  return {asof: new Date().toISOString(), kpis, stages, weekly, sources, pillars, cro_periods, cro_weekly, form_funnel};
}
module.exports = {build};
