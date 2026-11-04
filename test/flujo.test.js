// Pruebas sin internet: simulan a Instagram y revisan el flujo completo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import worker, { buscarPalabra, procesar, firmaValida } from "../src/index.js";

const PALABRAS = {
  CEREBRO: { regalo: "la plantilla del segundo cerebro", link: "https://ejemplo.com/cerebro" },
  BOLSA: { regalo: "las skills de bolsa", link: "https://ejemplo.com/bolsa" },
  SISTEMA: { regalo: "la guía del CRM", link: "https://ejemplo.com/crm" },
};
const TEXTOS = {
  primerMensaje: "¡Hola! Para mandarte {regalo}, sígueme y respóndeme LISTO.",
  entrega: "¡Aquí está {regalo}! 👇\n{link}",
  faltaSeguir: "Todavía no me sigues 👀 Sígueme y escríbeme LISTO para mandarte {regalo}.",
  respuestaPublica: "¡Te mandé DM! 📩",
};
const UNA = [{ usuario: "cafe_almendro", token: "IG_TOKEN", palabras: PALABRAS, textos: TEXTOS }];
const DOS = [
  ...UNA,
  {
    usuario: "barberia_norte",
    token: "IG_TOKEN_NEGOCIO",
    palabras: { CORTE: { regalo: "tu cupón de corte", link: "https://ejemplo.com/cupon" } },
    textos: { ...TEXTOS, faltaSeguir: "Todavía no nos sigues 👀 Síguenos y escríbenos LISTO para mandarte {regalo}." },
  },
];

function kvFalso(ids = { cafe_almendro: "111", barberia_norte: "222" }) {
  const m = new Map(Object.entries(ids).map(([u, id]) => [`id:${u}`, id]));
  return {
    m,
    get: async (k) => (m.has(k) ? m.get(k) : null),
    put: async (k, v) => void m.set(k, v),
    delete: async (k) => void m.delete(k),
  };
}

const entorno = () => ({ KV: kvFalso(), IG_TOKEN: "t1", IG_TOKEN_NEGOCIO: "t2", GRAPH_VERSION: "v23.0", RESPONDER_COMENTARIO: "si", APP_SECRET: "s", VERIFY_TOKEN: "v" });

function simularInstagram(sigue) {
  const llamadas = [];
  globalThis.fetch = async (url, opts = {}) => {
    llamadas.push({ url: String(url), auth: opts.headers?.Authorization, body: opts.body ? JSON.parse(opts.body) : null });
    if (String(url).includes("fields=username")) {
      return new Response(JSON.stringify({ username: "Daniela_Trevino", is_user_follow_business: sigue() }));
    }
    return new Response("{}");
  };
  return llamadas;
}

const comentario = (id, texto, cuentaId = "111") => ({
  object: "instagram",
  entry: [{ id: cuentaId, changes: [{ field: "comments", value: { id, text: texto, from: { id: "999", username: "daniela_trevino" } } }] }],
});
const dm = (texto, cuentaId = "111") => ({
  object: "instagram",
  entry: [{ id: cuentaId, messaging: [{ sender: { id: "555" }, recipient: { id: cuentaId }, message: { text: texto } }] }],
});

test("entiende la palabra con acentos, emojis, letras repetidas y errores de dedo", () => {
  assert.equal(buscarPalabra("cerebro 🧠🔥", PALABRAS), "CEREBRO");
  assert.equal(buscarPalabra("Quiero el CÉREBRO!!", PALABRAS), "CEREBRO");
  assert.equal(buscarPalabra("cerbro", PALABRAS), "CEREBRO");
  assert.equal(buscarPalabra("CEREBROOOO", PALABRAS), "CEREBRO");
  assert.equal(buscarPalabra("sistma porfa", PALABRAS), "SISTEMA");
  assert.equal(buscarPalabra("bolsas", PALABRAS), "BOLSA");
});

test("no confunde palabras parecidas", () => {
  assert.equal(buscarPalabra("qué buen video", PALABRAS), null);
  assert.equal(buscarPalabra("bola", PALABRAS), null);
  assert.equal(buscarPalabra("tema", PALABRAS), null);
  assert.equal(buscarPalabra("cerezo", PALABRAS), null);
});

