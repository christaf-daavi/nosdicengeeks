import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, '../public/images');

const W = 1200;
const H = 630;

function linearGradientSVG(color1, color2) {
  return `
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
      </linearGradient>
    </defs>
  `;
}

async function createCover({ filename, gradient, title, subtitle, accentColor }) {
  const [c1, c2] = gradient;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  ${linearGradientSVG(c1, c2)}

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#grad)" />

  <!-- Subtle grid pattern -->
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#grid)" />

  <!-- Accent line -->
  <rect x="0" y="${H - 6}" width="${W}" height="6" fill="${accentColor}" />

  <!-- Title -->
  <text
    x="${W / 2}"
    y="${H / 2 - 40}"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="'Segoe UI', system-ui, -apple-system, sans-serif"
    font-size="56"
    font-weight="700"
    fill="white"
    letter-spacing="-1"
  >${title}</text>

  <!-- Subtitle -->
  <text
    x="${W / 2}"
    y="${H / 2 + 50}"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="'Segoe UI', system-ui, -apple-system, sans-serif"
    font-size="28"
    font-weight="400"
    fill="rgba(255,255,255,0.85)"
    letter-spacing="0.5"
  >${subtitle}</text>
</svg>`;

  const outputPath = path.join(outputDir, filename);
  await sharp(Buffer.from(svg))
    .webp({ quality: 90 })
    .toFile(outputPath);

  console.log(`✓ Generated: ${outputPath}`);
}

await createCover({
  filename: 'bienvenidos-cover.webp',
  gradient: ['#0496ff', '#006ba6'],
  title: 'NosDicenGeeks',
  subtitle: 'El blog geek en tu idioma',
  accentColor: '#d81159',
});

await createCover({
  filename: 'cyberpunk-2077-review.webp',
  gradient: ['#8f2d56', '#d81159'],
  title: 'Cyberpunk 2077',
  subtitle: 'Review — ¿Vale la pena en 2024?',
  accentColor: '#fbbc42',
});

console.log('Done.');
