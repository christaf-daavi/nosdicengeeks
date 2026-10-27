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
  Node,
  StarterKit,
  TextStyle,
  Color,
  Underline,
  TextAlign,
  Highlight,
  Link,
  Image as ImageExt,
  Table,
  TableRow,
  TableHeader,
  TableCell,
} from '/js/tiptap-bundle.js';
import { parseVideoUrl, EMBED_IFRAME_ATTRS } from '/js/video-embed.js';

// @tiptap/extension-emoji no existía todavía en la serie 2.11.x (publicado
// recién en 2.27+). El picker de emojis se implementa abajo con un panel
// propio de emojis comunes, sin depender de esa extensión.
const COMMON_EMOJIS = ['😀','😂','😍','🤔','😎','👍','👎','🎉','🔥','💯','🚀','⚡','💡','✅','❌','⭐','❤️','😅','🙌','👀'];

// Video embebido (YouTube/Vimeo/TikTok) como bloque atómico. Se serializa
// como <div class="video-embed"><iframe …></iframe></div>, que va tal cual
// al .md y Astro renderiza sin tocar. Al parsear HTML, el src del iframe
// se vuelve a validar con parseVideoUrl: cualquier iframe de otro origen
// no matchea este nodo y el esquema de TipTap lo descarta.
const VideoEmbed = Node.create({
  name: 'videoEmbed',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: null }, vertical: { default: false } };
  },
  parseHTML() {
    return [{
      tag: 'div.video-embed',
      getAttrs: (el) => {
        const iframe = el.querySelector('iframe');
        const video = iframe ? parseVideoUrl(iframe.getAttribute('src')) : null;
        return video && video.ok ? { src: video.embedUrl, vertical: video.vertical } : false;
      },
    }];
  },
  renderHTML({ node }) {
    return ['div', { class: node.attrs.vertical ? 'video-embed video-embed--vertical' : 'video-embed' },
      ['iframe', { src: node.attrs.src, ...EMBED_IFRAME_ATTRS }]];
  },
});

// Tablas con HTML limpio en el .md. Dentro del editor TipTap usa su
// TableView (con colgroup para editar); al serializar con getHTML() la
// extensión añadiría <colgroup>, style="min-width…" y colspan/rowspan="1"
// en cada celda. Aquí se omiten: solo se emiten colspan/rowspan > 1.
const CleanTable = Table.extend({
  renderHTML({ HTMLAttributes }) {
    return ['table', { ...this.options.HTMLAttributes, ...HTMLAttributes }, ['tbody', 0]];
  },
});
const spanOnlyIfMerged = (parentAttrs) => ({
  ...parentAttrs,
  colspan: { ...parentAttrs.colspan, renderHTML: (a) => (a.colspan > 1 ? { colspan: a.colspan } : {}) },
  rowspan: { ...parentAttrs.rowspan, renderHTML: (a) => (a.rowspan > 1 ? { rowspan: a.rowspan } : {}) },
});
const CleanTableCell = TableCell.extend({ addAttributes() { return spanOnlyIfMerged(this.parent()); } });
const CleanTableHeader = TableHeader.extend({ addAttributes() { return spanOnlyIfMerged(this.parent()); } });

export function createEditor(element, { content = '', onUpdate, editorProps = {} } = {}) {
  const editor = new Editor({
    element,
    editorProps,
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight,
      Link.configure({ openOnClick: false, autolink: true }),
      ImageExt,
      VideoEmbed,
      // resizable: false → sin anchos de columna en línea (ver CleanTable)
      CleanTable.configure({ resizable: false }),
      TableRow,
      CleanTableHeader,
      CleanTableCell,
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
    btn.setAttribute('aria-pressed', String(!!active));
  });

  // Controles de tabla: solo con el cursor dentro de una tabla
  const tableBar = document.getElementById('tableToolbar');
  if (tableBar) {
    const inTable = editor.isActive('table');
    tableBar.hidden = !inTable;
    if (inTable) {
      const can = editor.can();
      const enabled = {
        addRowAfter: can.addRowAfter(), deleteRow: can.deleteRow(),
        addColumnAfter: can.addColumnAfter(), deleteColumn: can.deleteColumn(),
        toggleHeaderRow: can.toggleHeaderRow(), deleteTable: can.deleteTable(),
      };
      tableBar.querySelectorAll('[data-action]').forEach((btn) => {
        btn.disabled = enabled[btn.dataset.action] === false;
      });
    }
  }
}

export function wireToolbar(editor, toolbarEl, { onImageRequest, onVideoRequest } = {}) {
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
        if (onImageRequest) onImageRequest((url, alt) => chain().setImage({ src: url, alt: alt || null }).run());
        break;
      case 'video':
        // El párrafo de después deja el cursor fuera del bloque: así seguir
        // escribiendo o insertar otro video no reemplaza al recién insertado.
        if (onVideoRequest) onVideoRequest(({ embedUrl, vertical }) =>
          chain().insertContent([
            { type: 'videoEmbed', attrs: { src: embedUrl, vertical } },
            { type: 'paragraph' },
          ]).run());
        break;
      case 'emoji':
        toggleEmojiPanel(toolbarEl, (emoji) => chain().insertContent(emoji).run());
        break;
      case 'insertTable': chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); break;
      case 'addRowAfter': chain().addRowAfter().run(); break;
      case 'deleteRow': chain().deleteRow().run(); break;
      case 'addColumnAfter': chain().addColumnAfter().run(); break;
      case 'deleteColumn': chain().deleteColumn().run(); break;
      case 'toggleHeaderRow': chain().toggleHeaderRow().run(); break;
      case 'deleteTable': chain().deleteTable().run(); break;
    }
  });

  // Teclado: dentro de una tabla Tab pasa de celda en celda, así que
  // Alt+F10 lleva a la barra (a la de tabla si el cursor está en una) y
  // Esc devuelve el foco al texto.
  editor.view.dom.addEventListener('keydown', (e) => {
    if (!(e.altKey && e.key === 'F10')) return;
    e.preventDefault();
    const tableBar = toolbarEl.querySelector('#tableToolbar');
    const target = (tableBar && !tableBar.hidden ? tableBar : toolbarEl).querySelector('button:not([disabled])');
    if (target) target.focus();
  });
  toolbarEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !e.target.closest('.tiptap-emoji-panel')) {
      e.preventDefault();
      editor.commands.focus();
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
