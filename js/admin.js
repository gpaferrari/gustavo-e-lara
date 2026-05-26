document.addEventListener('DOMContentLoaded', () => {
  const adminForm = document.getElementById('adminForm');
  const tableBody = document.getElementById('adminTableBody');

  const loadFamilies = async () => {
    try {
      const res = await fetch('/api/admin');
      const families = await res.json();
      tableBody.innerHTML = '';

      families.forEach(f => {
        const tr = document.createElement('tr');
        const membersHtml = f.members.map(m => `
          <span class="status-badge ${m.confirmed ? 'status-confirmed' : 'status-pending'}">
            ${m.name} ${m.confirmed ? '✓' : '?'}
          </span>
        `).join(' ');

        const rsvpUrl = `${window.location.origin}/rsvp.html?id=${f.id}`;

        tr.innerHTML = `
          <td><strong>${f.familyName}</strong></td>
          <td>${membersHtml}</td>
          <td>${f.lastUpdate ? 'Atualizado' : 'Pendente'}</td>
          <td>
            <span class="copy-link" onclick="copyToClipboard('${rsvpUrl}')">Copiar Link</span>
            <br>
            <small><a href="${rsvpUrl}" target="_blank">Abrir</a></small>
          </td>
        `;
        tableBody.appendChild(tr);
      });
    } catch (err) {
      console.error('Erro ao carregar:', err);
    }
  };

  adminForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const familyName = document.getElementById('familyName').value;
    const members = document.getElementById('members').value.split(',');

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyName, members })
      });

      if (res.ok) {
        adminForm.reset();
        loadFamilies();
      }
    } catch (err) {
      alert('Erro ao criar convite.');
    }
  });

  window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => alert('Link copiado!'));
  };

  loadFamilies();
});
