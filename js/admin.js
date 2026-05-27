/* ── Admin Logic ──────────────────────────────────── */
const loadFamilies = async () => {
  const familyGrid = document.getElementById('familyGrid');
  if (!familyGrid) return;

  try {
    const res = await fetch('/api/admin');
    const families = await res.json();
    familyGrid.innerHTML = '';

    let total = 0, confirmed = 0, declined = 0, pending = 0;

    families.forEach(f => {
      const familyCard = document.createElement('div');
      familyCard.className = 'family-card';
      
      const isComplete = f.members.every(m => m.status !== 'pending');
      const rsvpUrl = `${window.location.origin}/rsvp.html?id=${f.id}`;
      
      let membersHtml = '';
      f.members.forEach(m => {
        total++;
        if (m.status === 'confirmed') confirmed++;
        else if (m.status === 'declined') declined++;
        else pending++;

        const statusClass = `status-${m.status || 'pending'}`;
        const statusText = m.status === 'confirmed' ? 'Vou' : (m.status === 'declined' ? 'Não vou' : 'Pendente');
        
        membersHtml += `
          <li class="member-row">
            <span>${m.name}</span>
            <span class="member-status ${statusClass}">${statusText}</span>
          </li>
        `;
      });

      familyCard.innerHTML = `
        <div class="family-card__header">
          <h4 class="family-card__title">${f.familyName}</h4>
          <span class="completion-icon ${isComplete ? 'icon-done' : 'icon-pending'}">
            ${isComplete ? '✓' : '○'}
          </span>
        </div>
        <ul class="member-list">${membersHtml}</ul>
        <div class="card-actions">
          <span class="card-link" onclick="copyToClipboard('${rsvpUrl}')">Copiar Link</span>
          <span class="card-link" onclick="showQRCode('${f.familyName}', '${rsvpUrl}')">QR Code</span>
        </div>
      `;
      familyGrid.appendChild(familyCard);
    });

    // Update Stats
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statConfirmed').textContent = confirmed;
    document.getElementById('statDeclined').textContent = declined;
    document.getElementById('statPending').textContent = pending;

  } catch (err) {
    console.error('Erro ao carregar:', err);
  }
};

/* ── Authentication ────────────────────────────────── */
window.handleLogin = () => {
  const user = document.getElementById('username').value;
  const pass = document.getElementById('password').value;

  if (user === 'GueLara' && pass === '1104') {
    sessionStorage.setItem('adminAuth', 'GueLara:1104');
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminContent').style.display = 'block';
    loadFamilies();
  } else {
    alert('Usuário ou senha incorretos.');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('adminAuth') === 'GueLara:1104') {
    const loginScreen = document.getElementById('loginScreen');
    const adminContent = document.getElementById('adminContent');
    if (loginScreen) loginScreen.style.display = 'none';
    if (adminContent) adminContent.style.display = 'block';
    loadFamilies();
  }

  const adminForm = document.getElementById('adminForm');
  if (adminForm) {
    adminForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const familyName = document.getElementById('familyName').value;
      const members = document.getElementById('members').value.split(',').map(m => m.trim()).filter(m => m !== '');
      const auth = sessionStorage.getItem('adminAuth');

      try {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ familyName, members, auth })
        });

        if (res.ok) {
          adminForm.reset();
          loadFamilies();
        } else {
          alert('Erro ao criar convite. Verifique sua sessão.');
        }
      } catch (err) {
        alert('Erro de conexão.');
      }
    });
  }

  window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => alert('Link copiado!'));
  };

  /* ── QR Code Logic ────────────────────────────────── */
  window.showQRCode = (name, url) => {
    const modal = document.getElementById('qrModal');
    const container = document.getElementById('qrcode-container');
    const title = document.getElementById('modalTitle');
    const urlDisplay = document.getElementById('modalUrl');

    title.textContent = `Convite - ${name}`;
    urlDisplay.textContent = url;
    container.innerHTML = '';
    
    new QRCode(container, {
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

  window.onclick = (e) => {
    if (e.target.id === 'qrModal') closeModal();
  };
});
