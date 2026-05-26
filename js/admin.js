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
            <span class="copy-link" onclick="showQRCode('${f.familyName}', '${rsvpUrl}')">Gerar QR Code</span>
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
    const members = document.getElementById('members').value.split(',').map(m => m.trim()).filter(m => m !== '');

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

  /* ── QR Code Logic ────────────────────────────────── */
  let currentQRCode = null;

  window.showQRCode = (name, url) => {
    const modal = document.getElementById('qrModal');
    const container = document.getElementById('qrcode-container');
    const title = document.getElementById('modalTitle');
    const urlDisplay = document.getElementById('modalUrl');

    title.textContent = `Convite - ${name}`;
    urlDisplay.textContent = url;
    container.innerHTML = '';
    
    currentQRCode = new QRCode(container, {
      text: url,
      width: 256,
      height: 256,
      colorDark : "#5C3D2E",
      colorLight : "#ffffff",
      correctLevel : QRCode.CorrectLevel.H
    });

    modal.style.display = 'flex';
  };

  window.closeModal = () => {
    document.getElementById('qrModal').style.display = 'none';
  };

  window.downloadQR = () => {
    const canvas = document.querySelector('#qrcode-container canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `qrcode-${document.getElementById('modalTitle').textContent}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    }
  };

  // Fechar modal ao clicar fora
  window.onclick = (event) => {
    const modal = document.getElementById('qrModal');
    if (event.target == modal) closeModal();
  };

  loadFamilies();
});
