const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const matter = require('gray-matter');
const IMAGES_DIR = path.join(
  process.env.BLOG_PATH || '/var/www/nosdicengeeks-dev',
  'public/images'
);
const BLOG_DIR = path.join(
  process.env.BLOG_PATH || '/var/www/nosdicengeeks-dev',
  'src/content/blog'
);

function getPostsUsingImage(filename) {
  if (!fs.existsSync(BLOG_DIR)) return [];
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'));
  const usedIn = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');
    const { data } = matter(raw);
    if (data.image && data.image.src && data.image.src.includes(filename)) {
      const slug = file.replace(/\.md$/, '');
      usedIn.push({
        id: data.id || '',
        title: data.title || '',
        slug,
        url: `/posts/${slug}`,
      });
    }
  }
  return usedIn;
}

exports.upload = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ninguna imagen' });
  }
  const originalName = path.basename(req.file.originalname).replace(/\s+/g, '-');
  const nameWithoutExt = originalName.replace(/\.[^.]+$/, '');
  const filename = `${Date.now()}-${nameWithoutExt}.webp`;
  const outputPath = path.join(IMAGES_DIR, filename);
  sharp(req.file.buffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(outputPath, (err, info) => {
      if (err) {
        return res.status(500).json({ error: `Error al procesar imagen: ${err.message}` });
      }
      res.json({
        success: true,
        url: `/images/${filename}`,
        filename,
        size: info.size,
        width: info.width,
        height: info.height,
      });
    });
};

exports.list = (req, res) => {
  try {
    if (!fs.existsSync(IMAGES_DIR)) {
      return res.json({ files: [] });
    }
    const files = fs.readdirSync(IMAGES_DIR)
      .filter(f => /\.(webp|jpg|jpeg|png|gif)$/i.test(f))
      .map(f => {
        const stat = fs.statSync(path.join(IMAGES_DIR, f));
        const kb = (stat.size / 1024).toFixed(1);
        return {
          name: f,
          url: `/images/${f}`,
          size: `${kb} KB`,
          createdAt: stat.mtime,
          usedIn: getPostsUsingImage(f),
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: `Error al listar imágenes: ${err.message}` });
  }
};

exports.remove = (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filepath = path.join(IMAGES_DIR, filename);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }
    fs.unlinkSync(filepath);
    res.json({ success: true, message: 'Imagen eliminada' });
  } catch (err) {
    res.status(500).json({ error: `Error al eliminar imagen: ${err.message}` });
  }
};

exports.bulkDelete = (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores pueden hacer eliminación en bloque' });
  }
  const { filenames } = req.body;
  if (!Array.isArray(filenames) || filenames.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array de filenames no vacío' });
  }
  try {
    const usedImages = [];
    for (const name of filenames) {
      const filename = path.basename(name);
      const usedIn = getPostsUsingImage(filename);
      if (usedIn.length > 0) {
        usedImages.push({ name: filename, usedIn });
      }
    }
    if (usedImages.length > 0) {
      return res.status(400).json({ error: 'Algunas imágenes están en uso', usedImages });
    }
    let deleted = 0;
    for (const name of filenames) {
      const filepath = path.join(IMAGES_DIR, path.basename(name));
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        deleted++;
      }
    }
    res.json({ success: true, deleted });
  } catch (err) {
    res.status(500).json({ error: `Error al eliminar imágenes: ${err.message}` });
  }
};
