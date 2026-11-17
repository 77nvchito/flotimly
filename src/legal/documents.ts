import { LEGAL, contactText } from '../config';
import { PLAN_LIST, PROMO, usersLabel, vehiclesLabel } from '../lib/plans';
import { clp } from '../lib/format';

/**
 * Documentos legales de Flotimly. Se muestran en /legal/:slug y se enlazan desde el pie de página.
 * Los planes, precios y la oferta se leen de src/lib/plans.ts, y los datos del titular de src/config.ts (LEGAL).
 *
 * Importante: son una base razonable para un SaaS B2B en Chile, pero no reemplazan la revisión de un abogado.
 */

/** Un bloque es un párrafo o una lista con viñetas. */
export type Block = string | { list: string[] };
export type Section = { h: string; body: Block[] };
export type LegalDoc = { slug: string; title: string; summary: string; sections: Section[] };

const owner = LEGAL.owner;
const ownerFull = [
  owner,
  LEGAL.rut && `RUT ${LEGAL.rut}`,
  LEGAL.address && `con domicilio en ${LEGAL.address}`,
]
  .filter(Boolean)
  .join(', ');
const contact = contactText();
const planLines = PLAN_LIST.map(
  (p) => `${p.name}: ${clp(p.price)} + IVA al mes. ${vehiclesLabel(p)} y ${usersLabel(p).toLowerCase()}.`,
);

