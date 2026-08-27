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

// Anchos responsivos generados junto al archivo base (1200w, el "master"
// que ya se guardaba antes y sigue siendo el que queda en el frontmatter
// de los posts). BlogPostCard.astro arma el srcset con estos mismos tres
// anchos — si se cambia esta lista hay que cambiarla ahí también.
const RESPONSIVE_WIDTHS = [400, 800];

function variantFilename(filename, width) {
  const ext = path.extname(filename);
  const base = filename.slice(0, -ext.length);
  return `${base}-${width}w${ext}`;
}

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
    .toFile(outputPath, async (err, info) => {
      if (err) {
        return res.status(500).json({ error: `Error al procesar imagen: ${err.message}` });
      }
      try {
        await Promise.all(
          RESPONSIVE_WIDTHS.map((width) =>
            sharp(req.file.buffer)
              .resize({ width, withoutEnlargement: true })
              .webp({ quality: 85 })
              .toFile(path.join(IMAGES_DIR, variantFilename(filename, width)))
          )
        );
      } catch (variantErr) {
        // El archivo base (1200w) ya se guardó bien: si fallan las
        // variantes chicas no se aborta el upload, solo queda sin
        // srcset optimizado hasta que se resuba o se regeneren a mano.
        console.error('[media] Error generando variantes responsivas:', variantErr.message);
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
    const isResponsiveVariant = new RegExp(`-(${RESPONSIVE_WIDTHS.join('|')})w\\.[a-z]+$`, 'i');
    const files = fs.readdirSync(IMAGES_DIR)
      .filter(f => /\.(webp|jpg|jpeg|png|gif)$/i.test(f) && !isResponsiveVariant.test(f))
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

function removeVariants(filename) {
  for (const width of RESPONSIVE_WIDTHS) {
    const variantPath = path.join(IMAGES_DIR, variantFilename(filename, width));
    if (fs.existsSync(variantPath)) fs.unlinkSync(variantPath);
  }
}

exports.remove = (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filepath = path.join(IMAGES_DIR, filename);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }
    fs.unlinkSync(filepath);
    removeVariants(filename);
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
      const basename = path.basename(name);
      const filepath = path.join(IMAGES_DIR, basename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        removeVariants(basename);
        deleted++;
      }
    }
    res.json({ success: true, deleted });
  } catch (err) {
    res.status(500).json({ error: `Error al eliminar imágenes: ${err.message}` });
  }
};
