// AQUÍ SE CONFIGURA TODO. Es el único archivo que tienes que tocar.
//
// Cada cuenta de Instagram tiene:
//   usuario   tu @ sin la arroba (sale en el aviso de privacidad)
//   token     el NOMBRE del secreto de Cloudflare donde guardaste su llave (token) de Instagram
//   palabras  la palabra que la gente comenta → qué le regalas y el link
//   textos    los mensajes que manda el bot ({regalo} y {link} se reemplazan solos)
//
// La palabra va en MAYÚSCULAS y sin acentos. El bot la entiende aunque la escriban
// en minúsculas, con acentos, con emojis, con letras repetidas ("GUIAAA") o con un error de dedo.
//
// ¿Te da flojera editarlo a mano? Abre Claude Code en esta carpeta y dile:
//   "Agrega la palabra GUIA que mande mi guía de recetas con este link: https://..."
// (el archivo CLAUDE.md le explica cómo hacerlo y cómo publicarlo).

export const CUENTAS = [
  {
    usuario: "tu_cuenta",
    token: "IG_TOKEN",
    palabras: {
      GUIA: {
        regalo: "mi guía gratis",
        link: "https://ejemplo.com/guia",
      },
    },
    textos: {
      // Primer mensaje privado, ligado al comentario (Instagram solo deja mandar uno).
      primerMensaje: "¡Hola! Gracias por comentar 🙌 Para mandarte {regalo}, sígueme y respóndeme LISTO a este mensaje.",
      // Cuando responde y ya te sigue.
      entrega: "¡Aquí está {regalo}! 👇\n{link}\n\nCualquier duda me escribes por aquí.",
      // Cuando responde pero todavía no te sigue.
      faltaSeguir: "Todavía no me sigues 👀 Sígueme y vuelve a escribirme LISTO para mandarte {regalo}.",
      // Respuesta pública al comentario (se apaga con RESPONDER_COMENTARIO = "no" en wrangler.toml).
      respuestaPublica: "¡Te mandé DM! 📩",
    },
  },

  // ¿Tienes otra cuenta (tu negocio, tu marca)? Quita las dos barras // de cada línea de abajo,
  // cambia los datos y guarda su llave como otro secreto: npx wrangler secret put IG_TOKEN_NEGOCIO
  //
  // {
  //   usuario: "tu_negocio",
  //   token: "IG_TOKEN_NEGOCIO",
  //   palabras: {
  //     MENU: { regalo: "nuestro menú con precios", link: "https://ejemplo.com/menu" },
  //   },
  //   textos: {
  //     primerMensaje: "¡Hola! Gracias por comentar 🙌 Para mandarte {regalo}, síguenos y respóndenos LISTO a este mensaje.",
  //     entrega: "¡Aquí está {regalo}! 👇\n{link}\n\nSi tienes dudas, escríbenos por aquí.",
  //     faltaSeguir: "Todavía no nos sigues 👀 Síguenos y vuelve a escribirnos LISTO para mandarte {regalo}.",
  //     respuestaPublica: "¡Te mandamos DM! 📩",
  //   },
  // },
];
