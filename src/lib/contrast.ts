// Contraste WCAG para los colores del hero que se eligen en el CMS
// (heroLabelColor, heroTitleColor, heroCopyColor). Se evalúa en build: si el
// color elegido no llega al mínimo sobre el fondo donde se pinta, se usa el
// color de respaldo.

function luminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return 0;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Peor fondo bajo el texto del overlay en escritorio: un píxel blanco de la
// foto tapado por el degradado (rgba(5,10,20,.72) en la zona del texto).
export const OVERLAY_WORST_BG = '#4b4f56';

// Devuelve `color` si alcanza `min` sobre `background`; si no, `fallback`.
export function readableColor(
  color: string | undefined,
  background: string,
  fallback: string,
  min = 4.5,
): string {
  return color && contrastRatio(color, background) >= min ? color : fallback;
}
