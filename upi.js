/* ============================================================
   ABHYAS — UPI PAYMENTS
   Builds upi:// deep links and renders a scannable UPI QR code.
   No backend, no fees, no account. See config.js for setup.
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.KF_CONFIG || {};
  var U = CFG.payment || {};
  var upiId = (U.upiId || '').trim();
  var payee = U.payeeName || 'Abhyas';
  var enabled = !!(U.method === 'upi' || U.method === 'both') && !!upiId;

  var seq = 0;

  // ---- UPI intent link -----------------------------------------
  // pa  = payee VPA (your UPI ID)      am = amount
  // pn  = payee name                    cu = currency
  // tn  = transaction note (shows in the payer's app)
  // tr  = our reference, so payments are traceable in your bank
  //
  // The UPI spec requires am to be a bare decimal number. Display
  // prices arrive as "₹2,499", "Rs. 2499" or "2,499.50", so pull out
  // the first real number and treat commas as thousands separators.
  // A naive non-numeric strip would read the "." in "Rs." as a
  // decimal point and bill ₹0.25.
  function cleanAmount(raw) {
    var text = String(raw).replace(/[₹$€£¥]/g, ' ');
    var m = text.match(/\d[\d,]*(?:\.\d{1,2})?/);
    if (!m) return null;
    var n = parseFloat(m[0].replace(/,/g, ''));
    if (!isFinite(n) || n <= 0) return null;
    return n.toFixed(2);
  }

  function buildLink(amount, program) {
    var value = cleanAmount(amount);
    if (!value) {
      if (window.KFToast) {
        window.KFToast('Could not read the price — check config.js');
      }
      return null;
    }
    var p = new URLSearchParams();
    p.set('pa', upiId);
    p.set('pn', payee);
    p.set('cu', 'INR');
    p.set('am', value);
    p.set('tn', 'Abhyas - ' + program);
    p.set('tr', ref());
    return 'upi://pay?' + p.toString();
  }

  function ref() {
    seq += 1;
    return 'KFL' + Date.now().toString(36).slice(-5).toUpperCase() + seq;
  }

  // ---- DOM ------------------------------------------------------
  function $(id) { return document.getElementById(id); }
  var modal, els = {}, lastFocus = null;

  function init() {
    modal = $('upiModal');
    if (!modal) return;
    els = {
      program: $('upiProgram'), amount: $('upiAmount'),
      qr: $('upiQr'), vpa: $('upiVpa'),
      open: $('upiOpenApp'), close: $('upiCloseBtn'), copyVpa: $('upiCopyVpa'),
      form: $('upiRefForm'), input: $('upiRefInput')
    };

    modal.addEventListener('click', function (e) {
      if (e.target === modal || e.target.closest('[data-close]')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
    });

    if (els.copyVpa) els.copyVpa.addEventListener('click', function () {
      copy(upiId, 'UPI ID copied to clipboard');
    });
    if (els.form) els.form.addEventListener('submit', submitRef);
  }

  // ---- Copy helpers ---------------------------------------------
  function copy(text, msg) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () {
        if (window.KFToast) window.KFToast(msg);
      }, function () { fallbackCopy(text, msg); });
    } else fallbackCopy(text, msg);
  }

  function fallbackCopy(text, msg) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); if (window.KFToast) window.KFToast(msg); }
    catch (err) { if (window.KFToast) window.KFToast('Copy failed — please select and copy manually'); }
    document.body.removeChild(ta);
  }

  // ---- Order reference -> emailed to you for matching ----------
  function submitRef(e) {
    e.preventDefault();
    var value = (els.input.value || '').trim();
    if (!value) { els.input.focus(); return; }

    var program = els.program.dataset.name || '';
    var subject = 'UPI order ' + value + ' — ' + program;
    var body =
      'Hi Abhyas,\n\n' +
      'I have paid for ' + program + ' (' + els.amount.textContent + ') by UPI.\n\n' +
      'UPI reference number: ' + value + '\n' +
      'UPI ID paid to: ' + upiId + '\n\n' +
      'Please confirm receipt and send my program download link.\n\n' +
      'Thank you.';

    location.href = 'mailto:' + (CFG.supportEmail || '') +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);

    document.getElementById('upiSent').hidden = false;
    els.form.hidden = true;
  }

  // ---- Open / close ---------------------------------------------
  function open(name, amount) {
    if (!enabled) return false;
    lastFocus = document.activeElement;

    els.program.textContent = name;
    els.program.dataset.name = name;
    els.amount.textContent = amount;
    els.vpa.textContent = upiId;
    els.open.href = buildLink(amount, name);
    if (!els.open.href) { close(); return; }
    document.getElementById('upiSent').hidden = true;
    els.form.hidden = false;
    els.input.value = '';

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    drawQR(els.open.href);
    if (els.close) els.close.focus();
    return true;
  }

  function close() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  // ---- QR -------------------------------------------------------
  // Built on open (not page load) so the container has real
  // dimensions — qrcodegen renders 0x0 into a hidden element.
  function drawQR(text) {
    if (!els.qr) return;
    els.qr.innerHTML = '';
    if (!window.QRCode) {
      els.qr.innerHTML = '<p class="upi__qr-fallback">' +
        'QR unavailable — use the UPI ID above or the app button.</p>';
      return;
    }
    try {
      /* global QRCode */
      new QRCode(els.qr, {
        text: text,
        width: 208,
        height: 208,
        colorDark: '#0A0A0A',
        colorLight: '#F4F2EE',
        correctLevel: QRCode.CorrectLevel.M
      });
      els.qr.classList.add('is-light');
    } catch (err) {
      els.qr.innerHTML = '<p class="upi__qr-fallback">' +
        'QR unavailable — use the UPI ID above or the app button.</p>';
    }
  }

  if (enabled) init();

  window.KF_UPI = {
    enabled: enabled,
    open: open,
    close: close,
    copy: copy,
    link: buildLink,
    cleanAmount: cleanAmount
  };
})();
