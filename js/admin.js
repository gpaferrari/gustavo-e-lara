/* ═══════════════════════════════════════════════════════
   Gustavo & Lara — Painel de Convidados
   Vanilla JS · consome /api/admin
   ═══════════════════════════════════════════════════════ */

const API = '/api/admin';
const AUTH_KEY = 'adminAuth';
const QR_COLOR = '#5C3D2E'; // mesma cor dos QR codes já impressos
const PRICE_ADULT = 150;     // valor por convidado pagante (criança -5 anos não paga)
const PAID_SO_FAR = 3000;    // já pago ao buffet — atualizar aqui a cada novo pagamento
const VIEW_KEY = 'adminView'; // última visualização escolhida (cards ou tabela)

const $ = (sel, root = document) => root.querySelector(sel);

const state = {
  families: [],
  filter: 'all',
  query: '',
  loadedAt: 0,
  editingId: null,
  draftMembers: [],
  qrFamilyId: null,
  view: (() => { try { return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'cards'; } catch { return 'cards'; } })(),
};

/* ── Utilitários ────────────────────────────────────── */
const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

// Busca sem acento e sem caixa: "joao" encontra "João"
const normalize = (text) => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const percent = (part, total) => (total ? Math.round((part / total) * 100) : 0);
const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '');
const rsvpUrl = (id) => `${window.location.origin}/rsvp.html?id=${encodeURIComponent(id)}`;
// Convite online: o próprio site, aberto com envelope personalizado (ver js/main.js).
// Endereço fixo para o link enviado nunca sair com um domínio de teste.
const inviteUrl = (id) => `https://gustavo-e-lara.vercel.app/?id=${encodeURIComponent(id)}`;
const brl = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const slugify = (text) => normalize(text).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'convite';
const findFamily = (id) => state.families.find((f) => f.id === id);

const STATUS_LABEL = { confirmed: 'Vou', declined: 'Não vou', pending: 'Pendente' };
// Só os três valores conhecidos viram classe/texto no HTML (o RSVP é uma rota pública)
const safeStatus = (status) => (['confirmed', 'declined', 'pending'].includes(status) ? status : 'pending');

const ICONS = {
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  send:  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7z"/></svg>',
  link:  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  qr:    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/></svg>',
  edit:  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};

/* ── Toasts ─────────────────────────────────────────── */
const toast = (message, type = 'ok') => {
  const el = document.createElement('div');
  el.className = `toast${type === 'error' ? ' toast--error' : ''}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.textContent = message;
  $('#toasts').appendChild(el);
  setTimeout(() => {
    el.classList.add('is-leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, type === 'error' ? 4500 : 2600);
};

const copyText = async (text, okMessage = 'Link copiado') => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text, style: 'position:fixed;opacity:0' });
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast(okMessage);
};

/* ── API ────────────────────────────────────────────── */
const getAuth = () => sessionStorage.getItem(AUTH_KEY);

const api = async (method, body, auth = getAuth()) => {
  const res = await fetch(API, {
    method,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify({ ...body, auth }) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Erro ${res.status}`);
    err.status = res.status;
    if (res.status === 401 && body?.action !== 'login') logout('Sessão expirada. Entre novamente.');
    throw err;
  }
  return data;
};

/* ── Resumo de cada convite ─────────────────────────── */
const summarize = (family) => {
  const members = family.members || [];
  const answered = members.filter((m) => m.status === 'confirmed' || m.status === 'declined').length;
  let status = 'waiting';
  if (!members.length) status = 'empty';
  else if (answered === members.length) status = 'done';
  else if (answered) status = 'partial';
  return { members, answered, status };
};

const FILTERS = [
  { id: 'all',       label: 'Todos',           test: () => true },
  { id: 'toDeliver', label: 'A entregar',      test: (f) => !f.delivered },
  { id: 'delivered', label: 'Entregues',       test: (f) => !!f.delivered },
  { id: 'waiting',   label: 'Aguardando',      test: (f, s) => s.status === 'waiting' || s.status === 'partial' },
  { id: 'done',      label: 'Responderam',     test: (f, s) => s.status === 'done' },
  { id: 'empty',     label: 'Sem integrantes', test: (f, s) => s.status === 'empty', warn: true },
];

/* ═══════════════════════════════════════════════════════
   RENDERIZAÇÃO
   ═══════════════════════════════════════════════════════ */
const renderStats = () => {
  const s = { invites: state.families.length, delivered: 0, people: 0, paying: 0, children: 0, confirmed: 0, declined: 0, payingConfirmed: 0 };

  state.families.forEach((f) => {
    if (f.delivered) s.delivered++;
    (f.members || []).forEach((m) => {
      s.people++;
      if (m.isChild) s.children++; else s.paying++;
      if (m.status === 'confirmed') {
        s.confirmed++;
        if (!m.isChild) s.payingConfirmed++;
      }
      if (m.status === 'declined') s.declined++;
    });
  });

  const pending = s.people - s.confirmed - s.declined;
  const toDeliver = s.invites - s.delivered;
  const set = (id, value) => { $(id).textContent = value; };

  set('#kpiDelivered', s.delivered);
  set('#kpiInvites', s.invites);
  set('#kpiDeliveredFoot', toDeliver ? `${plural(toDeliver, 'convite', 'convites')} a entregar · ${percent(s.delivered, s.invites)}% concluído` : 'Todos os convites foram entregues 🎉');
  set('#kpiAnswered', s.confirmed + s.declined);
  set('#kpiPeople', s.people);
  set('#statConfirmed', s.confirmed);
  set('#statDeclined', s.declined);
  set('#statPending', pending);
  set('#statTotal', s.people);
  set('#statPaying', s.paying);
  set('#statChildren', s.children);
  set('#statPayingConfirmed', s.payingConfirmed);

  $('#barDelivered').style.width = `${percent(s.delivered, s.invites)}%`;
  $('#barConfirmed').style.width = `${percent(s.confirmed, s.people)}%`;
  $('#barDeclined').style.width = `${percent(s.declined, s.people)}%`;
};

