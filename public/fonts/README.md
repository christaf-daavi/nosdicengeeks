# Fuentes autoalojadas

Archivos woff2 variables, subconjunto latino, tal como los sirve Google Fonts:

| Archivo | Familia | Versión | Pesos (eje wght) | Origen |
|---|---|---|---|---|
| `inter-latin.woff2` | Inter | v20 | 100–900 (se usan 400–600) | fonts.gstatic.com/s/inter/v20/ |
| `outfit-latin.woff2` | Outfit | v15 | 100–900 (se usan 400–800) | fonts.gstatic.com/s/outfit/v15/ |

Ambas están bajo la SIL Open Font License 1.1 (https://openfontlicense.org).
Los @font-face y las fuentes de respaldo con métricas ajustadas están en
`src/styles/global.css`; la precarga, en `src/components/BaseHead.astro`.

El subconjunto latino cubre el español (á é í ó ú ü ñ ¿ ¡ € …). Si se
necesitara otro alfabeto, hay que añadir su subconjunto con su unicode-range.
