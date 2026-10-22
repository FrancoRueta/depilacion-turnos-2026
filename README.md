# Turnos de depilación

Aplicación web mobile-first para publicar fechas de atención, consultar horarios y reservar turnos de depilación. Incluye un modo de administración autenticado para gestionar fechas, rangos horarios y reservas.

El producto es una aplicación nueva e independiente. La especificación funcional está en [`docs/spec-turnos.md`](docs/spec-turnos.md) y las reglas de trabajo en [`AGENTS.md`](AGENTS.md).

## Stack

- **Frontend:** React 19 + Vite 6 + TypeScript, calendario y componentes propios.
- **Backend:** Express 4 + TypeScript. Sirve la API y, en producción, también el frontend compilado desde el mismo origen.
- **Base de datos:** PostgreSQL administrado en producción. En desarrollo local se usa **PGlite** (PostgreSQL embebido) con persistencia en `.data/pglite`.
- **Autenticación:** un único administrador, contraseña con `scrypt`, sesiones en base de datos y cookie `HttpOnly`, `SameSite=Strict`.

No se usan librerías de calendario, servicios de autenticación externos ni secretos en el navegador.

## Requisitos

- Node.js 18 o superior. Se recomienda una versión LTS actual (Node 20/22).
- npm 9 o superior.
- Para producción: una base PostgreSQL administrada, por ejemplo [Neon](https://neon.tech/), y un hosting de Node.js, por ejemplo [Render](https://render.com/).

## Desarrollo local

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Crear el archivo de entorno local:

   ```bash
   # macOS / Linux
   cp .env.example .env

   # Windows PowerShell
   Copy-Item .env.example .env
   ```

   Para desarrollo no hace falta definir `DATABASE_URL`: se usa PGlite automáticamente.

3. Aplicar las migraciones:

   ```bash
   npm run db:migrate
   ```

4. Crear el administrador. La contraseña debe tener entre 12 y 200 caracteres:

   ```bash
   npm run admin:create -- --username=admin
   ```

   El comando pide la contraseña de forma oculta. Si ya existe un administrador con ese usuario, actualiza su contraseña y cierra las sesiones anteriores. No hay registro público de administradores.

   En un entorno no interactivo se pueden usar las variables `ADMIN_USERNAME` y `ADMIN_PASSWORD`, por ejemplo para una tarea puntual de despliegue. No las dejes guardadas en el proyecto.

5. Opcional: cargar fechas de demostración (solo desarrollo; no crea reservas ni credenciales):

   ```bash
   npm run seed:demo
   ```

6. Iniciar la aplicación:

   ```bash
   npm run dev
   ```

   - Frontend: <http://localhost:5173>
   - API: <http://127.0.0.1:8787>
   - Vite redirige `/api` al servidor Express.

> **PGlite y bloqueos:** PGlite bloquea su carpeta de datos. Detené `npm run dev` antes de ejecutar `db:migrate`, `admin:create` o `seed:demo`. Para reiniciar los datos locales, eliminá `.data/pglite` y repetí las migraciones y la creación del administrador.

### Variables de entorno

El archivo [`.env.example`](.env.example) documenta todas las variables. Las relevantes para producción son:

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `NODE_ENV` | Sí | Usar `production` en el hosting. |
| `DATABASE_URL` | Sí | Cadena de conexión PostgreSQL. El servidor no arranca en producción sin ella. |
| `DATABASE_SSL` | No | `true`/`require` para hosts remotos (valor habitual), `false`/`disable` solo para PostgreSQL local o certificados no verificables. |
| `COOKIE_SECURE` | No | `true` detrás de HTTPS. En producción es `true` por defecto. |
| `TRUST_PROXY` | No | `true` detrás de un proxy inverso. En producción es `true` por defecto. |
| `PORT` | No | Puerto del servidor; muchos hostings lo asignan automáticamente. |
| `HOST` | No | Interfaz de escucha. Usar `0.0.0.0` en el hosting. |
| `PGLITE_DATA_DIR` | No | Solo desarrollo local. Ruta de datos de PGlite. |

No subas `.env`, credenciales ni cadenas de conexión al repositorio. `.gitignore` ya excluye `.env`, `.env.*` (excepto `.env.example`), `.data/`, `dist/` y `dist-server/`.

## Comandos

| Comando | Uso |
| --- | --- |
| `npm run dev` | API y frontend en modo desarrollo. |
| `npm run dev:server` | Solo API con recarga automática. |
| `npm run dev:web` | Solo frontend Vite. |
| `npm run build` | Verificación de tipos, build del frontend y del servidor. |
| `npm start` | Ejecuta el build de producción (`dist-server`), sirviendo también `dist/`. |
| `npm test` | Pruebas de integración con `node:test` y `tsx`. |
| `npm run typecheck` | Verificación de TypeScript sin emitir archivos. |
| `npm run db:migrate` | Aplica migraciones pendientes. |
| `npm run admin:create` | Crea o actualiza el administrador único. |
| `npm run seed:demo` | Carga fechas de ejemplo en desarrollo. |

## Cómo funciona

- El calendario público solo muestra fechas configuradas y activas. No infiere fines de semana.
- Cada fecha tiene apertura y cierre propios, en bloques de 30 minutos, dentro de las 06:00–22:00. Los valores iniciales son 08:00–18:00.
- La reserva se crea en una transacción del servidor y solo devuelve éxito después de persistirla.
- La combinación fecha + hora es única en la base. Si dos personas intentan el mismo horario, una recibe un error recuperable y puede elegir otro sin perder los datos del formulario.
- La vista pública devuelve únicamente fecha, horario, estado e iniciales generadas en el servidor. Nunca envía nombre completo, edad, teléfono ni zonas.
- El administrador puede crear, editar, activar/desactivar y eliminar fechas desde el panel **Fechas de atención**; editar o reubicar reservas; y cancelarlas con confirmación. El panel de fechas permanece visible aunque no haya ninguna configurada, para poder crear una nueva sin depender de la selección del calendario. Las reservas existentes protegen a la fecha de cambios que las dejarían inválidas o huérfanas.
- La sesión administrativa dura 12 horas, se guarda en la base y se revoca al cerrar sesión o al cambiar la contraseña. Los intentos fallidos de login tienen un límite en memoria por instancia.

### API principal

| Método | Ruta | Acceso |
| --- | --- | --- |
| `GET` | `/api/public/month/:month` | Público. Solo datos de calendario e iniciales. |
| `POST` | `/api/public/bookings` | Público. Crea una reserva validada y atómica. |
| `GET/POST/DELETE` | `/api/admin/session` | Login, consulta y cierre de sesión. |
| `GET` | `/api/admin/month/:month` | Administrador autenticado. Datos completos de reservas. |
| `POST/PATCH/DELETE` | `/api/admin/dates...` | Administrador autenticado. |
| `PATCH/DELETE` | `/api/admin/bookings/:id` | Administrador autenticado. |
| `GET` | `/api/health` | Salud del servicio. |

Las mutaciones administrativas requieren la cookie de sesión y el encabezado `x-admin-request: turnos-admin`. La cookie es `HttpOnly`, `SameSite=Strict` y `Secure` en producción.

## Pruebas y verificación

```bash
npm test
npm run build
npm audit
```

La suite cubre, entre otros casos: privacidad de la respuesta pública, validación de datos, reserva duplicada, dos reservas concurrentes, autenticación, expiración de sesión, CRUD de fechas, reubicación/cancelación de reservas y protección ante cambios que afectan reservas existentes.

## Despliegue en producción

La aplicación se pensó como **un único servicio Node.js** que sirve API y frontend desde el mismo origen. Eso simplifica cookies, CORS y despliegue.

### Opción recomendada: Neon + Render

1. **Crear la base en Neon**
   - Crear un proyecto PostgreSQL.
   - Copiar la cadena de conexión (con `sslmode=require`).
   - Verificar los límites vigentes del plan gratuito antes de comprometerse.

2. **Crear el servicio en Render**
   - Nuevo **Web Service** conectado a un repositorio nuevo de este proyecto.
   - Runtime: Node.js.
   - Build command: `npm ci && npm run build`
   - Start command: `npm start`
   - Health check: `/api/health`
   - Variables de entorno mínimas:
     - `NODE_ENV=production`
     - `DATABASE_URL=<cadena de Neon>`
     - `DATABASE_SSL=true`
     - `HOST=0.0.0.0`
     - `COOKIE_SECURE=true`
     - `TRUST_PROXY=true`
   - El hosting asigna `PORT` automáticamente.

3. **Migrar y crear el administrador**
   - El servidor aplica migraciones al iniciar. También se puede ejecutar `npm run db:migrate` con `DATABASE_URL` apuntando a producción.
   - Ejecutar una vez, desde una shell del hosting o una tarea puntual:

     ```bash
     npm run admin:create -- --username=admin
     ```

     Si la shell no es interactiva, usar `ADMIN_USERNAME` y `ADMIN_PASSWORD` solo durante esa ejecución y luego quitarlas.
   - Ingresar a la aplicación, abrir `Administración` y crear las fechas reales de atención.

4. **Verificar**
   - Abrir la URL pública y probar consulta, reserva y visualización de iniciales.
   - Confirmar que `Administración` pide credenciales y que las operaciones de edición/borrado funcionan.
   - Verificar que la cookie se marque `Secure` y que el sitio cargue por HTTPS.

### Otras alternativas

Railway, Fly.io, Koyeb o un VPS pequeño con PostgreSQL administrado funcionan con el mismo build y variables. Si el frontend se separa en un hosting estático, hay que configurar el proxy de `/api` hacia el servicio Node y revisar cookies/orígenes; no es la configuración recomendada para este proyecto.

> El agente **no realizó** el despliegue en cuentas externas ni creó un repositorio remoto. Esos pasos requieren las cuentas y credenciales del propietario.

### Pasos manuales del propietario

- Crear la cuenta y el proyecto de PostgreSQL.
- Crear el servicio de hosting y cargar las variables de entorno.
- Definir un usuario y una contraseña de administrador seguros.
- Configurar las fechas reales de atención y sus horarios.
- Opcional: reemplazar la lista provisional de zonas y el nombre neutral del producto.
- Configurar dominio, HTTPS y, si corresponde, respaldos/alertas del proveedor.
- Verificar los límites y costos actuales de los planes gratuitos.

## Configuración provisional

Estos valores están centralizados para poder cambiarlos sin rehacer el producto:

- **Zonas:** [`shared/constants.ts`](shared/constants.ts). La lista actual es un conjunto de ejemplos provisionales; no es el catálogo oficial.
- **Nombre del producto:** título neutral “Turnos de depilación” en la interfaz y metadatos.
- **Duración del turno:** 30 minutos.
- **Ventana configurable:** 06:00–22:00.
- **Horario inicial por fecha:** 08:00–18:00.
- **Días de atención:** viernes, sábado o domingo.
- **Duración de sesión administrativa:** 12 horas.

## Estructura del proyecto

```text
src/               Interfaz React, pantallas, componentes y estilos
server/            API Express, autenticación, servicios y acceso a datos
shared/            Validaciones, fechas, tipos y constantes compartidas
migrations/        Esquema SQL reproducible
scripts/           Migración, alta de administrador y seed de desarrollo
tests/             Pruebas de integración del servidor
docs/              Especificación funcional
```

## Git

Este workspace **no tiene un repositorio Git inicializado**. Para versionarlo como proyecto nuevo e independiente:

```bash
git init
git add .
git commit -m "Aplicación inicial de turnos de depilación"
git branch -M main
git remote add origin <URL-DEL-REPOSITORIO-NUEVO>
git push -u origin main
```

No vincules un remoto de un proyecto anterior ni importes su historial. Antes del primer push, revisá que `.env`, `.data/` y cualquier credencial local estén fuera del commit.

## Límites conocidos

- No hay cuentas de clientes, pagos, señas, correos, SMS ni recordatorios automáticos.
- Hay un solo administrador y un solo recurso de atención; no se gestionan múltiples empleados ni sucursales.
- El límite de intentos de login es en memoria: se reinicia al reiniciar el proceso y no se comparte entre varias instancias. Para este uso alcanza con una instancia.
- PGlite es solo para desarrollo local; en producción se exige PostgreSQL.
- Las fechas deben cargarse manualmente desde la administración; no se crean por ser fin de semana.
- No se configuró un despliegue automático ni un proveedor externo en esta entrega.

## Solución de problemas

- **“database is locked” en scripts locales:** detené el servidor de desarrollo antes de ejecutar `db:migrate`, `admin:create` o `seed:demo`.
- **El servidor no arranca en producción:** falta `DATABASE_URL` o la base no acepta la conexión/SSL. Revisá `DATABASE_SSL`.
- **La sesión no persiste detrás de un proxy:** configurá `TRUST_PROXY=true` y `COOKIE_SECURE=true` con HTTPS.
- **Error 403 en administración:** falta el encabezado `x-admin-request` o un proxy lo está eliminando. El cliente incluido lo envía automáticamente.
- **Error 401:** la sesión venció o fue revocada. Volvé a ingresar.
- **No aparece una fecha en la agenda pública:** verificá que esté activa, que sea viernes/sábado/domingo y que no haya pasado.
- **Olvidé la contraseña del administrador:** ejecutá `npm run admin:create -- --username=<usuario-existente>` y definí una nueva.
