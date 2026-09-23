// اجرا: node scripts/update.mjs  (نیاز به Node 18 یا بالاتر، بدون پکیج اضافه)
import fs from 'node:fs';
const sources = JSON.parse(fs.readFileSync('data/sources.json', 'utf8'));
const manual = JSON.parse(fs.readFileSync('data/manual.json', 'utf8'));
const KEY = /scholarship|fellowship|bursary|stipend|funded|بورسیه/i;
const MAX = 150;
const strip = s => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&#8217;|&#8216;/g, "'").replace(/&#8211;/g, '-').replace(/\s+/g, ' ').trim();
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, 'i')); return m ? strip(m[1]) : ''; };
const COUNTRIES = { Turkey:'ترکیه', Germany:'آلمان', UK:'بریتانیا', 'United Kingdom':'بریتانیا', USA:'امریکا', 'United States':'امریکا',
  China:'چین', Japan:'جاپان', Korea:'کوریا', Hungary:'هنگری', Canada:'کانادا', Australia:'آسترالیا', Italy:'ایتالیا', Sweden:'سویډن',
  Netherlands:'هالند', France:'فرانسه', Malaysia:'مالیزیا', India:'هند', Europe:'اروپا' };
function level(t) {
  const l = [];
  if (/bachelor|undergrad|لیسانس/i.test(t)) l.push('لیسانس');
  if (/master|msc|\bMA\b|ماستر/i.test(t)) l.push('ماستر');
  if (/phd|doctora|دکترا/i.test(t)) l.push('دکترا');
  return l.join('، ');
}
function country(t) { for (const k in COUNTRIES) if (new RegExp('\\b' + k + '\\b', 'i').test(t)) return COUNTRIES[k]; return ''; }
function parse(xml, src) {
  const items = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || [];
  return items.map(i => {
    let u = tag(i, 'link');
    if (!u) { const m = i.match(/<link[^>]*href="([^"]+)"/i); u = m ? m[1] : ''; }
    const raw = tag(i, 'pubDate') || tag(i, 'updated') || tag(i, 'published');
    const dt = raw ? new Date(raw) : null;
    const title = tag(i, 'title');
    const text = title + ' ' + tag(i, 'description') + ' ' + tag(i, 'category');
    return { n: title, u, d: dt && !isNaN(dt) ? dt.toISOString().slice(0, 10) : '', s: src.name,
             c: country(title), l: level(text), _t: text };
  });
}
const auto = [];
for (const src of sources) {
  try {
    const r = await fetch(src.feed, { headers: { 'User-Agent': 'OpportunityHubBot/1.0' }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const items = parse(await r.text(), src).filter(x => x.n && x.u && KEY.test(x._t));
    console.log(src.name, '->', items.length, 'items');
    auto.push(...items);
  } catch (e) { console.error('خطا در', src.name, e.message); }
}
auto.sort((a, b) => b.d.localeCompare(a.d));
const seen = new Set(), out = [];
for (const x of [...manual, ...auto]) {
  if (seen.has(x.u)) continue; seen.add(x.u);
  delete x._t; out.push(x);
  if (out.length >= MAX + manual.length) break;
}
if (auto.length === 0 && fs.existsSync('public/scholarships.json') && JSON.parse(fs.readFileSync('public/scholarships.json','utf8')).items.length > manual.length) {
  console.log('هیچ فید کار نکرد؛ فایل قبلی حفظ شد.'); process.exit(0);
}
fs.writeFileSync('public/scholarships.json', JSON.stringify({ updated: new Date().toISOString(), items: out }, null, 1));
console.log('نوشته شد:', out.length, 'مورد');
