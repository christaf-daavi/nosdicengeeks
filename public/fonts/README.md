# Fuentes autoalojadas

Archivos woff2 variables, subconjunto latino, tal como los sirve Google Fonts:

| Archivo | Familia | Versión | Pesos (eje wght) | Origen |
|---|---|---|---|---|
| `inter-latin.woff2` | Inter | v20 | 400–600 (eje recortado, 30 KB) | fonts.gstatic.com/s/inter/v20/ |
| `outfit-latin.woff2` | Outfit | v15 | 100–900 (se usan 400–800, 32 KB) | fonts.gstatic.com/s/outfit/v15/ |

Inter se recortó al rango de pesos que usa el sitio (48 KB → 30 KB):

    fonttools varLib.instancer inter-latin.woff2 wght=400:600 -o inter-lim.ttf
    pyftsubset inter-lim.ttf --unicodes="<unicode-range del @font-face>" \
      --layout-features='*' --flavor=woff2 --output-file=inter-latin.woff2

El ancho del texto no cambia en ningún peso y el 400 es idéntico píxel a
píxel. Outfit se deja como la sirve Google: recortada pesaba más (36 KB).

Ambas están bajo la SIL Open Font License 1.1 (https://openfontlicense.org).
Los @font-face y las fuentes de respaldo con métricas ajustadas están en
`src/styles/global.css`; la precarga, en `src/components/BaseHead.astro`.

El subconjunto latino cubre el español (á é í ó ú ü ñ ¿ ¡ € …). Si se
necesitara otro alfabeto, hay que añadir su subconjunto con su unicode-range.
