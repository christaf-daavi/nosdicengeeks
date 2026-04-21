// Verifica autenticación al cargar
const token = checkAuth();
if (!token) throw new Error('No auth');

// ── Sidebar móvil ────────────────────────────────────────────────
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('sidebar');
  const toggle  = document.getElementById('menuToggle');
  if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== toggle) {
    sidebar.classList.remove('open');
  }
});

// ── Helpers ──────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function badgeFor(draft) {
  if (draft === true)  return '<span class="badge badge-draft">Borrador</span>';
  if (draft === false) return '<span class="badge badge-published">Publicado</span>';
  return '<span class="badge badge-unpublish">Despublicado</span>';
}

function showAlert(id, type, msg) {
  const el = document.getElementById(id);
  el.className = `alert alert-${type} show`;
  el.textContent = msg;
}
function hideAlert(id) {
  document.getElementById(id).classList.remove('show');
}

// ── Cargar posts ─────────────────────────────────────────────────
async function loadPosts() {
  const tbody = document.getElementById('postsBody');
  try {
    const res = await apiFetch('/api/posts');
    if (!res) return;
    const posts = await res.json();

    if (!posts.length) {
      tbody.innerHTML = `<tr><td colspan="5">
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p>No hay posts todavía. <a href="/editor.html">Crea el primero</a>.</p>
        </div>
      </td></tr>`;
      return;
    }

    tbody.innerHTML = posts.map((p) => {
      const tags = (p.tags || []).slice(0, 3).map((t) => `<span class="tag">${escHtml(t)}</span>`).join('');
      const moreTags = p.tags && p.tags.length > 3 ? `<span class="tag">+${p.tags.length - 3}</span>` : '';
      return `
        <tr data-file="${escHtml(p.filename)}">
          <td class="col-status">${badgeFor(p.draft)}</td>
          <td>
            <div class="post-title">${escHtml(p.title)}</div>
            ${p.description ? `<div class="post-desc">${escHtml(p.description.substring(0, 80))}${p.description.length > 80 ? '…' : ''}</div>` : ''}
          </td>
          <td class="col-date">${formatDate(p.pubDate)}</td>
          <td class="col-tags">${tags}${moreTags}</td>
          <td class="col-actions">
            <div style="display:flex;gap:6px;align-items:center;">
              <a href="/editor.html?file=${encodeURIComponent(p.filename)}"
                 class="btn-icon" title="Editar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </a>
              ${p.draft === false ? `
              <button class="btn-icon" title="Despublicar"
                      onclick="unpublishPost('${escHtml(p.filename)}', this)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              </button>` : ''}
              <button class="btn-icon" title="Eliminar"
                      style="color:var(--brand-pink);border-color:rgba(216,17,89,.3);"
                      onclick="openDeleteModal('${escHtml(p.filename)}', '${escHtml(p.title.replace(/'/g, "\\'"))}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5">
      <div class="empty-state"><p>Error al cargar posts: ${escHtml(err.message)}</p></div>
    </td></tr>`;
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Despublicar ──────────────────────────────────────────────────
async function unpublishPost(filename, btn) {
  btn.disabled = true;
  try {
    const res = await apiFetch(`/api/posts/${encodeURIComponent(filename)}/unpublish`, { method: 'PATCH' });
    if (!res) return;
    if (res.ok) {
      await loadPosts();
    } else {
      const d = await res.json();
      showAlert('buildAlert', 'error', d.error || 'Error al despublicar');
    }
  } finally {
    btn.disabled = false;
  }
}

// ── Delete modal ─────────────────────────────────────────────────
let _pendingDelete = null;

function openDeleteModal(filename, title) {
  _pendingDelete = filename;
  document.getElementById('deleteModalTitle').textContent = title;
  document.getElementById('deleteModal').classList.add('open');
}
function closeDeleteModal() {
  _pendingDelete = null;
  document.getElementById('deleteModal').classList.remove('open');
}
// Cierra con clic fuera del modal
document.getElementById('deleteModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeDeleteModal();
});

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
  if (!_pendingDelete) return;
  const filename = _pendingDelete;
  const btn = document.getElementById('confirmDeleteBtn');
  btn.disabled = true;
  btn.textContent = 'Eliminando…';
  try {
    const res = await apiFetch(`/api/posts/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    closeDeleteModal();
    if (res && res.ok) {
      await loadPosts();
    } else {
      const d = res ? await res.json() : {};
      showAlert('buildAlert', 'error', d.error || 'Error al eliminar');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Eliminar';
  }
});

// ── Build ────────────────────────────────────────────────────────
async function triggerBuild() {
  const btn     = document.getElementById('buildBtn');
  const spinner = document.getElementById('buildSpinner');
  const log     = document.getElementById('buildLog');

  hideAlert('buildAlert');
  log.classList.remove('show');
  btn.disabled = true;
  spinner.classList.add('show');

  try {
    const res = await apiFetch('/api/build', { method: 'POST' });
    if (!res) return;
    const data = await res.json();

    if (res.ok && data.success) {
      showAlert('buildAlert', 'success', 'Blog publicado correctamente.');
      if (data.output) {
        log.textContent = data.output;
        log.classList.add('show');
      }
    } else {
      showAlert('buildAlert', 'error', data.error || 'El build falló.');
      if (data.output) {
        log.textContent = data.output;
        log.classList.add('show');
      }
    }
  } catch (err) {
    showAlert('buildAlert', 'error', `Error de red: ${err.message}`);
  } finally {
    btn.disabled = false;
    spinner.classList.remove('show');
  }
}

// ── Init ─────────────────────────────────────────────────────────
loadPosts();
