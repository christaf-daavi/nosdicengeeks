const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const BLOG_DIR = path.join(process.env.BLOG_PATH || '/var/www/nosdicengeeks-dev', 'src/content/blog');

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function resolvePath(filename) {
  // Evita path traversal
  const resolved = path.resolve(BLOG_DIR, filename);
  if (!resolved.startsWith(path.resolve(BLOG_DIR))) {
    throw new Error('Nombre de archivo no válido');
  }
  return resolved;
}

function getAllPosts() {
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'));

  return files.map((filename) => {
    const raw = fs.readFileSync(path.join(BLOG_DIR, filename), 'utf8');
    const { data } = matter(raw);
    return {
      filename,
      id: data.id || '',
      title: data.title || '',
      description: data.description || '',
      pubDate: data.pubDate || null,
      tags: data.tags || [],
      author: data.author || '',
      draft: data.draft ?? false,
      slug: data.slug || filename.replace(/\.md$/, ''),
    };
  });
}

function getPost(filename) {
  const filepath = resolvePath(filename);
  const raw = fs.readFileSync(filepath, 'utf8');
  const { data: frontmatter, content } = matter(raw);
  return { frontmatter, content: marked.parse(content) };
}

function createPost(data) {
  const {
    title, description = '', content = '', tags = [], author = '', draft = false, pubDate,
    image, ogTitle, ogDescription, ogImage, twitterCard, slug,
    heroLabel, heroTitle, heroCopy,
    heroLabelColor, heroTitleColor, heroCopyColor,
  } = data;

  if (!title) throw new Error('El título es requerido');

  const filename = slugify(title) + '.md';
  const filepath = path.join(BLOG_DIR, filename);

  if (fs.existsSync(filepath)) {
    throw new Error(`Ya existe un post con ese nombre: ${filename}`);
  }

  const frontmatter = {
    id: data.id || ('ndg-' + Math.floor(Date.now() / 1000)),
    title,
    description,
    pubDate: pubDate || new Date().toISOString().split('T')[0],
    tags: Array.isArray(tags) ? tags : [tags].filter(Boolean),
    author,
    // Antes se omitía: la portada de un post nuevo se perdía al primer guardado
    ...(image && image.src ? { image: { src: image.src, alt: image.alt || title } } : {}),
    draft,
    slug: slugify(slug || title),
    og_title: ogTitle || '',
    og_description: ogDescription || '',
    og_image: ogImage || '',
    twitter_card: twitterCard || 'summary_large_image',
    heroLabel: heroLabel || '',
    heroTitle: heroTitle || '',
    heroCopy: heroCopy || '',
    heroLabelColor: heroLabelColor || '#fbbc42',
    heroTitleColor: heroTitleColor || '#ffffff',
    heroCopyColor: heroCopyColor || '#ffffff',
  };

  const fileContent = matter.stringify(content, frontmatter);
  fs.writeFileSync(filepath, fileContent, 'utf8');

  return filename;
}

