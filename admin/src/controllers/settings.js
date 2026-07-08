const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const LOGO_DIR = path.join(
  process.env.BLOG_PATH || '/var/www/nosdicengeeks-dev',
  'public/images/logo'
);
const LOGO_WEBP_PATH = path.join(LOGO_DIR, 'logo.webp');
const LOGO_SVG_PATH = path.join(LOGO_DIR, 'logo.svg');

function removeExistingLogos() {
  if (fs.existsSync(LOGO_WEBP_PATH)) fs.unlinkSync(LOGO_WEBP_PATH);
  if (fs.existsSync(LOGO_SVG_PATH)) fs.unlinkSync(LOGO_SVG_PATH);
}

exports.uploadLogo = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ninguna imagen' });
  }
  if (!fs.existsSync(LOGO_DIR)) {
    fs.mkdirSync(LOGO_DIR, { recursive: true });
  }

  if (req.file.mimetype === 'image/svg+xml') {
    try {
      removeExistingLogos();
      fs.writeFileSync(LOGO_SVG_PATH, req.file.buffer);
      return res.json({
        success: true,
        url: '/images/logo/logo.svg',
        size: req.file.buffer.length,
      });
    } catch (err) {
      return res.status(500).json({ error: `Error al guardar el logo: ${err.message}` });
    }
  }

  removeExistingLogos();
  sharp(req.file.buffer)
    .resize({ width: 512, withoutEnlargement: true })
    .webp({ quality: 90 })
    .toFile(LOGO_WEBP_PATH, (err, info) => {
      if (err) {
        return res.status(500).json({ error: `Error al procesar el logo: ${err.message}` });
      }
      res.json({
        success: true,
        url: '/images/logo/logo.webp',
        size: info.size,
        width: info.width,
        height: info.height,
      });
    });
};

exports.removeLogo = (req, res) => {
  try {
    const hadWebp = fs.existsSync(LOGO_WEBP_PATH);
    const hadSvg = fs.existsSync(LOGO_SVG_PATH);
    if (!hadWebp && !hadSvg) {
      return res.status(404).json({ error: 'Logo no encontrado' });
    }
    removeExistingLogos();
    res.json({ success: true, message: 'Logo eliminado' });
  } catch (err) {
    res.status(500).json({ error: `Error al eliminar el logo: ${err.message}` });
  }
};

exports.getLogo = (req, res) => {
  if (fs.existsSync(LOGO_WEBP_PATH)) {
    return res.json({ url: '/images/logo/logo.webp', exists: true });
  }
  if (fs.existsSync(LOGO_SVG_PATH)) {
    return res.json({ url: '/images/logo/logo.svg', exists: true });
  }
  res.json({ url: '/images/logo/logo.webp', exists: false });
};

// ── Favicon ─────────────────────────────────────────────────────
const PUBLIC_DIR = path.join(process.env.BLOG_PATH || '/var/www/nosdicengeeks-dev', 'public');
const FAVICON_ICO_PATH = path.join(PUBLIC_DIR, 'favicon.ico');
const FAVICON_PNG_PATH = path.join(PUBLIC_DIR, 'favicon.png');

function removeExistingFavicons() {
  if (fs.existsSync(FAVICON_ICO_PATH)) fs.unlinkSync(FAVICON_ICO_PATH);
  if (fs.existsSync(FAVICON_PNG_PATH)) fs.unlinkSync(FAVICON_PNG_PATH);
}

exports.uploadFavicon = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ninguna imagen' });
  }

  // sharp no puede decodificar el formato ICO (no es un códec de imagen
  // estándar, es un contenedor). Si ya viene como .ico, se guarda tal cual
  // sin pasar por sharp; para el resto (PNG/SVG/etc.) se redimensiona a 32x32.
  if (req.file.mimetype === 'image/x-icon' || req.file.mimetype === 'image/vnd.microsoft.icon') {
    try {
      removeExistingFavicons();
      fs.writeFileSync(FAVICON_ICO_PATH, req.file.buffer);
      return res.json({ success: true, url: '/favicon.ico', size: req.file.buffer.length });
    } catch (err) {
      return res.status(500).json({ error: `Error al guardar el favicon: ${err.message}` });
    }
  }

  sharp(req.file.buffer)
    .resize(32, 32)
    .png()
    .toBuffer()
    .then((buffer) => {
      removeExistingFavicons();
      fs.writeFileSync(FAVICON_ICO_PATH, buffer);
      fs.writeFileSync(FAVICON_PNG_PATH, buffer);
      res.json({ success: true, url: '/favicon.ico', size: buffer.length });
    })
    .catch((err) => {
      res.status(500).json({ error: `Error al procesar el favicon: ${err.message}` });
    });
};

exports.removeFavicon = (req, res) => {
  try {
    const hadIco = fs.existsSync(FAVICON_ICO_PATH);
    const hadPng = fs.existsSync(FAVICON_PNG_PATH);
    if (!hadIco && !hadPng) {
      return res.status(404).json({ error: 'Favicon no encontrado' });
    }
    removeExistingFavicons();
    res.json({ success: true, message: 'Favicon eliminado' });
  } catch (err) {
    res.status(500).json({ error: `Error al eliminar el favicon: ${err.message}` });
  }
};

exports.getFavicon = (req, res) => {
  if (fs.existsSync(FAVICON_ICO_PATH)) {
    return res.json({ url: '/favicon.ico', exists: true });
  }
  if (fs.existsSync(FAVICON_PNG_PATH)) {
    return res.json({ url: '/favicon.png', exists: true });
  }
  res.json({ url: '/favicon.ico', exists: false });
};

// ── Configuración del sitio (GTM, etc.) ──────────────────────────
const SITE_CONFIG_PATH = path.join(
  process.env.BLOG_PATH || '/var/www/nosdicengeeks-dev',
  'src/data/site-config.json'
);

exports.getSiteConfig = (req, res) => {
  try {
    if (!fs.existsSync(SITE_CONFIG_PATH)) {
      return res.json({ gtmId: '' });
    }
    const config = JSON.parse(fs.readFileSync(SITE_CONFIG_PATH, 'utf8'));
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: `Error al leer la configuración: ${err.message}` });
  }
};

exports.updateSiteConfig = (req, res) => {
  try {
    const { gtmId } = req.body;
    const config = { gtmId: (gtmId || '').trim() };
    fs.mkdirSync(path.dirname(SITE_CONFIG_PATH), { recursive: true });
    fs.writeFileSync(SITE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    res.json({ success: true, ...config });
  } catch (err) {
    res.status(500).json({ error: `Error al guardar la configuración: ${err.message}` });
  }
};
