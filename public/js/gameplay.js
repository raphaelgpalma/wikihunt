// Shared "actually playing the game" logic, used identically by a plain
// player (room.js) and by the host, who is always a player too (host.js).
// Both pages carry the same #gameScreen / #resultScreen / #finalScreen
// markup and IDs; this module owns everything that happens inside them.

const $ = (sel) => document.querySelector(sel);

// Best-effort only: modern browsers reserve Ctrl/Cmd+F for their own
// find-in-page UI at a level above page JS, so preventDefault() here is
// ignored in Chrome, Firefox, and Edge. This only has any effect in
// browsers/embeddings that don't special-case the shortcut. Registered once
// here so both the player page and the host-who-plays page get it.
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault();
  }
});

const SCREENS = ['setupScreen', 'joinScreen', 'lobbyScreen', 'resultScreen', 'finalScreen', 'gameScreen'];
export function showScreen(id) {
  SCREENS.forEach((s) => {
    const el = document.getElementById(s);
    if (el) el.style.display = s === id ? '' : 'none';
  });
}

function normalize(t) { return String(t || '').trim().toLowerCase(); }

// ---- Flap Display: renders a value as physical split-flap cells and only
// flips the characters that actually changed, mimicking a real departure
// board instead of just swapping text.
function renderFlap(el, text) {
  const value = String(text);
  if (el.dataset.flapValue === value) return;
  const chars = value.split('');
  const existing = el.querySelectorAll('.flap-cell');
  if (!el.dataset.flapValue || existing.length !== chars.length) {
    el.innerHTML = chars.map((c) => `<span class="flap-cell">${c}</span>`).join('');
  } else {
    chars.forEach((c, i) => {
      const cell = existing[i];
      if (cell.textContent === c) return;
      cell.classList.add('flipping');
      setTimeout(() => { cell.textContent = c; }, 90);
      setTimeout(() => { cell.classList.remove('flipping'); }, 190);
    });
  }
  el.dataset.flapValue = value;
}

const STATUS_LABEL = { far: 'A caminho', near: 'Embarque', done: 'Partiu' };
function statusLedClass(status) {
  return status === 'done' ? 'led-done' : status === 'near' ? 'led-near' : 'led-far';
}

/**
 * Wires every in-game listener onto `socket`. `ctx` is a plain object the
 * caller keeps mutating as it learns who "I" am:
 *   ctx.myToken   - this connection's own player token
 *   ctx.myName    - this connection's own player name
 *   ctx.roomLang  - 'pt' | 'en', set via setRoomLang()
 * Returns { setRoomLang, resumeIntoRound } for the caller's join/resume flow.
 */
