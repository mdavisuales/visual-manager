# Visual Manager 1.0

Plataforma web del Ministerio de Visuales de la iglesia MDA. Esta versión completa las cinco fases del proyecto: solicitudes, equipo y programación, inventario y paquetes técnicos, WhatsApp automático, y estadísticas, informes y formación:

- **Portal público** (sin cuenta): formulario de solicitud de apoyo técnico, advertencia automática si faltan menos de 15 días (no impide el envío), código único de seguimiento y página para consultar el estado.
- **Panel privado** con tres roles (Coordinador, Líder, Servidor): resumen, bandeja de solicitudes con cambio de estado y notas internas, usuarios, y avisos de WhatsApp.
- **Todo configurable desde el panel** (sin tocar código): requerimientos técnicos, días mínimos de anticipación, texto de la advertencia y permisos de Líder y Servidor.
- **Avisos de WhatsApp gratuitos**: cada solicitud nueva genera un aviso para el Líder y el Coordinador con un enlace `wa.me` y el mensaje ya redactado. Alguien del equipo lo abre y lo envía desde el WhatsApp del ministerio.

**Fase 2 (nueva):**
- **Equipo:** perfiles con datos de contacto, fecha de ingreso, experiencia, áreas, habilidades, historial de participación y resultado del test.
- **Test de habilidades:** lo hace cada servidor (los nuevos son llevados a él al entrar). Se arma solo con las áreas y habilidades que haya configuradas. Es orientativo y no excluyente: el coordinador o los líderes validan el perfil.
- **Áreas y habilidades configurables** desde *Configuración → Áreas de servicio y habilidades* (vienen transmisión, sonido, iluminación y proyección).
- **Disponibilidad personal:** cada servidor marca cuándo NO puede servir (un día, varios días, o recurrente cada semana, con horario o todo el día).
- **Programación** por día, semana y mes: servicios creados a mano o desde una solicitud, asignación de servidores por área y función. El sistema bloquea cruces de horario y avisa si la persona no tiene el área o marcó que no está disponible (el coordinador o líder puede asignarla de todos modos marcando una casilla).
- **Confirmaciones, reemplazos e intercambios:** el servidor confirma su turno. Si no puede ir, no cancela por su cuenta: pide un reemplazo o propone un intercambio, y **nada cambia hasta que la otra persona acepte**. Se valida que esté activa, tenga el área, esté disponible y sin cruces (al proponer y de nuevo al aceptar). Todo queda en un historial.
- **Emergencias:** excepción para avisar al coordinador y líderes cuando es imposible asistir; ellos la atienden desde la programación.
- **Notificaciones** dentro del panel y en la cola de WhatsApp (nueva asignación, cambios de horario o lugar, cancelaciones, pedidos de reemplazo e intercambio, respuestas, emergencias) y **recordatorios** generables con un botón.

**Fase 3 (nueva): inventario y paquetes técnicos**
- **Inventario** con categorías configurables, marca, modelo, cantidad, ubicación y observaciones. Un registro puede tener varias unidades (por ejemplo, 20 cables). Estados: *disponible, en uso, prestado, en mantenimiento y dañado*. Las unidades en mantenimiento o dañadas las registra el equipo; "prestado" y "en uso" se calculan solos a partir de los préstamos y las reservas.
- **Préstamos:** quién recibió, quién autorizó, fecha y hora de entrega, devolución prevista y real, y observaciones del estado. Al devolver se pueden marcar unidades con daños. Los préstamos vencidos se resaltan.
- **Historial completo** de movimientos de cada equipo (registro, cambios, préstamos, devoluciones, reservas, uso).
- **Paquetes técnicos** que el coordinador y los líderes crean, editan o eliminan, con los equipos y cantidades de cada uno.
- **Lista de equipos de un evento:** en cada solicitud (y en cada servicio) se eligen paquetes completos y equipos sueltos. El sistema **suma las cantidades** cuando un equipo aparece varias veces, genera la **lista final a llevar** y la **valida contra el inventario para esa fecha y horario**, advirtiendo si algo está dañado, en mantenimiento, prestado o reservado para otro evento. Se puede reservar, actualizar o liberar la reserva, y marcar los equipos *en uso* (asociados al evento) y luego *devueltos*.
- **Novedades técnicas:** cualquier integrante puede reportar un problema técnico; se avisa al coordinador y líderes, y ellos lo marcan como atendido.
- El **resumen** muestra unidades dañadas o en mantenimiento, préstamos vencidos, novedades abiertas y solicitudes próximas sin lista de equipos.

