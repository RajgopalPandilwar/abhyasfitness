/* Build a standalone, offline-capable copy of the site.
   Run: node tools/build-standalone.js
   Output: dist/abhyasfitness-standalone.html

   Everything — CSS, JS, the QR library, fonts (as base64), the share
   image — is inlined into one file. Open it with no internet, no server
   and no GitHub. The UPI checkout still works, because a UPI intent link
   is just a URL the phone handles.
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const TMP = process.env.TMPDIR || '/tmp';

// Name the file after the brand, so it never ships saying "Abhyas"
// when the brand is something else.
function brandSlug() {
  const cfg = fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8');
  const m = cfg.match(/name:\s*'([^']+)'/);
  const name = (m && m[1]) || 'standalone';
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
let OUT = path.join(DIST, 'standalone.html');

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

function b64(p) { return fs.readFileSync(p).toString('base64'); }

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

async function main() {

// ---- 1. Base HTML, with external refs stripped -------------------
let html = read('index.html');

// Point every local <script src> at an inline block we fill in below.
const scripts = {
  'qrcode.min.js': read('qrcode.min.js'),
  'config.js': read('config.js'),
  'upi.js': read('upi.js'),
  'checkout.js': read('checkout.js'),
};
for (const name of Object.keys(scripts)) {
  html = html.replace(
    new RegExp('<script src="' + name.replace('.', '\\.') + '"></script>'),
    '<!--' + name + '-->\n<script>/* ' + name + ' */\n' + scripts[name] + '\n</script>'
  );
}

// ---- 2. Inline the share image as a data URI ---------------------
const ogB64 = b64(path.join(ROOT, 'og-image.png'));
html = html.split('og-image.png').join('data:image/png;base64,' + ogB64);

// Favicon too, so the tab icon works offline.
const favB64 = b64(path.join(ROOT, 'favicon.png'));
html = html.replace(
  /<link rel="icon" href="favicon\.ico" sizes="any" \/>/,
  '<link rel="icon" href="data:image/png;base64,' + favB64 + '" type="image/png" />'
);
html = html.replace(
  /<link rel="icon" href="favicon\.png" type="image\/png" \/>/,
  '<link rel="icon" href="data:image/png;base64,' + favB64 + '" type="image/png" />'
);
html = html.replace(
  /<link rel="apple-touch-icon" href="favicon\.png" \/>/,
  '<link rel="apple-touch-icon" href="data:image/png;base64,' + favB64 + '" />'
);

// The post-purchase page is a separate file on the hosted site. In a
// single-file copy it would 404, so inline it as a data: document the
// buyer can open in a new tab.
if (fs.existsSync(path.join(ROOT, 'thank-you.html'))) {
  let ty = fs.readFileSync(path.join(ROOT, 'thank-you.html'), 'utf8');
  // Recurse: the thank-you page also inlines the favicon and config.
  ty = ty
    .replace(/<link rel="icon" href="favicon\.ico" sizes="any" \/>/, '')
    .replace(/<link rel="icon" href="favicon\.png" type="image\/png" \/>/,
      '<link rel="icon" href="data:image/png;base64,' + favB64 + '" type="image/png" />');
  ty = ty.replace(
    /<script src="config\.js"><\/script>/,
    '<script>/* config.js */\n' + read('config.js') + '\n</script>'
  );

  // "Back to Programs" must not point at index.html — that file does not
  // exist next to a one-file copy. Send them to the online site instead,
  // which is where a real buyer's link lives anyway.
  ty = ty.split('href="index.html"').join(
    'href="https://rajgopalpandilwar.github.io/abhyasfitness/"'
  );

  // Wrap in a data URI that a browser will open as a document.
  const tyUri = 'data:text/html;charset=utf-8;base64,' +
    Buffer.from(ty, 'utf8').toString('base64');
  html = html.split("'thank-you.html'").join("'" + tyUri + "'");
}

