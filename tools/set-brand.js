/* Rename the brand everywhere in one command.
   Run:  node tools/set-brand.js "Your Brand Name"

   Replaces the name in every file: HTML titles, logo, footer, meta
   tags, JSON-LD, robots.txt, sitemap.xml, the UPI payee name, the
   favicon letter, the social share image, and the README.

   Also refuses to set a name that is already someone else's live
   business — see BLOCKED below.
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Names that belong to other people. Do not ship these.
// Every entry here was checked against a real business in the fitness
// space, so a hit is a genuine collision rather than a guess. Add to
// this list whenever a name is found to be taken.
const BLOCKED = [
  'fitforge',        // fitforge.fit, fitforgediscipline.com, FitForge AI (Play Store)
  'fit forge',
  'kailiefitness',   // kailiefitness.com
  'kailie fitness',
  'kailie',          // the personal name inside it
  'ironpath',        // ironpathgym.com, tryironpath.com
  'liftwise',        // liftwise.de / liftwise.net
  'tonnage',         // traintonnage.com + several app stores
  'ironlark',        // ironlark.com
  'granite fitness', // granitefandp.com
  'kavach',          // kavachfit.in
];

const newName = (process.argv[2] || '').trim();

if (!newName) {
  console.error('Usage: node tools/set-brand.js "Your Brand Name"');
  process.exit(1);
}

const norm = newName.toLowerCase();
for (const b of BLOCKED) {
  if (norm.includes(b)) {
    console.error('REFUSING: "' + newName + '" contains "' + b + '".');
    console.error('That name belongs to an existing fitness business');
    console.error('(abhyasfitness.com). Pick your own name.');
    process.exit(1);
  }
}

// "Apex Fitness" -> logo "Apex" + gold "Fitness"
// "Abhyas"     -> logo "Abhyas" only. A one-word brand has no
// second half, and rendering it twice reads as a bug.
const words = newName.split(/\s+/).filter(Boolean);
const brandWord = words[0];
const twoWords = words.length > 1;
const accentWord = twoWords ? words[words.length - 1] : '';

// UPI payee names are shown in a phone app; keep them short.
const payee = newName.length <= 20 ? newName : words[0];

// A filesystem/URL-safe slug for a given name.
const slug = (s) => s.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');
const newSlug = slug(newName);

// The brand we are replacing, read from config.js. Deriving it beats
// hardcoding it: a stale literal here is exactly what let "Kailie"
// survive the FitForge rebrand untouched.
const cfgPath = path.join(ROOT, 'config.js');
const cfgSrc = fs.readFileSync(cfgPath, 'utf8');
const cfgMatch = cfgSrc.match(/name:\s*'([^']+)'/);
const oldName = cfgMatch ? cfgMatch[1] : '';
const oldSlug = oldName ? slug(oldName) : '';

// The design-system reference is an EXTERNAL url that happens to
// contain a brand-looking word. Shield it from replacement.
const DESIGN_URL = 'gitreverse.com/designs/fitforge-com';
const SENTINEL = '\u0000DESIGNURL\u0000';

const TARGETS = [
  'index.html',
  'thank-you.html',
  'config.js',
  'upi.js',
  'checkout.js',
  'robots.txt',
  'sitemap.xml',
  'README.md',
  'tools/make-images.py',
  'tools/build-standalone.js',
  'test-amounts.js',
  'test-modal.js',
  'test-standalone.js',
  'dist/' + oldSlug + '-standalone.html',
];

// Ordered so the longest form goes first: "KailieFitness" must be
// replaced before the bare "Kailie" that sits inside it.
function pairs() {
  if (!oldName) return [];
  const list = [
    [oldName, newName],
    [oldSlug, newSlug],
    [oldName.toUpperCase(), newName.toUpperCase()],
  ];
  return list.filter(([a, b]) => a && a !== b);
}

let changed = [];
for (const rel of TARGETS) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) continue;
  const before = fs.readFileSync(p, 'utf8');

  let after = before.split(DESIGN_URL).join(SENTINEL);
  for (const [a, b] of pairs()) {
    after = after.split(a).join(b);
  }
  after = after.split(SENTINEL).join(DESIGN_URL);

  // The logo markup: <span>Accent</span> after the brand word. A
  // one-word brand gets no span at all, so it never prints twice.
  const logoHtml = twoWords
    ? brandWord + '<span>' + accentWord + '</span>'
    : brandWord;
  after = after.replace(
    new RegExp(brandWord + '<span>[^<]*</span>', 'g'),
    logoHtml
  );
  // Also collapse an already-doubled wordmark from a previous run.
  after = after.replace(
    new RegExp(brandWord + brandWord, 'g'),
    brandWord
  );

  if (rel === 'config.js') {
    after = after.replace(
      /(payeeName:\s*)'[^']*'/,
      (m, p1) => p1 + "'" + payee + "'"
    );
  }

  if (after !== before) {
    fs.writeFileSync(p, after, 'utf8');
    changed.push(rel);
  }
}

// Keep the standalone build's filename in step with the slug.
const oldDist = path.join(ROOT, 'dist', oldSlug + '-standalone.html');
const newDist = path.join(ROOT, 'dist', newSlug + '-standalone.html');
if (oldName && fs.existsSync(oldDist) && oldDist !== newDist) {
  fs.renameSync(oldDist, newDist);
  changed.push('dist/' + newSlug + '-standalone.html (renamed)');
}

console.log('Brand set to: ' + newName);
console.log('  from   : ' + (oldName || '(none)'));
console.log('  logo   : ' + brandWord + ' / ' + accentWord);
console.log('  payee  : ' + payee);
console.log('  updated: ' + changed.join(', '));

// Remind about the pieces that live outside the repo.
console.log('\nNEXT STEPS');
console.log('  1. Regenerate images — they bake in the wordmark:');
console.log('       python tools/make-images.py');
console.log('  2. If the slug changed, rename the GitHub repo so the');
console.log('     canonical / og URLs match the new github.io path.');
console.log('  3. Push, then re-submit sitemap.xml in Search Console.');