export function initGameplay(socket, ctx) {
  let currentTargetTitle = null;
  let currentTargetTitleSet = new Set();
  let finished = false;
  let clicks = 0;
  let timerInterval = null;
  let currentEndsAt = null;
  let nextRoundInterval = null;
  let myStatus = null;
  let breadcrumbTrail = [];
  let currentResultRoundIndex = null;
  let navToken = 0;

  function setRoomLang(room) {
    ctx.roomLang = room?.config?.lang === 'en' ? 'en' : 'pt';
    const link = document.getElementById('wikiSiteStyles');
    if (link) link.href = `https://${ctx.roomLang}.wikipedia.org/w/load.php?lang=${ctx.roomLang}&modules=site.styles&only=styles&skin=vector-2022`;
  }

  // ---- Dark reading mode (article pane only; the app shell is always dark) ----
  const DARK_READING_KEY = 'wikihunt_dark_reading';
  function applyDarkReading(on) {
    $('#articleContent').classList.toggle('dark-reading', on);
    $('#darkModeToggle').setAttribute('aria-pressed', String(on));
    $('#darkModeToggle').textContent = on ? 'DIA' : 'NOITE';
  }
  function initDarkReading() {
    let on = false;
    try { on = localStorage.getItem(DARK_READING_KEY) === '1'; } catch { /* ignore */ }
    applyDarkReading(on);
  }
  $('#darkModeToggle').addEventListener('click', () => {
    const on = !$('#articleContent').classList.contains('dark-reading');
    applyDarkReading(on);
    try { localStorage.setItem(DARK_READING_KEY, on ? '1' : '0'); } catch { /* ignore */ }
  });
  initDarkReading();

  function setTarget(title, aliases) {
    currentTargetTitle = title;
    currentTargetTitleSet = new Set([title, ...(aliases || [])].map(normalize));
  }

  const TOAST_CAP = 3;
  function toast(message, variant = 'info') {
    const area = $('#toastArea');
    const el = document.createElement('div');
    el.className = `toast ${variant === 'info' ? '' : variant}`.trim();
    el.setAttribute('role', 'status');
    el.textContent = message;
    area.appendChild(el);
    setTimeout(() => el.remove(), 3500);
    const toasts = area.querySelectorAll('.toast');
    if (toasts.length > TOAST_CAP) toasts[0].remove();
  }

  function renderSidebar(players) {
    const list = $('#sidebarPlayerList');
    list.innerHTML = players
      .map((p) => `<div class="player-chip ${p.connected ? '' : 'offline'} ${p.id === ctx.myToken ? 'me' : ''}" data-player-id="${p.id}"><span class="led ${statusLedClass(p.status)}"></span>${p.name}${p.isHost ? ' <span class="faint">(host)</span>' : ''}${p.id === ctx.myToken ? ' <span class="faint">(você)</span>' : ''}<span class="chip-status">${STATUS_LABEL[p.status] || 'A caminho'}</span></div>`)
      .join('') || '<div class="empty-note">Sem jogadores.</div>';
  }

  socket.on('room:update', (room) => {
    if (room.status === 'playing') renderSidebar(room.players);
  });

  socket.on('player:statusUpdate', ({ playerId, status }) => {
    const chip = document.querySelector(`#sidebarPlayerList [data-player-id="${playerId}"]`);
    if (!chip) return;
    chip.querySelector('.led').className = `led ${statusLedClass(status)}`;
    chip.querySelector('.chip-status').textContent = STATUS_LABEL[status] || 'A caminho';
  });

  // ---- Timer ----
  function stopTimer() { if (timerInterval) clearInterval(timerInterval); }
  function startTimer(endsAt) {
    stopTimer();
    currentEndsAt = endsAt;
    const totalMs = Math.max(endsAt - Date.now(), 1000);
    const tick = () => {
      const remaining = Math.max(currentEndsAt - Date.now(), 0);
      const urgent = remaining <= 15000 && remaining > 0;
      renderFlap($('#timerText'), Math.ceil(remaining / 1000));
      $('#timerText').querySelectorAll('.flap-cell').forEach((c) => c.classList.toggle('urgent', urgent));
      const pct = Math.min((remaining / totalMs) * 100, 100);
      const bar = $('#timerBar');
      bar.style.transform = `scaleX(${pct / 100})`;
      bar.classList.toggle('urgent', urgent);
      if (remaining <= 0) stopTimer();
    };
    tick();
    timerInterval = setInterval(tick, 200);
  }

  // ---- Article navigation ----
  function renderBreadcrumb(trail) {
    const el = $('#breadcrumb');
    el.innerHTML = trail
      .map((entry, i) => {
        const isCurrent = i === trail.length - 1;
        const crumb = isCurrent
          ? `<span class="crumb">${entry.label}</span>`
          : `<button type="button" class="crumb crumb-link" data-crumb-index="${i}">${entry.label}</button>`;
        return crumb + (isCurrent ? '' : '<span class="sep">›</span>');
      })
      .join('');
  }

  $('#breadcrumb').addEventListener('click', (e) => {
    const crumb = e.target.closest('.crumb-link');
    if (!crumb || finished) return;
    const entry = breadcrumbTrail[parseInt(crumb.dataset.crumbIndex, 10)];
    if (!entry) return;
    clicks += 1;
    $('#clickCount').textContent = clicks;
    navigateTo(entry.title);
  });

  async function navigateTo(title) {
    const myTok = ++navToken;
    $('#articleLoading').style.display = 'flex';
    $('#articleContent').style.visibility = 'hidden';
    try {
      const res = await fetch(`/api/wiki/page?title=${encodeURIComponent(title)}&lang=${ctx.roomLang}`);
      const article = await res.json();
      if (!res.ok) throw new Error(article.error);
      if (myTok !== navToken) return; // a newer navigation superseded this one

      $('#articleContent').innerHTML = article.html;
      breadcrumbTrail.push({ title: article.title, label: article.displayTitle || article.title });
      renderBreadcrumb(breadcrumbTrail);

      if (!finished && currentTargetTitleSet.has(normalize(article.title))) {
        handleFinish();
      } else if (!finished) {
        reportProgress(article.title);
      }
    } catch (err) {
      if (myTok !== navToken) return;
      $('#articleContent').innerHTML = `<p class="nav-error">Erro ao carregar artigo: ${err.message}</p>`;
    } finally {
      if (myTok === navToken) {
        $('#articleLoading').style.display = 'none';
        $('#articleContent').style.visibility = 'visible';
      }
    }
  }

  $('#articleContent').addEventListener('click', (e) => {
    const link = e.target.closest('a.wiki-link');
    if (!link || finished) return;
    e.preventDefault();
    const title = link.dataset.wikiTitle;
    if (!title) return;
    clicks += 1;
    $('#clickCount').textContent = clicks;
    navigateTo(title);
  });

  function reportProgress(title) {
    const links = document.querySelectorAll('#articleContent a.wiki-link[data-wiki-title]');
    const isNear = [...links].some((a) => currentTargetTitleSet.has(normalize(a.dataset.wikiTitle)));
    myStatus = isNear ? 'near' : 'far';
    socket.emit('player:status', { status: myStatus, title, clicks });
  }

  function handleFinish() {
    finished = true;
    myStatus = 'done';
    $('#finishedOverlay').style.display = 'flex';
    $('#finishedStats').textContent = '';
    socket.emit('player:reachedTarget', { clicks }, (res) => {
      if (res?.ok) {
        $('#finishedStats').textContent = `${res.rank}º lugar — +${res.points} pontos — ${clicks} cliques`;
      }
    });
  }

  // ---- Round lifecycle ----
  socket.on('round:start', (data) => {
    clearInterval(nextRoundInterval);
    finished = false;
    myStatus = null;
    clicks = 0;
    breadcrumbTrail = [];
    setTarget(data.targetTitle, data.targetAliases);
    $('#clickCount').textContent = '0';
    $('#startTitleDisplay').textContent = data.startTitle;
    $('#targetTitle').textContent = data.targetTitle;
    $('#roundLabel').textContent = `${data.roundIndex + 1}/${data.totalRounds}`;
    $('#finishedOverlay').style.display = 'none';
    if (data.players) renderSidebar(data.players);
    showScreen('gameScreen');
    startTimer(data.endsAt);
    navigateTo(data.startTitle);
  });

  socket.on('round:timeAdjusted', (data) => {
    startTimer(data.endsAt);
    toast('Alguém chegou! Restam 30 segundos para todos.', 'hype');
  });

  socket.on('round:playerFinished', (data) => {
    if (data.name !== ctx.myName) toast(`${data.name} chegou em ${data.rank}º lugar!`, 'hype');
  });

  function renderLeaderboardInto(el, rows) {
    el.innerHTML = rows
      .map((r) => `<div class="leaderboard-row ${r.place === 1 ? 'top1' : ''} ${r.id === ctx.myToken ? 'me' : ''}"><span><span class="place">${r.place}º</span>${r.name}${r.isHost ? ' <span class="faint">(host)</span>' : ''}</span><span class="score">${r.score} pts</span></div>`)
      .join('');
  }

  socket.on('round:end', (data) => {
    stopTimer();
    $('#resultTitle').textContent = `${data.startTitle} → ${data.targetTitle}`;
    $('#resultList').innerHTML = data.results
      .map((r) => r.rank
        ? `<div class="result-item"><span><span class="rank">#${r.rank}</span>${r.name}</span><span class="faint">${(r.timeMs / 1000).toFixed(1)}s · ${r.clicks} cliques · +${r.points}pts</span></div>`
        : `<div class="result-item dnf"><span>${r.name}</span><span class="faint">não chegou a tempo</span></div>`
      ).join('');
    renderLeaderboardInto($('#resultLeaderboard'), data.leaderboard);
    showScreen('resultScreen');

    currentResultRoundIndex = data.roundIndex;
    const pathBox = $('#shortestPathBox');
    pathBox.innerHTML = '<span class="faint">Calculando o caminho mais curto...</span>';

    let secondsLeft = 10;
    const note = $('#nextRoundNote');
    note.textContent = `Próxima rodada em ${secondsLeft}s...`;
    nextRoundInterval = setInterval(() => {
      secondsLeft -= 1;
      note.textContent = secondsLeft > 0 ? `Próxima rodada em ${secondsLeft}s...` : 'Preparando próxima rodada...';
      if (secondsLeft <= 0) clearInterval(nextRoundInterval);
    }, 1000);
  });

  socket.on('round:shortestPath', (data) => {
    if (data.roundIndex !== currentResultRoundIndex) return; // arrived after we moved on
    const pathBox = $('#shortestPathBox');
    if (!pathBox) return;
    if (!data.path) {
      pathBox.innerHTML = '<span class="faint">Não foi possível calcular o caminho mais curto desta vez.</span>';
      return;
    }
    pathBox.innerHTML = data.path
      .map((title, i) => {
        const node = `<span class="sp-node">${title}</span>`;
        return i < data.path.length - 1 ? node + '<span class="sp-arrow">→</span>' : node;
      })
      .join('');
  });

  socket.on('game:end', (data) => {
    clearInterval(nextRoundInterval);
    renderLeaderboardInto($('#finalLeaderboard'), data.leaderboard);
    showScreen('finalScreen');
  });

  socket.on('room:closed', (data) => {
    ctx.onRoomClosed?.();
    alert(data.reason || 'A sala foi encerrada.');
    window.location.href = '/';
  });

  socket.on('host:disconnected', () => {
    toast('Host desconectado, tentando reconectar...', 'warn');
    const banner = $('#hostBanner');
    if (banner) { banner.textContent = 'Host desconectado — a sala fecha em até 45s se ele não voltar.'; banner.style.display = 'flex'; }
  });
  socket.on('host:reconnected', () => {
    toast('Host reconectado.', 'hype');
    const banner = $('#hostBanner');
    if (banner) banner.style.display = 'none';
  });

  // ---- Resume after refresh (F5) ----
  function resumeIntoRound(currentRound, resume) {
    setTarget(currentRound.targetTitle, currentRound.targetAliases);
    $('#startTitleDisplay').textContent = currentRound.startTitle;
    $('#targetTitle').textContent = currentRound.targetTitle;
    $('#roundLabel').textContent = `${currentRound.roundIndex + 1}/${currentRound.totalRounds}`;
    breadcrumbTrail = [];
    clicks = resume?.clicks || 0;
    $('#clickCount').textContent = clicks;
    myStatus = resume?.status || 'far';
    showScreen('gameScreen');
    startTimer(currentRound.endsAt);

    if (resume?.status === 'done') {
      finished = true;
      $('#finishedOverlay').style.display = 'flex';
      $('#finishedStats').textContent = 'Aguardando o fim da rodada...';
    } else {
      finished = false;
      $('#finishedOverlay').style.display = 'none';
      navigateTo(resume?.title || currentRound.startTitle);
    }
  }

  return { setRoomLang, resumeIntoRound, renderLeaderboardInto };
}
