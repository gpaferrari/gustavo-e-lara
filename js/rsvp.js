document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  const content = document.getElementById('content');
  const success = document.getElementById('success');
  const familyNameSpan = document.getElementById('familyName');
  const membersList = document.getElementById('membersList');
  const rsvpForm = document.getElementById('rsvpForm');
  const submitBtn = document.getElementById('submitBtn');

  if (!id) {
    loading.style.display = 'none';
    error.style.display = 'block';
    return;
  }

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
        <span class="member-name">${member.name}</span>
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
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando...';

      const updatedMembers = Array.from(membersList.querySelectorAll('.member-controls')).map(controls => {
        const name = controls.parentElement.querySelector('.member-name').textContent;
        const status = controls.querySelector('.status-btn.active').dataset.status;
        return { name, status };
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
