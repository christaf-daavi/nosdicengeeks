import { getCollection } from 'astro:content';

const DEFAULT_TAGS_SLUG = 'tags';

// La página de tags puede tener cualquier slug configurado desde el CMS
// (ej: "etiquetas"). Las rutas de tags individuales (/{slug}/{tag}) deben
// usar ese mismo slug como prefijo, así que se resuelve acá en vez de
// hardcodear "tags" — evita que las rutas queden desincronizadas si
// alguien cambia el slug de la página de tags desde el admin.
export async function getTagsPageSlug(): Promise<string> {
  const pages = await getCollection('pages', ({ data }) => !data.draft);
  const tagsPage = pages.find((p) => p.data.template === 'tags');
  return tagsPage?.data.slug || tagsPage?.id || DEFAULT_TAGS_SLUG;
}
