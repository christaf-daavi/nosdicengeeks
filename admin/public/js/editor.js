import { parseVideoUrl, EMBED_IFRAME_ATTRS } from '/js/video-embed.js';

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
window.closeVideoModal = (...args) => closeVideoModal(...args);

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
  wireToolbar(editor, document.getElementById('editorToolbarWrap'), {
    onImageRequest: (insertFn) => openContentImageModal(insertFn),
    onVideoRequest: (insertFn) => openVideoModal(insertFn),
  });
} catch (err) {
  console.error('Error al inicializar TipTap:', err);
  showTopAlert('error', `No se pudo cargar el editor de texto enriquecido: ${err.message}`, false);
}

// ── Barras fijas: alturas reales → variables CSS y márgenes de scroll ──
// --admin-topbar-h  top de la barra del editor y de "Publicación"
// --editor-toolbar-h alto de la barra del editor
// --sticky-top-h    scroll-padding-top (foco por teclado y anclas)
// --publish-bar-h   barra inferior de botones en una columna (≤900px)
// ProseMirror usa scrollMargin/scrollThreshold al llevar el cursor a la
// vista: con ellos el cursor no queda bajo la barra fija ni bajo la barra
// inferior al escribir al final de un post largo.
const singleColumn = window.matchMedia('(max-width: 900px)');
const stickyEls = {
  topbar:  document.querySelector('.topbar'),
  toolbar: document.getElementById('editorToolbarWrap'),
  publish: document.getElementById('publishSection'),
};
function updateStickyMetrics() {
  const topbarH  = stickyEls.topbar.offsetHeight;
  const toolbarH = stickyEls.toolbar.offsetHeight;
  const publishH = stickyEls.publish.offsetHeight;
  const bottomH  = singleColumn.matches ? publishH : 0;
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--admin-topbar-h', `${topbarH}px`);
  rootStyle.setProperty('--editor-toolbar-h', `${toolbarH}px`);
  rootStyle.setProperty('--publish-bar-h', `${bottomH}px`);
  rootStyle.setProperty('--sticky-top-h',
    `${topbarH + (singleColumn.matches ? toolbarH : Math.max(toolbarH, publishH))}px`);
  if (editor) {
    const margin = { top: topbarH + toolbarH + 16, bottom: bottomH + 16, left: 0, right: 0 };
    editor.setOptions({ editorProps: { scrollMargin: margin, scrollThreshold: margin } });
  }
}
const stickyObserver = new ResizeObserver(updateStickyMetrics);
Object.values(stickyEls).forEach((el) => stickyObserver.observe(el));
singleColumn.addEventListener('change', updateStickyMetrics);
updateStickyMetrics();

// ── Helpers UI ───────────────────────────────────────────────────
// autohide: true (4 s), false o una duración en ms
function showTopAlert(type, msg, autohide = true) {
  const el = document.getElementById('topAlert');
  el.className = `alert alert-${type} show`;
  el.textContent = msg;
  if (autohide) setTimeout(() => el.classList.remove('show'), autohide === true ? 4000 : autohide);
}

function setStatus(el, msg, color = 'var(--text-muted)') {
  el.textContent = msg;
  el.style.color = color;
}

function setSaveStatus(msg, color) {
  setStatus(document.getElementById('saveStatus'), msg, color);
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
  updateCoverAltCheck();
}

// Indicador informativo (no cuenta para el score): con portada, alt propio
// y distinto del título, que el blog trata como decorativo (alt="").
function updateCoverAltCheck() {
  const item = document.getElementById('seo-cover-alt');
  if (!item) return;
  const alt   = document.getElementById('coverAlt').value.trim();
  const title = document.getElementById('postTitle').value.trim();
  const ok    = !!alt && alt !== title;
  item.querySelector('.seo-dot').className = 'seo-dot' + (coverUrl ? (ok ? ' seo-green' : ' seo-red') : '');
  item.querySelector('.seo-label').textContent = !coverUrl
    ? 'Portada con alt descriptivo (sin portada)'
    : ok ? 'Portada con alt descriptivo' : 'Portada sin alt descriptivo (se usará el título)';
}

