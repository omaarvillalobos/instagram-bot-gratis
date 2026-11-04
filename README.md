# Bot de Instagram gratis: comenta una palabra y te llega el link

Ese "comenta GUIA y te lo mando por mensaje" que ves en muchos reels, sin pagarle a ninguna plataforma.

1. Alguien comenta tu palabra en un reel o post (aunque la escriba mal: "guiaaa", "Guía 🔥").
2. Le llega un mensaje privado: "sígueme y respóndeme LISTO".
3. Cuando responde, el bot revisa si ya te sigue:
   - Si te sigue, le manda el link.
   - Si no, le pide que te siga primero.
4. Opcional: contesta su comentario en público con "¡Te mandé DM! 📩".

Funciona con **la API oficial de Instagram** (sin página de Facebook) y corre en **Cloudflare Workers**, que es gratis hasta 100,000 avisos al día. Sirve para una o varias cuentas (tú y tu negocio, cada una con sus palabras).

Hecho por [Omar Villalobos](https://www.instagram.com/omarvillalobos.ai/) con Claude Code.

---

## Antes de empezar (todo es gratis)

- Una cuenta de Instagram **profesional** (de creador o de empresa). Se cambia en Instagram → Configuración → Tipo de cuenta.
- Una cuenta en [Cloudflare](https://dash.cloudflare.com/sign-up).
- Una cuenta en [Meta for Developers](https://developers.facebook.com/) (entras con tu cuenta de Meta).
- [Node.js](https://nodejs.org/) versión LTS instalado en tu computadora.
- Opcional, pero lo recomiendo: [Claude Code](https://claude.com/claude-code). Si lo tienes, abre esta carpeta y dile: **"Lee el README y guíame paso a paso para instalar este bot."** Te lleva de la mano.

## Paso 1. Baja el bot a tu computadora

Abre la terminal (en Windows: PowerShell) y pega:

```
git clone https://github.com/omaarvillalobos/instagram-bot-gratis.git
cd instagram-bot-gratis
npm install
npm test
```

Si al final dice `pass 9` y `fail 0`, todo está bien.

## Paso 2. Dile qué quieres mandar

Abre `src/cuentas.js` y cambia:

- `usuario`: tu @ sin la arroba.
- En `palabras`: la palabra que la gente va a comentar (en MAYÚSCULAS y sin acentos), qué les regalas y el link.

```js
palabras: {
  GUIA: { regalo: "mi guía de recetas", link: "https://tu-link.com" },
},
```

O con Claude Code, sin tocar código: *"Agrega la palabra GUIA que mande mi guía de recetas con este link: https://tu-link.com"*. El archivo `CLAUDE.md` le explica cómo hacerlo.

## Paso 3. Crea tu app en Meta

1. Entra a [developers.facebook.com/apps](https://developers.facebook.com/apps) → **Crear app**.
2. En el caso de uso, elige el de **administrar mensajes y contenido en Instagram** (API de Instagram con inicio de sesión de Instagram). No necesitas página de Facebook.
3. Dentro de la app, ve a **Roles de la app** y agrega tu cuenta de Instagram como **evaluador de Instagram** (Instagram tester).
4. En Instagram (celular): Configuración → Apps y sitios web → **Invitaciones de evaluador** → acepta.
5. De regreso en Meta, en la configuración de la API de Instagram: **Generar tokens de acceso** → agrega tu cuenta → acepta los permisos (mensajes y comentarios) → copia la llave (token). Guárdala, la usas en el paso 4.
6. En **Configuración de la app → Básica**, copia la **Clave secreta de la app de Instagram** (Instagram app secret).

## Paso 4. Publica el bot en Cloudflare

En la terminal, dentro de la carpeta del bot:

```
npx wrangler login
```

Se abre el navegador: acepta rápido (si tardas, expira y hay que repetirlo).

Crea la memoria del bot:

```
npx wrangler kv namespace create KV
```

Te da un `id`. Abre `wrangler.toml` y pégalo donde dice `PEGA_AQUI_EL_ID_DE_TU_KV`.

Guarda tus 3 secretos (cada comando te pide que pegues el valor):

```
npx wrangler secret put IG_TOKEN
npx wrangler secret put APP_SECRET
npx wrangler secret put VERIFY_TOKEN
```

- `IG_TOKEN`: la llave del paso 3.5.
- `APP_SECRET`: la clave secreta del paso 3.6.
- `VERIFY_TOKEN`: una palabra larga que tú inventes (por ejemplo `mi-bot-de-comentarios-2026`). Anótala, la vuelves a usar en el paso 5.

Publica:

```
npx wrangler deploy
```

Al final te da tu dirección, algo como `https://instagram-bot-gratis.TU-NOMBRE.workers.dev`.

## Paso 5. Conecta Instagram con tu bot

1. En tu app de Meta, en la configuración de la API de Instagram → **Configurar webhooks**:
   - URL de devolución de llamada: `https://instagram-bot-gratis.TU-NOMBRE.workers.dev/webhook`
   - Token de verificación: tu `VERIFY_TOKEN`.
   - Dale **Verificar y guardar**.
2. Suscríbete a los campos **comments** y **messages**.
3. Activa la suscripción de tu cuenta (el interruptor junto a tu cuenta).
4. En **Configuración de la app → Básica**, en URL de la política de privacidad pon: `https://instagram-bot-gratis.TU-NOMBRE.workers.dev/privacidad` (el bot ya trae el aviso).
5. **Publica la app** (de modo desarrollo a modo en vivo).
6. En Instagram (celular): Configuración → Mensajes y respuestas a historias → Herramientas conectadas → **Permitir acceso a los mensajes**.

## Paso 6. Pruébalo

Desde **otra** cuenta de Instagram, comenta tu palabra en uno de tus posts. Debe llegarle el mensaje. Si no llega, en la terminal corre:

```
npx wrangler tail
```

y vuelve a comentar: ahí ves qué está pasando.

Ojo: a quien no te sigue, el primer mensaje le puede llegar a **solicitudes de mensajes**.

---

## Agregar una palabra para un video nuevo

1. Agrega la palabra en `src/cuentas.js` (o pídeselo a Claude Code).
2. Publica otra vez: `npx wrangler deploy`.

Los comentarios que llegaron antes de agregar la palabra no reciben mensaje.

## Agregar otra cuenta (tu negocio)

Al final de `src/cuentas.js` hay un bloque de ejemplo comentado. Quítale las `//`, pon sus datos y guarda su llave:

```
npx wrangler secret put IG_TOKEN_NEGOCIO
npx wrangler deploy
```

Esa cuenta también tiene que estar como evaluador en tu app de Meta y con su suscripción activada en los webhooks.

## Importante: la llave dura 60 días

La llave (token) de Instagram vence a los 60 días. **Renuévala antes**, por ejemplo cada mes (pon un recordatorio):

1. Abre en el navegador (cambia `TU_LLAVE` por tu llave actual):
   `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=TU_LLAVE`
2. Copia el `access_token` nuevo que aparece.
3. Guárdalo: `npx wrangler secret put IG_TOKEN`

Si se te pasa, el bot deja de mandar mensajes y hay que generar una llave nueva en Meta (paso 3.5).

## Errores comunes

| Lo que ves | Qué hacer |
|---|---|
| Meta se queda en "Revisa qué vas a conectar" y no avanza | Estás en el camino de Facebook. Usa la API de Instagram **con inicio de sesión de Instagram** (paso 3.2): no pide página de Facebook. |
| `wrangler login` dice que expiró | Repítelo y acepta en el navegador en cuanto se abra. |
| El webhook no se verifica | Chrome a veces autocompleta tu correo en el campo "Token de verificación". Bórralo y pon tu `VERIFY_TOKEN` exacto. |
| Cloudflare marca error al conectar GitHub | No hace falta conectarlo: publica desde la terminal con `npx wrangler deploy`. |
| Comentan y no llega nada | `npx wrangler tail`, comenta otra vez y lee el error. Revisa que la app esté publicada, que activaste "Permitir acceso a los mensajes" y que la palabra está en `cuentas.js`. |

## ¿Cuánto cuesta?

Cloudflare Workers es gratis hasta 100,000 avisos al día, y la memoria (KV) gratis aguanta 1,000 escrituras al día: alrededor de 300 comentarios con palabra al día. Si pasas de eso, el plan de pago de Workers cuesta 5 dólares al mes. La API de Instagram no cobra.

## La versión completa

Esta versión hace todo el flujo. La que uso yo además **renueva la llave sola cada semana** (no vuelves a pensar en los 60 días) y tiene un **panel de estado** para ver de un vistazo qué cuentas están conectadas y qué palabras tiene cada una.

Si la quieres para tu negocio, o que te la deje instalada, mándame mensaje en Instagram: [@omarvillalobos.ai](https://www.instagram.com/omarvillalobos.ai/).

## Licencia

MIT. Úsalo, cámbialo y compártelo.
