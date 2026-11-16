/** Datos de contacto comercial que aparecen en la portada. */
export const CONTACT = {
  /** Número de WhatsApp con código de país y sin espacios ni "+", por ejemplo '56912345678'. Vacío = se oculta el botón. */
  whatsapp: '',
  /** Correo de contacto. Vacío = no se muestra. */
  email: '',
};

export const whatsappLink = (text: string) =>
  CONTACT.whatsapp ? `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}` : '';