const renderFilters = () => {
  const counts = Object.fromEntries(FILTERS.map((flt) => [flt.id, 0]));
  state.families.forEach((f) => {
    const s = summarize(f);
    FILTERS.forEach((flt) => { if (flt.test(f, s)) counts[flt.id]++; });
  });

  // "Sem integrantes" só aparece quando existe algum — é um alerta, não um filtro do dia a dia
  if (state.filter === 'empty' && !counts.empty) state.filter = 'all';

  $('#filters').innerHTML = FILTERS
    .filter((flt) => flt.id !== 'empty' || counts.empty)
    .map((flt) => `
      <button type="button" class="chip${flt.warn ? ' chip--warn' : ''}" data-filter="${flt.id}" aria-pressed="${state.filter === flt.id}">
        ${flt.label}<span class="chip__count">${counts[flt.id]}</span>
      </button>`)
    .join('');
};

// Cada integrante tem um seletor de resposta: os noivos marcam por quem não
// conseguiu confirmar pelo QR. "byAdmin" mostra que a resposta veio daqui.
const memberHtml = (m, index, familyId) => {
  const status = safeStatus(m.status);
  const name = escapeHtml(m.name);
  const options = ['pending', 'confirmed', 'declined']
    .map((s) => `<option value="${s}"${s === status ? ' selected' : ''}>${STATUS_LABEL[s]}</option>`)
    .join('');
  return `
    <li class="fam__member">
      <i class="dot dot--${status}" aria-hidden="true"></i>
      <span class="fam__member-name">
        ${name}${m.isChild ? '<span class="tag">criança</span>' : ''}
        ${m.byAdmin && status !== 'pending' ? '<span class="fam__by-admin" title="Resposta marcada por vocês no painel">marcado por vocês</span>' : ''}
      </span>
      <select class="status-select status-select--${status}" data-status-family="${escapeHtml(familyId)}" data-status-index="${index}" aria-label="Resposta de ${name}">
        ${options}
      </select>
    </li>`;
};

const BADGE = {
  done:    () => `<span class="badge badge--done">${ICONS.check}Respondido</span>`,
  partial: (s) => `<span class="badge badge--partial">${s.answered}/${s.members.length} responderam</span>`,
  waiting: () => '<span class="badge badge--waiting">Aguardando</span>',
  empty:   () => '<span class="badge badge--empty">Sem integrantes</span>',
};

const createCard = (f) => {
  const s = summarize(f);
  const children = s.members.filter((m) => m.isChild).length;
  const meta = [
    s.members.length ? plural(s.members.length, 'pessoa', 'pessoas') : 'Nenhum integrante cadastrado',
    children && plural(children, 'criança', 'crianças'),
    f.delivered && f.deliveredAt && `entregue em ${shortDate(f.deliveredAt)}`,
  ].filter(Boolean).join(' · ');
  const name = escapeHtml(f.familyName);
  const id = escapeHtml(f.id);

  const card = document.createElement('article');
  card.className = `fam${f.delivered ? ' is-delivered' : ''}`;
  card.dataset.id = f.id;
  card.innerHTML = `
    <header class="fam__head">
      <div>
        <h3 class="fam__title">${name}</h3>
        <p class="fam__meta">${meta}</p>
        ${f.displayName ? `<p class="fam__display">Convidado vê: <b>${escapeHtml(f.displayName)}</b></p>` : ''}
      </div>
      ${BADGE[s.status](s)}
    </header>

    ${s.members.length
      ? `<ul class="fam__members">${s.members.map((m, i) => memberHtml(m, i, f.id)).join('')}</ul>`
      : '<p class="fam__empty">Quem abrir este QR não verá nenhum nome. Toque em <b>Editar</b> para incluir os integrantes.</p>'}

    <footer class="fam__foot">
      <label class="deliver" title="Marque quando entregar o convite">
        <input type="checkbox" class="deliver__input" data-deliver="${id}" ${f.delivered ? 'checked' : ''}>
        <span class="deliver__box">${ICONS.check}</span>
        <span class="deliver__text">Entregue</span>
      </label>
      <div class="fam__actions">
        <button type="button" class="icon-btn" data-act="send" data-id="${id}" aria-label="Enviar convite online para ${name}" title="Enviar convite pelo WhatsApp">${ICONS.send}</button>
        <button type="button" class="icon-btn" data-act="copyInvite" data-id="${id}" aria-label="Copiar link do convite online de ${name}" title="Copiar link do convite">${ICONS.link}</button>
        <button type="button" class="icon-btn" data-act="qr" data-id="${id}" aria-label="QR Code de ${name}" title="QR Code">${ICONS.qr}</button>
        <button type="button" class="icon-btn" data-act="edit" data-id="${id}" aria-label="Editar ${name}" title="Editar">${ICONS.edit}</button>
        <button type="button" class="icon-btn icon-btn--danger" data-act="delete" data-id="${id}" aria-label="Excluir ${name}" title="Excluir">${ICONS.trash}</button>
      </div>
    </footer>`;
  return card;
};

