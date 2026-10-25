// Conversión de URLs públicas de video a su URL de embed. Módulo puro
// (sin DOM): lo usan el modal de video del editor y el nodo VideoEmbed de
// TipTap, que vuelve a pasar cada src por aquí al parsear HTML para que
// nunca se acepte un iframe que no sea de un proveedor permitido.
//
// parseVideoUrl(url) → { ok: true, provider, embedUrl, vertical }
//                    | { ok: false, error }

// Atributos del <iframe> que se inserta en el post (y en la vista previa)
export const EMBED_IFRAME_ATTRS = {
  title: 'Video',
  loading: 'lazy',
  allow: 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
  allowfullscreen: '',
  referrerpolicy: 'strict-origin-when-cross-origin',
};

const UNSUPPORTED = 'URL no soportada. Pega un enlace de YouTube, Vimeo o TikTok.';

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'];
const VIMEO_HOSTS   = ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'];
const TIKTOK_HOSTS  = ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com'];
const TIKTOK_SHORT  = ['vm.tiktok.com', 'vt.tiktok.com'];

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

// "90", "90s", "1m30s", "1h2m3s" → segundos (0 si no se reconoce)
function parseStartTime(value) {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
  if (!m || !m[0]) return 0;
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
}

function youtube(url) {
  const parts = url.pathname.split('/').filter(Boolean);
  let id = null;
  let vertical = false;
  if (url.hostname === 'youtu.be') {
    id = parts[0];
  } else if (parts[0] === 'watch') {
    id = url.searchParams.get('v');
  } else if (['embed', 'shorts', 'live'].includes(parts[0])) {
    id = parts[1];
    vertical = parts[0] === 'shorts';
  }
  if (!id || !YOUTUBE_ID.test(id)) {
    return { ok: false, error: 'No se encontró el ID del video de YouTube en la URL.' };
  }
  const start = parseStartTime(url.searchParams.get('t') || url.searchParams.get('start'));
  return {
    ok: true,
    provider: 'youtube',
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start}` : ''}`,
    vertical,
  };
}

function vimeo(url) {
  const parts = url.pathname.split('/').filter(Boolean);
  // player.vimeo.com/video/ID, vimeo.com/ID, vimeo.com/ID/HASH,
  // vimeo.com/channels/x/ID, vimeo.com/groups/x/videos/ID…
  const idIndex = parts.findIndex((p) => /^\d+$/.test(p));
  if (idIndex === -1) {
    return { ok: false, error: 'No se encontró el ID del video de Vimeo en la URL.' };
  }
  const id = parts[idIndex];
  // Videos no listados: el hash va como segmento siguiente o como ?h=
  const hash = url.searchParams.get('h') || parts[idIndex + 1];
  const h = hash && /^[0-9a-f]+$/i.test(hash) ? `?h=${hash}` : '';
  return { ok: true, provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${id}${h}`, vertical: false };
}

function tiktok(url) {
  // tiktok.com/@usuario/video/ID, /embed/v2/ID, /embed/ID, /player/v1/ID
  const m = /\/(?:video|embed(?:\/v2)?|player\/v1)\/(\d+)/.exec(url.pathname);
  if (!m) {
    return { ok: false, error: 'No se encontró el ID del video de TikTok. Usa la URL completa (tiktok.com/@usuario/video/…).' };
  }
  return { ok: true, provider: 'tiktok', embedUrl: `https://www.tiktok.com/player/v1/${m[1]}`, vertical: true };
}

export function parseVideoUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return { ok: false, error: 'Pega la URL del video.' };

  let url;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, error: 'La URL no es válida.' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, error: UNSUPPORTED };
  }

  const host = url.hostname.toLowerCase();
  if (host === 'youtu.be' || YOUTUBE_HOSTS.includes(host)) return youtube(url);
  if (VIMEO_HOSTS.includes(host)) return vimeo(url);
  if (TIKTOK_HOSTS.includes(host)) return tiktok(url);
  if (TIKTOK_SHORT.includes(host)) {
    return { ok: false, error: 'Los enlaces cortos de TikTok no se pueden embeber. Abre el video y copia la URL completa (tiktok.com/@usuario/video/…).' };
  }
  return { ok: false, error: UNSUPPORTED };
}