function updatePost(filename, data) {
  const filepath = resolvePath(filename);
  const raw = fs.readFileSync(filepath, 'utf8');
  const { data: existingFrontmatter, content: existingContent } = matter(raw);

  const {
    content = existingContent, ogTitle, ogDescription, ogImage, twitterCard, slug,
    heroLabel, heroTitle, heroCopy,
    heroLabelColor, heroTitleColor, heroCopyColor,
    ...frontmatterUpdates
  } = data;

  const newFrontmatter = { ...existingFrontmatter, ...frontmatterUpdates };

  // Asignación explícita de draft: no depender únicamente del spread de
  // frontmatterUpdates, para que un refactor futuro de la desestructuración
  // no pueda perder este campo en silencio.
  if (data.draft !== undefined) newFrontmatter.draft = !!data.draft;

  if (ogTitle !== undefined) newFrontmatter.og_title = ogTitle || '';
  if (ogDescription !== undefined) newFrontmatter.og_description = ogDescription || '';
  if (ogImage !== undefined) newFrontmatter.og_image = ogImage || '';
  if (twitterCard !== undefined) newFrontmatter.twitter_card = twitterCard || 'summary_large_image';
  if (slug !== undefined && slug !== '') newFrontmatter.slug = slugify(slug);
  if (heroLabel !== undefined) newFrontmatter.heroLabel = heroLabel || '';
  if (heroTitle !== undefined) newFrontmatter.heroTitle = heroTitle || '';
  if (heroCopy !== undefined) newFrontmatter.heroCopy = heroCopy || '';
  if (heroLabelColor !== undefined) newFrontmatter.heroLabelColor = heroLabelColor || '#fbbc42';
  if (heroTitleColor !== undefined) newFrontmatter.heroTitleColor = heroTitleColor || '#ffffff';
  if (heroCopyColor !== undefined) newFrontmatter.heroCopyColor = heroCopyColor || '#ffffff';

  // Normaliza tags si viene como string
  if (newFrontmatter.tags && !Array.isArray(newFrontmatter.tags)) {
    newFrontmatter.tags = [newFrontmatter.tags].filter(Boolean);
  }

  const fileContent = matter.stringify(content, newFrontmatter);
  fs.writeFileSync(filepath, fileContent, 'utf8');
}

function deletePost(filename) {
  const filepath = resolvePath(filename);
  fs.unlinkSync(filepath);
}

function unpublishPost(filename) {
  const filepath = resolvePath(filename);
  const raw = fs.readFileSync(filepath, 'utf8');
  const { data: frontmatter, content } = matter(raw);

  frontmatter.draft = true;

  const fileContent = matter.stringify(content, frontmatter);
  fs.writeFileSync(filepath, fileContent, 'utf8');
}

function bulkDeletePosts(filenames) {
  const errors = [];
  let deleted = 0;
  for (const filename of filenames) {
    try {
      const filepath = resolvePath(filename);
      fs.unlinkSync(filepath);
      deleted++;
    } catch (err) {
      errors.push({ filename, error: err.message });
    }
  }
  return { deleted, errors };
}

// gray-matter evalúa con eval() el frontmatter "---js"; en archivos que
// sube el usuario solo se acepta YAML (o JSON).
const IMPORT_MATTER_OPTIONS = {
  engines: { javascript: () => { throw new Error('Frontmatter JavaScript no permitido'); } },
};

function toDateString(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
}

// Parsea un .md importado desde el editor (sin guardar nada): devuelve
// solo los campos de frontmatter que el formulario sabe rellenar y el
// cuerpo en HTML, igual que getPost(). Lo no reconocido se ignora.
function parseMarkdown(raw) {
  const { data, content } = matter(raw, IMPORT_MATTER_OPTIONS);
  const text = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');
  const frontmatter = {};

  if (text(data.title)) frontmatter.title = text(data.title);
  if (text(data.description)) frontmatter.description = text(data.description);

  const rawTags = Array.isArray(data.tags) ? data.tags : text(data.tags).split(',');
  const tags = rawTags.map(text).filter(Boolean);
  if (tags.length) frontmatter.tags = tags;

  const image = data.image ?? data.cover;
  const imageSrc = typeof image === 'object' && image !== null ? text(image.src || image.url) : text(image);
  if (imageSrc) {
    frontmatter.image = { src: imageSrc, alt: typeof image === 'object' ? text(image.alt) : '' };
  }

  const pubDate = toDateString(data.pubDate ?? data.date);
  if (pubDate) frontmatter.pubDate = pubDate;

  if (typeof data.draft === 'boolean') frontmatter.draft = data.draft;
  else if (data.draft === 'true' || data.draft === 'false') frontmatter.draft = data.draft === 'true';

  return { frontmatter, hasFrontmatter: Object.keys(data).length > 0, html: marked.parse(content) };
}

module.exports = { getAllPosts, getPost, createPost, updatePost, deletePost, unpublishPost, bulkDeletePosts, parseMarkdown };
