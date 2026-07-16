// ── Auth ─────────────────────────────────────────────────────────
const token = checkAuth();
if (!token) throw new Error('No auth');

let SITE_URL = 'https://nosdicengeeks.com';
try {
  const configRes = await fetch('/api/config');
  if (configRes.ok) SITE_URL = (await configRes.json()).siteUrl || SITE_URL;
} catch {
  // Si falla, se conserva el fallback de producción
}

// ── State ────────────────────────────────────────────────────────
const params   = new URLSearchParams(window.location.search);
let   editFile = params.get('file') || null;
let   coverUrl = null;
let   tags     = [];
let   editor   = null;
let   seoDebounce = null;
let   slugManuallyEdited = false;
let   pendingContentImageInsert = null;

// ── Exponer al scope global ANTES que nada pueda fallar ───────────
// (los onclick= del HTML son globales; si esto se declarara al final
// del archivo, un error en la inicialización de TipTap más abajo
// dejaría estas funciones sin definir y rompería todos los botones)
window.savePost = (...args) => savePost(...args);
window.removeCover = (...args) => removeCover(...args);
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
// Import DINÁMICO (no estático) a propósito: tiptap-editor.js depende
// de paquetes cargados vía CDN externo (+esm de jsDelivr). Un import
// estático en la línea 1 que falle en resolverse aborta la evaluación
// de TODO este módulo — nada de lo que sigue (swatches, guardado,
// slug) llegaría a ejecutarse nunca. Con import() dinámico dentro de
// este try/catch, un fallo ahí queda aislado y el resto del editor
// sigue funcionando con normalidad.
try {
  // Guarda: si por cualquier motivo este bloque llegara a correr más de
  // una vez sobre el mismo documento (doble evaluación del módulo, re-init
  // manual, etc.), destruye la instancia previa antes de crear otra. Dos
  // instancias de Editor sobre el mismo elemento es la causa típica de
  // "Adding different instances of a keyed plugin" en ProseMirror.
  if (editor && typeof editor.destroy === 'function') {
    editor.destroy();
    editor = null;
  }

  const { createEditor, wireToolbar } = await import('/js/tiptap-editor.js');
  editor = createEditor(document.getElementById('editorContentArea'), {
    onUpdate: () => debounceSEO(),
  });
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
  const slug = document.getElementById('postSlug').value;
  document.getElementById('slugPreview').textContent = `${SITE_URL.replace('https://', '')}/posts/${slug}`;
}

document.getElementById('postTitle').addEventListener('input', (e) => {
  if (!editFile && !slugManuallyEdited) {
    document.getElementById('postSlug').value = slugify(e.target.value);
    updateSlugPreview();
  }
  debounceSEO();
});

document.getElementById('postSlug').addEventListener('input', () => {
  slugManuallyEdited = true;
  updateSlugPreview();
});

// ── Tags ──────────────────────────────────────────────────────────
function renderTags() {
  const container = document.getElementById('tagsContainer');
  const input     = document.getElementById('tagInput');
  container.querySelectorAll('.chip').forEach((c) => c.remove());
  tags.forEach((tag, i) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.innerHTML = `${escHtml(tag)}<button class="chip-remove" data-i="${i}" title="Eliminar tag">×</button>`;
    container.insertBefore(chip, input);
  });
}

function addTag(raw) {
  const tag = raw.trim().toLowerCase().replace(/\s+/g, '-');
  if (!tag || tags.includes(tag)) return;
  tags.push(tag);
  renderTags();
  debounceSEO();
}

function removeTag(i) {
  tags.splice(i, 1);
  renderTags();
  debounceSEO();
}

document.getElementById('tagInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    // Soporta pegar/escribir varios tags separados por comas de una vez
    // (ej: "IA, Claude, ChatGPT") además del flujo tag-por-tecla existente.
    e.target.value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((t) => addTag(t));
    e.target.value = '';
  } else if (e.key === 'Backspace' && !e.target.value && tags.length) {
    removeTag(tags.length - 1);
  }
});

document.getElementById('tagsContainer').addEventListener('click', (e) => {
  const btn = e.target.closest('.chip-remove');
  if (btn) removeTag(Number(btn.dataset.i));
});

