// The privacy notice as a whole (docs/specs/legal-pages.md): the full notice
// published at /aviso-de-privacidad, and the two pieces of the registration
// form that belong to the same version, the simplified notice and the literal
// of the consent checkbox. The text is approved content, not free copy: it is
// the verbatim block of "Full text of the privacy notice (v2)", and
// changing it changes that spec and releases a new notice version
// (src/core/legal/version.ts).
//
// The full notice belongs to no locality and names none (base-layout, "Pages
// outside a locality name no locality (v2)"): every locality links to it.
import {
  PRIVACY_NOTICE_PATH,
  TERMS_PATH,
  TURNSTILE_PRIVACY_ADDENDUM,
  type LegalDocument,
  type LegalPageMetadata,
} from "./document.ts";
import {
  DIRECTORY_EMAIL,
  DIRECTORY_WHATSAPP,
  PUBLICATION_DATE,
  RESPONSIBLE_ADDRESS,
  RESPONSIBLE_NAME,
} from "./placeholders.ts";

export const PRIVACY_NOTICE_PAGE: LegalPageMetadata & { path: typeof PRIVACY_NOTICE_PATH } = {
  path: PRIVACY_NOTICE_PATH,
  title: "Aviso de privacidad",
  description:
    "Qué datos pide enmirumbo al registrar un negocio, para qué los usa, qué queda público en el directorio y cómo ejercer tus derechos ARCO.",
};

/**
 * Where the simplified notice names the municipality of the form's locality
 * (base-layout, "Every text that names the locality reads it from the locality
 * record (v2)"). The version covers the text with this mark, so every
 * locality accepts the same version.
 */
export const MUNICIPALITY_MARK = "{municipio}";

/** The simplified notice of the registration form, with the municipality as a mark. */
export const SIMPLIFIED_NOTICE_TEMPLATE = `Aviso de privacidad (resumen): enmirumbo, el directorio de negocios de ${MUNICIPALITY_MARK}, usa los datos que escribes aquí para revisar tu negocio, contactarte por WhatsApp y publicar tu ficha en el directorio. Ojo con esto: si publicamos tu ficha, el nombre de tu negocio, tu WhatsApp, tu teléfono fijo y lo demás que escribas quedan a la vista de cualquiera que entre al directorio, con botones para escribirte o marcarte directo. Publicamos tu colonia, no tu domicilio exacto, salvo que tú escribas la dirección. No vendemos ni compartimos tus datos con nadie más. Puedes pedirnos que corrijamos o borremos tu ficha cuando quieras, por el mismo WhatsApp con el que te contactemos; lo atendemos en máximo 20 días hábiles.`;

/** The simplified notice as the form of a locality shows it. */
export function simplifiedNotice(municipalityName: string): string {
  return SIMPLIFIED_NOTICE_TEMPLATE.replace(MUNICIPALITY_MARK, municipalityName);
}

/** The literal of the consent checkbox of the registration form. */
export const CONSENT_CHECKBOX =
  "Acepto el aviso de privacidad y confirmo que este negocio es mío o que tengo permiso para registrarlo.";

