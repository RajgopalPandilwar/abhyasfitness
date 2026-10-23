# Abhyas

Landing page + UPI checkout for Abhyas digital training programs.

**Live:** https://rajgopalpandilwar.github.io/abhyasfitness/
**Repo:** https://github.com/RajgopalPandilwar/abhyasfitness

## Cost

| Thing | Cost |
| --- | --- |
| Hosting (GitHub Pages) | Free, no card, no expiry |
| Payment collection (UPI) | Free — P2M transfers carry no fee |
| Delivery (email the PDF) | Free |

**Truly ₹0 to run.** The one real cost is your time: confirming each payment
and emailing the file, by hand.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The page. Markup + all CSS inline. |
| `config.js` | **The only file you edit.** UPI ID, prices, contact email. |
| `upi.js` | Builds `upi://` links, draws the QR, handles the modal. |
| `checkout.js` | Wires Buy Now buttons, nav, FAQ, toasts. |
| `thank-you.html` | Post-purchase page. |
| `test-amounts.js` | Price-parsing tests. |
| `test-modal.js` | DOM tests for the checkout modal. |

## Go live

1. **Set your UPI ID** in `config.js` → `payment.upiId`. Find it in your bank
   or UPI app under your profile. That's the only required step.
2. **Check the prices** in `config.js` — they must match `index.html`. The
   bundle "value" is the sum of the four solo prices.
3. **Push.** `git add -A && git commit -m "live" && git push`. Live in ~30s.

There is no merchant account, no KYC, no gateway signup.

## How payment works

Clicking **Buy Now** opens a modal with three ways to pay:

- **QR code** — works everywhere, including iPhone (scan with the Camera app)
- **Open UPI App** — `upi://` deep link, opens Google Pay / PhonePe / Paytm
  directly on Android
- **Your UPI ID** — copy it and pay in any app manually

The link is pre-filled with the program name, the amount, and a traceable
reference (`tr`) that shows in your bank statement, so you can match an order
to a buyer.

### Delivery is manual — read this

A static HTML page **cannot verify that a payment arrived**. There is no server,
so nothing on this site can check your bank account. Payment confirmation is on
you.

The modal handles this by asking the buyer to submit their UPI reference
number, which opens a pre-filled email to you. You then:

1. Check the amount landed in your bank app.
2. Email the buyer the download link.

That is the whole flow. It is fine for a handful of orders a day. If volume
grows, move to a payment gateway with a webhook (Razorpay, ~2% per txn) and
delivery can be automated.

## Tests

```
npm install --no-save jsdom qrcodejs
node test-amounts.js   # 23 checks — price parsing, bundle math, link shape
node test-modal.js     # 36 checks — modal open/populate/QR, all 5 buttons
```

Both exit non-zero on failure. `test-amounts.js` runs in plain Node;
`test-modal.js` needs jsdom.

## Editing prices

Prices live in two places that must agree: the `price` / `was` fields in
`config.js`, and the `.price__now` / `.price__was` spans in `index.html`. The
bundle's "value" figure is the sum of the four solo prices — currently
2,499 + 3,499 + 1,899 + 2,899 = 10,796, minus 5,999 = **4,797 saved**.

`cleanAmount()` in `upi.js` normalises whatever you type (`₹2,499`, `Rs. 2499`,
`2499.50`) into the bare decimal the UPI spec requires, and rejects anything
that isn't a usable number so a typo can't turn into a wrong charge.

## Offline arcade

Three files in the repo root give visitors four mini games (Runner, Snake,
Flappy, Breakout) instead of the browser's error page when they're offline, or
when a page takes more than 6 seconds to load:

- `arcade.js` — loaded in the `<head>` of `index.html` and `thank-you.html`
- `arcade-sw.js` — the service worker that decides when to show the games
- `arcade-offline.html` — the games page itself, self-contained and themed

From [offline-arcade](https://github.com/jagubuilds/offline-arcade) (MIT).

Two things to know:

- It only works for someone who has loaded the site online at least once —
  the browser has to save the games page first. There is no way around that.
- This is a project site, so everything lives under `/abhyasfitness/`. Every
  path starts with `BASE` in `arcade.js` and `arcade-sw.js`; change `BASE` in
  both files if the repo is ever renamed. Bump `VERSION` in `arcade-sw.js`
  after editing `arcade-offline.html`, or returning visitors keep the old copy.

The standalone build in `dist/` drops the arcade on purpose: a `file://` page
has no service worker.

## Hosting

GitHub Pages on the free plan: no bandwidth cap that matters at this scale, no
card required, no expiry. It stays up as long as the repo does. Custom domain:
add a CNAME file.

## Design system

Tokens follow the spec at <https://gitreverse.com/designs/fitforge-com>:

- `#CBAD62` gold accent · `#0A0A0A` jet black · `#9CA3AF` muted links
- Bebas Neue headings (96px hero, 60px sections) · Inter body (20px)
- 0px radius everywhere, flat fills, no shadows, gold borders for emphasis
- 4px spacing base unit