document.getElementById('seoKeyword').addEventListener('input', debounceSEO);

// ── Image upload (portada) ────────────────────────────────────────
// El alt de la portada (#coverAlt) es independiente de la imagen: se
// mantiene al subir o cambiar la portada. Vacío al guardar → el título.
function setCoverPreview(url) {
  const img    = document.getElementById('coverPreview');
  const rmBtn  = document.getElementById('removeCoverBtn');
  const zone   = document.getElementById('dropZone');
  coverUrl     = url;
  img.src      = url;
  img.style.display    = 'block';
  rmBtn.style.display  = 'flex';
  zone.style.display   = 'none';
  debounceSEO();
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
  debounceSEO();
}

document.getElementById('coverAlt').addEventListener('input', debounceSEO);

// Sube un archivo a /api/media/upload. Devuelve { url, filename, width, height, … }
// o lanza un Error con un mensaje listo para mostrar.
async function uploadMediaFile(file) {
  const formData = new FormData();
  formData.append('image', file);
  const res = await apiFetch('/api/media/upload', { method: 'POST', body: formData });
  if (!res) throw new Error('Sesión expirada');
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Error al subir la imagen (HTTP ${res.status})`);
  }
  return data;
}

async function uploadImage(file) {
  const status = document.getElementById('coverUploadStatus');
  setStatus(status, 'Subiendo…');
  try {
    const data = await uploadMediaFile(file);
    setCoverPreview(data.url);
    setStatus(status, `${data.filename} · ${data.width}×${data.height}px`, '#10b981');
  } catch (err) {
    setStatus(status, `Error: ${err.message}`, 'var(--brand-pink)');
  }
}

// Zona drag & drop + input file oculto: clic, Enter/Espacio o soltar un archivo
function wireDropZone(zone, input, onFile) {
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  zone.addEventListener('dragover',  (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', ()  => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  });
  input.addEventListener('change', () => {
    const file = input.files[0];
    input.value = ''; // permite volver a elegir el mismo archivo
    if (file) onFile(file);
  });
}

wireDropZone(document.getElementById('dropZone'), document.getElementById('coverInput'), (file) => {
  if (file.type.startsWith('image/')) uploadImage(file);
});

// ── Modales: foco al abrir, Esc cierra, foco vuelve al disparador ──
let modalReturnFocus = null;
function openModal(id, focusEl) {
  const overlay = document.getElementById(id);
  modalReturnFocus = document.activeElement;
  overlay.classList.add('open');
  (focusEl || overlay.querySelector('button, input, [tabindex="0"]'))?.focus();
}
function closeModal(id, restoreFocus = true) {
  document.getElementById(id).classList.remove('open');
  if (restoreFocus && modalReturnFocus && document.contains(modalReturnFocus)) modalReturnFocus.focus();
  modalReturnFocus = null;
}

const modalClosers = {
  coverMediaModal:   () => closeCoverMediaModal(),
  ogImageModal:      () => closeOgImageModal(),
  contentImageModal: () => closeContentImageModal(),
  videoModal:        () => closeVideoModal(),
  importConfirmModal: () => closeImportConfirm('cancel'),
};
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const open = [...document.querySelectorAll('.modal-overlay.open')].pop();
  if (open && modalClosers[open.id]) {
    e.preventDefault();
    modalClosers[open.id]();
  } else if (document.getElementById('previewModal').style.display === 'block') {
    closePreview();
  }
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
      <div class="media-pick-item" data-url="${escHtml(f.url)}" role="button" tabindex="0" style="cursor:pointer;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;" title="${escHtml(f.name)}">
        <img src="${f.url}" alt="${escHtml(f.name)}" style="width:100%;aspect-ratio:1;object-fit:cover;display:block;" />
      </div>`).join('');
    grid.querySelectorAll('.media-pick-item').forEach((el) => {
      el.addEventListener('click', () => onPick(el.dataset.url));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(el.dataset.url); }
      });
    });
  } catch (err) {
    grid.innerHTML = `<p style="color:var(--brand-pink);font-size:.85rem;">Error: ${escHtml(err.message)}</p>`;
  }
}

