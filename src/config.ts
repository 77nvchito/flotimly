/** Datos de contacto comercial que aparecen en la portada. */
export const CONTACT = {
  /** Número de WhatsApp con código de país y sin espacios ni "+", por ejemplo '56912345678'. Vacío = se oculta el botón. */
  whatsapp: '56956394348',
  /** Correo de contacto. Vacío = no se muestra. */
  email: '',
};

export const whatsappLink = (text: string) =>
  CONTACT.whatsapp ? `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}` : '';

/**
 * Datos legales del titular del servicio. Aparecen en el pie de página y en los documentos legales.
 * Completa rut y address cuando constituyas la empresa (por ejemplo, owner: 'Immtechnology SpA').
 * Los campos vacíos simplemente no se muestran.
 */
export const LEGAL = {
  owner: 'Immtechnology',
  rut: '',
  /** Domicilio legal, por ejemplo 'Av. Providencia 1234, oficina 56, Providencia, Santiago'. */
  address: '',
  /** Fecha de la última actualización de los documentos legales. */
  updated: '17 de noviembre de 2026',
};

/** +56 9 5639 4348 a partir de '56956394348'. */
export const phoneDisplay = (n: string) =>
  n.startsWith('569') && n.length === 11 ? `+56 9 ${n.slice(3, 7)} ${n.slice(7)}` : `+${n}`;

/** "por WhatsApp al +56 9 … o al correo …": canal de contacto que usan los documentos legales. */
export const contactText = () => {
  const parts: string[] = [];
  if (CONTACT.whatsapp) parts.push(`por WhatsApp al ${phoneDisplay(CONTACT.whatsapp)}`);
  if (CONTACT.email) parts.push(`al correo ${CONTACT.email}`);
  return parts.join(' o ');
};
