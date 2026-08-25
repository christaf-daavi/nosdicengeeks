# NosDicenGeeks

Blog de tecnología y cultura geek hecho en [Astro](https://astro.build), con un CMS
propio (Node.js/Express) para administrar posts, páginas, home y menú desde
`/var/www/nosdicengeeks/admin`.

## Estructura del proyecto

```text
/
├── src/                  # Blog Astro (posts, páginas, componentes, layouts)
├── admin/                # CMS (API Express + panel HTML/JS estático)
│   ├── data/             # users.json, site.json (contenido editable, gitignored salvo users.json)
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

- `users.json` — **está versionado en git**: las credenciales son las mismas
  que en dev/prod. Si no existe (checkout nuevo), hay que crearlo con al
  menos un usuario `admin` (username, password hasheado con bcrypt, role).
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
