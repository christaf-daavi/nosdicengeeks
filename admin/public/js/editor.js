// ── Auth ─────────────────────────────────────────────────────────
const token = checkAuth();
if (!token) throw new Error('No auth');

// ── State ────────────────────────────────────────────────────────
const params   = new URLSearchParams(window.location.search);
const editFile = params.get('file') || null;
let   coverUrl = null;
let   tags     = [];
let   mde      = null;
let   seoDebounce = null;

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

// ── EasyMDE init ──────────────────────────────────────────────────
mde = new EasyMDE({
  element: document.getElementById('postContent'),
  spellChecker: false,
  autofocus: false,
  placeholder: 'Escribe el contenido del post en Markdown…',
  status: ['lines', 'words', 'cursor'],
  toolbar: [
    'bold', 'italic', 'strikethrough', '|',
    'heading-1', 'heading-2', 'heading-3', '|',
    'quote', 'unordered-list', 'ordered-list', '|',
    'link', 'image', 'table', 'horizontal-rule', '|',
    'preview', 'side-by-side', 'fullscreen', '|',
    'guide',
  ],
  renderingConfig: { singleLineBreaks: false },
  previewClass: ['editor-preview'],
  sideBySideFullscreen: false,
});

mde.codemirror.on('change', () => debounceSEO());

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
    addTag(e.target.value);
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
    mde ? mde.value() : '',
    document.getElementById('seoKeyword').value
  );
}

document.getElementById('postTitle').addEventListener('input', debounceSEO);
document.getElementById('seoKeyword').addEventListener('input', debounceSEO);

// ── Image upload ─────────────────────────────────────────────────
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

// File input
document.getElementById('coverInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) uploadImage(file);
});

// Drag & drop
const dropZone = document.getElementById('dropZone');
dropZone.addEventListener('dragover',  (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) uploadImage(file);
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

    tags = Array.isArray(fm.tags) ? [...fm.tags] : [];
    renderTags();

    if (fm.image && fm.image.src) setCoverPreview(fm.image.src);

    mde.value(content || '');
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
    description: document.getElementById('postDescription').value.trim(),
    author:      document.getElementById('postAuthor').value.trim(),
    pubDate:     document.getElementById('postDate').value || new Date().toISOString().split('T')[0],
    tags:        [...tags],
    draft:       asDraft,
    content:     mde.value(),
  };

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
      history.replaceState(null, '', `/editor.html?file=${encodeURIComponent(data.filename)}`);
      document.getElementById('editorPageTitle').textContent = title;
    }
  } catch (err) {
    showTopAlert('error', `Error de red: ${err.message}`);
    setSaveStatus('Error', 'var(--brand-pink)');
  } finally {
    draftBtn.disabled   = false;
    publishBtn.disabled = false;
  }
}

// ── Utils ────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Fecha por defecto ────────────────────────────────────────────
document.getElementById('postDate').value = new Date().toISOString().split('T')[0];

// ── Init ─────────────────────────────────────────────────────────
if (editFile) {
  loadPost(editFile);
} else {
  runSEO();
}