const terminos: LegalDoc = {
  slug: 'terminos',
  title: 'Términos y Condiciones',
  summary: 'Las reglas para usar Flotimly: planes, prueba gratuita, pagos, cancelación, tus datos y responsabilidades.',
  sections: [
    {
      h: '1. Quiénes somos y aceptación',
      body: [
        `Flotimly es un software de gestión para empresas de transporte que se entrega como servicio a través de internet (en adelante, el "Servicio"). El titular del Servicio es ${ownerFull} (en adelante, "${owner}", "nosotros").`,
        'Estos Términos y Condiciones regulan la relación entre ' +
          owner +
          ' y la persona o empresa que crea una cuenta o contrata un plan (en adelante, el "Cliente" o "tú"). Al crear una cuenta, iniciar una prueba gratuita, contratar un plan o usar el Servicio, declaras haber leído y aceptado estos Términos, la Política de Privacidad y el Acuerdo de Tratamiento de Datos.',
        'Si aceptas en nombre de una empresa, declaras que tienes facultades para obligarla.',
      ],
    },
    {
      h: '2. El Servicio',
      body: [
        'Flotimly permite registrar vehículos, conductores, viajes, cotizaciones, gastos, facturas pendientes y comprobantes de entrega, y obtener reportes de rentabilidad. Las funciones disponibles dependen del plan contratado.',
        'Flotimly es una herramienta de gestión y apoyo a la toma de decisiones. No es un sistema de facturación electrónica, no emite documentos tributarios ante el Servicio de Impuestos Internos y no reemplaza la asesoría contable, tributaria, legal ni la de un prevencionista de riesgos.',
        'Los cálculos de costos, cotizaciones, rentabilidad y alertas de vencimiento se basan en la información que tú ingresas y son referenciales. Es tu responsabilidad revisarlos antes de usarlos con tus clientes, y mantener vigentes los documentos de tus vehículos y conductores aunque el sistema no muestre una alerta.',
      ],
    },
    {
      h: '3. Versión de demostración',
      body: [
        'La demo pública ("Probar la demo") usa datos ficticios y guarda la información solo en el navegador del dispositivo, sin enviarla a nuestros servidores. Esa información puede perderse al borrar los datos del navegador. No ingreses información real ni datos personales de terceros en la demo.',
      ],
    },
    {
      h: '4. Cuenta y usuarios',
      body: [
        {
          list: [
            'Debes entregar información verdadera y mantenerla actualizada.',
            'Cada usuario es personal. Eres responsable de las acciones realizadas con las cuentas de tu empresa y de mantener las contraseñas en reserva.',
            'Avísanos de inmediato si sospechas un acceso no autorizado.',
            'El administrador de la cuenta decide quién tiene acceso y con qué permisos, y debe dar de baja a quienes ya no trabajen en la empresa.',
          ],
        },
      ],
    },
    {
      h: '5. Planes y límites',
      body: [
        'Los planes vigentes son:',
        { list: planLines },
        'El límite de vehículos indica la capacidad para la que está pensado cada plan. Si tu flota lo supera, te sugeriremos cambiar a un plan mayor. El límite de usuarios se aplica directamente en el sistema. Los servicios adicionales del plan Flota Plus (carga inicial de datos, capacitación y soporte prioritario) se coordinan contigo y se prestan en horario hábil.',
      ],
    },
    {
      h: '6. Prueba gratuita y oferta de lanzamiento',
      body: [
        {
          list: [
            `La prueba gratuita dura ${PROMO.trialDays} días corridos desde la activación de la cuenta y no requiere tarjeta de crédito.`,
            'Al terminar la prueba, la cuenta pasa a modo de solo lectura hasta que contrates un plan. Nada se cobra automáticamente.',
            `La oferta de lanzamiento da un ${PROMO.discount * 100}% de descuento sobre el precio del plan durante los primeros ${PROMO.months} meses pagados. Tiene cupos limitados (${PROMO.spots.toLowerCase()}), se asigna por orden de contratación, aplica una vez por empresa y no es acumulable con otras promociones.`,
            `Desde el mes ${PROMO.months + 1} se cobra el precio normal del plan vigente al momento de la contratación.`,
          ],
        },
      ],
    },
    {
      h: '7. Precios, pago y facturación',
      body: [
        {
          list: [
            'Los precios están en pesos chilenos y no incluyen IVA, que se agrega en la factura.',
            'El Servicio se cobra por mes adelantado. Emitiremos la factura correspondiente al inicio de cada período.',
            'El plazo de pago es de 10 días corridos desde la emisión de la factura, salvo que acordemos otro por escrito.',
            'Si un pago se atrasa más de 15 días, podremos dejar la cuenta en modo de solo lectura, previo aviso. Siempre podrás consultar y exportar tus datos. Si el atraso supera los 60 días, podremos terminar el contrato según la sección 9.',
            'Podemos modificar los precios avisándote con al menos 30 días de anticipación. El nuevo precio se aplicará desde el período siguiente y, si no estás de acuerdo, puedes cancelar sin costo antes de que entre en vigencia.',
          ],
        },
      ],
    },
    {
      h: '8. Cambio de plan',
      body: [
        'Puedes subir de plan en cualquier momento, con efecto inmediato. La diferencia del mes en curso se cobra de forma proporcional. Si bajas de plan, el cambio rige desde el período siguiente. Antes de bajar, verifica que tu flota y tu número de usuarios caben en el nuevo plan.',
      ],
    },
    {
      h: '9. Duración y término',
      body: [
        {
          list: [
            'El contrato es mes a mes, sin plazo mínimo de permanencia, y se renueva cada mes mientras no lo canceles.',
            `Puedes cancelar cuando quieras escribiéndonos ${contact}. La cancelación rige al final del período ya pagado y no se cobran meses siguientes.`,
            'No se hacen devoluciones proporcionales por los días no usados de un mes ya iniciado, salvo cuando la ley lo exija o cuando el término se deba a un incumplimiento nuestro.',
            'Podemos terminar el contrato si incumples gravemente estos Términos (por ejemplo, uso ilícito del Servicio o no pago por más de 60 días), avisándote por escrito.',
            'También podemos dejar de ofrecer el Servicio avisándote con al menos 60 días de anticipación. En ese caso, te devolveremos lo pagado por períodos no prestados y tendrás tiempo para exportar tus datos.',
          ],
        },
      ],
    },
    {
      h: '10. Tus datos',
      body: [
        'La información que ingresas a Flotimly (vehículos, conductores, clientes, viajes, cotizaciones, gastos, facturas, fotos y firmas) es tuya. No la vendemos ni la usamos para fines distintos de prestarte el Servicio.',
        'Puedes exportarla en cualquier momento desde Configuración → Tus datos, en formatos abiertos (Excel, CSV y JSON).',
        'Al terminar el contrato, mantendremos tus datos disponibles para exportación durante 30 días. Después los eliminaremos de forma definitiva, incluidos los respaldos, en un plazo máximo de 90 días adicionales, salvo la información que debamos conservar por obligación legal (por ejemplo, nuestras facturas emitidas).',
        'Cuando registras datos personales de terceros (por ejemplo, de tus conductores o de los contactos de tus clientes), tú eres el responsable de esos datos y nosotros los tratamos por tu cuenta, según el Acuerdo de Tratamiento de Datos.',
      ],
    },
    {
      h: '11. Uso aceptable',
      body: [
        'Te comprometes a no:',
        {
          list: [
            'usar el Servicio para fines ilícitos ni para almacenar información que no tengas derecho a tratar;',
            'intentar acceder a cuentas o datos de otros clientes, ni vulnerar o probar la seguridad del sistema sin nuestra autorización escrita;',
            'sobrecargar el Servicio de forma intencional, usar robots para extraer información o realizar ingeniería inversa del software;',
            'revender, sublicenciar o poner el Servicio a disposición de terceros ajenos a tu empresa;',
            'subir archivos con virus o código malicioso.',
          ],
        },
      ],
    },
    {
      h: '12. Disponibilidad y soporte',
      body: [
        'Hacemos esfuerzos razonables para que el Servicio esté disponible en todo momento, pero no garantizamos que funcione sin interrupciones ni errores. Podemos realizar mantenciones programadas, preferentemente fuera del horario hábil y con aviso cuando sea posible.',
        `El soporte se entrega ${contact}, en días hábiles de 9:00 a 18:00 (hora de Chile). El plan Flota Plus tiene atención prioritaria.`,
        'Podemos mejorar, agregar o modificar funciones. Si eliminamos una función principal de tu plan, te avisaremos con 30 días de anticipación y podrás cancelar sin costo.',
      ],
    },
    {
      h: '13. Propiedad intelectual',
      body: [
        `El software, el diseño, las marcas "Flotimly" e "Immtechnology", los logotipos y los contenidos del Servicio son de ${owner} o de sus licenciantes. Te otorgamos una licencia de uso no exclusiva, intransferible y limitada a la vigencia del contrato, solo para las necesidades internas de tu empresa.`,
        'Tu logo y tus documentos siguen siendo tuyos. Nos autorizas a usarlos solo para mostrarlos dentro de tu cuenta y en los documentos que generes (por ejemplo, cotizaciones en PDF).',
        'Si nos envías sugerencias o ideas, podemos usarlas para mejorar el Servicio sin obligación de pago.',
      ],
    },
    {
      h: '14. Responsabilidad',
      body: [
        'No respondemos por: decisiones comerciales, precios o cotizaciones que tomes en base a la información del sistema; multas, sanciones o pérdidas derivadas de documentos vencidos de tus vehículos o conductores; errores en los datos que ingresaste; ni por daños indirectos, lucro cesante o pérdida de oportunidades de negocio.',
        'Tampoco respondemos por fallas de internet, de tus equipos o de servicios de terceros fuera de nuestro control, ni por casos fortuitos o de fuerza mayor.',
        'En cualquier caso, nuestra responsabilidad total por todos los reclamos relacionados con el Servicio se limita al monto que nos hayas pagado en los 12 meses anteriores al hecho que origina el reclamo.',
        'Estas limitaciones no se aplican en caso de dolo o culpa grave, ni cuando la ley no permita limitar la responsabilidad.',
      ],
    },
    {
      h: '15. Confidencialidad',
      body: [
        'Ambas partes mantendrán en reserva la información comercial no pública de la otra que conozcan por el Servicio, y la usarán solo para cumplir este contrato. Esta obligación continúa 3 años después de su término.',
      ],
    },
    {
      h: '16. Cambios a estos Términos',
      body: [
        'Podemos actualizar estos Términos. Si el cambio es relevante, te avisaremos con al menos 15 días de anticipación por correo, WhatsApp o dentro de la aplicación. Si sigues usando el Servicio después de la fecha de vigencia, se entenderá que aceptas la nueva versión. Si no estás de acuerdo, puedes cancelar sin costo antes de esa fecha.',
      ],
    },
    {
      h: '17. Ley aplicable y reclamos',
      body: [
        'Estos Términos se rigen por las leyes de la República de Chile. Si tu empresa es de menor tamaño, mantienes los derechos que te otorga la Ley N° 20.416, que hace aplicables ciertas normas de la Ley N° 19.496 sobre protección de los derechos de los consumidores.',
        'Antes de iniciar cualquier acción, las partes intentarán resolver la diferencia de buena fe durante al menos 30 días. Si no llegan a acuerdo, la controversia se someterá a los tribunales ordinarios de justicia competentes.',
      ],
    },
    {
      h: '18. Contacto',
      body: [`Para consultas sobre estos Términos, escríbenos ${contact}.`],
    },
  ],
};

