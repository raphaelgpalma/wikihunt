const TOKEN_KEY = 'wikihunt_admin_token';
let token = localStorage.getItem(TOKEN_KEY);

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s.replace(' ', 'T') + 'Z').toLocaleString('pt-BR');
}

async function api(path, opts = {}) {
  const res = await fetch(`/api/admin${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) {
    logout();
    throw new Error('Sessão expirada, faça login novamente.');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro inesperado.');
  return data;
}

function showError(id, message) {
  const el = $(id);
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 5000);
}

function logout() {
  token = null;
  localStorage.removeItem(TOKEN_KEY);
  $('#dashboard').style.display = 'none';
  $('#loginScreen').style.display = 'block';
  $('#topbarRight').innerHTML = '';
}

async function boot() {
  if (!token) return logout();
  try {
    const me = await api('/me');
    $('#loginScreen').style.display = 'none';
    $('#dashboard').style.display = 'block';
    $('#topbarRight').innerHTML = `<span class="muted" style="margin-right:12px">${me.username}</span><button id="logoutBtn" class="btn btn-ghost btn-sm">Sair</button>`;
    $('#logoutBtn').onclick = logout;
    loadCodes();
    loadPairs();
    loadRooms();
    loadAdmins();
  } catch {
    logout();
  }
}

$('#loginBtn').addEventListener('click', async () => {
  const username = $('#loginUser').value.trim();
  const password = $('#loginPass').value;
  try {
    const data = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(async (r) => {
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      return body;
    });
    token = data.token;
    localStorage.setItem(TOKEN_KEY, token);
    boot();
  } catch (err) {
    showError('#loginError', err.message);
  }
});

$$('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.tab-btn').forEach((b) => b.classList.remove('active'));
    $$('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    $(`#tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ---- Room codes ----
async function loadCodes() {
  const codes = await api('/room-codes');
  const wrap = $('#codesTableWrap');
  if (!codes.length) {
    wrap.innerHTML = '<div class="empty-note">Nenhum código gerado ainda.</div>';
    return;
  }
  const statusLabel = { available: 'Disponível', claimed: 'Em uso', closed: 'Encerrado' };
  wrap.innerHTML = `<table class="data-table"><thead><tr>
    <th>Código</th><th>Rótulo</th><th>Status</th><th>Criado em</th><th></th>
  </tr></thead><tbody>
    ${codes.map((c) => `
      <tr>
        <td><code class="code-chip">${c.code}</code></td>
        <td class="muted">${c.label || '—'}</td>
        <td><span class="pill-status pill-${c.status}">${statusLabel[c.status]}</span></td>
        <td class="faint">${fmtDate(c.created_at)}</td>
        <td>${c.status === 'available' ? `<button class="btn btn-danger btn-sm" data-del-code="${c.id}">Remover</button>` : ''}</td>
      </tr>`).join('')}
  </tbody></table>`;

  wrap.querySelectorAll('[data-del-code]').forEach((btn) => {
    btn.onclick = async () => {
      await api(`/room-codes/${btn.dataset.delCode}`, { method: 'DELETE' });
      loadCodes();
    };
  });
}

$('#genCodesBtn').addEventListener('click', async () => {
  try {
    const count = $('#codeCount').value;
    const label = $('#codeLabel').value;
    await api('/room-codes', { method: 'POST', body: JSON.stringify({ count, label }) });
    $('#codeLabel').value = '';
    loadCodes();
  } catch (err) {
    showError('#codesError', err.message);
  }
});

// ---- Word pairs ----
const difficultyLabel = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil', chaos: 'Caos' };

async function loadPairs() {
  const pairs = await api('/word-pairs');
  const wrap = $('#pairsTableWrap');
  if (!pairs.length) {
    wrap.innerHTML = '<div class="empty-note">Nenhum par cadastrado ainda.</div>';
    return;
  }
  wrap.innerHTML = `<table class="data-table"><thead><tr>
    <th>Início</th><th>Alvo</th><th>Dificuldade</th><th></th>
  </tr></thead><tbody>
    ${pairs.map((p) => `
      <tr>
        <td>${p.start_title}</td>
        <td>${p.target_title}</td>
        <td><span class="badge badge-${p.difficulty}">${difficultyLabel[p.difficulty]}</span></td>
        <td><button class="btn btn-danger btn-sm" data-del-pair="${p.id}">Remover</button></td>
      </tr>`).join('')}
  </tbody></table>`;

  wrap.querySelectorAll('[data-del-pair]').forEach((btn) => {
    btn.onclick = async () => {
      await api(`/word-pairs/${btn.dataset.delPair}`, { method: 'DELETE' });
      loadPairs();
    };
  });
}

$('#addPairBtn').addEventListener('click', async () => {
  const btn = $('#addPairBtn');
  const startTitle = $('#pairStart').value.trim();
  const targetTitle = $('#pairTarget').value.trim();
  const difficulty = $('#pairDifficulty').value;
  if (!startTitle || !targetTitle) return showError('#pairsError', 'Preencha os dois artigos.');
  btn.disabled = true;
  btn.textContent = 'Verificando na Wikipedia...';
  try {
    await api('/word-pairs', { method: 'POST', body: JSON.stringify({ startTitle, targetTitle, difficulty }) });
    $('#pairStart').value = '';
    $('#pairTarget').value = '';
    loadPairs();
  } catch (err) {
    showError('#pairsError', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Adicionar par';
  }
});

// ---- Active rooms ----
async function loadRooms() {
  const rooms = await api('/rooms');
  const wrap = $('#roomsTableWrap');
  if (!rooms.length) {
    wrap.innerHTML = '<div class="empty-note">Nenhuma sala ativa no momento.</div>';
    return;
  }
  wrap.innerHTML = `<table class="data-table"><thead><tr>
    <th>Código</th><th>Host</th><th>Status</th><th>Dificuldade</th><th>Rodada</th><th>Jogadores</th>
  </tr></thead><tbody>
    ${rooms.map((r) => `
      <tr>
        <td><code class="code-chip">${r.code}</code></td>
        <td>${r.hostName}</td>
        <td class="muted">${r.status}</td>
        <td><span class="badge badge-${r.difficulty}">${difficultyLabel[r.difficulty]}</span></td>
        <td class="muted">${r.roundIndex + 1 < 1 ? '—' : r.roundIndex + 1}/${r.rounds}</td>
        <td class="muted">${r.players}</td>
      </tr>`).join('')}
  </tbody></table>`;
}
$('#refreshRoomsBtn').addEventListener('click', loadRooms);

// ---- Admins ----
async function loadAdmins() {
  const admins = await api('/admins');
  const wrap = $('#adminsTableWrap');
  wrap.innerHTML = `<table class="data-table"><thead><tr>
    <th>Usuário</th><th>Criado em</th><th></th>
  </tr></thead><tbody>
    ${admins.map((a) => `
      <tr>
        <td>${a.username}</td>
        <td class="faint">${fmtDate(a.created_at)}</td>
        <td>${admins.length > 1 ? `<button class="btn btn-danger btn-sm" data-del-admin="${a.id}">Remover</button>` : ''}</td>
      </tr>`).join('')}
  </tbody></table>`;

  wrap.querySelectorAll('[data-del-admin]').forEach((btn) => {
    btn.onclick = async () => {
      try {
        await api(`/admins/${btn.dataset.delAdmin}`, { method: 'DELETE' });
        loadAdmins();
      } catch (err) {
        showError('#adminsError', err.message);
      }
    };
  });
}

$('#addAdminBtn').addEventListener('click', async () => {
  const username = $('#newAdminUser').value.trim();
  const password = $('#newAdminPass').value;
  try {
    await api('/admins', { method: 'POST', body: JSON.stringify({ username, password }) });
    $('#newAdminUser').value = '';
    $('#newAdminPass').value = '';
    loadAdmins();
  } catch (err) {
    showError('#adminsError', err.message);
  }
});

boot();
