// Módulo compartido: inicializa TipTap y conecta la barra de herramientas.
// Se carga como <script type="module">; los paquetes de Tiptap se resuelven
// desde un bundle local generado con esbuild (ver admin/build-tiptap.js),
// que empaqueta @tiptap/core, @tiptap/pm y las extensiones en un único
// módulo ESM. Reemplaza al CDN +esm de jsDelivr: cargar cada paquete por
// separado desde jsDelivr producía instancias duplicadas de @tiptap/pm
// (error "Adding different instances of a keyed plugin"), porque cada
// módulo +esm resolvía su propia copia de @tiptap/pm en vez de compartir
// una sola instancia.
import {
  Editor,
  StarterKit,
  TextStyle,
  Color,
  Underline,
  TextAlign,
  Highlight,
  Link,
  Image as ImageExt,
} from '/js/tiptap-bundle.js';

// @tiptap/extension-emoji no existía todavía en la serie 2.11.x (publicado
// recién en 2.27+). El picker de emojis se implementa abajo con un panel
// propio de emojis comunes, sin depender de esa extensión.
const COMMON_EMOJIS = ['😀','😂','😍','🤔','😎','👍','👎','🎉','🔥','💯','🚀','⚡','💡','✅','❌','⭐','❤️','😅','🙌','👀'];

export function createEditor(element, { content = '', onUpdate } = {}) {
  const editor = new Editor({
    element,
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight,
      Link.configure({ openOnClick: false, autolink: true }),
      ImageExt,
    ],
    content,
    onUpdate: ({ editor }) => onUpdate && onUpdate(editor),
    onTransaction: ({ editor }) => updateToolbarState(editor),
    onSelectionUpdate: ({ editor }) => updateToolbarState(editor),
  });
  updateToolbarState(editor);
  return editor;
}

function updateToolbarState(editor) {
  document.querySelectorAll('.tiptap-toolbar [data-action]').forEach((btn) => {
    const action = btn.dataset.action;
    const map = {
      bold: 'bold', italic: 'italic', underline: 'underline', strike: 'strike',
      h1: () => editor.isActive('heading', { level: 1 }),
      h2: () => editor.isActive('heading', { level: 2 }),
      h3: () => editor.isActive('heading', { level: 3 }),
      alignLeft: () => editor.isActive({ textAlign: 'left' }),
      alignCenter: () => editor.isActive({ textAlign: 'center' }),
      alignRight: () => editor.isActive({ textAlign: 'right' }),
      alignJustify: () => editor.isActive({ textAlign: 'justify' }),
      highlight: 'highlight',
      bulletList: 'bulletList',
      orderedList: 'orderedList',
      blockquote: 'blockquote',
      codeBlock: 'codeBlock',
      link: 'link',
    };
    const check = map[action];
    if (!check) return;
    const active = typeof check === 'function' ? check() : editor.isActive(check);
    btn.classList.toggle('active', !!active);
  });
}

export function wireToolbar(editor, toolbarEl, { onImageRequest } = {}) {
  toolbarEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const chain = () => editor.chain().focus();

    switch (action) {
      case 'bold': chain().toggleBold().run(); break;
      case 'italic': chain().toggleItalic().run(); break;
      case 'underline': chain().toggleUnderline().run(); break;
      case 'strike': chain().toggleStrike().run(); break;
      case 'h1': chain().toggleHeading({ level: 1 }).run(); break;
      case 'h2': chain().toggleHeading({ level: 2 }).run(); break;
      case 'h3': chain().toggleHeading({ level: 3 }).run(); break;
      case 'alignLeft': chain().setTextAlign('left').run(); break;
      case 'alignCenter': chain().setTextAlign('center').run(); break;
      case 'alignRight': chain().setTextAlign('right').run(); break;
      case 'alignJustify': chain().setTextAlign('justify').run(); break;
      case 'highlight': chain().toggleHighlight().run(); break;
      case 'bulletList': chain().toggleBulletList().run(); break;
      case 'orderedList': chain().toggleOrderedList().run(); break;
      case 'blockquote': chain().toggleBlockquote().run(); break;
      case 'codeBlock': chain().toggleCodeBlock().run(); break;
      case 'undo': chain().undo().run(); break;
      case 'redo': chain().redo().run(); break;
      case 'link': {
        const prev = editor.getAttributes('link').href || '';
        const url = window.prompt('URL del enlace:', prev);
        if (url === null) break;
        if (url === '') { chain().unsetLink().run(); break; }
        chain().extendMarkRange('link').setLink({ href: url }).run();
        break;
      }
      case 'image':
        if (onImageRequest) onImageRequest((url) => chain().setImage({ src: url }).run());
        break;
      case 'emoji':
        toggleEmojiPanel(toolbarEl, (emoji) => chain().insertContent(emoji).run());
        break;
    }
  });

  const colorInput = toolbarEl.querySelector('[data-color-picker]');
  if (colorInput) {
    colorInput.addEventListener('input', (e) => {
      editor.chain().focus().setColor(e.target.value).run();
    });
  }
}

function toggleEmojiPanel(toolbarEl, onPick) {
  let panel = document.getElementById('tiptapEmojiPanel');
  if (!panel) return;
  if (panel.style.display === 'block') {
    panel.style.display = 'none';
    return;
  }
  panel.innerHTML = COMMON_EMOJIS.map((e) => `<button type="button" class="tiptap-emoji-btn">${e}</button>`).join('');
  panel.querySelectorAll('.tiptap-emoji-btn').forEach((b) => {
    b.addEventListener('click', () => {
      onPick(b.textContent);
      panel.style.display = 'none';
    });
  });
  panel.style.display = 'block';
}