// Convites que passam pelo filtro e pela busca, em ordem alfabética (cards e tabela)
const visibleFamilies = () => {
  const flt = FILTERS.find((x) => x.id === state.filter) || FILTERS[0];
  const q = normalize(state.query);
  return state.families
    .filter((f) => flt.test(f, summarize(f)))
    .filter((f) => !q || normalize(`${f.familyName} ${f.displayName || ''}`).includes(q) || (f.members || []).some((m) => normalize(m.name).includes(q)))
    .sort((a, b) => a.familyName.localeCompare(b.familyName, 'pt-BR', { sensitivity: 'base' }));
};

/* ── Visão em tabela ────────────────────────────────── */
// Uma linha por convidado. Valores: adulto R$ 150, criança não paga.
const guestRows = (families) => families.flatMap((f) => (f.members || []).map((m, i) => ({
  family: f,
  member: m,
  status: safeStatus(m.status),
  price: m.isChild ? 0 : PRICE_ADULT,
  groupStart: i === 0,
})));

const costSummary = (rows) => {
  const paying = rows.filter((r) => r.price);
  const sum = (list) => list.reduce((acc, r) => acc + r.price, 0);
  return {
    people: rows.length,
    children: rows.length - paying.length,
    paying: paying.length,
    planned: sum(paying),
    estimated: sum(paying.filter((r) => r.status !== 'declined')),
    confirmed: sum(paying.filter((r) => r.status === 'confirmed')),
    confirmedCount: paying.filter((r) => r.status === 'confirmed').length,
    declinedCount: paying.filter((r) => r.status === 'declined').length,
  };
};

const tableRowHtml = (r) => {
  const name = escapeHtml(r.member.name);
  const fam = escapeHtml(r.family.familyName);
  const invite = escapeHtml(friendlyName(r.family)); // vários convites têm o mesmo familyName ("Amiga da Noiva")
  const classes = [r.groupStart && 'is-group-start', r.status === 'declined' && 'is-declined'].filter(Boolean).join(' ');
  const familyCell = r.groupStart
    ? `<span class="gt-invite">${invite}</span><span class="gt-invite__group">${fam}</span>`
    : `<span class="gt-ditto" aria-hidden="true">″</span><span class="visually-hidden">${invite}</span>`;
  return `
    <tr class="${classes}">
      <td class="gt-name">
        <span class="gt-name__main">${name}${r.member.isChild ? '<span class="tag">criança</span>' : ''}</span>
        ${invite !== name ? `<span class="gt-name__family">${invite}</span>` : ''}
      </td>
      <td class="gt-col-family">${familyCell}</td>
      <td class="gt-col-type">${r.member.isChild ? 'Criança' : 'Adulto'}</td>
      <td><span class="gt-status gt-status--${r.status}"><i class="dot dot--${r.status}" aria-hidden="true"></i>${STATUS_LABEL[r.status] || 'Pendente'}</span></td>
      <td class="gt-col-delivered">${r.family.delivered ? '<span class="gt-yes">Entregue</span>' : '<span class="gt-no">—</span>'}</td>
      <td class="gt-price">${r.price ? brl(r.price) : '<span class="gt-free">grátis</span>'}</td>
    </tr>`;
};

// Pagamento: sempre sobre a lista inteira, com base no Estimado (sem quem recusou)
const paymentSummary = () => {
  const total = costSummary(guestRows(state.families)).estimated;
  const remaining = Math.max(total - PAID_SO_FAR, 0);
  return { total, paid: PAID_SO_FAR, remaining, pct: percent(PAID_SO_FAR, total) };
};

