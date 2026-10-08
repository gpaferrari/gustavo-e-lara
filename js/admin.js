/* ═══════════════════════════════════════════════════════
   Gustavo & Lara — Painel de Convidados
   Vanilla JS · consome /api/admin
   ═══════════════════════════════════════════════════════ */

const API = '/api/admin';
const AUTH_KEY = 'adminAuth';
const QR_COLOR = '#5C3D2E'; // mesma cor dos QR codes já impressos

const $ = (sel, root = document) => root.querySelector(sel);

const state = {
  families: [],
  filter: 'all',
  query: '',
  loadedAt: 0,
  editingId: null,
  draftMembers: [],
  qrFamilyId: null,
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
const slugify = (text) => normalize(text).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'convite';
const findFamily = (id) => state.families.find((f) => f.id === id);

const STATUS_LABEL = { confirmed: 'Vou', declined: 'Não vou', pending: 'Pendente' };

const ICONS = {
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
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

const memberHtml = (m) => {
  const status = m.status || 'pending';
  return `
    <li class="fam__member">
      <i class="dot dot--${status}" aria-hidden="true"></i>
      <span class="fam__member-name">${escapeHtml(m.name)}${m.isChild ? '<span class="tag">criança</span>' : ''}</span>
      <span class="fam__member-status fam__member-status--${status}">${STATUS_LABEL[status] || 'Pendente'}</span>
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
      ? `<ul class="fam__members">${s.members.map(memberHtml).join('')}</ul>`
      : '<p class="fam__empty">Quem abrir este QR não verá nenhum nome. Toque em <b>Editar</b> para incluir os integrantes.</p>'}

    <footer class="fam__foot">
      <label class="deliver" title="Marque quando entregar o convite">
        <input type="checkbox" class="deliver__input" data-deliver="${id}" ${f.delivered ? 'checked' : ''}>
        <span class="deliver__box">${ICONS.check}</span>
        <span class="deliver__text">Entregue</span>
      </label>
      <div class="fam__actions">
        <button type="button" class="icon-btn" data-act="copy" data-id="${id}" aria-label="Copiar link de ${name}" title="Copiar link">${ICONS.link}</button>
        <button type="button" class="icon-btn" data-act="qr" data-id="${id}" aria-label="QR Code de ${name}" title="QR Code">${ICONS.qr}</button>
        <button type="button" class="icon-btn" data-act="edit" data-id="${id}" aria-label="Editar ${name}" title="Editar">${ICONS.edit}</button>
        <button type="button" class="icon-btn icon-btn--danger" data-act="delete" data-id="${id}" aria-label="Excluir ${name}" title="Excluir">${ICONS.trash}</button>
      </div>
    </footer>`;
  return card;
};

const renderList = () => {
  const grid = $('#familyGrid');
  const flt = FILTERS.find((x) => x.id === state.filter) || FILTERS[0];
  const q = normalize(state.query);

  const visible = state.families
    .filter((f) => flt.test(f, summarize(f)))
    .filter((f) => !q || normalize(`${f.familyName} ${f.displayName || ''}`).includes(q) || (f.members || []).some((m) => normalize(m.name).includes(q)))
    .sort((a, b) => a.familyName.localeCompare(b.familyName, 'pt-BR', { sensitivity: 'base' }));

  grid.setAttribute('aria-busy', 'false');
  grid.replaceChildren(...visible.map(createCard));

  if (!visible.length) {
    grid.innerHTML = state.families.length
      ? '<div class="empty-state"><strong>Nada por aqui</strong>Nenhum convite corresponde à busca ou ao filtro.</div>'
      : '<div class="empty-state"><strong>Nenhum convite ainda</strong>Toque em “Novo convite” para começar.</div>';
  }

  const filtered = q || state.filter !== 'all';
  $('#resultInfo').textContent = filtered ? `Mostrando ${visible.length} de ${plural(state.families.length, 'convite', 'convites')}` : '';
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

const shareInvite = async () => {
  const fam = findFamily(state.qrFamilyId);
  if (!fam) return;
  const url = rsvpUrl(fam.id);
  const text = `Olá! Com muita alegria convidamos vocês para o nosso casamento 💍\nConfirme a presença pelo link:`;

  if (navigator.share) {
    try { await navigator.share({ title: 'Gustavo & Lara', text, url }); } catch { /* compartilhamento cancelado */ }
    return;
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener');
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
  });
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const { act, id } = btn.dataset;
    if (act === 'copy') copyText(rsvpUrl(id));
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
  $('#qrShare').addEventListener('click', shareInvite);
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
