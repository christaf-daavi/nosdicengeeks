// Las fechas del frontmatter (pubDate: '2026-10-01') llegan como medianoche
// UTC. Formatearlas en la zona horaria de la máquina que hace el build
// (America/Lima, UTC-5) las corría un día atrás: "30 de septiembre". Todo
// formateo de fechas de contenido debe pasar por aquí, siempre en UTC.

export function formatDate(date: Date, month: 'long' | 'short' = 'long'): string {
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month,
    day: 'numeric',
    timeZone: 'UTC',
  });
}

// Valor para <time datetime>: solo la fecha (YYYY-MM-DD), que es lo que
// representa el frontmatter, sin una hora 00:00Z que no es real.
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
