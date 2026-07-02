document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  const content = document.getElementById('content');
  const success = document.getElementById('success');
  const deadlineExpired = document.getElementById('deadlineExpired');
  const familyNameSpan = document.getElementById('familyName');
  const membersList = document.getElementById('membersList');
  const rsvpForm = document.getElementById('rsvpForm');
  const submitBtn = document.getElementById('submitBtn');
  const countdownEl = document.getElementById('countdown');

  const DEADLINE_DATE = new Date(2026, 10, 30, 23, 59, 59);

  const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const updateCountdown = () => {
    const now = new Date();
    const diff = DEADLINE_DATE - now;

    if (diff <= 0) {
      if (content.style.display === 'block') {
        content.style.display = 'none';
        deadlineExpired.style.display = 'block';
      }
      return true;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    countdownEl.textContent = `Faltam ${days}d ${hours}h ${mins}m`;
    return false;
  };

  if (!id) {
    loading.style.display = 'none';
    error.style.display = 'block';
    return;
  }

  const isExpired = updateCountdown();
  if (isExpired) {
    loading.style.display = 'none';
    deadlineExpired.style.display = 'block';
    return;
  }

  const timer = setInterval(() => {
    if (updateCountdown()) clearInterval(timer);
  }, 60000);

  try {
    const response = await fetch(`/api/rsvp?id=${id}`);
    if (!response.ok) throw new Error();

    const family = await response.json();
    loading.style.display = 'none';
    content.style.display = 'block';
    familyNameSpan.textContent = family.familyName;

    family.members.forEach((member, index) => {
      const div = document.createElement('div');
      div.className = 'member-item';
      div.dataset.child = member.isChild ? 'true' : 'false';
      div.innerHTML = `
        <div class="member-header">
          <span class="member-number">${index + 1}</span>
          <div>
            <span class="member-name">${escapeHtml(member.name)}</span>
            <span class="member-role">Selecione a resposta deste convidado</span>
            ${member.isChild ? '<span class="child-pill">Criança</span>' : ''}
          </div>
        </div>
        <div class="member-controls" data-index="${index}">
          <button type="button" class="status-btn ${member.status === 'confirmed' ? 'active' : ''}" data-status="confirmed" aria-label="${escapeHtml(member.name)} vai ao casamento">
            <span class="status-btn__label">Vou</span>
            <span class="status-btn__hint">Confirmar</span>
          </button>
          <button type="button" class="status-btn ${member.status === 'declined' ? 'active' : ''}" data-status="declined" aria-label="${escapeHtml(member.name)} não vai ao casamento">
            <span class="status-btn__label">Não vou</span>
            <span class="status-btn__hint">Avisar</span>
          </button>
          <button type="button" class="status-btn ${member.status === 'pending' || !member.status ? 'active' : ''}" data-status="pending" aria-label="${escapeHtml(member.name)} ainda está pendente">
            <span class="status-btn__label">Pendente</span>
            <span class="status-btn__hint">Decidir depois</span>
          </button>
        </div>
      `;
      membersList.appendChild(div);
    });

    membersList.addEventListener('click', (event) => {
      const button = event.target.closest('.status-btn');
      if (!button) return;

      const parent = button.parentElement;
      parent.querySelectorAll('.status-btn').forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');
    });

    rsvpForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (new Date() > DEADLINE_DATE) {
        alert('Desculpe, o prazo de confirmação encerrou enquanto você preenchia o formulário.');
        location.reload();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Salvando...';

      const updatedMembers = Array.from(membersList.querySelectorAll('.member-controls')).map((controls) => {
        const memberDiv = controls.parentElement;
        const name = memberDiv.querySelector('.member-name').textContent.trim();
        const status = controls.querySelector('.status-btn.active').dataset.status;
        const isChild = memberDiv.dataset.child === 'true';

        return { name, status, isChild };
      });

      try {
        const res = await fetch('/api/rsvp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, members: updatedMembers }),
        });

        if (res.ok) {
          content.style.display = 'none';
          success.style.display = 'block';
          clearInterval(timer);
        } else {
          alert('Erro ao salvar. Tente novamente.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Salvar confirmação';
        }
      } catch (err) {
        alert('Erro de conexão.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Salvar confirmação';
      }
    });
  } catch (err) {
    loading.style.display = 'none';
    error.style.display = 'block';
  }
});