**Fase 4 (nueva): WhatsApp automático (opcional)**
- Un **interruptor en Configuración → WhatsApp**: modo *manual* (enlaces de WhatsApp, gratis, como hasta ahora) o modo *automático* (API oficial de WhatsApp).
- En modo automático, todos los avisos (nuevas solicitudes, asignaciones, reemplazos, intercambios, cambios de horario o lugar, cancelaciones, emergencias, novedades técnicas, recordatorios) salen solos desde el número del ministerio.
- **Si un envío falla, el aviso vuelve a la cola manual** y se reintenta hasta 3 veces: nunca se pierde.
- **Estado de entrega** (enviado, entregado, leído, falló) mediante *webhook* de Meta.
- **Tarea programada** (cada hora): recordatorios automáticos de servicios, reintentos y un aviso diario de préstamos vencidos al coordinador y líderes.
- Pantalla de estado con prueba de envío. **No se usa MCP ni librerías no oficiales** (ver la sección 8).

**Fase 5 (nueva): estadísticas, informes y formación**
- **Estadísticas** por período *mensual, trimestral, semestral, anual o personalizado*: solicitudes (recibidas, aprobadas, rechazadas, ejecutadas), servicios, participación de los servidores, confirmaciones, asistencia y ausencias, reemplazos, intercambios, emergencias, estado del inventario, daños, mantenimientos, préstamos, novedades técnicas y capacitaciones. Incluye gráficos y un resumen escrito automáticamente.
- **Asistencia:** en cada servicio, coordinación o líderes marcan quién estuvo *presente* o *ausente*; de ahí salen las cifras de asistencia y ausencias.
- **Informe ministerial consolidado** con un botón: guarda una copia de las cifras del período y permite escribir *logros, necesidades y observaciones relevantes*. Se descarga en:
  - **PDF** con portada, período reportado, resumen ejecutivo, estadísticas, tablas, gráficos, logros, necesidades y observaciones, listo para presentar a la pastora.
  - **Excel** con una hoja por tema (resumen, solicitudes, servicios, servidores, cambios de turno, inventario, formación, logros y necesidades); los totales y porcentajes son fórmulas.
  - Los informes quedan guardados: puedes editar sus textos, recalcular las cifras con los datos de hoy o volver a descargarlos.
- **Módulo de formación y capacitación**, que el coordinador **activa o desactiva** en *Configuración → General*. Activado: se crean capacitaciones, se publican manuales, tutoriales y materiales (como enlaces de Drive, YouTube, etc.), se registran participaciones y se hace seguimiento al avance de cada servidor (inscrito, asistió, ausente, completó, % de avance y observaciones); los servidores pueden inscribirse y ver su progreso. Desactivado: la sección se oculta para todos y **no se borra ningún registro**.

**Tecnología:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Prisma · PostgreSQL (Neon) · alojamiento en Netlify.

---

## 1. Requisitos

