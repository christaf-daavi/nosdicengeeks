const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const IMAGES_DIR = path.join(
  process.env.BLOG_PATH || '/var/www/nosdicengeeks-dev',
  'public/images'
);

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