test("flujo completo: comenta, no sigue, luego sigue y recibe el link", async () => {
  const env = entorno();
  let sigue = false;
  const llamadas = simularInstagram(() => sigue);

  await procesar(comentario("c1", "Cerebro por favor"), env, UNA);
  const primer = llamadas.find((l) => l.body?.recipient?.comment_id === "c1");
  assert.ok(primer, "manda el mensaje privado ligado al comentario");
  assert.match(primer.body.message.text, /segundo cerebro/);
  assert.ok(llamadas.some((l) => l.url.includes("/c1/replies")), "contesta el comentario en público");

  await procesar(comentario("c1", "Cerebro por favor"), env, UNA);
  assert.equal(llamadas.filter((l) => l.body?.recipient?.comment_id === "c1").length, 1, "no repite si Meta reenvía el evento");

  await procesar(dm("LISTO"), env, UNA);
  assert.match(llamadas.at(-1).body.message.text, /Todavía no me sigues/);
  assert.ok(!llamadas.some((l) => l.body?.message?.text?.includes("ejemplo.com/cerebro")), "no manda el link si no te sigue");

  sigue = true;
  await procesar(dm("listo ya te seguí"), env, UNA);
  assert.match(llamadas.at(-1).body.message.text, /ejemplo\.com\/cerebro/);
});

test("un mensaje normal de alguien que no comentó no recibe respuesta", async () => {
  const env = entorno();
  const llamadas = simularInstagram(() => true);
  await procesar(dm("hola, me encantó tu video"), env, UNA);
  assert.equal(llamadas.filter((l) => l.body).length, 0);
});

test("ignora tus propios comentarios", async () => {
  const env = entorno();
  const llamadas = simularInstagram(() => true);
  const p = comentario("c9", "CEREBRO");
  p.entry[0].changes[0].value.from.id = "111";
  await procesar(p, env, UNA);
  assert.equal(llamadas.length, 0);
});

test("dos cuentas: cada una usa sus palabras, sus textos y su llave", async () => {
  const env = entorno();
  let sigue = false;
  const llamadas = simularInstagram(() => sigue);

  await procesar(comentario("n1", "CEREBRO", "222"), env, DOS);
  assert.equal(llamadas.length, 0, "la segunda cuenta no conoce las palabras de la primera");

  await procesar(comentario("n2", "corte porfa", "222"), env, DOS);
  const primer = llamadas.find((l) => l.body?.recipient?.comment_id === "n2");
  assert.ok(primer.url.includes("/222/messages"), "manda desde la segunda cuenta");
  assert.equal(primer.auth, "Bearer t2", "con la llave de la segunda cuenta");

  await procesar(dm("LISTO", "222"), env, DOS);
  assert.match(llamadas.at(-1).body.message.text, /nos sigues/);
  sigue = true;
  await procesar(dm("LISTO", "222"), env, DOS);
  assert.match(llamadas.at(-1).body.message.text, /ejemplo\.com\/cupon/);
});

test("una cuenta sin llave se ignora", async () => {
  const env = { ...entorno(), IG_TOKEN_NEGOCIO: undefined };
  const llamadas = simularInstagram(() => true);
  await procesar(comentario("n3", "CORTE", "222"), env, DOS);
  assert.equal(llamadas.length, 0);
});

test("firma: acepta la de Meta y rechaza otra", async () => {
  const cuerpo = JSON.stringify(comentario("c2", "SISTEMA"));
  const buena = "sha256=" + createHmac("sha256", "s").update(cuerpo).digest("hex");
  assert.equal(await firmaValida(cuerpo, buena, "s"), true);
  assert.equal(await firmaValida(cuerpo, "sha256=" + "0".repeat(64), "s"), false);
  assert.equal(await firmaValida(cuerpo, null, "s"), false);
});

test("verificación del webhook en Meta y aviso de privacidad", async () => {
  const env = entorno();
  const ok = await worker.fetch(new Request("https://x.dev/webhook?hub.mode=subscribe&hub.verify_token=v&hub.challenge=123"), env, {});
  assert.equal(await ok.text(), "123");
  const mal = await worker.fetch(new Request("https://x.dev/webhook?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=123"), env, {});
  assert.equal(mal.status, 403);
  const priv = await worker.fetch(new Request("https://x.dev/privacidad"), env, {});
  assert.match(await priv.text(), /Aviso de privacidad/);
});
