/* ═══════════════════════════════════════════════════════
   Gustavo & Lara — Confirmação de Presença (RSVP)
   Lê o convite pelo ?id= da URL e grava em /api/rsvp
   ═══════════════════════════════════════════════════════ */

const DEADLINE = new Date(2026, 10, 30, 23, 59, 59); // 30/11/2026
const WHATSAPP = '5514991478807';

// Evento para "Salvar na agenda" — 19h em Marília (UTC-3)
const EVENT = {
  title: 'Casamento Gustavo & Lara',
  start: '20270109T220000Z',
  end: '20270110T040000Z',
  location: 'Churrascaria Kieza, Av. Tiradentes, 1480 - Fragata, Marília - SP',
  details: 'Cerimônia e recepção às 19h. https://gustavo-e-lara.vercel.app',
};

const OPTIONS = [
  { value: 'confirmed', label: 'Vou',         cls: 'yes',   icon: '<path d="M5 12.5l4.5 4.5L19 7.5"/>' },
  { value: 'declined',  label: 'Não vou',     cls: 'no',    icon: '<path d="M7 7l10 10M17 7 7 17"/>' },
  { value: 'pending',   label: 'Ainda não sei', cls: 'maybe', icon: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 1.5"/>' },
];

const STATUS_TEXT = { confirmed: 'Vai', declined: 'Não vai', pending: 'A decidir' };

const $ = (sel) => document.querySelector(sel);

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const whatsLink = (text) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;

/* ── Troca de tela: só uma seção visível por vez ────── */
const SCREENS = ['loading', 'content', 'success', 'empty', 'error', 'deadlineExpired'];
const show = (screen) => SCREENS.forEach((id) => { $(`#${id}`).hidden = id !== screen; });

/* ── Prazo ──────────────────────────────────────────── */
const updateCountdown = () => {
  const diff = DEADLINE - new Date();
  if (diff <= 0) return true;

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  $('#countdown').textContent = days >= 1
    ? `Faltam ${days} ${days === 1 ? 'dia' : 'dias'}`
    : `Último dia · faltam ${hours}h`;
  return false;
};

/* ── Agenda ─────────────────────────────────────────── */
const googleCalendarUrl = () => {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: EVENT.title,
    dates: `${EVENT.start}/${EVENT.end}`,
    location: EVENT.location,
    details: EVENT.details,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
};

const downloadIcs = () => {
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gustavo & Lara//RSVP//PT',
    'BEGIN:VEVENT',
    'UID:casamento-gustavo-lara-20270109@gustavo-e-lara.vercel.app',
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTSTART:${EVENT.start}`, `DTEND:${EVENT.end}`,
    `SUMMARY:${EVENT.title}`,
    `LOCATION:${EVENT.location.replace(/,/g, '\\,')}`,
    `DESCRIPTION:${EVENT.details.replace(/,/g, '\\,')}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');

  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  link.download = 'casamento-gustavo-e-lara.ics';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};

/* ═══════════════════════════════════════════════════════
   FORMULÁRIO
   ═══════════════════════════════════════════════════════ */
const memberHtml = (member, index) => {
  const name = escapeHtml(member.name);
  // "Pendente" não vem pré-marcado: o convidado escolhe ativamente cada resposta
  const current = member.status === 'confirmed' || member.status === 'declined' ? member.status : null;

  const options = OPTIONS.map((opt) => `
    <label class="rv-opt rv-opt--${opt.cls}">
      <input type="radio" name="m${index}" value="${opt.value}" ${current === opt.value ? 'checked' : ''} aria-label="${name}: ${opt.label}">
      <span class="rv-opt__ui"><svg viewBox="0 0 24 24" aria-hidden="true">${opt.icon}</svg>${opt.label}</span>
    </label>`).join('');

  return `
    <fieldset class="rv-member" style="animation-delay:${index * 70}ms">
      <legend>${name}${member.isChild ? '<span class="rv-pill">Criança</span>' : ''}</legend>
      <div class="rv-options">${options}</div>
    </fieldset>`;
};

const readAnswers = (members) => members.map((m, i) => ({
  name: m.name,
  isChild: !!m.isChild,
  status: document.querySelector(`input[name="m${i}"]:checked`)?.value || 'pending',
}));

const updateProgress = (members) => {
  const chosen = members.filter((_, i) => document.querySelector(`input[name="m${i}"]:checked`)).length;
  const total = members.length;
  const el = $('#progress');

  $('#submitBtn').disabled = chosen === 0;
  el.classList.toggle('rv-progress--done', chosen === total);

  if (total === 1) {
    el.textContent = chosen ? 'Tudo pronto ✓' : 'Escolha uma opção acima';
  } else if (chosen === total) {
    el.textContent = 'Tudo pronto ✓';
  } else {
    el.innerHTML = `<b>${chosen}</b> de ${total} respostas escolhidas`;
  }
};

const renderSuccess = (answers) => {
  const count = (s) => answers.filter((a) => a.status === s).length;
  const going = count('confirmed');
  const pending = count('pending');
  const single = answers.length === 1;

  let title = 'Obrigado!';
  let copy = single ? 'Que alegria! Sua presença está confirmada. Esperamos por você no dia 09 de janeiro.' : 'Que alegria! Sua resposta foi registrada. Esperamos vocês no dia 09 de janeiro.';

  if (!going && !pending) {
    title = 'Obrigado por avisar';
    copy = 'Sentiremos sua falta! Sua resposta foi registrada com carinho.';
  } else if (!going) {
    title = 'Resposta salva';
    copy = 'Quando decidir, é só voltar neste mesmo link até 30 de novembro.';
  } else if (pending) {
    copy += ` Quem ainda está decidindo pode responder por este mesmo link até 30/11.`;
  }

  $('#successTitle').textContent = title;
  $('#successCopy').textContent = copy;
  $('#successSummary').innerHTML = answers.map((a) => `
    <li>
      <span>${escapeHtml(a.name)}</span>
      <span class="rv-summary__status rv-summary__status--${a.status}">${STATUS_TEXT[a.status]}</span>
    </li>`).join('');
  $('#calendarActions').hidden = !going;

  show('success');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  $('#success').focus({ preventScroll: true });
};

const setupForm = (id, family) => {
  const members = family.members;
  const list = $('#membersList');
  list.innerHTML = members.map(memberHtml).join('');

  if (members.length > 1) {
    $('#formIntro').textContent = 'Responda por cada pessoa:';
    $('#allYes').hidden = false;
  } else {
    $('#formIntro').textContent = 'Você vem celebrar com a gente?';
  }

  // Quem volta ao link vê o que já respondeu
  const answered = members.some((m) => m.status === 'confirmed' || m.status === 'declined');
  if (answered && family.updatedAt) {
    const when = new Date(family.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
    $('#answeredNote').textContent = `Vocês já responderam em ${when}. Se algo mudou, é só alterar e enviar de novo.`;
    $('#answeredNote').hidden = false;
  }

  updateProgress(members);
  list.addEventListener('change', () => {
    $('#submitError').hidden = true;
    updateProgress(members);
  });

  $('#allYes').addEventListener('click', () => {
    members.forEach((_, i) => { document.querySelector(`input[name="m${i}"][value="confirmed"]`).checked = true; });
    updateProgress(members);
  });

  $('#rsvpForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const btn = $('#submitBtn');
    const errorEl = $('#submitError');

    if (new Date() > DEADLINE) {
      show('deadlineExpired');
      return;
    }

    const answers = readAnswers(members);
    btn.disabled = true;
    btn.classList.add('is-loading');
    btn.textContent = 'Enviando…';
    errorEl.hidden = true;

    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, members: answers }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      renderSuccess(answers);
    } catch {
      errorEl.textContent = 'Não conseguimos salvar agora. Confira sua internet e tente de novo.';
      errorEl.hidden = false;
    } finally {
      btn.classList.remove('is-loading');
      btn.textContent = 'Enviar resposta';
      updateProgress(members);
    }
  });

  $('#editAgain').addEventListener('click', () => {
    $('#answeredNote').hidden = true;
    show('content');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  show('content');
};

/* ═══════════════════════════════════════════════════════
   INICIALIZAÇÃO
   ═══════════════════════════════════════════════════════ */
const showError = ({ title, copy, retry = false, id = '' }) => {
  if (title) $('#errorTitle').textContent = title;
  if (copy) $('#errorCopy').textContent = copy;
  $('#retryBtn').hidden = !retry;
  $('#errorWhats').href = whatsLink(`Oi Gustavo! Tive um problema para abrir meu convite${id ? ` (código ${id})` : ''}. Pode me ajudar?`);
  $('#familyName').hidden = true;
  show('error');
};

document.addEventListener('DOMContentLoaded', async () => {
  const id = new URLSearchParams(window.location.search).get('id');

  $('#gcalLink').href = googleCalendarUrl();
  $('#icsBtn').addEventListener('click', downloadIcs);
  $('#retryBtn').addEventListener('click', () => window.location.reload());

  if (!id) {
    showError({});
    return;
  }

  if (updateCountdown()) {
    $('#familyName').textContent = 'Até breve';
    show('deadlineExpired');
    return;
  }
  setInterval(updateCountdown, 60_000);

  try {
    const res = await fetch(`/api/rsvp?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (res.status === 404) {
      showError({ id });
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const family = await res.json();
    const shownName = family.displayName || family.familyName;
    $('#familyName').textContent = shownName;
    $('#familyName').classList.toggle('rv-family--long', shownName.length > 18);
    document.title = `${shownName} · Confirmar presença | Gustavo & Lara`;

    if (!family.members?.length) {
      $('#emptyWhats').href = whatsLink(`Oi Gustavo! Abri o convite (código ${id}) e os nomes ainda não aparecem.`);
      show('empty');
      return;
    }

    setupForm(id, family);
  } catch {
    showError({
      id,
      retry: true,
      title: 'Não foi possível carregar',
      copy: 'Parece que a conexão falhou. Verifique sua internet e tente novamente.',
    });
  }
});
