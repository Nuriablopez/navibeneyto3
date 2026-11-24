# 🎄 NaviBeneyto 2.0

App web de listas de regalos para Marisa, Ana B., Ana C., Blanca y Nuria.

## Estructura

```
navibeneyto/
├── index.html          → página principal
├── css/styles.css      → todo el diseño
├── js/
│   ├── app.js          → arranque y navegación entre pantallas
│   ├── config.js       → personas, fecha de los regalos y config de Firebase
│   ├── db.js           → base de datos (Firebase o modo prueba)
│   ├── stickers.js     → catálogo de stickers (quién sale en cada uno)
│   ├── ui.js           → piezas comunes: avisos, diálogos, formularios…
│   ├── countdown.js    → cuenta atrás al 24/12 a las 23:00
│   ├── snow.js         → nieve cayendo
│   └── screens/
│       ├── login.js    → ¿Quién eres? + PIN
│       ├── home.js     → inicio
│       ├── mylist.js   → Mi lista (deseos + pistas)
│       ├── otherlist.js→ lista de otra: reservas, reacciones, pistas y chat secreto
│       └── budget.js   → Mi presupuesto
├── stickers/           → s01…s20.webp y faces/ (caras para los avatares)
└── firestore.rules     → reglas de seguridad de Firebase
```

## Probar en el ordenador (VS Code)

Los módulos JavaScript no funcionan abriendo el HTML con doble clic.
1. Instala la extensión **Live Server** en VS Code.
2. Clic derecho en `index.html` → **Open with Live Server**.

Sin Firebase configurado funciona en **modo prueba** (los datos se quedan en ese navegador).

## Subir a GitHub Pages

1. En GitHub: **New repository** → nombre `navibeneyto` → **Public** → Create.
2. En la terminal de VS Code, dentro de la carpeta:
   ```bash
   git init
   git add .
   git commit -m "Paso 1: portada, cuenta atrás y PIN"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/navibeneyto.git
   git push -u origin main
   ```
3. En el repo: **Settings → Pages → Branch: main / (root) → Save**.
4. En 1–2 minutos estará en `https://TU_USUARIO.github.io/navibeneyto/`.

## Crear la base de datos (Firebase)

1. Entra en https://console.firebase.google.com → **Crear proyecto** → `navibeneyto` (Google Analytics: no hace falta).
2. **Compilación → Authentication → Comenzar → Anónimo → Habilitar**.
3. **Compilación → Firestore Database → Crear base de datos** → ubicación `europe-west` → modo **producción**.
4. En Firestore → pestaña **Reglas** → pega el contenido de `firestore.rules` → **Publicar**.
5. **Configuración del proyecto (⚙️) → General → Tus apps → icono `</>` (Web)** → nombre `navibeneyto` → Registrar.
6. Copia el objeto `firebaseConfig` que te enseña y pégalo en `js/config.js` en lugar de `null`.
7. En **Authentication → Configuración → Dominios autorizados** añade `TU_USUARIO.github.io`.

> La `apiKey` de Firebase no es secreta: está pensada para ir en el código de la web. La protección la ponen las reglas.

## Instalar en el iPhone

Abrir la URL en **Safari** → botón **Compartir** → **Añadir a pantalla de inicio**.

## Añadir un sticker nuevo

1. Guarda la imagen (PNG con fondo transparente) como `stickers/s21.webp` (o `.png`, cambiando la ruta en `stickers.js`).
2. Añade una línea en `js/stickers.js`: `{ id: 's21', people: ['nuria', 'blanca'] },`

## Privacidad entre vosotras

La app nunca pide a la base de datos los regalos ni el chat de **tu** lista, así que no aparecen en tu pantalla.
Ojo: no es seguridad "de banco". Alguien que sepa abrir las herramientas de desarrollador podría cotillear la base de datos. Entre vosotras, de sobra 😉

## Índices de Firestore

No hacen falta: todas las consultas son de un solo campo. Si algún día Firebase muestra un error con un enlace "create index", basta con abrir el enlace y darle a Crear.
