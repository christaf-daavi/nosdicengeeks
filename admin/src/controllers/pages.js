const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const PAGES_DIR = path.join(
  process.env.BLOG_PATH || '/var/www/nosdicengeeks-dev',
  'src/content/pages'
);

function resolvePath(filename) {
  // Evita path traversal
  const resolved = path.resolve(PAGES_DIR, filename);
  if (!resolved.startsWith(path.resolve(PAGES_DIR))) {
    throw new Error('Nombre de archivo no válido');
  }
  return resolved;
}

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

exports.getAll = (req, res) => {
  try {
    const files = fs.readdirSync(PAGES_DIR).filter((f) => f.endsWith('.md'));
    const pages = files.map((filename) => {
      const raw = fs.readFileSync(path.join(PAGES_DIR, filename), 'utf8');
      const { data } = matter(raw);
      return {
        filename,
        id: data.id || '',
        title: data.title || '',
        description: data.description || '',
        draft: data.draft ?? false,
        updatedAt: data.updatedAt || null,
        slug: data.slug || filename.replace(/\.md$/, ''),
      };
    });
    res.json(pages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOne = (req, res) => {
  try {
    const filepath = resolvePath(req.params.filename);
    const raw = fs.readFileSync(filepath, 'utf8');
    const { data: frontmatter, content } = matter(raw);
    res.json({ frontmatter, content: marked.parse(content) });
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Página no encontrada' });
    res.status(500).json({ error: err.message });
  }
};

exports.update = (req, res) => {
  try {
    const filepath = resolvePath(req.params.filename);
    const raw = fs.readFileSync(filepath, 'utf8');
    const { data: existingFrontmatter, content: existingContent } = matter(raw);

    const { content = existingContent, title, description, ogTitle, ogDescription, ogImage, twitterCard, slug, template } = req.body;

    const newFrontmatter = { ...existingFrontmatter };
    if (title !== undefined) newFrontmatter.title = title;
    if (description !== undefined) newFrontmatter.description = description;
    if (ogTitle !== undefined) newFrontmatter.og_title = ogTitle || '';
    if (ogDescription !== undefined) newFrontmatter.og_description = ogDescription || '';
    if (ogImage !== undefined) newFrontmatter.og_image = ogImage || '';
    if (twitterCard !== undefined) newFrontmatter.twitter_card = twitterCard || 'summary_large_image';
    if (slug !== undefined && slug !== '') {
      newFrontmatter.slug = slugify(slug);
    }
    if (template !== undefined) newFrontmatter.template = template || '';
    newFrontmatter.updatedAt = new Date().toISOString().split('T')[0];

    const fileContent = matter.stringify(content, newFrontmatter);
    fs.writeFileSync(filepath, fileContent, 'utf8');
    res.json({ message: 'Página actualizada correctamente' });
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Página no encontrada' });
    res.status(500).json({ error: err.message });
  }
};