/** The full notice at /aviso-de-privacidad. */
export const PRIVACY_NOTICE: LegalDocument = {
  title: "Aviso de privacidad",
  lastUpdated: PUBLICATION_DATE,
  introduction:
    "Este aviso explica, sin rodeos, qué datos nos das cuando registras tu negocio en enmirumbo, el directorio de negocios locales, para qué los usamos, qué queda público y cómo puedes pedirnos que los corrijamos o los borremos.",
  sections: [
    {
      heading: "Quién es responsable de tus datos",
      blocks: [
        {
          kind: "paragraph",
          text: `El responsable del directorio enmirumbo y de los datos personales que nos das es ${RESPONSIBLE_NAME}, con domicilio en ${RESPONSIBLE_ADDRESS}.`,
        },
        {
          kind: "paragraph",
          text: `Para cualquier cosa relacionada con tus datos escríbenos al correo ${DIRECTORY_EMAIL} o por WhatsApp al ${DIRECTORY_WHATSAPP}.`,
        },
      ],
    },
    {
      heading: "Qué datos recogemos",
      blocks: [
        { kind: "paragraph", text: "Los que tú escribes en el formulario de registro:" },
        {
          kind: "list",
          items: [
            "Obligatorios: el nombre de tu negocio, la categoría, tu número de WhatsApp de 10 dígitos y tu colonia.",
            "Opcionales: qué ofreces, si haces entregas o vas a domicilio, teléfono fijo, dirección o referencias, horario, el link de tu Facebook y, si la subes, una foto de tu negocio.",
          ],
        },
        {
          kind: "paragraph",
          text: "No te pedimos CURP, RFC, credencial de elector ni datos bancarios. Si nos los mandas por WhatsApp, no los guardamos.",
        },
        {
          kind: "paragraph",
          text: "Guardamos también la fecha y la hora en que aceptaste este aviso: es la constancia de que nos diste tu permiso para usar tus datos.",
        },
      ],
    },
    {
      heading: "Para qué usamos tus datos",
      blocks: [
        {
          kind: "list",
          items: [
            "Para revisar que tu negocio existe y que el número que registraste es tuyo: te escribimos o te llamamos por WhatsApp antes de publicar.",
            "Para publicar tu ficha en el directorio, que es a lo que vino todo esto: que los vecinos te encuentren y te contacten.",
            "Para avisarte cuando publicamos tu ficha, para mandarte su link y para decirte, si fuera el caso, por qué no la publicamos.",
            "Para contar cuántos negocios se registran y cuántos se publican, en números generales, y saber si el directorio está sirviendo.",
          ],
        },
        {
          kind: "paragraph",
          text: "No usamos tus datos para publicidad de terceros ni para nada distinto de tener el directorio funcionando.",
        },
      ],
    },
    {
      heading: "Qué queda público y qué no",
      blocks: [
        {
          kind: "paragraph",
          text: 'Cuando aprobamos tu registro, tu ficha se publica y cualquier persona con internet puede verla: el nombre de tu negocio, la categoría, tu colonia, lo que escribiste en "¿Qué ofreces?", tu horario, si haces entregas, el link de tu Facebook y —esto es lo más importante— tu WhatsApp y tu teléfono fijo, con botones para escribirte o marcarte directo. Trátalos como números de contacto de tu negocio: quien sea puede verlos y usarlos.',
        },
        {
          kind: "paragraph",
          text: "Publicamos tu colonia, no tu domicilio exacto. Si tú escribes una dirección o referencias en el formulario, eso también se publica tal cual: piénsalo si atiendes desde tu casa.",
        },
        {
          kind: "paragraph",
          text: 'Esa dirección también alimenta el botón "Cómo llegar" de tu ficha: quien lo toca abre Google Maps en su teléfono, buscando lo que escribiste junto con tu colonia, tu municipio y tu estado.',
        },
        {
          kind: "paragraph",
          text: "Si subes una foto de tu negocio, esa foto es pública igual que lo demás. La foto es opcional y debe mostrar tu local, tus productos o tu trabajo: que no salgan personas que se puedan reconocer, porque este aviso cubre tus datos y no la imagen de otras personas. Si una foto no cumple, no la publicamos y te decimos por qué al revisar tu registro. Antes de guardarla la comprimimos y le quitamos los datos ocultos que trae el archivo —como la ubicación GPS de dónde se tomó—: eso no se publica ni se conserva.",
        },
        {
          kind: "paragraph",
          text: "Buscadores como Google pueden encontrar tu ficha y mostrarla en sus resultados. Para eso está hecho el directorio.",
        },
        {
          kind: "paragraph",
          text: "Lo que nunca se publica: la fecha en que te registraste, las notas internas de la revisión y el motivo por el que, en su caso, no publicamos tu ficha. Eso solo lo ve quien administra el directorio.",
        },
      ],
    },
    {
      heading: "Con quién compartimos tus datos",
      blocks: [
        {
          kind: "paragraph",
          text: "Con nadie. No vendemos, no rentamos ni intercambiamos tus datos.",
        },
        {
          kind: "paragraph",
          text: "Los únicos terceros que participan son los proveedores que hacen funcionar el sitio. Tratan los datos por cuenta nuestra y nada más para lo que hace cada uno:",
        },
        {
          kind: "list",
          items: [
            "Cloudflare: hospeda el sitio y las fotos de los negocios, protege la entrada al panel de quien administra el directorio y revisa, con su herramienta Turnstile, que quien envía un formulario sea una persona y no un programa.",
            "Neon: guarda la base de datos del directorio.",
            "Twilio: te manda por SMS un código para confirmar tu número, solo si tenemos encendida esa verificación.",
            "Resend: manda los correos de aviso que recibe quien administra el directorio.",
            "Umami: cuenta las visitas al sitio y algunos clics, sin cookies y sin datos que te identifiquen.",
          ],
        },
        {
          kind: "paragraph",
          text: "La revisión de Turnstile sigue además las reglas de privacidad que Cloudflare publica para esa herramienta:",
        },
        {
          kind: "link",
          text: "Anexo de privacidad de Turnstile, de Cloudflare (en inglés)",
          href: TURNSTILE_PRIVACY_ADDENDUM,
        },
        {
          kind: "paragraph",
          text: "Solo entregaríamos datos a una autoridad que nos los pida por escrito y conforme a la ley.",
        },
      ],
    },
    {
      heading: "Cuánto tiempo guardamos tus datos",
      blocks: [
        {
          kind: "paragraph",
          text: "Guardamos los datos de tu ficha mientras esté publicada, y también si la despublicamos, hasta que nos pidas borrarla. En estos casos los borramos de forma definitiva sin que nos lo pidas:",
        },
        {
          kind: "list",
          items: [
            "Si rechazamos tu registro, sus datos se borran a los 90 días.",
            "Si tu registro se queda en revisión y nunca llegamos a verificarlo y publicarlo, sus datos se borran a los 30 días de que lo enviaste.",
            "Cuando nos mandas cambios para tu ficha, los guardamos mientras los revisamos. Una vez que los aplicamos o los descartamos, o que los reemplazas con otros más nuevos, se borran a los 30 días.",
          ],
        },
      ],
    },
    {
      heading: "Cómo limitar el uso o la divulgación de tus datos",
      blocks: [
        {
          kind: "list",
          items: [
            "Dinos qué no quieres publicar: si prefieres que tu teléfono fijo, tu horario o tu dirección no aparezcan en la ficha, escríbenos y los quitamos.",
            "Pide que despubliquemos tu ficha: en cuanto nos llega tu mensaje la bajamos del directorio, sin trámites ni explicaciones.",
            "Pide que borremos todo: eliminamos tu registro de forma definitiva, no solo lo escondemos.",
          ],
        },
        {
          kind: "paragraph",
          text: "Todo esto lo hace a mano quien administra el directorio, desde su panel, cuando tú lo pides: no hay un botón que lo haga solo. Escríbenos por WhatsApp o por correo y te confirmamos que quedó hecho en un máximo de 20 días hábiles.",
        },
      ],
    },
    {
      heading: "Tus derechos ARCO",
      blocks: [
        {
          kind: "paragraph",
          text: "Tienes derecho a acceder a tus datos, a rectificarlos si están mal, a cancelarlos (que los borremos) y a oponerte a que los usemos. Eso son los derechos ARCO.",
        },
        {
          kind: "paragraph",
          text: "Los atiende quien administra el directorio desde su panel: según lo que pidas, te manda por WhatsApp una copia de tus datos, corrige tu ficha, la despublica o la borra de forma definitiva.",
        },
        {
          kind: "paragraph",
          text: `Para ejercerlos escríbenos al correo ${DIRECTORY_EMAIL} o por WhatsApp al ${DIRECTORY_WHATSAPP} y dinos:`,
        },
        {
          kind: "list",
          items: [
            "qué quieres: ver tus datos, corregirlos, borrarlos u oponerte a que los usemos;",
            "el nombre de tu negocio y el número de WhatsApp con el que lo registraste;",
            "si es una corrección, qué debe decir.",
          ],
        },
        {
          kind: "paragraph",
          text: "Te contestamos en un máximo de 20 días hábiles y, si tu solicitud procede, la aplicamos en cuanto te respondemos. No cobramos nada por esto.",
        },
        {
          kind: "paragraph",
          text: "Como el registro no usa cuentas ni contraseñas, antes de cambiar o borrar algo confirmamos que la solicitud viene del mismo número de WhatsApp con el que se registró el negocio. Es para que nadie más pueda tocar tu ficha.",
        },
      ],
    },
    {
      heading: "Cookies y datos de navegación",
      blocks: [
        {
          kind: "paragraph",
          text: "El directorio público no usa cookies de publicidad ni rastrea a los vecinos que lo visitan. El sitio usa solo dos cookies:",
        },
        {
          kind: "list",
          items: [
            "La del municipio que eliges en la página de inicio cuando el directorio está en más de un municipio: guarda solo el nombre de ese municipio tal como aparece en la dirección del sitio, para llevarte ahí la próxima vez, y nada más.",
            "La de Cloudflare Access, que solo existe en el panel de administración: mantiene abierta la sesión de quien administra el directorio.",
          ],
        },
        {
          kind: "paragraph",
          text: "Umami, la herramienta con la que contamos las visitas, no usa cookies.",
        },
        {
          kind: "paragraph",
          text: "Cuando haces una búsqueda o envías un formulario del sitio, el servidor usa tu dirección IP para limitar cuántas veces se puede hacer eso en poco tiempo y así frenar el abuso automatizado. No la usa tal cual: la convierte en un código con una clave secreta, y ese código vive solo en su memoria y por menos de una hora. Ni tu IP ni ese código se escriben nunca en la base de datos, ni se ligan a tu ficha.",
        },
      ],
    },
    {
      heading: "Cambios a este aviso",
      blocks: [
        {
          kind: "paragraph",
          text: "Si cambiamos este aviso, publicamos la versión nueva en esta misma página y actualizamos la fecha de arriba. Si el cambio es importante —por ejemplo, si empezamos a usar tus datos para algo nuevo—, te avisamos por WhatsApp al número que registraste antes de aplicarlo. Darle una repasada a esta página de vez en cuando es la forma de estar al tanto.",
        },
      ],
    },
    {
      heading: "Si crees que no respetamos tus derechos",
      blocks: [
        {
          kind: "paragraph",
          text: "Puedes acudir a la Secretaría Anticorrupción y Buen Gobierno, que desde 2025 es la autoridad en materia de protección de datos personales en México.",
        },
      ],
    },
  ],
  closingLink: { text: "Términos y condiciones", href: TERMS_PATH },
};