const privacidad: LegalDoc = {
  slug: 'privacidad',
  title: 'Política de Privacidad',
  summary: 'Qué datos personales tratamos, para qué, con quién los compartimos, cuánto tiempo los guardamos y cómo ejercer tus derechos.',
  sections: [
    {
      h: '1. Responsable',
      body: [
        `El responsable del tratamiento de los datos personales descritos en esta política es ${ownerFull}. Puedes contactarnos ${contact}.`,
        'Tratamos los datos personales según la Ley N° 19.628 sobre Protección de la Vida Privada y sus modificaciones, incluida la Ley N° 21.719.',
      ],
    },
    {
      h: '2. A quién se aplica',
      body: [
        'Esta política se aplica a los datos de: (a) las personas que visitan nuestro sitio o nos contactan; (b) los usuarios de las cuentas de Flotimly; y (c) los representantes de nuestros clientes.',
        'Los datos que nuestros clientes registran en el sistema sobre terceros (por ejemplo, sus conductores o los contactos de sus clientes) pertenecen a cada cliente, que es su responsable. Nosotros los tratamos solo por su cuenta, según el Acuerdo de Tratamiento de Datos. Si eres conductor o cliente de una empresa que usa Flotimly y quieres ejercer tus derechos, dirígete a esa empresa; nosotros la ayudaremos a responderte.',
      ],
    },
    {
      h: '3. Qué datos tratamos',
      body: [
        {
          list: [
            'Datos de contacto: nombre, empresa, cargo, teléfono, correo y los mensajes que nos envías (por ejemplo, por WhatsApp).',
            'Datos de cuenta: nombre, correo, rol dentro de la empresa y contraseña (que guardamos cifrada; nunca la vemos).',
            'Datos de facturación de la empresa: razón social, RUT, giro, dirección y datos del contacto de pagos.',
            'Datos de uso y técnicos: dirección IP, tipo de navegador y dispositivo, fecha y hora de acceso y registros de actividad necesarios para la seguridad y el funcionamiento del Servicio.',
            'Datos de medición: páginas visitadas, botones utilizados y acciones generales dentro de la aplicación (por ejemplo, "se creó una cotización"), sin incluir el contenido de tus registros. Si aceptas la medición, también grabaciones de la sesión con los campos de formularios y el contenido de la aplicación ocultos.',
          ],
        },
        'No pedimos datos sensibles ni datos de niños, niñas o adolescentes. El Servicio está dirigido a empresas.',
      ],
    },
    {
      h: '4. Para qué los usamos y con qué base',
      body: [
        {
          list: [
            'Prestar el Servicio, crear y administrar cuentas y dar soporte: porque es necesario para cumplir el contrato.',
            'Facturar y cobrar, y cumplir obligaciones tributarias y legales: por obligación legal y por el contrato.',
            'Proteger la seguridad del Servicio, prevenir fraudes y accesos no autorizados: por nuestro interés legítimo.',
            'Responder tus consultas, coordinar demostraciones y enviarte información sobre Flotimly que pediste: por tu consentimiento o por la relación comercial.',
            'Enviarte novedades comerciales: solo si nos autorizaste, y puedes darte de baja cuando quieras.',
            'Medir el uso del sitio y de la aplicación para mejorarlos: de forma anónima y sin cookies por nuestro interés legítimo, y con identificador y grabación de sesión solo si das tu consentimiento.',
          ],
        },
        'No vendemos datos personales ni los usamos para publicidad de terceros, ni tomamos decisiones basadas únicamente en tratamientos automatizados que te afecten.',
      ],
    },
    {
      h: '5. Con quién los compartimos',
      body: [
        'Solo compartimos datos con proveedores que necesitamos para operar, que actúan por nuestra cuenta y bajo obligaciones de confidencialidad y seguridad:',
        {
          list: [
            'Cloudflare: alojamiento del sitio, red de distribución, protección contra ataques y estadísticas de visitas sin cookies.',
            'PostHog: medición del uso del sitio y de la aplicación (servidores en la Unión Europea).',
            'Proveedor de base de datos y almacenamiento en la nube, para guardar la información de las cuentas y sus archivos.',
            'Meta (WhatsApp), cuando decides escribirnos por ese canal.',
            'Asesores contables y legales, cuando sea necesario.',
          ],
        },
        'También podemos entregar datos cuando lo exija la ley o una autoridad competente. Mantenemos una lista actualizada de proveedores, que puedes solicitarnos.',
      ],
    },
    {
      h: '6. Transferencias internacionales',
      body: [
        'Algunos de nuestros proveedores pueden almacenar o procesar datos fuera de Chile, por ejemplo en Brasil, la Unión Europea o Estados Unidos. En esos casos elegimos proveedores que ofrecen niveles adecuados de protección y que se obligan contractualmente a proteger los datos, según lo exige la ley chilena.',
      ],
    },
    {
      h: '7. Cuánto tiempo los guardamos',
      body: [
        {
          list: [
            'Datos de cuenta: mientras la cuenta esté activa y hasta 30 días después del término, para que puedas exportar tu información.',
            'Respaldos: se eliminan en un máximo de 90 días adicionales.',
            'Datos de facturación: durante los plazos que exige la ley tributaria (por regla general, 6 años).',
            'Contactos comerciales que no se convirtieron en clientes: hasta 2 años desde el último contacto, salvo que nos pidas eliminarlos antes.',
            'Registros técnicos de seguridad: hasta 12 meses.',
            'Datos de medición: hasta 12 meses; las grabaciones de sesión, hasta 30 días.',
          ],
        },
      ],
    },
    {
      h: '8. Tus derechos',
      body: [
        'Puedes ejercer en cualquier momento, de forma gratuita, tus derechos de:',
        {
          list: [
            'Acceso: saber qué datos tuyos tratamos y cómo.',
            'Rectificación: corregir datos inexactos o incompletos.',
            'Supresión: pedir que eliminemos tus datos cuando ya no sean necesarios o no exista una base legal para tratarlos.',
            'Oposición: oponerte a ciertos tratamientos, como el envío de novedades comerciales.',
            'Portabilidad: recibir tus datos en un formato estructurado y de uso común.',
            'Bloqueo: pedir la suspensión temporal del tratamiento mientras se resuelve una solicitud.',
          ],
        },
        `Para ejercerlos, escríbenos ${contact}, indicando tu nombre, la empresa y lo que solicitas. Podemos pedirte antecedentes para verificar tu identidad. Responderemos dentro de 30 días corridos.`,
        'Si no estás conforme con nuestra respuesta, puedes reclamar ante la Agencia de Protección de Datos Personales o ante los tribunales competentes.',
      ],
    },
    {
      h: '9. Seguridad',
      body: [
        'Aplicamos medidas técnicas y organizativas razonables para proteger los datos: conexión cifrada (HTTPS), contraseñas cifradas, separación de la información de cada empresa, control de accesos por usuario y rol, respaldos periódicos y acceso restringido de nuestro equipo a la información de los clientes.',
        'Ningún sistema es completamente infalible. Si ocurre un incidente de seguridad que afecte datos personales, lo informaremos a los afectados y a la autoridad cuando corresponda, según la ley.',
      ],
    },
    {
      h: '10. Cookies y almacenamiento local',
      body: ['Lo que guardamos en tu navegador se explica en nuestra Política de Cookies.'],
    },
    {
      h: '11. Cambios a esta política',
      body: [
        'Podemos actualizar esta política. Publicaremos la nueva versión en esta página con su fecha y, si el cambio es relevante, te avisaremos con anticipación.',
      ],
    },
  ],
};

