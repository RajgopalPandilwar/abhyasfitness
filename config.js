/* ============================================================
   CHECKOUT CONFIG
   ------------------------------------------------------------
   This is the ONLY file you need to edit to go live.

   STEP 1 — Set your BRAND NAME below. It replaces the name
            everywhere on the site (header, footer, titles,
            QR payee, social share image) via tools/set-brand.js.
   STEP 2 — Set your UPI ID. UPI needs no merchant account,
            no KYC and no monthly fee.

   Everything else on the site reads from this file.
   ============================================================ */

window.KF_CONFIG = {
  // ---- BRAND ------------------------------------------------------
  // Your business name. Do NOT reuse an existing fitness brand's
  // name — the previous two names used here each collided with a live
  // business and had to be replaced. Run tools/set-brand.js rather than
  // editing this by hand: it rewrites every file at once and refuses
  // names already in use.
  brand: {
    name: 'Abhyas',
    // Optional: word shown in the logo after the accent colour.
    // Defaults to whatever follows the space in `name`.
  },

  // Where buyers reach you. Used by the help section and order receipts.
  supportEmail: 'pandilwarajgopal@gmail.com',

  // ---- PAYMENT METHOD --------------------------------------------
  // 'upi'  = UPI deep links + QR code only (recommended, zero cost)
  // 'both' = UPI primary, with a card gateway as fallback
  payment: {
    method: 'upi',

    // Your UPI ID. Find it in your bank or UPI app under your profile.
    // Examples: yourname@okhdfcbank, yourname@okaxis, yourname@oksbi
    upiId: 'rajgopal.pandilwar@fam',

    // Name shown in the payer's UPI app. Set by set-brand.js to your
    // brand name, truncated if long.
    payeeName: 'Abhyas'
  },

  // ---- PRICES -----------------------------------------------------
  // THE ONLY PLACE PRICES ARE SET. This file drives the cards, the UPI
  // payment amounts and the bundle savings figure — changing a price
  // here updates all of them. (The HTML also carries a copy so the page
  // still looks right if JS is off; JS overwrites it on load.)
  //
  // Note: the Product price in the JSON-LD block in index.html is a
  // separate static value for search engines. If you change the bundle
  // price, update that "price" field too.
  //
  // A static page cannot verify that a payment landed — there is no
  // server. Delivery is manual: the buyer sends their UPI reference
  // number and you email the program. See README.md.

  programs: {
    'Fat Loss Blueprint':  { price: '₹2,499', was: '₹3,999' },
    'Muscle Building':     { price: '₹3,499', was: '₹5,499' },
    'At Home Training':    { price: '₹1,899', was: '₹2,999' },
    'Athlete Performance': { price: '₹2,899', was: '₹4,499' },
    'Complete Bundle':     { price: '₹5,999', was: '₹10,796' }
  },

  // ---- POST-PURCHASE DELIVERY -------------------------------------
  // Buyers get the download link by email once you verify their payment.
  // Point them here from that email.
  thankYouUrl: 'thank-you.html'
};