// og:image
function openOgImageModal() {
  openModal('ogImageModal');
  loadMediaGrid('ogImageGrid', (url) => {
    document.getElementById('ogImage').value = url;
    closeOgImageModal();
  });
}
function closeOgImageModal() {
  closeModal('ogImageModal');
}
document.getElementById('ogImageModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeOgImageModal();
});

// Imagen de portada (buscar en Media)
function openCoverMediaModal() {
  openModal('coverMediaModal');
  loadMediaGrid('coverMediaGrid', (url) => {
    setCoverPreview(url);
    document.getElementById('coverUploadStatus').textContent = '';
    closeCoverMediaModal();
  });
}
function closeCoverMediaModal() {
  closeModal('coverMediaModal');
}
document.getElementById('coverMediaModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeCoverMediaModal();
});

document.getElementById('coverFileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) uploadImage(file);
});

// Imagen dentro del contenido (TipTap): pestañas Biblioteca / Subir nueva
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
let contentImageFile = null;

function openContentImageModal(insertFn) {
  pendingContentImageInsert = insertFn;
  resetContentImageUpload();
  openModal('contentImageModal');
  selectImageTab('library');
  loadMediaGrid('contentImageGrid', (url) => insertContentImage(url, ''));
}
function closeContentImageModal(restoreFocus = true) {
  closeModal('contentImageModal', restoreFocus);
  pendingContentImageInsert = null;
  resetContentImageUpload();
}
function insertContentImage(url, alt) {
  const insert = pendingContentImageInsert;
  closeContentImageModal(false); // el foco pasa al editor al insertar
  if (insert) insert(url, alt);
}
document.getElementById('contentImageModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeContentImageModal();
});

const imageTabs = {
  library: { tab: document.getElementById('imgTabLibrary'), panel: document.getElementById('imgPanelLibrary') },
  upload:  { tab: document.getElementById('imgTabUpload'),  panel: document.getElementById('imgPanelUpload') },
};
function selectImageTab(name, focus = false) {
  Object.entries(imageTabs).forEach(([key, { tab, panel }]) => {
    const active = key === name;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    panel.hidden = !active;
    if (active && focus) tab.focus();
  });
  document.getElementById('contentImageUploadBtn').hidden = name !== 'upload';
}
Object.entries(imageTabs).forEach(([name, { tab }]) => {
  tab.addEventListener('click', () => selectImageTab(name));
  tab.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      selectImageTab(name === 'library' ? 'upload' : 'library', true);
    }
  });
});

function resetContentImageUpload() {
  contentImageFile = null;
  const preview = document.getElementById('contentImagePreview');
  if (preview.src) URL.revokeObjectURL(preview.src);
  preview.removeAttribute('src');
  preview.hidden = true;
  document.getElementById('contentImageAlt').value = '';
  setStatus(document.getElementById('contentImageStatus'), '');
  const btn = document.getElementById('contentImageUploadBtn');
  btn.disabled = true;
  btn.textContent = 'Subir e insertar';
}

function setContentImageFile(file) {
  const status = document.getElementById('contentImageStatus');
  if (!file.type.startsWith('image/')) {
    resetContentImageUpload();
    setStatus(status, 'El archivo seleccionado no es una imagen.', 'var(--brand-pink)');
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    resetContentImageUpload();
    setStatus(status, `La imagen pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo es 10 MB.`, 'var(--brand-pink)');
    return;
  }
  resetContentImageUpload();
  contentImageFile = file;
  const preview = document.getElementById('contentImagePreview');
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
  setStatus(status, `${file.name} · ${(file.size / 1024).toFixed(0)} KB`);
  document.getElementById('contentImageUploadBtn').disabled = false;
  document.getElementById('contentImageAlt').focus();
}