const tratamiento: LegalDoc = {
  slug: 'tratamiento-de-datos',
  title: 'Acuerdo de Tratamiento de Datos',
  summary: 'Cómo tratamos los datos personales que tu empresa registra en Flotimly (por ejemplo, de tus conductores).',
  sections: [
    {
      h: '1. Objeto y roles',
      body: [
        `Este Acuerdo forma parte de los Términos y Condiciones. Regula el tratamiento de los datos personales que el Cliente registra en Flotimly sobre terceros, por ejemplo: nombre, RUT, teléfono, licencia de conducir y sus vencimientos de los conductores; datos de contacto de sus clientes; y firmas y fotografías de los comprobantes de entrega.`,
        `Respecto de esos datos, el Cliente es el responsable del tratamiento y ${owner} es el encargado, es decir, los trata solo por cuenta e instrucción del Cliente.`,
      ],
    },
    {
      h: '2. Obligaciones del Cliente',
      body: [
        {
          list: [
            'Contar con una base legal para registrar los datos (por ejemplo, la relación laboral con sus conductores o el contrato con sus clientes) e informar a los titulares que usa Flotimly para gestionarlos.',
            'Registrar solo los datos necesarios para su operación. No registrar datos sensibles (como datos de salud) salvo que la ley lo permita y sean imprescindibles.',
            'Mantener los datos exactos y actualizados, y eliminar los que ya no necesite.',
            'Atender las solicitudes de los titulares que se dirijan al Cliente, con nuestra ayuda cuando la necesite.',
          ],
        },
      ],
    },
    {
      h: '3. Obligaciones de ' + owner,
      body: [
        {
          list: [
            'Tratar los datos solo para prestar el Servicio y según las instrucciones del Cliente, que son las que da a través de la configuración y el uso del sistema.',
            'No vender, ceder ni usar los datos para fines propios.',
            'Asegurar que las personas de nuestro equipo con acceso a los datos tengan obligación de confidencialidad, y darles acceso solo cuando sea necesario (por ejemplo, para resolver un problema de soporte que el Cliente nos pida).',
            'Aplicar las medidas de seguridad descritas en la Política de Privacidad.',
            'Ayudar al Cliente a responder las solicitudes de acceso, rectificación, supresión, oposición, portabilidad y bloqueo de los titulares.',
            'Notificar al Cliente sin demoras indebidas, y en lo posible dentro de 72 horas desde que tomemos conocimiento, cualquier incidente de seguridad que afecte sus datos, con la información disponible para que pueda cumplir sus propias obligaciones.',
          ],
        },
      ],
    },
    {
      h: '4. Subencargados',
      body: [
        'El Cliente autoriza que usemos proveedores de infraestructura (alojamiento, base de datos, almacenamiento de archivos y respaldos) como subencargados. Les exigimos obligaciones de protección equivalentes a las de este Acuerdo y respondemos por ellos ante el Cliente.',
        'Avisaremos al Cliente antes de incorporar un nuevo subencargado relevante. Si tiene una objeción fundada, puede cancelar el Servicio sin costo.',
      ],
    },
    {
      h: '5. Término',
      body: [
        'Al terminar el contrato, el Cliente puede exportar sus datos durante 30 días. Después los eliminaremos, incluidos los respaldos, en un máximo de 90 días adicionales, salvo que la ley nos obligue a conservar alguno. A petición del Cliente, confirmaremos la eliminación por escrito.',
      ],
    },
    {
      h: '6. Información y auditoría',
      body: [
        'Entregaremos al Cliente la información razonable que necesite para verificar el cumplimiento de este Acuerdo, sin revelar información de otros clientes ni comprometer la seguridad del Servicio.',
      ],
    },
  ],
};

