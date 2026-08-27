// Genera las variantes responsivas (400w/800w) para imágenes en
// public/images/ que todavía no las tienen — por ejemplo, las subidas
// antes de que admin/src/controllers/media.js empezara a generarlas
// automáticamente en cada upload (ver esa misma convención de nombres,
// y BlogPostCard.astro que arma el srcset esperando estos archivos).
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const IMAGES_DIR = path.join(
  process.env.BLOG_PATH || '/var/www/nosdicengeeks-dev',
  'public/images'
);
const RESPONSIVE_WIDTHS = [400, 800];

function variantFilename(filename, width) {
  const ext = path.extname(filename);
  const base = filename.slice(0, -ext.length);
  return `${base}-${width}w${ext}`;
}

function isResponsiveVariant(filename) {
  return new RegExp(`-(${RESPONSIVE_WIDTHS.join('|')})w\\.[a-z]+$`, 'i').test(filename);
}

async function main() {
  if (!fs.existsSync(IMAGES_DIR)) {
    console.log('[backfill] IMAGES_DIR no existe, nada que hacer');
    return;
  }

  const files = fs
    .readdirSync(IMAGES_DIR)
    .filter((f) => /\.(webp|jpg|jpeg|png)$/i.test(f) && !isResponsiveVariant(f));

  let generated = 0;
  for (const filename of files) {
    const missing = RESPONSIVE_WIDTHS.filter(
      (width) => !fs.existsSync(path.join(IMAGES_DIR, variantFilename(filename, width)))
    );
    if (!missing.length) continue;

    const inputPath = path.join(IMAGES_DIR, filename);
    for (const width of missing) {
      await sharp(inputPath)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(path.join(IMAGES_DIR, variantFilename(filename, width)));
      generated++;
    }
    console.log(`[backfill] ${filename}: generadas variantes ${missing.join(', ')}w`);
  }
  console.log(`[backfill] listo — ${generated} variantes generadas`);
}

main().catch((err) => {
  console.error('[backfill] error:', err.message);
  process.exit(1);
});
