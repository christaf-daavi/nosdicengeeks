const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

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
      title: data.title || '',
      description: data.description || '',
      pubDate: data.pubDate || null,
      tags: data.tags || [],
      author: data.author || '',
      draft: data.draft ?? false,
      slug: filename.replace(/\.md$/, ''),
    };
  });
}

function getPost(filename) {
  const filepath = resolvePath(filename);
  const raw = fs.readFileSync(filepath, 'utf8');
  const { data: frontmatter, content } = matter(raw);
  return { frontmatter, content };
}

function createPost(data) {
  const { title, description = '', content = '', tags = [], author = '', draft = false, pubDate } = data;

  if (!title) throw new Error('El título es requerido');

  const filename = slugify(title) + '.md';
  const filepath = path.join(BLOG_DIR, filename);

  if (fs.existsSync(filepath)) {
    throw new Error(`Ya existe un post con ese nombre: ${filename}`);
  }

  const frontmatter = {
    title,
    description,
    pubDate: pubDate || new Date().toISOString().split('T')[0],
    tags: Array.isArray(tags) ? tags : [tags].filter(Boolean),
    author,
    draft,
  };

  const fileContent = matter.stringify(content, frontmatter);
  fs.writeFileSync(filepath, fileContent, 'utf8');

  return filename;
}

function updatePost(filename, data) {
  const filepath = resolvePath(filename);
  const raw = fs.readFileSync(filepath, 'utf8');
  const { data: existingFrontmatter, content: existingContent } = matter(raw);

  const { content = existingContent, ...frontmatterUpdates } = data;

  const newFrontmatter = { ...existingFrontmatter, ...frontmatterUpdates };

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

module.exports = { getAllPosts, getPost, createPost, updatePost, deletePost, unpublishPost };
