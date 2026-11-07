# Generador de QR — qr.rzcore.dev

Herramienta del ecosistema **RZ Core**. Página estática (HTML + CSS + JS, sin servidor ni build)
con el mismo diseño que [rzcore.dev](https://rzcore.dev): fondo zinc-950, acento emerald,
fuente Geist, navbar glass y botones pill.

Replica `generate_qr.py`: corrección de errores **H**, 20 px por módulo, borde de 4 módulos y
logo centrado sobre un recuadro del color de fondo (~25% del ancho).

Además:
- **8 tipos de QR soportados**:
  - **Link (URL)**: páginas web con aviso inteligente de `https://`.
  - **Wi-Fi**: conexión automática configurando SSID, contraseña, seguridad (`WPA/WPA2/WPA3`, `WEP`, abierta) y red oculta.
  - **WhatsApp**: abre un chat directo (`wa.me`) con mensaje predefinido opcional.
  - **Contacto (vCard 3.0)**: agenda nombre, apellido, teléfono, email, organización, cargo y web.
  - **Evento (iCalendar / VEVENT)**: agenda un evento en el calendario con fecha/hora de inicio y fin, ubicación y descripción.
  - **Email (`mailto:`)**: prepara un correo con destinatario, asunto y cuerpo del mensaje.
  - **Ubicación**: abre coordenadas (`geo:`) o búsqueda directa en Google Maps.
  - **Texto libre**: para notas, códigos, entradas o credenciales sin conexión.
- Vista previa en vivo, colores personalizables y tamaño de logo ajustable.
- Logo opcional: click, arrastrar y soltar, o pegar con Ctrl+V.
- **Verificación automática**: cada QR se decodifica en el navegador (jsQR). Si el logo
  tapa demasiado, se sube la versión del QR (más módulos) hasta que se pueda leer.
- Descarga en **PNG** (alta resolución) o **SVG** (para imprenta).
- Privacidad: nada se sube a ningún servidor.

## Probar localmente

```powershell
cd web
python -m http.server 8000   # http://localhost:8000
```

(También funciona abriendo `index.html` con doble click.)

## Publicar en qr.rzcore.dev (Vercel)

Igual que el resto de los subdominios del ecosistema (`hub.`, `sproutstack.`, etc.):

1. Subí este proyecto a un repo de GitHub (o usá `npx vercel` desde la carpeta `web`).
2. En Vercel: **Add New → Project** → importá el repo.
   - **Root Directory:** `web`
   - **Framework Preset:** `Other` (sin build command ni output directory)
3. En el proyecto: **Settings → Domains → Add** → `qr.rzcore.dev`.
4. DNS:
   - Si `rzcore.dev` usa los nameservers de Vercel, el subdominio se configura solo.
   - Si no, creá un registro **CNAME** `qr` → `cname.vercel-dns.com` en tu proveedor de DNS.

El HTTPS lo emite Vercel automáticamente.

> Sugerencia: agregá la herramienta al array `products` de `src/components/Ecosystem.tsx`
> en rzcore con `link: "https://qr.rzcore.dev"` y `status: "active"`.

## Archivos

- `index.html` — estructura de la página (navbar, hero, generador, footer)
- `styles.css` — estilos (tokens de rzcore: zinc + emerald)
- `app.js` — generación, verificación y descarga
- `assets/` — isologo RZ Core optimizado, favicon y apple-touch-icon
- `vendor/qrcode.js` — [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4 (MIT)
- `vendor/jsQR.js` — [jsQR](https://github.com/cozmo/jsQR) 1.4.0 (Apache-2.0)
