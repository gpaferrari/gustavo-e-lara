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

  // Configuração da Data Limite (Ano, Mês [0-11], Dia, Hora, Minuto)
  const DEADLINE_DATE = new Date(2026, 10, 30, 23, 59, 59); // 30 de Novembro de 2026 às 23:59:59

  const updateCountdown = () => {
    const now = new Date();
    const diff = DEADLINE_DATE - now;

    if (diff <= 0) {
      if (content.style.display === 'block') {
        content.style.display = 'none';
        deadlineExpired.style.display = 'block';
      }
      return true; // Expired
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    countdownEl.textContent = `Faltam ${days}d ${hours}h ${mins}m`;
    return false; // Not expired
  };

  if (!id) {
    loading.style.display = 'none';
    error.style.display = 'block';
    return;
  }

  // Verifica se o prazo já expirou antes de buscar os dados
  const isExpired = updateCountdown();
  if (isExpired) {
    loading.style.display = 'none';
    deadlineExpired.style.display = 'block';
    return;
  }

  // Inicia o contador
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
      div.innerHTML = `
        <span class="member-name">${member.name}${member.isChild ? ' <small style="color:var(--sage); font-size: 0.7rem;">(Criança)</small>' : ''}</span>
        <div class="member-controls" data-index="${index}">
          <button type="button" class="status-btn ${member.status === 'confirmed' ? 'active' : ''}" data-status="confirmed">Vou</button>
          <button type="button" class="status-btn ${member.status === 'declined' ? 'active' : ''}" data-status="declined">Não vou</button>
          <button type="button" class="status-btn ${member.status === 'pending' || !member.status ? 'active' : ''}" data-status="pending">Pendente</button>
        </div>
      `;
      membersList.appendChild(div);
    });

    // Handle button clicks
    membersList.addEventListener('click', (e) => {
      if (e.target.classList.contains('status-btn')) {
        const parent = e.target.parentElement;
        parent.querySelectorAll('.status-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
      }
    });

    rsvpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Re-verifica o prazo no momento do envio para segurança
      if (new Date() > DEADLINE_DATE) {
        alert('Desculpe, o prazo de confirmação encerrou enquanto você preenchia o formulário.');
        location.reload();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando...';

      const updatedMembers = Array.from(membersList.querySelectorAll('.member-controls')).map(controls => {
        const memberDiv = controls.parentElement;
        const name = memberDiv.querySelector('.member-name').textContent.split(' (')[0]; // Remove a tag de criança do nome
        const status = controls.querySelector('.status-btn.active').dataset.status;
        const isChild = memberDiv.innerHTML.includes('(Criança)');
        return { name, status, isChild };
      });

      try {
        const res = await fetch('/api/rsvp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, members: updatedMembers })
        });

        if (res.ok) {
          content.style.display = 'none';
          success.style.display = 'block';
          clearInterval(timer);
        } else {
          alert('Erro ao salvar. Tente novamente.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Confirmar Presença';
        }
      } catch (err) {
        alert('Erro de conexão.');
        submitBtn.disabled = false;
      }
    });

  } catch (err) {
    loading.style.display = 'none';
    error.style.display = 'block';
  }
});