const renderTable = (families) => {
  const rows = guestRows(families);
  const c = costSummary(rows);
  const pay = paymentSummary();
  const filtered = normalize(state.query) || state.filter !== 'all';

  const table = rows.length ? `
    <div class="gt-scroll">
      <table class="gt">
        <thead>
          <tr>
            <th scope="col">Convidado</th>
            <th scope="col" class="gt-col-family">Convite</th>
            <th scope="col" class="gt-col-type">Tipo</th>
            <th scope="col">Resposta</th>
            <th scope="col" class="gt-col-delivered">Convite entregue</th>
            <th scope="col" class="gt-price">Valor</th>
          </tr>
        </thead>
        <tbody>${rows.map(tableRowHtml).join('')}</tbody>
        <tfoot>
          <tr>
            <th scope="row" class="gt-foot-label">Total previsto · ${plural(c.paying, 'pagante', 'pagantes')}</th>
            <td class="gt-col-family"></td>
            <td class="gt-col-type"></td>
            <td></td>
            <td class="gt-col-delivered"></td>
            <td class="gt-price">${brl(c.planned)}</td>
          </tr>
        </tfoot>
      </table>
    </div>`
    : '<div class="empty-state"><strong>Nada por aqui</strong>Nenhum convidado corresponde à busca ou ao filtro.</div>';

  $('#guestTable').innerHTML = `
    <div class="cost">
      <article class="cost__item">
        <span class="cost__label">Previsto</span>
        <strong class="cost__value">${brl(c.planned)}</strong>
        <span class="cost__hint">${plural(c.paying, 'pagante', 'pagantes')} × ${brl(PRICE_ADULT)}</span>
      </article>
      <article class="cost__item">
        <span class="cost__label">Estimado</span>
        <strong class="cost__value">${brl(c.estimated)}</strong>
        <span class="cost__hint">sem quem recusou (${c.declinedCount})</span>
      </article>
      <article class="cost__item cost__item--accent">
        <span class="cost__label">Confirmado</span>
        <strong class="cost__value">${brl(c.confirmed)}</strong>
        <span class="cost__hint">${c.confirmedCount === 1 ? '1 pagante disse' : `${c.confirmedCount} pagantes disseram`} “vou”</span>
      </article>
    </div>

    <div class="pay">
      <div class="pay__head">
        <span class="pay__label">Pagamento do buffet</span>
        <span class="pay__pct">${pay.pct}% pago</span>
      </div>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pay.pct}" aria-label="Pagamento do buffet">
        <span class="bar__fill bar__fill--sage" style="width:${Math.min(pay.pct, 100)}%"></span>
      </div>
      <dl class="pay__nums">
        <div><dt>Pago</dt><dd class="pay__paid">${brl(pay.paid)}</dd></div>
        <div><dt>Falta pagar</dt><dd>${brl(pay.remaining)}</dd></div>
        <div><dt>Total estimado</dt><dd>${brl(pay.total)}</dd></div>
      </dl>
    </div>

    <div class="gt-bar">
      <p class="gt-bar__info">${plural(c.people, 'convidado', 'convidados')} · ${plural(c.children, 'criança', 'crianças')}${filtered ? ' · <b>valores do filtro atual</b>' : ''}</p>
      <div class="gt-export" role="group" aria-label="Exportar lista">
        <button type="button" class="btn btn--ghost btn--sm" id="exportXlsx">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 8l6 8M15 8l-6 8"/></svg>
          Excel
        </button>
        <button type="button" class="btn btn--ghost btn--sm" id="exportPdf">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>
          PDF
        </button>
      </div>
    </div>
    ${table}`;

  $('#exportXlsx').addEventListener('click', (e) => exportExcel(rows, c, e.currentTarget));
  $('#exportPdf').addEventListener('click', () => exportPdf(rows, c));
};

/* ── Exportar: Excel (.xlsx) e PDF ──────────────────── */
const XLSX_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

// Carrega a biblioteca do Excel só quando alguém clica em exportar
const loadScript = (src) => new Promise((resolve, reject) => {
  if (document.querySelector(`script[src="${src}"]`)) return resolve();
  const el = Object.assign(document.createElement('script'), { src, onload: resolve, onerror: reject });
  document.head.appendChild(el);
});

const exportRows = (rows) => rows.map((r) => ({
  convidado: r.member.name,
  convite: friendlyName(r.family),
  grupo: r.family.familyName,
  tipo: r.member.isChild ? 'Criança' : 'Adulto',
  resposta: STATUS_LABEL[r.status],
  entregue: r.family.delivered ? 'Sim' : 'Não',
  valor: r.price,
}));

const fileDate = () => new Date().toISOString().slice(0, 10);

const exportExcel = async (rows, c, btn) => {
  const label = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Gerando…';
  try {
    await loadScript(XLSX_SRC);
    const data = exportRows(rows);
    const header = ['Convidado', 'Convite', 'Grupo', 'Tipo', 'Resposta', 'Convite entregue', 'Valor (R$)'];
    // Valores entram como texto/número (nunca fórmula), então nomes não viram comandos no Excel
    const aoa = [header, ...data.map((d) => [d.convidado, d.convite, d.grupo, d.tipo, d.resposta, d.entregue, d.valor])];
    const last = aoa.length; // linha do último convidado (1-based)
    aoa.push([], ['Total previsto', '', '', '', '', `${c.paying} pagantes`, c.planned]);
    aoa.push(['Estimado (sem quem recusou)', '', '', '', '', '', c.estimated]);
    aoa.push(['Confirmado', '', '', '', '', `${c.confirmedCount} pagantes`, c.confirmed]);
    const pay = paymentSummary();
    aoa.push([], ['Já pago ao buffet', '', '', '', '', `${pay.pct}% do estimado`, pay.paid]);
    aoa.push(['Falta pagar (estimado − pago)', '', '', '', '', '', pay.remaining]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 26 }, { wch: 26 }, { wch: 30 }, { wch: 9 }, { wch: 10 }, { wch: 16 }, { wch: 12 }];
    ws['!autofilter'] = { ref: `A1:G${last}` };
    // Total previsto como SOMA: se editarem a planilha, o total acompanha
    ws[XLSX.utils.encode_cell({ r: last + 1, c: 6 })] = { t: 'n', f: `SUM(G2:G${last})`, v: c.planned };
    for (let r = 1; r < aoa.length; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: 6 })];
      if (cell && cell.t === 'n') cell.z = '"R$" #,##0';
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Convidados');
    XLSX.writeFile(wb, `convidados-gustavo-lara-${fileDate()}.xlsx`);
  } catch (err) {
    console.error(err);
    toast('Não foi possível gerar o Excel. Verifique a conexão.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = label;
  }
};

