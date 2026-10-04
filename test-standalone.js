/* Verify the standalone copy is genuinely complete and usable offline.
   Run: node test-standalone.js */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = __dirname;

// The build names its output after the brand in config.js, so derive the
// filename the same way instead of hardcoding it — a hardcoded slug here
// silently breaks the test after any rebrand.
function brandSlug() {
  const cfg = fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8');
  const m = cfg.match(/name:\s*'([^']+)'/);
  const name = (m && m[1]) || 'standalone';
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
const FILE = path.join(ROOT, 'dist', brandSlug() + '-standalone.html');

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label.padEnd(38) + '-> ' + actual +
    (ok ? '' : '   (expected ' + expected + ')'));
}

if (!fs.existsSync(FILE)) {
  console.error('No standalone build at ' + FILE);
  console.error('Build it first:  node tools/build-standalone.js');
  process.exit(1);
}

const html = fs.readFileSync(FILE, 'utf8');
console.log('\n=== size ===');
console.log('  ' + (Buffer.byteLength(html) / 1024 / 1024).toFixed(2) + ' MB, one file');

console.log('\n=== self-contained (nothing to fetch) ===');
const fetches = (html.match(/(?:src|href)="https?:\/\/[^"]*"/g) || [])
  .filter(u => /<script|rel="stylesheet"/.test(u) || u.startsWith('src="http'));
check('no remote script/css fetches', fetches.length, 0);
check('no CDN references', /cdn\.jsdelivr|unpkg\.com/.test(html), false);
check('fonts inlined as base64', (html.match(/data:font\/woff2;base64/g) || []).length > 0, true);
check('QR lib inlined', html.includes('var QRCode'), true);
check('og image inlined', html.includes('data:image/png;base64'), true);

console.log('\n=== content completeness ===');
check('5 buy buttons', (html.match(/data-program=/g) || []).length, 5);
for (const n of ['Fat Loss Blueprint', 'Muscle Building', 'At Home Training',
                 'Athlete Performance', 'Complete Bundle']) {
  check('program: ' + n, html.includes('"' + n + '"') || html.includes("'" + n + "'"), true);
}
check('faq present', (html.match(/class="faq__item"/g) || []).length, 5);
check('features present', (html.match(/class="feature"/g) || []).length, 6);
check('modal present', html.includes('id="upiModal"'), true);
check('ref form present', html.includes('id="upiRefForm"'), true);

console.log('\n=== live behaviour, network blocked ===');
let outbound = 0;
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'file:///standalone-check.html',
  beforeParse(w) {
    // Hard-block anything that would reach the network.
    const realFetch = w.fetch;
    w.fetch = function () { outbound++; return Promise.reject(new Error('blocked')); };
    w.XMLHttpRequest = function () { outbound++; throw new Error('blocked'); };
  },
});
const w = dom.window, d = w.document;

setTimeout(() => {
  check('zero outbound requests', outbound, 0);
  check('config loaded', !!(w.KF_CONFIG && w.KF_CONFIG.payment), true);
  check('UPI id present', w.KF_CONFIG.payment.upiId, 'rajgopal.pandilwar@fam');
  check('UPI module enabled', w.KF_UPI.enabled, true);
  check('QR library available', typeof w.QRCode, 'function');
  check('payee name set', !!w.KF_CONFIG.payment.payeeName, true);

  console.log('\n=== buying, with the network still blocked ===');
  const btn = d.querySelector('[data-program="Complete Bundle"]');
  btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  const modal = d.getElementById('upiModal');
  check('modal opened', modal.classList.contains('is-open'), true);
  check('amount shown', d.getElementById('upiAmount').textContent, '₹5,999');

  const href = d.getElementById('upiOpenApp').getAttribute('href');
  const q = new URLSearchParams(href.split('?')[1]);
  check('pay link scheme', href.split(':')[0], 'upi');
  check('pay link payee', q.get('pa'), 'rajgopal.pandilwar@fam');
  check('pay link amount', q.get('am'), '5999.00');
  check('pay link currency', q.get('cu'), 'INR');
  check('pay link has trace ref', !!q.get('tr'), true);

  const qr = d.getElementById('upiQr').querySelectorAll('table, img');
  check('QR rendered offline', qr.length > 0, true);

  console.log('\n=== every program, offline ===');
  for (const b of d.querySelectorAll('[data-program]')) {
    const name = b.getAttribute('data-program');
    w.KF_UPI.close();
    b.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
    const amt = new URLSearchParams(
      d.getElementById('upiOpenApp').getAttribute('href').split('?')[1]).get('am');
    const expected = w.KF_UPI.cleanAmount(w.KF_CONFIG.programs[name].price);
    check(name, amt, expected);
  }
  w.KF_UPI.close();

  console.log('\n=== brand safety ===');
  // These are names that belong to other live fitness businesses. If one
  // appears in the shipped page, a rebrand was missed somewhere. The
  // design-system reference is an external URL that merely looks like a
  // brand, so it is excluded before testing.
  const brandScan = html.split('gitreverse.com/designs/fitforge-com').join('');
  check('no borrowed brand name (kailie)',
    /kailie/i.test(brandScan), false);
  check('no borrowed brand name (fitforge)',
    /fitforge/i.test(brandScan), false);
  check('no placeholder brand left', brandScan.includes('YOUR BRAND NAME'), false);

  console.log('\n=== wordmark is not doubled ===');
  // A one-word brand must not render as "AbhyasAbhyas". This bug
  // shipped once already, so it is checked explicitly.
  {
    const { JSDOM: JD } = require('jsdom');
    const d2 = new JD(html).window.document;
    const logos = [...d2.querySelectorAll('.logo')];
    check('logo elements found', logos.length > 0, true);
    for (const lg of logos) {
      const txt = lg.textContent.replace(/\s+/g, '');
      // Derive the brand from the page title rather than hardcoding it, so
      // this still works after a rename.
      const title = (d2.querySelector('title') || {}).textContent || '';
      const brand = title.split('—')[0].trim();
      check('wordmark "' + txt + '" not doubled',
        txt === brand.replace(/\s+/g, ''), true);
      check('wordmark has no empty gold span',
        lg.querySelector('span') === null || lg.querySelector('span').textContent.length > 0,
        true);
    }
  }

  console.log('\n=== post-purchase page is inside the single file ===');
  const tyUri = (w.KF_CONFIG && w.KF_CONFIG.thankYouUrl) || '';
  check('thankYouUrl is a data: doc', tyUri.startsWith('data:text/html'), true);
  if (tyUri.startsWith('data:text/html')) {
    const tyHtml = Buffer.from(tyUri.split('base64,')[1], 'base64').toString('utf8');
    check('thank-you page intact', tyHtml.includes("You're In."), true);
    check('thank-you has 3 steps', (tyHtml.match(/class="step"/g) || []).length, 3);
    check('thank-you has no OWNER note', !/OWNER ACTION/.test(tyHtml), true);
    check('thank-you contact wired', tyHtml.includes('pandilwarajgopal@gmail.com'), true);
    check('thank-you no sibling refs',
      [...tyHtml.matchAll(/(?:href|src)="([^"#][^"]*)"/g)].map(m => m[1])
        .filter(u => !u.startsWith('http') && !u.startsWith('mailto') && !u.startsWith('data:')).length,
      0);
  }

  console.log('\n' + (fail === 0
    ? 'STANDALONE COPY USABLE — all ' + pass + ' checks passed'
    : pass + ' passed, ' + fail + ' FAILED'));
  process.exit(fail === 0 ? 0 : 1);
}, 700);
