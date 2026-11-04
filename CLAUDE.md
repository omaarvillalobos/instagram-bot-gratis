# Bot de Instagram: comenta una palabra → mensaje privado

Instrucciones para Claude Code. La persona que usa este repo puede no saber programar: háblale en español sencillo, dile en una línea qué vas a hacer y hazlo.

## Qué es

Un Worker de Cloudflare (`src/index.js`) que recibe los avisos de Instagram (webhook) y:
1. Cuando alguien comenta una palabra configurada, le manda un mensaje privado ligado al comentario y (opcional) le contesta en público.
2. Cuando esa persona responde el mensaje, revisa si sigue a la cuenta: si sí, le manda el link; si no, le pide que la siga.

## Lo único que se edita: `src/cuentas.js`

- **Agregar o cambiar una palabra:** dentro de `palabras` de la cuenta que toca, una entrada `PALABRA: { regalo: "…", link: "https://…" }`. La palabra en MAYÚSCULAS, sin acentos y sin espacios. `regalo` se lee dentro de frases como "Para mandarte {regalo}", así que escríbelo así: "mi guía de recetas", "el menú con precios".
- **Cambiar los mensajes:** en `textos`. Respeta `{regalo}` y `{link}`.
- **Agregar otra cuenta:** copia el bloque comentado del final, con su propio `usuario`, `token` (nombre del secreto, p. ej. `IG_TOKEN_NEGOCIO`) y palabras. Luego la persona guarda la llave con `npx wrangler secret put IG_TOKEN_NEGOCIO`.

Antes de publicar, revisa que la palabra nueva no se confunda con otra que ya exista (el bot acepta errores de dedo en palabras de 6 letras o más) y corre `npm test`.

## Publicar

```
npx wrangler deploy
```

Para ver qué está pasando en vivo: `npx wrangler tail`.

## Reglas

- Nunca escribas llaves, tokens ni la clave secreta en ningún archivo. Siempre `npx wrangler secret put NOMBRE` (la persona pega el valor, tú no lo ves).
- No subas `.env` ni `.dev.vars` a GitHub.
- Si algo falla, primero `npx wrangler tail` y lee el error antes de cambiar código.