// PDF: monta uma versão de impressão (título, totais e tabela completa) e abre
// o "Imprimir" do navegador, onde dá para escolher "Salvar como PDF"
const exportPdf = (rows, c) => {
  const data = exportRows(rows);
  const filtered = normalize(state.query) || state.filter !== 'all';
  const flt = FILTERS.find((x) => x.id === state.filter);
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  let area = $('#printArea');
  if (!area) {
    area = Object.assign(document.createElement('div'), { id: 'printArea', className: 'print-area' });
    document.body.appendChild(area);
  }
  area.innerHTML = `
    <header class="print-head">
      <p class="print-kicker">Gustavo &amp; Lara · 09/01/2027</p>
      <h1>Lista de convidados</h1>
      <p class="print-meta">Gerado em ${today}${filtered ? ` · filtro: ${escapeHtml(flt ? flt.label : '')}${state.query ? ` · busca “${escapeHtml(state.query)}”` : ''}` : ''}</p>
    </header>
    <div class="print-cost">
      <div><span>Previsto</span><strong>${brl(c.planned)}</strong><small>${c.paying} pagantes × ${brl(PRICE_ADULT)}</small></div>
      <div><span>Estimado</span><strong>${brl(c.estimated)}</strong><small>sem quem recusou</small></div>
      <div><span>Confirmado</span><strong>${brl(c.confirmed)}</strong><small>${c.confirmedCount} pagantes</small></div>
      <div><span>Convidados</span><strong>${c.people}</strong><small>${c.children} crianças</small></div>
      <div><span>Já pago</span><strong>${brl(paymentSummary().paid)}</strong><small>${paymentSummary().pct}% do estimado</small></div>
      <div><span>Falta pagar</span><strong>${brl(paymentSummary().remaining)}</strong><small>de ${brl(paymentSummary().total)}</small></div>
    </div>
    <table class="print-table">
      <thead><tr><th>#</th><th>Convidado</th><th>Convite</th><th>Tipo</th><th>Resposta</th><th>Entregue</th><th class="num">Valor</th></tr></thead>
      <tbody>${data.map((d, i) => `
        <tr>
          <td class="muted">${i + 1}</td>
          <td>${escapeHtml(d.convidado)}</td>
          <td>${escapeHtml(d.convite)}<br><small>${escapeHtml(d.grupo)}</small></td>
          <td>${d.tipo}</td>
          <td>${d.resposta}</td>
          <td>${d.entregue}</td>
          <td class="num">${d.valor ? brl(d.valor) : '—'}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr><td colspan="6">Total previsto · ${c.paying} pagantes</td><td class="num">${brl(c.planned)}</td></tr></tfoot>
    </table>`;

  const title = document.title;
  document.title = `convidados-gustavo-lara-${fileDate()}`; // vira o nome sugerido do PDF
  window.print();
  setTimeout(() => { document.title = title; }, 500);
};

const setView = (view) => {
  state.view = view;
  try { localStorage.setItem(VIEW_KEY, view); } catch { /* modo privado */ }
  renderList();
};

const renderList = () => {
  const grid = $('#familyGrid');
  const visible = visibleFamilies();
  const isTable = state.view === 'table';

  grid.setAttribute('aria-busy', 'false');
  grid.hidden = isTable;
  $('#guestTable').hidden = !isTable;
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));

  const filtered = normalize(state.query) || state.filter !== 'all';
  $('#resultInfo').textContent = filtered ? `Mostrando ${visible.length} de ${plural(state.families.length, 'convite', 'convites')}` : '';

  if (isTable) {
    renderTable(visible);
    return;
  }

  grid.replaceChildren(...visible.map(createCard));

  if (!visible.length) {
    grid.innerHTML = state.families.length
      ? '<div class="empty-state"><strong>Nada por aqui</strong>Nenhum convite corresponde à busca ou ao filtro.</div>'
      : '<div class="empty-state"><strong>Nenhum convite ainda</strong>Toque em “Novo convite” para começar.</div>';
  }
};

const renderAll = () => {
  renderStats();
  renderFilters();
  renderList();
};

// Atualiza um único card sem perder a posição de rolagem nem o foco
const refreshCard = (id, { focusDeliver = false } = {}) => {
  const old = $(`.fam[data-id="${CSS.escape(id)}"]`);
  const fam = findFamily(id);
  if (!old || !fam) return;
  const fresh = createCard(fam);
  fresh.style.animation = 'none';
  old.replaceWith(fresh);
  if (focusDeliver) fresh.querySelector('.deliver__input').focus({ preventScroll: true });
};

/* ═══════════════════════════════════════════════════════
   CARREGAMENTO
   ═══════════════════════════════════════════════════════ */
const loadFamilies = async ({ silent = false } = {}) => {
  const refreshBtn = $('#refreshBtn');
  refreshBtn.classList.add('is-spinning');
  try {
    const res = await fetch(API, { cache: 'no-store' });
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error(data.error || 'Resposta inválida do servidor');

    state.families = data;
    state.loadedAt = Date.now();
    renderAll();
    $('#syncInfo').textContent = `${plural(data.length, 'convite', 'convites')} · atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch (err) {
    console.error('Erro ao carregar convites:', err);
    if (!silent) toast(`Não foi possível carregar: ${err.message}`, 'error');
    if (!state.families.length) {
      $('#familyGrid').innerHTML = '<div class="empty-state"><strong>Falha ao carregar</strong>Verifique a conexão e toque em atualizar.</div>';
    }
  } finally {
    refreshBtn.classList.remove('is-spinning');
  }
};

