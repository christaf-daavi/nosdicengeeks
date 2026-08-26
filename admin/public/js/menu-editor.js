// ── Auth ─────────────────────────────────────────────────────────
const token = checkAuth();
if (!token) throw new Error('No auth');

// ── State ────────────────────────────────────────────────────────
let menuItems = [];

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

// ── Menú ─────────────────────────────────────────────────────────
function renderMenu() {
  const list = document.getElementById('menuList');
  if (!menuItems.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;padding:12px 0;">No hay ítems en el menú.</p>';
    return;
  }
  list.innerHTML = menuItems.map((item, i) => `
    <div class="menu-item">
      <div class="form-group">
        <label>Texto</label>
        <input type="text" data-i="${i}" data-field="label" value="${escHtml(item.label)}" placeholder="Inicio" />
      </div>
      <div class="form-group">
        <label>Enlace</label>
        <input type="text" data-i="${i}" data-field="href" value="${escHtml(item.href)}" placeholder="/" />
      </div>
      <div class="menu-item__actions">
        <button type="button" class="btn-icon" title="Subir" onclick="moveMenuItem(${i},-1)" ${i === 0 ? 'disabled' : ''}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
        </button>
        <button type="button" class="btn-icon" title="Bajar" onclick="moveMenuItem(${i},1)" ${i === menuItems.length - 1 ? 'disabled' : ''}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
        </button>
        <button type="button" class="btn-icon" title="Eliminar" onclick="removeMenuItem(${i})">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>`).join('');

  list.querySelectorAll('input[data-field]').forEach((input) => {
    input.addEventListener('input', () => {
      const i = Number(input.dataset.i);
      menuItems[i][input.dataset.field] = input.value;
    });
  });
}

function addMenuItem() {
  menuItems.push({ label: '', href: '/' });
  renderMenu();
}

function removeMenuItem(i) {
  menuItems.splice(i, 1);
  renderMenu();
}

function moveMenuItem(i, delta) {
  const j = i + delta;
  if (j < 0 || j >= menuItems.length) return;
  [menuItems[i], menuItems[j]] = [menuItems[j], menuItems[i]];
  renderMenu();
}

window.addMenuItem    = addMenuItem;
window.removeMenuItem = removeMenuItem;
window.moveMenuItem   = moveMenuItem;

// ── Load ─────────────────────────────────────────────────────────
async function loadMenu() {
  try {
    const res = await apiFetch('/api/site-content');
    if (!res) return;
    if (!res.ok) { showTopAlert('error', 'No se pudo cargar el menú'); return; }

    const data = await res.json();
    menuItems = Array.isArray(data.menu) ? [...data.menu] : [];
    renderMenu();
  } catch (err) {
    showTopAlert('error', `Error cargando el menú: ${err.message}`);
  }
}

// ── Save ─────────────────────────────────────────────────────────
async function saveMenu() {
  const saveBtn = document.getElementById('saveBtn');
  const spinner = document.getElementById('saveSpinner');
  const log     = document.getElementById('buildLog');

  saveBtn.disabled = true;
  spinner.classList.add('show');
  setSaveStatus('Guardando y publicando…');
  log.classList.remove('show');

  const body = {
    menu: menuItems
      .map((item) => ({ label: (item.label || '').trim(), href: (item.href || '').trim() }))
      .filter((item) => item.label && item.href),
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
      showTopAlert('success', 'Menú guardado y blog publicado correctamente');
      setSaveStatus(`Guardado a las ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`, '#10b981');
    } else {
      showTopAlert('error', 'Se guardó el menú, pero el build falló');
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

window.saveMenu = saveMenu;

// ── Init ─────────────────────────────────────────────────────────
loadMenu();
