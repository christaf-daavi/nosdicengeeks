import { createEditor, wireToolbar } from '/js/tiptap-editor.js';

// ── Auth ─────────────────────────────────────────────────────────
const token = checkAuth();
if (!token) throw new Error('No auth');

const SITE_URL = 'https://dev.nosdicengeeks.com';

// ── State ────────────────────────────────────────────────────────
const params     = new URLSearchParams(window.location.search);
const pageFile   = params.get('page');
let   editor     = null;
let   pendingContentImageInsert = null;

if (!pageFile) {
  document.body.innerHTML = '<p style="padding:24px;color:var(--text-muted);">Falta el parámetro ?page=archivo.md</p>';
  throw new Error('Missing page param');
}

// ── Exponer al scope global ANTES que nada pueda fallar ───────────
// (los onclick= del HTML son globales; si esto se declarara al final
// del archivo, un error en la inicialización de TipTap más abajo
// dejaría estas funciones sin definir y rompería todos los botones)
window.savePage = (...args) => savePage(...args);
window.triggerBuild = (...args) => triggerBuild(...args);
window.openOgImageModal = (...args) => openOgImageModal(...args);
window.closeOgImageModal = (...args) => closeOgImageModal(...args);
window.closeContentImageModal = (...args) => closeContentImageModal(...args);

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

// ── TipTap init ────────────────────────────────────────────────────
// Envuelto en try/catch: si falla la carga de TipTap (CDN, red, etc.)
// el resto del editor (slug, título, guardado, carga de la página)
// debe seguir funcionando en lugar de abortar todo el módulo.
try {
  editor = createEditor(document.getElementById('editorContentArea'), {});
  wireToolbar(editor, document.getElementById('tiptapToolbar'), {
    onImageRequest: (insertFn) => openContentImageModal(insertFn),
  });
} catch (err) {
  console.error('Error al inicializar TipTap:', err);
  showTopAlert('error', `No se pudo cargar el editor de texto enriquecido: ${err.message}`, false);
}

// ── Helpers UI ───────────────────────────────────────────────────
function showTopAlert(type, msg, autohide = true) {
  const el = document.getElementById('topAlert');
  el.className = `alert alert-${type} show`;
  el.textContent = msg;
  if (autohide) setTimeout(() => el.classList.remove('show'), 4000);
}

function setSaveStatus(msg, color = 'var(--text-muted)') {
  const el = document.getElementById('saveStatus');
  el.textContent = msg;
  el.style.color = color;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Slug ─────────────────────────────────────────────────────────
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function updateSlugPreview() {
  const slug = document.getElementById('pageSlug').value;
  document.getElementById('slugPreview').textContent = `${SITE_URL.replace('https://', '')}/${slug}`;
}

document.getElementById('pageSlug').addEventListener('input', updateSlugPreview);

// ── Description char count ───────────────────────────────────────
document.getElementById('pageDescription').addEventListener('input', () => {
  const len = document.getElementById('pageDescription').value.length;
  const el  = document.getElementById('descCharCount');
  el.textContent = `${len} chars`;
  el.style.color = len >= 120 && len <= 160 ? '#10b981' : len > 0 ? 'var(--brand-pink)' : 'var(--text-muted)';
});

// ── Selector de imagen genérico (grid de /api/media) ──────────────
async function loadMediaGrid(gridId, onPick) {
  const grid = document.getElementById(gridId);
  grid.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;">Cargando imágenes…</p>';
  try {
    const res = await apiFetch('/api/media');
    if (!res) return;
    const data = await res.json();
    const files = data.files || [];
    if (!files.length) {
      grid.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;">No hay imágenes disponibles. Sube una desde la sección Media.</p>';
      return;
    }
    grid.innerHTML = files.map((f) => `
      <div class="media-pick-item" data-url="${escHtml(f.url)}" style="cursor:pointer;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;" title="${escHtml(f.name)}">
        <img src="${f.url}" alt="${escHtml(f.name)}" style="width:100%;aspect-ratio:1;object-fit:cover;display:block;" />
      </div>`).join('');
    grid.querySelectorAll('.media-pick-item').forEach((el) => {
      el.addEventListener('click', () => onPick(el.dataset.url));
    });
  } catch (err) {
    grid.innerHTML = `<p style="color:var(--brand-pink);font-size:.85rem;">Error: ${escHtml(err.message)}</p>`;
  }
}

// og:image
function openOgImageModal() {
  document.getElementById('ogImageModal').classList.add('open');
  loadMediaGrid('ogImageGrid', (url) => {
    document.getElementById('ogImage').value = url;
    closeOgImageModal();
  });
}
function closeOgImageModal() {
  document.getElementById('ogImageModal').classList.remove('open');
}
document.getElementById('ogImageModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeOgImageModal();
});