/* ═══════════════════════════════════════════════════════
   ENTREGA DO CONVITE
   ═══════════════════════════════════════════════════════ */
const setMemberStatus = async (select) => {
  const id = select.dataset.statusFamily;
  const index = Number(select.dataset.statusIndex);
  const fam = findFamily(id);
  const member = fam?.members?.[index];
  if (!member) return;

  const status = select.value;
  const previous = { status: member.status, byAdmin: member.byAdmin };

  // Otimista: atualiza números e card na hora, o GitHub grava em segundo plano
  Object.assign(member, { status, byAdmin: status !== 'pending' });
  renderStats();
  renderFilters();
  select.className = `status-select status-select--${status} is-saving`;
  select.disabled = true;

  try {
    const saved = await api('PATCH', { id, member: { index, name: member.name }, status });
    Object.assign(fam, saved);
    toast(`${member.name}: ${STATUS_LABEL[status]}`);
  } catch (err) {
    Object.assign(member, previous);
    if (err.status !== 401) toast(`Não foi possível salvar. ${err.message}`, 'error');
    if (err.status === 409) loadFamilies({ silent: true });
  } finally {
    renderStats();
    renderFilters();
    refreshCard(id);
    if (state.view === 'table') renderList();
  }
};

const toggleDelivered = async (input) => {
  const id = input.dataset.deliver;
  const fam = findFamily(id);
  if (!fam) return;

  const delivered = input.checked;
  const previous = { delivered: fam.delivered, deliveredAt: fam.deliveredAt };

  // Atualização otimista: o check responde na hora, o GitHub grava em segundo plano
  Object.assign(fam, { delivered, deliveredAt: delivered ? new Date().toISOString() : null });
  renderStats();
  renderFilters();
  input.closest('.deliver').classList.add('is-saving');

  try {
    const saved = await api('PATCH', { id, delivered });
    Object.assign(fam, { delivered: saved.delivered, deliveredAt: saved.deliveredAt });
    toast(delivered ? `${fam.familyName}: entregue ✓` : `${fam.familyName}: entrega desmarcada`);
  } catch (err) {
    Object.assign(fam, previous);
    if (err.status !== 401) toast(`Não foi possível salvar a entrega. ${err.message}`, 'error');
  } finally {
    renderStats();
    renderFilters();
    refreshCard(id, { focusDeliver: true });
  }
};

/* ═══════════════════════════════════════════════════════
   NOVO / EDITAR CONVITE
   ═══════════════════════════════════════════════════════ */
const blankMember = () => ({ name: '', isChild: false, status: 'pending' });

// "Pedro:c" → criança (atalho mantido do formulário antigo)
const parseMemberText = (raw) => {
  const clean = raw.trim();
  const isChild = /:c$/i.test(clean);
  return { name: isChild ? clean.slice(0, -2).trim() : clean, isChild, status: 'pending' };
};

const renderMemberEditor = (focusIndex = null) => {
  const list = $('#memberEditor');
  list.innerHTML = state.draftMembers.map((m, i) => {
    const answered = m.status && m.status !== 'pending';
    return `
      <li class="member-row">
        <input class="input" type="text" value="${escapeHtml(m.name)}" data-member="${i}" placeholder="Nome do convidado" aria-label="Nome do integrante ${i + 1}" autocomplete="off">
        <label class="member-row__child">
          <input type="checkbox" data-child="${i}" ${m.isChild ? 'checked' : ''}> Criança
        </label>
        <button type="button" class="icon-btn icon-btn--danger" data-remove="${i}" aria-label="Remover integrante ${i + 1}" title="Remover">${ICONS.close}</button>
        ${answered ? `<span class="member-row__status"><i class="dot dot--${m.status}"></i>Já respondeu: ${STATUS_LABEL[m.status]}</span>` : ''}
      </li>`;
  }).join('');

  if (focusIndex !== null) list.querySelector(`[data-member="${focusIndex}"]`)?.focus();
};

const showFormError = (message) => {
  const el = $('#familyFormError');
  el.textContent = message;
  el.hidden = !message;
};

const openFamilyDialog = (id = null) => {
  const fam = id ? findFamily(id) : null;
  state.editingId = fam ? fam.id : null;
  state.draftMembers = fam && fam.members.length ? fam.members.map((m) => ({ ...m })) : [blankMember()];

  $('#familyDialogTitle').textContent = fam ? 'Editar convite' : 'Novo convite';
  $('#familySubmit').textContent = fam ? 'Salvar alterações' : 'Criar convite';
  $('#familyName').value = fam ? fam.familyName : '';
  $('#displayName').value = fam?.displayName || '';
  showFormError('');
  renderMemberEditor();

  $('#familyDialog').showModal();
  (fam ? $('#memberEditor .input') : $('#familyName')).focus();
};

const addMember = (members = [blankMember()], afterIndex = state.draftMembers.length - 1) => {
  state.draftMembers.splice(afterIndex + 1, 0, ...members);
  renderMemberEditor(afterIndex + members.length);
};

