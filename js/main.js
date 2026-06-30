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

/* ── Share Site ────────────────────────────────────── */
function shareSite() {
  const shareData = {
    title: 'Gustavo & Lara ♥',
    text: 'Vós sois convidados para celebrar o nosso sim.',
    url: 'https://gustavo-e-lara.vercel.app/'
  };

  const btn = document.querySelector('.share-btn');
  const original = btn.innerHTML;

  if (navigator.share) {
    navigator.share(shareData).catch(() => {});
  } else {
    // Fallback: Copy link
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareData.url).then(() => {
        btn.textContent = '✓ Link Copiado!';
        setTimeout(() => { btn.innerHTML = original; }, 2000);
      });
    }
  }
}

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

/* ── RSVP Popup ────────────────────────────────────── */
function setupRSVPPopup() {
  const popupHtml = `
    <div class="rsvp-popup" id="rsvpPopup">
      <button class="rsvp-popup__close" id="closePopup" aria-label="Fechar">&times;</button>
      <h3 class="rsvp-popup__title">Falta pouco! 💍</h3>
      <p class="rsvp-popup__text">
        Estamos muito felizes em celebrar este momento com você! <br><br>
        A confirmação de presença deve ser feita através do <strong>QR Code do seu convite</strong> até o dia 30 de novembro de 2026.
      </p>
      <div class="rsvp-popup__actions">
        <a href="https://wa.me/5514991478807?text=Oi%20Gustavo!%20Tive%20problemas%20com%20meu%20QR%20Code%2C%20poderia%20me%20ajudar%3F" 
           class="rsvp-popup__btn" target="_blank">Dúvidas? Fale com o noivo</a>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', popupHtml);

  const popup = document.getElementById('rsvpPopup');
  const closeBtn = document.getElementById('closePopup');

  // Não mostrar se já foi fechado nesta sessão
  if (sessionStorage.getItem('rsvp_popup_closed')) return;

  setTimeout(() => {
    popup.classList.add('show');
  }, 3000);

  closeBtn.addEventListener('click', () => {
    popup.classList.remove('show');
    sessionStorage.setItem('rsvp_popup_closed', 'true');
  });
}

window.addEventListener('load', setupRSVPPopup);
