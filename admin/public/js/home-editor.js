// ── Auth ─────────────────────────────────────────────────────────
const token = checkAuth();
if (!token) throw new Error('No auth');

// ── State ────────────────────────────────────────────────────────
let topics = [];

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showTopAlert(type, msg) {
  const el = document.getElementById('topAlert');
  el.className = `alert alert-${type} show`;
  el.textContent = msg;
}

function setSaveStatus(text, color) {
  const el = document.getElementById('saveStatus');
  el.textContent = text;
  el.style.color = color || 'var(--text-muted)';
}

// ── Sidebar móvil ────────────────────────────────────────────────
document.getElementById('menuToggle').addEventListener('click', () =>
  document.getElementById('sidebar').classList.toggle('open')
);
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('sidebar');
  const toggle  = document.getElementById('menuToggle');
  if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== toggle)
    sidebar.classList.remove('open');
});

// ── Topics ───────────────────────────────────────────────────────
function renderTopics() {
  const list = document.getElementById('topicsList');
  list.innerHTML = topics.map((t, i) => `
    <div class="topic-item">
      <div class="form-group">
        <label>Icono</label>
        <input type="text" data-i="${i}" data-field="icon" value="${escHtml(t.icon)}" placeholder="📱" />
      </div>
      <div class="form-group">
        <label>Nombre</label>
        <input type="text" data-i="${i}" data-field="name" value="${escHtml(t.name)}" placeholder="Tecnología" />
      </div>
      <div class="form-group">
        <label>Descripción</label>
        <input type="text" data-i="${i}" data-field="desc" value="${escHtml(t.desc)}" placeholder="Lo último en tech…" />
      </div>
      <div class="topic-item__actions">
        <button type="button" class="btn-icon" title="Subir" onclick="moveTopic(${i},-1)" ${i === 0 ? 'disabled' : ''}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
        </button>
        <button type="button" class="btn-icon" title="Bajar" onclick="moveTopic(${i},1)" ${i === topics.length - 1 ? 'disabled' : ''}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
        </button>
        <button type="button" class="btn-icon" title="Eliminar" onclick="removeTopic(${i})">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>`).join('');

  list.querySelectorAll('input[data-field]').forEach((input) => {
    input.addEventListener('input', () => {
      const i = Number(input.dataset.i);
      topics[i][input.dataset.field] = input.value;
    });
  });
}

function addTopic() {
  topics.push({ icon: '✨', name: '', desc: '' });
  renderTopics();
}

function removeTopic(i) {
  topics.splice(i, 1);
  renderTopics();
}

function moveTopic(i, delta) {
  const j = i + delta;
  if (j < 0 || j >= topics.length) return;
  [topics[i], topics[j]] = [topics[j], topics[i]];
  renderTopics();
}

window.addTopic    = addTopic;
window.removeTopic = removeTopic;
window.moveTopic   = moveTopic;

// ── Load ─────────────────────────────────────────────────────────
async function loadHome() {
  try {
    const res = await apiFetch('/api/site-content');
    if (!res) return;
    if (!res.ok) { showTopAlert('error', 'No se pudo cargar el contenido del home'); return; }

    const data = await res.json();

    document.getElementById('heroTitle').value       = data.hero?.title       || '';
    document.getElementById('heroTitleAccent').value = data.hero?.titleAccent || '';
    document.getElementById('heroSubtitle').value     = data.hero?.subtitle    || '';

    document.getElementById('topicsSectionTitle').value = data.topics?.sectionTitle || '';
    topics = Array.isArray(data.topics?.items) ? [...data.topics.items] : [];
    renderTopics();

    document.getElementById('latestPostsTitle').value    = data.latestPosts?.title    || '';
    document.getElementById('latestPostsSubtitle').value = data.latestPosts?.subtitle || '';
  } catch (err) {
    showTopAlert('error', `Error cargando el home: ${err.message}`);
  }
}

// ── Save ─────────────────────────────────────────────────────────
async function saveHome() {
  const saveBtn = document.getElementById('saveBtn');
  const spinner = document.getElementById('saveSpinner');
  const log     = document.getElementById('buildLog');

  saveBtn.disabled = true;
  spinner.classList.add('show');
  setSaveStatus('Guardando y publicando…');
  log.classList.remove('show');

  const body = {
    hero: {
      title:       document.getElementById('heroTitle').value.trim(),
      titleAccent: document.getElementById('heroTitleAccent').value.trim(),
      subtitle:    document.getElementById('heroSubtitle').value.trim(),
    },
    topics: {
      sectionTitle: document.getElementById('topicsSectionTitle').value.trim(),
      items: topics
        .map((t) => ({ icon: (t.icon || '').trim(), name: (t.name || '').trim(), desc: (t.desc || '').trim() }))
        .filter((t) => t.name),
    },
    latestPosts: {
      title:    document.getElementById('latestPostsTitle').value.trim(),
      subtitle: document.getElementById('latestPostsSubtitle').value.trim(),
    },
  };

  try {
    const res = await apiFetch('/api/site-content', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    if (!res) return;
    const data = await res.json();

    if (!res.ok) {
      showTopAlert('error', data.error || 'Error al guardar');
      setSaveStatus('Error al guardar', 'var(--brand-pink)');
      return;
    }

    if (data.build?.success) {
      showTopAlert('success', 'Home guardado y blog publicado correctamente');
      setSaveStatus(`Guardado a las ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`, '#10b981');
    } else {
      showTopAlert('error', 'Se guardó el contenido, pero el build falló');
      setSaveStatus('Guardado, build con errores', 'var(--brand-pink)');
    }
    if (data.build?.output) {
      log.textContent = data.build.output;
      log.classList.add('show');
    }
  } catch (err) {
    showTopAlert('error', `Error de red: ${err.message}`);
    setSaveStatus('Error', 'var(--brand-pink)');
  } finally {
    saveBtn.disabled = false;
    spinner.classList.remove('show');
  }
}

window.saveHome = saveHome;

// ── Init ─────────────────────────────────────────────────────────
loadHome();
