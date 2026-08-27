# NosDicenGeeks

Blog de tecnología y cultura geek hecho en [Astro](https://astro.build), con un CMS
propio (Node.js/Express) para administrar posts, páginas, home y menú desde
`/var/www/nosdicengeeks/admin`.

## Estructura del proyecto

```text
/
├── src/                  # Blog Astro (posts, páginas, componentes, layouts)
├── admin/                # CMS (API Express + panel HTML/JS estático)
│   ├── data/             # users.json, site.json (ambos gitignored, locales por entorno)
│   ├── public/            # Panel del admin (dashboard, editores, login)
│   └── src/               # Controllers, rutas, middlewares
└── package.json
```

## Entornos

| Entorno | Rama  | Cómo se despliega |
| :------ | :---- | :----------------- |
| Local (WSL) | `dev` (checkout local) | Manual, con los scripts de abajo |
| Dev     | `dev`  | Trabajo directo en el checkout del entorno dev |
| Prod    | `main` | `.github/workflows/deploy-prod.yml` al hacer push a `main` (vía AWS SSM) |

El flujo recomendado es probar cualquier cambio en local antes de mergear
`dev` → `main`, ya que ese merge dispara un deploy real a producción.

## Deploy a producción

`deploy-prod.yml` se conecta al EC2 de prod vía AWS SSM (no SSH directo) y,
antes de instalar dependencias y buildear, escribe/actualiza
`admin/.env` en el servidor con los secrets de abajo — así ninguna
variable sensible queda hardcodeada en `admin/ecosystem.config.js` (que
solo define `PORT`/`NODE_ENV` y el proceso de PM2) ni en el propio
workflow. Los 3 secrets viajan en base64 dentro del comando SSM y
`admin/scripts/write-env.js` los decodifica en el servidor.

Secrets a configurar en **GitHub → Settings → Secrets and variables →
Actions** (environment `production`):

| Secret | Uso |
| :----- | :-- |
| `AWS_ACCESS_KEY_ID` | Ya configurado — credenciales AWS para SSM |
| `AWS_SECRET_ACCESS_KEY` | Ya configurado — credenciales AWS para SSM |
| `AWS_REGION` | Ya configurado — región del EC2 |
| `EC2_INSTANCE_ID` | Ya configurado — instancia de prod |
| `JWT_SECRET` | **Nuevo** — firma los tokens de sesión del admin en prod |
| `CLOUDFLARE_ZONE_ID` | **Nuevo** — purga de caché de Cloudflare tras cada build |
| `CLOUDFLARE_API_TOKEN` | **Nuevo** — idem, token con permiso de purga sobre esa zona |

Si `CLOUDFLARE_ZONE_ID`/`CLOUDFLARE_API_TOKEN` no están configurados, el
build sigue funcionando igual — solo se omite la purga de caché
(`builder.js` lo maneja como no-fatal). `JWT_SECRET` sí es obligatorio:
sin él, el login del admin en prod falla.

### Nginx — caché de imágenes (aplicar manualmente en el servidor)

La config de Nginx vive en el servidor, no en este repo. Para subir el TTL
de caché de las imágenes propias de 4h a 30d (pendiente de PageSpeed
Insights), en `/etc/nginx/sites-available/nosdicengeeks.com` agregar o
editar el bloque:

```nginx
location ~* \.(webp|jpg|jpeg|png|gif|svg|ico)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

y aplicar:

```sh
sudo nginx -t && sudo systemctl reload nginx
```

`nginx -t` valida la sintaxis antes de recargar — si falla, no tocar nada
más hasta corregir el bloque. No confundir con la purga de caché de
Cloudflare (esa es automática, ver `builder.js` arriba): esto es el TTL
que Nginx le dice al *navegador* que respete, no el caché de Cloudflare.

## Desarrollo local

### Requisitos

- Node.js `>= 22.12.0`
- Dependencias instaladas en **ambos** proyectos (son `package.json` independientes):

  ```sh
  npm install            # dependencias del blog (raíz)
  npm install --prefix admin   # dependencias del admin
  ```

### Variables de entorno del admin

El admin necesita `admin/.env.local` (gitignored — no se versiona) con al menos:

```env
PORT=3001
JWT_SECRET=nosdicengeeks_dev_secret_local
BLOG_PATH=/var/www/nosdicengeeks
NODE_ENV=development
```

`server.js` carga primero `.env.local` (si existe) y luego `.env`, sin
pisar variables ya definidas — así `.env.local` tiene prioridad en local
sin romper el `.env` que usan los servidores dev/prod.

`BLOG_PATH` le dice al admin dónde está el repo del blog (para leer/escribir
posts, páginas, media y disparar `npm run build`) — en local apunta al mismo
checkout, `/var/www/nosdicengeeks`.

### Datos locales (`admin/data/`)

- `users.json` — **gitignored** (credenciales no se versionan). Si no existe
  (checkout nuevo), hay que crearlo con al menos un usuario `admin`:

  ```sh
  node -e "console.log(require('bcryptjs').hashSync('TU_PASSWORD', 10))"
  ```

  y pegar el hash resultante en `admin/data/users.json`:

  ```json
  [{ "id": 1, "username": "admin", "password": "<hash>", "role": "admin", "createdAt": "2026-01-01T00:00:00.000Z" }]
  ```

  El deploy de producción crea este archivo automáticamente (con `[]`,
  vacío) si no existe en el servidor — hay que dar de alta el usuario admin
  ahí después del primer deploy.
- `site.json` — contenido editable del home y el menú (gitignored). Si no
  existe, el blog usa valores por defecto embebidos en `index.astro` /
  `Header.astro`, y el admin lo crea automáticamente al guardar desde
  `home-editor.html` / `menu-editor.html`.

### Levantar el entorno

```sh
npm run dev:blog   # solo el blog Astro   → http://localhost:4321
npm run dev:admin  # solo el CMS admin    → http://localhost:3001
npm run dev:all    # ambos en paralelo (concurrently), salida etiquetada [blog] / [admin]
```

`npm run dev:all` es el modo normal de trabajo: permite editar contenido
desde el admin (`http://localhost:3001`) y ver el resultado recargando el
blog (`http://localhost:4321`) sin salir del build de producción real —
guardar desde el CMS local dispara `npm run build` sobre este mismo
checkout, igual que en dev/prod.

### Otros comandos

| Comando                   | Acción                                           |
| :------------------------ | :----------------------------------------------- |
| `npm run build`           | Build de producción del blog a `./dist/`         |
| `npm run preview`         | Sirve el build de `./dist/` localmente            |
| `npm run astro ...`       | CLI de Astro (`astro add`, `astro check`, etc.)  |

## 👀 Más info

[Documentación de Astro](https://docs.astro.build)
