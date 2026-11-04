// Comenta una palabra → mensaje privado automático en Instagram, gratis.
// Corre en Cloudflare Workers y usa la API oficial de Instagram (Instagram Login, sin página de Facebook).
// Cada evento de Meta trae el ID de la cuenta que lo recibió: con eso se eligen sus palabras, textos y llave.
// Hecho por Omar Villalobos (@omarvillalobos.ai) con Claude Code. Licencia MIT.

import { CUENTAS } from "./cuentas.js";

const GRAPH = "https://graph.instagram.com";

function avisoDePrivacidad() {
  const lista = CUENTAS.map((c) => `<a href="https://www.instagram.com/${c.usuario}/">@${c.usuario}</a>`).join(", ");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Aviso de privacidad</title>
<style>body{font-family:system-ui,sans-serif;max-width:680px;margin:40px auto;padding:0 16px;line-height:1.6;color:#222}</style>
</head><body>
<h1>Aviso de privacidad</h1>
<p>Esta aplicación solo se usa en estas cuentas de Instagram: ${lista}.</p>
<h2>Qué hace</h2>
<p>Cuando alguien comenta una palabra clave en una publicación de esas cuentas, la aplicación le manda un mensaje directo con el contenido que se ofreció en esa publicación.</p>
<h2>Qué datos usa</h2>
<ul>
<li>El texto y el identificador del comentario, para saber qué palabra se comentó.</li>
<li>El nombre de usuario y si la persona sigue a la cuenta, para entregar el contenido.</li>
</ul>
<p>Esos datos se guardan de forma temporal (máximo 8 días) solo para no mandar mensajes repetidos. No se venden, no se comparten con terceros y no se usan para nada más.</p>
<h2>Cómo borrar tus datos</h2>
<p>Se borran solos a los 8 días. Si quieres que se borren antes, escribe un mensaje directo a la cuenta donde comentaste y se eliminan.</p>
</body></html>`;
}

// ---------- Cuentas ----------

export function cuentas(env, lista = CUENTAS) {
  return lista.map((c) => ({ ...c, llave: env[c.token] || null }));
}

// ID de Instagram de la cuenta (el que llega en cada evento). Se pregunta una vez con su llave y se guarda.
async function idDe(cuenta, env) {
  const guardado = await env.KV.get(`id:${cuenta.usuario}`);
  if (guardado) return guardado;
  if (!cuenta.llave) return null;
  const r = await fetch(`${GRAPH}/${env.GRAPH_VERSION}/me?fields=user_id,username`, { headers: { Authorization: `Bearer ${cuenta.llave}` } });
  if (!r.ok) { console.error("no pude saber el ID de", cuenta.usuario, r.status, await r.text()); return null; }
  const datos = await r.json();
  if (!datos.user_id) return null;
  await env.KV.put(`id:${cuenta.usuario}`, String(datos.user_id));
  return String(datos.user_id);
}

export async function cuentaPorId(igId, env, lista = CUENTAS) {
  for (const c of cuentas(env, lista)) {
    if (!c.llave) continue; // cuenta sin llave: no está conectada
    const id = await idDe(c, env);
    if (id && String(id) === String(igId)) return { ...c, id: String(id) };
  }
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/privacidad") {
      return new Response(avisoDePrivacidad(), { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    if (url.pathname !== "/webhook") return new Response("ok");

    if (request.method === "GET") return verificarWebhook(url, env);

    if (request.method === "POST") {
      const cuerpo = await request.text();
      const firmaOk = await firmaValida(cuerpo, request.headers.get("x-hub-signature-256"), env.APP_SECRET);
      if (!firmaOk) return new Response("firma inválida", { status: 401 });

      // Meta pide contestar rápido; el trabajo sigue en segundo plano.
      ctx.waitUntil(procesar(JSON.parse(cuerpo), env).catch((e) => console.error("error procesando", e)));
      return new Response("EVENT_RECEIVED");
    }
    return new Response("método no permitido", { status: 405 });
  },
};

// ---------- Webhook ----------

function verificarWebhook(url, env) {
  const modo = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  if (modo === "subscribe" && token === env.VERIFY_TOKEN) {
    return new Response(url.searchParams.get("hub.challenge"));
  }
  return new Response("prohibido", { status: 403 });
}

// Revisa que el evento venga de verdad de Meta (firma HMAC con tu APP_SECRET).
export async function firmaValida(cuerpo, encabezado, secreto) {
  if (!encabezado || !secreto) return false;
  const llave = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const firma = await crypto.subtle.sign("HMAC", llave, new TextEncoder().encode(cuerpo));
  const esperado = "sha256=" + [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return igualSeguro(esperado, encabezado);
}

function igualSeguro(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function procesar(payload, env, lista = CUENTAS) {
  if (payload.object !== "instagram") return;
  for (const entrada of payload.entry || []) {
    const cuenta = await cuentaPorId(entrada.id, env, lista);
    if (!cuenta) { console.error("evento de una cuenta que no conozco:", entrada.id); continue; }
    for (const cambio of entrada.changes || []) {
      if (cambio.field === "comments") await alComentar(cambio.value, cuenta, env);
    }
    for (const evento of entrada.messaging || []) {
      if (evento.message && !evento.message.is_echo) await alRecibirDM(evento, cuenta, env);
    }
  }
}

// ---------- Detectar la palabra ----------

export function normalizar(texto) {
  return (texto || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9Ñ ]/g, " ");
}

// "GUIAAA" → "GUIA": junta letras repetidas.
function sinRepetidas(palabra) {
  return palabra.replace(/(.)\1+/g, "$1");
}

// Cuántas letras hay que cambiar para pasar de a a b.
function distancia(a, b) {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let previo = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, previo + (a[i - 1] === b[j - 1] ? 0 : 1));
      previo = temp;
    }
  }
  return fila[b.length];
}

// Acepta la palabra exacta o algo parecido: letras repetidas, plural con S y un error de dedo
// (el error de dedo solo en palabras de 6 letras o más, para que "bola" no cuente como BOLSA).
function seParece(palabra, clave) {
  if (palabra === clave) return true;
  const p = sinRepetidas(palabra);
  const c = sinRepetidas(clave);
  if (p === c || p === c + "S") return true;
  return c.length >= 6 && Math.abs(p.length - c.length) <= 1 && distancia(p, c) <= 1;
}

export function buscarPalabra(texto, palabras) {
  const lista = normalizar(texto).split(/\s+/).filter(Boolean);
  return Object.keys(palabras).find((clave) => lista.some((p) => seParece(p, clave))) || null;
}

function llenar(plantilla, palabras, clave) {
  const c = palabras[clave];
  return plantilla.replaceAll("{regalo}", c.regalo).replaceAll("{link}", c.link);
}

// ---------- El flujo ----------

async function alComentar(comentario, cuenta, env) {
  const clave = buscarPalabra(comentario.text, cuenta.palabras);
  if (!clave) return;
  if (comentario.from?.id === cuenta.id) return; // tus propios comentarios

  // Meta a veces manda el mismo evento dos veces.
  if (await env.KV.get(`c:${comentario.id}`)) return;
  await env.KV.put(`c:${comentario.id}`, "1", { expirationTtl: 60 * 60 * 24 * 8 });

  // Recordamos qué pidió para cuando conteste el mensaje (7 días).
  if (comentario.from?.username) {
    await env.KV.put(`p:${cuenta.usuario}:${comentario.from.username.toLowerCase()}`, clave, { expirationTtl: 60 * 60 * 24 * 7 });
  }

  await enviar(cuenta, env, { recipient: { comment_id: comentario.id }, message: { text: llenar(cuenta.textos.primerMensaje, cuenta.palabras, clave) } });

  if (env.RESPONDER_COMENTARIO === "si") {
    await graph(cuenta, env, `/${comentario.id}/replies`, { message: cuenta.textos.respuestaPublica });
  }
}

async function alRecibirDM(evento, cuenta, env) {
  const igsid = evento.sender?.id;
  if (!igsid || igsid === cuenta.id) return;

  const perfil = await perfilDe(igsid, cuenta, env);
  if (!perfil) return;

  // ¿Qué regalo pidió? Primero por su comentario; si no, por si escribió la palabra en el mensaje.
  const pendiente = perfil.username ? `p:${cuenta.usuario}:${perfil.username.toLowerCase()}` : null;
  let clave = pendiente ? await env.KV.get(pendiente) : null;
  if (clave && !cuenta.palabras[clave]) clave = null; // la palabra ya no existe
  if (!clave) clave = buscarPalabra(evento.message.text, cuenta.palabras);
  if (!clave) return; // un mensaje normal: no contestamos nada

  if (perfil.is_user_follow_business) {
    await enviar(cuenta, env, { recipient: { id: igsid }, message: { text: llenar(cuenta.textos.entrega, cuenta.palabras, clave) } });
    if (pendiente) await env.KV.delete(pendiente);
  } else {
    await enviar(cuenta, env, { recipient: { id: igsid }, message: { text: llenar(cuenta.textos.faltaSeguir, cuenta.palabras, clave) } });
  }
}

// ---------- Llamadas a Instagram ----------

async function perfilDe(igsid, cuenta, env) {
  const r = await fetch(`${GRAPH}/${env.GRAPH_VERSION}/${igsid}?fields=username,is_user_follow_business`, {
    headers: { Authorization: `Bearer ${cuenta.llave}` },
  });
  if (!r.ok) {
    console.error("perfil", cuenta.usuario, r.status, await r.text());
    return null;
  }
  return r.json();
}

function enviar(cuenta, env, cuerpo) {
  return graph(cuenta, env, `/${cuenta.id}/messages`, cuerpo);
}

async function graph(cuenta, env, ruta, cuerpo) {
  const r = await fetch(`${GRAPH}/${env.GRAPH_VERSION}${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cuenta.llave}` },
    body: JSON.stringify(cuerpo),
  });
  if (!r.ok) console.error("graph", cuenta.usuario, ruta, r.status, await r.text());
  return r.ok;
}
