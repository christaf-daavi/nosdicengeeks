const fs = require('fs');
const path = require('path');
const { runBuild } = require('../utils/builder');

const SITE_JSON_PATH = path.join(__dirname, '../../data/site.json');

const DEFAULTS = {
  hero: {
    title: 'Bienvenido a',
    titleAccent: 'NosDicenGeeks',
    subtitle: 'Tecnología, cultura geek y todo lo que el mundo tech nos dice… a nuestra manera.',
  },
  topics: {
    sectionTitle: '¿De qué hablamos?',
    items: [
      { icon: '📱', name: 'Tecnología', desc: 'Lo último en tech, gadgets y software' },
      { icon: '🎮', name: 'Videojuegos', desc: 'Reviews, análisis y noticias gaming' },
      { icon: '🎬', name: 'Cultura Geek', desc: 'Cine, series, anime y más' },
    ],
  },
  latestPosts: {
    title: 'Últimas entradas',
    subtitle: 'Lo más reciente del universo geek',
  },
  menu: [
    { label: 'Inicio', href: '/' },
    { label: 'Etiquetas', href: '/tags' },
    { label: 'Nosotros', href: '/about' },
  ],
};

function readSiteContent() {
  if (!fs.existsSync(SITE_JSON_PATH)) return { ...DEFAULTS, updatedAt: null };
  return JSON.parse(fs.readFileSync(SITE_JSON_PATH, 'utf8'));
}

exports.getSiteContent = (req, res) => {
  try {
    res.json(readSiteContent());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSiteContent = async (req, res) => {
  try {
    const current = readSiteContent();
    const { hero, topics, latestPosts, menu } = req.body;

    const updated = {
      hero: hero !== undefined ? hero : current.hero,
      topics: topics !== undefined ? topics : current.topics,
      latestPosts: latestPosts !== undefined ? latestPosts : current.latestPosts,
      menu: menu !== undefined ? menu : current.menu,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    fs.mkdirSync(path.dirname(SITE_JSON_PATH), { recursive: true });
    fs.writeFileSync(SITE_JSON_PATH, JSON.stringify(updated, null, 2), 'utf8');

    // A diferencia de posts/páginas (que usan un botón "Publicar" separado),
    // el home y el menú disparan el build en el mismo guardado: son
    // contenido de bajo volumen de cambios y afectan el layout global
    // (header/menú de TODO el sitio), así que dejarlos desactualizados
    // tras guardar es más visible/costoso que en un post individual.
    // El build ya se completó (o falló) en este punto: si falla, el
    // contenido ya quedó guardado igual, solo se informa el error del build.
    try {
      const build = await runBuild();
      res.json({ success: true, content: updated, build });
    } catch (err) {
      res.json({
        success: true,
        content: updated,
        build: { success: false, error: err.message, output: err.output || '' },
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