async function submitContentImageUpload() {
  if (!contentImageFile) return;
  const btn    = document.getElementById('contentImageUploadBtn');
  const status = document.getElementById('contentImageStatus');
  const alt    = document.getElementById('contentImageAlt').value.trim();
  btn.disabled = true;
  btn.textContent = 'Subiendo…';
  setStatus(status, 'Subiendo imagen…');
  try {
    const data = await uploadMediaFile(contentImageFile);
    // La Biblioteca se recarga en cada apertura del modal, así que la
    // imagen nueva aparece ahí la próxima vez sin pedirla aparte.
    insertContentImage(data.url, alt);
    showTopAlert('success', 'Imagen subida e insertada');
  } catch (err) {
    setStatus(status, `No se pudo subir: ${err.message}`, 'var(--brand-pink)');
    btn.disabled = false;
    btn.textContent = 'Subir e insertar';
  }
}

wireDropZone(
  document.getElementById('contentImageDrop'),
  document.getElementById('contentImageFile'),
  setContentImageFile
);
document.getElementById('contentImageUploadBtn').addEventListener('click', submitContentImageUpload);
document.getElementById('contentImageAlt').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); submitContentImageUpload(); }
});

// ── Video embebido (YouTube / Vimeo / TikTok) ────────────────────
const VIDEO_PROVIDERS = { youtube: 'YouTube', vimeo: 'Vimeo', tiktok: 'TikTok' };
let pendingVideoInsert = null;
let pendingVideo = null;
let videoPreviewDebounce = null;

function openVideoModal(insertFn) {
  pendingVideoInsert = insertFn;
  const input = document.getElementById('videoUrlInput');
  input.value = '';
  updateVideoPreview();
  openModal('videoModal', input);
}
function closeVideoModal(restoreFocus = true) {
  closeModal('videoModal', restoreFocus);
  clearTimeout(videoPreviewDebounce);
  document.getElementById('videoPreview').replaceChildren(); // corta la reproducción
  pendingVideo = null;
  pendingVideoInsert = null;
}
document.getElementById('videoModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeVideoModal();
});

function updateVideoPreview() {
  const value   = document.getElementById('videoUrlInput').value;
  const status  = document.getElementById('videoStatus');
  const preview = document.getElementById('videoPreview');
  const video   = value.trim() ? parseVideoUrl(value) : null;

  document.getElementById('videoInsertBtn').disabled = !(video && video.ok);
  if (!video || !video.ok) {
    pendingVideo = null;
    preview.replaceChildren();
    setStatus(status, video ? video.error : '', 'var(--brand-pink)');
    return;
  }
  setStatus(status, `Video de ${VIDEO_PROVIDERS[video.provider]} detectado`, '#10b981');
  if (pendingVideo && pendingVideo.embedUrl === video.embedUrl) return; // no recargar el iframe
  pendingVideo = video;

  const wrapper = document.createElement('div');
  wrapper.className = video.vertical ? 'video-embed video-embed--vertical' : 'video-embed';
  const iframe = document.createElement('iframe');
  Object.entries({ ...EMBED_IFRAME_ATTRS, title: 'Vista previa del video' })
    .forEach(([k, v]) => iframe.setAttribute(k, v));
  iframe.src = video.embedUrl;
  wrapper.appendChild(iframe);
  preview.replaceChildren(wrapper);
}

function insertVideo() {
  clearTimeout(videoPreviewDebounce);
  updateVideoPreview();
  if (!pendingVideo) return;
  const insert = pendingVideoInsert;
  const video  = pendingVideo;
  closeVideoModal(false); // el foco pasa al editor al insertar
  if (insert) insert(video);
}

document.getElementById('videoUrlInput').addEventListener('input', () => {
  clearTimeout(videoPreviewDebounce);
  videoPreviewDebounce = setTimeout(updateVideoPreview, 350);
});
document.getElementById('videoUrlInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); insertVideo(); }
});
document.getElementById('videoInsertBtn').addEventListener('click', insertVideo);

// ── Importar .md (solo al editor; no guarda nada) ───────────────
const MAX_MD_BYTES = 2 * 1024 * 1024;
const MD_FILE = /\.(md|markdown|txt)$/i;
let resolveImportMode = null;

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'utf-8');
  });
}

