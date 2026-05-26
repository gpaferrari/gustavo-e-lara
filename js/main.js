/* ═══════════════════════════════════════════════════════
   Gustavo & Lara — Wedding Page
   Main Script
   ═══════════════════════════════════════════════════════ */

/* ── Reveal on scroll ───────────────────────────────── */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
);

document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

/* ── Stagger siblings inside each section ───────────── */
document.querySelectorAll('.section, .verse-open, .verse-mid, .rsvp').forEach((section) => {
  section.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = `${i * 0.12}s`;
  });
});

/* ── Copy Pix key ───────────────────────────────────── */
function copyPix() {
  const key = document.getElementById('pixKey').textContent.trim();
  const btn = document.querySelector('.gifts__pix-btn');

  const write = () => {
    const original = btn.innerHTML;
    btn.textContent = '✓ Copiado!';
    btn.style.background = 'var(--sage-dark)';
    setTimeout(() => {
      btn.innerHTML = original;
      btn.style.background = '';
    }, 2200);
  };

  if (navigator.clipboard) {
    navigator.clipboard.writeText(key).then(write).catch(() => legacyCopy(key, write));
  } else {
    legacyCopy(key, write);
  }
}

function legacyCopy(text, cb) {
  const ta = Object.assign(document.createElement('textarea'), {
    value: text,
    style: 'position:absolute;left:-9999px',
  });
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
  cb();
}

/* ── Dynamic QR Code ────────────────────────────────── */
function setupQRCode() {
  const qrImg = document.getElementById('qrCode');
  if (qrImg) {
    const currentUrl = window.location.href;
    // Usa a API do qrserver para gerar o QR code do link atual
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(currentUrl)}`;
  }
}

window.addEventListener('DOMContentLoaded', setupQRCode);

/* ── Console Easter Egg ─────────────────────────────── */
/* eslint-disable no-console */
if (typeof console !== 'undefined' && console.log) {
  console.log(
    '%c💍 Gustavo & Lara\n' +
    '%c\nSe você chegou até aqui, parabéns — você é tão dev quanto o noivo.\n\n' +
    '%c"O cordão de três dobras não se rompe com facilidade." — Ecl 4:12\n\n' +
    '%cmade with ♥ & </code>',
    'color:#C4934A;font-size:20px;font-weight:bold;',
    'color:#7A9E7E;font-size:13px;',
    'color:#9B8B7E;font-size:11px;font-style:italic;',
    'color:#5C3D2E;font-size:10px;'
  );
}
/* eslint-enable no-console */