// ── Description char count ───────────────────────────────────────
document.getElementById('postDescription').addEventListener('input', () => {
  const len = document.getElementById('postDescription').value.length;
  const el  = document.getElementById('descCharCount');
  el.textContent = `${len} chars`;
  el.style.color = len >= 120 && len <= 160 ? '#10b981' : len > 0 ? 'var(--brand-pink)' : 'var(--text-muted)';
  debounceSEO();
});

// ── SEO debounce ─────────────────────────────────────────────────
function debounceSEO() {
  clearTimeout(seoDebounce);
  seoDebounce = setTimeout(runSEO, 400);
}
function runSEO() {
  updateSemaphore(
    document.getElementById('postTitle').value,
    document.getElementById('postDescription').value,
    editor ? editor.getText() : '',
    document.getElementById('seoKeyword').value
  );
}

document.getElementById('seoKeyword').addEventListener('input', debounceSEO);

// ── Image upload (portada) ────────────────────────────────────────
function setCoverPreview(url) {
  const img    = document.getElementById('coverPreview');
  const rmBtn  = document.getElementById('removeCoverBtn');
  const zone   = document.getElementById('dropZone');
  coverUrl     = url;
  img.src      = url;
  img.style.display    = 'block';
  rmBtn.style.display  = 'flex';
  zone.style.display   = 'none';
}

function removeCover() {
  coverUrl = null;
  const img   = document.getElementById('coverPreview');
  const rmBtn = document.getElementById('removeCoverBtn');
  const zone  = document.getElementById('dropZone');
  img.src             = '';
  img.style.display   = 'none';
  rmBtn.style.display = 'none';
  zone.style.display  = '';
  document.getElementById('coverInput').value = '';
  document.getElementById('coverUploadStatus').textContent = '';
}

async function uploadImage(file) {
  const status = document.getElementById('coverUploadStatus');
  status.textContent = 'Subiendo…';
  status.style.color = 'var(--text-muted)';

  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch('/api/media/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    });
    if (res.status === 401 || res.status === 403) { logout(); return; }

    const data = await res.json();
    if (!res.ok || !data.success) {
      status.textContent = data.error || 'Error al subir';
      status.style.color = 'var(--brand-pink)';
      return;
    }
    setCoverPreview(data.url);
    status.textContent = `${data.filename} · ${data.width}×${data.height}px`;
    status.style.color = '#10b981';
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
    status.style.color = 'var(--brand-pink)';
  }
}

document.getElementById('coverInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) uploadImage(file);
});

const dropZone = document.getElementById('dropZone');
dropZone.addEventListener('dragover',  (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) uploadImage(file);
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

// Imagen de portada (buscar en Media)
function openCoverMediaModal() {
  document.getElementById('coverMediaModal').classList.add('open');
  loadMediaGrid('coverMediaGrid', (url) => {
    setCoverPreview(url);
    document.getElementById('coverUploadStatus').textContent = '';
    closeCoverMediaModal();
  });
}
function closeCoverMediaModal() {
  document.getElementById('coverMediaModal').classList.remove('open');
}
document.getElementById('coverMediaModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeCoverMediaModal();
});

