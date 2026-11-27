# Web de fotografía — guía rápida

Web estática (HTML + CSS + JS, sin instalar nada) con un panel para subir galerías.
Coste: 0 €. Dirección gratuita del tipo `nombre.pages.dev` o `usuario.github.io`.

## Qué hay en la carpeta

- `index.html`, `css/`, `js/` → la web (no hace falta tocarlos).
- `content/site.json` → nombre, portada, redes y contacto.
- `content/galleries.json` → las galerías y sus fotos.
- `media/` → las fotos (las de ejemplo se llaman `ejemplo-*.jpg`).
- `.pages.yml` → configuración del panel (Pages CMS).
- `_headers` → ajustes de caché para Cloudflare Pages (en GitHub Pages se ignora).

> Los archivos que empiezan por punto (`.pages.yml`) pueden estar ocultos.
> En Mac: Cmd+Shift+. en el Finder. En Windows: Ver → Elementos ocultos.

## Puesta en marcha (una sola vez)

### 1. Cuenta de GitHub
Crea la cuenta (mejor a nombre de tu padre, para que él entre al panel con ella).

### 2. Crear el repositorio y subir los archivos
1. En GitHub: **New repository** → nombre, por ejemplo `fotos` → **Public** → Create.
2. **uploading an existing file** → arrastra TODO el contenido de esta carpeta
   (incluido `.pages.yml`) → **Commit changes**.

### 3. Publicar la web (elige una)
**A) GitHub Pages (la más sencilla, sin cuenta extra):**
Repositorio → Settings → Pages → *Deploy from a branch* → `main` / `(root)` → Save.
Tarda 1–2 minutos y te muestra la dirección. (Si llamas al repositorio
`TUUSUARIO.github.io`, la dirección será simplemente `TUUSUARIO.github.io`.)

**B) Cloudflare Pages (dirección `nombre.pages.dev`):**
Crea cuenta en Cloudflare → Workers & Pages → Create → Pages → Connect to Git →
elige el repositorio → *Build command*: vacío → *Output directory*: vacío o `/` → Deploy.
Cloudflare puede ir cambiando sus menús; si no ves "Pages", usa la opción A.

### 4. Conectar el panel
1. Entra en https://pagescms.org → **Sign in with GitHub**.
2. Autoriza la aplicación y elige el repositorio.
3. Verás dos apartados: **Galerías** y **Datos de la web**.

## Panel propio (alternativa sin límites): /admin

La web incluye su propio panel en `TU-WEB/admin/`. Sube las fotos directamente a GitHub
desde el navegador, así que no tiene el límite de 4,5 MB de Pages CMS. Reduce cada foto
a 2000 px automáticamente, admite muchas a la vez y publica todo en un solo cambio.
Necesita una clave (token) de GitHub: las instrucciones salen en la propia pantalla de entrada.

## Uso diario con Pages CMS (para tu padre)

**Nueva galería (por ejemplo "Lunes Santo"):**
Panel → Galerías → añadir elemento nuevo → escribe el título, la fecha →
en *Fotos* pulsa añadir, sube las fotos → **Save**.
La web se actualiza sola en 1–2 minutos. La primera foto es la portada de la galería.

**Cambiar la foto de portada, redes o contacto:** Panel → Datos de la web.

**Borrar las galerías de ejemplo:** Panel → Galerías → eliminar "Lunes Santo" y "Atardeceres" de ejemplo.

## Consejos para las fotos

- Reducir antes de subir: unos **2000 px** en el lado largo, JPG de calidad ~80–85
  (300–900 KB cada una). Si no, la web tarda en cargar y el repositorio crece mucho.
- Formatos admitidos: jpg, jpeg, png, webp.
- Tamaño razonable del repositorio: GitHub recomienda no pasar de ~1 GB.

## Si algo falla

- *El panel no ve el repositorio*: revisa que `.pages.yml` está en la raíz.
- *Los cambios no aparecen*: espera 2 minutos y recarga con Ctrl+F5 / Cmd+Shift+R.
- *Se ve una foto rota*: la ruta de la foto debe ser `/media/nombre.jpg`.