// Imagen dentro del contenido (TipTap)
function openContentImageModal(insertFn) {
  pendingContentImageInsert = insertFn;
  document.getElementById('contentImageModal').classList.add('open');
  loadMediaGrid('contentImageGrid', (url) => {
    if (pendingContentImageInsert) pendingContentImageInsert(url);
    closeContentImageModal();
  });
}
function closeContentImageModal() {
  document.getElementById('contentImageModal').classList.remove('open');
  pendingContentImageInsert = null;
}
document.getElementById('contentImageModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeContentImageModal();
});

// ── Load page ────────────────────────────────────────────────────
async function loadPage() {
  try {
    const res = await apiFetch(`/api/pages/${encodeURIComponent(pageFile)}`);
    if (!res) return;
    if (!res.ok) { showTopAlert('error', 'Página no encontrada'); return; }

    const { frontmatter: fm, content } = await res.json();

    document.getElementById('pageTitle').value       = fm.title       || '';
    document.getElementById('pageDescription').value = fm.description || '';
    document.getElementById('pageSlug').value         = fm.slug || pageFile.replace(/\.md$/, '');
    updateSlugPreview();

    document.getElementById('ogTitle').value          = fm.og_title       || '';
    document.getElementById('ogDescription').value    = fm.og_description || '';
    document.getElementById('ogImage').value           = fm.og_image      || '';
    document.getElementById('twitterCard').value       = fm.twitter_card  || 'summary_large_image';

    if (editor) editor.commands.setContent(content || '');
    document.getElementById('editorPageTitle').textContent = fm.title || pageFile;
    document.title = `${fm.title || pageFile} — Editor de página`;

    document.getElementById('pageDescription').dispatchEvent(new Event('input'));
  } catch (err) {
    showTopAlert('error', `Error cargando página: ${err.message}`);
  }
}

// ── Save page ────────────────────────────────────────────────────
async function savePage() {
  const title = document.getElementById('pageTitle').value.trim();
  if (!title) {
    showTopAlert('error', 'El título es requerido');
    document.getElementById('pageTitle').focus();
    return;
  }

  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  setSaveStatus('Guardando…');

  const body = {
    title,
    description:   document.getElementById('pageDescription').value.trim(),
    content:       editor ? editor.getHTML() : '',
    ogTitle:       document.getElementById('ogTitle').value.trim(),
    ogDescription: document.getElementById('ogDescription').value.trim(),
    ogImage:       document.getElementById('ogImage').value.trim(),
    twitterCard:   document.getElementById('twitterCard').value,
  };

  try {
    const res = await apiFetch(`/api/pages/${encodeURIComponent(pageFile)}`, {
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

    const now = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    setSaveStatus(`Guardado a las ${now}`, '#10b981');
    showTopAlert('success', 'Página actualizada correctamente');
    document.getElementById('editorPageTitle').textContent = title;

    // Las páginas fijas (about, tags) siempre disparan el build al
    // guardarse: el guardado ya se completó en este punto, así que si
    // el build falla no se revierte nada, solo se informa el error.
    setSaveStatus('Publicando blog…');
    await triggerBuildAfterSave();
  } catch (err) {
    showTopAlert('error', `Error de red: ${err.message}`);
    setSaveStatus('Error', 'var(--brand-pink)');
  } finally {
    saveBtn.disabled = false;
  }
}

async function triggerBuildAfterSave() {
  const btn     = document.getElementById('buildBtn');
  const spinner = document.getElementById('buildSpinner');
  btn.disabled = true;
  spinner.classList.add('show');
  try {
    const res = await apiFetch('/api/build', { method: 'POST' });
    if (!res) return;
    const data = await res.json();
    if (res.ok && data.success) {
      setSaveStatus('Página guardada y blog actualizado ✓', '#10b981');
      showTopAlert('success', 'Página guardada y blog actualizado ✓');
    } else {
      setSaveStatus('Página guardada, pero el build falló', 'var(--brand-pink)');
      showTopAlert('error', data.error || 'El build falló.', false);
    }
  } catch (err) {
    setSaveStatus('Página guardada, pero el build falló', 'var(--brand-pink)');
    showTopAlert('error', `Página guardada, pero el build falló: ${err.message}`, false);
  } finally {
    btn.disabled = false;
    spinner.classList.remove('show');
  }
}

// ── Build ────────────────────────────────────────────────────────
async function triggerBuild() {
  const btn     = document.getElementById('buildBtn');
  const spinner = document.getElementById('buildSpinner');

  btn.disabled = true;
  spinner.classList.add('show');

  try {
    const res = await apiFetch('/api/build', { method: 'POST' });
    if (!res) return;
    const data = await res.json();
    if (res.ok && data.success) {
      showTopAlert('success', 'Blog publicado correctamente.');
    } else {
      showTopAlert('error', data.error || 'El build falló.');
    }
  } catch (err) {
    showTopAlert('error', `Error de red: ${err.message}`);
  } finally {
    btn.disabled = false;
    spinner.classList.remove('show');
  }
}

// ── Init ─────────────────────────────────────────────────────────
loadPage();