- Una cuenta gratuita en [GitHub](https://github.com), [Neon](https://neon.tech) y [Netlify](https://netlify.com) (no piden tarjeta para el plan gratuito, pero revisa sus condiciones actuales).
- En tu computador: [Node.js 20 LTS](https://nodejs.org) y [Git](https://git-scm.com). Se usan una sola vez para preparar la base de datos.

## 2. Instalación en tu computador

```bash
unzip visual-manager-fase1.zip
cd visual-manager
npm install
cp .env.example .env      # en Windows: copy .env.example .env
```

## 3. Base de datos en Neon

1. Entra a Neon, crea un proyecto (elige la región más cercana, por ejemplo *US East*).
2. En el panel del proyecto, botón **Connect**. Copia dos cadenas:
   - **Pooled connection** (el host contiene `-pooler`) → será `DATABASE_URL`.
   - **Direct connection** (sin `-pooler`) → será `DIRECT_URL`.
3. Pégalas en tu archivo `.env`.

> Neon duerme la base tras unos minutos sin uso; la primera visita después de un rato puede tardar uno o dos segundos más. Es normal.

## 4. Variables de entorno

| Variable | Para qué sirve |
|---|---|
| `DATABASE_URL` | Conexión *pooled* de Neon (la usa la aplicación). |
| `DIRECT_URL` | Conexión directa de Neon (la usa `db:push`). |
| `AUTH_SECRET` | Clave secreta de las sesiones. Genérala con `openssl rand -base64 32` (en Windows puedes usar cualquier texto aleatorio largo de 32+ caracteres). **Nunca la compartas.** |
| `NEXT_PUBLIC_SITE_URL` | Dirección pública del sitio, sin `/` final. Se usa en los enlaces de los avisos. |
| `COORDINATOR_*` | Datos del primer coordinador. Solo se usan al ejecutar `npm run db:seed` en tu computador. |

## 5. Crear las tablas y el primer coordinador

Con el `.env` completo:

```bash
npm run db:push     # crea las tablas en Neon
npm run db:seed     # crea configuración inicial, permisos por defecto y el primer Coordinador
```

El seed usa `COORDINATOR_EMAIL` y `COORDINATOR_PASSWORD` de tu `.env`. Es seguro repetirlo: no duplica nada ni cambia contraseñas existentes. Después de crear el coordinador, **borra la contraseña del `.env`** y cámbiala desde el panel si quieres.

Para probar en tu computador: `npm run dev` y abre http://localhost:3000.

## 6. Publicar en Netlify (gratis)

1. Crea un repositorio **privado** en GitHub y sube el proyecto:
   ```bash
   git init
   git add .
   git commit -m "Visual Manager fase 1"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/visual-manager.git
   git push -u origin main
   ```
   (`.env` está en `.gitignore`: tus claves no se suben.)
2. En Netlify: **Add new site → Import an existing project → GitHub** y elige el repositorio. Netlify detecta Next.js solo; `netlify.toml` ya trae el comando de construcción y Node 20.
3. Antes de desplegar, en **Site configuration → Environment variables** agrega `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` y `NEXT_PUBLIC_SITE_URL`.
4. Pulsa **Deploy**. Cuando termine, tendrás una dirección tipo `https://nombre.netlify.app` (con HTTPS ya activo).
5. Si la dirección final es distinta a la que pusiste en `NEXT_PUBLIC_SITE_URL`, corrígela en Netlify y vuelve a desplegar (**Deploys → Trigger deploy**).

## 7. Dominio propio y HTTPS (opcional)

- **Sin costo:** en Netlify puedes cambiar el nombre del subdominio en **Domain management → Options → Edit site name** (por ejemplo `visualmanager-mda.netlify.app`).
- **Dominio propio:** en **Domain management → Add a domain** sigue las instrucciones de Netlify para apuntar los DNS. El certificado HTTPS se emite automáticamente. Actualiza `NEXT_PUBLIC_SITE_URL` con el nuevo dominio y redespliega.

## 8. WhatsApp: manual y automático

### 8.1 Modo manual (gratis, funciona desde el primer día)
1. En **Equipo**, cada Líder y Coordinador debe tener su número de WhatsApp registrado (y los servidores, si quieres que les lleguen avisos).
2. Cuando ocurre algo, aparece un aviso en **Avisos de WhatsApp** (con contador en el menú).
3. Quien tenga abierto el WhatsApp del ministerio toca **Abrir WhatsApp**, envía el mensaje y pulsa **Marcar como enviado**.

### 8.2 Modo automático: qué hay que saber antes de decidir
Datos revisados en noviembre de 2026; **las tarifas y reglas de Meta cambian (las tarifas, cada trimestre), verifícalas antes de activar**.

- **Costo.** No hay cuota de licencia. Meta cobra por cada mensaje de plantilla entregado. En sus tarifas publicadas, un mensaje de *utilidad* a Colombia cuesta cerca de **US$0,0008** y uno de *marketing* cerca de **US$0,0125**. Con 1.000 avisos al mes serían unos US$0,80 si Meta clasifica la plantilla como utilidad (y unos US$12,50 si la reclasificara como marketing). Si usas un intermediario (Twilio, 360dialog, etc.), suma su propia tarifa. Meta pide un método de pago para cobrar; confírmalo al crear la cuenta.
- **Plantillas obligatorias.** Un mensaje que el ministerio inicia debe usar una plantilla aprobada por Meta. Por eso el sistema usa **una sola plantilla con dos variables** (nombre y texto del aviso). Meta puede tardar de minutos a horas en aprobarla y puede rechazarla o reclasificarla.
- **Tu número actual.** Hay dos caminos:
  - **Número dedicado (recomendado si lo administras tú):** un número nuevo (por ejemplo una SIM prepago) que solo usará la API. Es lo más estable y sencillo.
  - **“Coexistencia” (mantener tu número actual):** permite seguir usando la app *WhatsApp Business* en el celular y la API a la vez, pero **solo si el número ya está en la app WhatsApp Business** (no en el WhatsApp personal; si es personal, primero hay que pasarlo a Business), la app está actualizada, y el número no está ya conectado a la API con otro proveedor. Según los proveedores, se conecta mediante el registro integrado de Meta a través de un proveedor autorizado, y es **menos estable** que un número dedicado. No pude confirmar que se pueda hacer sin proveedor, así que si te interesa, consulta con uno que lo ofrezca.
  - En ambos casos Meta puede exigir verificación del negocio y aprobación del nombre visible.
- **MCP.** Meta no tiene un servidor MCP oficial de WhatsApp. Los servidores MCP comunitarios más usados se conectan como WhatsApp Web mediante librerías no oficiales (Baileys, whatsapp-web.js): **violan los términos de WhatsApp y hay reportes de bloqueos de números**, incluso con poco volumen. Hay uno basado en la API oficial, pero entonces se paga igual la tarifa de Meta. **MCP no hace gratis el envío**, por eso este proyecto envía directamente a la API oficial.
- **Consentimiento.** Avísale a los integrantes que recibirán sus asignaciones y recordatorios por WhatsApp desde el número del ministerio.

### 8.3 Activar el modo automático paso a paso
1. Crea una cuenta en [Meta for Developers](https://developers.facebook.com) y una app de tipo *Business* con el producto **WhatsApp**. Asocia (o crea) tu cuenta de *Meta Business*.
2. En *WhatsApp → API Setup*, agrega el número del ministerio (dedicado, o coexistencia según 8.2). Anota el **ID del número de teléfono** (`WHATSAPP_PHONE_NUMBER_ID`).
3. Crea un **usuario del sistema** en el administrador de negocios, asígnale la app y la cuenta de WhatsApp con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`, y genera un **token que no caduque** (`WHATSAPP_TOKEN`).
4. En *WhatsApp Manager → Plantillas de mensajes*, crea la plantilla:
   - **Nombre:** `aviso_ministerio_visuales` (será `WHATSAPP_TEMPLATE_NAME`)
   - **Categoría:** Utilidad · **Idioma:** Español (`es`)
   - **Cuerpo:** `Hola {{1}}, tienes un aviso del Ministerio de Visuales MDA: {{2}} Entra al panel de Visual Manager para ver el detalle.`
   - **Ejemplos de variables:** `{{1}}` = `Carlos`; `{{2}}` = `Nueva asignación: Sonido en "Servicio dominical", domingo 15 de noviembre, de 09:00 a 12:00.`
   Espera a que quede **Aprobada**. (Si ves que el idioma aprobado es otro, por ejemplo `es_CO`, ponlo en `WHATSAPP_TEMPLATE_LANG`.)
5. En Netlify (*Environment variables*) agrega `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANG`, `WHATSAPP_APP_SECRET` (*Configuración de la app → Básica → Clave secreta*), `WHATSAPP_VERIFY_TOKEN` (una clave que inventes) y `CRON_SECRET` (una clave larga aleatoria). Vuelve a desplegar.
6. **Webhook** (para saber si se entregó o se leyó): en *WhatsApp → Configuración → Webhook* registra `https://TU-SITIO/api/whatsapp/webhook`, con tu `WHATSAPP_VERIFY_TOKEN`, y suscríbete al campo **messages**.
7. En Visual Manager: **Configuración → WhatsApp**. Verifica que todo diga *Listo*, envía un **mensaje de prueba**, y si llega, cambia el modo a **Automático**.

> **Verifícalo con un envío de prueba antes de depender de él.** No pude probar la conexión con Meta desde mi entorno: el código sigue la documentación pública de la API (versión v25.0), pero la primera prueba real es la que confirma que todo está bien conectado.

### 8.4 Recordatorios y tareas programadas
- El archivo `netlify/functions/cron.mts` es una **función programada de Netlify** que cada hora llama a `/api/cron` (necesita `CRON_SECRET`). Ese endpoint genera los recordatorios (si los activaste en *Configuración → WhatsApp*), reintenta envíos fallidos y avisa una vez al día de los préstamos vencidos.
- Si la función programada no corre en tu plan, usa un servicio gratuito como [cron-job.org](https://cron-job.org): una tarea por hora a `https://TU-SITIO/api/cron` con el encabezado `Authorization: Bearer TU_CRON_SECRET`.
- Sin tarea programada todo sigue funcionando: los recordatorios se generan con el botón de *Programación*.

## 9. Flujo recomendado de la Fase 2

1. **Coordinador:** revisa *Configuración → Áreas de servicio y habilidades* y ajusta lo que necesites.
2. **Coordinador:** crea las cuentas de los servidores en *Equipo* (con su WhatsApp). Cada uno entra, hace el test y marca su disponibilidad.
3. **Coordinador o líder:** abre el perfil de cada servidor (*Equipo →* su nombre), mira el resultado del test y valida sus áreas y habilidades. **Sin áreas validadas no se puede asignar a nadie sin la casilla “asignar de todos modos”.**
4. Al llegar una solicitud: *Programar este servicio* → asigna servidores por área. Cada servidor recibe un aviso en el panel y, si tiene WhatsApp, queda en la cola de *Avisos de WhatsApp* para enviárselo.
5. Antes del evento: en *Programación* usa *Generar recordatorios* y envíalos desde *Avisos de WhatsApp*.
6. Si alguien no puede asistir, ve a *Programación* para seguir los cambios y las emergencias.

## 9b. Flujo recomendado de la Fase 3

1. **Inventario → Registrar equipo:** carga los equipos con su cantidad real. Ajusta las categorías al final de la página de Equipos.
2. **Inventario → Paquetes técnicos:** crea, por ejemplo, “Sonido básico” (consola pequeña, cabinas, micrófonos, cables, extensiones, multitomas) y los paquetes de proyección y transmisión.
3. En una **solicitud** (o servicio), baja a “Equipos para el evento”: agrega paquetes y equipos sueltos, revisa la lista final y las advertencias, y pulsa *Reservar estos equipos*.
4. El día del evento: *Marcar todo en uso*; al terminar: *Marcar todo devuelto*. Si algo volvió con daños, regístralo en la ficha del equipo (*Mantenimiento y daños*).
5. Para prestar un equipo fuera de un evento: entra a su ficha y usa *Registrar un préstamo*.

Notas: si cambias la fecha u horario de un servicio, sus reservas lo siguen; si rechazas o cancelas una solicitud, o cancelas un servicio, se liberan las reservas pendientes. Si un servicio viene de una solicitud, sus equipos se gestionan desde la solicitud para no duplicarlos.

## 9c. Flujo recomendado de la Fase 5

1. Después de cada servicio, abre su ficha en **Programación** y marca la **asistencia** de cada servidor (presente o ausente). Sin ese registro, las cifras de asistencia salen en blanco.
2. Cuando necesites el informe: **Estadísticas e informes** → elige el período → revisa las cifras → escribe logros, necesidades y observaciones → **Generar informe**.
3. En la página del informe descarga el **PDF** (para la pastora) y/o el **Excel**. Si luego cambia algo, usa *Recalcular cifras con los datos de hoy* y vuelve a descargar.
4. Para usar formación: **Configuración → General → Módulo de formación: Activado**, y luego crea capacitaciones y publica materiales en **Formación**.

Notas: las cifras de inventario del informe son una foto del momento en que se generó; el resto corresponde al período. Los permisos *Ver estadísticas y generar informes* y *Gestionar formación* se pueden dar o quitar al rol Líder en *Configuración → Permisos por rol*.

## 9d. Uso diario del Coordinador

- **Configuración → General:** días mínimos, texto de la advertencia, WhatsApp del ministerio.
- **Configuración → Requerimientos técnicos:** agregar, editar, desactivar o eliminar las opciones que ve quien solicita.
- **Configuración → Permisos por rol:** definir qué puede hacer cada Líder y Servidor.
- **Equipo:** crear usuarios, cambiar rol, activar/desactivar y restablecer contraseñas.

## 10. Copias de seguridad

- **Neon** guarda un historial para restaurar la base a un momento anterior; en el plan gratuito la ventana es limitada, revisa la actual en su documentación.
- **Respaldo propio:** ejecuta `npm run db:export` en tu computador (con el `.env` configurado). Crea `backups/backup-FECHA.json` con todos los datos del sistema —solicitudes, equipo, programación, inventario, préstamos, informes, formación, configuración y avisos— excepto las contraseñas. Guárdalo en un lugar seguro, por ejemplo una vez al mes.

## 11. Actualizaciones

1. Reemplaza los archivos del proyecto con la nueva versión (conserva tu `.env`).
2. Si la versión nueva cambia la base de datos, ejecuta `npm run db:push` (la Fase 5 agrega tablas de formación e informes, y la asistencia) en tu computador. **Al pasar de una fase a la siguiente hazlo siempre**: solo agrega tablas y columnas, no borra datos.
3. Ejecuta también `npm run db:seed`: crea las áreas, habilidades y categorías de inventario de ejemplo y le da al rol Líder los permisos nuevos (equipo, programación, inventario, informes y formación) sin cambiar lo que ya hayas configurado. Es seguro repetirlo.
3. `git add . && git commit -m "Actualización" && git push`. Netlify despliega solo.

## 12. Seguridad y límites a tener en cuenta

- Las contraseñas se guardan con bcrypt; las sesiones duran 7 días y se revalidan contra la base en cada visita (si desactivas a alguien, pierde el acceso de inmediato).
- El formulario público incluye un campo trampa contra bots, pero no un límite de envíos. Si recibes spam, se puede agregar un CAPTCHA gratuito.
- En modo manual los avisos no se envían solos. En modo automático, los tokens de Meta son secretos: guárdalos solo en las variables de entorno de Netlify, nunca en el código ni en GitHub.
- Cada persona debe usar su propia cuenta y una contraseña que no repita en otros sitios.
- Los planes gratuitos tienen límites (almacenamiento de Neon, créditos de Netlify) que pueden cambiar. Para un ministerio de este tamaño suelen sobrar, pero revísalos de vez en cuando.

## 13. Lista de verificación para ponerlo en marcha

1. [ ] Neon creado y `.env` completo (`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`).
2. [ ] `npm install`, `npm run db:push`, `npm run db:seed` (crea tu usuario Coordinador). Borra la contraseña del `.env`.
3. [ ] Repositorio privado en GitHub y sitio en Netlify con las mismas variables. Primer despliegue correcto.
4. [ ] Entras con tu usuario Coordinador y revisas *Configuración*: nombre del ministerio, días de anticipación, texto de advertencia, requerimientos técnicos, áreas y habilidades, permisos del Líder.
5. [ ] Creas a los líderes y servidores (con su WhatsApp) en *Equipo*. Cada servidor hace el test y marca su disponibilidad; tú validas sus áreas.
6. [ ] Cargas el inventario y los paquetes técnicos.
7. [ ] Pruebas el formulario público desde un celular, como si fueras un pastor: debe llegar la solicitud y el aviso.
8. [ ] Compartes el enlace del formulario público con los ministerios.
9. [ ] (Opcional) Activas el WhatsApp automático y la tarea programada (sección 8).
10. [ ] Haces tu primer respaldo con `npm run db:export` y lo guardas.
11. [ ] (Opcional) Generas la app de Android para los servidores (sección 16).

## 14. Estructura

```
prisma/schema.prisma      Tablas (usuarios, permisos, solicitudes, requerimientos, avisos, configuración)
prisma/seed.ts            Datos iniciales y primer coordinador
src/app/                  Páginas: formulario público, seguimiento, login y panel
src/app/panel/actions.ts  Acciones del panel (con verificación de rol y permisos)
src/lib/permissions.ts    Lista de permisos configurables
src/lib/whatsapp-api.ts   Envío por la API oficial de WhatsApp (plantilla de 2 variables)
src/lib/dispatch.ts       Cola de envíos: enviar, reintentar y volver a la cola manual si falla
src/app/api/whatsapp/webhook/  Estados de entrega que envía Meta (firmados)
src/app/api/cron/         Tarea programada: recordatorios, reintentos, préstamos vencidos
netlify/functions/cron.mts  Función de Netlify que llama a /api/cron cada hora
src/lib/scheduling.ts     Reglas de disponibilidad, habilidades y cruces de horario
android/                  App Android (Kotlin): cascarón de la plataforma con avisos en el celular
.github/workflows/android.yml  Compila el APK en GitHub
src/app/api/app/notifications/  Avisos nuevos para la app
src/components/AppBottomNav.tsx  Barra inferior del modo app
src/lib/stats.ts          Cálculo de todas las estadísticas de un período
src/lib/periods.ts        Períodos mensual, trimestral, semestral, anual y personalizado
src/lib/report-pdf.ts     Informe ministerial en PDF (portada, tablas, gráficos)
src/lib/report-xlsx.ts    Informe ministerial en Excel (con fórmulas)
src/app/api/informes/     Descarga protegida de los informes
src/app/panel/training-actions.ts  Formación: capacitaciones, materiales y participaciones
src/lib/inventory.ts      Consolidación de listas, disponibilidad de equipos y estados del inventario
src/components/EquipmentPlanner.tsx  Lista de equipos de un evento (paquetes, validación y reservas)
src/app/panel/inventory-actions.ts   Equipos, préstamos, paquetes, reservas y novedades
src/app/panel/schedule-actions.ts  Servicios, asignaciones, reemplazos, intercambios y emergencias
src/app/panel/team-actions.ts      Perfiles, test, disponibilidad, áreas y habilidades
src/lib/notify.ts         Creación de avisos de WhatsApp
scripts/export.ts         Respaldo en JSON
```

## 15. Cumpleaños de los integrantes

- Cada integrante registra su cumpleaños en **Mi perfil**; el coordinador y los líderes también pueden hacerlo al crear al usuario o en su ficha (*Equipo →* su nombre). **Solo se guarda el día y el mes, no el año.**
- **Resumen y Equipo** (coordinador y líderes) muestran los próximos cumpleaños (30 y 60 días). Esto funciona siempre, sin configurar nada más.
- **Aviso automático:** una vez al día, después de las 8 a. m., el coordinador y cada líder reciben un aviso con quién cumple años **hoy** y quién cumple dentro de unos días (por defecto, 3). Nadie recibe aviso de su propio cumpleaños. Se activa, desactiva y ajusta en *Configuración → WhatsApp*. Usa la tarea programada (sección 8.4); llega al panel y a la cola de WhatsApp (o sale solo, si activaste el modo automático).
- Se incluye en el respaldo (`npm run db:export`).

## 16. App para Android (servidores)

La app es un **cascarón nativo de Android** que abre la plataforma (la parte posterior al inicio de sesión) dentro de una aplicación instalable. No incluye el formulario público de solicitudes ni la consulta: en la app esas páginas no existen. Los servidores entran con su correo y contraseña y ven sus turnos, confirmaciones, reemplazos e intercambios, disponibilidad, notificaciones, perfil y test, formación, novedades técnicas y cumpleaños. Si un coordinador o líder entra con la app, también ve sus secciones en “Más”.

**Qué hace la app**
- Barra inferior (Inicio, Turnos, Disponibilidad, Avisos, Más) y menú completo en “Más”.
- Sesión de **30 días** (en el navegador son 7), botón “atrás”, deslizar para actualizar y pantalla de “sin conexión”.
- **Avisos en el celular:** cada ~15 minutos la app revisa si hay avisos nuevos (asignaciones, recordatorios, cambios, reemplazos…) y los muestra como notificación. No usa Firebase: **no es instantáneo** (Android permite revisar como mínimo cada 15 minutos y el ahorro de batería puede retrasarlo). Android 13 o superior pide permiso de notificaciones.
- Los enlaces externos (WhatsApp, Drive, YouTube) se abren en su propia aplicación.
- Funciona en **Android 8.0 o superior**. No hay versión para iPhone.

**Cómo obtener la app (sin instalar nada en tu computador)**
1. Despliega esta versión de la plataforma (se sube a GitHub como siempre; **no hay cambios en la base de datos**, no necesitas `db:push`).
2. En GitHub, en tu repositorio: *Settings → Secrets and variables → Actions → pestaña Variables → New repository variable*. Nombre: `SITE_URL`; valor: la dirección de tu plataforma con `https://`, sin `/` al final (por ejemplo `https://visuales-mda.netlify.app`).
3. Pestaña **Actions → “Compilar app Android” → Run workflow**. (También se ejecuta sola cuando cambia algo dentro de la carpeta `android/`.) Tarda unos 5 a 10 minutos. Los repositorios privados usan los minutos mensuales de tu plan de GitHub.
4. Al terminar, entra a la ejecución y descarga el archivo **visuales-mda-app** (viene en un .zip; dentro está el `app-release.apk`).
5. Envía el `.apk` a los servidores (WhatsApp, Drive…). En el celular: abrirlo e instalarlo; Android pedirá permitir “instalar apps desconocidas” para ese origen. Google Play Protect puede advertir que la app no es conocida: es normal en apps que no vienen de la tienda.

**Actualizar la app.** La app muestra siempre la versión actual de la plataforma: **cuando actualices la web, la app se actualiza sola**. Solo hay que generar un APK nuevo si cambias algo de la propia app (carpeta `android/`) o la dirección del sitio.

**Firma propia (recomendada si piensas actualizar la app).** Por defecto el APK se firma con una llave de pruebas distinta en cada compilación: sirve para instalar, pero un APK nuevo **no se puede instalar encima del anterior** (hay que desinstalar la app y volver a instalarla; solo implica volver a iniciar sesión). Para que se actualice sin problemas, crea una llave **una sola vez** y guárdala:

```bash
keytool -genkeypair -v -keystore visuales.jks -alias visuales -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 visuales.jks    # en Windows: certutil -encode visuales.jks visuales.b64
```

Luego, en *Settings → Secrets and variables → Actions → Secrets*, crea: `KEYSTORE_BASE64` (el texto base64), `KEYSTORE_PASSWORD`, `KEY_ALIAS` (`visuales`) y `KEY_PASSWORD`. **Guarda el archivo `visuales.jks` y sus claves en un lugar seguro: si los pierdes, no podrás actualizar la app instalada.**

**Opcional.** Compilar con Android Studio: abre la carpeta `android/`, agrega la línea `siteUrl=https://tu-sitio.netlify.app` en `android/gradle.properties` y ejecuta *Build → Build APK(s)*. Publicar en Google Play requiere una cuenta de desarrollador (pago único) y un paquete AAB; no está incluido.

**Notas técnicas.** La app se identifica ante la plataforma con el texto `VisualManagerApp` en su *user agent*; con eso la web oculta el formulario público y muestra la barra inferior. Los avisos usan `/api/app/notifications` con la misma sesión. Código en `android/` (Kotlin), flujo de compilación en `.github/workflows/android.yml`.

## 17. Diseño y personalización visual

El diseño sigue el boceto del ministerio: degradado `#031660 → #2848c0 → #6f87e1 → #ffffff`, botones `#1800ad` con letra y contorno blancos, letras del formulario en negro y campos en forma de píldora.

- **Tipografías** (se cargan solas desde Google Fonts): *League Spartan* para el título y los botones; *Poppins* para el resto, en peso ultradelgado (lema), muy delgado (“Solicita apoyo técnico”) y seminegrita (etiquetas de los campos).
- **Lema** bajo “VISUALES MDA”: se cambia en *Configuración → General*.
- **Colores y fuentes:** están en `tailwind.config.ts` (`navy`, `royal`, `sky`, `brand`, `lamp`, `mist`) y en `src/app/globals.css` (botones y campos); al cambiarlos se actualiza toda la plataforma, incluido el panel.
- El informe en PDF y Excel usa la misma paleta.