const submitFamily = async (event) => {
  event.preventDefault();
  const familyName = $('#familyName').value.trim();
  const displayName = $('#displayName').value.trim();
  const members = state.draftMembers
    .map((m) => ({ ...m, name: m.name.trim() }))
    .filter((m) => m.name);

  if (!familyName) { showFormError('Dê um nome ao convite.'); $('#familyName').focus(); return; }
  if (!members.length) { showFormError('Inclua pelo menos um integrante.'); $('#memberEditor .input')?.focus(); return; }
  showFormError('');

  const btn = $('#familySubmit');
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Salvando…';

  try {
    const editing = state.editingId;
    const saved = editing
      ? await api('PUT', { id: editing, familyName, displayName, members })
      : await api('POST', { familyName, displayName, members: members.map(({ name, isChild }) => ({ name, isChild })) });

    $('#familyDialog').close();
    await loadFamilies({ silent: true });
    // A leitura do GitHub logo após a escrita pode vir defasada por alguns segundos
    if (!editing && !findFamily(saved.id)) {
      state.families.push(saved);
      renderAll();
    }

    if (editing) {
      toast('Alterações salvas');
    } else {
      toast('Convite criado ✓');
      openQR(saved.id); // próximo passo natural: gerar o QR para entregar
    }
  } catch (err) {
    if (err.status !== 401) showFormError(`Não foi possível salvar. ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
};

/* ═══════════════════════════════════════════════════════
   EXCLUIR
   ═══════════════════════════════════════════════════════ */
const confirmDialog = ({ title, html, okLabel = 'Excluir' }) => new Promise((resolve) => {
  const dlg = $('#confirmDialog');
  $('#confirmTitle').textContent = title;
  $('#confirmText').innerHTML = html;
  dlg.querySelector('[value="ok"]').textContent = okLabel;

  // Lê o botão clicado no submit (síncrono). O evento "close" pode chegar
  // atrasado e ler o returnValue de outra abertura do mesmo dialog.
  const form = dlg.querySelector('form');
  const finish = (ok) => {
    form.removeEventListener('submit', onSubmit);
    dlg.removeEventListener('close', onClose);
    resolve(ok);
  };
  const onSubmit = (e) => finish(e.submitter?.value === 'ok');
  const onClose = () => { if (!dlg.open) finish(false); }; // Esc ou clique fora
  form.addEventListener('submit', onSubmit);
  dlg.addEventListener('close', onClose);
  dlg.showModal();
});

const deleteFamily = async (id) => {
  const fam = findFamily(id);
  if (!fam) return;

  const people = (fam.members || []).length;
  const ok = await confirmDialog({
    title: 'Excluir convite?',
    html: `O convite <strong>${escapeHtml(fam.familyName)}</strong>${people ? ` e as respostas de ${plural(people, 'pessoa', 'pessoas')}` : ''} serão apagados.`
      + (fam.delivered ? '<br><br><strong>Este convite já foi entregue</strong> — o QR Code dele deixará de funcionar.' : ''),
  });
  if (!ok) return;

  try {
    await api('DELETE', { id });
    state.families = state.families.filter((f) => f.id !== id);
    renderAll();
    toast('Convite excluído');
  } catch (err) {
    if (err.status !== 401) toast(`Não foi possível excluir. ${err.message}`, 'error');
  }
};

/* ═══════════════════════════════════════════════════════
   QR CODE
   ═══════════════════════════════════════════════════════ */
const openQR = (id) => {
  const fam = findFamily(id);
  if (!fam) return;
  state.qrFamilyId = id;
  const url = rsvpUrl(id);

  $('#qrTitle').textContent = fam.familyName;
  $('#qrUrl').textContent = url.replace(/^https?:\/\//, '');

  const box = $('#qrcodeContainer');
  box.innerHTML = '';
  // Gerado em alta resolução para impressão; o CSS reduz na tela
  new QRCode(box, { text: url, width: 640, height: 640, colorDark: QR_COLOR, colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });

  $('#qrDialog').showModal();
};

// Baixa o PNG com margem branca ("quiet zone") — sem ela alguns celulares não leem o QR impresso
const downloadQR = () => {
  const fam = findFamily(state.qrFamilyId);
  const src = $('#qrcodeContainer canvas');
  if (!fam || !src) return;

  const pad = Math.round(src.width * 0.08);
  const out = document.createElement('canvas');
  out.width = src.width + pad * 2;
  out.height = src.height + pad * 2;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(src, pad, pad);

  const link = document.createElement('a');
  link.download = `qrcode-${slugify(fam.familyName)}.png`;
  link.href = out.toDataURL('image/png');
  link.click();
};

const inviteMessage = (fam) => {
  const many = (fam.members || []).length !== 1;
  return [
    `${friendlyName(fam)}, com muita alegria ${many ? 'convidamos vocês' : 'convidamos você'} para o nosso casamento! 💍`,
    '',
    '📅 09 de janeiro de 2027, às 19h',
    '📍 Churrascaria Kieza · Marília — SP',
    '',
    'Abra seu convite e confirme sua presença:',
    inviteUrl(fam.id),
    '',
    'Gustavo & Lara',
  ].join('\n');
};

// Abre o WhatsApp com a mensagem pronta; você só escolhe o contato
const sendInvite = (id) => {
  const fam = findFamily(id);
  if (!fam) return;
  window.open(`https://wa.me/?text=${encodeURIComponent(inviteMessage(fam))}`, '_blank', 'noopener');
};

/* ═══════════════════════════════════════════════════════
   LOGIN / SESSÃO
   ═══════════════════════════════════════════════════════ */
const showApp = () => {
  $('#loginScreen').hidden = true;
  $('#adminContent').hidden = false;
  loadFamilies();
};

function logout(message = '') {
  sessionStorage.removeItem(AUTH_KEY);
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  $('#adminContent').hidden = true;
  $('#loginScreen').hidden = false;
  $('#password').value = '';
  const err = $('#loginError');
  err.textContent = message;
  err.hidden = !message;
}

const handleLogin = async (event) => {
  event.preventDefault();
  const user = $('#username').value.trim();
  const pass = $('#password').value;
  const err = $('#loginError');
  const btn = $('#loginBtn');

  if (!user || !pass) {
    err.textContent = 'Preencha usuário e senha.';
    err.hidden = false;
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Entrando…';
  err.hidden = true;

  // A senha é validada no servidor (ADMIN_AUTH na Vercel) — nada fica exposto no JS
  const auth = `${user}:${pass}`;
  try {
    await api('POST', { action: 'login' }, auth);
    sessionStorage.setItem(AUTH_KEY, auth);
    showApp();
  } catch (e) {
    err.textContent = e.status === 401 ? 'Usuário ou senha incorretos.' : 'Não foi possível conectar. Tente novamente.';
    err.hidden = false;
    $('#password').select();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
};

/* ═══════════════════════════════════════════════════════
   EVENTOS
   ═══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  $('#loginForm').addEventListener('submit', handleLogin);
  $('#logoutBtn').addEventListener('click', () => logout());
  $('#refreshBtn').addEventListener('click', () => loadFamilies());

  document.querySelectorAll('[data-action="new"]').forEach((btn) => btn.addEventListener('click', () => openFamilyDialog()));

  // Cards ↔ Tabela
  document.querySelectorAll('[data-view]').forEach((btn) => btn.addEventListener('click', () => setView(btn.dataset.view)));

  // Busca e filtros
  $('#search').addEventListener('input', (e) => { state.query = e.target.value; renderList(); });
  $('#filters').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter]');
    if (!chip) return;
    state.filter = chip.dataset.filter;
    renderFilters();
    renderList();
  });

  // Ações dos cards (delegação)
  const grid = $('#familyGrid');
  grid.addEventListener('change', (e) => {
    if (e.target.matches('[data-deliver]')) toggleDelivered(e.target);
    if (e.target.matches('[data-status-family]')) setMemberStatus(e.target);
  });
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const { act, id } = btn.dataset;
    if (act === 'send') sendInvite(id);
    if (act === 'copyInvite') copyText(inviteUrl(id), 'Link do convite copiado');
    if (act === 'qr') openQR(id);
    if (act === 'edit') openFamilyDialog(id);
    if (act === 'delete') deleteFamily(id);
  });

  // Editor de integrantes
  const editor = $('#memberEditor');
  editor.addEventListener('input', (e) => {
    if (e.target.dataset.member !== undefined) state.draftMembers[e.target.dataset.member].name = e.target.value;
  });
  editor.addEventListener('change', (e) => {
    if (e.target.dataset.child !== undefined) state.draftMembers[e.target.dataset.child].isChild = e.target.checked;
  });
  editor.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    state.draftMembers.splice(Number(btn.dataset.remove), 1);
    if (!state.draftMembers.length) state.draftMembers.push(blankMember());
    renderMemberEditor(Math.max(0, Number(btn.dataset.remove) - 1));
  });
  // Enter no nome → próximo integrante (ou cria um novo), em vez de enviar o formulário
  editor.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.dataset.member === undefined) return;
    e.preventDefault();
    const i = Number(e.target.dataset.member);
    if (i === state.draftMembers.length - 1) {
      if (e.target.value.trim()) addMember();
    } else {
      editor.querySelector(`[data-member="${i + 1}"]`).focus();
    }
  });
  // Colar "João, Maria, Enzo:c" cria um integrante por nome
  editor.addEventListener('paste', (e) => {
    if (e.target.dataset.member === undefined) return;
    const text = e.clipboardData.getData('text');
    if (!/[,;\n]/.test(text)) return;
    e.preventDefault();
    const parsed = text.split(/[,;\n]/).map(parseMemberText).filter((m) => m.name);
    if (!parsed.length) return;
    const i = Number(e.target.dataset.member);
    const [first, ...rest] = parsed;
    const current = state.draftMembers[i];
    state.draftMembers[i] = current.name.trim() ? current : { ...current, ...first };
    addMember(current.name.trim() ? parsed : rest, i);
  });
  $('#familyName').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    $('#displayName').focus();
  });
  $('#displayName').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    $('#memberEditor .input')?.focus();
  });
  $('#addMemberBtn').addEventListener('click', () => addMember());
  $('#familyForm').addEventListener('submit', submitFamily);

  // QR
  $('#qrDownload').addEventListener('click', downloadQR);
  $('#qrShare').addEventListener('click', () => sendInvite(state.qrFamilyId));
  $('#qrUrl').addEventListener('click', () => copyText(rsvpUrl(state.qrFamilyId)));

  // Fechar dialogs: botão [data-close] ou clique no fundo escuro
  document.querySelectorAll('dialog').forEach((dlg) => {
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
    });
  });

  // Ao voltar para a aba, busca respostas novas (se a lista tiver mais de 30s)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && getAuth() && Date.now() - state.loadedAt > 30_000) {
      loadFamilies({ silent: true });
    }
  });

  // Sessão salva: entra direto e confirma a credencial em segundo plano
  if (getAuth()) {
    showApp();
    api('POST', { action: 'login' }).catch(() => {});
  } else {
    $('#username').focus();
  }
});