// Resuelve con 'replace', 'append' o 'cancel'
function askImportMode(filename) {
  document.getElementById('importConfirmFile').textContent = filename;
  openModal('importConfirmModal', document.querySelector('[data-import-mode="replace"]'));
  return new Promise((resolve) => { resolveImportMode = resolve; });
}
function closeImportConfirm(mode) {
  closeModal('importConfirmModal', mode === 'cancel');
  if (resolveImportMode) resolveImportMode(mode);
  resolveImportMode = null;
}
document.querySelectorAll('[data-import-mode]').forEach((btn) => {
  btn.addEventListener('click', () => closeImportConfirm(btn.dataset.importMode));
});
document.getElementById('importConfirmModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeImportConfirm('cancel');
});

async function importMarkdownFile(file) {
  if (!editor) {
    showTopAlert('error', 'El editor no está disponible; no se puede importar.');
    return;
  }
  if (!MD_FILE.test(file.name)) {
    showTopAlert('error', 'El archivo debe ser .md o .markdown');
    return;
  }
  if (file.size > MAX_MD_BYTES) {
    showTopAlert('error', `El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo es 2 MB`);
    return;
  }

  let parsed;
  try {
    const raw = await readFileAsText(file);
    const res = await apiFetch('/api/posts/parse-md', {
      method: 'POST',
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
      body: raw,
    });
    if (!res) return;
    parsed = await res.json().catch(() => ({}));
    if (!res.ok) {
      showTopAlert('error', parsed.error || `No se pudo procesar el archivo (HTTP ${res.status})`, 8000);
      return;
    }
  } catch (err) {
    showTopAlert('error', `No se pudo leer el archivo: ${err.message}`);
    return;
  }

  const mode = editor.isEmpty ? 'replace' : await askImportMode(file.name);
  if (mode === 'cancel') return;
  applyImportedMarkdown(parsed, mode, file.name);
}

function applyImportedMarkdown({ frontmatter: fm = {}, html = '' }, mode, filename) {
  const imported = [];
  const setField = (id, value) => {
    const el = document.getElementById(id);
    el.value = value;
    el.dispatchEvent(new Event('input')); // slug, contador y SEO
  };

  if (fm.title)       { setField('postTitle', fm.title);             imported.push('título'); }
  if (fm.description) { setField('postDescription', fm.description); imported.push('descripción'); }
  if (fm.tags && fm.tags.length) {
    tags = [];
    fm.tags.forEach((t) => addTag(String(t)));
    renderTags();
    imported.push(`${tags.length} tag${tags.length === 1 ? '' : 's'}`);
  }
  if (fm.image && fm.image.src) {
    setCoverPreview(fm.image.src);
    if (fm.image.alt) document.getElementById('coverAlt').value = fm.image.alt;
    document.getElementById('coverUploadStatus').textContent = '';
    imported.push('portada');
  }
  if (fm.pubDate) { document.getElementById('postDate').value = fm.pubDate; imported.push('fecha'); }

  if (mode === 'append') {
    editor.chain().focus('end').insertContentAt(editor.state.doc.content.size, html).run();
  } else {
    editor.commands.setContent(html);
  }
  runSEO();

  const fields = imported.length ? `${imported.join(', ')} y ` : '';
  const action = mode === 'append' ? 'agregado al final' : 'cargado';
  let msg = `Importado «${filename}»: ${fields}contenido ${action}.`;
  if (fm.draft !== undefined) {
    msg += ` El archivo indica draft: ${fm.draft}; elige "Guardar borrador" o "Publicar" al guardar.`;
  }
  showTopAlert('success', `${msg} Aún no se ha guardado nada.`, 8000);
}

document.getElementById('importMdBtn').addEventListener('click', () =>
  document.getElementById('importMdInput').click()
);
document.getElementById('importMdInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = ''; // permite reimportar el mismo archivo
  if (file) importMarkdownFile(file);
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
    const loadedAlt = (fm.image && fm.image.alt || '').trim();
    document.getElementById('coverAlt').value = loadedAlt && loadedAlt !== (fm.title || '').trim() ? loadedAlt : '';

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

  if (coverUrl) body.image = { src: coverUrl, alt: document.getElementById('coverAlt').value.trim() || title };

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