document.getElementById('coverFileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) uploadImage(file);
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

// ── Load post ────────────────────────────────────────────────────
async function loadPost(filename) {
  try {
    const res = await apiFetch(`/api/posts/${encodeURIComponent(filename)}`);
    if (!res) return;
    if (!res.ok) { showTopAlert('error', 'Post no encontrado'); return; }

    const { frontmatter: fm, content } = await res.json();

    document.getElementById('postTitle').value       = fm.title       || '';
    document.getElementById('postDescription').value = fm.description || '';
    document.getElementById('postAuthor').value      = fm.author      || '';
    document.getElementById('postDate').value        = fm.pubDate
      ? new Date(fm.pubDate).toISOString().split('T')[0]
      : '';

    document.getElementById('postSlug').value = fm.slug || filename.replace(/\.md$/, '');
    slugManuallyEdited = true; // no auto-regenerar el slug de un post existente
    updateSlugPreview();

    tags = Array.isArray(fm.tags) ? [...fm.tags] : [];
    renderTags();

    document.getElementById('ogTitle').value       = fm.og_title       || '';
    document.getElementById('ogDescription').value = fm.og_description || '';
    document.getElementById('ogImage').value       = fm.og_image       || '';
    document.getElementById('twitterCard').value   = fm.twitter_card   || 'summary_large_image';

    if (fm.image && fm.image.src) setCoverPreview(fm.image.src);

    document.getElementById('heroLabel').value = fm.heroLabel || '';
    document.getElementById('heroTitle').value = fm.heroTitle || '';
    document.getElementById('heroCopy').value  = fm.heroCopy  || '';

    document.getElementById('heroLabelColor').value = fm.heroLabelColor || '#fbbc42';
    document.getElementById('heroTitleColor').value = fm.heroTitleColor || '#ffffff';
    document.getElementById('heroCopyColor').value  = fm.heroCopyColor  || '#ffffff';
    setActiveSwatch('[data-target="heroLabelColor"]', fm.heroLabelColor || '#fbbc42');
    setActiveSwatch('[data-target="heroTitleColor"]', fm.heroTitleColor || '#ffffff');
    setActiveSwatch('[data-target="heroCopyColor"]', fm.heroCopyColor || '#ffffff');

    if (editor) editor.commands.setContent(content || '');
    document.getElementById('editorPageTitle').textContent = fm.title || filename;
    document.title = `${fm.title || filename} — Editor`;

    // Dispara counter de descripción
    document.getElementById('postDescription').dispatchEvent(new Event('input'));
    runSEO();
  } catch (err) {
    showTopAlert('error', `Error cargando post: ${err.message}`);
  }
}

// ── Save post ────────────────────────────────────────────────────
async function savePost(asDraft) {
  const title = document.getElementById('postTitle').value.trim();
  if (!title) {
    showTopAlert('error', 'El título es requerido');
    document.getElementById('postTitle').focus();
    return;
  }

  const draftBtn   = document.getElementById('draftBtn');
  const publishBtn = document.getElementById('publishBtn');
  draftBtn.disabled   = true;
  publishBtn.disabled = true;
  setSaveStatus('Guardando…');

  const body = {
    title,
    slug:        document.getElementById('postSlug').value.trim(),
    description: document.getElementById('postDescription').value.trim(),
    author:      document.getElementById('postAuthor').value.trim(),
    pubDate:     document.getElementById('postDate').value || new Date().toISOString().split('T')[0],
    tags:        [...tags],
    draft:       !!asDraft, // true = "Guardar borrador", false = "Publicar" (ver botones en editor.html)
    content:     editor ? editor.getHTML() : '',
    ogTitle:       document.getElementById('ogTitle').value.trim(),
    ogDescription: document.getElementById('ogDescription').value.trim(),
    ogImage:       document.getElementById('ogImage').value.trim(),
    twitterCard:   document.getElementById('twitterCard').value,
    heroLabel:     document.getElementById('heroLabel').value.trim(),
    heroTitle:     document.getElementById('heroTitle').value.trim(),
    heroCopy:      document.getElementById('heroCopy').value.trim(),
    heroLabelColor: document.getElementById('heroLabelColor').value,
    heroTitleColor: document.getElementById('heroTitleColor').value,
    heroCopyColor:  document.getElementById('heroCopyColor').value,
  };

  // DEBUG temporal — remover una vez confirmado que los colores viajan bien
  console.log('[hero colors] enviando al backend:', {
    heroLabelColor: body.heroLabelColor,
    heroTitleColor: body.heroTitleColor,
    heroCopyColor: body.heroCopyColor,
  });

  if (coverUrl) body.image = { src: coverUrl, alt: title };

  try {
    let res, data;
    if (editFile) {
      res  = await apiFetch(`/api/posts/${encodeURIComponent(editFile)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    } else {
      res  = await apiFetch('/api/posts', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    }
    if (!res) return;

    data = await res.json();
    if (!res.ok) {
      showTopAlert('error', data.error || 'Error al guardar');
      setSaveStatus('Error al guardar', 'var(--brand-pink)');
      return;
    }

    const now = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    setSaveStatus(`Guardado a las ${now}`, '#10b981');
    showTopAlert('success', asDraft ? 'Borrador guardado' : 'Post publicado');

    // Si era nuevo, redirige al editor del archivo creado
    if (!editFile && data.filename) {
      editFile = data.filename;
      history.replaceState(null, '', `/editor.html?file=${encodeURIComponent(data.filename)}`);
      document.getElementById('editorPageTitle').textContent = title;
    }

    // Al publicar (draft: false), dispara el build automáticamente.
    // El guardado ya se completó en este punto: si el build falla no
    // se revierte nada, solo se informa el error.
    if (!asDraft) {
      await runBuildAfterSave();
    }
  } catch (err) {
    showTopAlert('error', `Error de red: ${err.message}`);
    setSaveStatus('Error', 'var(--brand-pink)');
  } finally {
    draftBtn.disabled   = false;
    publishBtn.disabled = false;
  }
}

async function runBuildAfterSave() {
  setSaveStatus('Publicando blog…');
  showTopAlert('info', 'Publicando blog…', false);
  try {
    const res = await apiFetch('/api/build', { method: 'POST' });
    if (!res) return;
    const data = await res.json();
    if (res.ok && data.success) {
      setSaveStatus('Post publicado y blog actualizado ✓', '#10b981');
      showTopAlert('success', 'Post publicado y blog actualizado ✓');
    } else {
      setSaveStatus('Post guardado, pero el build falló', 'var(--brand-pink)');
      showTopAlert('error', data.error || 'El build falló.', false);
    }
  } catch (err) {
    setSaveStatus('Post guardado, pero el build falló', 'var(--brand-pink)');
    showTopAlert('error', `Post guardado, pero el build falló: ${err.message}`, false);
  }
}

// ── Fecha por defecto ────────────────────────────────────────────
document.getElementById('postDate').value = new Date().toISOString().split('T')[0];

// ── Swatches de color del hero ────────────────────────────────────
function setActiveSwatch(groupSelector, color) {
  const group = document.querySelector(groupSelector);
  if (!group) return;
  group.querySelectorAll('.swatch').forEach((sw) => {
    sw.classList.toggle('selected', sw.dataset.color === color);
  });
}

document.querySelectorAll('.color-swatches').forEach((group) => {
  const targetId = group.dataset.target;
  const input = document.getElementById(targetId);
  group.querySelectorAll('.swatch').forEach((sw) => {
    sw.addEventListener('click', () => {
      group.querySelectorAll('.swatch').forEach((s) => s.classList.remove('selected'));
      sw.classList.add('selected');
      input.value = sw.dataset.color;
    });
  });
});

// ── Preview en vivo ─────────────────────────────────────────────
function openPreview() {
  const title   = document.getElementById('postTitle').value || 'Sin título';
  const desc    = document.getElementById('postDescription').value || '';
  const author  = document.getElementById('postAuthor').value || '';
  const content = editor ? editor.getHTML() : '';
  const coverImg = coverUrl || '';

  // Hero
  const hero    = document.getElementById('previewHero');
  const heroImg = document.getElementById('previewHeroImg');
  if (coverImg) { heroImg.src = coverImg; hero.style.display = 'block'; }
  else { hero.style.display = 'none'; }

  // Tags
  const tagsDiv = document.getElementById('previewTags');
  tagsDiv.innerHTML = tags.map((t) =>
    `<span style="padding:3px 10px;background:rgba(4,150,255,.12);color:#0496ff;border-radius:4px;font-size:.8rem;">#${escHtml(t)}</span>`
  ).join('');

  // Título, desc, meta
  document.getElementById('previewTitle').textContent = title;
  document.getElementById('previewDesc').textContent  = desc;
  document.getElementById('previewMeta').textContent  = author ? `// autor ${author}` : '';

  // Contenido HTML de TipTap
  document.getElementById('previewBody').innerHTML = content;

  document.getElementById('previewModal').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function closePreview() {
  document.getElementById('previewModal').style.display = 'none';
  document.body.style.overflow = '';
}

window.openPreview          = openPreview;
window.closePreview         = closePreview;
window.openCoverMediaModal  = openCoverMediaModal;
window.closeCoverMediaModal = closeCoverMediaModal;

// ── Init ─────────────────────────────────────────────────────────
if (editFile) {
  loadPost(editFile);
} else {
  updateSlugPreview();
  runSEO();
  setActiveSwatch('[data-target="heroLabelColor"]', '#fbbc42');
  setActiveSwatch('[data-target="heroTitleColor"]', '#ffffff');
  setActiveSwatch('[data-target="heroCopyColor"]', '#ffffff');
}