// ---- 3. Embed the fonts as base64 --------------------------------
// The standalone copy must look identical offline, so the woff2 files
// are inlined and the Google Fonts <link> is dropped.
const fontCss = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap';
const cssPath = path.join(TMP, 'kf-fonts.css');
let fontsInlined = false;

if (fs.existsSync(cssPath)) {
  let css = fs.readFileSync(cssPath, 'utf8');
  // Pull each woff2 down and swap the src for a data URI.
  const urls = [...new Set((css.match(/https:\/\/[^)]+\.woff2/g) || []))];
  let allOk = true;
  const map = {};
  for (const u of urls) {
    const local = path.join(TMP, 'f_' + path.basename(u));
    try {
      await download(u, local);
    } catch (err) {
      console.warn('  font fetch failed: ' + err.message);
      allOk = false;
      break;
    }
    map[u] = 'data:font/woff2;base64,' + b64(local);
  }
  if (allOk) {
    for (const [u, data] of Object.entries(map)) css = css.split(u).join(data);
    html = html.replace(
      /<link href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*"/,
      '<style>/* fonts inlined */\n' + css + '\n</style>'
    );
    fontsInlined = true;
  }
}

if (!fontsInlined) {
  // Offline without font files: keep the Google link, but add local
  // fallbacks in the font stacks so the page still reads correctly.
  console.warn('WARN: font CSS not cached at ' + cssPath + ' — falling back to system fonts.');
  html = html.replace(
    /<link href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*"/,
    ''
  );
}

// ---- 4. Mark it as the offline copy ------------------------------
html = html.replace(
  '</title>',
  '</title>\n<!-- Standalone offline copy. Generated by tools/build-standalone.js. Do not edit this file directly — edit the source and rebuild. -->'
);

// ---- 5. Sanity checks before writing -----------------------------
const problems = [];
if (/<script src="/.test(html)) {
  problems.push('unresolved <script src>: ' +
    (html.match(/<script src="[^"]*"/g) || []).join(', '));
}
if (html.includes('cdn.jsdelivr.net')) problems.push('still references the CDN');
if (html.includes('href="config.js"')) problems.push('still references config.js');
if (html.includes("'thank-you.html'")) problems.push('thank-you.html not inlined');
if (!html.includes('rajgopal.pandilwar@fam')) problems.push('UPI ID missing');
if (!html.includes('QRCode')) problems.push('QR library missing');

// Any remaining reference to a sibling file would 404 in a one-file
// copy, which is the whole point of this build.
const dangling = [...new Set(
  [...html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)].map(m => m[1])
    .filter(u => !u.startsWith('http') && !u.startsWith('mailto') && !u.startsWith('data:'))
)];
if (dangling.length) {
  problems.push('references sibling files that will not exist: ' + dangling.join(', '));
}
// Names owned by other live fitness businesses. Their presence means a
// rebrand was missed somewhere in the source. The design-system
// reference is an external URL that merely looks like a brand, so it is
// excluded before testing.
const brandScan = html.split('gitreverse.com/designs/fitforge-com').join('');
if (/kailie|fitforge/i.test(brandScan)) {
  problems.push('borrowed brand name still present');
}

if (problems.length) {
  console.error('BUILD FAILED:');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

OUT = path.join(DIST, brandSlug() + '-standalone.html');

// Remove the previous build so dist never holds a stale copy under an
// old brand name.
for (const f of fs.readdirSync(DIST)) {
  if (f.endsWith('-standalone.html') && path.join(DIST, f) !== OUT) {
    fs.unlinkSync(path.join(DIST, f));
    console.log('removed stale build: ' + f);
  }
}

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log('wrote ' + OUT);
console.log('  ' + kb + ' KB, fonts inlined: ' + fontsInlined);
console.log('  external requests: ' +
  ((html.match(/(?:src|href)="https?:\/\/[^"]*"/g) || [])
    .filter(u => !u.includes('fonts.googleapis') && !u.includes('schema.org'))
    .join(', ') || 'none'));

}

main().catch(err => {
  console.error('BUILD FAILED: ' + err.message);
  process.exit(1);
});