const cookies: LegalDoc = {
  slug: 'cookies',
  title: 'Política de Cookies',
  summary: 'Qué guardamos en tu navegador y para qué. Sin publicidad. La medición con identificador solo funciona si la aceptas.',
  sections: [
    {
      h: '1. Qué son',
      body: [
        'Las cookies y el almacenamiento local son pequeños archivos o registros que un sitio guarda en tu navegador para funcionar o para recordar información entre visitas.',
      ],
    },
    {
      h: '2. Qué usamos',
      body: [
        'Flotimly solo usa almacenamiento estrictamente necesario para funcionar:',
        {
          list: [
            'Sesión: recuerda que iniciaste sesión, para que no tengas que ingresar en cada página.',
            'Datos de la demo: en la versión de demostración, la información que ves y modificas se guarda solo en tu navegador.',
            'Seguridad: nuestro proveedor de alojamiento (Cloudflare) puede usar cookies técnicas para detectar tráfico automatizado y proteger el sitio de ataques.',
          ],
        },
        'Además, medimos el uso del sitio para mejorarlo:',
        {
          list: [
            'Cloudflare Web Analytics: cuenta visitas de forma agregada, sin cookies ni identificadores.',
            'PostHog: registra qué páginas y funciones se usan. Mientras no aceptes, funciona sin cookies y sin guardar nada en tu navegador. Si aceptas, guarda un identificador para reconocer tus visitas siguientes y puede grabar la sesión, con los formularios y el contenido de la aplicación ocultos.',
          ],
        },
        'No usamos cookies de publicidad ni de redes sociales, y no compartimos esta información con anunciantes.',
      ],
    },
    {
      h: '3. Cómo controlarlas',
      body: [
        'Puedes borrar o bloquear las cookies y el almacenamiento local desde la configuración de tu navegador. Si lo haces, se cerrará tu sesión y, en la demo, se perderán los datos que hayas modificado.',
        'Puedes cambiar tu decisión sobre la medición cuando quieras desde "Preferencias de cookies", al pie de la página.',
        'Si en el futuro incorporamos herramientas de publicidad, actualizaremos esta política y te pediremos tu consentimiento antes de activarlas.',
      ],
    },
  ],
};

export const LEGAL_DOCS: LegalDoc[] = [terminos, privacidad, tratamiento, cookies];

export const legalDoc = (slug: string | undefined) => LEGAL_DOCS.find((d) => d.slug === slug);
