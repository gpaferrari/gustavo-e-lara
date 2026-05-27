/* ── Admin Logic ──────────────────────────────────── */
const loadFamilies = async () => {
  const familyGrid = document.getElementById('familyGrid');
  if (!familyGrid) return;

  try {
    const res = await fetch('/api/admin');
    const families = await res.json();
    
    // Safety check: if families is not an array (e.g., it's an error object), log it and stop.
    if (!Array.isArray(families)) {
      console.error('API did not return an array:', families);
      familyGrid.innerHTML = `<p style="color: red; padding: 20px;">Erro: ${families.error || 'Resposta inválida do servidor'}</p>`;
      return;
    }

    familyGrid.innerHTML = '';

    let total = 0, confirmed = 0, childrenTotal = 0, payingTotal = 0;

    families.forEach(f => {
      const familyCard = document.createElement('div');
      familyCard.className = 'family-card';
      
      const isComplete = f.members.every(m => m.status !== 'pending');
      const rsvpUrl = `${window.location.origin}/rsvp.html?id=${f.id}`;
      
      let membersHtml = '';
      f.members.forEach(m => {
        total++;
        if (m.isChild) childrenTotal++;
        else payingTotal++;

        if (m.status === 'confirmed') confirmed++;

        const statusClass = `status-${m.status || 'pending'}`;
        const statusText = m.status === 'confirmed' ? 'Vou' : (m.status === 'declined' ? 'Não vou' : 'Pendente');
        const childTag = m.isChild ? '<small style="background:#e3f2fd;color:#1976d2;padding:2px 6px;border-radius:4px;font-size:10px;margin-left:5px;">CRIANÇA</small>' : '';
        
        membersHtml += `
          <li class="member-row">
            <span>${m.name}${childTag}</span>
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
          <span class="card-link" onclick="copyToClipboard('${rsvpUrl}')">Link</span>
          <span class="card-link" onclick="showQRCode('${f.familyName}', '${rsvpUrl}')">QR</span>
          <span class="card-link" onclick="openEditModal('${f.id}')">Editar</span>
          <span class="card-link" onclick="deleteFamily('${f.id}')" style="color: #e57373;">Excluir</span>
        </div>
      `;
      familyGrid.appendChild(familyCard);
      });

      // Update Stats
      document.getElementById('statTotal').textContent = total;
      document.getElementById('statPaying').textContent = payingTotal;
      document.getElementById('statChildren').textContent = childrenTotal;
      document.getElementById('statConfirmed').textContent = confirmed;

      } catch (err) {
      console.error('Erro ao carregar:', err);
      }
      };

      /* ── Delete/Edit Logic ────────────────────────────── */
      window.deleteFamily = async (id) => {
      if (!confirm('Tem certeza que deseja excluir este convite inteiro?')) return;

      const auth = sessionStorage.getItem('adminAuth');
      try {
      const res = await fetch('/api/admin', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, auth })
      });
      if (res.ok) loadFamilies();
      } catch (err) {
      alert('Erro ao excluir.');
      }
      };

      let editingFamilyId = null;
      let editingMembers = [];

      window.openEditModal = async (id) => {
      editingFamilyId = id;
      const auth = sessionStorage.getItem('adminAuth');
      try {
      // Find the family in the local list or fetch (for simplicity we use index)
      const res = await fetch('/api/admin');
      const families = await res.json();
      const family = families.find(f => f.id === id);

      if (family) {
      document.getElementById('editFamilyName').value = family.familyName;
      editingMembers = [...family.members];
      renderEditMembers();
      document.getElementById('editModal').style.display = 'flex';
      }
      } catch (err) {
      alert('Erro ao abrir edição.');
      }
      };

      const renderEditMembers = () => {
      const list = document.getElementById('editMembersList');
      list.innerHTML = '';
      editingMembers.forEach((m, index) => {
      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.alignItems = 'center';
      div.style.gap = '10px';
      div.style.marginBottom = '10px';
      div.innerHTML = `
      <input type="text" value="${m.name}" onchange="updateMemberName(${index}, this.value)" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
      <label style="font-size: 10px; display: flex; align-items: center; gap: 4px;">
        <input type="checkbox" ${m.isChild ? 'checked' : ''} onchange="toggleMemberChild(${index}, this.checked)"> Criança
      </label>
      <button onclick="removeMemberFromEdit(${index})" style="background: none; border: none; color: #e57373; cursor: pointer;">✕</button>
      `;
      list.appendChild(div);
      });
      };

      window.updateMemberName = (index, newName) => {
      editingMembers[index].name = newName;
      };

      window.toggleMemberChild = (index, isChild) => {
        editingMembers[index].isChild = isChild;
      };

      window.removeMemberFromEdit = (index) => {
      editingMembers.splice(index, 1);
      renderEditMembers();
      };

      window.addMemberToEdit = () => {
      editingMembers.push({ name: '', status: 'pending', isChild: false });
      renderEditMembers();
      };

      window.closeEditModal = () => {
      document.getElementById('editModal').style.display = 'none';
      };

      window.saveFamilyEdit = async () => {
      const familyName = document.getElementById('editFamilyName').value;
      const auth = sessionStorage.getItem('adminAuth');

      try {
      const res = await fetch('/api/admin', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingFamilyId, familyName, members: editingMembers, auth })
      });
      if (res.ok) {
      closeEditModal();
      loadFamilies();
      }
      } catch (err) {
      alert('Erro ao salvar.');
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
      const membersRaw = document.getElementById('members').value.split(',');
      
      const members = membersRaw.map(m => {
        const clean = m.trim();
        const isChild = clean.toLowerCase().endsWith(':c');
        return {
          name: isChild ? clean.slice(0, -2).trim() : clean,
          isChild: isChild
        };
      }).filter(m => m.name !== '');

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
