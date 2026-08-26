// Crea admin/data/site.json con valores por defecto si no existe todavía.
// Se ejecuta en el deploy de producción: como site.json está gitignored
// (es contenido editable desde el CMS, no versionado), un servidor nuevo
// no lo tiene tras el git pull. Sin este guard, index.astro/Header.astro
// dependerían solo de sus fallbacks hardcodeados hasta el primer guardado
// desde el CMS.
const fs = require('fs');
const path = require('path');

const SITE_JSON_PATH = path.join(__dirname, '../data/site.json');

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
  updatedAt: new Date().toISOString().split('T')[0],
};

if (fs.existsSync(SITE_JSON_PATH)) {
  console.log('[site.json] ya existe, no se sobreescribe');
} else {
  fs.mkdirSync(path.dirname(SITE_JSON_PATH), { recursive: true });
  fs.writeFileSync(SITE_JSON_PATH, JSON.stringify(DEFAULTS, null, 2), 'utf8');
  console.log('[site.json] creado con valores por defecto');
}
