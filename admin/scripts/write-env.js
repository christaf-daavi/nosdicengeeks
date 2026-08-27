// Crea o actualiza admin/.env en el servidor de producción con las
// variables sensibles y de configuración del entorno prod. Los 3 secrets
// (JWT_SECRET, CLOUDFLARE_ZONE_ID, CLOUDFLARE_API_TOKEN) llegan por argv en
// base64 — así ningún carácter especial que puedan contener rompe el
// parseo del comando remoto en deploy-prod.yml — nunca se hardcodean acá
// ni en ecosystem.config.js. Preserva cualquier línea del .env existente
// que no corresponda a una clave gestionada, para no pisar configuración
// agregada manualmente en el servidor.
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '../.env');

const [jwtSecretB64, cloudflareZoneIdB64, cloudflareApiTokenB64] = process.argv.slice(2);

function decode(b64) {
  return b64 ? Buffer.from(b64, 'base64').toString('utf8') : '';
}

const desired = {
  JWT_SECRET: decode(jwtSecretB64),
  CLOUDFLARE_ZONE_ID: decode(cloudflareZoneIdB64),
  CLOUDFLARE_API_TOKEN: decode(cloudflareApiTokenB64),
  BLOG_PATH: '/var/www/nosdicengeeks-prod',
  PORT: '3000',
  NODE_ENV: 'production',
};

const MANAGED_KEYS = Object.keys(desired);

const existingLines = fs.existsSync(ENV_PATH)
  ? fs.readFileSync(ENV_PATH, 'utf8').split('\n')
  : [];

// Conserva líneas de claves no gestionadas acá (config manual del servidor).
const preservedLines = existingLines.filter((line) => {
  const match = line.match(/^([A-Z0-9_]+)=/);
  return line.trim() && (!match || !MANAGED_KEYS.includes(match[1]));
});

// Si un secret llegó vacío (ej. GitHub secret sin configurar todavía), no
// se escribe esa línea — evita pisar un valor bueno ya presente en el .env
// con uno vacío por un run mal configurado.
const managedLines = Object.entries(desired)
  .filter(([, value]) => value !== '')
  .map(([key, value]) => `${key}=${value}`);

fs.writeFileSync(ENV_PATH, [...managedLines, ...preservedLines].join('\n') + '\n', 'utf8');
console.log(`[.env] actualizado: ${managedLines.length} variables gestionadas, ${preservedLines.length} preservadas`);
