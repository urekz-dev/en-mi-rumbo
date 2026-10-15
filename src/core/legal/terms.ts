// The terms and conditions at /terminos (docs/specs/legal-pages.md). Approved
// content, not free copy: it is the verbatim block of "Full text of the terms
// and conditions (v2)". The terms carry no version: their last-update line is
// published as is. Like the notice, they belong to no locality and name none.
import {
  PRIVACY_NOTICE_PATH,
  TERMS_PATH,
  type LegalDocument,
  type LegalPageMetadata,
} from "./document.ts";
import {
  DIRECTORY_EMAIL,
  DIRECTORY_WHATSAPP,
  JURISDICTION,
  PUBLICATION_DATE,
} from "./placeholders.ts";

export const TERMS_PAGE: LegalPageMetadata & { path: typeof TERMS_PATH } = {
  path: TERMS_PATH,
  title: "Términos y condiciones",
  description:
    'Las reglas de enmirumbo: qué es el directorio, el deslinde entre vecinos y negocios, qué significa "Negocio verificado" y las reglas de moderación.',
};

export const TERMS: LegalDocument = {
  title: "Términos y condiciones",
  lastUpdated: PUBLICATION_DATE,
  introduction:
    "Estas son las reglas de enmirumbo, el directorio de negocios locales, para los negocios que se registran y para los vecinos que los buscan. Al usar el sitio o registrar tu negocio, aceptas lo que dice aquí.",
  sections: [
    {
      heading: "Qué es enmirumbo",
      blocks: [
        {
          kind: "paragraph",
          text: "Es un directorio de negocios y servicios locales, organizado por municipio. Sirve para dos cosas: que un negocio publique su ficha gratis y que un vecino lo encuentre y le escriba por WhatsApp. Nada más.",
        },
        {
          kind: "paragraph",
          text: "No cobramos por registrarse, no vendemos nada, no cobramos comisiones y no hay cuentas ni contraseñas.",
        },
      ],
    },
    {
      heading: "Somos un intermediario informativo, no el negocio",
      blocks: [
        {
          kind: "paragraph",
          text: "enmirumbo solo muestra información. No prestamos los servicios ni vendemos los productos que aparecen en las fichas.",
        },
        {
          kind: "paragraph",
          text: "Cuando le escribes a un negocio por WhatsApp, sales de este sitio. Lo que pase después —el precio, el trabajo, la entrega, el pago, la garantía, los tiempos y cualquier problema— es un trato directo entre tú y ese negocio. enmirumbo no es parte de ese trato, no lo garantiza, no lo supervisa y no responde por él.",
        },
        {
          kind: "paragraph",
          text: "Tampoco respondemos por daños, pérdidas o desacuerdos que salgan de un servicio o una compra contratados con alguien que encontraste aquí. Si algo sale mal, resuélvelo con el negocio; y avísanos, porque nos sirve para moderar el directorio.",
        },
      ],
    },
    {
      heading: "Qué verificamos y qué no",
      blocks: [
        {
          kind: "paragraph",
          text: 'Antes de publicar una ficha le escribimos o le llamamos al número registrado para confirmar dos cosas: que el negocio existe y que el número es de quien lo registró. Eso, y nada más que eso, es lo que significa el sello "Negocio verificado".',
        },
        {
          kind: "paragraph",
          text: "Lo que no verificamos: la calidad del trabajo, los precios, que el negocio tenga licencias, permisos o seguros, ni que lo que dice su ficha siga siendo cierto con el tiempo. Esa información la escribe cada negocio y es su responsabilidad que sea verdadera y esté al día.",
        },
        {
          kind: "paragraph",
          text: "Si un negocio cierra o cambia sus datos y no nos avisa, su ficha puede quedar desactualizada. Avísanos y la corregimos o la bajamos.",
        },
      ],
    },
    {
      heading: "Reglas para registrar un negocio",
      blocks: [
        {
          kind: "paragraph",
          text: "Revisamos a mano cada registro antes de publicarlo. Rechazamos —o retiramos, si ya estaba publicada— cualquier ficha que caiga en esto:",
        },
        {
          kind: "list",
          items: [
            "Actividades ilegales, o que necesitan una licencia o un permiso que no se pueda demostrar: venta de medicamentos controlados, armas, préstamos informales y parecidos.",
            "Contenido ofensivo, discriminatorio o sexual.",
            "Fichas de negocios ajenos registradas por alguien sin autorización del negocio: solo lo registra su dueño o alguien con su permiso.",
            "Fotos que no cumplan las reglas de publicación del directorio.",
            "Datos falsos, un número de contacto que no es del negocio, o registrar la misma ficha varias veces.",
          ],
        },
        {
          kind: "paragraph",
          text: "Rechazar no es para siempre: te avisamos por WhatsApp con el motivo y puedes corregir y volver a enviar tu registro. Los datos de los registros rechazados se borran a los 90 días.",
        },
      ],
    },
    {
      heading: "Podemos retirar una ficha",
      blocks: [
        {
          kind: "paragraph",
          text: "Nos reservamos el derecho de no publicar o de retirar cualquier ficha que rompa estas reglas o que ya no corresponda a un negocio real del municipio donde está publicada. Y si el propio negocio nos pide que la bajemos, la bajamos de inmediato.",
        },
      ],
    },
    {
      heading: "Si ves algo raro",
      blocks: [
        {
          kind: "paragraph",
          text: `Si encuentras una ficha falsa, un negocio que ya cerró o algo que rompe estas reglas, escríbenos al correo ${DIRECTORY_EMAIL} o por WhatsApp al ${DIRECTORY_WHATSAPP}. Lo revisamos y actuamos.`,
        },
      ],
    },
    {
      heading: "Uso de la información del directorio",
      blocks: [
        {
          kind: "paragraph",
          text: "Los datos del directorio están para que los vecinos contacten a los negocios uno por uno. Copiarlos de forma masiva —a mano o con programas— para armar otra base de datos, revenderlos o mandar publicidad no está permitido.",
        },
      ],
    },
    {
      heading: "Tus datos personales",
      blocks: [
        {
          kind: "paragraph",
          text: "Qué datos guardamos, para qué los usamos y qué queda público está explicado en el aviso de privacidad.",
        },
        { kind: "link", text: "Aviso de privacidad", href: PRIVACY_NOTICE_PATH },
      ],
    },
    {
      heading: "Cambios a estos términos",
      blocks: [
        {
          kind: "paragraph",
          text: "Si cambiamos estas reglas, publicamos la versión nueva en esta misma página y actualizamos la fecha de arriba. Seguir usando el sitio después de un cambio significa que lo aceptas.",
        },
      ],
    },
    {
      heading: "Ley aplicable",
      blocks: [
        {
          kind: "paragraph",
          text: `Estos términos se rigen por las leyes mexicanas. ${JURISDICTION}.`,
        },
      ],
    },
  ],
};
