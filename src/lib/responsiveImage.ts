import fs from 'node:fs';
import path from 'node:path';

// admin/src/controllers/media.js genera variantes -400w/-800w junto al
// archivo base (1200w, el que queda en image.src) al subir cada imagen.
// Astro <Image /> no puede procesar archivos servidos desde public/, así
// que el srcset se arma a mano con esa misma convención de nombres — si
// cambia allá, hay que cambiarla acá también.
export const RESPONSIVE_WIDTHS = [400, 800] as const;

export function variantSrc(src: string, width: number): string {
  const ext = src.slice(src.lastIndexOf('.'));
  return `${src.slice(0, -ext.length)}-${width}w${ext}`;
}

// Imágenes subidas antes de que existieran las variantes (o externas) no
// las tienen: en ese caso no se emite srcset para no pedir archivos 404.
function hasVariants(src: string): boolean {
  if (!src.startsWith('/')) return false;
  return RESPONSIVE_WIDTHS.every((w) =>
    fs.existsSync(path.join(process.cwd(), 'public', variantSrc(src, w)))
  );
}

export function srcsetFor(src: string): string | undefined {
  if (!hasVariants(src)) return undefined;
  return [...RESPONSIVE_WIDTHS.map((w) => `${variantSrc(src, w)} ${w}w`), `${src} 1200w`].join(', ');
}

// src de respaldo para navegadores que ignoran srcset/sizes. Lighthouse
// también lo mide como si fuera la imagen entregada, así que se puede pedir
// una variante más chica que el master de 1200w.
export function fallbackSrcFor(src: string, width: (typeof RESPONSIVE_WIDTHS)[number]): string {
  return hasVariants(src) ? variantSrc(src, width) : src;
}
