const { exec } = require('child_process');
const path = require('path');

const BLOG_PATH = process.env.BLOG_PATH || '/var/www/nosdicengeeks-dev';
const BUILD_TIMEOUT = 5 * 60 * 1000; // 5 minutos

async function purgeCloudflareCache() {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!zoneId || !token) {
    console.log('[cache] Variables de Cloudflare no configuradas, omitiendo purga');
    return { purged: false };
  }
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ purge_everything: true })
  });
  const data = await res.json();
  if (data.success) {
    console.log('[cache] Caché de Cloudflare purgado correctamente');
    return { purged: true };
  } else {
    console.error('[cache] Error purgando caché:', JSON.stringify(data.errors));
    return { purged: false, errors: data.errors };
  }
}

function runBuild() {
  return new Promise((resolve, reject) => {
    const proc = exec(
      'npm run build',
      { cwd: BLOG_PATH, timeout: BUILD_TIMEOUT },
      async (error, stdout, stderr) => {
        if (error) {
          return reject({ message: error.message, output: stderr || stdout });
        }
        // El build ya terminó con éxito en este punto: un fallo al purgar
        // el caché de Cloudflare (red, credenciales, etc.) no debe hacer
        // fallar runBuild(), solo reflejarse en purged/purgeErrors.
        let purgeResult;
        try {
          purgeResult = await purgeCloudflareCache();
        } catch (err) {
          console.error('[cache] Excepción al purgar caché de Cloudflare:', err.message);
          purgeResult = { purged: false, errors: [{ message: err.message }] };
        }
        const { purged, errors } = purgeResult;
        resolve({ success: true, output: stdout, purged, ...(errors ? { purgeErrors: errors } : {}) });
      }
    );

    // Garantiza que el proceso se mata si supera el timeout
    const timer = setTimeout(() => {
      proc.kill();
      reject({ message: 'Build cancelado: timeout de 5 minutos superado', output: '' });
    }, BUILD_TIMEOUT);

    proc.on('close', () => clearTimeout(timer));
  });
}

module.exports = { runBuild };
