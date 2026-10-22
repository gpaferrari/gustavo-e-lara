/* ═══════════════════════════════════════════════════════
   Gustavo & Lara — Wedding Page
   Main Script
   ═══════════════════════════════════════════════════════ */

const WEDDING_DATE = new Date(2027, 0, 9, 19, 0);    // 09/01/2027 19h
const RSVP_DEADLINE = new Date(2026, 10, 30, 23, 59, 59);
const SITE_URL = 'https://gustavo-e-lara.vercel.app/';

/* ── Reveal on scroll ───────────────────────────────── */
const revealEls = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
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
  revealEls.forEach((el) => revealObserver.observe(el));
} else {
  // Navegador antigo: mostra tudo de uma vez em vez de deixar a página vazia
  revealEls.forEach((el) => el.classList.add('in-view'));
}

/* ── Stagger siblings inside each section ───────────── */
document.querySelectorAll('.section, .verse-open, .verse-mid, .rsvp').forEach((section) => {
  section.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = `${i * 0.12}s`;
  });
});

/* ── Contagem regressiva ────────────────────────────── */
function updateCountdown() {
  const el = document.getElementById('countdown');
  if (!el) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(WEDDING_DATE);
  day.setHours(0, 0, 0, 0);
  const days = Math.round((day - today) / 86_400_000);

  if (days > 1) el.innerHTML = `faltam <strong>${days}</strong> dias`;
  else if (days === 1) el.innerHTML = '<strong>é amanhã!</strong>';
  else if (days === 0) el.innerHTML = '<strong>é hoje!</strong>';
  else el.textContent = '';
}

updateCountdown();

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

/* ── Compartilhar o site ────────────────────────────── */
function shareSite() {
  const btn = document.getElementById('shareBtn');
  const label = btn.querySelector('span');
  const shareData = {
    title: 'Gustavo & Lara ♥',
    text: 'Vós sois convidados para celebrar o nosso sim.',
    url: SITE_URL,
  };

  if (navigator.share) {
    navigator.share(shareData).catch(() => {});
    return;
  }

  // Desktop sem menu de compartilhar: copia o link
  legacyCopy(SITE_URL, () => {
    const original = label.textContent;
    label.textContent = '✓ Link copiado!';
    setTimeout(() => { label.textContent = original; }, 2000);
  });
}

document.getElementById('shareBtn')?.addEventListener('click', shareSite);

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

/* ── Convite online personalizado (?id=...) ─────────── */
/*
 * O link enviado pelo WhatsApp é o próprio site com o código da família.
 * Mostra um envelope "Para <família>", personaliza o topo e troca o passo a
 * passo do QR por um botão direto para a confirmação. Sem ?id, nada muda.
 */
const inviteId = new URLSearchParams(window.location.search).get('id');

function replayHeroReveal() {
  document.querySelectorAll('.hero .reveal').forEach((el) => {
    el.classList.remove('in-view');
    void el.offsetWidth; // reinicia a transição
    el.classList.add('in-view');
  });
}

function closeEnvelope() {
  const root = document.documentElement;
  const screen = document.getElementById('envelopeScreen');
  if (!root.classList.contains('has-envelope')) return;
  screen.classList.add('is-leaving');
  setTimeout(() => {
    root.classList.remove('has-envelope');
    screen.setAttribute('aria-hidden', 'true');
    replayHeroReveal();
  }, 800);
}

function openEnvelope() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById('envelopeBtn').classList.add('is-open');
  try { sessionStorage.setItem(`envelope_${inviteId}`, '1'); } catch { /* modo privado */ }
  setTimeout(closeEnvelope, reduceMotion ? 200 : 1800);
}

function personalize(family) {
  const name = friendlyName(family);
  const rsvpLink = `rsvp.html?id=${encodeURIComponent(family.id)}`;

  document.getElementById('envelopeName').textContent = name;

  const guest = document.getElementById('heroGuest');
  guest.textContent = name;
  guest.hidden = false;

  document.getElementById('rsvpPersonalName').textContent = name;
  document.getElementById('rsvpPersonalLink').href = rsvpLink;
  document.getElementById('rsvpPersonal').hidden = false;
  document.documentElement.classList.add('is-personal');

  document.title = `${name} · Gustavo & Lara`;
}

async function setupPersonalInvite() {
  if (!inviteId) return;

  const hasEnvelope = document.documentElement.classList.contains('has-envelope');
  if (hasEnvelope) {
    const envelope = document.getElementById('envelopeBtn');
    document.getElementById('envelopeScreen').setAttribute('aria-hidden', 'false');
    envelope.addEventListener('click', openEnvelope, { once: true });
    envelope.focus({ preventScroll: true });
  }

  try {
    const res = await fetch(`/api/rsvp?id=${encodeURIComponent(inviteId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    personalize(await res.json());
  } catch {
    // Código inválido ou sem conexão: segue como o site normal, sem envelope
    closeEnvelope();
  }
}

setupPersonalInvite();

/* ── Lembrete de confirmação ────────────────────────── */
/*
 * Barra discreta no rodapé, mostrada uma vez por aparelho, só depois que a
 * pessoa sai do topo da página. Some sozinha ao chegar na seção de confirmação
 * (que já explica tudo) e não aparece depois do prazo.
 */
const POPUP_KEY = 'rsvp_popup_closed';

const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* modo privado */ } },
};

function setupRSVPPopup() {
  // Convite online já tem o botão direto de confirmação — o lembrete sobra
  if (inviteId || storage.get(POPUP_KEY) || new Date() > RSVP_DEADLINE || !('IntersectionObserver' in window)) return;

  document.body.insertAdjacentHTML('beforeend', `
    <div class="rsvp-popup" id="rsvpPopup" role="status">
      <p class="rsvp-popup__text">
        Recebeu o convite? Confirme pelo <strong>QR Code</strong> até 30/11.
        <a href="https://wa.me/5514991478807?text=Oi%20Gustavo!%20Tive%20problemas%20com%20meu%20QR%20Code%2C%20poderia%20me%20ajudar%3F" target="_blank" rel="noopener">Dúvidas?</a>
      </p>
      <button type="button" class="rsvp-popup__close" id="closePopup" aria-label="Fechar aviso">&times;</button>
    </div>
  `);

  const popup = document.getElementById('rsvpPopup');
  const hero = document.getElementById('inicio');
  const rsvpSection = document.getElementById('confirmacao');
  let heroVisible = true;
  let rsvpVisible = false;

  const sync = () => popup.classList.toggle('show', !heroVisible && !rsvpVisible);

  new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; sync(); }, { threshold: 0.35 }).observe(hero);
  new IntersectionObserver(([entry]) => { rsvpVisible = entry.isIntersecting; sync(); }).observe(rsvpSection);

  document.getElementById('closePopup').addEventListener('click', () => {
    popup.classList.remove('show');
    storage.set(POPUP_KEY, 'true');
    setTimeout(() => popup.remove(), 600);
  });
}

window.addEventListener('load', setupRSVPPopup);
